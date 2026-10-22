<script setup lang="ts">
/** 策展成果分享：选项、真实 HTML 预览和本地下载同源。 */
import { computed, reactive } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import { downloadText, stampDay } from '@/shared/utils/download'
import { buildCurationShareHtml, type CurationShareOptions } from '@/shared/utils/curationShare'
import type { Category, ResourceCard } from '@/shared/models'

const props = defineProps<{
  open: boolean
  workspaceName: string
  thesis: ResourceCard | null
  nodes: Category[]
  cards: ResourceCard[]
}>()

const emit = defineEmits<{ close: [] }>()

const options = reactive<CurationShareOptions>({
  format: 'reading',
  links: true,
  attachments: true,
  sources: true,
  date: true,
  theme: 'paper',
})

const roots = computed(() => props.nodes.filter(n => !n.parentId).length)
const attachmentCount = computed(() => props.cards.reduce((n, c) => n + (c.assets?.length || 0), 0))
const html = computed(() => buildCurationShareHtml({
  workspaceName: props.workspaceName,
  thesis: props.thesis,
  nodes: props.nodes,
  cards: props.cards,
  options: { ...options },
}))
const filename = computed(() => {
  const title = (props.thesis?.title || props.workspaceName || '策展成果').replace(/[\\/:*?"<>|]/g, '_').slice(0, 48)
  return `${title}_策展分享_${stampDay()}.html`
})

function download(): void {
  downloadText(filename.value, html.value, 'html')
}
</script>

<template>
  <Drawer :open="open" width="640px" @close="emit('close')">
    <template #title><Icon name="share" :size="15"/> 分享这份策展</template>
    <div class="cs-kicker">自包含单文件 HTML · 接收方无需安装知源 · 不托管、不统计访问</div>
    <div class="cs-section">
      <div class="cs-label">分享版式</div>
      <div class="cs-format-grid">
        <button type="button" class="cs-format" :class="{ on: options.format === 'reading' }" @click="options.format = 'reading'">
          <Icon name="book" :size="18"/>
          <span><b>阅读长文</b><small>先结论，后证据，适合客户 / 同事阅读与打印。</small></span>
        </button>
        <button type="button" class="cs-format" :class="{ on: options.format === 'tree' }" @click="options.format = 'tree'">
          <Icon name="tree" :size="18"/>
          <span><b>论证树</b><small>横向展开节点与资源，适合演示和结构讨论。</small></span>
        </button>
      </div>
    </div>
    <div class="cs-section">
      <div class="cs-label">分享内容</div>
      <label class="cs-toggle"><input v-model="options.links" type="checkbox"><span><b>资源原文链接</b><small>只输出 http(s) 链接，不输出本地路径。</small></span></label>
      <label class="cs-toggle"><input v-model="options.attachments" type="checkbox"><span><b>附件清单</b><small>只输出名称、类型和大小。</small></span></label>
      <label class="cs-toggle"><input v-model="options.sources" type="checkbox"><span><b>来源徽标</b><small>官方 / 学术 / 媒体 / 个人成果。</small></span></label>
      <label class="cs-toggle"><input v-model="options.date" type="checkbox"><span><b>生成日期</b><small>页脚保留版本与日期，便于追溯。</small></span></label>
    </div>
    <div class="cs-section">
      <div class="cs-label">阅读主题</div>
      <div class="cs-themes">
        <button type="button" :class="{ on: options.theme === 'paper' }" @click="options.theme = 'paper'"><i class="paper"></i>纸白阅读版</button>
        <button type="button" :class="{ on: options.theme === 'ink' }" @click="options.theme = 'ink'"><i class="ink"></i>墨黑演示版</button>
      </div>
    </div>
    <div class="cs-summary">
      将导出 <b>{{ options.format === 'reading' ? '阅读长文' : '论证树' }}</b> · {{ cards.length }} 张资源卡 · {{ roots }} 个一级节点 · {{ attachmentCount }} 个附件 · {{ options.links ? '资源链接可点击' : '不含资源链接' }}
    </div>
    <div class="cs-section">
      <div class="cs-label">真实效果预览</div>
      <iframe class="cs-preview" title="分享 HTML 预览" sandbox="allow-popups allow-popups-to-escape-sandbox" :srcdoc="html"></iframe>
    </div>
    <template #footer>
      <button type="button" class="cs-btn" @click="emit('close')">取消</button>
      <button type="button" class="cs-btn primary" @click="download"><Icon name="download" :size="13"/> 下载 HTML</button>
    </template>
  </Drawer>
</template>

<style scoped>
.cs-kicker { margin-bottom: 14px; padding: 8px 10px; border-radius: 8px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-caption); line-height: 1.55; }
.cs-section { margin-top: 16px; }
.cs-label { margin-bottom: 8px; font-size: var(--fs-caption); font-weight: 700; color: var(--text-2); }
.cs-format-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cs-format { min-height: 88px; display: flex; align-items: flex-start; gap: 9px; padding: 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-2); text-align: left; cursor: pointer; font: inherit; transition: all var(--dur); }
.cs-format:hover { border-color: var(--accent); }
.cs-format.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.cs-format span { display: flex; flex-direction: column; gap: 4px; }
.cs-format b { font-size: var(--fs-sub); }
.cs-format small { color: var(--text-3); font-size: var(--fs-tiny); line-height: 1.5; }
.cs-toggle { min-height: 44px; display: flex; align-items: flex-start; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
.cs-toggle:last-child { border-bottom: none; }
.cs-toggle input { margin-top: 4px; accent-color: var(--accent); }
.cs-toggle span { display: flex; flex-direction: column; gap: 2px; }
.cs-toggle b { color: var(--text-2); font-size: var(--fs-sub); font-weight: 600; }
.cs-toggle small { color: var(--text-3); font-size: var(--fs-tiny); line-height: 1.5; }
.cs-themes { display: flex; gap: 8px; }
.cs-themes button { flex: 1; min-height: 36px; display: flex; align-items: center; gap: 7px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: var(--fs-caption); }
.cs-themes button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.cs-themes i { width: 18px; height: 18px; border: 1px solid var(--border-strong); border-radius: 5px; }
.cs-themes i.paper { background: #fffdf8; }
.cs-themes i.ink { background: #202126; }
.cs-summary { margin-top: 16px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }
.cs-summary b { color: var(--text-2); }
.cs-preview { width: 100%; height: 360px; border: 1px solid var(--border); border-radius: 9px; background: #f7f4ed; }
.cs-btn { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: var(--fs-sub); }
.cs-btn:hover { border-color: var(--accent); color: var(--accent); }
.cs-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.cs-btn.primary:hover { background: var(--accent-hover); color: #fff; }
@media (max-width: 640px) { .cs-format-grid { grid-template-columns: 1fr; } .cs-preview { height: 300px; } }
</style>
