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
 * ★组件边界：本组件只管「选谁 / 主体是谁」（选择条 + 项目头 + 层级带 + 收容道），
 * 一根根泳道交给 CompassPanoLane。两块各自独立可判 —— 改导航样式不会把内容判据一起拖红。
 *
 * 焦点纪律：★不得出现 font-size: var(--fs-display) / var(--fs-hero)（判据 W11-11 负锚）。
 * 项目名 --fs-title(15px)，主角感由横向铺开与留白承担。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { Direction, Project } from '@/shared/models'
import type { CompassMeta, ProjectMeta } from '../../views/compassMeta'
import CompassPanoLane from './CompassPanoLane.vue'
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
  const withTasks = pm.metrics.filter(m => m.total > 0).length
  const zero = pm.metrics.filter(m => m.orphanMetric).length
  const allTasks = pm.metrics.reduce((s, m) => s + m.total, 0)
  const doneTasks = pm.metrics.reduce((s, m) => s + m.done, 0)
  return { metrics: pm.metrics.length, withTasks, zero, allTasks, doneTasks, pending: allTasks - doneTasks }
})

const ringR = 21
const ringC = 2 * Math.PI * ringR
</script>

<template>
  <div class="pano" :style="{ '--hue': current?.hue || 'var(--accent)' }">
    <!-- ① 项目选择条：全景的入口。★双向可达 —— 点条上任一项目即换主体，不设"必须先选"的门槛 -->
    <section class="pano-pick" aria-label="选择要横向展开的项目">
      <div class="pp-t">选择项目 · 横向看全它的一条链</div>
      <div class="pp-row">
        <button
          v-for="r in pickRows" :key="r.proj.id"
          class="pp" :class="{ on: current?.proj.id === r.proj.id }"
          :style="{ '--pc': r.hue }"
          :title="`${r.dir.name} › ${r.proj.name} · ${r.pm.metrics.length} 指标 · ${r.pm.total} 任务`"
          @click="emit('pick', r.proj.id)"
        >
          <span class="pp-n">{{ r.i + 1 }} {{ r.proj.name }}</span>
          <span class="pp-m">
            {{ r.pm.metrics.length }} 指标 · {{ r.pm.total }} 任务<template v-if="r.proj.isFocused"> · <Icon name="main-focus" :size="13"/></template>
          </span>
        </button>
        <div v-if="!pickRows.length" class="pp-empty">还没有攻坚项目 —— 先在项目塔里添加一个</div>
      </div>
    </section>

    <template v-if="current">
      <!-- ② 项目头：名 + 徽标 + 归属路径 + 完成度 + 四个动作 -->
      <section class="pano-h">
        <span class="ph-i" aria-hidden="true">{{ current.i + 1 }}</span>
        <div class="ph-b">
          <h3 class="ph-n">
            {{ current.proj.name }}
            <span v-if="current.proj.isFocused" class="ph-badge focus" title="主攻项目"><Icon name="main-focus" :size="13"/> 主攻</span>
            <span v-if="current.proj.pinned" class="ph-badge" title="已置顶"><Icon name="pin" :size="13"/> 置顶</span>
            <span v-if="current.pm.stall" class="ph-badge stall" title="近 14 天无推进/完成活动"><Icon name="warn" :size="13"/> 停滞 14 天+</span>
          </h3>
          <!-- ★归属路径：全景里最容易丢的就是"这个项目的指标从哪来"，所以路径常驻不折叠 -->
          <nav class="ph-c">
            <span>{{ current.dir.name }}</span><span class="ph-sep">›</span>
            <b>第 4 层 · 攻坚项目</b><span class="ph-sep">›</span>
            <span>{{ bandStats?.metrics }} 条成功指标 · {{ bandStats?.allTasks }} 条任务</span>
            <button class="ph-link" title="回到项目塔里看它与其它项目的对比" @click="emit('toTower', current.proj.id)"><Icon name="arrowupdown" :size="13"/> 回项目塔</button>
          </nav>
          <!-- 与项目塔同源：nextStep 由 compassMeta 统一解析，全景不另算一套 -->
          <div class="ph-next" :class="current.pm.nextStepSource === 'empty' ? 'src-empty' : `src-${current.pm.nextStepSource}`">
            <span class="ph-next-l">下一步</span>
            <span class="ph-next-v" :title="current.pm.nextStep">{{ current.pm.nextStep }}</span>
            <span v-if="current.pm.nextStepSource === 'task'" class="ph-next-src">按任务推导</span>
          </div>
        </div>
        <div class="ph-r">
          <div class="ph-prog" :title="`项目级完成度 ${current.pm.pct}%（跨全部指标聚合）`">
            <div class="ph-ring">
              <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
                <circle cx="24" cy="24" :r="ringR" fill="none" stroke="var(--surface-3)" stroke-width="3.5" />
                <circle
                  cx="24" cy="24" :r="ringR" fill="none"
                  stroke="var(--hue)" stroke-width="3.5" stroke-linecap="round"
                  :stroke-dasharray="ringC" :stroke-dashoffset="ringC * (1 - current.pm.pct / 100)"
                />
              </svg>
              <span class="ph-ring-v">{{ current.pm.pct }}%</span>
            </div>
            <div class="ph-num">
              <b>{{ current.pm.done }} / {{ current.pm.total }}</b> 任务完成
              <span>{{ bandStats?.metrics }} 条指标 · {{ current.pm.risk ? `${current.pm.risk} 处断链` : '链路完整' }}</span>
            </div>
          </div>
          <div class="ph-acts">
            <button v-if="current.pm.risk > 0" class="ph-act risk" :title="`${current.pm.risk} 处断链：缺任务指标 + 无归属任务`"><Icon name="warn" :size="13"/> 断链 {{ current.pm.risk }}</button>
            <!-- ★F2：项目层模板导入（📋 与战略目标行同构）——粘贴 # 成功指标 / ## 任务 一次生成 -->
            <button class="ph-act" title="导入模板：粘贴 Markdown，按「# 成功指标 / ## 任务」批量生成本项目的指标与任务" @click="emit('importTemplate', current.proj.id)"><Icon name="filetext" :size="13"/> 导入模板</button>
            <button class="ph-act" title="在本项目下新建成功指标" @click="emit('addMetric', current.proj.id)">＋ 指标</button>
            <button class="ph-act ai" title=" AI 依使命与本项目建议成功指标（查重后采纳才创建）" @click="emit('aiMetric', current.proj.id)"><Icon name="sparkle" :size="13"/> AI 建议指标</button>
            <!-- ★F4：AI 诊断两态入口 —— 与项目塔舱头 CompassTowerStatus 同一套交互（复用同一组件）：
                 无报告 → 虚线「🧠 AI 诊断」点击才跑；有报告 → 标签组 + 「📄 诊断报告」开中央弹窗。
                 手动触发红线不破：从不自动跑、不预生成。 -->
            <CompassTowerStatus
              class="ph-diag"
              :proj-id="current.proj.id"
              :hue="current.hue"
              :meta="current.pm"
              :diag="diag"
              :stale="diagStale"
              @diag-run="(id) => emit('diagRun', id)"
              @diag-report="(id) => emit('diagReport', id)"
            />
            <!-- ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：这枚「📄 详情」与项目塔
                 舱内菜单、页头那枚同属"进项目详情"的入口，四个视图已能就地看全，一并退役。 -->
          </div>
        </div>
      </section>

      <!-- ③ 层级带（F3 单行化）：从属引导降为一行面包屑 —— 原三段竖排色块实测 85–90px，
           夺走下方泳道的视觉焦点；现压成恒高约 30px 的单行，只保留「层 + 计数」。
           三段副文案（"1个攻坚项目·本次全景的主体"等）全砍：这些数字在项目头进度环与泳道里
           都有第二来源，不值得再占一整行。 -->
      <section v-if="bandStats" class="band" aria-label="三层从属">
        <span class="bd-seg"><i>第 4 层</i> PROJECT</span>
        <span class="bd-sep" aria-hidden="true">›</span>
        <span class="bd-seg"><i>第 5 层</i> METRIC <b>{{ bandStats.metrics }}</b> 条指标</span>
        <span class="bd-sep" aria-hidden="true">›</span>
        <span class="bd-seg"><i>第 6 层</i> TASK <b>{{ bandStats.allTasks }}</b> 条任务</span>
      </section>

      <!-- ④ 横向泳道区：一根泳道 = 一条成功指标（组件化，见 CompassPanoLane） -->
      <div class="lanes">
        <CompassPanoLane
          v-for="(m, mi) in current.pm.metrics"
          :key="m.id"
          :m="m"
          :idx="mi + 1"
          :proj-id="current.proj.id"
          @toggle-task="emit('toggleTask', $event)"
          @task-grade="emit('taskGrade', $event)"
          @open-detail="emit('openDetail', $event)"
          @open-metric="emit('openMetric', $event)"
          @add-task="(mid, pid) => emit('addTask', mid, pid)"
          @del-metric="(mid) => emit('delMetric', mid)"
        />

        <!-- ★无归属收容泳道：在项目内但没挂任何成功指标的任务（判据 W11-8 钉它在泳道区最右侧） -->
        <section v-if="current.pm.orphanTasks.length" class="lane orph" aria-label="无归属任务收容">
          <header class="lane-h">
            <div class="lane-top">
              <span class="lane-i">!</span>
              <span class="lane-n">无归属任务</span>
            </div>
            <div class="lane-acc">在项目内，但<b class="bad">没挂任何成功指标</b></div>
          </header>
          <div class="lane-b">
            <div v-for="t in current.pm.orphanTasks" :key="t.id" class="ltask orph">
              <div class="ltask-t">{{ t.title }}</div>
              <div class="ltask-b">
                <span class="lb lb-clue"><Icon name="warn" :size="13"/> 缺指标归属</span>
                <button class="lb lb-bind" @click="emit('bindOrphan', t.id, current.proj.id)">＋ 挂指标</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ★视觉聚焦（与项目塔同一把尺子）：全景的导航与内容都改发丝线分节，不再各套一张卡 ——
   四层容器都带底色+边框+阴影时，首屏先读到的是框，而不是"推进到哪、哪条指标缺动作"。 */
/* ── 项目选择条 ── */
.pano-pick {
  background: transparent; border-radius: 0;
  border: 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  padding: 11px 0; margin-bottom: 18px;
}
.pp-t { font-size: var(--fs-micro); font-weight: 700; letter-spacing: .11em; color: var(--text-4); margin-bottom: 9px; }
.pp-row { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 3px; }
.pp-empty { font-size: var(--fs-micro); color: var(--text-4); padding: 8px 2px; }
.pp {
  position: relative; flex: 0 0 auto; padding: 7px 12px 7px 14px;
  /* 未选中的项目退回"纯文本条目"：只有左侧色条与名字，不再是一块带底的卡。
     一屏六七个项目时，底色块会把"选谁"这件事变成看色块而不是读项目名。
     ★必须显式 border: 0 —— button 默认边框在透明底上会露出一圈黑框。 */
  border: 0; border-radius: 0; background: transparent;
  cursor: pointer; transition: all var(--dur); min-width: 132px; text-align: left;
}
.pp::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: var(--pc); opacity: .45; }
.pp:hover { background: color-mix(in srgb, var(--surface) 60%, transparent); }
.pp:hover::before { opacity: .8; }
/* 选中态 = 色轨加粗 + 文字提亮，不再铺一层底色（与左栏项目导航同一套标记语言） */
.pp.on { background: transparent; box-shadow: none; }
.pp.on::before { opacity: 1; width: 4px; }
.pp-n {
  display: block; font-size: var(--fs-sub); font-weight: 700; line-height: 1.4;
  white-space: nowrap; max-width: 190px; overflow: hidden; text-overflow: ellipsis; color: var(--text);
}
.pp-m { display: block; font-size: var(--fs-micro); color: var(--text-4); margin-top: 3px; font-weight: 600; }

/* ── 项目头 ── */
.pano-h {
  display: flex; align-items: center; gap: 16px; padding: 16px 0 18px;
  border-radius: 0; background: transparent;
  border: 0; border-bottom: 1px solid var(--border-strong);
  margin-bottom: 14px; flex-wrap: wrap;
}
.ph-i {
  width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
  font-size: var(--fs-title); font-weight: 700; flex: none;
  /* 序号是刻度不是印章：舱的身份由左侧色条承担，这里不再用彩色底 */
  background: var(--surface-2); color: var(--text-3);
}
.ph-b { flex: 1; min-width: 240px; }
/* ★项目名 --fs-title(15px)：与指标 --fs-sub(12px) 拉开一档，不抢焦点（愿景才是 display） */
.ph-n { margin: 0; font-size: var(--fs-title); font-weight: 700; letter-spacing: -.015em; display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; color: var(--text); }
.ph-badge { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-2); padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.ph-badge.focus { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }
.ph-badge.stall { color: var(--warning); background: var(--warning-bg-soft); }
.ph-c { font-size: var(--fs-micro); color: var(--text-4); margin-top: 5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ph-c b { color: var(--text-2); }
.ph-sep { opacity: .6; }
.ph-link { font-size: var(--fs-micro); color: var(--accent-ink); cursor: pointer; font-weight: 600; }
.ph-link:hover { text-decoration: underline; }
.ph-next {
  display: flex; align-items: center; gap: 7px; min-width: 0;
  margin-top: 8px; padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--hue) 52%, transparent);
}
.ph-next-l { flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); letter-spacing: .04em; }
.ph-next-v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-caption); font-weight: 600; color: var(--text-2); }
.ph-next.src-empty .ph-next-v { color: var(--text-3); font-weight: 500; }
.ph-next-src { flex: none; font-size: var(--fs-tiny); color: var(--text-4); padding: 1px 6px; border-radius: 999px; background: var(--surface-2); }

.ph-r { display: flex; align-items: center; gap: 20px; flex: none; }
.ph-prog { display: flex; align-items: center; gap: 9px; }
.ph-ring { position: relative; width: 42px; height: 42px; flex: none; }
.ph-ring-v {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-micro); font-weight: 700; color: var(--text-2);
}
.ph-num { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.55; }
.ph-num b { color: var(--text-2); font-variant-numeric: tabular-nums; display: block; }
.ph-num span { display: block; }
.ph-acts { display: flex; gap: 6px; }
.ph-act {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface-2); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 999px; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.ph-act:hover { color: var(--accent-ink); border-color: var(--accent-light); background: var(--accent-light); }
.ph-act.risk { color: var(--danger); background: var(--danger-bg-soft); border-color: var(--danger-border); }
.ph-act.ai { color: var(--accent-ink); background: var(--accent-light); border-color: transparent; }

/* ── 层级带（F3 单行面包屑）── */
/* 恒高单行：层名小字 + 计数强调。★视觉聚焦：去底色与边框，只留一条细分隔线，
   它是"路牌"不是"招牌"—— 原来那层淡色底让它和下面的泳道抢同一层注意力。 */
.band {
  display: flex; align-items: center; gap: 8px;
  padding: 0 0 9px; margin-bottom: 14px;
  border-radius: 0;
  background: transparent;
  border: 0; border-bottom: 1px solid var(--border);
  font-size: var(--fs-micro); color: var(--text-3); white-space: nowrap;
}
.bd-seg { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; letter-spacing: .04em; }
.bd-seg i { font-style: normal; color: var(--text-4); font-weight: 700; }
.bd-seg b { font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
.bd-sep { color: var(--text-4); opacity: .7; }

/* ── 泳道区（横向容器；泳道本体在 CompassPanoLane）── */
.lanes { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 16px; align-items: flex-start; }

/* ── 收容泳道（留在本组件：它不属于任何指标，是项目级的第三态）── */
.lane {
  flex: 0 0 262px; display: flex; flex-direction: column;
  /* ★视觉聚焦：泳道去掉底色与阴影，但保留与板/舱同族的 lg 圆角（判据 C4-1） */
  background: transparent; border-radius: var(--radius-lg);
  border: 1px solid var(--border); overflow: hidden; max-height: 64vh;
}
.lane.orph { border: 1px solid var(--danger-border); border-left: 2px solid var(--danger); background: transparent; }
.lane-h { padding: 13px 15px 12px; border-bottom: 1px solid var(--border); background: transparent; flex: none; }
.lane.orph .lane-h { background: transparent; border-bottom-color: var(--danger-border); }
.lane-top { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lane-i {
  width: 17px; height: 17px; border-radius: 6px; display: grid; place-items: center;
  font-size: var(--fs-micro); font-weight: 700; flex: none;
  background: var(--danger-bg-soft); color: var(--danger);
}
.lane-n { font-size: var(--fs-sub); font-weight: 700; line-height: 1.45; flex: 1; min-width: 0; color: var(--text); }
.lane-acc { font-size: var(--fs-micro); color: var(--text-3); line-height: 1.65; margin-top: 5px; }
.lane-acc b { color: var(--text-2); font-weight: 600; }
.lane-acc .bad { color: var(--danger); }
.lane-b { padding: 9px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; min-height: 74px; }
.ltask {
  position: relative; padding: 9px 10px 9px 11px; border-radius: 0;
  background: transparent; transition: all var(--dur); border-left: 2px solid var(--danger);
  border-bottom: 1px solid var(--border);
}
.ltask-t { font-size: var(--fs-micro); font-weight: 500; line-height: 1.6; color: var(--text); }
.ltask-b { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.lb { font-size: var(--fs-micro); font-weight: 600; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
.lb-clue { color: var(--warning); background: var(--warning-bg-soft); }
.lb-bind { color: var(--accent-ink); background: var(--accent-light); cursor: pointer; }

@media (max-width: 800px) {
  .pano-h { align-items: flex-start; padding: 14px 16px; gap: 12px; }
  .ph-r { width: 100%; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .ph-acts { flex-wrap: wrap; }
  .band { overflow-x: auto; }
}
@media (max-width: 480px) {
  .pano-pick { padding: 10px 12px; }
  .pano-h { padding: 12px 14px; }
  .ph-b { min-width: 0; width: 100%; }
  .ph-i { width: 34px; height: 34px; }
  .ph-num { display: none; }
  .ph-next { align-items: flex-start; }
  .ph-next-src { display: none; }
  .lane { flex-basis: min(82vw, 262px); }
}
</style>
