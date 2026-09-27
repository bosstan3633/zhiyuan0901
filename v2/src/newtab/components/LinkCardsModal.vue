<script setup lang="ts">
/**
 * R161-④：策展台「关联资源卡到某节点（镜像）」弹窗 —— 从 `Workspace.vue` 抽出。
 *
 * 为什么抽（两个理由，缺一不可）：
 *  ① **宿主 ≤1500 行验收线**（04-59 立的 R115-1）：R161-④ 往这个弹窗里加了 AI 检索入口
 *     （按钮 + 投料回执 + 行内命中标签），47 行内联模板会把宿主顶到 1515 行。
 *  ② **私有多一份 modal 实现少一份**：壳换成 R161 新建的 `Modal.vue`（中央弹窗），
 *     不再用 workspace.css 里的 `.modal-overlay` / `.modal` 那套（那套仍服务于其余 10 个弹窗，
 *     但不能跨 `scoped` 边界给子组件用 —— 这也是本组件必须自带样式的原因）。
 *
 * 职责边界（重要）：**零自有状态**。所有状态（候选池 / 勾选 / AI 命中 / 忙态）都由
 * `usePyramid.ts` 持有，本组件只做渲染 + 事件回抛。所以它不会成为第二份真相源。
 *
 * 数据纪律（与全局检索面板同一条）：AI 只读、零写库；`aiHits` 命中的行打标签，
 * 模型说"低置信"就打弱档标签 —— 让用户自己核，不让模型替他决定。
 */
import Modal from '@/shared/components/Modal.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import type { ResourceCard } from '@/shared/models'

defineProps<{
  open: boolean
  catName: string
  /** 已勾选（镜像目标）的卡的 id；`linkCardsModal.picked` */
  picked?: Set<string>
  q: string
  cat: string
  catOptions: { id: string; label: string }[]
  /** 可见列表：字面命中 + AI 语义命中合并后的次序（`usePyramid#linkShowList`） */
  list: { r: ResourceCard; mirrored: boolean }[]
  aiBusy: boolean
  aiOn: boolean
  aiHits: Record<string, { why: string; weak: boolean }>
  aiFed: { scanned: number; total: number }
  aiTook: number
  aiScope: string
  aiNote: string
}>()

const emit = defineEmits<{
  close: []
  'update:q': [v: string]
  'update:cat': [v: string]
  'toggle-pick': [id: string]
  confirm: []
  'ai-run': []
}>()
</script>

<template>
  <Modal :open="open" :title="'关联资源卡到「' + catName + '」'" width="520px" @close="emit('close')">
    <div class="lc-search">
      <span>🔍</span>
      <input :value="q" placeholder="关键词过滤（或写一句需求，再点右侧 AI 检索）"
        @input="emit('update:q', ($event.target as HTMLInputElement).value)" />
      <button type="button" class="lc-ai-btn" :class="{ busy: aiBusy, on: aiOn }"
        :title="aiBusy ? '点击取消本次 AI 检索（不写任何数据）' : 'AI 读懂你这句话，从资源台可镜像的卡里按相关度挑一批顶到最前（只读不改数据；再点=清除）'"
        @click="emit('ai-run')">
        <AiEntryButton variant="inline" :spin="aiBusy" :label="aiBusy ? '检索中…' : 'AI 检索'" />
      </button>
    </div>
    <!-- R126（诉求 3）：资源台分类过滤（含子分类） -->
    <div class="lc-cat-row">
      <select :value="cat" class="lc-cat" @change="emit('update:cat', ($event.target as HTMLSelectElement).value)">
        <option value="">全部分类（资源台）</option>
        <option v-for="o in catOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
        <option value="__uncat__">未分类</option>
      </select>
    </div>
    <!-- R161-④：投料口径与收窄范围（与检索面板同一条「说实话」纪律：投了多少张、收窄到哪个范围都要看得见） -->
    <div v-if="aiOn || aiBusy" class="lc-ai-fed">
      <span v-if="aiBusy">🤖 检索中…</span>
      <span v-else>🤖 挑出 {{ Object.keys(aiHits).length }} 条 · 投料 {{ aiFed.scanned }}/{{ aiFed.total }} 张 · {{ aiTook }}ms</span>
      <span v-if="aiScope" class="lc-ai-scope">🎯 范围 {{ aiScope }}</span>
      <span v-if="aiNote" class="lc-ai-note">「{{ aiNote }}」</span>
    </div>
    <div class="lc-list">
      <label v-for="c in list" :key="c.r.id" class="lc-item" :class="{ picked: picked?.has(c.r.id), mirrored: c.mirrored }">
        <input v-if="!c.mirrored" type="checkbox" :checked="picked?.has(c.r.id)" @change="emit('toggle-pick', c.r.id)" />
        <span v-else class="lc-badge">已在该台</span>
        <span class="lc-title">{{ c.r.pinned ? '📌 ' : '' }}{{ c.r.title }}</span>
        <span class="lc-link">{{ c.r.link }}</span>
        <!-- R161-④：命中信息挂在行上（同一张卡只出现一行，与检索面板同一条纪律） -->
        <span v-if="aiHits[c.r.id]" class="lc-ai-tag" :class="{ weak: aiHits[c.r.id].weak }"
          :title="(aiHits[c.r.id].weak ? '模型给的分低或没给理由——它在猜，自己核一眼再用' : 'AI 从可镜像的卡里点名了这张') + (aiHits[c.r.id].why ? '：' + aiHits[c.r.id].why : '')">{{ aiHits[c.r.id].weak ? '🤖 低置信' : '🤖 命中' }}</span>
      </label>
      <div v-if="!list.length" class="lc-empty">无匹配的资源台资源卡（也可以直接点右侧 AI 检索，按语义找）</div>
    </div>
    <template #footer>
      <div class="lc-foot">
        <button class="lc-btn" @click="emit('close')">取消</button>
        <button class="lc-btn primary" @click="emit('confirm')">📡 镜像所选到该节点</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
/* 以下 .lc-* 由 workspace.css 迁入（原为 Workspace.vue 的 scoped 样式，跨不到本组件） */
.lc-search { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); margin-bottom: 10px; }
.lc-search input { border: none; outline: none; background: transparent; font-size: var(--fs-sub); flex: 1; color: var(--text); }
.lc-cat-row { margin-bottom: 10px; }
.lc-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.lc-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.lc-item:hover { background: var(--surface-2); }
.lc-item.picked { background: var(--accent-light); }
.lc-item.mirrored { opacity: .55; cursor: default; }
.lc-badge { font-size: var(--fs-tiny); color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; flex-shrink: 0; }
.lc-title { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-link { font-size: var(--fs-tiny); color: var(--text-4); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
.lc-empty { text-align: center; padding: 24px; font-size: var(--fs-sub); color: var(--text-4); }
/* ===== R161-④：AI 检索 ===== */
.lc-ai-btn { flex-shrink: 0; display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-xs);
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2);
  font-size: var(--fs-caption); font-family: inherit; cursor: pointer; transition: all var(--dur); }
.lc-ai-btn:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-3); }
.lc-ai-btn.on { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.lc-ai-btn.busy { opacity: var(--opacity-disabled); }
.lc-ai-fed { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin: -2px 0 8px;
  padding: 5px 9px; border-radius: var(--radius-xs); background: var(--surface-2); border: 1px solid var(--border);
  font-size: var(--fs-caption); color: var(--text-4); }
.lc-ai-scope { color: var(--text-3); }
.lc-ai-note { color: var(--text-3); }
.lc-ai-tag { flex-shrink: 0; font-size: var(--fs-tiny); padding: 1px 6px; border-radius: var(--radius-xs);
  background: var(--accent-light); color: var(--accent-ink); font-weight: 600; white-space: nowrap; }
.lc-ai-tag.weak { background: var(--warning-bg-soft); color: var(--warning); }
/* 底栏：Modal 壳的 footer 插槽是纵向容器，这里自己排成一行（与原 .dr-footer-btn 视觉一致） */
.lc-foot { display: flex; gap: var(--sp-2); }
.lc-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px;
  border-radius: 8px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-2); transition: all var(--dur); font-family: inherit; }
.lc-btn:hover { border-color: var(--accent); color: var(--accent); }
.lc-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.lc-btn.primary:hover { background: var(--accent-hover); }
</style>
