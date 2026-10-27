<script setup lang="ts">

// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'CompassTreeView' })
import Icon from '@/shared/components/Icon.vue'
import '../components/compass/hotzone.css'
import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { wsNameById } from '@/shared/utils/wsName'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { K } from '@/shared/storage/keys'
import { matchPinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { toOpenableRawLink, toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { compassNodeCounts, removeCompassNode, restoreCompassNode, removeMetricWithConfirm, type CompassNodeKind } from '@/shared/utils/compassCrud'
import { useConfirm } from '@/shared/components/confirm'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { taskMaturity, metricMaturity, projectMaturity, directionMaturity } from '@/shared/utils/maturity'
import { recordResourceOpen } from '@/shared/storage/stats'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import MetricDetailDrawer from '../components/compass/MetricDetailDrawer.vue'
import CompassSpine from '../components/compass/CompassSpine.vue'
import CompassLayerPanel from '../components/compass/CompassLayerPanel.vue'
import CompassLayerList from '../components/compass/CompassLayerList.vue'
import CompassTower from '../components/compass/CompassTower.vue'
import CompassPano from '../components/compass/CompassPano.vue'
import { buildCompassMeta } from './compassMeta'
import type { ProjectMeta } from './compassMeta'
import ImportTemplateModal from '../components/ImportTemplateModal.vue'
import DirectionFormModal from '../components/compass/DirectionFormModal.vue'
import CompassRiskModal, { type RiskProjectGroup } from '../components/compass/CompassRiskModal.vue'
import type { GoalParseResult } from '@/shared/utils/mdImport'
import { useProjectDiag } from '../composables/useProjectDiag'
import { onOpenDrawer } from '@/shared/utils/bus'
import { useCompassTree } from './useCompassTree'
const {
  router, route, store, d, visionText,
  missionText, allProjects, projectProgress, toggleFocusProject, addProjectToDir,
  isProjectDone, isProjectStalled, showDone, toggleShowDone, AiDrawer,
  aiJob, aiPersonaId, aiChainLast, aiChain, ProjectDiagnoseModal,
  diagFor, diagStale, startProjectDiag, openDiagReport, rerunDiag,
  diagOpen, diagProjId, diagReport, fromProjId, fromProjName,
  goBack, locateHlGoal, onPageEsc, expandedMetrics, PROJ_FOLD_KEY,
  readProjFold, projFoldOverride, writeProjFold, projOpen, expandMetricsOf,
  toggleProjectFold, expandMetricsOfOpenProjects, visibleProjectsForBulk, expandAllNodes, collapseAllNodes,
  allExpanded, toggleAllNodes, projMenu, toggleProjMenu, closeProjMenu,
  onDocClickCloseProjMenu, dragProj, dropTargetId, onProjDragStart, onProjDragOver,
  onProjDragLeave, onProjDragEnd, onProjDrop, toggleProjectPin, visibleProjectsOf,
  treeStats, projMeta, compassMeta, viewMode, panoId,
  openPano, panoEffectiveId, backToTower, dirFilter, layerOpen,
  layerView, riskOnly, dirFilterName, clearFilters, HUES,
  hueAt, towerGroups, focusTower, gotoFocusTower, findProject,
  findMetric, layerRows3, layerRows5, layerRows6, onLayerOpen,
  onLayerList, onLocateLayer, spineRef, heroToSpine, locateCompassTarget,
  flashLocated, locationTaskPool, onListLocate, onListEditDir, onDirFilter,
  toggleRiskOnly, gotoOrphans, riskOpen, riskGroups, showRiskReport,
  showTaskGrade, bindOrphan, toggleMetric, editingField, focusEditField,
  startEdit, saveEdit, cancelEdit, directionForm, openDirectionCreate,
  openDirectionEdit, saveDirectionForm, addProject, goalImport, openGoalImport,
  confirmGoalImport, projImport, openProjImport, confirmProjImport, onToggleFocus,
  addMetric, delMetricById, taskAdd, openTaskAdd, detailRef,
  onTaskCreated, openTaskDetail, metricDetailId, metricDetailOpen, openMetricDetail,
  taskAddMetricTitle, toggleTask, NODE_KIND, nodeNameOf, deleteNode,
  unbindTask, unbindTaskById, isStagnant, activeTowerId, gotoTower,
  activeLayer, canvasEl, ensureTower, onCanvasScroll, dhiStatus,
  pinyinOn, linkModal, linkQ, toggleLinkPop, closeLinkModal,
  linkIds, linkCount, isLinked, toggleLinked, resTitle,
  curioTitle, peek, openChipLink, peekData, openPeekLink,
  linkCandidates, projDrawerOpen, projDrawerId, openProjectDrawer, unsubProjDrawer,
  scrollParent,
} = useCompassTree()
</script>

<template>
  <div class="compass-layout" :class="{ 'is-pano': viewMode === 'pano' }">
    <!-- ══ W12 HERO 区（V3.8.22 F6 收口）：上=动作行（视图切换主焦点 + 两枚常驻开关），下=读数行（左对齐） ══
         ★V3.8.20（用户拍板 2026-10-15）：左上标题文案区（.hero-l：面包屑/眉标/大标题/副标 + N4 就地编辑）
         整块退役 —— 方向台是工作台面不是宣传页，首屏直接给「动作 + 状态」；定调语由骨架条
         .spine-h「战略骨架 · 上层定方向 · 下层见动作」承担，不摆两处。
         健康度徽章并入读数行首位（原在左栏标题下，N13 的意图是"状态不参与动作区竞争"，
          挪到读数行同样满足 —— 它与计数同属"这页现在什么状况"）。
          ★F6（2026-10-16 二次翻转）：「全部展开/收起」「👁 已完成」恢复动作行常驻，⚙ 下拉整壳退役。
          ★fromProjId / goBack / Esc 返回保留（R54-A1 深链来路感知），来路文本随行显示。 -->
    <section class="hero" aria-label="方向台状态与操作">
      <div class="hero-acts">
        <!-- ★V3.9.7：项目塔 / 项目全景的选择已移到下方项目模块。页头只保留全页级别操作。 -->
        <span v-if="fromProjName" class="hero-from">来自项目「{{ fromProjName }}」</span>
        <!-- ★C2（V3.8.33 B5-c）：筛选态提示条从画布内提到这里，压成 hero 动作行里的一枚胶囊。
             病根＝它原来横在引导条与项目舱之间，把树区从中间拦了一刀；而它本质是"当前视图正被什么收窄"，
             属于页头状态，不属于树内容。移走后树区从引导条到舱列一路连续，主角面才立得住。
             能力一件不少：只要任一筛选开着就常驻（隐形筛选会让人以为项目丢了），命中数照旧，清除出口照旧（W11-9）。 -->
        <div v-if="dirFilter || riskOnly" class="hero-filter" role="status">
          <span class="hf-t">
            <template v-if="dirFilter">只看战略目标「{{ dirFilterName }}」</template>
            <template v-if="dirFilter && riskOnly"> · </template>
            <template v-if="riskOnly"><Icon name="warn" :size="12"/> 只看断链</template>
          </span>
          <span class="hf-n">命中 {{ towerGroups.length }} 个目标 · {{ towerGroups.reduce((s, g) => s + g.projs.length, 0) }} 个项目舱</span>
          <button class="hf-clear" title="清除全部筛选，恢复完整视图" @click="clearFilters"><Icon name="x" :size="12"/> 清除筛选</button>
        </div>
        <!-- ★V3.9.15（用户 2026-10-23 拍板）：读数并入动作行，页头只占一条状态带。
           ★V3.9.19（用户 2026-10-24 拍板，一处不两说）：六层结构读数（愿景/使命/战略目标/项目/指标/任务）
           整体迁出页头 —— 它们与紧贴其下的战略骨架条是同一笔账，报两处就是两份真相
           （且两处口径不同：hero 走可见项目、骨架条走全量账，数字还会打架）。
           页头只留骨架条不说的「状态」：健康度 + 主攻 + 停滞（可见口径）；六层计数走下方下钻入口。
           ★顺序与原型一致：读数先行（状态是这页的第一个判断，视线落点上），两枚工具钮靠右收尾。 -->
        <div class="hero-stats">
        <!-- ★C1（V3.8.28）：每个读数都要能悬停看到口径 —— 镜面不评价，但必须说清这个数字怎么来的
             （A2 同一口径：数值 + 单位 + 口径 tooltip）。 -->
        <span class="dhi-badge" :class="dhiStatus.cls"
          title="方向健康度 = 未停滞的战略目标数 ÷ 战略目标总数（某个目标下最近一次任务更新距今超过 14 天，记为停滞）· 只描述现状，不是评分">
          <span aria-hidden="true"><Icon name="compass" :size="13"/></span>
          <span>方向健康度：{{ dhiStatus.label }}</span>
        </span>
        <i class="hs-sep" aria-hidden="true"></i>
        <span title="主攻 = 标记为战略重心的可见项目数（上限 2 个）· 骨架条计数是全量账，此处是可见口径，两者各说各话不冒充同源"><Icon name="main-focus" :size="13"/> 主攻 {{ treeStats.focused }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="停滞 = 近 14 天无任务推进、且已有任务的可见项目数 · 中性读数，不催办"><Icon name="stall" :size="13"/> 停滞 {{ treeStats.stalled }}</span>
        <button class="hs-spine" type="button" title="六层结构计数（愿景→任务）只在战略骨架条读一处，页头不重复报数 · 点击展开骨架条并打开第 1 层（愿景原文）" @click="heroToSpine">六层计数 · 战略骨架 <span aria-hidden="true">▾</span></button>
        </div>
        <div class="hero-tools">
          <!-- ★F6 翻转（用户拍板 2026-10-16，二次翻转 V3.8.20 N11 收纳决策）：「↕ 展开/收起」「👁 已完成」
               从 ⚙ 工具下拉恢复为动作行常驻按钮——高频操作变两跳 + 状态开关藏菜单后当前状态不可见。
               视图切换仍是实底唯一主焦点（N10 不撤销），两枚为次级 tree-tool 形态；⚙ 下拉整壳退役。
               ★V3.8.18（N11）语义保留：反向开关自带当前状态，点一次反向，正反都可达（不做单向门）。
               ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：「← 返回项目详情」按钮退役，
               但 fromProjId / goBack / Esc 返回**保留**——那是「从项目详情深链进来后按 Esc 送回原处」的
               来路感知（R54-A1），不是"进项目详情"的入口，两者语义不同。 -->
          <button class="tree-tool"
            :title="allExpanded ? '当前：全部展开。点击收起全部战略目标与指标' : '当前：默认收起。点击展开全部层级'" @click="toggleAllNodes"><Icon name="arrowupdown" :size="13"/> {{ allExpanded ? '全部收起' : '全部展开' }}</button>
          <button class="tree-tool" :class="{ off: !showDone }" @click="toggleShowDone"
            title="与方向台页头同一开关（同一偏好，一处切换全台生效）"><Icon name="eye" :size="13"/> 已完成项目：{{ showDone ? '显示' : '隐藏' }}</button>
        </div>
      </div>
    </section>

    <!-- ══ ★V3.8.18（N14）战略骨架条提到全宽 ══
         原型首屏顺序是「战略骨架在上 → 下方才是左右结构」；实际实现把骨架条塞在右列
         （.canvas-inner）里，于是左导航与骨架条**并排起排**，左栏那 210px 从骨架条高度
         就开始往下悬着、下面全空。本次把骨架条从右列抽出来横跨整个内容宽度单独成条 ——
         它是「这一页的地图」，本就不该被当成右列里的一个区块；下方 .tree-layout 才是「左导航 + 右内容」。
         ★能力一项未少：六层按钮 / 目标芯片 / 断链行与 @locate 定位逻辑原封不动，
         只是挂载点从右列换到全宽条；定位滚动仍作用于 .canvas（onLocateLayer 走 canvasEl）。
         ★W12-2 判据「骨架条在层级面板之前」依然成立（全宽条仍在 .canvas-inner 之前）。 -->
    <div class="spine-bar">
      <CompassSpine
        ref="spineRef"
        :meta="compassMeta"
        :dir-filter="dirFilter"
        :layer-open="layerOpen"
        :layer-view="layerView"
        :risk-only="riskOnly"
        @layer="onLayerOpen"
        @list="onLayerList"
        @locate="onLocateLayer"
        @dir="onDirFilter"
        @risk="toggleRiskOnly"
        @orphan="gotoOrphans"
        @risk-bar="showRiskReport"
      >
        <!-- ★V3.8.18（N12）：「＋战略目标」「建议目标」落到骨架条第 3 层旁边。
             它们本来就是第 3 层的操作，此前摆在一排全局按钮里，用户得先跨过视图切换才够得到。 -->
        <template #actions>
          <button class="tree-tool accent" @click="openDirectionCreate" title="添加战略目标">＋ 战略目标</button>
          <span class="node-action ai-chain-act" v-pressable title="AI 依愿景/使命建议本阶段战略目标（同层查重后采纳才创建）" @click="aiChain('directions', '')"><AiEntryButton variant="inline" label="建议目标" /></span>
        </template>
      </CompassSpine>
    </div>

    <!-- ══ 视觉聚焦条（方向台优化）：把"当前主攻 / 推进到哪 / 下一步"收成一条摘要 ══
         为什么加：原首屏把注意力先给了页头读数与六层导航，真正要动手的项目要往下滚才看得见。
         这条不是新模块，而是项目塔里那个主攻项目的一行投影 —— 数据全部取自 towerGroups，
         点击直接定位到对应舱，与左栏项目导航是同一个 gotoTower 入口（不新增第二条路）。 -->
    <section v-if="focusTower && viewMode === 'tower' && !layerView" class="focus-strip" aria-label="当前主攻">
      <span class="fs-label">{{ focusTower.proj.isFocused ? '当前主攻' : '当前项目' }}</span>
      <button class="fs-name" :title="`定位到项目舱：${focusTower.proj.name}`" @click="gotoFocusTower">{{ focusTower.proj.name }}</button>
      <span class="fs-detail">{{ focusTower.dir.name }} · {{ focusTower.meta.metrics.length }} 指标 · {{ focusTower.meta.total }} 任务</span>
      <span class="fs-progress" aria-hidden="true"><i :style="{ width: focusTower.meta.pct + '%' }" /></span>
      <span class="fs-count">{{ focusTower.meta.done }} / {{ focusTower.meta.total }} 项任务</span>
      <!-- ★V3.9.19（原型同款 · 与调度台 V3.9.18 主攻面板同源）：聚焦条补「下一步」主句 ——
           方向台首屏此前只有进度没有去向。数据吃 compassMeta 的 nextStep（用户填写 → 进行中任务 →
           空态兜底），与项目详情/项目舱 CompassTowerNext 同一解析源，不另写回退。 -->
      <span class="fs-next" :title="`下一步为项目一等公民：你填写的优先，清空后按任务自动推导（与项目详情同源）· 当前来源：${focusTower.meta.nextStepSource === 'manual' ? '手动填写' : focusTower.meta.nextStepSource === 'task' ? '由最优先任务推导' : '空态兜底'}`">下一步 · {{ focusTower.meta.nextStep }}</span>
      <button class="fs-go" @click="gotoFocusTower">继续推进 ↓</button>
    </section>

    <!-- 画布：左栏 = 项目导航（原型 .navside，吸顶常驻），右侧 = 项目塔 -->
    <div class="tree-layout" :class="{ 'is-pano': viewMode === 'pano' }">
      <!-- ★W12：左栏由「六层数字目录」改为「项目导航」。
           病根＝六层目录是 1~6 的纯数字，看不出层级关系；而原型的 .navside 是**项目清单**
           （序号 + 项目名 + 指标/任务数），滚动时自动跟随当前视野所在项目。
           六层定位能力没有丢——它本来就由骨架条的 1~6 按钮承担（点 4/5/6 定位、点 1/2/3 展开面板），
           左栏只是把同一件事重复了一遍。滚动联动从"层高亮"改为"舱高亮"。 -->
      <aside class="navside">
        <div class="ns-t">项目塔 {{ towerGroups.reduce((s, g) => s + g.projs.length, 0) }} 个舱</div>
        <!-- ★V3.9.19：视图切换随引导条退役从画布顶迁到左栏首行（原型 .navside 顶部）。
             仍是这一页的第一个决策：左栏是「我在哪」的入口列，项目塔/全景都从这里出发；
             全景模式下左栏隐藏，返回走全景自己的「⇅ 回项目塔」（不新增第二条路）。 -->
        <div class="view-seg" role="tablist" aria-label="项目视图形态">
          <button class="vs-b" :class="{ on: viewMode === 'tower' }" :aria-selected="viewMode === 'tower'" title="纵向项目舱列 · 看我在哪个位置" @click="viewMode = 'tower'; layerView = null">项目塔</button>
          <button class="vs-b" :class="{ on: viewMode === 'pano' }" :aria-selected="viewMode === 'pano'" title="横向泳道全景 · 看这一个项目的完整链路" @click="viewMode = 'pano'; layerView = null">项目全景</button>
        </div>
        <!-- ★序号用**全局舱序号**（原型 .ns-idx 是 1~N 连号），不用「目标·项目」复合号：
             复合号在左栏只有 210px 宽时会挤掉项目名，而项目名才是这一栏唯一要读的东西。
             全局号还能与舱头的 tw-idx 对上，两处是同一把尺子。 -->
        <template v-for="dg in towerGroups" :key="dg.dir.id">
          <button
            v-for="(row, pi) in dg.projs"
            :key="row.proj.id"
            class="ns-item"
            :class="{ on: activeTowerId === row.proj.id }"
            :style="{ '--pc': row.hue }"
            @click="gotoTower(row.proj.id)"
          >
            <span class="ns-idx">{{ dg.i + 1 }}.{{ pi + 1 }}</span>
            <span class="ns-body">
              <span class="ns-n">{{ row.proj.name }}</span>
              <span class="ns-m">{{ row.meta.metrics.length }} 指标 · {{ row.meta.total }} 任务<span v-if="row.proj.isFocused" class="ns-f"><Icon name="main-focus" :size="13"/></span></span>
            </span>
          </button>
        </template>
        <div class="ns-hint">点任意舱直达；滚动时左侧自动跟随当前视野所在舱</div>
      </aside>
      <div class="canvas" ref="canvasEl" @scroll="onCanvasScroll">
        <div class="canvas-inner">

          <!-- ★V3.8.20：这里原有第二份 <CompassSpine>（挂在 .canvas-inner 顶部），本轮删除 ——
               它与全宽 .spine-bar 那份事件同源（@locate 都走 canvasEl），两份并存只产生双倍
               DOM 与"到底点的是哪一份"的困惑；保留的是全宽条那份（含 #actions 插槽的「＋战略目标」）。
               W12-2 判据「骨架条在层级面板之前」仍成立（spine-bar 那份在 .canvas-inner 之前）。 -->

          <!-- W11 ★层级展开面板（原型 .lvpanel）：点 1/2/3 摊开该层完整内容 + 推导链 + 下挂实体。
               再点同层收起（判据 W11-3 双向可达，绝不做单向门）。

               ★W12 结构归位（1:1 还原）：第 1/2 层的**正文**（愿景 22px / 使命 / 关联卡片 / 就地编辑）
               从"骨架条上方独占一整块常驻卡"搬进本面板的 entity 槽。
               原型的层级关系是 spine → lvpanel → towers，第 1/2 层内容只在 lvpanel 里出现；
               之前把愿景卡摆在 spine 之上，等于在六层链条之外另开了一个平级区块，
               于是首屏被一块大字卡吃掉、"逐层收窄"在版面上断掉。
               判据 W8-1 / W8-2 / W11-11 守的是"愿景仍是唯一主体且独占一行 + 重框"，
               面板位同样满足，承重未丢，只是位置回到链条之内。
               ★默认收起（layerOpen 初值 null）与原型一致：原型 .lvpanel 的 max-height 初值就是 0，
               脚本也没有默认展开的调用—— 原型首屏同样是骨架条直接接分组头。
               点骨架条「1 愿景 / 2 使命 / 3 战略目标」才滑出。判据 W12-12 钉这一条。 -->
          <CompassLayerPanel
            v-if="layerOpen"
            :meta="compassMeta"
            :layer="layerOpen"
            :dir-filter="dirFilter"
            @goto="onLayerOpen"
            @list="onLayerList"
            @locate="onLocateLayer"
            @dir="onDirFilter"
            @close="layerOpen = null"
          >
            <!-- ★第 1/2 层正文插槽：就地编辑与关联卡片能力全在这一段（判据随迁备案见上方注释） -->
            <template #entity>
              <div class="tree-level-card hero" id="layer-1">
                <template v-if="layerOpen === 1">
                  <span class="tl-badge">1 愿景 · 终极方向</span>
                  <div class="tl-text">
                    <span class="node-title editable" v-pressable :class="{editing: editingField === 'vision'}" :data-edit="'vision'" :contenteditable="editingField === 'vision'"
                      @click="startEdit('vision', $event)" @blur="saveEdit('vision', $event)" @keydown.enter.ctrl.prevent="saveEdit('vision', $event)" @keydown.esc="cancelEdit">{{ visionText || '点击设定你的核心愿景…' }}</span>
                  </div>
                  <div class="tl-links">
                    <span class="proj-toggle" v-pressable @click.stop="toggleLinkPop('vision')"><Icon name="link" :size="13"/> 关联卡片 <span class="link-count">{{ linkCount('vision') }}</span></span>
                    <template v-if="linkCount('vision')">
                      <span v-for="rid in linkIds('vision', 'res')" :key="'vr' + rid" class="linked-chip" v-pressable :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico"><Icon name="filetext" :size="13"/></span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                      <span v-for="cid in linkIds('vision', 'curio')" :key="'vc' + cid" class="linked-chip" v-pressable :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico"><Icon name="bulb" :size="13"/></span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
                    </template>
                  </div>
                </template>
                <template v-else>
                  <span class="tl-badge ghost" id="layer-2">2 使命 · 行动准则</span>
                  <div class="tl-text sub">
                    <span class="node-title editable" v-pressable :class="{editing: editingField === 'mission'}" :data-edit="'mission'" :contenteditable="editingField === 'mission'"
                      @click="startEdit('mission', $event)" @blur="saveEdit('mission', $event)" @keydown.enter.ctrl.prevent="saveEdit('mission', $event)" @keydown.esc="cancelEdit">{{ missionText || '点击设定你的核心使命…' }}</span>
                  </div>
                  <div class="tl-links">
                    <span class="proj-toggle" v-pressable @click.stop="toggleLinkPop('mission')"><Icon name="link" :size="13"/> 关联卡片 <span class="link-count">{{ linkCount('mission') }}</span></span>
                    <template v-if="linkCount('mission')">
                      <span v-for="rid in linkIds('mission', 'res')" :key="'mr' + rid" class="linked-chip" v-pressable :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico"><Icon name="filetext" :size="13"/></span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                      <span v-for="cid in linkIds('mission', 'curio')" :key="'mc' + cid" class="linked-chip" v-pressable :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico"><Icon name="bulb" :size="13"/></span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
                    </template>
                  </div>
                </template>
              </div>
            </template>
          </CompassLayerPanel>

          <!-- ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：项目塔与项目全景两个视图已能就地
         纵览一个项目的全貌，这枚「📄 项目详情」直达入口由此退役。/compass/projects 整页与其余
         消费方（⌘K 项目搜索、ProjectDetailDrawer 等）本轮不动，只是不再从方向台把用户引过去。 -->
            <!-- ★V3.8.18（N3）：三层引导带曾在此处（.tl-head-row）。
     ★V3.9.19（04-73 一处不两说，随 hero 去重同批）整体退役 ——
     它的 3/4/5/6 计数与战略骨架条账本重复（第三处报同一笔账）；
     视图切换（项目塔/全景）随原型迁入左栏项目导航顶部（.navside），
     层号导航语义本就由骨架条 1~6 按钮承担。判据 W12-1 / R3-B′ 随迁备案。 -->

            <!-- ★C2（V3.8.33 B5-c）：筛选态提示条已上提到 hero 动作行（页头状态，不是树内容），
                 这里不再有横幅占位 —— 树区从引导条到舱列连续，不再被拦腰截断。 -->

            <!-- ★F7 层级专属列表（用户拍板 2026-10-16）：第 3/5/6 层各占一个专属列表视图，
                 与项目塔/项目全景**互斥占位**（v-if / v-else-if 链）——打开列表即整体切换下方形态，
                 ✕ 返回或同层再点收起，viewMode 不被改所以关闭即原样恢复记忆。 -->
            <!-- ★C3（V3.8.31）：视图形态切换加 150ms 内容过渡（淡入 + 8px 上浮）。
                 病根：点「项目塔 / 项目全景」时画布是**瞬间换整体**，没有任何空间关系交代，
                 用户会以为"点错了、页面跳走了"。过渡只给**同一容器内的形态切换**，
                 路由级切换仍零动画（R13 纪律不变）。reduced-motion 下平滑降级为无动画。
                 三个分支是 v-if / v-else-if 链——Transition 每次只渲染其中一个，key 保证
                 Vue 认得出"换的是另一个形态"，否则同标签 div 会被复用、过渡不触发。 -->
            <Transition name="viewfade" mode="out-in">
            <CompassLayerList
              v-if="layerView"
              :key="'lv-' + layerView"
              :layer="layerView"
              :back-label="viewMode === 'pano' ? '全景' : '项目塔'"
              :dir-filter="dirFilter"
              :rows3="layerRows3"
              :rows5="layerRows5"
              :rows6="layerRows6"
              @close="layerView = null"
              @dir="onDirFilter"
              @locate="onListLocate"
              @edit-dir="onListEditDir"
              @del-dir="(id) => deleteNode('dir', id)"
            />

            <!-- ★W11 项目全景（横向泳道）。与项目塔同一份数据、两种投影，切换不重算。 -->
            <CompassPano
              v-else-if="viewMode === 'pano'"
              key="pano"
              :meta="compassMeta"
              :active-id="panoId"
              :diag="diagFor(panoEffectiveId)"
              :diag-stale="diagStale(panoEffectiveId)"
              @pick="panoId = $event"
              @to-tower="backToTower"
              @toggle-task="toggleTask"
              @task-grade="showTaskGrade"
              @open-detail="openTaskDetail"
              @unbind-task="unbindTaskById"
              @open-metric="openMetricDetail"
              @add-task="(mid, pid) => openTaskAdd(mid, pid)"
              @add-metric="addMetric"
              @ai-metric="(id) => aiChain('metrics', id)"
              @bind-orphan="bindOrphan"
              @del-metric="delMetricById"
              @import-template="openProjImport"
              @diag-run="(id) => startProjectDiag(id)"
              @diag-report="(id) => openDiagReport(id)"
            />

            <!-- W11（V3.8.11）★纵向项目舱序列 —— 替换原三列并排网格（.tree-columns-grid）
                 为什么换：三列并排时项目之间只靠列边界，扫视易串行，归属靠"在哪一列"推断。
                 改成纵向舱：每舱独占容器 + 左侧 4px 色条 + 舱间 22px 间距，归属由色条与面包屑显式承担。
                 判据 W11-1 钉住"纵向舱序列存在 + .tree-columns-grid 消失"。 -->
            <!-- ★W12-E 退役带备案：下面两个视图挂载点上的 @goto-detail 绑定已随「进项目详情」入口退役一并移除（子组件已无此 emit）。
           /compass/projects 整页与 ⌘K 项目搜索等其它消费方未动，只是不再从方向台把用户引过去。 -->
            <div v-else-if="viewMode === 'tower'" class="tower-list" id="layer-4" key="tower">
              <!-- G3（V3.8.27）：方向台零方向兜底改走 EmptyState（是什么 / 怎么开始）。
                   ★C5（V3.8.37）改两处：
                   ① 图标 target → compass。原文点名 Icon(compass)：这是「还没有方向」而不是
                      「差一个目标数」——前者说的是处境，后者说的是指标，后者带考核味。
                   ② 补主行动按钮（原文验收「空态有主行动」）。
                   ★★关于 R3-B′ 的裁定（V3.8.27 曾判「不给主行动」）：
                      当初的理由是「层内再放一个＋战略目标等于开第二入口，用户不知道点哪个」。
                      这条顾虑在**非空态**成立，但零方向时不成立——页头那个按钮挂在骨架条第 3 层，
                      零方向时骨架条本身没有内容要铺，用户首屏视线落在项目塔的空态区，
                      那个按钮既不在视野内、也因为骨架空而无参照，等于「有入口但够不到」。
                      因此本批给的解法不是复制按钮，而是**主行动直接调同一个 addDirection()**：
                      同一个函数、同一 toast、同一落地位置，不存在两份实现、也不会写歪。
                      非空态下空态不渲染，R3-B′ 的顾虑照旧成立，两条纪律互不覆盖。 -->
              <EmptyState v-if="!d.compass.directions.length" size="page" icon="compass"
                title="方向台还空着"
                desc="战略目标是你真正想推进的那件事——它下面会长出项目、指标与任务。"
                hint="写下第一个战略目标，方向树就从这里长出来；想先看整体骨架，先写愿景与使命也行。"
                action-label="＋ 写下第一个战略目标" @action="openDirectionCreate" />

              <template v-for="dg in towerGroups" :key="dg.dir.id">
                <!-- 战略目标分组头：★与骨架条芯片、层级面板目标卡三处同源同色 -->
                <div class="dir-head" :class="dg.hue" :data-dir-id="dg.dir.id">
                  <div class="dh-l">
                    <!-- ★W12：原型的 .dh-i 是纯数字方块，但原型同时有一枚「N 战略目标」pill 承担
                         "这是第几层、点它即过滤"的语义。数字方块看不出层，pill 能。
                         两者合并：pill 收在左（点即过滤，与骨架条芯片同源同色），方块退为序号。 -->
                    <button class="dir-badge" :class="{ on: dirFilter === dg.dir.id }" @click.stop="onDirFilter(dg.dir.id)"
                      :title="dirFilter === dg.dir.id ? '正在只看这个目标 · 再点取消' : '只看这个战略目标的项目舱'">
                      {{ dg.i + 1 }} 战略目标
                    </button>
                    <span class="dh-i">{{ dg.i + 1 }}</span>
                    <span class="node-title editable dh-n" v-pressable :data-edit="'dir-' + dg.dir.id"
                      @click.stop="openDirectionEdit(dg.dir.id)">{{ dg.dir.name }}</span>
                    <span v-if="isStagnant(dg.dir)" class="stagnant-tag" title="该目标下项目近 14 天无推进"><Icon name="warn" :size="13"/> 停滞</span>
                    <MaturityBadge :m="directionMaturity(d, dg.dir)" />
                    <span class="dh-meta">{{ dg.projs.length }} 攻坚项目 · {{ dg.metaCount }} 成功指标 · {{ dg.taskCount }} 任务</span>
                    <!-- ★发丝线（原型 .dir-line）：把一行读数在右侧收口，别让按钮组孤零零吊在行尾 -->
                    <span class="dh-line" />
                  </div>
                  <div class="dh-acts" data-a11y-container @click.stop>
                    <!-- ★V3.8.18（N5）动作**三级分层**：
                         病根＝五枚按钮共用 .node-action 的固定 22×22 方块，字号/底色/字重完全一样，
                         于是「只看我」这个**文字型**按钮被硬塞进 22px 方块里，文字逐字折行变成竖排一列
                         （真 bug，不是观感问题）。修法不是单给它加 white-space，
                         而是承认"这五枚不是同一类东西"，按操作性质分三级：
                           t1 主操作 —— 往这个目标里加东西，最常见意图
                           t2 次操作 —— 图标化能力（AI / 导入），方块形态成立
                           t3 文字型 —— 状态开关（只看我），本质是"我在哪个视图"而不是"做什么" -->
                    <span class="node-action t1" v-pressable @click="addProject(dg.dir.id)" title="添加攻坚项目">＋</span>
                    <span class="node-action t2" v-pressable @click="aiChain('projects', dg.dir.id)" title="AI 建议攻坚项目（补路径依赖，查重后采纳才创建）"><AiEntryButton /></span>
                    <span class="node-action t2" v-pressable @click="openGoalImport(dg.dir)" title="导入模板（Markdown 批量生成项目/指标/任务）"><Icon name="filetext" :size="13"/></span>
                    <span class="node-action t3" v-pressable :class="{ on: dirFilter === dg.dir.id }" @click="onDirFilter(dg.dir.id)"
                      :title="dirFilter === dg.dir.id ? '正在只看这个目标 · 再点取消' : '只看这个战略目标的项目舱'"><Icon v-if="dirFilter === dg.dir.id" name="eye" :size="13"/>{{ dirFilter === dg.dir.id ? '正在只看' : '只看我' }}</span>
                    <span class="node-action t2" v-pressable @click="openDirectionEdit(dg.dir.id)" title="编辑战略目标（名称 / 期限 / 状态）"><Icon name="edit" :size="13"/></span>
                    <span class="node-action t3 danger" v-pressable @click="deleteNode('dir', dg.dir.id)" title="删除目标"><Icon name="trash" :size="13"/></span>
                  </div>
                </div>

                <!-- ★项目舱列 -->
                <CompassTower
                  v-for="(row, pi) in dg.projs"
                  :key="row.proj.id"
                  :dir="dg.dir"
                  :proj="row.proj"
                  :meta="row.meta"
                  :idx="pi + 1"
                  :hue="row.hue"
                  :open="projOpen(row.proj)"
                  :open-metrics="expandedMetrics"
                  :risk-only="riskOnly"
                  :dragging="dragProj?.id === row.proj.id"
                  :drop-on="dropTargetId === row.proj.id"
                  :menu-on="projMenu === row.proj.id"
                  :editing-field="editingField"
                  :diag="diagFor(row.proj.id)"
                  :diag-stale="diagStale(row.proj.id)"
                  @diag-run="(id) => startProjectDiag(id)"
                  @diag-report="(id) => openDiagReport(id)"
                  @menu="toggleProjMenu"
                  @dragstart="(dirId, pid, ev) => { const p = findProject(pid); if (p) onProjDragStart(dirId, p, ev) }"
                  @dragover="(dirId, pid) => { const p = findProject(pid); if (p) onProjDragOver(dirId, p) }"
                  @dragleave="onProjDragLeave"
                  @drop="(dirId, pid) => { const p = findProject(pid); if (p) onProjDrop(dirId, p) }"
                  @pin="(dirId, pid) => { const dir = d.compass.directions.find(x => x.id === dirId); const p = findProject(pid); if (dir && p) toggleProjectPin(dir, p) }"
                  @focus="onToggleFocus"
                  @del="(id) => deleteNode('proj', id)"
                  @fold="(id) => { const p = findProject(id); if (p) toggleProjectFold(p) }"
                  @toggle-metric="toggleMetric"
                  @toggle-task="toggleTask"
                  @task-grade="showTaskGrade"
                  @open-detail="openTaskDetail"
                  @unbind="(tid) => { const t = d.tasks.find(x => x.id === tid); if (t) unbindTask(t) }"
                  @open-metric="openMetricDetail"
                  @add-task="(mid) => { const r = findMetric(mid); if (r) openTaskAdd(mid, r.proj.id) }"
                  @ai-task="(mid) => aiChain('tasks', mid)"
                  @add-metric="addMetric"
                  @del-metric="delMetricById"
                  @import-template="openProjImport"
                  @edit-title="(mid, ev) => startEdit('metric-' + mid, ev)"
                  @save-title="(mid, ev) => saveEdit('metric-' + mid, ev)"
                  @cancel-title="cancelEdit"
                  @edit-project="() => openProjectDrawer(row.proj.id)"
                  @ai-metric="(id) => aiChain('metrics', id)"
                  @open-pano="openPano"
                  @bind-orphan="bindOrphan"
                />
              </template>
          </div>
            </Transition>

          <!-- 底部说明 -->
          <div class="footer-hint">
            <Icon name="bulb" :size="13"/> 点击标题即可编辑 · Enter 保存 / Esc 取消 · 点击指标展开/收起任务 · 空指标会亮 <Icon name="warn" :size="13"/> 警示
          </div>

        </div>
      </div>
      </div>

    <!-- R59-T4：关联卡片选择器（居中弹窗：关键词+拼音过滤 / 资源+好奇分区 / 全量滚动 / 勾选即存） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="linkModal" class="lm-mask" @click.self="closeLinkModal">
          <div class="lm-box">
            <div class="lm-head">
              <span><Icon name="link" :size="13"/> 关联卡片 · {{ linkModal.node === 'vision' ? '愿景' : '使命' }}</span>
              <span class="lm-count">已选 {{ linkCount(linkModal.node) }}</span>
      <button class="pm-close" type="button" aria-label="关闭" @click="closeLinkModal">×</button>
            </div>
            <div class="lm-body">
              <input v-model="linkQ" class="lm-search" placeholder="关键词或拼音首字母过滤（如 sj）…" v-focus @keydown.esc.stop="closeLinkModal">
              <div class="link-pop-sec"><Icon name="filetext" :size="13"/> 资源卡（{{ linkCandidates('res').length }}）</div>
              <div class="lm-list">
                <label v-for="r in linkCandidates('res')" :key="r.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'res', r.id)" @change="toggleLinked(linkModal.node, 'res', r.id)">
                  <span :title="r.title">{{ r.title }}</span>
                </label>
                <div v-if="!linkCandidates('res').length" class="link-pop-empty">无匹配资源卡</div>
              </div>
              <div class="link-pop-sec"><Icon name="bulb" :size="13"/> 好奇心卡（{{ linkCandidates('curio').length }}）</div>
              <div class="lm-list">
                <label v-for="c in linkCandidates('curio')" :key="c.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'curio', c.id)" @change="toggleLinked(linkModal.node, 'curio', c.id)">
                  <span :title="c.title">{{ c.title }}</span>
                </label>
                <div v-if="!linkCandidates('curio').length" class="link-pop-empty">无匹配好奇心卡</div>
              </div>
            </div>
            <div class="lm-foot">
              <span class="lm-tip">勾选即时保存 · 单击已关联卡片可在下方芯片处查看（双击打开）</span>
              <button class="mini-btn primary" @click="closeLinkModal">完成</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- B24：关联卡片详情抽屉 -->
    <Drawer :open="!!peekData" :icon="peek?.kind === 'res' ? 'filetext' : 'bulb'" :title="peek?.kind === 'res' ? '资源卡详情' : '好奇心卡详情'" @close="peek = null">
      <template v-if="peekData">
        <div class="peek-row"><span class="peek-label">标题</span><div class="peek-val strong">{{ peekData.title }}</div></div>
        <div class="peek-row"><span class="peek-label">来源</span><div class="peek-val">{{ peekData.kind === 'res' ? peekData.src : '我的好奇心' }}{{ peekData.linkType ? ' · ' + peekData.linkType : '' }}</div></div>
        <div v-if="peekData.link" class="peek-row"><span class="peek-label">链接</span><div class="peek-val link">{{ peekData.link }}</div></div>
        <div v-if="peekData.desc" class="peek-row"><span class="peek-label">描述</span><div class="peek-val">{{ peekData.desc }}</div></div>
        <div v-if="peekData.tags.length" class="peek-row"><span class="peek-label">标签</span><div class="peek-val"><span v-for="t in peekData.tags" :key="t" class="peek-tag">#{{ t }}</span></div></div>
        <button v-if="peekData.link" class="peek-open" @click="openPeekLink"><Icon name="external" :size="13"/> 打开链接</button>
      </template>
    </Drawer>

    <!-- 第卅二轮 REQ-003：项目全景透视抽屉 -->
    <ProjectDetailDrawer :open="projDrawerOpen" :project-id="projDrawerId" enable-metric-drill @close="projDrawerOpen = false" />
    <MetricDetailDrawer :open="metricDetailOpen" :metric-id="metricDetailId" @close="metricDetailOpen = false" />

    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAdd" :metric-id="taskAdd?.metricId || ''" :project-id="taskAdd?.projId || ''"
      :metric-title="taskAddMetricTitle" @close="taskAdd = null" @created="onTaskCreated" />

  <!-- R51-B6：创建成功后直接打开详情抽屉 -->
  <TaskDetailDrawer ref="detailRef" />

    
  </div>
  <ImportTemplateModal
    :open="goalImport.open"
    mode="goal"
    :target-name="goalImport.dirName"
    @close="goalImport.open = false"
    @confirm="confirmGoalImport"
  />
  <!-- ★F2：项目层模板导入（# 成功指标 / ## 任务 —— 下移一级解析） -->
  <ImportTemplateModal
    :open="projImport.open"
    mode="project"
    :target-name="projImport.projName"
    @close="projImport.open = false"
    @confirm="confirmProjImport"
  />
  <DirectionFormModal
    :open="directionForm.open"
    :direction="directionForm.direction"
    @close="directionForm = { open: false, direction: null }"
    @save="saveDirectionForm"
  />
  <CompassRiskModal
    :open="riskOpen"
    :groups="riskGroups"
    :total="compassMeta.counts.risk"
    @close="riskOpen = false"
    @locate="locateCompassTarget"
  />
  <!-- R135：罗盘链式生成评审抽屉（目标/项目/指标/任务四层建议共用） -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
  <!-- N2：诊断报告中央弹窗（采纳后自动顶开；过期条与导出都在组件内） -->
  <ProjectDiagnoseModal
    v-if="diagOpen"
    :open="diagOpen"
    :report="diagReport"
    :stale="diagStale(diagProjId)"
    @close="diagOpen = false"
    @rerun="rerunDiag"
  />
</template>

<style scoped src="./CompassTree.css"></style>
