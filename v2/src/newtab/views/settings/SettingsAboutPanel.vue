<!--
  V3.8.42 · P0-3 第二批 · 「关于」子域（自 GlobalSettings.vue 原样搬出）

  ★本子域是本批里边界最需要讲清的一个：**生命周期留宿主，展示搬进来**。
  `refreshStorage()` 与 `subscribeSaveError(...)` 在宿主的 `onMounted` 里调用并返回取消订阅函数
  （REQ-038 备案，且宿主实例可能被路由复用）——若把订阅一并搬进来，
  子组件在 `v-if` 切页时会被销毁重建 ⇒ 订阅反复退订重订，且卸载钩子归属改变。
  ⇒ 存储态（`bytesInUse` / `unlimitedStorage` / `saveError`）及其订阅**一律留宿主**，
  子组件只接收 props 并把「已处理」这个动作以事件抛回宿主。

  ★这也解释了为什么 `logoUrl` / `formatBytes` / `saveErrorLabel` 这三个"看起来纯展示"的符号
  在本子域里被重复实现：它们在宿主仍被 export 子域使用（`formatBytes`），
  搬一份进子组件会造成同一规则两处定义。本子域内用的是**逐字等价的私有副本**，
  等 export 子域也搬走时，两份可以合并回一处 —— 记在这里，别让它变成"两份都得改"的隐患。
-->
<template>
  <div class="gs-panel">
    <div class="gs-page-header"><div class="gs-page-title"><Icon name="question" :size="13"/> 关于</div></div>
    <div class="gs-card">
      <div class="gs-card-body gs-about-card">
        <div class="gs-about-logo"><img :src="logoUrl" alt="知源调度台" /></div>
        <div class="gs-about-name">知源调度台</div>
        <div class="gs-about-version">版本 V{{ runtimeVersion }}</div>
        <div class="gs-about-motto">万千可调用，自有我方向。</div>
      </div>
    </div>
    <div class="gs-card">
      <div class="gs-card-body">
        <div class="gs-about-row">
          <span class="label">数据存储</span>
          <span class="value">
            全部在本地，不上传云端
            <span v-if="bytesInUse > 0" class="gs-storage-detail">
              · 当前占 {{ formatBytes(bytesInUse) }}
              <template v-if="!unlimitedStorage"> / 配额上限 10 MB</template>
              <template v-else>（已申请 unlimitedStorage，无 10 MB 上限）</template>
            </span>
          </span>
        </div>
        <div v-if="saveError" class="gs-about-row gs-about-row-danger">
          <span class="label"><Icon name="warn" :size="13"/> 写入异常</span>
          <span class="value">
            <span class="gs-save-error-kind">{{ saveErrorLabel(saveError.kind) }}</span>
            · {{ saveError.message }}
            <span v-if="saveError.bytesInUse != null">（当前 {{ formatBytes(saveError.bytesInUse) }}）</span>
            <span class="gs-link gs-link--spaced" @click="$emit('dismiss-save-error')">已处理 ›</span>
          </span>
        </div>
        <div class="gs-about-row"><span class="label">检查更新</span><span class="value gs-link" @click="$emit('toast', '当前已是最新版本')">检查更新 ›</span></div>
        <div class="gs-about-row"><span class="label">开源致谢</span><span class="value gs-link" @click="$emit('toast', 'Vue 3 · TypeScript · Vite · Pinia · @crxjs')">查看 ›</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'

/** 存储态由宿主持有（见文件头：订阅与 onMounted 生命周期留宿主），这里只接收快照 */
defineProps<{
  logoUrl: string
  runtimeVersion: string
  bytesInUse: number
  unlimitedStorage: boolean
  saveError: { kind: 'quota' | 'serial' | 'unknown'; message: string; bytesInUse?: number } | null
}>()
const emit = defineEmits<{
  (e: 'dismiss-save-error'): void
  (e: 'toast', msg: string): void
}>()

/* ★`formatBytes` / `saveErrorLabel` 是宿主的逐字等价副本（宿主那份还被 export 子域用着）。
   函数体一字未改——改一个阈值就会让「数据存储」与「写入异常」两处读数不一致。 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
function saveErrorLabel(k: 'quota' | 'serial' | 'unknown'): string {
  return k === 'quota' ? '配额超限' : k === 'serial' ? '序列化失败' : '写入异常'
}
</script>

<style scoped>
/* ★本段两截共 19 行**逐字程序化搬移**自宿主（不在同一处连续）：
   ① 4 行在 REQ-038 开关段尾（`.gs-storage-detail` 起）；② 15 行在宿主「关于」段首行注释之下。
   ★为什么强调"程序化搬移"：第一版手抄时 `.gs-about-row` 写成了 `align-items:flex-start; gap:20px; padding:11px 0`，
   真值是 `justify-content:space-between; padding:8px 0`（无 align-items/gap）；
   `.gs-about-name` 写成了 `var(--fs-title)`，真值是字面 `16px`；`.gs-about-motto` 漏了 `font-style:italic`。
   ⇒ 本轮已连续两次凭印象写错 CSS（manual 的 `.gs-manual-open` 是第二次），
   **纪律补一条：搬样式一律脚本切原文，人手只负责核对边界，不负责重打内容。** */
.gs-storage-detail { color: var(--text-3); font-size: var(--fs-caption); }
.gs-about-row-danger { color: var(--danger); }
.gs-about-row-danger .label { color: var(--danger); }
.gs-save-error-kind { display: inline-block; padding: 1px 6px; background: rgba(196,68,68,.12); color: var(--danger); border-radius: 4px; font-weight: 500; font-size: var(--fs-caption); margin-right: 4px; }

/* 关于 */
.gs-about-card { text-align: center; padding: 28px 20px; }
.gs-about-logo { width: 64px; height: 64px; border-radius: 16px; overflow: hidden; margin: 0 auto 14px; box-shadow: var(--shadow); }
.gs-about-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gs-about-name { font-size: 16px; font-weight: 700; color: var(--text); }
.gs-about-version { font-size: var(--fs-body); color: var(--text-2); margin-bottom: 4px; }
.gs-about-motto { font-size: var(--fs-sub); color: var(--text-3); font-style: italic; margin-bottom: 0; }
.gs-about-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.gs-about-row:last-child { border-bottom: none; }
.gs-about-row .label { color: var(--text-3); }
.gs-about-row .value { color: var(--text-2); }
.gs-about-row .value.gs-link { color: var(--accent); cursor: pointer; }
.gs-about-row .value.gs-link:hover { text-decoration: underline; }
/* ★V3.8.25（B1-a）：保存异常行里"已处理 ›"需要与前面的字节数拉开 8px（原先写内联 margin-left） */
.gs-about-row .value .gs-link--spaced { margin-left: 8px; }
</style>
