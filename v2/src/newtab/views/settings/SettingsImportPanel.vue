<script setup lang="ts">
/**
 * 导入数据子域（V3.8.42 P0-3 第四批，从 GlobalSettings.vue 搬出）
 *
 * ★宿主接线：<SettingsImportPanel v-if="activePage === 'import'" />
 *   v-if 在宿主——本组件只管「导入」这一页的内部结构，面板显隐归宿主。
 *
 * ★downloadFile / dateStr 不走 props、也不复制：它们与导出子域共用，已一并抽进
 *   settings/io-utils.ts（两个子域都要用；props 双向传会成环，复制会造出第二个
 *   「文件下载」口径，而口径分叉是这类工具函数的典型死法）。
 *
 * ★aiEnrichIds 走 props 而不把 AI 段一起搬过来：它属于 AI 子域（宿主 1894 行起，牵连
 *   aiConfig/aiGuard/aiCatVocab 一整套），跟导入链路只是「书签导入完想批量补全」一个调用点。
 *   aiReady 同理：由宿主 AI 配置派生，本页只读它决定那颗钮能不能点。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs, normalizeLegacyCards, stripRetiredCardKeys } from '@/shared/storage/repository'
import { useBookmarkImport } from '@/newtab/composables/useBookmarkImport'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { sanitizeCardCols } from '@/shared/utils/cardCols'
import { sanitizeWsView } from '@/shared/utils/wsView'
import { resolveTheme } from '@/shared/utils/theme'
import { sanitizeThesisDuplicates } from '@/shared/storage/hub'
import { freshTagsOf, canonicalTagsOf } from '@/shared/utils/tags'
import { DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'
import Icon from '@/shared/components/Icon.vue'
import { downloadFile, dateStr } from './io-utils'
import { defaultThesisFieldDefs } from '@/shared/storage/defaults'
import { dateKey, weekStartKey } from '@/shared/utils'
import type { AppData, ResourceCard, TaskCard, CuriosityCard, ID } from '@/shared/models'

const { aiReady, aiEnrichIds, wsDisplayNameOf } = defineProps<{
  /** AI 是否已接入（决定「归类并补全这批」那颗钮能不能点） */
  aiReady: boolean
  /** 宿主的批量补全入口（AI 子域，不随本子域搬） */
  aiEnrichIds: (ids: Set<string>) => void
  /** 显示名工具，用于「书签导入到」下拉 */
  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string
}>()

/** 附件包 zip 的解包写回实现住在**导出子域**，驱动它的是本页那枚 accept=".zip" 的 input。
 *  ★走 emit 而不是 props：export 组件不能被 import 组件 import（会成环），
 *  而 props 方向是「宿主 → 子组件」，宿主此刻并没有这个函数（它随 export 搬走了）。
 *  ⇒ 唯一不环的路径是：input 事件 emit 给宿主，宿主转交给 export 组件的 expose。 */
const emit = defineEmits<{ (e: 'asset-pack', ev: Event): void }>()

const store = useAppStore()

// ---- 导入 ----
const fileInput = ref<HTMLInputElement | null>(null)
const assetPackInput = ref<HTMLInputElement | null>(null)
const bookmarkTargetWs = ref('__new__')
// R4-Db：书签导入的解析与落库全部住在 useBookmarkImport（原先本页自带第二份解析器，
// 与 useWorkspaceImport 那份互为副本、且漏了实体解码与软删分类排除两处硬化）
const { bookmarkInput, bookmarkImport, handleBookmarkImport } = useBookmarkImport({
  d: computed(() => store.data!),
  persist: () => store.persist()
})
/** 导入回执：把新建卡 id 交给「归类并补全这批」入口（R138-H3：不自动弹抽屉） */
async function onBookmarkFile(e: Event) {
  const ids = await handleBookmarkImport(e, bookmarkTargetWs.value)
  if (ids.length) pendingImportEnrich.value = ids
}

function triggerFileImport() { fileInput.value?.click() }

function handleFileImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result as string) as AppData
      // R47-A2：版本校验（不兼容直接拒绝，不做部分导入）
      if (!imported || typeof imported !== 'object' || imported.version !== 2) {
        showToast('数据版本不兼容（需 v2 格式），已取消导入'); return
      }
      // R47-A2：导入前自动备份当前数据到本地文件（防误合并，T3 安全网）
      // R70：自动备份同样剥离 Airtable 凭证与同步映射——用户不会预期「我只是导入，怎么生成了一个含令牌的文件」。
      try {
        const safeBackup = { ...(store.data as unknown as Record<string, unknown>) }
        delete safeBackup.airtableSync
        downloadFile(`zhiyuan_auto_backup_before_import_${dateStr()}.json`, JSON.stringify(safeBackup, null, 2))
      } catch (e) {
        // R114-59：导入前自动备份是防误合并安全网——失败必须让用户知道（导入仍继续，但明示风险）
        console.warn('[zy] 导入前自动备份失败', e)
        showToast('导入前自动备份失败（将直接导入，建议先取消并手动导出备份）')
      }
      const n = mergeImport(imported)
      // R66-F4：全量包附带 uiPrefs 时自动应用主题/密度（即时生效，不再询问）
      const ui = (imported as unknown as Record<string, unknown>).uiPrefs as Record<string, unknown> | undefined
      if (ui && typeof ui === 'object') {
        if (typeof ui.theme === 'string' && ui.theme) {
          // R156：ui.theme 可为 'auto'（跟随系统），落 data-theme 前统一解析
          document.documentElement.setAttribute('data-theme', resolveTheme(ui.theme))
          saveUIPrefs({ theme: ui.theme })
        }
        if (typeof ui.density === 'string' && ui.density) {
          if (ui.density === 'compact') document.documentElement.setAttribute('data-density', 'compact')
          else document.documentElement.removeAttribute('data-density')
          saveUIPrefs({ density: ui.density as 'compact' | 'cozy' })
        }
        // R72-G7：界面偏好包补齐「卡片视图列数」（按模块键 + 4/5/6/7 白名单校验后落库，非法值丢弃）
        const cols = sanitizeCardCols(ui.cardCols)
        if (Object.keys(cols).length) saveUIPrefs({ cardCols: cols })
        // R84（W2-②）：界面偏好包补齐「各台视图模式」（按台 id + 四值白名单校验后落库，非法值丢弃）
        const wv = sanitizeWsView(ui.wsViewMode)
        if (Object.keys(wv).length) saveUIPrefs({ wsViewMode: wv })
      }
      showToast(`导入完成（并集）：卡片 ${n.cards}、罗盘方向 ${n.dirs}、策展台 ${n.ws}${ui ? '；界面偏好已应用' : ''}${n.catFix ? `；分类树已自动修复（${n.catFix}）`: ''}${n.thesisClear ? `；中心论点重复已净化（清 ${n.thesisClear} 张多余标记）`: ''}；已自动下载导入前备份`)
    } catch { showToast('文件格式错误，请选择有效的JSON文件') }
  }
  reader.readAsText(file)
  input.value = ''
}

function mergeImport(imported: AppData): { cards: number; dirs: number; ws: number; catFix: string; thesisClear: number } {
  const d = store.data!
  // R70：分类树结构净化（唯一的导入防线）——此前只认 version。含环的 categories 经下面的
  // mergeById（{ ...existing, ...incoming } 会覆盖 parentId）进库后，分类树渲染/计数递归会无限
  // 展开（或 while 上行走链死转）→ 资源台与相关策展台永久打不开，且界面里没有入口能删掉坏分类。
  // 净化失败（节点数超上限）时只跳过分类段，其余段照常合并，把损失限制到最小。
  const catSan = sanitizeCategoryTree(imported.categories || [])
  const safeCats = catSan.ok ? catSan.cats : []
  const catFix = catSan.ok ? (catTreeFixedAny(catSan.fixed) ? catTreeFixNote(catSan.fixed) : '') : '分类数量超上限，已跳过分类段'
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(x => [x.id, x]))
    for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
    return [...map.values()]
  }
  const union = (...lists: (ID[] | undefined)[]): ID[] => Array.from(new Set(lists.flatMap(l => l || [])))
  const wsBefore = d.workspaces.length

  // ---- 方向台：策展台 / 分类 / 三卡 ----
  // R48-B2：导入卡片统一打 importedAt 戳（双口径统计「新建 X · 导入 Y」的依据；合并进既有卡也重打——它确实在本次被导入）
  const importedNow = Date.now() // R166（实测 K5a）：mergeById 覆盖式合并且导入晚于载入 ⇒ 退役字段在下面三行各剥一次（真源 repository.RETIRED_CARD_KEYS）
  d.workspaces = mergeById(d.workspaces, imported.workspaces || [])
  d.categories = mergeById(d.categories, safeCats)
  d.resources = mergeById(d.resources, stripRetiredCardKeys<ResourceCard>(imported.resources).map(r => ({ ...r, importedAt: importedNow })))
  d.tasks = mergeById(d.tasks, stripRetiredCardKeys<TaskCard>(imported.tasks).map(t => ({ ...t, importedAt: importedNow })))
  d.curiosities = mergeById(d.curiosities, stripRetiredCardKeys<CuriosityCard>(imported.curiosities).map(c => ({ ...c, importedAt: importedNow })))
  /* P0-2（V3.8.41）★导入是**老库的主要入口**，必须走同一套字段归一化。
     漏它的后果具体到可复现：用户导入一份 V2.x 备份，那份里的好奇卡是
     `{title, desc, done}` 旧结构、资源卡只有 `url` 没有 `linkType`——
     合并进库后当场炸在 `STATUS_MAP[c.status].cls`（崩溃），
     而本地文件卡会静默走错打开通道（不崩，但双击打不开 ⇒ 更难查）。
     归一化幂等，只在缺失时补，所以先合并后归一化 == 先归一化后合并，本处选后者口径更简：
     在**合并之后**、返回之前对整棵 `d` 跑一次，同时顺带治好了「库里本来就有的残缺卡」。 */
  normalizeLegacyCards(d)
  const cardsAdded = (imported.resources?.length || 0) + (imported.tasks?.length || 0) + (imported.curiosities?.length || 0)

  // ---- 调度台：愿景/使命（内容取较新，关联取并集）----
  if (imported.compass) {
    const ic = imported.compass
    for (const key of ['vision', 'mission'] as const) {
      const inc = ic[key]
      if (!inc) continue
      const cur = d.compass[key]
      if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) {
        d.compass[key] = { ...inc, linkedResourceIds: union(cur?.linkedResourceIds, inc.linkedResourceIds), linkedCuriosityIds: union(cur?.linkedCuriosityIds, inc.linkedCuriosityIds) }
      } else {
        cur.linkedResourceIds = union(cur.linkedResourceIds, inc.linkedResourceIds)
        cur.linkedCuriosityIds = union(cur.linkedCuriosityIds, inc.linkedCuriosityIds)
      }
    }
    // ---- 方向 → 项目 → 指标 三层按 id 合并，指标 taskIds 取并集（保留任务↔指标关系）----
    for (const incDir of ic.directions || []) {
      const curDir = d.compass.directions.find(x => x.id === incDir.id)
      if (!curDir) { d.compass.directions.push(JSON.parse(JSON.stringify(incDir))); continue }
      curDir.name = incDir.name ?? curDir.name
      curDir.status = incDir.status ?? curDir.status
      curDir.term = incDir.term ?? curDir.term
      curDir.calibratedAt = incDir.calibratedAt ?? curDir.calibratedAt
      for (const incProj of incDir.projects || []) {
        const curProj = curDir.projects.find(x => x.id === incProj.id)
        if (!curProj) { curDir.projects.push(JSON.parse(JSON.stringify(incProj))); continue }
        Object.assign(curProj, incProj, { metrics: curProj.metrics })
        for (const incMet of incProj.metrics || []) {
          const curMet = curProj.metrics.find(x => x.id === incMet.id)
          if (!curMet) { curProj.metrics.push(JSON.parse(JSON.stringify(incMet))); continue }
          Object.assign(curMet, incMet, { taskIds: union(curMet.taskIds, incMet.taskIds) })
        }
      }
    }
  }

  // ---- 今日三件事：按日期合并，槽位按 id 去重 ----
  if (imported.dailyFocus) {
    for (const [date, slots] of Object.entries(imported.dailyFocus)) {
      const cur = d.dailyFocus[date]
      if (!cur) { d.dailyFocus[date] = slots; continue }
      const seen = new Set(cur.map(s => s.id))
      for (const s of slots) if (!seen.has(s.id)) cur.push(s)
    }
  }

  // ---- 统计：计数取最大，map 按键取较大时间/次数 ----
  if (imported.stats) {
    if (imported.stats.wrr && d.stats.wrr) {
      d.stats.wrr.totalCumulativeUsage = Math.max(d.stats.wrr.totalCumulativeUsage || 0, imported.stats.wrr.totalCumulativeUsage || 0)
      // R129-B10：本周档不再是裸取最大——先各自按周戳折算成「本周值」再取最大（老数据无戳按旧口径全留），
      // 合并结果统一归属到本周，避免导入上周/上月数据把本周 WRR 顶高。
      const wkNow = weekStartKey(dateKey(new Date()))
      const weekVal = (w?: { thisWeekUsage?: number; thisWeekStart?: string }) =>
        !w ? 0 : (!w.thisWeekStart || w.thisWeekStart === wkNow) ? (w.thisWeekUsage || 0) : 0
      d.stats.wrr.thisWeekUsage = Math.max(weekVal(d.stats.wrr), weekVal(imported.stats.wrr))
      d.stats.wrr.thisWeekStart = wkNow
      d.stats.wrr.lastUpdatedAt = Math.max(d.stats.wrr.lastUpdatedAt || 0, imported.stats.wrr.lastUpdatedAt || 0)
    }
    for (const key of ['lastReuse', 'lastVisits'] as const) {
      const inc = imported.stats[key]
      if (!inc) continue
      const cur = d.stats[key] as Record<string, number>
      for (const [k, v] of Object.entries(inc)) cur[k] = Math.max(cur[k] || 0, v)
    }
  }

  // ---- 行为日志：按 id 追加去重 ----
  // R58-B5：activityLogs 已退役（事件日志迁 zy_event_log），导入不再搬运死字段
  d.activityLogs = []

  // ---- R53-E1（P0 修复）：策展投射清单并入——此前导入合并遗漏此字段，备份→恢复会静默丢弃全部策展投射 ----
  if (imported.curationProjections?.length || d.curationProjections?.length) {
    d.curationProjections = mergeById(d.curationProjections || [], imported.curationProjections || [])
  }

  // ---- R63-2：Airtable 映射表并入（recordId 以导入方为准同 id 覆盖；不覆盖本地较新的 syncedAt） ----
  if (imported.airtableMap) {
    d.airtableMap = { ...(imported.airtableMap), ...(d.airtableMap || {}) }
  }

  // ---- 标签体系 / 字段配置（原有逻辑保留）----
  if (imported.tagTree?.length) {
    const existIds = new Set(d.tagTree.map(t => t.id))
    for (const root of imported.tagTree) if (!existIds.has(root.id)) d.tagTree.push(root)
  }
  if (imported.fieldConfig) {
    const cfg = d.fieldConfig
    // R62-3：thesis 组老数据可能缺失——先补默认再合并
    if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()
    for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const) {
      const importedGroup = imported.fieldConfig[key]
      const group = cfg[key]
      if (!importedGroup || !group) continue
      const existingKeys = new Set(group.map(f => f.key))
      for (const f of importedGroup) {
        if (!existingKeys.has(f.key)) group.push(f)
      }
    }
  }
  // R171-A1：覆盖式合并可能让同台多张 isThesis 并存，导入即归一（口径=保留首张）
  const thesisFix = sanitizeThesisDuplicates(d)
  store.persist()
  return { cards: cardsAdded, dirs: imported.compass?.directions?.length || 0, ws: d.workspaces.length - wsBefore + (imported.workspaces?.length || 0), catFix, thesisClear: thesisFix.cleared }
}

/** R154（E3）：书签导入完攒下的卡 id——等用户点「归类并补全这批」才起评审，不再自动弹 */
const pendingImportEnrich = ref<string[] | null>(null)
function aiImportEnrichNow() {
  const ids = pendingImportEnrich.value
  if (!ids || !ids.length) return
  pendingImportEnrich.value = null
  aiEnrichIds(new Set(ids))
}
</script>

<template>
<div class="gs-panel">
<div class="gs-page-header">
  <div class="gs-page-title"><Icon name="download" :size="13"/> 导入数据</div>
  <div class="gs-page-desc">从外部导入资源卡或策展台数据，导入时与现有数据取并集</div>
</div>
<div class="gs-card">
  <div class="gs-card-header"><span class="gs-card-title">导入方式</span></div>
  <div class="gs-card-body">
    <div class="gs-import-option" @click="triggerFileImport">
      <div class="gs-io-icon"><Icon name="package" :size="13"/></div>
      <div><div class="gs-io-name">导入知源调度台数据</div><div class="gs-io-desc">选择 JSON 文件，与现有数据取并集（同 ID 更新，不同 ID 新增）；全量包附带界面偏好（主题/密度）时自动应用。<b>导入前会先自动下载一份当前数据备份</b>（防误合并，不含 Airtable 凭证）</div></div>
      <button class="gs-btn gs-btn-primary gs-io-btn">选择文件</button>
    </div>
    <div class="gs-import-option" @click="assetPackInput?.click()">
      <div class="gs-io-icon"><Icon name="folder" :size="13"/></div>
      <div><div class="gs-io-name">导入附件包</div><div class="gs-io-desc">选择「导出附件包」生成的 zip，附件本体按 assetId 写回（同 ID 覆盖）；先导 JSON 再导附件包 = 完整迁移</div></div>
      <button class="gs-btn gs-io-btn">选择文件</button>
    </div>
    <div class="gs-import-option" @click="bookmarkImport()">
      <div class="gs-io-icon"><Icon name="bookmark" :size="13"/></div>
      <div><div class="gs-io-name">导入书签文件</div><div class="gs-io-desc">选择浏览器导出的书签 HTML：<b>本页只把文件夹层级写成标签</b>，链接 + 标题进资源卡；文件夹›分类的建树导入已随资源台退役。</div></div>
      <button class="gs-btn gs-io-btn">选择文件</button>
    </div>
    <!-- R154（E3）：导入完不再自动弹评审抽屉——它抢焦点、也没人点过它。改成回执上的显式入口 -->
    <div v-if="pendingImportEnrich && pendingImportEnrich.length" class="gs-setting-row gs-setting-row--gap">
      <span class="gs-sr-label">刚导入 {{ pendingImportEnrich.length }} 张卡</span>
      <div class="gs-sr-control">
        <button class="gs-btn" :disabled="!aiReady" @click="aiImportEnrichNow">{{ aiReady ? '归类并补全这批' : '先在 AI 助手完成接入' }}</button>
        <button class="gs-btn" @click="pendingImportEnrich = null">这次不用</button>
      </div>
    </div>
    <div class="gs-setting-row gs-setting-row--gap">
      <span class="gs-sr-label">书签导入到</span>
      <div class="gs-sr-control">
        <select class="gs-select" v-model="bookmarkTargetWs">
          <option value="__new__">新建「书签导入 &lt;今天日期&gt;」策展台</option>
          <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
        </select>
      </div>
    </div>
  </div>
</div>
<input ref="fileInput" type="file" accept=".json" class="gs-file-hidden" @change="handleFileImport" />
<input ref="assetPackInput" type="file" accept=".zip" class="gs-file-hidden" @change="emit('asset-pack', $event)" />
<input ref="bookmarkInput" type="file" accept=".html,.htm" class="gs-file-hidden" @change="onBookmarkFile" />
</div>
</template>

<style src="./base.css"></style>

<style scoped>
/* 以下规则由 move-import-subdomain.cjs 从宿主样式段逐行切出，未重打一字 */
.gs-import-option { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 10px; cursor: pointer; transition: all var(--dur); background: var(--surface); }
.gs-import-option:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-io-icon { font-size: var(--fs-display); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: 8px; flex-shrink: 0; }
.gs-io-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-io-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }
.gs-io-btn { margin-left: auto; flex-shrink: 0; white-space: nowrap; align-self: center; }

/* .gs-file-hidden 由 base.css 提供（共享基类，第三批外提），此处不重复定义 */
</style>
