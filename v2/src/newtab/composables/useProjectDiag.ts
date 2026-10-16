/**
 * ★F4（2026-10-15）：单项目 AI 诊断宿主逻辑 —— 从 CompassTree 下沉的可复用 composable。
 *
 * 为什么下沉：诊断入口本轮从「只有项目塔舱头一处」扩到「全景项目头 + 项目详情页」三处，
 * 但会话缓存（diags）必须**全站一份** —— 各宿主各自 new 一份状态就会出现
 * 「塔里刚诊断完，全景还是空的」。所以状态与流程收在这里，宿主只管：
 *   ① 传入 `d`（AppData ref）与 `setJob`（把 job 交给本页的 AiDrawer 渲染）；
 *   ② 渲染两态入口（复用 CompassTowerStatus）与 ProjectDiagnoseModal。
 *
 * 红线（N2 定案，不许破）：只手动触发、从不自动跑、不预生成；过期只降亮不撤标签。
 * 懒加载：AI 栈不许进入口 chunk —— 诊断引擎整块按需 import（模块级单例缓存）。
 */
import { ref, shallowRef, computed, onMounted, onUnmounted, type Ref } from 'vue'
import type { AppData } from '@/shared/models'
import { showToast } from '@/shared/components/toast'

type DiagEng = typeof import('@/shared/ai/projectDiagnose')
type ProjectDiagnosis = import('@/shared/ai/projectDiagnose').ProjectDiagnosis
type AiJob = import('@/shared/ai/job').AiJob

let diagEngP: Promise<DiagEng> | null = null
const diagEngOf = (): Promise<DiagEng> => (diagEngP ||= import('@/shared/ai/projectDiagnose'))

/** 模块级单例：跨宿主共享同一份会话缓存（KeepAlive 切页也不丢） */
let sharedEng: DiagEng | null = null
const sharedDiags = shallowRef<Record<string, ProjectDiagnosis>>({})
let handlerBound = false
/** 弹窗态也是会话级单例：采纳写库的顶开回调可能来自任意宿主，不能挂在某一个实例的 ref 上 */
const sharedDiagOpen = ref(false)
const sharedDiagProjId = ref('')

export function useProjectDiag(opts: { d: Ref<AppData | null>; setJob: (job: AiJob) => void }) {
  const diagOpen = sharedDiagOpen
  const diagProjId = sharedDiagProjId

  /** 过期态＝当前数据重算的指纹 ≠ 报告里的指纹；引擎未加载或没报告的项目不白算 */
  const diagStaleMap = computed<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    const eng = sharedEng
    if (!eng || !opts.d.value) return out
    for (const pid of Object.keys(sharedDiags.value)) {
      const fresh = eng.runProjectDiagnosis(opts.d.value, pid)
      out[pid] = !fresh || fresh.fingerprint !== sharedDiags.value[pid].fingerprint
    }
    return out
  })
  const diagFor = (pid: string) => sharedDiags.value[pid] || null
  const diagStale = (pid: string) => !!diagStaleMap.value[pid]

  /** 跑诊断：接入闸（没配好 AI 在入口拦下，不白建 job）→ 建 job 交给宿主的 AiDrawer */
  async function startProjectDiag(projId: string) {
    const [{ loadAiConfig, aiReady }, eng] = await Promise.all([import('@/shared/ai/config'), diagEngOf()])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    if (!opts.d.value) return
    const job = eng.buildProjectDiagnoseJob({ d: opts.d.value, projId })
    if (!job) { showToast('⚠ 项目不存在，请刷新后重试'); return }
    opts.setJob(job)
  }

  /** 入口两态的统一落点：没报告 → 跑；有报告 → 开中央弹窗 */
  function openDiagReport(projId: string) {
    if (!sharedDiags.value[projId]) { void startProjectDiag(projId); return }
    diagProjId.value = projId
    diagOpen.value = true
  }
  /** 弹窗里的「重新诊断」= 关窗 + 重新跑（手动触发红线：从不自动重跑） */
  function rerunDiag() {
    const pid = diagProjId.value
    diagOpen.value = false
    if (pid) void startProjectDiag(pid)
  }
  const diagReport = computed(() => (diagOpen.value ? sharedDiags.value[diagProjId.value] || null : null))

  // 挂载即恢复会话缓存里的报告（关浏览器即失效，"恢复"只在本次会话内有意义）
  onMounted(() => {
    void diagEngOf().then(async eng => {
      sharedEng = eng
      sharedDiags.value = await eng.loadAllDiagnoses()
      if (!handlerBound) {
        handlerBound = true
        // 采纳写库后用回调顶开弹窗——不让宿主去轮询 storage
        eng.setProjectDiagSavedHandler(rep => {
          sharedDiags.value = { ...sharedDiags.value, [rep.projId]: rep }
          diagProjId.value = rep.projId
          diagOpen.value = true
        })
      }
    })
  })
  onUnmounted(() => {
    // 引擎与缓存不随宿主卸载清空（会话级单例）；只在最后一个宿主走后由 GC 收
    // savedHandler 保持绑定——弹窗顶开由当前打开的宿主自己判断 v-if
  })

  return { diagFor, diagStale, startProjectDiag, openDiagReport, rerunDiag, diagOpen, diagProjId, diagReport }
}
