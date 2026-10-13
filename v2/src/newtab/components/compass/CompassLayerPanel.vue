<script setup lang="ts">
/**
 * W11 · 层级展开面板（原型 .lvpanel）。
 *
 * 存在的理由：原型评审时被明确否过一次——"点层级只弹 toast 等于没反应"。
 * 用户对"交互"的标准是：**点一下要摊开这一层的完整内容**，不是弹个提示。
 * 所以这里是三层各自的"展开说明书"，并且每层摊开后都必须给出**下一步入口**
 * （推导链或下挂实体），否则就等于把那张冗余的架构图换了个位置。
 *
 * 三层内容：
 *   1 愿景    → 全文 + 关联卡片数 + 推导链 + 下挂的 N 个战略目标芯片
 *   2 使命    → 全文 + 推导链
 *   3 战略目标 → 3 张目标横卡（项目数/指标数/完成数/进度条/下挂项目名），点卡即过滤
 *
 * 折叠双向：父级用 open 传 null/false 收起，本组件只在 v-if 存在时渲染。
 */
import { computed } from 'vue'
import type { CompassMeta } from '../../views/compassMeta'

const props = defineProps<{
  meta: CompassMeta
  /** 当前展开层级 */
  layer: 1 | 2 | 3
  /** 战略目标全文 */
  vision: string
  mission: string
  /** 愿景/使命关联卡片数 */
  visionLinks: number
  missionLinks: number
  /** 当前聚焦的战略目标 id */
  dirFilter: string
}>()

const emit = defineEmits<{
  (e: 'goto', lv: 1 | 2 | 3): void
  (e: 'locate', lv: 4 | 5 | 6): void
  (e: 'dir', id: string): void
  (e: 'close'): void
}>()

const LAYER_META = {
  1: { n: 1, en: 'VISION', t: '终极方向', ic: '◎' },
  2: { n: 2, en: 'MISSION', t: '行动准则', ic: '◆' },
  3: { n: 3, en: 'DIRECTION', t: '分岔源头', ic: '⛳' }
} as const

const lm = computed(() => LAYER_META[props.layer])
const c = computed(() => props.meta.counts)

/** 推导链：当前层高亮为 .self，1~3 点切面板、4~6 点定位 */
const CHAIN = [
  { n: 1, label: '愿景', key: 'vision' },
  { n: 2, label: '使命', key: 'mission' },
  { n: 3, label: '战略目标', key: 'dirs' },
  { n: 4, label: '攻坚项目', key: 'projects' },
  { n: 5, label: '成功指标', key: 'metrics' },
  { n: 6, label: '任务', key: 'tasks' }
] as const
function onChain(n: number) {
  if (n <= 3) emit('goto', n as 1 | 2 | 3)
  else emit('locate', n as 4 | 5 | 6)
}
/** 每个战略目标的完成度（跨其下全部项目的指标聚合） */
function dirProgress(dirIdx: number): { done: number; total: number; pct: number } {
  let done = 0, total = 0
  for (const pm of props.meta.dirs[dirIdx].projects) { done += pm.done; total += pm.total }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}
</script>

<template>
  <!-- ★容器 div 是过渡载体（max-height），本身无内容——移植时别删，删了面板直接跳变不出动画 -->
  <div class="lvp">
    <section class="lvp-in" :data-layer="layer">
      <header class="lvp-head">
        <span class="lvp-ic">{{ lm.ic }}</span>
        <span class="lvp-t">
          第 {{ lm.n }} 层 · {{ lm.t }}<span class="lvp-en">{{ lm.en }}</span>
        </span>
        <button class="lvp-x" title="收起（再点层级可重新展开）" @click="emit('close')">✕ 收起</button>
      </header>

      <!-- 主体：这一层的实体本体 -->
      <div class="lvp-main">
        <template v-if="layer === 1">
          <h3 class="lvp-hero">{{ vision || '点击设定你的核心愿景…' }}</h3>
          <p class="lvp-desc">
            这是整条链的<b>视觉原点</b>——下面五层全部由它推导而来。
            任何一层的取舍，判据都是"它服务不服务于这一句"。
          </p>
          <span class="lvp-chip">🔗 关联卡片 {{ visionLinks }}</span>
        </template>

        <template v-else-if="layer === 2">
          <h3 class="lvp-hero sub">{{ mission || '点击设定你的核心使命…' }}</h3>
          <p class="lvp-desc">
            把愿景翻译成<b>可执行的行动准则</b>。使命的作用是判据：
            某件事做不做，先问它符不符合这一条。
          </p>
          <span class="lvp-chip">🔗 关联卡片 {{ missionLinks }}</span>
        </template>

        <template v-else>
          <h3 class="lvp-hero sub">{{ c.dirs }} 个战略目标 · 向下分岔为 {{ c.projects }} 个攻坚项目</h3>
          <p class="lvp-desc">
            这是从"定方向"转向"分资源"的一层。<b>分岔点</b>：
            每个目标各自去占资源，目标之间互不抢。
          </p>
        </template>
      </div>

      <!-- 推导链：每段可点，1~3 切面板、4~6 定位 -->
      <div class="lvp-sec">
        <span class="lvp-lab">推导链 · 逐层收窄</span>
        <div class="lvp-chain">
          <template v-for="(s, i) in CHAIN" :key="s.n">
            <span v-if="i" class="lvp-ar" aria-hidden="true">▸</span>
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

      <!-- 第 1 层下挂：战略目标芯片（与骨架条、舱体分组头三处同源） -->
      <div v-if="layer === 1" class="lvp-sec">
        <span class="lvp-lab">这条愿景下的 {{ c.dirs }} 个战略目标</span>
        <div class="lvp-dirs">
          <button
            v-for="(g, i) in meta.dirs"
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

      <!-- 第 3 层下挂：目标横卡，点卡即过滤下方项目塔 -->
      <div v-if="layer === 3" class="lvp-sec">
        <span class="lvp-lab">点任一张卡 → 过滤下方项目塔</span>
        <div class="lvp-cards">
          <button
            v-for="(g, i) in meta.dirs"
            :key="g.dir.id"
            class="dcard"
            :class="{ on: dirFilter === g.dir.id }"
            @click="emit('dir', g.dir.id)"
          >
            <div class="dc-h">
              <span class="dc-i">{{ i + 1 }}</span>
              <span class="dc-n">{{ g.dir.name }}</span>
            </div>
            <div class="dc-m">
              {{ dirProgress(i).done }}/{{ dirProgress(i).total }} 任务 ·
              {{ dirProgress(i).pct }}%
              <span v-if="g.projects.reduce((s, p) => s + (p.stall ? 1 : 0), 0)" class="dc-warn">⚠ 有停滞</span>
            </div>
            <div class="dc-bar"><i :style="{ width: dirProgress(i).pct + '%' }" /></div>
            <div class="dc-p">
              <span v-for="pm in g.projects" :key="pm.id">
                {{ pm.total }} 任务{{ pm.risk ? ' ⚠' : '' }}
              </span>
            </div>
            <span class="dc-go">{{ dirFilter === g.dir.id ? '正在只看这个 · 再点取消' : '▸ 只看这个目标' }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lvp {
  margin-bottom: 16px;
  animation: lvpIn 220ms var(--ease);
}
@keyframes lvpIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

.lvp-in {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 13px 16px 15px;
  display: flex; flex-direction: column; gap: 12px;
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

.lvp-main { padding-left: 30px; }
/* ★判据 W11-13：这里绝不许用 --fs-display / --fs-hero。
   愿景的主角感由独占整行 + 留白 + 重边框承担，字号只到 --fs-title。 */
.lvp-hero {
  font-size: var(--fs-title); font-weight: 700; color: var(--text);
  line-height: 1.5; letter-spacing: -.01em;
}
.lvp-hero.sub { font-size: var(--fs-title); font-weight: 600; color: var(--text-2); }
.lvp-desc { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.75; margin-top: 6px; }
.lvp-desc b { color: var(--text-2); }
.lvp-chip {
  display: inline-block; margin-top: 8px;
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-2); padding: 2px 9px; border-radius: 999px;
}

.lvp-sec { padding-left: 30px; display: flex; flex-direction: column; gap: 8px; }
.lvp-lab {
  font-size: var(--fs-micro); font-weight: 700; letter-spacing: .05em; color: var(--text-4);
}
.lvp-chain { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.lvp-ar { font-size: 9px; color: var(--text-4); padding: 0 2px; }
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

.lvp-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
.dcard {
  text-align: left; background: var(--surface-2); border: 1px solid transparent;
  border-radius: var(--radius-md); padding: 10px 12px; cursor: pointer;
  display: flex; flex-direction: column; gap: 6px; transition: all var(--dur);
}
.dcard:hover { border-color: var(--accent); }
.dcard.on { background: var(--accent-light); border-color: var(--accent); }
.dc-h { display: flex; align-items: center; gap: 6px; }
.dc-i {
  width: 16px; height: 16px; border-radius: 5px; flex: none;
  background: var(--surface-3); color: var(--text-2);
  font-size: var(--fs-micro); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.dcard.on .dc-i { background: var(--accent); color: #fff; }
.dc-n { font-size: var(--fs-sub); font-weight: 700; color: var(--text); line-height: 1.4; }
.dc-m { font-size: var(--fs-micro); color: var(--text-3); display: flex; align-items: center; gap: 6px; }
.dc-warn { color: var(--warning); }
.dc-bar { height: 3px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.dc-bar i { display: block; height: 100%; border-radius: 2px; background: var(--accent); transition: width var(--dur); }
.dc-p { display: flex; gap: 4px; flex-wrap: wrap; }
.dc-p span {
  font-size: var(--fs-micro); color: var(--text-3);
  background: var(--surface-3); padding: 1px 7px; border-radius: 999px;
}
.dc-go { font-size: var(--fs-micro); color: var(--accent-ink); opacity: 0; transition: opacity var(--dur); }
.dcard:hover .dc-go, .dcard.on .dc-go { opacity: 1; }

@media (max-width: 900px) {
  .lvp-main, .lvp-sec { padding-left: 0; }
}
</style>