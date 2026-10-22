<script setup lang="ts">
/** 策展成果分享：阅读长文 / 论证树 / 高清长图共用同一份成果数据。 */
import { computed, reactive, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import { downloadBlob, downloadText, stampDay } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'
import { buildCurationShareHtml, type CurationShareOptions } from '@/shared/utils/curationShare'
import { renderCurationImage } from '@/shared/utils/curationImage'
import { buildCurationRenderTree } from '@/shared/utils/curationShareData'
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

const renderTree = computed(() => buildCurationRenderTree({
  nodes: props.nodes,
  cards: props.cards,
  thesis: props.thesis,
}))
const roots = computed(() => renderTree.value.roots.length)
const attachmentCount = computed(() => renderTree.value.attachmentCount)
const imageDataUrl = ref('')
const imageBusy = ref(false)
let imageSeq = 0

const previewFlatNodes = computed(() => renderTree.value.flat)

const previewTitle = computed(() => props.thesis?.title || `${props.workspaceName} · 策展成果`)
const previewDescription = computed(() => props.thesis?.description || '这份策展成果尚未补充中心论点说明。')

const html = computed(() => buildCurationShareHtml({
  workspaceName: props.workspaceName,
  thesis: props.thesis,
  nodes: props.nodes,
  cards: props.cards,
  options: { ...options },
  imageDataUrl: imageDataUrl.value || undefined,
}))
const filename = computed(() => {
  const title = (props.thesis?.title || props.workspaceName || '策展成果').replace(/[\\/:*?"<>|]/g, '_').slice(0, 48)
  return `${title}_策展分享_${stampDay()}.html`
})
const imageFilename = computed(() => {
  const title = (props.thesis?.title || props.workspaceName || '策展成果').replace(/[\\/:*?"<>|]/g, '_').slice(0, 48)
  return `${title}_高清长图_${stampDay()}.png`
})

function download(): void {
  downloadText(filename.value, html.value, 'html')
}

async function buildImage(): Promise<string> {
  if (!props.open) return ''
  const seq = ++imageSeq
  imageBusy.value = true
  try {
    const out = await renderCurationImage({
      workspaceName: props.workspaceName,
      thesis: props.thesis,
      nodes: props.nodes,
      cards: props.cards,
      layout: options.format === 'tree' ? 'tree' : 'pyramid',
      theme: options.theme,
    })
    if (seq === imageSeq && props.open) imageDataUrl.value = out.dataUrl
    return out.dataUrl
  } catch (error) {
    if (seq === imageSeq) showToast('长图生成失败：' + ((error as Error).message || '未知错误'))
    return ''
  } finally {
    if (seq === imageSeq) imageBusy.value = false
  }
}

async function downloadImage(): Promise<void> {
  imageBusy.value = true
  try {
    const out = await renderCurationImage({
      workspaceName: props.workspaceName,
      thesis: props.thesis,
      nodes: props.nodes,
      cards: props.cards,
      layout: options.format === 'tree' ? 'tree' : 'pyramid',
      theme: options.theme,
    })
    downloadBlob(imageFilename.value, out.blob)
    showToast(`已下载高清长图（${out.width} × ${out.height}）`)
  } catch (error) {
    showToast('长图生成失败：' + ((error as Error).message || '未知错误'))
  } finally {
    imageBusy.value = false
  }
}

watch(
  () => [props.open, options.format, options.theme, props.nodes, props.cards, props.thesis] as const,
  () => {
    if (!props.open) {
      imageSeq++
      imageDataUrl.value = ''
      return
    }
    imageDataUrl.value = ''
    void buildImage()
  },
  { immediate: true },
)
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
    <div class="cs-section cs-preview-section" :class="{ ink: options.theme === 'ink' }">
      <div class="cs-preview-heading">
        <div>
          <div class="cs-label">分享页预览</div>
          <p>以下为导出页的原生预览；可在框内滚动查看完整 L1–L4。</p>
        </div>
        <span class="cs-preview-badge">{{ options.theme === 'paper' ? '纸白' : '墨黑' }} · {{ options.format === 'reading' ? '阅读长文' : '论证树' }}</span>
      </div>
      <div class="cs-preview-frame">
        <div class="cs-paper" role="document" aria-label="策展成果预览">
          <header class="cs-paper-hero">
            <span class="cs-paper-kicker">策展成果 · {{ options.format === 'reading' ? '阅读长文' : '论证树' }}</span>
            <h3>{{ previewTitle }}</h3>
            <p>{{ previewDescription }}</p>
            <div class="cs-paper-metrics">
              <span><b>{{ renderTree.cardCount }}</b> 张资源</span>
              <span><b>{{ renderTree.nodeCount }}</b> 个节点</span>
              <span><b>{{ roots }}</b> 个一级分支</span>
            </div>
          </header>
          <div v-if="!renderTree.roots.length" class="cs-paper-empty">这份成果还没有论证分支。</div>
          <template v-else>
          <section v-for="node in previewFlatNodes" :key="node.id" class="cs-paper-node" :style="{ '--depth': Math.min(3, node.level - 2) }">
            <span class="cs-paper-level">L{{ node.level }} · 论证节点</span>
            <h4>{{ node.title }}</h4>
            <p v-if="node.description">{{ node.description }}</p>
            <div v-if="node.cards.length" class="cs-paper-cards">
              <span v-for="card in node.cards.slice(0, 3)" :key="card.id" class="cs-paper-card">
                <b>{{ card.title }}</b>
                <small v-if="card.description">{{ card.description }}</small>
              </span>
              <small v-if="node.cards.length > 3" class="cs-paper-more">另有 {{ node.cards.length - 3 }} 张资源</small>
            </div>
            <div v-else class="cs-paper-empty inline">这个节点暂未挂资源卡。</div>
          </section>
          </template>
        </div>
      </div>
    </div>
    <div class="cs-image-row">
      <span class="cs-image-state">
        <Icon name="image" :size="14"/>
        <span><b>高清长图</b><small>{{ imageBusy ? '正在生成完整 L1–L4 长图…' : imageDataUrl ? '已嵌入分享 HTML；接收方可直接下载' : '打开分享时可生成' }}</small></span>
      </span>
      <button type="button" class="cs-btn" :disabled="imageBusy" @click="downloadImage">
        <Icon name="download" :size="13"/> 下载高清长图
      </button>
    </div>
    <template #footer>
      <button type="button" class="cs-btn" @click="emit('close')">取消</button>
      <button type="button" class="cs-btn primary" :disabled="imageBusy" @click="download"><Icon name="download" :size="13"/> 下载 HTML</button>
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
.cs-preview-section { padding: 11px 12px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.cs-preview-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
.cs-preview-heading .cs-label { margin-bottom: 3px; }
.cs-preview-heading p { margin: 0; color: var(--text-3); font-size: var(--fs-tiny); line-height: 1.55; }
.cs-preview-badge { flex: none; padding: 3px 7px; border: 1px solid var(--border-strong); border-radius: 999px; color: var(--text-2); background: var(--surface); font-size: var(--fs-micro); white-space: nowrap; }
.cs-preview-frame { overflow: hidden; border: 1px solid color-mix(in srgb, var(--border-strong) 72%, var(--border)); border-radius: 8px; background: #fffdf8; box-shadow: 0 1px 3px color-mix(in srgb, #000 8%, transparent); }
.cs-paper { --paper-bg: #f7f4ed; --paper-surface: #fffdf8; --paper-ink: #25221c; --paper-ink-2: #4d483f; --paper-ink-3: #71695d; --paper-line: rgba(40,34,24,.18); --paper-accent: #2f5955; --paper-accent-soft: #e7f0ed; height: 360px; overflow: auto; padding: 22px 24px 28px; background: var(--paper-bg); color: var(--paper-ink); font-size: 12px; line-height: 1.65; }
.cs-preview-section.ink .cs-paper { --paper-bg: #17181c; --paper-surface: #202126; --paper-ink: #f4f0e8; --paper-ink-2: #d8d2c8; --paper-ink-3: #aaa397; --paper-line: rgba(255,255,255,.20); --paper-accent: #c3d0dd; --paper-accent-soft: rgba(195,208,221,.18); }
.cs-paper-hero { padding-bottom: 17px; border-bottom: 1px solid var(--paper-line); }
.cs-paper-kicker, .cs-paper-level { display: block; color: var(--paper-accent); font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.cs-paper-hero h3 { margin: 6px 0 6px; color: var(--paper-ink); font-size: 20px; line-height: 1.3; letter-spacing: -.02em; }
.cs-paper-hero p { margin: 0; color: var(--paper-ink-2); font-size: 12px; }
.cs-paper-metrics { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.cs-paper-metrics span { padding: 2px 7px; border: 1px solid var(--paper-line); border-radius: 999px; color: var(--paper-ink-3); font-size: 10px; }
.cs-paper-metrics b { color: var(--paper-ink); }
.cs-paper-node { margin: 15px 0 0; margin-left: calc(var(--depth) * 15px); padding: 12px 13px; border: 1px solid var(--paper-line); border-radius: 8px; background: var(--paper-surface); }
.cs-paper-node h4 { margin: 4px 0 4px; color: var(--paper-ink); font-size: 14px; line-height: 1.4; }
.cs-paper-node > p { margin: 0; color: var(--paper-ink-2); font-size: 11px; }
.cs-paper-cards { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.cs-paper-card { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px solid var(--paper-line); border-radius: 5px; background: var(--paper-bg); }
.cs-paper-card b { color: var(--paper-ink); font-size: 11px; font-weight: 600; }
.cs-paper-card small, .cs-paper-more { color: var(--paper-ink-3); font-size: 10px; line-height: 1.45; }
.cs-paper-empty { padding: 10px; border: 1px dashed var(--paper-line); border-radius: 6px; color: var(--paper-ink-3); font-size: 11px; }
.cs-paper-empty.inline { margin-top: 7px; padding: 6px 8px; }
.cs-image-row { margin-top: 12px; display: flex; align-items: center; gap: 12px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.cs-image-state { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; color: var(--text-3); }
.cs-image-state > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cs-image-state b { color: var(--text-2); font-size: var(--fs-sub); }
.cs-image-state small { color: var(--text-3); font-size: var(--fs-tiny); line-height: 1.5; }
.cs-btn { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: var(--fs-sub); }
.cs-btn:hover { border-color: var(--accent); color: var(--accent); }
.cs-btn:disabled { opacity: var(--opacity-disabled); cursor: wait; }
.cs-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.cs-btn.primary:hover { background: var(--accent-hover); color: #fff; }
@media (max-width: 640px) { .cs-format-grid { grid-template-columns: 1fr; } .cs-paper { height: 300px; padding: 18px 16px 22px; } .cs-preview-heading { flex-direction: column; gap: 6px; } .cs-image-row { align-items: stretch; flex-direction: column; } }
</style>
