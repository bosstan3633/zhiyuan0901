/**
 * V4.3.0：画像洞察四段 AI 分析状态机。
 *
 * 页面只持有可渲染状态；AI 配置、任务工厂和网络客户端都在首次调用时动态载入，
 * 保证未配置 AI 的用户打开画像页不会触发任何 AI 运行时依赖。
 */
import { computed, onMounted, reactive, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { AppData } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import type { DailyStats } from '@/shared/utils/dailyStats'
import type { AiJob } from '@/shared/ai/job'
import { K } from '@/shared/storage/keys'
import { showToast } from '@/shared/components/toast'
import {
  buildPeriodReviewContext,
  type PeriodReviewContext,
  type PeriodReviewRange,
  type PeriodReviewResult,
} from '@/shared/utils/periodReview'

export interface PeriodAiState {
  range: PeriodReviewRange
  result: PeriodReviewResult | null
  loading: boolean
  error: string
  stale: boolean
  unconfigured: boolean
  cachedAt: number
}

interface CachedPeriodReview {
  fingerprint: string
  cachedAt: number
  result: PeriodReviewResult
}

type PeriodCache = Partial<Record<PeriodReviewRange, CachedPeriodReview>>

const CACHE_KEY = K.AI_PERIOD_REVIEW_CACHE
const RANGES: PeriodReviewRange[] = ['today', 'week', 'month', 'year']

function emptyState(range: PeriodReviewRange): PeriodAiState {
  return {
    range,
    result: null,
    loading: false,
    error: '',
    stale: false,
    unconfigured: false,
    cachedAt: 0,
  }
}

async function readCache(): Promise<PeriodCache> {
  try {
    const area = (globalThis as { chrome?: { storage?: { local?: chrome.storage.StorageArea } } }).chrome?.storage?.local
    if (!area) return {}
    const raw = (await area.get([CACHE_KEY]))[CACHE_KEY]
    return raw && typeof raw === 'object' ? raw as PeriodCache : {}
  } catch {
    return {}
  }
}

async function writeCache(cache: PeriodCache): Promise<void> {
  try {
    const area = (globalThis as { chrome?: { storage?: { local?: chrome.storage.StorageArea } } }).chrome?.storage?.local
    if (area) await area.set({ [CACHE_KEY]: JSON.parse(JSON.stringify(cache)) })
  } catch {
    /* 存储失败不阻断本轮页面展示 */
  }
}

export function usePeriodAiReview(input: {
  activeRange: Ref<PeriodReviewRange>
  data: Ref<AppData>
  events: Ref<CardEvent[]>
  stats: Ref<DailyStats>
}) {
  const states = reactive<Record<PeriodReviewRange, PeriodAiState>>({
    today: emptyState('today'),
    week: emptyState('week'),
    month: emptyState('month'),
    year: emptyState('year'),
  })
  const contexts = Object.fromEntries(RANGES.map(range => [
    range,
    computed(() => buildPeriodReviewContext({
      data: input.data.value,
      events: input.events.value,
      stats: input.stats.value,
      range,
    })),
  ])) as Record<PeriodReviewRange, ComputedRef<PeriodReviewContext>>
  const aiJob = shallowRef<AiJob | null>(null)
  const controllers = new Map<PeriodReviewRange, AbortController>()
  const initialized = new Set<PeriodReviewRange>()

  function jobContext(range: PeriodReviewRange): PeriodReviewContext {
    return contexts[range].value
  }

  function stateFor(range: PeriodReviewRange): PeriodAiState {
    return states[range]
  }

  async function loadCached(range: PeriodReviewRange, context: PeriodReviewContext): Promise<boolean> {
    const cache = await readCache()
    const saved = cache[range]
    if (!saved?.result) return false
    states[range].result = { ...saved.result, cached: true }
    states[range].cachedAt = saved.cachedAt
    states[range].stale = saved.fingerprint !== context.fingerprint
    return true
  }

  async function generate(range: PeriodReviewRange, notify = false): Promise<void> {
    const state = states[range]
    if (state.loading) return
    const context = jobContext(range)
    controllers.get(range)?.abort()
    const controller = new AbortController()
    controllers.set(range, controller)
    state.loading = true
    state.error = ''
    try {
      const [{ loadAiConfig, aiReady }, select, llm] = await Promise.all([
        import('@/shared/ai/config'),
        import('@/shared/ai/select'),
        import('@/shared/ai/llm'),
      ])
      await loadAiConfig()
      if (!aiReady.value) {
        state.unconfigured = true
        state.loading = false
        return
      }
      state.unconfigured = false
      const job = select.buildPeriodReviewJob(range, context)
      // 入口矩阵把 aiJob 作为“正在执行的 AI 入口”锚；这里不打开建议抽屉。
      aiJob.value = job
      const built = await job.build()
      const raw = await llm.chatStream({
        messages: built.messages,
        jsonMode: built.jsonMode,
        temperature: 0.2,
        maxTokens: 1400,
        signal: controller.signal,
      })
      const rows = job.parse(raw)
      const result = rows[0]?.data as PeriodReviewResult | undefined
      if (!result) throw new Error('AI 未返回可用的周期洞察')
      state.result = { ...result, cached: false }
      state.stale = result.fingerprint !== context.fingerprint
      state.cachedAt = Date.now()
      state.unconfigured = false
      const cache = await readCache()
      cache[range] = { fingerprint: context.fingerprint, cachedAt: state.cachedAt, result: state.result }
      await writeCache(cache)
      if (notify) showToast(`已更新${state.range === 'today' ? '今天' : state.range === 'week' ? '本周' : state.range === 'month' ? '本月' : '本年'} AI 复盘`)
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return
      state.error = error instanceof Error ? error.message : String(error)
      if (!state.result) showToast(`AI 复盘失败：${state.error}`)
    } finally {
      if (controllers.get(range) === controller) controllers.delete(range)
      state.loading = false
      aiJob.value = null
    }
  }

  async function ensure(range: PeriodReviewRange): Promise<void> {
    if (initialized.has(range)) return
    initialized.add(range)
    const context = jobContext(range)
    const loaded = await loadCached(range, context)
    if (loaded && !states[range].stale) return
    if (loaded) return
    try {
      const { loadAiConfig, aiReady } = await import('@/shared/ai/config')
      await loadAiConfig()
      if (!aiReady.value) {
        states[range].unconfigured = true
        return
      }
      await generate(range)
    } catch (error) {
      states[range].error = error instanceof Error ? error.message : String(error)
    }
  }

  watch(() => input.activeRange.value, range => { void ensure(range) })
  onMounted(() => { void ensure(input.activeRange.value) })
  for (const range of RANGES) {
    watch(contexts[range], context => {
      const state = states[range]
      if (state.result && state.result.fingerprint !== context.fingerprint) state.stale = true
    }, { immediate: true })
  }

  const current = computed(() => states[input.activeRange.value])

  return {
    contexts,
    states,
    current,
    stateFor,
    generate,
    ensure,
    aiJob,
  }
}
