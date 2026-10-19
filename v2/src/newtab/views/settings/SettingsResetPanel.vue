<template>
  <div class="gs-panel">
  <div class="gs-page-header">
      <div class="gs-page-title"><Icon name="refresh" :size="13"/> 重置与回滚</div>
      <div class="gs-page-desc">危险操作，请谨慎执行，建议操作前先导出备份</div>
    </div>
    <div class="gs-card gs-danger-zone">
      <div class="gs-card-header"><span class="gs-card-title"><Icon name="warn" :size="12"/> 危险操作区</span></div>
      <div class="gs-card-body">
        <div class="gs-danger-action">
          <div class="gs-da-info"><div class="gs-da-name">一键回滚至初始状态</div><div class="gs-da-desc">清空所有用户创建的策展台和所有资源卡、好奇心卡、任务卡，仅保留调度台、方向台（任务中心）和默认策展台</div></div>
          <button class="gs-btn gs-btn-danger" @click="showResetModal = true">回滚</button>
        </div>
        <div class="gs-danger-action">
          <div class="gs-da-info"><div class="gs-da-name">回收站</div><div class="gs-da-desc">浏览 / 恢复已删除的卡片，或永久删除</div></div>
          <button class="gs-btn" @click="router.push('/recycle')">进入</button>
        </div>
        <div class="gs-danger-action">
          <div class="gs-da-info"><div class="gs-da-name">清空回收站</div><div class="gs-da-desc">永久删除所有已移入回收站的卡片，不可恢复</div></div>
          <button class="gs-btn gs-btn-danger" @click="emptyRecycleBin">清空</button>
        </div>
        <div class="gs-danger-action">
          <div class="gs-da-info"><div class="gs-da-name">清除缓存</div><div class="gs-da-desc">清除 AI 抓过的网页正文与会话抽读缓存（内存态）；卡片数据与附件本体不动</div></div>
          <button class="gs-btn" @click="clearCache">清除</button>
        </div>
      </div>
    </div>
  </div>

    <!-- 回滚确认弹窗 -->
    <Teleport to="body">
<div class="gs-modal-overlay" :class="{ open: showResetModal }" @click.self="closeResetModal">
  <div class="gs-modal">
    <div class="gs-modal-header"><Icon name="warn" :size="13"/> 确认回滚至初始状态</div>
    <div class="gs-modal-body">
      <p>此操作将清空所有用户创建的策展台和所有资源卡、好奇心卡、任务卡，<b class="gs-danger-text">仅保留调度台、方向台（任务中心）和默认策展台</b>。</p>
      <p>此操作<b class="gs-danger-text">不可恢复</b>，建议先导出数据备份。</p>
      <p>请输入 <b>"回滚"</b> 以确认：</p>
      <input v-model="resetConfirmText" type="text" class="gs-confirm-input" placeholder="请输入 回滚" />
    </div>
    <div class="gs-modal-footer">
      <button class="gs-btn" @click="closeResetModal">取消</button>
      <button class="gs-btn gs-btn-danger" :disabled="resetConfirmText !== '回滚'" :style="{ opacity: resetConfirmText === '回滚' ? 1 : 0.5, cursor: resetConfirmText === '回滚' ? 'pointer' : 'not-allowed' }" @click="doReset">确认回滚</button>
    </div>
  </div>
</div>
    </Teleport>
</template>

<script setup lang="ts">
/* V3.8.42 · P0-3 第三批：从 GlobalSettings.vue 原样搬出的「重置与回滚」子域。
   ★随迁的东西：回滚确认弹窗（Teleport 到 body）——它由本子域的状态驱动，
     留在宿主就得把 showResetModal 也留在宿主，两个文件互相拿对方的 ref，是拆分的失败形态。
   ★留在宿主的：store / router / useConfirm / clearHot / purge 等外部依赖一律**在本组件内直接引入**，
     因为它们都不是宿主私有状态（对比 about 子域：那批留宿主的是「订阅与生命周期」，性质不同）。
   ★样式两段一并搬进本组件的 scoped（危险区 9 行 + 弹窗 13 行），
     基类（.gs-card/.gs-btn/.gs-setting-row…）由共享的 settings/base.css 提供。
     ⚠ 不要再把基类抄一份进本组件——那份真源在 base.css，抄了就是两份都得改。 */
import Icon from '@/shared/components/Icon.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { createDefaultData } from '@/shared/storage/defaults'
import { clearHot } from '@/shared/storage/hotStats'
import { purgeCardsCompletely, recycledCardsOf } from '@/shared/storage/purge'
import { clearLinkCache } from '@/shared/ai/linkFetch'
import { reviseSnips } from '@/shared/ai/govern'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'

const router = useRouter()
const store = useAppStore()

// ---- 重置 ----
const showResetModal = ref(false)
const resetConfirmText = ref('')
function closeResetModal() {
  showResetModal.value = false
  resetConfirmText.value = ''
}
function doReset() {
  if (resetConfirmText.value !== '回滚') return
  const fresh = createDefaultData()
  store.data!.compass = fresh.compass
  store.data!.workspaces = fresh.workspaces
  store.data!.categories = fresh.categories
  store.data!.resources = []
  store.data!.tasks = []
  store.data!.curiosities = []
  store.data!.dailyFocus = {}
  store.data!.fieldConfig = fresh.fieldConfig
  store.data!.tagTree = fresh.tagTree
  store.data!.stats = fresh.stats
  store.data!.activityLogs = []
  store.persist()
  clearHot() // R148-P0b：热度拆键后，回滚必须连热度键一起清，否则旧 stats 下次启动会覆盖回来
  closeResetModal()
  showToast('已回滚至初始状态')
  setTimeout(() => router.push('/compass'), 800)
}
/** R128-A3：与回收站页共用同一硬删引擎（此前这里只 filter 数组——附件 Blob 全量泄漏成孤儿、
 *  任务卡脱离 metric.taskIds、指向已删卡的镜像投射记录悬空）
 *  R146（回退契约）：加确认闸——同页「一键回滚」要打字确认，而这个更常用的清空却单击即物理删除，
 *  两个相邻按钮给出相反的风险信号。 */
async function emptyRecycleBin() {
  const d = store.data!
  const targets = recycledCardsOf(d)
  const n = targets.resources.length + targets.tasks.length + targets.curiosities.length + targets.categories.length
  if (!n) { showToast('回收站已是空的'); return }
  if (!(await useConfirm({ title: '清空回收站', message: `确定永久删除回收站里全部 ${n} 项？\n不可恢复，且仅被这些卡引用的附件本体会一并清除。`, confirmText: `永久删除 ${n} 项` }))) return
  const r = await purgeCardsCompletely(d, targets)
  store.persist()
  const parts = [`回收站已清空，永久删除 ${r.cards} 项`]
  if (r.assetsPurged) parts.push(`清理 ${r.assetsPurged} 个附件本体`)
  if (r.assetsShared) parts.push(`${r.assetsShared} 个共享附件保留`)
  showToast(parts.join('· ') + (r.assetsFailed ? `  ${r.assetsFailed} 个附件删除失败（可清理孤儿）` : ''))
}
/** R146：这行按钮原先是**假回执**（函数体只有一句 showToast('✓ 缓存已清除')，什么都没做）——
 *  它会污染用户对其它 ✓ 的信任。现在真做事：清 AI 抓过的网页正文会话缓存与整体梳理抽读缓存
 *  （都是内存态，关掉页面本来也没了；此处提供"立刻重来一遍"的手动闸）。
 *  孤儿附件本体不在此列——它在「数据管理」里有专属按钮（cleanupOrphanAssetsAction）。 */
function clearCache() {
  const links = clearLinkCache()
  const snips = reviseSnips.size
  reviseSnips.clear()
  showToast(links || snips ? `缓存已清：${links} 篇网页正文 · ${snips} 篇梳理抽读正文（卡片数据未动）` : '没有需要清理的缓存（AI 会话正文是空的）')
}
</script>

<!-- 基类：.gs-card / .gs-btn / .gs-setting-row 等跨子域共享（V3.8.42 外提为全局表） -->
<style src="./base.css"></style>

<style scoped>
/* 危险区 */
.gs-danger-zone { border-color: rgba(196,68,68,.2); }
.gs-danger-zone .gs-card-header { border-bottom-color: rgba(196,68,68,.15); }
.gs-danger-zone .gs-card-title { color: var(--danger); }
.gs-danger-action { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-danger-action:last-child { border-bottom: none; }
.gs-da-info { flex: 1; }
.gs-da-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-da-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }
/* 回滚确认弹窗里的高危强调（原先两处写内联 color:var(--danger)） */
.gs-danger-text { color: var(--danger); }

/* 弹窗 */
.gs-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: var(--z-modal); display: none; align-items: center; justify-content: center; }
.gs-modal-overlay.open { display: flex; }
.gs-modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 420px; max-width: 90vw; overflow: hidden; }
.gs-modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text); }
.gs-modal-body { padding: 18px 20px; }
.gs-modal-body p { font-size: var(--fs-body); color: var(--text-2); line-height: 1.6; margin-bottom: 12px; }
.gs-confirm-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: var(--fs-sub); outline: none; font-family: inherit; margin-top: 8px; background: var(--surface); color: var(--text); }
.gs-confirm-input:focus { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(196,68,68,.15); }
.gs-modal-footer { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }
</style>
