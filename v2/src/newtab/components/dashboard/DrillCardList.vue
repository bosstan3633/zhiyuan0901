<script setup lang="ts">
/**
 * R172-T6（04-67 §F13 / §F14 / §4.1）：共用下钻卡片列表。
 *
 * 日详情四类指标下钻 与 复盘段 KPI 下钻 **共用本组件**（04-66 §6.2 组件复用清单），
 * 不另造一套 —— 这样"同卡多次聚合 ×N"与"单击/双击"的交互在全站只有一个答案。
 *
 * 交互对齐资源台 / 任务中心：单击 → 定位并高亮卡片所在处；双击 → 直达链接 / 打开文件。
 */
import './dashboard.css'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { showToast } from '@/shared/components/toast'

interface Row {
  kind: string
  id: string
  title: string
  icon: string
  tag: string
  /** 同卡当天出现次数（>1 显示 ×N；F13 要求聚合而不是列 22 条同名） */
  n?: number
  time?: string
  time2?: string
  score?: number
}
const props = defineProps<{
  rows: Row[]
  label: string
  /** 记录总条数（> rows.length ⇒ 表头提示"同卡多次已合并 ×N"） */
  total?: number
  hint?: string
  /** 嵌在容器内时去掉外边距（复盘段 / 日详情容器自带） */
  plain?: boolean
}>()

const router = useRouter()
const store = useAppStore()

function pick(r: Row) {
  const kind = asLocateKind(r.kind)
  if (!kind) { showToast(`「${r.title}」无对应卡片类型`); return }
  const t = locateTargetOf(store.data!, kind, r.id)
  if (!t) { showToast(`⚠ 「${r.title}」已不在库中`); return }
  void router.push(t)
}

function open(r: Row) {
  const kind = asLocateKind(r.kind)
  if (kind === 'resource') {
    const card = store.data?.resources.find(x => x.id === r.id)
    if (card && card.link) {
      const url = toOpenableUrl(card.linkType, card.link)
      if (url) { openExternalLink(url); return }
    }
  }
  pick(r)
}
</script>

<template>
  <div class="dz-drill" :class="{ plain }">
    <div class="dz-drill-h">
      <b>{{ label }}</b>
      <span>{{ rows.length }} 类卡片 · 共 {{ total ?? rows.length }} 条记录<template v-if="(total ?? rows.length) > rows.length">（同卡多次已合并 ×N）</template></span>
      <span class="dz-sp"></span>
      <span class="dz-drill-hint">{{ hint || '单击看详情 · 双击直达链接' }}</span>
    </div>
    <div v-if="!rows.length" class="dz-drill-empty">该维度无记录</div>
    <div v-for="(r, i) in rows" :key="r.kind + '|' + r.id + '|' + i" class="dz-row"
      :title="`单击 → 定位「${r.title}」· 双击 → 直达链接 / 打开文件`"
      @click="pick(r)" @dblclick="open(r)">
      <span class="dz-row-i">{{ r.icon }}</span>
      <span class="dz-row-t">{{ r.title }}</span>
      <span v-if="(r.n || 1) > 1" class="dz-row-n" :title="`共 ${r.n} 次`">×{{ r.n }}</span>
      <span class="dz-row-m">{{ r.time }}<template v-if="(r.n || 1) > 1 && r.time2"> – {{ r.time2 }}</template></span>
      <span class="dz-row-p">{{ r.tag }}</span>
      <span class="dz-row-g">›</span>
    </div>
  </div>
</template>
