<script setup lang="ts">
/**
 * W11 · 层级展开面板（原型 .lvpanel）。
 *
 * 存在的理由：原型评审时被明确否过一次——"点层级只弹 toast 等于没反应"。
 * 用户对"交互"的标准是：**点一下要摊开这一层的完整内容**，不是弹个提示。
 * 所以这里是三层各自的"展开说明书"，并且每层摊开后都必须给出**下一步入口**
 * （推导链或下挂实体），否则就等于把那张冗余的架构图换了个位置。
 *
 * 两层内容（★F7 收窄 2026-10-16：第 3 层迁出面板，改走骨架条专属列表视图）：
 *   1 愿景 → 全文 + 关联卡片数 + 推导链 + 下挂的 N 个战略目标芯片
 *   2 使命 → 全文 + 推导链
 *   3 战略目标 → ★已迁至 CompassLayerList 第 3 层专属列表（能力一项不少：目标进度条/下挂项目/点行过滤）
 *
 * 折叠双向：父级用 open 传 null/false 收起，本组件只在 v-if 存在时渲染。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { CompassMeta } from '../../views/compassMeta'

const props = defineProps<{
  meta: CompassMeta
  /** 当前展开层级（★F7 收窄：只有 1/2，第 3 层走专属列表） */
  layer: 1 | 2
  /** 当前聚焦的战略目标 id */
  dirFilter: string
}>()

const emit = defineEmits<{
  (e: 'goto', lv: 1 | 2): void
  (e: 'list', lv: 3 | 5 | 6): void
  (e: 'locate', lv: 4): void
  (e: 'dir', id: string): void
  (e: 'close'): void
}>()

const LAYER_META = {
  1: { n: 1, en: 'VISION', t: '终极方向', ic: '◎' },
  2: { n: 2, en: 'MISSION', t: '行动准则', ic: '◆' }
} as const

const lm = computed(() => LAYER_META[props.layer])
const c = computed(() => props.meta.counts)

/** 推导链：当前层高亮为 .self，1~2 点切面板、3/5/6 点专属列表、4 点定位 */
const CHAIN = [
  { n: 1, label: '愿景', key: 'vision' },
  { n: 2, label: '使命', key: 'mission' },
  { n: 3, label: '战略目标', key: 'dirs' },
  { n: 4, label: '攻坚项目', key: 'projects' },
  { n: 5, label: '成功指标', key: 'metrics' },
  { n: 6, label: '任务', key: 'tasks' }
] as const
function onChain(n: number) {
  if (n <= 2) emit('goto', n as 1 | 2)
  else if (n === 4) emit('locate', 4)
  else emit('list', n as 3 | 5 | 6)
}
</script>

<template>
  <!-- ★容器 div 是过渡载体（max-height），本身无内容——移植时别删，删了面板直接跳变不出动画 -->
  <div class="lvp" id="lvpanel-anchor">
    <section class="lvp-in" :data-layer="layer">
      <header class="lvp-head">
        <span class="lvp-ic">{{ lm.ic }}</span>
        <span class="lvp-t">
          第 {{ lm.n }} 层 · {{ lm.t }}<span class="lvp-en">{{ lm.en }}</span>
        </span>
        <button class="lvp-x" title="收起（再点层级可重新展开）" @click="emit('close')"><Icon name="x" :size="13"/> 收起</button>
      </header>

      <!-- 主体：这一层的实体本体。
           ★W12：第 1/2 层正文**只**由父组件经 #entity 插槽注入（承载就地编辑 + 关联卡片能力）。
           这里曾留过一份只读 fallback，理由是"插槽不传时面板也得有内容"—— 但那等于同一句愿景在页面上
           出现两次：一份能改、一份不能改，两份还会各自漂移。宁可空着（插槽始终会传）也不留影子文本。 -->
      <div class="lvp-main">
        <div class="lvp-entity">
          <slot name="entity">
          <!-- ★F7 迁出带备案（2026-10-16）：第 3 层的兜底 hero 与下挂目标横卡（lvp-cards）
               随第 3 层迁出面板，移入 CompassLayerList 第 3 层专属列表——能力一项不少
               （目标进度条 / 下挂项目 / 点行过滤），形态从面板横卡改列表行。 -->
          </slot>
        </div>
        <!-- 推导链与下挂战略目标并排成为摘要栏，不再继续纵向堆高。 -->
        <div class="lvp-summary">
          <div class="lvp-sec">
            <span class="lvp-lab">推导链 · 逐层收窄</span>
            <div class="lvp-chain">
              <template v-for="(s, i) in CHAIN" :key="s.n">
                <span v-if="i" class="lvp-ar" aria-hidden="true">›</span>
                <button
                  class="cnode"
                  :class="{ self: s.n === layer }"
                  @click="onChain(s.n)"
                >
                  <b>{{ c[s.key] }}</b><span>{{ s.label }}</span>
                </button>
              </template>
            </div>
          </div>

          <div v-if="layer === 1" class="lvp-sec">
            <span class="lvp-lab">这条愿景下的 {{ c.dirs }} 个战略目标</span>
            <div class="lvp-dirs">
              <button
                v-for="g in meta.dirs"
                :key="g.dir.id"
                class="dchip"
                :class="{ on: dirFilter === g.dir.id }"
                @click="emit('dir', g.dir.id)"
              >
                <i class="dc-dot" />
                <span class="dc-n">{{ g.dir.name }}</span>
                <span class="dc-m">{{ g.projects.length }} 项目 · {{ g.projects.reduce((s, p) => s + p.total, 0) }} 任务</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ★F7 迁出带备案（2026-10-16）：原「第 3 层下挂：目标横卡，点卡即过滤」整段
           迁入 CompassLayerList 第 3 层专属列表（点行过滤语义不变，形态横卡→列表行）。 -->
    </section>
  </div>
</template>

<style scoped>
.lvp {
  margin-bottom: 12px;
  animation: lvpIn 220ms var(--ease);
}
@keyframes lvpIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

.lvp-in {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 10px 15px 11px;
  display: flex; flex-direction: column; gap: 8px;
}
.lvp-head { display: flex; align-items: center; gap: 8px; }
.lvp-ic {
  width: 22px; height: 22px; border-radius: 7px; flex: none;
  background: var(--accent-light); color: var(--accent-ink);
  display: flex; align-items: center; justify-content: center; font-size: var(--fs-sub);
}
.lvp-t { font-size: var(--fs-sub); font-weight: 700; color: var(--text); display: flex; align-items: baseline; gap: 7px; }
.lvp-en { font-size: var(--fs-micro); font-weight: 700; letter-spacing: .1em; color: var(--text-4); }
.lvp-x {
  margin-left: auto; font-size: var(--fs-micro); color: var(--text-3);
  padding: 3px 9px; border-radius: 999px; cursor: pointer; transition: all var(--dur); flex: none;
}
.lvp-x:hover { color: var(--text); background: var(--surface-3); }

.lvp-main {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .9fr);
  align-items: stretch;
  gap: 14px;
}
.lvp-entity { min-width: 0; }
.lvp-summary { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.lvp-sec { padding-left: 0; display: flex; flex-direction: column; gap: 6px; }
/* ★F7 迁出带备案（2026-10-16）：原 .lvp-hero / .lvp-desc（第 3 层兜底 hero）与
   .lvp-cards / .dcard / .dc-h / .dc-i / .dc-bar / .dc-p / .dc-go（第 3 层目标横卡）CSS
   随第 3 层迁入 CompassLayerList 第 3 层专属列表一并退役（样式在新组件内重写为列表行形态）。 */

.lvp-sec { padding-left: 0; display: flex; flex-direction: column; gap: 6px; }
.lvp-lab {
  font-size: var(--fs-micro); font-weight: 700; letter-spacing: .05em; color: var(--text-4);
}
.lvp-chain { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.lvp-ar { font-size: var(--fs-caption); color: var(--text-4); padding: 0 1px; }
.cnode {
  display: inline-flex; align-items: baseline; gap: 5px;
  padding: 3px 10px; border-radius: 999px;
  background: var(--surface-2); border: 1px solid transparent;
  cursor: pointer; transition: all var(--dur);
}
.cnode:hover { border-color: var(--accent); }
.cnode b { font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.cnode span { font-size: var(--fs-micro); color: var(--text-4); }
.cnode.self { background: var(--accent-light); border-color: var(--accent); }
.cnode.self b { color: var(--accent); }
.cnode.self span { color: var(--accent-ink); }

.lvp-dirs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dchip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: var(--surface-2); border: 1px solid var(--border);
  cursor: pointer; transition: all var(--dur);
}
.dchip:hover { border-color: var(--text-4); }
.dchip.on { background: var(--accent-light); border-color: var(--accent); }
.dc-dot { width: 6px; height: 6px; border-radius: 2px; background: var(--accent); flex: none; }
.dc-n { font-size: var(--fs-micro); font-weight: 700; color: var(--text-2); }
.dchip.on .dc-n { color: var(--text); }
.dc-m { font-size: var(--fs-micro); color: var(--text-4); }

/* ★F7 迁出带备案（2026-10-16）：第 3 层目标横卡整套样式（.lvp-cards / .dcard 系）随迁 CompassLayerList。 */

@media (max-width: 900px) {
  .lvp-main { grid-template-columns: minmax(0, 1fr); }
  .lvp-summary { flex-direction: row; flex-wrap: wrap; }
  .lvp-summary .lvp-sec { flex: 1 1 260px; }
}
</style>
