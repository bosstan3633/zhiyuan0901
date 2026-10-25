<script setup lang="ts">
/**
 * W11 · 项目全景（横向泳道视图，原型 .pano）—— **导航层**。
 *
 * 为什么要有第二个视图（项目塔解决不了什么）：
 *  项目塔是**纵向**的 —— 舱 → 指标 → 任务自上而下，适合回答"我在哪个位置"；
 *  但第三个高频问题是"**这一个项目的完整链路长什么样**"，纵向要滚动七八屏，
 *  且指标之间的并列关系在纵向里读不出来。横向泳道：选一个项目 → 一根泳道 = 一条成功指标，
 *  泳道内竖排该指标的任务，顶部一条三段层级带把「第 4 层 › 第 5 层 › 第 6 层」的从属印在结构上。
 *
 * 形态决策（D3 已拍板）：做成**方向台内的第二视图**（viewMode: 'tower' | 'pano'），
 * 不新建路由、不新建页面文件 —— 它是同一份 compassMeta 的另一种投影，不是另一个实体世界。
 *
 * ★组件边界：本组件只管「选谁 / 主体是谁」（选择条 + 项目头 + 泳道轨道 + 收容道），
 * 一根根泳道交给 CompassPanoLane。两块各自独立可判 —— 改导航样式不会把内容判据一起拖红。
 *
 * V3.9.17：阅读顺序固定为「项目切换 → 项目摘要 → 指标泳道」。
 * 轨道 1 铺满、2–4 等分、5+ 以 280px 下限滚动。
 *
 * 焦点纪律：★不得出现 font-size: var(--fs-display) / var(--fs-hero)（判据 W11-11 负锚）。
 * 项目名 --fs-title(15px)，主角感由横向铺开与留白承担。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, ref } from 'vue'
import type { Direction, Project } from '@/shared/models'
import type { CompassMeta, ProjectMeta } from '../../views/compassMeta'
import CompassPanoLane from './CompassPanoLane.vue'
import CompassPanoSwitch from './CompassPanoSwitch.vue'
import CompassTowerStatus from './CompassTowerStatus.vue'
import type { ProjectDiagnosis } from '@/shared/ai/projectDiagnose'

const props = defineProps<{
  meta: CompassMeta
  /** 当前全景聚焦的项目 id（双向：点选择条换主体 / 判据 W11-8） */
  activeId: string
  /** ★F4：当前项目的 AI 诊断报告（宿主算好传入；null=还没生成过） */
  diag?: ProjectDiagnosis | null
  /** ★F4：报告指纹过期（数据已变更）→ 标签降亮 */
  diagStale?: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', projId: string): void
  (e: 'toggleTask', taskId: string): void
  (e: 'taskGrade', taskId: string): void
  /** ★W12-C 补接线：全景泳道任务标题单击开任务详情抽屉（泳道 → 全景 → 树本体 openTaskDetail 两跳透传）。
   *  这条链路此前从未存在——泳道里任务标题只是个 div，点了没反应，W11-10 断言本轮重指时暴露。 */
  (e: 'openDetail', taskId: string): void
  /** V3.9.15：任务软删进回收站（泳道 → 全景 → 树本体） */
  (e: 'deleteTask', taskId: string): void
  (e: 'addTask', metricId: string, projId: string): void
  (e: 'openMetric', metricId: string): void
  (e: 'addMetric', projId: string): void
  (e: 'aiMetric', projId: string): void
  (e: 'bindOrphan', taskId: string, projId: string): void
  /* ★W12-E gotoDetail 随「📄 详情」一并退役（emit 声明不留：没人 emit 的死通道等于骗人）。
     /compass/projects 整页仍在，只是方向台两个视图不再把它当入口。 */
  (e: 'toTower', projId: string): void
  /** ★F1：泳道指标删除成功指标 */
  (e: 'delMetric', metricId: string): void
  /** ★F2：项目层模板导入（📋） */
  (e: 'importTemplate', projId: string): void
  /** ★F4：AI 诊断两态（无报告→跑；有报告→开中央弹窗） */
  (e: 'diagRun', projId: string): void
  (e: 'diagReport', projId: string): void
}>()

/** V3.9.12：「⋯」用一个本地开合态；点外部由 section 的 focusout 收口。 */
const moreOpen = ref(false)
const moreRoot = ref<HTMLElement | null>(null)
function onMoreFocusout(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || !moreRoot.value?.contains(next)) moreOpen.value = false
}

/** 选择条上的项目序列（扁平成一条，前端不再嵌套遍历） */
interface PickRow { proj: Project; pm: ProjectMeta; dir: Direction; hue: string; i: number }
const pickRows = computed<PickRow[]>(() => {
  const HUES = [88, 70, 52, 38, 26, 16]
  const out: PickRow[] = []
  for (const g of props.meta.dirs) {
    for (const pm of g.projects) {
      /* ProjectMeta 只存 id，回原树取实体（取数口径唯一仍在 compassMeta，这里只补类型信息） */
      const proj = g.dir.projects.find(dir => dir.id === pm.id)
      if (!proj) continue
      const k = out.length
      out.push({
        proj, pm, dir: g.dir,
        hue: `color-mix(in srgb, var(--accent) ${HUES[k % HUES.length]}%, var(--surface))`,
        i: g.projects.indexOf(pm)
      })
    }
  }
  return out
})

/** 当前聚焦项目（activeId 失效时兜底到第一个，避免空白屏） */
const current = computed<PickRow | null>(() => {
  const hit = pickRows.value.find(r => r.proj.id === props.activeId)
  return hit || pickRows.value[0] || null
})

/** 三段层级带的数字（全部吃集中取数，不现算 —— 判据 W11-5） */
const bandStats = computed(() => {
  const pm = current.value?.pm
  if (!pm) return null
  return {
    metrics: pm.metrics.length,
    allTasks: pm.metrics.reduce((s, m) => s + m.total, 0),
  }
})

const riskLabel = computed(() => {
  const n = current.value?.pm.risk || 0
  return n > 0 ? `断链 ${n}` : '链路完整'
})

/** 泳道总数 = 成功指标 + 可选收容道；收容道也吃同一套轨道宽度规则。 */
const laneCount = computed(() => {
  const c = current.value
  return c ? c.pm.metrics.length + (c.pm.orphanTasks.length ? 1 : 0) : 0
})
</script>

<template>
  <div class="pano" :style="{ '--hue': current?.hue || 'var(--accent)' }">
    <template v-if="current">
      <section class="pano-h" aria-label="当前项目摘要">
        <div class="ph-toolbar">
          <CompassPanoSwitch :rows="pickRows" :active-id="current.proj.id" @pick="emit('pick', $event)" @back="emit('toTower', current.proj.id)" />
          <div class="ph-toolbar-spacer"></div>
          <div class="ph-prog" :title="`项目级完成度 ${current.pm.pct}%（跨全部指标聚合）`">
            <span class="ph-prog-v">{{ current.pm.pct }}%</span>
            <span class="ph-prog-c">{{ current.pm.done }} / {{ current.pm.total }} 任务</span>
          </div>
          <div class="ph-acts">
            <button class="ph-act" title="在本项目下新建成功指标" @click="emit('addMetric', current.proj.id)">＋ 指标</button>
            <div ref="moreRoot" class="ph-more-wrap" @focusout="onMoreFocusout">
              <button class="ph-more" :class="{ on: moreOpen }" :aria-expanded="moreOpen" aria-haspopup="menu" title="更多项目操作" @click="moreOpen = !moreOpen">⋯</button>
              <div v-if="moreOpen" class="ph-menu" role="menu">
                <button class="ph-mi" role="menuitem" @click="moreOpen = false; emit('importTemplate', current.proj.id)">
                  <Icon name="filetext" :size="13"/> 导入模板
                </button>
                <button class="ph-mi" role="menuitem" @click="moreOpen = false; emit('aiMetric', current.proj.id)">
                  <Icon name="sparkle" :size="13"/> AI 建议指标
                </button>
                <CompassTowerStatus class="ph-diag" :proj-id="current.proj.id" :hue="current.hue"
                  :meta="current.pm" :diag="diag" :stale="diagStale"
                  @diag-run="(id) => { moreOpen = false; emit('diagRun', id) }"
                  @diag-report="(id) => { moreOpen = false; emit('diagReport', id) }"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="ph-b">
          <h3 class="ph-n">
            {{ current.proj.name }}
            <span v-if="current.proj.isFocused" class="ph-badge focus" title="主攻项目"><Icon name="main-focus" :size="13"/> 主攻</span>
            <span v-if="current.proj.pinned" class="ph-badge" title="已置顶"><Icon name="pin" :size="13"/> 置顶</span>
            <span v-if="current.pm.stall" class="ph-badge stall" title="近 14 天无推进/完成活动"><Icon name="warn" :size="13"/> 停滞 14 天+</span>
          </h3>
          <!-- 下一步是这一屏的主句；路径与层数降为脚注，不和项目名并列争夺行高。 -->
          <div class="ph-next" :class="current.pm.nextStepSource === 'empty' ? 'src-empty' : `src-${current.pm.nextStepSource}`">
            <span class="ph-next-l">下一步</span>
            <span class="ph-next-v" :title="current.pm.nextStep">{{ current.pm.nextStep }}</span>
            <span v-if="current.pm.nextStepSource === 'task'" class="ph-next-src">按任务推导</span>
          </div>
          <div class="ph-foot">
            <span>{{ current.dir.name }} › 第 4 层 攻坚项目</span>
            <span class="ph-sep" aria-hidden="true">/</span>
            <span>第 5 层 {{ bandStats?.metrics }} 指标</span>
            <span class="ph-sep" aria-hidden="true">/</span>
            <span>第 6 层 {{ bandStats?.allTasks }} 任务</span>
            <span class="ph-sep" aria-hidden="true">/</span>
            <span :class="{ bad: !!current.pm.risk }">{{ riskLabel }}</span>
          </div>
        </div>
      </section>

      <!-- ④ 横向泳道区：一根泳道 = 一条成功指标（组件化，见 CompassPanoLane） -->
      <div class="lanes-shell">
        <div
          class="lanes"
          :class="{
            'lanes-single': laneCount === 1,
            'lanes-multi': laneCount > 1 && laneCount <= 4,
            'lanes-scroll': laneCount > 4,
          }"
          :data-lane-count="laneCount"
          aria-label="项目指标泳道"
        >
          <CompassPanoLane v-for="(m, mi) in current.pm.metrics" :key="m.id"
            :m="m" :idx="mi + 1" :proj-id="current.proj.id"
            :single="laneCount === 1" :dense="laneCount > 1"
            @toggle-task="emit('toggleTask', $event)"
            @task-grade="emit('taskGrade', $event)"
            @open-detail="emit('openDetail', $event)"
            @delete-task="emit('deleteTask', $event)"
            @open-metric="emit('openMetric', $event)"
            @add-task="(mid, pid) => emit('addTask', mid, pid)"
            @del-metric="(mid) => emit('delMetric', mid)"
          />

          <!-- ★无归属收容泳道：在项目内但没挂任何成功指标的任务（判据 W11-8 钉它在泳道区最右侧） -->
          <section
            v-if="current.pm.orphanTasks.length"
            class="lane-orphan"
            :class="{ dense: laneCount > 1 }"
            aria-label="无归属任务收容"
          >
            <header class="lo-head">
              <div class="lo-top">
                <span class="lo-i">!</span>
                <span class="lo-n">无归属任务</span>
              </div>
              <div class="lo-note">在项目内，但<b class="bad">没挂任何成功指标</b></div>
            </header>
            <div class="lo-body">
              <div v-for="t in current.pm.orphanTasks" :key="t.id" class="lo-task">
                <div class="lo-task-t">{{ t.title }}</div>
                <div class="lo-task-b">
                  <span class="lo-tag lo-tag-clue"><Icon name="warn" :size="13"/> 缺指标归属</span>
                  <button class="lo-tag lo-tag-bind" @click="emit('bindOrphan', t.id, current.proj.id)">＋ 挂指标</button>
                  <button class="lo-del-task" title="删除任务（进回收站，可在回收站恢复）" aria-label="删除任务" @click="emit('deleteTask', t.id)"><Icon name="trash" :size="13"/></button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <span v-if="laneCount > 4" class="lanes-edge lanes-edge-r" aria-hidden="true"></span>
      </div>
      <div v-if="laneCount > 4" class="lanes-hint" role="note">
        <span class="lh-arrow" aria-hidden="true">↔</span>
        共 {{ laneCount }} 条泳道，横向滚动查看全部{{ current.pm.orphanTasks.length ? '；收容道固定在最后' : '' }}
      </div>
    </template>
  </div>
</template>

<style scoped>
/* V3.9.17：一条工具带 + 一段项目摘要，动作不抢标题行。 */
.pano-h {
  display: flex; flex-direction: column; gap: 10px; padding: 0 0 12px; margin-bottom: 12px;
  border-bottom: 1px solid var(--border-strong);
}
.ph-toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ph-toolbar-spacer { flex: 1; min-width: 8px; }
.ph-b { min-width: 0; }
.ph-n {
  margin: 0; font-size: var(--fs-title); font-weight: 700; letter-spacing: -.015em;
  display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; color: var(--text);
}
.ph-badge { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-2); padding: 1px 7px; border-radius: var(--radius-full); white-space: nowrap; }
.ph-badge.focus { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }
.ph-badge.stall { color: var(--warning); background: var(--warning-bg-soft); }
.ph-next {
  display: flex; align-items: baseline; gap: 7px; min-width: 0; margin-top: 6px; padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--hue) 55%, transparent);
}
.ph-next-l { flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); letter-spacing: .04em; }
.ph-next-v {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--fs-sub); font-weight: 600; color: var(--text);
}
.ph-next.src-empty .ph-next-v { color: var(--text-3); font-weight: 500; }
.ph-next-src { flex: none; font-size: var(--fs-tiny); color: var(--text-4); padding: 1px 6px; border-radius: var(--radius-full); background: var(--surface-2); }
.ph-foot {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 5px;
  font-size: var(--fs-tiny); color: var(--text-4);
}
.ph-foot .bad { color: var(--danger); font-weight: 600; }
.ph-sep { opacity: .55; }
.ph-prog { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.ph-prog-v { font-size: var(--fs-sub); font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
.ph-prog-c { font-size: var(--fs-tiny); color: var(--text-3); white-space: nowrap; }
.ph-acts { display: flex; align-items: center; gap: 5px; }
.ph-act {
  min-height: 28px;
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface-2); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--dur); white-space: nowrap; font-family: inherit;
}
.ph-act:hover { color: var(--accent-ink); border-color: var(--accent-light); background: var(--accent-light); }
.ph-more-wrap { position: relative; }
.ph-more {
  display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: transparent; color: var(--text-2); font-family: inherit;
  font-size: var(--fs-sub); cursor: pointer;
}
.ph-more:hover, .ph-more.on { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.ph-menu {
  position: absolute; right: 0; top: calc(100% + 5px); z-index: 30; width: 230px; padding: 5px;
  display: flex; flex-direction: column; gap: 2px; background: var(--surface);
  border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); }
.ph-mi {
  display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px; padding: 6px 8px;
  border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-2);
  font-family: inherit; font-size: var(--fs-sub); text-align: left; cursor: pointer;
}
.ph-mi:hover { background: var(--surface-2); color: var(--text); }
.ph-diag { padding: 4px 3px; border-top: 1px solid var(--border); margin-top: 2px; }

/* ── 泳道区（横向容器；泳道本体在 CompassPanoLane）── */
.lanes {
  /* ★V3.9.19（04-73 D-1(a) 密度接通）：泳道间距读 --card-gap（原 10px 字面量），紧凑档同步收拢；分档规则不动。 */
  padding: 0 2px 12px; display: flex; gap: var(--card-gap); align-items: stretch;
  min-height: 0; overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;
}
.lanes-shell { position: relative; }
/* 右侧边缘渐隐只在 5+ 泳道时出现，提示还有未展示的轨道。 */
.lanes-edge {
  position: absolute; top: 0; bottom: 16px; right: 2px; width: 28px;
  pointer-events: none; z-index: 2;
}
.lanes-edge-r { background: linear-gradient(270deg, var(--surface), transparent); }
/* 2–4 条时所有轨道（含收容道）严格等分；泳道本体与收容道都只吃轨道宽度，
   不再各自用 flex-grow 抢剩余空间。 */
.lanes-multi > .lane,
.lanes-multi > .lane-orphan {
  flex: 1 1 0; width: 0; min-width: 0;
}
/* 5 条以上：每根泳道保留 280px 可读下限，由容器统一横向滚动。 */
.lanes-scroll > .lane,
.lanes-scroll > .lane-orphan {
  flex: 0 0 280px; width: 280px; min-width: 280px;
}
.lanes-single > .lane,
.lanes-single > .lane-orphan {
  flex: 1 1 0; width: 100%; min-width: 0;
}
/* 滚动提示是结构提示，不是装饰：只有当轨道数超过 4 时才出现。
   使用非 sticky 的独立行，避免覆盖泳道底部操作。 */
.lanes-hint {
  display: flex; align-items: center; gap: 6px; margin-top: -6px; padding: 0 2px 2px;
  font-size: var(--fs-micro); color: var(--text-3);
}
.lh-arrow { color: var(--accent-ink); font-weight: 700; letter-spacing: -.08em; }

/* ── 收容泳道（留在本组件：它不属于任何指标，是项目级的第三态）──
   使用独立命名空间，不能复用 .lane：Vue 会把父组件的 scope id 透传到子组件根节点，
   父级 .lane 的固定宽度会覆盖 CompassPanoLane 的弹性宽度。 */
.lane-orphan {
  display: flex; flex-direction: column; min-width: 0;
  /* ★视觉聚焦：泳道去掉底色与阴影，但保留与板/舱同族的 lg 圆角（判据 C4-1） */
  background: transparent; border-radius: var(--radius-lg); overflow: hidden; max-height: 64vh;
  border: 1px solid var(--danger-border); border-left: 2px solid var(--danger);
}
.lo-head { padding: 13px 15px 12px; border-bottom: 1px solid var(--danger-border); background: transparent; flex: none; }
.lo-top { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lo-i {
  width: 17px; height: 17px; border-radius: 6px; display: grid; place-items: center;
  font-size: var(--fs-micro); font-weight: 700; flex: none; background: var(--danger-bg-soft); color: var(--danger);
}
.lo-n { font-size: var(--fs-sub); font-weight: 700; line-height: 1.45; flex: 1; min-width: 0; color: var(--text); }
.lo-note { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.65; margin-top: 5px; }
.lo-note b { color: var(--text-2); font-weight: 600; }
.lo-note .bad { color: var(--danger); }
.lo-body { padding: 9px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; min-height: 74px; }
.lo-task {
  position: relative; padding: 9px 10px 9px 11px; border-radius: 0; background: transparent;
  transition: all var(--dur); border-left: 2px solid var(--danger);
  border-bottom: 1px solid var(--border);
}
.lo-task-t {
  font-size: var(--fs-micro); font-weight: 500; line-height: 1.6; color: var(--text);
  min-width: 0; overflow-wrap: anywhere;
}
.lo-task-b { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.lo-tag { font-size: var(--fs-tiny); font-weight: 600; padding: 0 5px; border-radius: 3px; white-space: nowrap; }
.lo-tag-clue { color: var(--warning); background: var(--warning-bg-soft); }
.lo-tag-bind { min-height: 28px; padding: 4px 7px; border: 0; font-family: inherit; color: var(--accent-ink); background: var(--accent-light); cursor: pointer; }
.lo-del-task {
  display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0;
  border: 1px solid transparent; border-radius: 4px; background: transparent;
  color: var(--text-2); cursor: pointer; flex: none; opacity: .55; transition: all var(--dur);
}
.lo-del-task:hover, .lo-del-task:focus-visible { opacity: 1; color: var(--danger); background: var(--danger-bg-soft); }

@media (max-width: 800px) {
  .pano-h { gap: 9px; }
  .ph-toolbar { flex-wrap: wrap; }
  .ph-toolbar-spacer { flex-basis: 100%; }
  .ph-acts { flex-wrap: wrap; }
}
@media (max-width: 480px) {
  .pano-h { padding-bottom: 12px; }
  .ph-b { width: 100%; }
  .ph-next { align-items: flex-start; }
  .ph-next-src { display: none; }
  .lanes-scroll > .lane,
  .lanes-scroll > .lane-orphan {
    flex-basis: min(86vw, 320px);
    width: min(86vw, 320px);
    min-width: min(86vw, 320px);
  }
}
</style>
