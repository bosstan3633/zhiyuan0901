<script setup lang="ts">
/**
 * 行内富文本 · 只认成对 `**加粗**`（S5 / V3.8.38 新增）
 *
 * 为什么需要它：产品更新日志的 1114 条要点里，145 条以 `**小标题**` 起头，全库共 362 处加粗标记，
 * 但此前模板一律用 `{{ p }}` 平铺渲染——**星号是原样显示给用户的**。这不是文案问题，是渲染层漏了。
 *
 * 为什么不用 v-html：数据源是本文件里的静态字面量，**没有用户数据注入点**，但仍然不用
 * v-html——这里只需要"加粗"一种效果，为它开一个 HTML 注入面不划算（库内另有 24 处 v-html 的历史
 * 存量已逐一判过数据源，不应再添新的）。本组件输出的是文本节点数组，Vue 自动转义。
 *
 * 为什么只认成对标记：要点正文里有 `ds-*` 这类含单个星号的 CSS 通配符（1 处）。
 * 「成对才认」的规则天然避开它——单星号既不匹配开头也不匹配闭合，原样输出。
 *
 * 未闭合的标记不吞字符：`**` 数量为奇数时，最后一个不配对的标记按普通文本输出。
 * 数据侧已实测 1114 条全部闭合，此处是防御。
 */
import { computed } from 'vue'

const props = defineProps<{ text: string }>()

interface Seg { bold: boolean; t: string }

/** 切分为普通段与加粗段。未配对的星号退回普通文本，不吞。 */
function parse(s: string): Seg[] {
  const out: Seg[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ bold: false, t: s.slice(last, m.index) })
    out.push({ bold: true, t: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ bold: false, t: s.slice(last) })
  return out
}

const segs = computed<Seg[]>(() => parse(props.text || ''))
</script>

<template>
  <template v-for="(s, i) in segs" :key="i"><b v-if="s.bold">{{ s.t }}</b><template v-else>{{ s.t }}</template></template>
</template>