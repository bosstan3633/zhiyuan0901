<script setup lang="ts">
/**
 * W11 · 战略骨架控制条（原型 .spine）。
 *
 * 它不是"另一张架构展示图"，而是**项目塔的导航 / 过滤 / 联动中枢**——
 * 六层数字与项目塔同源（吃 CompassMeta.counts），点层级即定位或过滤，
 * 点战略目标芯片即筛掉其它目标的舱。判据 W11-7 钉的就是"数字不得散落各处现算"。
 *
 * 焦点纪律：★全组件不得出现 --fs-display / --fs-hero（判据 W11-13 负锚）。
 * 层级标题最高只到 --fs-title，主角感由版式与留白承担。
 */
import { computed } from 'vue'
import type { CompassMeta } from '../../views/compassMeta'

const props = defineProps<{
  meta: CompassMeta
  /** 当前聚焦的战略目标 id；空串＝全部 */
  dirFilter: string
  /** 当前展开的层级面板 1|2；null＝收起（★F7 收窄：第 3 层迁出面板改走专属列表） */
  layerOpen: 1 | 2 | null
  /** 当前打开的层级专属列表视图 3|5|6；null＝收起（★F7 新增） */
  layerView: 3 | 5 | 6 | null
  /** 断链模式是否开启 */
  riskOnly: boolean
}>()

const emit = defineEmits<{
  (e: 'layer', lv: 1 | 2): void
  (e: 'list', lv: 3 | 5 | 6): void
  (e: 'locate', lv: 4): void
  (e: 'dir', id: string): void
  (e: 'risk'): void
  (e: 'orphan'): void
  (e: 'riskBar'): void
}>()

/** 推导链的当前所在层（面板 1/2 与专属列表 3/5/6 联合高亮；点 4 定位不占高亮——定位是动作不是驻留态） */
const chainAt = computed<1 | 2 | 3 | 5 | 6 | null>(() => props.layerOpen ?? props.layerView)

/** 六层各对应 counts 里的哪个键（写成字面量联合，避免模板里再 cast 一次） */
type CountKey = 'vision' | 'mission' | 'dirs' | 'projects' | 'metrics' | 'tasks'
const LV: { n: 1 | 2 | 3 | 4 | 5 | 6; t: string; c: CountKey }[] = [
  { n: 1, t: '愿景', c: 'vision' },
  { n: 2, t: '使命', c: 'mission' },
  { n: 3, t: '战略目标', c: 'dirs' },
  { n: 4, t: '攻坚项目', c: 'projects' },
  { n: 5, t: '成功指标', c: 'metrics' },
  { n: 6, t: '任务', c: 'tasks' }
]

/** 每个项目舱的色相档位（判据 D2：从 accent 派生六档，不新增色系令牌） */
const HUES = [88, 70, 52, 38, 26, 16]
function hueOf(idx: number): string {
  return `color-mix(in srgb, var(--accent) ${HUES[idx % HUES.length]}%, var(--surface))`
}

/** 点击六层按钮（★F7 路由改写 2026-10-16）：1/2 走层面板、3/5/6 走层级专属列表视图、4 走定位
 *  ★两个分支必须显式收窄成各自的联合类型——合成一个联合后 emit 重载推不出来（TS2769） */
function onLv(n: 1 | 2 | 3 | 4 | 5 | 6) {
  if (n <= 2) emit('layer', n as 1 | 2)
  else if (n === 4) emit('locate', 4)
  else emit('list', n as 3 | 5 | 6)
}
</script>

<template>
  <section class="spine" aria-label="战略骨架控制条">
    <!-- ★W12 骨架条头部（原型 .spine-h）：图标 + 名称 + 定位语 + 右侧提示。
         之前骨架条没有头部，直接就是六层按钮 —— 于是它看起来像"一排统计标签"而不是
         "六层的骨架"，标题与定位语这两条让层级从哪开始、往哪收一眼可读。 -->
    <header class="spine-h">
      <span class="spine-ico" aria-hidden="true">◈</span>
      <span class="spine-t">战略骨架<span class="spine-en">SPINE</span></span>
      <span class="spine-badge">上层定方向 · 下层见动作</span>
      <div class="spine-hint">
        <span>六层数字与下方项目舱同源 · 点 1/2 展开该层 · 点 4 定位项目舱 · 点 3/5/6 切换层级列表</span>
      </div>
      <!-- ★V3.8.18（N12）：第 3 层「战略目标」的入口挂到骨架条上，不再挤在页头。
           病根＝「＋战略目标」「建议目标」是第 3 层的操作，却摆在一堆全局按钮里，
           用户的视线要先跨过"视图切换/展开收起/已完成显示"才够得到它。
           用插槽而非硬编码：按钮的文案/图标/是否启用归父级（CompassTree）管，子组件只负责摆位。 -->
      <div class="spine-actions"><slot name="actions" /></div>
    </header>

    <div class="spine-b">
      <div class="spine-chain" role="tablist">
        <template v-for="(lv, i) in LV" :key="lv.n">
          <span v-if="i" class="spine-arrow" aria-hidden="true">›</span>
          <button
            class="spine-lv"
            :class="[`lv${lv.n}`, { on: chainAt === lv.n }]"
            :aria-selected="chainAt === lv.n"
            role="tab"
            @click="onLv(lv.n)"
          >
            <span class="slv-n">{{ lv.n }}</span>
            <span class="slv-t">{{ lv.t }}</span>
            <span class="slv-c"><b>{{ meta.counts[lv.c] }}</b></span>
          </button>
        </template>
      </div>

      <!-- 战略目标芯片行：与下方项目分组头同源同色，点即过滤 -->
      <div class="spine-dirs">
        <span class="sd-lab">按战略目标聚焦</span>
        <button class="dchip" :class="{ on: dirFilter === '' }" @click="emit('dir', '')">
          <span class="dc-n">全部</span>
          <span class="dc-m">{{ meta.counts.dirs }} 目标 / {{ meta.counts.projects }} 项目</span>
        </button>
        <button
          v-for="(g, i) in meta.dirs"
          :key="g.dir.id"
          class="dchip"
          :class="{ on: dirFilter === g.dir.id }"
          :style="{ '--chip': hueOf(i) }"
          @click="emit('dir', g.dir.id)"
        >
          <i class="dc-dot" />
          <span class="dc-n">{{ g.dir.name }}</span>
          <span class="dc-m">{{ g.projects.length }} 项目 · {{ g.projects.reduce((s, p) => s + p.total, 0) }} 任务</span>
          <span class="dc-x">{{ dirFilter === g.dir.id ? '✓' : '▸' }}</span>
        </button>
      </div>

      <!-- 断链行：收在骨架条内，不独占横幅 -->
      <div class="spine-risk">
        <span class="sr-ico" :class="{ zero: meta.counts.risk === 0 }">
          {{ meta.counts.risk === 0 ? '✓' : '⚠' }}
        </span>
        <span v-if="meta.counts.risk > 0" class="sr-t">
          <b>{{ meta.counts.risk }} 处归属/支撑缺失</b> —— 缺任务指标与无归属任务已就地标黄
        </span>
        <span v-else class="sr-t"><b>链路完整</b> —— 每条指标都有任务，每条任务都有归属</span>
        <div class="sr-acts">
          <button v-if="meta.counts.risk > 0" class="sr-btn" :class="{ on: riskOnly }" @click="emit('risk')">
            {{ riskOnly ? '✓ 断链模式 · 退出' : '⚠ 只看断链' }}
          </button>
          <button v-if="meta.counts.risk > 0" class="sr-btn" @click="emit('orphan')">↗ 无归属收容区</button>
          <button class="sr-btn" @click="emit('riskBar')">⤓ 断链清单</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── 骨架条本体 ── */
.spine {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

/* ── 头部行（原型 .spine-h）：名称 + 定位语 + 右侧提示 ── */
.spine-h {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 11px 18px 10px;
  border-bottom: 1px solid var(--border);
}
.spine-ico {
  width: 24px; height: 24px; border-radius: 8px; flex: none;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-sub);
}
.spine-t {
  font-size: var(--fs-sub); font-weight: 700; color: var(--text);
  display: flex; align-items: baseline; gap: 7px;
}
.spine-en {
  font-size: var(--fs-micro); font-weight: 700;
  letter-spacing: .13em; color: var(--text-4);
}
.spine-badge {
  font-size: var(--fs-micro); font-weight: 600;
  color: var(--text-3); background: var(--surface-2);
  padding: 2px 9px; border-radius: 999px;
}
.spine-hint {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--fs-micro); color: var(--text-4);
}
/* ★V3.8.18（N12）：插槽容器把动作推到最右；.spine-hint 的 margin-left:auto 同时摘掉，
   否则两个 auto margins 会平分剩余空间，提示语会飘到中间。 */
.spine-actions {
  margin-left: auto; display: flex; align-items: center; gap: 7px; flex: none;
}

.spine-b { padding: 12px 18px 13px; display: flex; flex-direction: column; gap: 11px; }

/* 六层横向流：上层窄、下层宽，把"逐层收窄"直接做成宽度 */
.spine-chain { display: flex; align-items: stretch; gap: 0; flex-wrap: wrap; }
.spine-arrow { display: flex; align-items: center; padding: 0 4px; color: var(--text-4); font-size: var(--fs-micro); }
.spine-lv {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 13px; border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid transparent;
  cursor: pointer; transition: all var(--dur); min-height: 34px;
}
.spine-lv:hover { background: var(--surface-3); }
.spine-lv.on { background: var(--accent-light); border-color: var(--accent); }
.slv-n { font-size: var(--fs-micro); font-weight: 700; color: var(--text-4); }
.slv-t { font-size: var(--fs-sub); font-weight: 600; color: var(--text-2); white-space: nowrap; }
.spine-lv.on .slv-t { color: var(--accent); }
/* 计数与层级名之间一条发丝分隔：数字是统计，名字是层级，别混成一坨 */
.slv-c { padding-left: 6px; margin-left: 2px; border-left: 1px solid var(--border); }
.slv-c b { font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.spine-lv.on .slv-c { border-left-color: color-mix(in srgb, var(--accent) 35%, transparent); }
.spine-lv.on .slv-c b { color: var(--accent); }
/* 上层两级用强调底，视觉上"压"着下层 */
.spine-lv.lv1, .spine-lv.lv2 { background: var(--accent-light); }
/* ★W12：宽度直接编码层级流向（原型 .lv-1~3 flex:0 0 auto / .lv-4~6 flex:1 1 0）。
   上层按内容宽、下层三段等分铺满 ⇒ 六颗按钮在版面上自动排成"上窄下宽"的漏斗，
   "逐层收窄"从一句口号变成看得见的形状。这两条缺任一条，六层就退化成六个等大标签。 */
.spine-lv.lv1, .spine-lv.lv2, .spine-lv.lv3 { flex: 0 0 auto; }
.spine-lv.lv4, .spine-lv.lv5, .spine-lv.lv6 { flex: 1 1 0; min-width: 96px; }

/* ── 战略目标芯片 ── */
.spine-dirs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sd-lab {
  font-size: var(--fs-micro); font-weight: 700; letter-spacing: .04em; color: var(--text-4);
  padding-right: 2px;
}
.dchip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  cursor: pointer; transition: all var(--dur);
}
.dchip:hover { border-color: var(--text-4); }
.dchip.on { background: color-mix(in srgb, var(--chip, var(--accent)) 15%, transparent); border-color: var(--chip, var(--accent)); }
.dc-dot { width: 6px; height: 6px; border-radius: 2px; background: var(--chip, var(--accent)); flex: none; }
.dc-n { font-size: var(--fs-micro); font-weight: 700; color: var(--text-2); }
.dchip.on .dc-n { color: var(--text); }
.dc-m { font-size: var(--fs-micro); color: var(--text-4); }
.dc-x { font-size: 9px; color: var(--text-4); opacity: 0; transition: opacity var(--dur); }
.dchip:hover .dc-x, .dchip.on .dc-x { opacity: 1; }

/* ── 断链行 ── */
.spine-risk {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  padding-top: 9px; border-top: 1px solid var(--border);
}
.sr-ico {
  width: 18px; height: 18px; border-radius: 6px; flex: none;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-micro); font-weight: 700;
  background: var(--warning-bg-soft); color: var(--warning);
}
.sr-ico.zero { background: var(--success-bg-soft); color: var(--success); }
.sr-t { font-size: var(--fs-micro); color: var(--text-3); }
.sr-t b { color: var(--warning); font-weight: 700; }
.spine-risk .sr-t:has(b) b { color: var(--warning); }
.sr-acts { margin-left: auto; display: flex; gap: 6px; flex: none; }
.sr-btn {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-3);
  background: var(--surface-2); border: 1px solid transparent;
  padding: 3px 9px; border-radius: 999px; cursor: pointer; transition: all var(--dur);
}
.sr-btn:hover { color: var(--text); background: var(--surface-3); }
.sr-btn.on { background: var(--danger); color: #fff; border-color: var(--danger); }

/* ── 窄屏：六层改成两行三列，别挤成一条细缝 ── */
@media (max-width: 900px) {
  .spine-chain { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .spine-arrow { display: none; }
  .spine-lv { min-width: 0; }
  .sr-acts { margin-left: 0; width: 100%; }
}
</style>