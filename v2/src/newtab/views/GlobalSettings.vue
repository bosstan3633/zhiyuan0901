<template>
  <div class="gs-page">
    <!-- 左侧导航 -->
    <aside class="gs-nav">
      <div class="gs-nav-group" v-for="grp in navGroups" :key="grp.title">
        <div class="gs-nav-group-title">{{ grp.title }}</div>
        <div
          v-for="item in grp.items"
          :key="item.key"
          class="gs-nav-item"
          :class="{ active: activePage === item.key }"
          @click="onNavClick(item)"
        >
          <AiEntryButton v-if="item.mark" class="gs-nav-icon" /><span v-else class="gs-nav-icon">{{ item.icon }}</span>{{ item.label }}
        </div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <main class="gs-content">
      <!-- 返回按钮 -->
      <div class="gs-back-btn" @click="router.push('/compass')">← 返回</div>

      <!-- ===== 知源仪表盘（第卌四轮 T-03：默认首屏） ===== -->
      <div v-if="activePage === 'dashboard'" class="gs-panel" :class="{ 'dz-hl': dzHl }">
        <div class="gs-page-header">
          <div class="gs-page-title">📊 知源仪表盘 <span class="gs-dash-en">DASHBOARD</span></div>
          <div class="gs-page-desc">数据总览 · 行为有痕 · 复盘有据 —— 这一年我是怎么走的（概览带 · 年度热力图 · 复盘）</div>
          <!-- R3-F38：交互点高亮开关（工具条位，与页头同排；开启后整面板虚线圈出可点处） -->
          <button class="gs-dash-hl" :class="{ on: dzHl }" @click="toggleDzHl"
            :title="dzHl ? '关闭交互点高亮' : '把这一屏所有能点的地方圈出来'">👁 高亮可交互</button>
        </div>

        <!-- R172-T5：① 概览带（存量快照 + ★时间绑定 + 人话总结 + 参照系行 + 分数口径表）
             取代原「5 张核心指标卡 + 动态条」—— 存量（库里有什么）与流量（我做了什么）合成一条带，
             可读性三层（人话主数字 / 语义档位 / 参照系）见 04-66 §4.2 -->
        <DashboardOverview
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :live-link="linkCardCount" :error-count="errorLogCount"
          @clear-day="dashSelDay = null"
          @open-cards="onDashOpenCards" @open-dyn="onDashOpenDyn" @export-error="exportErrorLog" />

        <!-- R172-T6：② 年度热力图 + 日详情（点格 → 那天做了什么 / 库变成了什么样 / 原始流水） -->
        <Heatmap
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :events="timelineEvents" :live-link="linkCardCount"
          @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event" @open-log="onDashOpenLog" />

        <!-- R172-T7：③ 复盘段（紧凑两栏：左＝画像摘要 + 节奏曲线｜右＝目标对账 + 偏离预警；三类可下钻） -->
        <ReviewPanel
          :stats="dashStats" :events="timelineEvents" :data="gd"
          :directions="dashDirections" :tasks="dashTasks"
          @save-report="onReportSave" @report-task="onReportTask" @report-goto="onReportGoto" @report-export="onReportExport" />

        <!-- R172-T8/T9：记录能力新居所 —— 四类记录入口（承接调度台旧四格 + 今日记录抽屉）+ 全量抽屉 -->
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">🕘 操作记录</span><span class="gs-card-desc">四类记录入口 · 抽屉内三维筛选（类型 × 动作 × 时间）+ CSV 导出 + 容量提示</span></div>
          <div class="gs-card-body">
            <div class="dz-recentry">
              <button class="it" title="今日入台明细" @click="openLog('in')">⬇ 今日入台 <b>{{ todayAddCount }}</b></button>
              <button class="it" title="今日移出明细" @click="openLog('out')">⬆ 今日移出 <b>{{ todayDelCount }}</b></button>
              <button class="it" title="今日调出明细" @click="openLog('called')">↗ 今日调出 <b>{{ todayCalledCount }}</b></button>
              <button class="it" title="写入记录（全量）" @click="openLog('log')">✎ 写入记录 <b>{{ eventLog.length }}</b></button>
              <span class="dz-sp" />
              <button class="dz-btn sm pri" @click="openLog('log')">打开全部记录 ›</button>
            </div>
            <div class="gs-field-hint">💡 日详情点某天 →「查看全部记录 ›」会按该日预筛此抽屉；日志容量上限 {{ EVENT_LOG_CAP }} 条滚动保留（含恢复与永久删除），老数据无日志时自动回退为卡片时间派生。</div>
          </div>
        </div>

        <!-- R172-T8：全量记录抽屉（记录能力的新居所；数据由宿主以 prop 传入，组件不碰 store） -->
        <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />

        <!-- 核心指标下钻抽屉（R48-B1：搜索 + 翻页 20 条；R51-B7 列表撑满抽屉消除下方空白） -->
        <Drawer :open="!!statDrawer" :title="statDrawerTitle" width="460px" @close="statDrawer = ''">
          <div class="gs-drawer-fill">
            <div class="gs-drawer-search">
              <input v-model="statSearch" placeholder="🔍 搜索标题 / 项目 · 指标">
              <span class="cnt">{{ statFiltered.length }} 条</span>
            </div>
            <div class="gs-ev-list">
              <div v-for="c in statShown" :key="c.id" class="gs-ev-row static clickable" @click="openStatCard(c)">
                <span class="gs-ev-kind">{{ statKindIcon(c.kind) }}</span>
                <span class="gs-ev-badge">{{ statKindLabel(c.kind) }}</span>
                <span class="gs-ev-title">{{ c.title }}</span>
                <span v-if="c.kind === 'task'" class="gs-ev-owner">{{ c.owner }}</span>
                <span class="gs-ev-time">{{ fmtDay(c.ts) }}</span>
              </div>
              <div v-if="!statFiltered.length" class="gs-ev-empty">{{ statSearch.trim() ? '没有匹配的卡片' : '暂无卡片' }}</div>
              <div v-if="statList.length" class="gs-field-hint">💡 单击行可跳转定位到卡片所在页面。</div>
            </div>
            <div v-if="statPageCount > 1" class="gs-pager">
              <button :disabled="statPage <= 1" @click="statGo(-1)">‹ 上一页</button>
              <span>第 {{ statPage }} / {{ statPageCount }} 页 · 每页 {{ STAT_PAGE }} 条</span>
              <button :disabled="statPage >= statPageCount" @click="statGo(1)">下一页 ›</button>
            </div>
          </div>
        </Drawer>

        <!-- 动态条明细抽屉（R48-B1 翻页 + R48-B2 双口径徽标：新增/导入/删除同源卡片字段；R51-B7 列表撑满） -->
        <Drawer :open="!!dynDrawer" :title="dynDrawerTitle" width="460px" @close="dynDrawer = ''">
          <div class="gs-drawer-fill">
            <div class="gs-drawer-search">
              <input v-model="dynSearch" placeholder="🔍 搜索卡片标题">
              <span class="cnt">{{ dynFiltered.length }} 条</span>
            </div>
            <div class="gs-ev-list">
              <div v-for="e in dynShown" :key="e.id" class="gs-ev-row static">
                <span class="gs-ev-time">{{ fmtEventTime(e.ts) }}</span>
                <span class="gs-ev-badge" :class="e.action === 'import' ? 'create' : e.action">{{ e.action === 'import' ? '⇪ 导入' : eventActionLabel(e.action) }}</span>
                <span class="gs-ev-kind">{{ eventKindLabel(e.kind) }}</span>
                <span class="gs-ev-title">{{ e.title }}</span>
              </div>
              <div v-if="!dynFiltered.length" class="gs-ev-empty">{{ dynSearch.trim() ? '没有匹配的记录' : '该时间范围内没有记录' }}</div>
            </div>
            <div v-if="dynPageCount > 1" class="gs-pager">
              <button :disabled="dynPage <= 1" @click="dynGo(-1)">‹ 上一页</button>
              <span>第 {{ dynPage }} / {{ dynPageCount }} 页 · 每页 {{ STAT_PAGE }} 条</span>
              <button :disabled="dynPage >= dynPageCount" @click="dynGo(1)">下一页 ›</button>
            </div>
            <div class="gs-field-hint">💡 操作有痕：新增即保存，删除进回收站可恢复；导入的卡带「⇪ 导入」徽标（继承原创建时间）。</div>
          </div>
        </Drawer>
      </div>

      <!-- ===== R113-N2：资源生命周期（三类卡聚合；内嵌式面板，数值可下钻、条目可操作转化） ===== -->
      <div v-if="activePage === 'lifecycle'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⏳ 资源生命周期</div>
          <div class="gs-page-desc">资源卡 / 任务卡 / 好奇心卡三类实体的活跃 · 冷却 · 归档全景 —— 点击数字下钻明细，明细行可直接归档 / 忽略 / 重新激活，点击条目跨台定位卡片</div>
        </div>
        <!-- R126（诉求 5）：阈值设置入口（全局默认 + 逐卡覆盖） -->
        <button class="gs-btn" style="margin-bottom: 12px" @click="lcSetOpen = true">⚙ 阈值设置</button>
        <LifecyclePanel kind="all" :cards="lcCards"
          @locate="onLcLocate" @archive="onLcArchive" @snooze="onLcSnooze" @reactivate="onLcReactivate"
          @set-days="onLcSetDays" />
        <Teleport to="body">
          <div class="gs-modal-overlay" :class="{ open: lcSetOpen }" @click.self="lcSetOpen = false">
            <div class="gs-modal" style="width: 640px">
              <div class="gs-modal-header">⚙ 冷却阈值设置</div>
              <div class="gs-modal-body">
                <p>全局默认冷却 <b>{{ lcDefaultDraft || 30 }}</b> 天 · 归档 = 冷却 × 3 = <b>{{ (lcDefaultDraft || 30) * 3 }}</b> 天；每张卡可单独覆盖（清除后回落全局默认）。<br />修改阈值只影响状态判定，<b>不会改变卡片活跃度</b>。</p>
                <div class="lc-set-global">
                  <span>默认冷却天数</span>
                  <input v-model.number="lcDefaultDraft" type="number" min="1" max="365" class="gs-confirm-input" style="width: 90px" />
                  <button class="gs-btn" @click="saveLcDefault">保存</button>
                </div>
                <div class="lc-set-list">
                  <div v-for="c in lcCards" :key="c.id" class="lc-set-row">
                    <span class="lc-set-name" :title="(c as any).title">{{ (c as any).title || '未命名' }}</span>
                    <input class="gs-confirm-input" style="width: 80px" type="number" min="1" max="365" placeholder="默认"
                      :value="(c as any).coolingDays || ''"
                      @change="onLcSetDays(c.id, Number(($event.target as HTMLInputElement).value) || null)" />
                    <button class="gs-btn" @click="onLcSetDays(c.id, null)">清除</button>
                  </div>
                </div>
              </div>
              <div class="gs-modal-footer">
                <button class="gs-btn" @click="lcSetOpen = false">关闭</button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- ===== 资源台全景（第卌四轮 T-04 双栏 Master-Detail；R65-F5 只呈现资源台，策展台不再进全景） ===== -->
      <div v-if="activePage === 'panorama'" class="gs-panel gs-pan-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🗺 资源台全景</div>
          <div class="gs-page-desc">左栏看全景（资源台 → 分类 → 子分类），右栏做整理 · 勾选卡片拖到左栏目标分类即可批量移动 · 单击详情 / 双击打开 · 双击分类行直接改名</div>
        </div>
        <div class="gs-pan-wrap">
          <!-- 左栏：全景计数树（默认全展开） -->
          <div class="gs-pan-tree">
            <div class="gs-pan-tree-head">全景 · 资源台 · {{ panTotalCats }} 分类 · {{ panTotalCards }} 卡</div>
            <div v-for="(wsNode, wi) in panTree" :key="wsNode.ws.id" class="gs-pan-ws">
              <div class="gs-pan-row gs-pan-ws-row" :class="{ active: panSelWs === wsNode.ws.id && !panSelCat, drop: dropTarget === 'ws:' + wsNode.ws.id }"
                draggable="false" @click="selectPanWs(wsNode.ws.id)"
                @dragover.prevent="dropTarget = 'ws:' + wsNode.ws.id" @dragleave="dropTarget === 'ws:' + wsNode.ws.id && (dropTarget = '')" @drop.prevent="onPanDrop('ws:' + wsNode.ws.id, wsNode.ws.id, '')">
                <span class="gs-pan-toggle leaf" @click.stop="togglePanCollapse('ws:' + wsNode.ws.id)">{{ panCollapsed.has('ws:' + wsNode.ws.id) ? '▸' : '▾' }}</span>
                <span class="gs-pan-name">{{ wsNode.ws.icon || '📁' }} {{ wsDisplayNameOf(wsNode.ws) }}<span class="gs-pan-kind">{{ isHubWs(gWsById(wsNode.ws.id)) ? '资源台' : '策展台' }}</span></span>
                <span class="gs-pan-count">{{ wsNode.count }}</span>
              </div>
              <template v-if="!panCollapsed.has('ws:' + wsNode.ws.id)">
                <!-- R66-F6：递归 N 级扁平行渲染（原固定 2 级），深层子分类缩进呈现、折叠语义沿祖先链 -->
                <template v-for="row in panFlatCats[wi]" :key="row.node.cat.id">
                  <div class="gs-pan-row" :class="[row.depth === 0 ? 'gs-pan-cat-row' : 'gs-pan-sub-row', { active: panSelCat === row.node.cat.id, drop: dropTarget === 'cat:' + row.node.cat.id }]"
                    :style="row.depth ? { paddingLeft: (row.depth * 14) + 'px' } : undefined"
                    @click="selectPanCat(row.node.cat.id)" @dblclick="panCatRename(row.node.cat.id)"
                    @dragover.prevent="dropTarget = 'cat:' + row.node.cat.id" @dragleave="dropTarget === 'cat:' + row.node.cat.id && (dropTarget = '')" @drop.prevent="onPanDrop('cat:' + row.node.cat.id, row.node.cat.workspaceId, row.node.cat.id)">
                    <span v-if="row.node.children.length" class="gs-pan-toggle" @click.stop="togglePanCollapse('cat:' + row.node.cat.id)">{{ panCollapsed.has('cat:' + row.node.cat.id) ? '▸' : '▾' }}</span>
                    <span v-else class="gs-pan-toggle leaf">·</span>
                    <input v-if="panEdit && panEdit.id === row.node.cat.id" v-model="panEdit.value" class="gs-tt-input gs-pan-rename-input" v-focus
                      @click.stop @dblclick.stop @keydown.enter.prevent="panCatRenameConfirm" @keydown.esc="panEdit = null" @blur="panCatRenameConfirm" />
                    <span v-else class="gs-pan-name">{{ row.depth === 0 ? '📂 ' : '└ ' }}{{ row.node.cat.name }}</span>
                    <span class="gs-pan-count">{{ row.node.count }}</span>
                  </div>
                </template>
              </template>
            </div>
            <div v-if="!panTree.length" class="gs-ev-empty">暂无策展台</div>
          </div>
          <!-- 右栏：当前分类卡片列表 -->
          <div class="gs-pan-list-wrap">
            <div class="gs-pan-list-head">
              <span class="gs-pan-crumb">{{ panCrumb }}</span>
              <label class="gs-pan-allcheck"><input type="checkbox" :checked="panAllChecked" @change="togglePanAll" /> 全选本分类</label>
            </div>
            <div class="gs-pan-list" @scroll.passive="onPanListScroll">
              <div v-for="r in panVisibleCards" :key="r.id" class="gs-pan-card" :class="{ selected: panSelected.has(r.id) }" draggable="true"
                @dragstart="onPanDragStart($event, r.id)" @dragend="dropTarget = ''"
                @click="onPanCardClick(r)" @dblclick="onPanCardDblClick(r)">
                <input type="checkbox" class="gs-pan-check" :checked="panSelected.has(r.id)" @click.stop @change="togglePanCard(r.id)" />
                <div class="gs-pan-card-main">
                  <div class="gs-pan-card-title"><span v-if="isMirrorView(r)" title="资源台镜像（真身在资源台）">📡 </span>{{ r.title }}</div>
                  <div class="gs-pan-card-sub">{{ panCardSub(r) }}</div>
                </div>
                <span class="gs-pan-card-date">{{ fmtDay(r.createdAt) }}</span>
              </div>
              <div v-if="panHasMore" class="gs-ev-empty">已显示 {{ panVisibleCards.length }} / {{ panCards.length }} 张 · 继续滚动加载</div>
              <div v-if="!panCards.length" class="gs-ev-empty">左侧选择策展台或分类查看卡片</div>
            </div>
            <div v-if="panSelected.size" class="gs-pan-batch">
              <span class="gs-pan-batch-n">已选 {{ panSelected.size }} 张</span>
              <select class="gs-select" v-model="panMoveWs" @change="panMoveCat = ''">
                <option value="">目标策展台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
              </select>
              <select class="gs-select" v-model="panMoveCat" :disabled="!panMoveWs">
                <option value="">目标分类（可选）</option>
                <option v-for="c in panMoveCatOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <button class="gs-btn gs-btn-primary" :disabled="!panMoveWs" @click="movePanSelection">移动</button>
              <button class="gs-btn" @click="panSelected = new Set()">取消</button>
            </div>
            <div class="gs-pan-foot">拖拽动线：勾选卡片 → 拖到左栏目标分类（虚线高亮）松手即移动 · 也可用下方按钮兜底 · 单击详情 双击打开</div>
          </div>
        </div>

        <!-- 全景卡片详情抽屉（单击打开） -->
        <Drawer :open="!!panDetail" title="🔗 卡片详情" @close="panDetail = null">
          <template v-if="panDetail">
            <div class="gs-pd-title">{{ panDetail.title }}</div>
            <div class="gs-pd-row"><span class="gs-pd-k">链接</span><span class="gs-pd-v">{{ panDetail.link || '—' }}</span></div>
            <div class="gs-pd-row"><span class="gs-pd-k">归属</span><span class="gs-pd-v">{{ gWsName(panDetail.workspaceId) }} / {{ gCatName(panDetail.categoryId || "") || '待分类' }}</span></div>
            <!-- R63-1：镜像卡展示真身归属 + 跳转 -->
            <template v-if="panMirrorSrc">
              <div class="gs-pd-row"><span class="gs-pd-k">📡 镜像</span><span class="gs-pd-v">真身在 {{ gWsName(panMirrorSrc.workspaceId) }} / {{ gCatName(panMirrorSrc.categoryId || "") || '待分类' }}</span></div>
              <div class="gs-pd-actions"><button class="gs-btn" @click="jumpMirrorSource">↩ 前往资源台真身</button></div>
            </template>
            <div class="gs-pd-row" v-if="panDetail.description"><span class="gs-pd-k">描述</span><span class="gs-pd-v">{{ panDetail.description }}</span></div>
            <div class="gs-pd-row" v-if="panDetail.tags && panDetail.tags.length"><span class="gs-pd-k">标签</span><span class="gs-pd-v">#{{ panDetail.tags.join(' #') }}</span></div>
            <div class="gs-pd-actions">
              <button class="gs-btn gs-btn-primary" @click="openCardLink(panDetail)">↗ 打开链接</button>
              <button class="gs-btn" @click="panDetail = null">关闭</button>
            </div>
          </template>
        </Drawer>
      </div>

      <!-- ===== 资源卡字段 ===== -->
      <div v-if="activePage === 'resource'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">📇 资源卡字段设计</div>
          <div class="gs-page-desc">拖拽字段调整顺序，开关控制在卡片/列表/看板视图中是否显示</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.resource" card-type="resource" :cross-fields="fields" @change="onFieldChange" @notify="showToast" />
          </div>
        </div>
        <div class="gs-preview-section">
          <div class="gs-preview-title">👁 实时预览 · {{ previewModeLabel }}视图</div>
          <div class="gs-preview-tabs">
            <div v-for="m in previewModes" :key="m.key" class="gs-preview-tab" :class="{ active: previewMode === m.key }" @click="previewMode = m.key">{{ m.label }}</div>
          </div>
          <div class="gs-preview-card" v-html="resourcePreviewHtml"></div>
        </div>
      </div>

      <!-- ===== 任务卡字段 ===== -->
      <div v-if="activePage === 'task'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">✅ 任务卡字段设计</div>
          <div class="gs-page-desc">拖拽字段调整顺序，开关控制在视图中是否显示</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.task" card-type="task" :cross-fields="fields" @change="onFieldChange" @notify="showToast" />
          </div>
        </div>
      </div>

      <!-- ===== 好奇心卡字段 ===== -->
      <div v-if="activePage === 'curiosity'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">💡 好奇心卡字段设计</div>
          <div class="gs-page-desc">拖拽字段调整顺序，开关控制在视图中是否显示</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.curiosity" card-type="curiosity" :cross-fields="fields" @change="onFieldChange" @notify="showToast" />
          </div>
        </div>
      </div>

      <!-- ===== 策展主题卡字段（R62-3：isThesis 资源卡专用组，服务策展台金字塔根节点呈现） ===== -->
      <div v-if="activePage === 'thesis'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🏛 策展主题卡字段设计</div>
          <div class="gs-page-desc">主题卡 = 策展台的中心论点（每台一张）；此组仅作用于标记为中心论点的卡片</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.thesis || []" card-type="thesis" :cross-fields="fields" @change="onFieldChange" @notify="showToast" />
          </div>
        </div>
      </div>

      <!-- ===== 标签管理（N4 · 行内编辑） ===== -->
      <div v-if="activePage === 'tags'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🏷 标签管理 <button class="gs-btn ai-batch-btn" :disabled="!aiReady" title="AI 体检标签体系：同义合并 + 裸标签归位（勾选采纳才级联改卡与树）" @click="aiTagGovern"><AiEntryButton variant="inline" label="标签体检" /></button><button class="gs-btn ai-batch-btn" :disabled="!aiReady" title="AI 整体梳理：盘点全库三类卡（只看卡面字段，不读链接正文）→ 结合愿景/目标重建标签树蓝图（每个标签标出预计收几张卡）→ 采纳即整树替换并同步改写卡标签 → 全卡补全打标，两道评审门 + 自动快照可还原" @click="aiTagRevise"><AiEntryButton variant="inline" label="🧹 整体梳理" /></button><button v-if="aiReviseBak" class="gs-btn ai-batch-btn" title="回滚到上次整体梳理之前（标签树与卡片标签全还原）" @click="aiRestoreRevise">↺ 还原上次梳理</button></div>
                    <div class="gs-page-desc">两级标签体系 · 三种卡片打标签的唯一来源 · 拖拽根标签到另一根标签上即成子标签（卡片标签同步为「父/子」）· 双击标签行直接改名</div>
        </div>
        <div class="tt-wrap">
        <!-- R4-a：迁移报告卡（组件化——GS 有 ≤3,560 行增长门禁，R164-2） -->
        <MigrateReportCard />
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">标签树</span><span class="gs-card-desc">最多两级：拖拽根标签到另一根标签上挂载为子标签</span></div>
          <div class="gs-card-body">
            <div class="gs-tagtree">
              <!-- 新建根标签：行内输入 -->
              <div v-if="ttEditing && !ttEditing.id && !ttEditing.parentId" class="gs-tt-row editing">
                <span class="gs-tt-ico">🏷</span>
                <input v-model="ttEditing.value" class="gs-tt-input" v-focus
                  placeholder="输入根标签名称，Enter 确认 · Esc 取消"
                  @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
              </div>
              <template v-for="root in tagTree" :key="root.id">
                <div class="gs-tt-row" :class="{editing: ttEditing?.id === root.id, flash: ttFlashId === root.id, active: ttActiveTag === root.name, drop: ttDropTarget === root.id}" :data-depth="tagDepth(root.id)" :style="{ paddingLeft: 8 + tagDepth(root.id) * 18 + 'px' }" draggable="true"
                  @dragstart="ttDragStart($event, root.id)" @dragend="ttDragEnd"
                  @dragover.prevent="ttDropTarget = root.id" @dragleave="ttDropTarget === root.id && (ttDropTarget = '')" @drop.prevent="ttDrop($event, root.id)" @click="selectTtTag(root.name)" @dblclick="ttRename(root.id)">
                  <span class="gs-tt-toggle" :class="{leaf: !safeChildren(root).length}" @click="ttToggle(root.id)">{{ ttCollapsed.has(root.id) ? '▸' : '▾' }}</span>
                  <input v-if="ttEditing?.id === root.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                    @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                  <template v-else>
                    <span class="gs-tt-name">#{{ root.name || '未命名标签' }}</span>
                    <span class="gs-tt-count">{{ tagUsage(root.name) }} 卡</span>
                    <span class="gs-tt-actions">
                      <span class="gs-tt-act" title="添加子标签" @click="ttAddChild(root.id)">＋</span>
                      <span class="gs-tt-act" title="重命名" @click="ttRename(root.id)">✎</span>
                      <span class="gs-tt-act del" title="删除" @click="ttRemove(root.id)">🗑</span>
                    </span>
                  </template>
                </div>
                <!-- 新建子标签：行内输入 -->
                <div v-if="ttEditing && !ttEditing.id && ttEditing.parentId === root.id" class="gs-tt-row editing" :style="{ paddingLeft: 8 + (tagDepth(root.id) + 1) * 18 + 'px' }">
                  <span class="gs-tt-ico">🏷</span>
                  <input v-model="ttEditing.value" class="gs-tt-input" v-focus
                    placeholder="输入子标签名称，Enter 确认 · Esc 取消"
                    @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                </div>
                <template v-if="!ttCollapsed.has(root.id)">
                  <div v-for="child in safeChildren(root)" :key="child.id" class="gs-tt-row subrow" :class="{editing: ttEditing?.id === child.id, flash: ttFlashId === child.id, active: ttActiveTag === root.name + '/' + child.name, drop: ttDropTarget === child.id}" :data-depth="tagDepth(child.id)" :style="{ paddingLeft: 8 + tagDepth(child.id) * 18 + 'px' }" draggable="true"
                    @dragstart="ttDragStart($event, child.id)" @dragend="ttDragEnd"
                    @dragover.prevent="ttDropTarget = child.id" @dragleave="ttDropTarget === child.id && (ttDropTarget = '')" @drop.prevent="ttDrop($event, child.id)" @click="selectTtTag(root.name + '/' + child.name)" @dblclick="ttRename(child.id)">
                    <input v-if="ttEditing?.id === child.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                      @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                    <template v-else>
                      <span class="gs-tt-name sub">#{{ child.name || '未命名标签' }}</span>
                                            <span class="gs-tt-count">{{ tagUsage(root.name + '/' + child.name) }} 卡</span>
                      <span class="gs-tt-actions">
                                                <span class="gs-tt-act" title="提升为根标签" @click="ttUnnest(root.id, child.id)">⇪</span>
                        <span class="gs-tt-act" title="重命名" @click="ttRename(child.id)">✎</span>
                        <span class="gs-tt-act del" title="删除" @click="ttRemove(child.id)">🗑</span>
                      </span>
                    </template>
                  </div>
                </template>
              </template>
              <div v-if="!tagTree.length && !ttEditing" class="gs-tt-empty">
                还没有标签 · 点击下方「＋ 新建根标签」开始搭建你的标签体系
              </div>
            </div>
                        <button class="gs-field-add" @click="ttAddRoot">＋ 新建根标签</button>
            <button class="gs-field-add" style="margin-left: 8px" @click="ttCollectFromCards">⤓ 从卡片收纳标签</button>
                        <div class="gs-field-hint">💡 重命名 / 删除 / 挂载会<b>同步更新卡片上的标签值</b>（子标签以「父/子」路径保存）；删除标签时，卡片上的对应标签一并移除。打标签入口：资源卡/任务卡/好奇心卡的详情编辑处。</div>
          </div>
        </div>
          <!-- R127：右列——当前标签下的卡片（三卡合一 / 类型过滤 / 搜索 / 多选拖拽移动） -->
          <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-title">#{{ ttActiveTag || '未选择标签' }}{{ ttActiveTag ? ' · ' + ttRows.length + ' 张' : '' }}</span><label v-if="ttActiveTag" class="gs-pan-allcheck"><input type="checkbox" :checked="ttAllChecked" @change="toggleTtAll" /> 全选本标签</label><button v-if="ttPicked.size" class="gs-btn ai-batch-btn" :disabled="!aiReady" title="对勾选卡片做 AI 批量补全（标签/描述/分类建议）" @click="aiTtEnrich"><AiEntryButton variant="inline" :label="'批量补全(' + ttPicked.size + ')'" /></button><span class="gs-card-desc">单击选中 · 双击详情 · 多选后拖到左侧标签即移动（替换）</span></div>
            <div class="gs-card-body">
              <div v-if="!ttActiveTag" class="gs-tt-empty">点击左侧标签查看其下卡片</div>
              <template v-else>
                <div class="tt-tools">
                  <select v-model="ttCardKind" class="gs-select">
                    <option value="all">全部类型</option>
                    <option value="resource">📦 资源卡</option>
                    <option value="task">✅ 任务卡</option>
                    <option value="curiosity">💡 好奇心卡</option>
                  </select>
                  <input v-model="ttCardQ" class="gs-tt-input" style="flex: 1" placeholder="搜索标题 / 链接 / 描述…" />
                  <span v-if="ttPicked.size" class="tt-picked">已选 {{ ttPicked.size }} 张 · 拖到左侧标签即可移动</span>
                </div>
                <div class="tt-list">
                  <div v-for="row in ttRows" :key="row.id" class="gs-pan-card" :class="{ selected: ttPicked.has(row.id), dragging: ttCardDragging && ttPicked.has(row.id) }" draggable="true"
                    @click="onTtRowClick(row)" @dblclick="onTtRowDblClick(row)" @dragstart="onTtRowDragStart($event, row)" @dragend="onTtRowDragEnd">
                    <input type="checkbox" class="gs-pan-check" :checked="ttPicked.has(row.id)" @click.stop @change="ttTogglePick(row.id)" />
                    <div class="gs-pan-card-main">
                      <div class="gs-pan-card-title">{{ row.kind === 'resource' ? '📦' : row.kind === 'task' ? '✅' : '💡' }} {{ row.title }}</div>
                      <div class="gs-pan-card-sub">{{ row.sub }}</div>
                    </div>
                  </div>
                  <div v-if="!ttRows.length" class="gs-ev-empty">该标签下暂无卡片</div>
                </div>
              </template>
            </div>
          </div>
        </div>
        <!-- R130-T2：详情抽屉必须挂在标签管理面板内——R127 误放进「资源台全景」面板（v-if activePage==='panorama'），
             在标签管理页该面板整体不渲染，双击 ttDetail 赋值后无人消费 → 抽屉永不出现 -->
        <Drawer :open="!!ttDetail" title="🏷 卡片详情" @close="ttDetail = null">
          <template v-if="ttDetail">
            <div class="gs-pd-title">{{ ttDetail.title }}</div>
            <div class="gs-pd-row" v-if="ttDetail.link"><span class="gs-pd-k">链接</span><span class="gs-pd-v">{{ ttDetail.link }}</span></div>
            <div class="gs-pd-row" v-if="ttDetail.desc"><span class="gs-pd-k">描述</span><span class="gs-pd-v">{{ ttDetail.desc }}</span></div>
            <div class="gs-pd-row"><span class="gs-pd-k">类型</span><span class="gs-pd-v">{{ ttDetail.kind === 'resource' ? '资源卡' : ttDetail.kind === 'task' ? '任务卡 · ' + (ttDetail.status === 'done' ? '已完成' : ttDetail.status === 'doing' ? '进行中' : '待开始') : '好奇心卡 · ' + (ttDetail.status || '') }}</span></div>
            <div class="gs-pd-row" v-if="ttDetail.tags.length"><span class="gs-pd-k">标签</span><span class="gs-pd-v">#{{ ttDetail.tags.join(' #') }}</span></div>
            <div class="gs-pd-actions">
              <button v-if="ttDetail.kind === 'resource' && ttDetail.link" class="gs-btn gs-btn-primary" @click="openCardLink({ link: ttDetail.link })">↗ 打开链接</button>
              <button class="gs-btn" @click="ttDetail = null">关闭</button>
            </div>
          </template>
        </Drawer>
      </div>

      <!-- ===== R134-F · AI 助手 ===== -->
      <div v-if="activePage === 'ai'" class="gs-panel">
      <!-- R148-T：AI 任务托盘——关抽屉继续跑，跑完在这儿能回来展开；不再"手滑一下全丢" -->
      <div v-if="aiTray.length" class="ai-tray">
        <div class="ai-tray-head">
          <b>AI 任务 {{ aiTray.length }}</b><span class="ai-tray-hint">关掉抽屉也在后台跑；同一功能再点=回到这份进度，跑完可「↻ 重新运行」</span>
          <button class="gs-btn sm ghost" @click="aiTrayClear">收起已完成</button>
        </div>
        <div v-for="s in aiTray" :key="s.key" class="ai-tray-row">
          <span class="ai-tray-dot" :class="s.phase"></span>
          <span class="ai-tray-t">{{ s.title }}</span>
          <span class="ai-tray-st">{{ s.phase === 'running' ? `跑动中 ${s.secs}s · 投料 ${s.feed.chars} 字 · ${s.feed.calls} 次请求` : s.phase === 'queued' ? '排队中（同时最多 2 个）' : s.phase === 'done' ? (s.savedNote || `完成 · ${s.rows.length} 条 · ${s.secs}s`) : s.phase === 'stopped' ? '已停止（本轮结果作废，可重跑）' : '失败：' + s.err.slice(0, 46) }}</span>
          <button class="gs-btn sm" @click="aiOpenState(s)">展开</button>
        </div>
      </div>
        <div class="gs-page-header">
          <div class="gs-page-title"><AiEntryButton variant="inline" large label="AI 助手" /> <span class="gs-dash-en">AI</span></div>
          <div class="gs-page-desc">接 OpenAI 兼容大模型 API · 建议经你审阅勾选后才写入 · 密钥仅存本机（独立键，不随数据导出包外发）</div>
        </div>

        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">🔌 接入配置</span><span class="gs-card-desc">DeepSeek / Kimi / 通义 / OpenAI 等兼容协议均可；模型可手填</span></div>
          <div class="gs-card-body ai-form">
            <label class="ai-field"><span>API 地址（baseUrl）</span><input class="gs-input" :value="aiConfig.baseUrl" placeholder="如 https://api.deepseek.com/v1" @change="patchAiConfig({ baseUrl: ($event.target as HTMLInputElement).value })" /></label>
            <label class="ai-field"><span>API Key</span><input class="gs-input" type="password" :value="aiConfig.apiKey" placeholder="sk-…（仅存本机 chrome.storage）" @change="patchAiConfig({ apiKey: ($event.target as HTMLInputElement).value })" /></label>
            <label class="ai-field"><span>模型</span>
              <input class="gs-input" list="ai-model-list" :value="aiConfig.model" placeholder="如 deepseek-chat" @change="patchAiConfig({ model: ($event.target as HTMLInputElement).value })" />
              <datalist id="ai-model-list"><option v-for="m in aiModels" :key="m" :value="m" /></datalist>
            </label>
            <div class="ai-form-row">
              <button class="gs-btn" :disabled="aiBusy !== '' || !aiConfig.baseUrl || !aiConfig.apiKey" @click="aiFetchModels">{{ aiBusy === 'models' ? '拉取中…' : '⬇ 拉取模型列表' }}</button>
              <button class="gs-btn" :disabled="aiBusy !== '' || !aiReady" @click="aiTestConn">{{ aiBusy === 'test' ? '测试中…' : '⚡ 测试连接' }}</button>
              <span v-if="aiMsg" class="ai-msg" :class="{ err: aiMsg.startsWith('⚠') }">{{ aiMsg }}</span>
            </div>
          </div>
        </div>

        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">🙋 关于我（全局画像 · 注入所有 AI 场景）</span><span class="gs-card-desc">写你在做什么、偏好什么风格、忌讳什么，模型不必每个场景重新交代背景</span></div>
          <div class="gs-card-body">
            <textarea class="ai-textarea" rows="3" :value="aiConfig.aboutMe" placeholder="例：在读研究生，主线是毕业论文 + 个人知识体系；建议直接、给可执行动作，不要客套话与空泛鼓励" @change="patchAiConfig({ aboutMe: ($event.target as HTMLTextAreaElement).value })" />
          </div>
        </div>

        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">🧠 深度诊断</span><span class="gs-card-desc">整库结构摘要投喂所选专家，逐员出「发现+建议」；勾选采纳=生成跟进任务卡</span></div>
          <div class="gs-card-body">
            <div class="ai-guide">三步上手：① 上方接入配置完成（⚡ 测试连接通过）→ ② 勾选本轮出诊专家（⚙ 可调启停 / 行文风格 / 自建资料）→ ③ 一键诊断。发现勾选采纳=逐条生成跟进任务卡；不采纳即纯看。</div>
            <div v-for="p in aiPersonas" :key="p.id" class="ai-pwrap">
              <div class="ai-persona-row">
                <label class="ai-persona"><input type="checkbox" :checked="aiPersonaSel.includes(p.id)" @change="aiTogglePersona(p.id)" /> {{ p.icon }} {{ p.name }}</label>
                <span class="ai-persona-brief">{{ p.brief }}</span>
                <button class="ai-btn-mini" :class="{ on: aiEditP === p.id }" title="调整该专家：出诊启停 / 行文风格" @click="aiEditP = aiEditP === p.id ? '' : p.id">⚙</button>
                <button v-if="p.id.startsWith('custom-')" class="ai-btn-mini danger" title="删除该自建专家" @click="aiRemovePersona(p.id)">✕</button>
              </div>
              <div v-if="aiEditP === p.id" class="ai-pedit">
                <label class="ai-persona"><input type="checkbox" :checked="aiPersonaCfg(p.id)?.enabled !== false" @change="aiPatchPersona(p.id, { enabled: ($event.target as HTMLInputElement).checked })" /> 参与会诊与执笔</label>
                <input class="gs-input" placeholder="风格覆盖（可选，如：直说问题、只给三个动作、少用形容词）" :value="aiPersonaCfg(p.id)?.style || ''" maxlength="120" @change="aiPatchPersona(p.id, { style: ($event.target as HTMLInputElement).value })" />
                <template v-if="!p.id.startsWith('custom-')">
                  <!-- R142（反馈 #6）：内置两员开放人设/关注面覆盖编辑，留空=用内置默认 -->
                  <textarea class="ai-textarea" rows="2" title="人设覆盖（留空=内置默认）" :value="p.brief" maxlength="120" @change="aiPatchPersona(p.id, { brief: ($event.target as HTMLTextAreaElement).value })" />
                  <textarea class="ai-textarea" rows="2" title="关注面覆盖（留空=内置默认）" :value="p.focus" maxlength="200" @change="aiPatchPersona(p.id, { focus: ($event.target as HTMLTextAreaElement).value })" />
                  <div><button class="ai-btn-mini" style="width:auto; padding:2px 8px;" title="清空覆盖，恢复内置默认人设与关注面" @click="aiPatchPersona(p.id, { brief: '', focus: '' })">↺ 恢复内置默认</button></div>
                </template>
                <template v-if="p.id.startsWith('custom-')">
                  <div class="ai-pedit-row">
                    <input class="gs-input" :value="p.name" maxlength="12" placeholder="专家名" @change="aiCustomPatch(p.id, 'name', ($event.target as HTMLInputElement).value)" />
                    <input class="gs-input" :value="p.brief" maxlength="40" placeholder="人设一句话" @change="aiCustomPatch(p.id, 'brief', ($event.target as HTMLInputElement).value)" />
                  </div>
                  <input class="gs-input" :value="p.focus" maxlength="120" placeholder="关注面（它体检/执笔时盯什么）" @change="aiCustomPatch(p.id, 'focus', ($event.target as HTMLInputElement).value)" />
                </template>
              </div>
            </div>
            <div class="ai-pnew">
              <input class="gs-input" v-model="aiNewP.name" placeholder="专家名（如：财务顾问）" maxlength="12" />
              <input class="gs-input" v-model="aiNewP.brief" placeholder="人设一句话（可选）" maxlength="40" />
              <input class="gs-input" v-model="aiNewP.focus" placeholder="关注面（它体检时盯什么）" maxlength="120" />
              <button class="gs-btn" @click="aiAddPersona">＋ 自建专家</button>
            </div>
            <div class="ai-form-row">
              <select class="gs-input ai-depth" :value="aiConfig.depth" @change="patchAiConfig({ depth: ($event.target as HTMLSelectElement).value as AiDepth })">
                <option value="eco">经济档（最小投料）</option><option value="std">标准档</option><option value="deep">深度档（最大上下文）</option>
              </select>
              <select class="gs-input ai-depth" title="拆解/生成/优化场景的默认执笔专家；打开抽屉后仍可临时换人" :value="aiConfig.defaultPersona || 'default'" @change="patchAiConfig({ defaultPersona: ($event.target as HTMLSelectElement).value })">
                <option value="default">🧑‍🏫 默认执笔：场景内置角色</option>
                <option v-for="p in aiPersonas.filter(x => personaOverrides()[x.id]?.enabled !== false)" :key="p.id" :value="p.id">{{ p.icon }} {{ p.name }} 执笔</option>
              </select>
              <button class="gs-btn gs-btn-primary" :disabled="!aiReady" @click="aiDiagnose">🧠 一键诊断</button>
            </div>
          </div>
        </div>

        <div class="gs-card">
          <!-- R158：被动型 AI 入口（跨台镜像/主题漂移/沉睡唤醒）迁 AI 建议面板（命令面板 Ctrl+K → AI 建议）；
               本页只留主动型（回收站捞回 / 本周回顾 / 成果文稿）与轻量指引 -->
          <div class="gs-card-header"><span class="gs-card-title">🧭 库内治理与成文</span><span class="gs-card-desc">主动型：回收站捞回 / 本周回顾 / 成果文稿（标签体检与整体梳理在「标签管理」页；被动建议在命令面板 Ctrl+K → AI 建议）</span></div>
          <div class="gs-card-body ai-form-row">
            <button class="gs-btn" :disabled="!aiReady" @click="aiTrashRescue">🗑 回收站捞回</button>
            <button class="gs-btn" :disabled="!aiReady" title="近 7 天台账 → 周回顾草稿；跑完自动存为一张周回顾卡（同日重跑只刷新那张）" @click="aiWeeklyReview">🗓 本周回顾</button>
            <label class="ai-field inline"><input class="gs-input ai-genre" type="text" v-model="aiGenre" placeholder="体裁（可留空）：公众号短文 / 分享稿 / 结项说明…" @keydown.enter.prevent="aiDeliver" /></label>
            <button class="gs-btn" :disabled="!aiReady" title="论点卡 + 活跃目标 + 近 30 天完成 → 一篇可交付文稿；跑完自动存为一张成果文稿卡（同日重跑只刷新那张），也可下载 .md" @click="aiDeliver">📄 成果文稿</button>
          </div>
        </div>

        <p class="gs-field-hint">隐私与性能口径：仅投本场景相关实体文本（KB 级），附件本体与其它数据不出本机；全部手动触发、无常驻轮询；AI 建议不入库，勾选采纳才落。</p>
      </div>

      <!-- ===== 导入数据 ===== -->
      <div v-if="activePage === 'import'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⬇ 导入数据</div>
          <div class="gs-page-desc">从外部导入资源卡或策展台数据，导入时与现有数据取并集</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">导入方式</span></div>
          <div class="gs-card-body">
            <div class="gs-import-option" @click="triggerFileImport">
              <div class="gs-io-icon">📦</div>
              <div><div class="gs-io-name">导入知源调度台数据</div><div class="gs-io-desc">选择 JSON 文件，与现有数据取并集（同 ID 更新，不同 ID 新增）；全量包附带界面偏好（主题/密度）时自动应用。<b>导入前会先自动下载一份当前数据备份</b>（防误合并，不含 Airtable 凭证）</div></div>
              <button class="gs-btn gs-btn-primary gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="assetPackInput?.click()">
              <div class="gs-io-icon">🗂</div>
              <div><div class="gs-io-name">导入附件包</div><div class="gs-io-desc">选择「导出附件包」生成的 zip，附件本体按 assetId 写回（同 ID 覆盖）；先导 JSON 再导附件包 = 完整迁移</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="bookmarkInput?.click()">
              <div class="gs-io-icon">🔖</div>
              <div><div class="gs-io-name">导入书签文件</div><div class="gs-io-desc">选择浏览器导出的书签 HTML：<b>本页只把文件夹层级写成标签</b>，链接 + 标题进资源卡；文件夹→分类的建树导入已随资源台退役。</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <!-- R154（E3）：导入完不再自动弹评审抽屉——它抢焦点、也没人点过它。改成回执上的显式入口 -->
            <div v-if="pendingImportEnrich && pendingImportEnrich.length" class="gs-setting-row" style="margin-top:6px">
              <span class="gs-sr-label">刚导入 {{ pendingImportEnrich.length }} 张卡</span>
              <div class="gs-sr-control">
                <button class="gs-btn" :disabled="!aiReady" @click="aiImportEnrichNow">{{ aiReady ? '归类并补全这批' : '先在 AI 助手完成接入' }}</button>
                <button class="gs-btn" @click="pendingImportEnrich = null">这次不用</button>
              </div>
            </div>
            <div class="gs-setting-row" style="margin-top:6px">
              <span class="gs-sr-label">书签导入到</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="bookmarkTargetWs">
                  <option value="__new__">🆕 新建「🔖 书签导入 <今天日期>」策展台</option>
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="handleFileImport" />
        <input ref="assetPackInput" type="file" accept=".zip" style="display:none" @change="handleAssetPackImport" />
        <input ref="bookmarkInput" type="file" accept=".html,.htm" style="display:none" @change="handleBookmarkImport" />
      </div>

      <!-- ===== 导出数据 ===== -->
      <div v-if="activePage === 'export'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⬆ 导出数据</div>
          <div class="gs-page-desc">导出数据用于备份或跨设备迁移（全量 JSON + 附件包两步才算完整迁移）</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">备份提醒</span></div>
          <div class="gs-card-body">
            <!-- V2.20.1 BUG-2：存量归属修复记录（静默回填，仅修复时显示） -->
            <div v-if="gd.projBackfillFixed" class="gs-export-row">
              <div class="gs-er-info">
                <div class="gs-er-name">🛠 存量归属修复（V2.20.1）</div>
                <div class="gs-er-desc">启动时已自动修复 {{ gd.projBackfillFixed }} 个任务的项目归属（有成功指标但缺项目关联的历史数据，按指标反查所属项目补齐），数据一致性已恢复。</div>
              </div>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info">
                <div class="gs-er-name">自动提醒</div>
                <div class="gs-er-desc">
                  开启后，若 30 天未导出备份、或存储容量超过 50 MB 时，顶部右上角显示红点提醒。
                  {{ backupReminderEnabled ? '当前已启用' : '当前已关闭' }}
                  {{ lastBackupAt ? '· 上次导出：' + formatBackupAgo(lastBackupAt) : '· 尚无导出记录' }}
                </div>
              </div>
              <label class="gs-switch">
                <input type="checkbox" :checked="backupReminderEnabled" @change="toggleBackupReminder" />
                <span class="gs-switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">导出方式</span></div>
          <div class="gs-card-body">
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出全部数据</div><div class="gs-er-desc">全量JSON：调度台（愿景/使命/方向/项目/成功指标）+ 方向台（策展台/三卡/标签/统计）及全部数据关系，用于整体迁移备份</div></div>
              <button class="gs-btn gs-btn-primary" @click="exportAll">导出</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">按策展台导出 CSV</div><div class="gs-er-desc">字段：系统字段全导 + 自定义字段按可见性，列名/顺序跟随「字段管理」；尾随 链接类型/分类/置顶/星标/更新时间，适配 Airtable 等多维表</div></div>
              <select class="gs-select" v-model="csvWsId">
                <option value="">选择策展台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
              </select>
              <button class="gs-btn" @click="exportCsvForWorkspace" :disabled="!csvWsId">导出CSV</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出指定策展台</div><div class="gs-er-desc">选择一个策展台导出为 JSON（只含该台的分类与卡，用于跨设备搬台）</div></div>
              <select class="gs-select" v-model="exportWsId">
                <option value="">选择策展台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
              </select>
              <button class="gs-btn" @click="exportWorkspace" :disabled="!exportWsId">导出</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出为Markdown</div><div class="gs-er-desc">将资源卡导出为带链接和注解的Markdown文档</div></div>
              <button class="gs-btn" @click="exportMarkdown">导出MD</button>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">📎 附件存储</span><span class="gs-card-desc">图片/HTML 本体在 IndexedDB，不占主数据</span></div>
          <div class="gs-card-body">
            <div class="gs-export-row">
              <div class="gs-er-info">
                <div class="gs-er-name">附件占用：{{ assetCount }} 个 · {{ formatBytes(assetBytes) }}</div>
                <div class="gs-er-desc">JSON 导出不含附件本体（保持轻量）；附件本体用下方附件包导出/导入迁移</div>
              </div>
              <button class="gs-btn" @click="refreshAssetStats">刷新</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出附件包</div><div class="gs-er-desc">全部附件本体打包为 zip；与「导出全部数据 JSON」配合 = 完整可迁移备份</div></div>
              <button class="gs-btn gs-btn-primary" @click="exportAssetPack">导出附件包</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">清理孤儿附件</div><div class="gs-er-desc">删除未被任何卡片引用的残留附件（上传中断等异常场景产生）</div></div>
              <button class="gs-btn" @click="cleanupOrphanAssetsAction">清理</button>
            </div>
          </div>
        </div>
        <DataCheckupCard v-if="activePage === 'export'" /><!-- R171-A2/A3 数据体检卡：独立组件（R164-2 增长门禁） -->
      </div>

      <!-- ===== 快捷键设置 ===== -->
      <div v-if="activePage === 'shortcuts'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⌨ 快捷键设置</div>
          <div class="gs-page-desc">💡 系统级快捷键（含方向台/资源台/完整方向树/任务调度）请在浏览器地址栏打开 chrome://extensions/shortcuts 自定义（高效使用知源的第一步）；应用内快捷键开箱即用</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">全局快捷键（任意网页可用）</span><span class="gs-card-desc">由 Chrome 统一管理 · 方向台/资源台/完整方向树无默认键，需手动分配</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row" v-for="c in chromeCommands" :key="c.name">
              <span class="gs-sr-label">{{ c.description }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ c.shortcut || '未设置' }}</span></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">修改全局快捷键（完整方向树等）</span>
              <div class="gs-sr-control"><a :href="shortcutsUrl" target="_blank" class="gs-shortcut-link">前往 chrome://extensions/shortcuts ›</a></div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">应用内快捷键</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">应用内切台</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="wsMod" @change="saveWsMod">
            <option value="alt">Alt + 数字键（1=调度台、2=方向台、3 起=各策展台）</option>
            <option value="ctrl">Ctrl + 数字键（1=调度台、2=方向台、3 起=各策展台）</option>
                  <option value="ctrl-shift">Ctrl + Shift + 数字键</option>
                  <option value="alt-shift">Alt + Shift + 数字键</option>
                  <option value="none">纯数字键（无修饰键）</option>
                </select>
              </div>
            </div>
            <div class="gs-setting-row" v-for="k in appShortcuts" :key="k.label">
              <span class="gs-sr-label">{{ k.label }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ k.keys }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 策展台快捷键（R49-I2 引入；V3.7.0 R179：资源台退役后策展台顺延——1=调度台、2=方向台、3 起=各策展台） ===== -->
      <div v-if="activePage === 'shortcuts'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🎛 策展台快捷键</div>
          <div class="gs-page-desc">应用内按「修饰键 + 数字」切台：1 = 调度台、2 = 方向台、3 起按台签顺序对应各策展台（拖拽改序后数字键跟随顺序）；完整方向树等浏览器级命令在 chrome://extensions/shortcuts 自定义</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">映射表（按顶部导航顺序）</span><span class="gs-card-desc">第 N 个策展台 = 修饰键 + (N+2)（最多到数字 9）</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row" v-for="(w, i) in store.workspaces" :key="w.id">
              <span class="gs-sr-label">第 {{ i + 1 }} 个 · {{ w.icon }} {{ wsDisplayNameOf(w) }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ i + 3 <= 9 ? modLabel() + ' + ' + (i + 3) : '—' }}</span></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">修饰键</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ modLabel() }} + 数字</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Airtable 同步（R63-4：单向推送，手动为主） ===== -->
      <div v-if="activePage === 'airtable'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⇄ Airtable 同步</div>
          <div class="gs-page-desc">单向：知源 → Airtable，绝不回写本地 · 缺失字段自动创建（已存在列不改名不改类型，计算列不碰）· 软删卡置「已删除」勾选不物理删 · 手动触发为主</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">连接配置</span><span class="gs-card-desc">PAT 明文仅存本机 chrome.storage.local，随设备不跨端</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">Personal Access Token</span>
              <div class="gs-sr-control"><input class="gs-input" type="password" v-model="atPat" placeholder="pat…（需 data.records 读写 + schema.bases 写权限）" style="width:320px" /></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">Base ID</span>
              <div class="gs-sr-control"><input class="gs-input" v-model="atBaseId" placeholder="app 开头" style="width:260px" /></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">Table ID</span>
              <div class="gs-sr-control"><input class="gs-input" v-model="atTableId" placeholder="tbl 开头（表 URL 中获取）" style="width:260px" /></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">连接测试</span>
              <div class="gs-sr-control" style="display:flex;gap:10px;align-items:center">
                <button class="gs-btn" :disabled="atBusy || !atPat || !atBaseId || !atTableId" @click="testAtConnection">{{ atBusy ? '测试中…' : '测试连接' }}</button>
                <span v-if="atTableName" style="font-size: var(--fs-sub);color:var(--ok,var(--info-green,#3A6B4C))">✓ 已连上「{{ atTableName }}」</span>
              </div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步范围与触发</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">同步范围</span>
              <div class="gs-sr-control" style="font-size: var(--fs-sub);color:var(--text-2);max-width:380px;line-height:1.7;text-align:left">调度台好奇心卡 · 方向台任务卡 · 资源台资源卡 · 各策展台镜像卡（每条镜像为独立记录，带各自所属工作台标识）· 主题卡以「是否中心论点」列体现</div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">增量游标</span>
              <div class="gs-sr-control" style="font-size: var(--fs-sub);color:var(--text-2)">只推上次同步后有更新的卡（updatedAt 游标）</div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">3 小时自动轮询</span>
              <div class="gs-sr-control">
                <label class="gs-switch">
                  <input type="checkbox" :checked="atPoll" @change="toggleAtPoll" />
                  <span class="gs-switch-slider"></span>
                </label>
              </div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">立即同步</span>
              <div class="gs-sr-control" style="display:flex;gap:10px;align-items:center">
                <button class="gs-btn gs-btn-primary" :disabled="atBusy || !atPat || !atBaseId || !atTableId" @click="runAtSync">{{ atBusy ? '同步中…' : '立即同步' }}</button>
                <span v-if="quotaText" style="font-size: var(--fs-sub);color:var(--text-3)">{{ quotaText }}</span>
              </div>
            </div>
            <div class="gs-setting-row" v-if="atStatusText">
              <span class="gs-sr-label">上次同步</span>
              <div class="gs-sr-control" style="font-size: var(--fs-sub);color:var(--text-2)">{{ atStatusText }}</div>
            </div>
            <div class="gs-setting-row" v-if="atErrorText">
              <span class="gs-sr-label">上次错误</span>
              <div class="gs-sr-control" style="font-size: var(--fs-sub);color:var(--danger,#c0392b)">{{ atErrorText }}</div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步日志</span><span class="gs-card-desc">最近 {{ atLog.length }} 条（最多保留 40 条）</span></div>
          <div class="gs-card-body">
            <div v-if="!atLog.length" class="gs-ev-empty">暂无同步记录——配置完成后点「立即同步」</div>
            <div v-for="(l, i) in atLog" :key="i" class="gs-setting-row" style="align-items:flex-start">
              <span class="gs-sr-label" style="white-space:nowrap">{{ new Date(l.at).toLocaleString('zh-CN') }}</span>
              <div class="gs-sr-control" style="font-size: var(--fs-sub);text-align:left;max-width:420px;color:var(--text-2)">{{ l.kind === 'error' ? '✗ ' : l.kind === 'ok' ? '✓ ' : '· ' }}{{ l.msg }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 使用手册（第廿一轮：独立页入口） ===== -->
      <div v-if="activePage === 'manual'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">📖 产品使用手册</div>
          <div class="gs-page-desc">速览 / 基础 / 方法 / 理念 / 附录 —— 五篇图文教程，独立页面阅读体验最佳</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body" style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:40px 20px;text-align:center">
            <div style="font-size:34px">📖</div>
            <div style="font-size: var(--fs-title);font-weight:600;color:var(--text)">使用手册已升级为独立阅读页</div>
            <div style="font-size: var(--fs-sub);color:var(--text-3);line-height:1.8;max-width:420px">五篇结构：速览一页上手 → 基础篇 → 方法篇（认知增强方法论）→ 理念篇（知源哲学与理论根基）→ 附录（快捷键全表与数据安全）。点击下方按钮在新标签页打开，支持左侧目录锚点定位。</div>
            <button class="gs-manual-open" @click="openManualTab">📖 打开使用手册（新标签页）</button>
          </div>
        </div>
      </div>

      <!-- ===== 写给用户的一封信 ===== -->
      <div v-if="activePage === 'letter'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">✉️ 写给用户的一封信</div>
          <div class="gs-page-desc">donge 哥 · 致每一位知源调度台的同行者</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body gs-letter" v-html="LETTER_HTML"></div>
        </div>
        <div style="text-align:center;margin-top:14px">
          <button class="gs-manual-open" @click="downloadLetter">⬇ 下载这封信（分享 HTML）</button>
        </div>
      </div>

      <!-- ===== 重置与回滚 ===== -->
      <div v-if="activePage === 'reset'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🔄 重置与回滚</div>
          <div class="gs-page-desc">危险操作，请谨慎执行，建议操作前先导出备份</div>
        </div>
        <div class="gs-card gs-danger-zone">
          <div class="gs-card-header"><span class="gs-card-title">⚠ 危险操作区</span></div>
          <div class="gs-card-body">
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">一键回滚至初始状态</div><div class="gs-da-desc">清空所有用户创建的策展台和所有资源卡、好奇心卡、任务卡，仅保留调度台、方向台（任务中心）和默认策展台</div></div>
              <button class="gs-btn gs-btn-danger" @click="showResetModal = true">回滚</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">回收站</div><div class="gs-da-desc">浏览 / 恢复已删除的卡片，或永久删除</div></div>
              <button class="gs-btn" @click="router.push('/recycle')">进入</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">清空回收站</div><div class="gs-da-desc">永久删除所有已移入回收站的卡片，不可恢复</div></div>
              <button class="gs-btn gs-btn-danger" @click="emptyRecycleBin">清空</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">清除缓存</div><div class="gs-da-desc">清除 AI 抓过的网页正文与会话抽读缓存（内存态）；卡片数据与附件本体不动</div></div>
              <button class="gs-btn" @click="clearCache">清除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 扩展设置 ===== -->
      <div v-if="activePage === 'extension'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🔌 浏览器扩展设置</div>
          <div class="gs-page-desc">配置浏览器扩展的连接和抓取行为</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">连接状态</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">扩展状态</span>
              <div class="gs-sr-control"><span class="gs-status-badge connected"><span class="gs-status-dot"></span>已连接</span></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">扩展版本</span>
              <div class="gs-sr-control" style="color:var(--text-2);font-size: var(--fs-sub)">V{{ runtimeVersion }}</div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">抓取设置</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">快速抓取快捷键</span>
              <div class="gs-sr-control">
                <a :href="shortcutsUrl" target="_blank" class="gs-keycap gs-keycap-link">Ctrl+Shift+J</a>
              </div>
            </div>
            <!-- R1.5：「默认存入台面」选择器随资源台退役删除——采集单形态落「🗂 资源卡池」，defaultWsId 零消费方 -->
            <div class="gs-setting-row">
              <span class="gs-sr-label">自动取文件夹名</span>
              <div class="gs-sr-control"><div class="gs-toggle" :class="{ on: capturePref.autoFolderName }" @click="capturePref.autoFolderName = !capturePref.autoFolderName; persistCapturePref()"></div></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">抓取后确认弹窗</span>
              <div class="gs-sr-control"><div class="gs-toggle on" @click="showToast('快捷键采集始终显示确认弹窗')"></div></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">全局快捷键配置</span>
              <div class="gs-sr-control">
                <a :href="shortcutsUrl" target="_blank" class="gs-shortcut-link">前往 chrome://extensions/shortcuts ›</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 关于 ===== -->
      <div v-if="activePage === 'about'" class="gs-panel">
        <div class="gs-page-header"><div class="gs-page-title">ℹ 关于</div></div>
        <div class="gs-card">
          <div class="gs-card-body gs-about-card">
            <div class="gs-about-logo"><img :src="logoUrl" alt="知源调度台" /></div>
            <div class="gs-about-name">知源调度台</div>
            <div class="gs-about-version">版本 V{{ runtimeVersion }}</div>
            <div class="gs-about-motto">万千可调用，自有我方向。</div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body">
            <div class="gs-about-row">
              <span class="label">数据存储</span>
              <span class="value">
                全部在本地，不上传云端
                <span v-if="bytesInUse > 0" class="gs-storage-detail">
                  · 当前占 {{ formatBytes(bytesInUse) }}
                  <template v-if="!unlimitedStorage"> / 配额上限 10 MB</template>
                  <template v-else>（已申请 unlimitedStorage，无 10 MB 上限）</template>
                </span>
              </span>
            </div>
            <div v-if="saveError" class="gs-about-row gs-about-row-danger">
              <span class="label">⚠ 写入异常</span>
              <span class="value">
                <span class="gs-save-error-kind">{{ saveErrorLabel(saveError.kind) }}</span>
                · {{ saveError.message }}
                <span v-if="saveError.bytesInUse != null">（当前 {{ formatBytes(saveError.bytesInUse) }}）</span>
                <span class="gs-link" @click="markSaveErrorRead" style="margin-left:8px">已处理 ›</span>
              </span>
            </div>
            <div class="gs-about-row"><span class="label">检查更新</span><span class="value gs-link" @click="showToast('当前已是最新版本')">检查更新 ›</span></div>
            <div class="gs-about-row"><span class="label">开源致谢</span><span class="value gs-link" @click="showToast('Vue 3 · TypeScript · Vite · Pinia · @crxjs')">查看 ›</span></div>
          </div>
        </div>
      </div>
    </main>

    <!-- R134-F：AI 建议评审抽屉（批量补全/沉睡唤醒/深度诊断共用消费面） -->
    <AiSuggestionDrawer v-if="aiJob" :job="aiJob" :job-key="aiJobKey || undefined" @close="aiJobClosed" />

    <!-- 回滚确认弹窗 -->
    <Teleport to="body">
      <div class="gs-modal-overlay" :class="{ open: showResetModal }" @click.self="closeResetModal">
        <div class="gs-modal">
          <div class="gs-modal-header">⚠ 确认回滚至初始状态</div>
          <div class="gs-modal-body">
            <p>此操作将清空所有用户创建的策展台和所有资源卡、好奇心卡、任务卡，<b style="color:var(--danger)">仅保留调度台、方向台（任务中心）和默认策展台</b>。</p>
            <p>此操作<b style="color:var(--danger)">不可恢复</b>，建议先导出数据备份。</p>
            <p>请输入 <b>"回滚"</b> 以确认：</p>
            <input v-model="resetConfirmText" type="text" class="gs-confirm-input" placeholder="请输入 回滚" />
          </div>
          <div class="gs-modal-footer">
            <button class="gs-btn" @click="closeResetModal">取消</button>
            <button class="gs-btn gs-btn-danger" :disabled="resetConfirmText !== '回滚'" :style="{ opacity: resetConfirmText === '回滚' ? 1 : 0.5, cursor: resetConfirmText === '回滚' ? 'pointer' : 'not-allowed' }" @click="doReset">确认回滚</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'GlobalSettingsView' })

import { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, shallowRef } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { saveUIPrefs, loadUIPrefs, getBytesInUse, subscribeSaveError, getLastSaveError, clearLastSaveError, hasUnlimitedStorage, stripRetiredCardKeys } from '@/shared/storage/repository'
import { K, EXPORT_MARKERS } from '@/shared/storage/keys'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import FieldEditor from './FieldEditor.vue'
const logoUrl = '/icons/icon128.png' // R174-2 减重：与 public/icons/icon128.png 逐字节同源，走公共路径不再重复入库
import { createDefaultData, defaultThesisFieldDefs } from '@/shared/storage/defaults'
// R63-4：Airtable 单向同步（连接测试 / 立即同步 / 配额提示）
import { testConnection, runSync, quotaHint, catPathOf } from '@/shared/storage/airtable'
import { LETTER_HTML, buildLetterStandaloneHtml } from '../letter-data'
import { uid, dateKey, weekStartKey } from '@/shared/utils'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { getAssetStats, cleanupOrphanAssets, getAllAssets, putAssets } from '@/shared/storage/assets'
import { purgeCardsCompletely, recycledCardsOf } from '@/shared/storage/purge'
import { clearHot } from '@/shared/storage/hotStats'
import { getMutationSeq } from '@/shared/storage/repository'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import { buildZip, readZip, type ZipEntry } from '@/shared/utils/zip'
import { visibleFields, allFields } from '@/shared/utils/fields'
import { sanitizeCardCols } from '@/shared/utils/cardCols'
import { sanitizeWsView } from '@/shared/utils/wsView'
import { assetSummary } from '@/shared/utils/assetKind'
import type { FieldDef, AppData, ResourceCard, TaskCard, CuriosityCard, Workspace, Category, TagNode, AssetMeta, ID } from '@/shared/models'
// R63-1/63-2：全景两级（资源台/策展台）与导出镜像卡适配
import { isHubWs, boardCardsOf, isMirrorView, sanitizeThesisDuplicates } from '@/shared/storage/hub'
import DataCheckupCard from '../components/DataCheckupCard.vue'
import MigrateReportCard from '../components/MigrateReportCard.vue'
import { CURATION_WS_ID } from '@/shared/models'
// R113-N2：资源生命周期聚合页（入口从三宿主收敛至此；内嵌式面板 + 三类卡聚合 + 跨台定位）
import LifecyclePanel, { type LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  setCoolingDefaultDays, coolingDefaultDaysOf
} from '@/shared/utils/lifecycle'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
// R134-F（批次 F）：AI 助手——地基三件套（config/llm/projector/scenarios）+ 建议评审抽屉。
// 性能纪律：shared/ai 只被懒加载路由（设置页/详情抽屉）静态消费，不进启动链；密钥存独立键 zy_ai_v1 不随导出。
import AiSuggestionDrawer from '@/newtab/components/AiSuggestionDrawer.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, patchAiConfig, aiReady, type AiDepth } from '@/shared/ai/config'
import { listModels, testConnection as aiTestConnection, chatStream, extractJson } from '@/shared/ai/llm'
import { projectCards, projectLibrary, catPathOf as aiCatPathOf } from '@/shared/ai/project'
import { batchEnrichSystem, diagnosisSystem, allPersonas, personaOverrides, sanitizeRefs, type EnrichSuggestion } from '@/shared/ai/scenarios'
import { buildTagGovernJob, buildTrashRescueJob, buildTagBlueprintJob, buildTagAssignJob, consumeTagBlueprintAdopted, getTagReviseBackup, restoreTagReviseBackup , reviseSnips } from '@/shared/ai/govern'
import { clearLinkCache } from '@/shared/ai/linkFetch'
import { buildReviewJob } from '@/shared/ai/select'
import { withReport } from '@/shared/ai/reports'
import { listJobStates, clearFinished, type JobState } from '@/shared/ai/runner'
import { buildDeliverJob } from '@/shared/ai/batchG'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const shortcutsUrl = 'chrome://extensions/shortcuts'

// ---- 使用手册独立页入口 ----
function downloadLetter() {
  const blob = new Blob([buildLetterStandaloneHtml()], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '写给用户的一封信.html'
  a.click()
  URL.revokeObjectURL(url)
}
function openManualTab() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') + '#/manual' })
  } else {
    router.push('/manual')
  }
}

// ---- 导航 ----
/** R146（回退契约 ⑨）：导航项可挂路由出口——回收站是整页（列表+批量操作），设置页内不重复实现一份 */
interface NavItem { key: string; icon?: string; label: string; route?: string; mark?: boolean }
function onNavClick(item: NavItem) {
  if (item.route) { router.push(item.route); return }
  activePage.value = item.key
}
// 第卌四轮 T-03：设置默认首屏 = 知源仪表盘
const activePage = ref('dashboard')
/** 深链：/settings?page=tags 直达指定面板（TagPicker 空体系引导跳转用） */
function pageFromQuery(): string | null {
  const p = route.query.page
  if (typeof p !== 'string') return null
  return navGroups.some(g => g.items.some(i => i.key === p && !i.route)) ? p : null
}
onMounted(() => {
  const p = pageFromQuery(); if (p) activePage.value = p
  // 第卅六轮 REQ-038：关于页容量水位 + 保存错误订阅 + 备份提醒状态
  refreshStorage()
  // REQ-048：深链直达导出页时初始化附件统计
  if (activePage.value === 'export') refreshAssetStats()
  const unsub = subscribeSaveError((e) => { saveError.value = e })
  // 卸载时取消订阅（实例可能被路由复用）
  return () => unsub && unsub()
})

/** 第卅六轮 REQ-038：关于页运行时版本号 + 数据水位 + 错误显示 */
const runtimeVersion = (() => {
  try {
    const m = (chrome as any)?.runtime?.getManifest?.()
    return m?.version || '?'
  } catch { return '?' }
})()
const bytesInUse = ref(0)
const unlimitedStorage = ref(hasUnlimitedStorage())
const saveError = ref(getLastSaveError())
async function refreshStorage() {
  bytesInUse.value = await getBytesInUse()
}
function markSaveErrorRead() {
  clearLastSaveError()
  saveError.value = null
  showToast('已清除异常标记')
}
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
function saveErrorLabel(k: 'quota' | 'serial' | 'unknown'): string {
  return k === 'quota' ? '配额超限' : k === 'serial' ? '序列化失败' : '写入异常'
}

// ---- REQ-048：附件存储统计 + 孤儿清理（导出数据页） ----
const assetCount = ref(0)
const assetBytes = ref(0)
async function refreshAssetStats() {
  try {
    const s = await getAssetStats()
    assetCount.value = s.count
    assetBytes.value = s.bytes
  } catch (err) {
    console.error('[assets] stats failed:', err)
  }
}
/** 清理孤儿：保留所有卡片（含回收站软删卡）引用的附件，删除其余 */
async function cleanupOrphanAssetsAction() {
  try {
    const keep = new Set<string>()
    const collect = (cards: AssetMeta[] | undefined) => (cards || []).forEach(m => keep.add(m.id))
    const all = store.data
    if (all) {
      all.resources.forEach(r => collect(r.assets))
      all.tasks.forEach(t => collect(t.assets))
      all.curiosities.forEach(c => collect(c.assets))
    }
    const n = await cleanupOrphanAssets(keep)
    await refreshAssetStats()
    if (n > 0) showToast(`🧹 已清理 ${n} 个孤儿附件`)
    else showToast('✓ 无孤儿附件，一切干净')
  } catch (err) {
    console.error('[assets] cleanup failed:', err)
    showToast('⚠ 清理失败，请重试')
  }
}
watch(activePage, (p) => { if (p === 'export') refreshAssetStats() })
// ---- 第卌二轮 REQ-059：附件包导出/导入（zip STORE 模式，零依赖） ----
/** 导出附件包：全部附件本体 → 附件包 zip（manifest + assets/<id> 原件）。与主数据 JSON 备份配合 = 完整可迁移备份 */
async function exportAssetPack() {
  try {
    const all = await getAllAssets()
    if (!all.length) { showToast('暂无附件可导出'); return }
    const manifest = JSON.stringify({
      type: EXPORT_MARKERS.ASSET_PACK, version: 1, exportedAt: new Date().toISOString(), count: all.length,
      items: all.map(a => ({ id: a.id, size: a.blob.size, mime: a.blob.type || '' }))
    }, null, 2)
    const entries: ZipEntry[] = [
      { name: 'manifest.json', data: new TextEncoder().encode(manifest) }
    ]
    for (const a of all) entries.push({ name: `assets/${a.id}`, data: new Uint8Array(await a.blob.arrayBuffer()) })
    const zip = buildZip(entries)
    const url = URL.createObjectURL(zip)
    const aEl = document.createElement('a')
    aEl.href = url; aEl.download = `zhiyuan_assets_${dateStr()}.zip`; aEl.click()
    URL.revokeObjectURL(url)
    showToast(`✓ 附件包已导出：${all.length} 个附件`)
  } catch (err) {
    console.error('[assets] export pack failed:', err)
    showToast('⚠ 附件包导出失败，请重试')
  }
}

/** 导入附件包：解包 zip → 按 assetId 写回 zy_assets（同 ID 覆盖，q-3 拍板） */
async function handleAssetPackImport(e: Event) {
  const input = e.target as HTMLInputElement
  // ⚠ 第卌一轮教训：先快照再清空 input.value（清空会重置 FileList）
  const file = (input.files || [])[0]
  input.value = ''
  if (!file) return
  try {
    const entries = readZip(await file.arrayBuffer())
    const assets = entries.filter(en => en.name.startsWith('assets/'))
    if (!assets.length) { showToast('⚠ 附件包内无附件数据（manifest 或 zip 格式不符）'); return }
    await putAssets(assets.map(en => ({ id: en.name.slice('assets/'.length), blob: new Blob([en.data]) })))
    await refreshAssetStats()
    showToast(`✓ 附件包导入完成：${assets.length} 个附件（同 ID 已覆盖）`)
  } catch (err) {
    console.error('[assets] import pack failed:', err)
    showToast(`⚠ 附件包导入失败：${err instanceof Error ? err.message : '格式不符'}`)
  }
}

/** 第卅六轮 REQ-038：备份提醒开关 + 上次备份时间 */
const backupReminderEnabled = ref<boolean>(typeof store.ui?.backupReminderEnabled === 'boolean' ? store.ui.backupReminderEnabled : true)
const lastBackupAt = ref<number | undefined>(store.ui?.lastBackupAt)
function toggleBackupReminder(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  backupReminderEnabled.value = checked
  saveUIPrefs({ backupReminderEnabled: checked })
}
function markBackupNow() {
  const t = Date.now()
  lastBackupAt.value = t
  saveUIPrefs({ lastBackupAt: t })
}
function formatBackupAgo(ts: number): string {
  const ms = Date.now() - ts
  const day = Math.floor(ms / 86400000)
  if (day <= 0) return '今天'
  if (day === 1) return '昨天'
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}
watch(() => route.query.page, () => { const p = pageFromQuery(); if (p) activePage.value = p })
const navGroups: { title: string; items: NavItem[] }[] = [
  // R54-E1（修订第卌四轮五组拍板）：总览 = 知源仪表盘 + 策展台全景并列，「整理」组取消
  // R178（原型 sns-group-title）：分组对齐设置中心原型——通用与度量 / 卡片与字段 / AI 认知协作者 / 数据与信任 / 系统信息（条目与功能零增减）
  { title: '通用与度量', items: [
    { key: 'dashboard', icon: '📊', label: '知源仪表盘' },
    // R113-N2：资源生命周期聚合页——位置拍板「知源仪表盘之下、资源台全景之上」
    { key: 'lifecycle', icon: '⏳', label: '资源生命周期' },
    { key: 'panorama', icon: '🗺', label: '资源台全景' },
  ]},
  { title: '卡片与字段', items: [
    { key: 'resource', icon: '📇', label: '资源卡' },
    { key: 'task', icon: '✅', label: '任务卡' },
    { key: 'curiosity', icon: '💡', label: '好奇心卡' },
    // R62-3：策展主题卡字段组（isThesis 资源卡专用）
    { key: 'thesis', icon: '🏛', label: '策展主题卡' },
    // 第卌四轮 Q-6：标签管理上移——它服务卡片呈现，与三卡同组
    { key: 'tags', icon: '🏷', label: '标签管理' },
  ]},
  // R178：AI 认知协作者独立成组（原型分组口径）
  { title: 'AI 认知协作者', items: [
    // R134-F：AI 助手（接入配置 + 沉睡唤醒 + 一键诊断）· R146/R152：入口徽标统一（真源 AiMark.vue）
    { key: 'ai', mark: true, label: 'AI 助手' },
  ]},
  { title: '数据与信任', items: [
    { key: 'import', icon: '⬇', label: '导入数据' },
    { key: 'export', icon: '⬆', label: '导出数据' },
    // R146-⑨：删除有两条路（回收站可反悔 / 永久删除不可逆），入口必须常驻左栏而不是埋在危险区里
    { key: 'recycle', icon: '🗑', label: '回收站', route: '/recycle' },
    { key: 'reset', icon: '🔄', label: '重置与回滚' },
  ]},
  { title: '系统信息', items: [
    { key: 'extension', icon: '🔌', label: '扩展设置' },
    { key: 'shortcuts', icon: '⌨', label: '快捷键设置' },
    // R178：Airtable 归入「数据与信任」语义组（原型口径；同键不动，仅分组位置）
    { key: 'airtable', icon: '⇄', label: 'Airtable 同步' },
    { key: 'manual', icon: '📖', label: '使用手册' },
    { key: 'letter', icon: '✉️', label: '一封信' },
    { key: 'about', icon: 'ℹ', label: '关于' },
  ]},
]

// ---- 字段配置 ----
const fields = computed({
  get: () => store.data!.fieldConfig,
  set: (v) => { if (store.data) { store.data.fieldConfig = v; store.persist() } }
})
function onFieldChange() { store.persist() }
function onFieldNotify(msg: string) { showToast(msg) }

// ============================================================
// R113-N2：资源生命周期聚合页（三类卡统一视图）
// ============================================================
const lcCards = computed<LifecycleCard[]>(() => {
  const d = store.data!
  return [
    ...d.resources.filter(r => !r.deletedAt),
    ...d.tasks.filter(t => !t.deletedAt),
    ...d.curiosities.filter(c => !c.deletedAt)
  ]
})
/** 按 id 找活卡——面板只发意图，宿主对真实卡对象落库 + persist（与 useLifecycle 同纪律） */
function lcFind(id: string): LifecycleCard | undefined { return lcCards.value.find(c => c.id === id) }
function onLcArchive(id: string) { const c = lcFind(id); if (!c) return; c.lifecycleArchived = true; c.updatedAt = Date.now(); store.persist() }
function onLcSnooze(id: string) { const c = lcFind(id); if (!c) return; snoozeCard(c); store.persist() }
function onLcReactivate(id: string) { const c = lcFind(id); if (!c) return; reactivateCard(c); store.persist() }
/**
 * R117（04-61 E）：per-card 自定义冷却天数（null = 清除自定义）。
 * 注意：**只写 coolingDays 字段**——不碰 updatedAt / lastCalledAt / snoozedUntil，
 * 否则「改阈值」这个动作本身会改变卡片活跃度（口径污染）。
 */
function onLcSetDays(id: string, days: number | null) { const c = lcFind(id); if (!c) return; setCoolingDays(c, days); store.persist() }
/** R126（诉求 5）：阈值设置——全局默认（UIPrefs.coolingDaysDefault） */
const lcSetOpen = ref(false)
const lcDefaultDraft = ref<number>(coolingDefaultDaysOf() || 30)
function saveLcDefault() {
  const v = Math.min(365, Math.max(1, Math.round(Number(lcDefaultDraft.value) || 30)))
  lcDefaultDraft.value = v
  saveUIPrefs({ coolingDaysDefault: v })
  setCoolingDefaultDays(v)
  store.persist()
  showToast(`⚙ 默认冷却天数已设为 ${v} 天（归档 ${v * 3} 天）`)
}
/** R117（04-61 B）：跨台定位统一走 locateTargetOf——资源卡带**所在分类**（定位到位置而非仅切台），
 *  任务/好奇心卡带 `hk` 分派（调度台同页两个 hl 消费者按 kind 认领）。 */
function onLcLocate(id: string, kind: LifecycleCard['kind']) {
  const t = locateTargetOf(store.data!, kind, id)
  if (!t) { showToast('⚠ 该卡片已不在库中'); return }
  void router.push(t)
}

// ============================================================
// 第卌四轮 T-03/T-06/T-07：知源仪表盘（核心指标 + 动态条 + 操作记录 + CSV）
// ============================================================
import Drawer from '@/shared/components/Drawer.vue'
// R172-T5/T6：仪表盘三段（① 概览带 · ② 年度热力图 + 日详情）—— 数据桥 useDashboardStats 收口聚合与选中态
import DashboardOverview from '@/newtab/components/dashboard/DashboardOverview.vue'
import Heatmap from '@/newtab/components/dashboard/Heatmap.vue'
import ReviewPanel from '@/newtab/components/dashboard/ReviewPanel.vue'
// R172-T8：全量记录抽屉（承接今日记录四格 + 日详情「查看全部记录 ›」）
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
import type { DirLike, TaskLike } from '@/shared/utils/reviewReport'
// R172-T11：报告出口（落卡 / 导出 / 生成任务 / 跳转）整体抽进 composable，宿主只挂一行
import { useDashboardReport } from '@/newtab/composables/useDashboardReport'
import { readEventLog, curioCumulativeSince, countCurioCumulative, EVENT_LOG_CAP, type CardEvent } from '@/shared/utils/eventLog'
import { readErrorLog, subscribeErrorLog } from '@/shared/utils/runtimeError'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
// R156：主题「跟随系统」——导入界面偏好包时 ui.theme 可为 'auto'，落 data-theme 前统一解析
import { resolveTheme } from '@/shared/utils/theme'
import { recordResourceOpen } from '../stores/compass'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'

const gd = computed(() => store.data!)

/* R3-F38（04-67）：仪表盘「👁 高亮可交互」开关。
   仪表盘一屏里热力格 / KPI / 规则行 / 下钻卡 / chip 外观高度同质，光看界面分不清哪些能点——
   这个开关把所有交互点用虚线圈出来，用来回答"这一屏我到底能点哪里"。偏好持久化在 UIPrefs.dzHl。 */
const dzHl = ref<boolean>(store.ui?.dzHl === true)
function toggleDzHl() {
  dzHl.value = !dzHl.value
  saveUIPrefs({ dzHl: dzHl.value })
}
const gResLive = computed(() => gd.value.resources.filter(r => !r.deletedAt))
const gTaskLive = computed(() => gd.value.tasks.filter(t => !t.deletedAt))
const gCurioLive = computed(() => gd.value.curiosities.filter(c => !c.deletedAt))
const totalCards = computed(() => gResLive.value.length + gTaskLive.value.length + gCurioLive.value.length)
const resLiveCount = computed(() => gResLive.value.length)
const taskLiveCount = computed(() => gTaskLive.value.length)
const curioLiveCount = computed(() => gCurioLive.value.length)
const linkCardCount = computed(() => gResLive.value.filter(r => (r.link || '').trim()).length)

const gStartOfToday = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); return dt.getTime() })()
const gStartOfWeek = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dt.getTime() })()
type GFlat = { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; createdAt: number; deletedAt?: number; importedAt?: number }
const gFlat = computed<GFlat[]>(() => [
  ...gd.value.resources.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title || '（无标题）', createdAt: r.createdAt || 0, deletedAt: r.deletedAt, importedAt: r.importedAt })),
  ...gd.value.tasks.map(t => ({ kind: 'task' as const, id: t.id, title: t.title || '（无标题）', createdAt: t.createdAt || 0, deletedAt: t.deletedAt, importedAt: t.importedAt })),
  ...gd.value.curiosities.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question || '（无标题）', createdAt: c.createdAt || 0, deletedAt: c.deletedAt, importedAt: c.importedAt }))
])
const todayAddCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.createdAt >= gStartOfToday).length)
// R48-B2 双口径：导入单独计数（importedAt 由导入动作落戳），不与新建混淆
const todayImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfToday).length)
const todayDelCount = computed(() => gFlat.value.filter(x => x.deletedAt && x.deletedAt >= gStartOfToday).length)
const weekAddCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.createdAt >= gStartOfWeek).length)
const weekImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfWeek).length)
const weekDelCount = computed(() => gFlat.value.filter(x => x.deletedAt && x.deletedAt >= gStartOfWeek).length)
const statTodayAdd = computed(() => todayAddCount.value)
const statTodayRes = computed(() => gFlat.value.filter(x => x.kind === 'resource' && !x.deletedAt && x.createdAt >= gStartOfToday).length)
const statTodayTask = computed(() => gFlat.value.filter(x => x.kind === 'task' && !x.deletedAt && x.createdAt >= gStartOfToday).length)
const statTodayCurio = computed(() => gFlat.value.filter(x => x.kind === 'curiosity' && !x.deletedAt && x.createdAt >= gStartOfToday).length)

// ---- 操作记录：事件日志优先，老数据无日志回退卡片时间派生 ----
const eventLog = shallowRef<CardEvent[]>([]) // R131-C5：整组替换、只读消费 → shallowRef（5000 条不再逐个建 Proxy）
const logEmpty = ref(true)
const cumDelCount = ref(0)
/** R172-T8：全量记录抽屉（四类记录入口 / 日详情预筛共用同一条打开链） */
const logOpen = ref(false)
const logPreset = ref<LogPreset>({ kind: 'all', action: 'all', from: '', to: '' })
/** R117（04-61 C3）：好奇心「探索累计」——采集 + 状态变更 + 删除，**本版起算**（基线首次运行落盘） */
const curioCumSince = ref(0)
const curioCumulative = computed(() =>
  curioCumSince.value ? countCurioCumulative(eventLog.value, curioCumSince.value) : 0)

async function refreshEventLog() {
  const log = await readEventLog()
  eventLog.value = log.slice().reverse() // 新→旧
  logEmpty.value = log.length === 0
  cumDelCount.value = log.length
    ? log.filter(e => e.action === 'delete' || e.action === 'purge').length
    : gFlat.value.filter(x => x.deletedAt).length
  // R117（04-61 C3）：累计口径的起算时刻只需读/落一次（模块内缓存）
  curioCumSince.value = await curioCumulativeSince()
}
const derivedEvents = computed<CardEvent[]>(() => {
  const out: CardEvent[] = []
  for (const x of gFlat.value) {
    if (x.createdAt) out.push({ id: `d-${x.id}-c`, ts: x.createdAt, action: 'create', kind: x.kind, title: x.title, cardId: x.id })
    if (x.deletedAt) out.push({ id: `d-${x.id}-d`, ts: x.deletedAt, action: 'delete', kind: x.kind, title: x.title, cardId: x.id })
  }
  return out.sort((a, b) => b.ts - a.ts)
})
const timelineEvents = computed<CardEvent[]>(() => (logEmpty.value ? derivedEvents.value : eventLog.value))
/** R172-T9：今日调出（旧调度台 ↗ 四格之一）—— 在仪表盘内以 `call` 事件计数，历史口径与 T1 记账一致 */
const todayCalledCount = computed(() => timelineEvents.value.filter(e => e.action === 'call' && e.ts >= gStartOfToday).length)
function eventActionLabel(a: CardEvent['action']): string {
  return a === 'create' ? '+ 新增' : a === 'call' ? '↗ 调出' : a === 'delete' ? '− 删除' : a === 'restore' ? '↩ 恢复' : a === 'status' ? '◐ 状态变更' : '✕ 永久删除'
}

/* ---------- R172-T5/T6：知源仪表盘三段（① 概览带 + ② 年度热力图 + 日详情） ---------- */
const dash = useDashboardStats(
  () => gd.value,
  () => timelineEvents.value,
  () => ({ res: gResLive.value.length, task: gTaskLive.value.length, curio: gCurioLive.value.length })
)
const dashYear = dash.year
const dashSelDay = dash.selDay
const dashStats = dash.stats
/**
 * R172-T7：复盘段只吃 props（不碰 store）。方向对账需要「方向树 × 任务归属」两个只读切片：
 *  · `focused` 取**该方向下任一项目是主攻**（模型里主攻挂在 `Project.isFocused`，方向自身无该字段）
 *  · 任务只带对账所需字段（projectId / createdAt / completedAt / deletedAt / status），不搬全量对象
 */
const dashDirections = computed<DirLike[]>(() => (gd.value.compass?.directions || []).map(d => ({
  id: d.id, name: d.name,
  focused: (d.projects || []).some(p => p.isFocused),
  projects: (d.projects || []).map(p => ({ id: p.id, name: p.name }))
})))
const dashTasks = computed<TaskLike[]>(() => (gd.value.tasks || []).map(t => ({
  id: t.id, title: t.title, projectId: t.projectId,
  createdAt: t.createdAt, completedAt: t.completedAt, deletedAt: t.deletedAt, status: t.status
})))
function onDashOpenCards(kind: 'all' | 'resource' | 'task' | 'curiosity' | 'link') { openStatDrawer(kind) }
function onDashOpenDyn(t: 'today-add' | 'week-add' | 'cum-del') { openDynDrawer(t) }
/** 日详情「查看全部记录 ›」：打开全量抽屉并按该日预筛（R172-T8 起不再改视图内时间线） */
function onDashOpenLog(day: string) {
  logPreset.value = { kind: 'all', action: 'all', from: day, to: day, note: `来源：日详情「查看全部记录」—— 已按 ${day} 预筛，可自由改条件。` }
  logOpen.value = true
}
/** R172-T9：调度台旧「今日四格」的等价入口 —— 四类记录在仪表盘内全部可用（F36） */
function openLog(k: 'in' | 'out' | 'called' | 'log') {
  const today = fmtDayKey(Date.now())
  const preset: LogPreset =
    k === 'in' ? { kind: 'all', action: 'create', from: today, to: today, note: '今日入台 = 今日新增（含导入）的卡片。' }
      : k === 'out' ? { kind: 'all', action: 'delete', from: today, to: today, note: '今日移出 = 今日软删的卡片（可恢复）。' }
        : k === 'called' ? { kind: 'all', action: 'call', from: today, to: today, note: '今日调出 = 今日被打开的卡片（R172-T1 起才有历史事件）。' }
          : { kind: 'all', action: 'all', from: '', to: '', note: '写入记录 = 全量时间线（类型 × 动作 × 时间三维可筛）。' }
  logPreset.value = preset
  logOpen.value = true
}
/**
 * R172-T11（04-67 F31/F32）：复盘报告的出口收在 `useDashboardReport`（增长门禁 + 单一实现）——
 * 宿主只提供三样依赖：可写的主数据、persist、router。
 */
const { onReportSave, onReportExport, onReportTask, onReportGoto } = useDashboardReport({ gd, persist: () => store.persist(), router })
function fmtDayKey(ts: number): string {
  const dt = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function eventKindLabel(k: CardEvent['kind']): string {
  return k === 'resource' ? '资源' : k === 'task' ? '任务' : k === 'curiosity' ? '好奇' : '系统'
}
function fmtEventTime(ts: number): string {
  const dt = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}
function fmtDay(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${dt.getMonth() + 1}-${dt.getDate()}`
}
function gWsName(id: string): string { return gd.value.workspaces.find(w => w.id === id)?.name || '' }
function gCatName(id: string): string { return gd.value.categories.find(c => c.id === id)?.name || '' }

// ---- 核心指标下钻抽屉 ----
type StatDrawerType = '' | 'all' | 'resource' | 'task' | 'curiosity' | 'link'
interface StatRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; ts: number; owner?: string }
const statDrawer = ref<StatDrawerType>('')
const statList = computed<StatRow[]>(() => {
  switch (statDrawer.value) {
    case 'resource': return gResLive.value.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title, ts: r.createdAt }))
    case 'task': return gTaskLive.value.map(t => ({ kind: 'task' as const, id: t.id, title: t.title, ts: t.createdAt }))
    case 'curiosity': return gCurioLive.value.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question, ts: c.createdAt }))
    case 'link': return gResLive.value.filter(r => (r.link || '').trim()).map(r => ({ kind: 'resource' as const, id: r.id, title: r.title, ts: r.createdAt }))
    case 'all': return gFlat.value.filter(x => !x.deletedAt).map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt }))
    default: return []
  }
})
// R48-B1：明细抽屉改为「翻页 20 条 + 搜索过滤」，替换 R47-A5 滚动加载（大库下滚动加载触底延迟高、无从定向找卡）
const STAT_PAGE = 20
const statPage = ref(1)
const statSearch = ref('')
function openStatDrawer(t: StatDrawerType) { statDrawer.value = t; statPage.value = 1; statSearch.value = '' }
const statFiltered = computed<StatRow[]>(() => {
  const q = statSearch.value.trim().toLowerCase()
  if (!q) return statList.value
  return statList.value.filter(c => c.title.toLowerCase().includes(q) || (c.owner || '').toLowerCase().includes(q))
})
const statPageCount = computed(() => Math.max(1, Math.ceil(statFiltered.value.length / STAT_PAGE)))
const statShown = computed(() => statFiltered.value.slice((statPage.value - 1) * STAT_PAGE, statPage.value * STAT_PAGE))
function statGo(delta: number) { statPage.value = Math.min(statPageCount.value, Math.max(1, statPage.value + delta)) }
// R47-B2：任务归属反查（优先 metricId → 指标所属项目；否则 projectId；缺失显示「未关联」）
const projMetIndex = computed(() => {
  const metMap = new Map<string, { proj: string; met: string }>()
  const projMap = new Map<string, string>()
  for (const dir of gd.value.compass.directions || []) {
    for (const proj of dir.projects || []) {
      projMap.set(proj.id, proj.name)
      for (const met of proj.metrics || []) metMap.set(met.id, { proj: proj.name, met: met.title })
    }
  }
  return { metMap, projMap }
})
function taskOwnerOf(t: { metricId?: string; projectId?: string }): string {
  const { metMap, projMap } = projMetIndex.value
  const met = t.metricId ? metMap.get(t.metricId) : undefined
  const projName = met?.proj || (t.projectId ? projMap.get(t.projectId) : undefined)
  return `${projName || '未关联项目'} · ${met?.met || '未关联指标'}`
}
function statKindIcon(kind: string) { return kind === 'task' ? '✅' : kind === 'curiosity' ? '💡' : '📇' }
function statKindLabel(kind: string) { return kind === 'task' ? '任务' : kind === 'curiosity' ? '好奇' : '资源' }
/**
 * R117（04-61 B）：「全部卡片明细」点击 = 定位到卡片所在处并高亮（统一走 locateTargetOf）。
 * 旧实现：任务卡跳 `/` 但消费者在方向台（不定位不高亮）、资源卡不带所在分类（
 * 「只切台面、不定位位置」）。现由 locateTargetOf 一处计算路由目标。
 */
function openStatCard(x: { kind: string; id: string }) {
  const kind = asLocateKind(x.kind)
  if (!kind) { showToast('⚠ 该卡片类型暂不支持定位'); return }
  const t = locateTargetOf(gd.value, kind, x.id)
  if (!t) { showToast('⚠ 该卡片已不在库中'); return }
  statDrawer.value = ''
  void router.push(t)
}
const statDrawerTitle = computed(() => ({
  all: `📊 全部卡片明细（${totalCards.value}）`,
  resource: `📇 资源卡明细（${resLiveCount.value}）`,
  task: `✅ 任务卡明细（${taskLiveCount.value}）`,
  curiosity: `💡 好奇心卡明细（${curioLiveCount.value}）`,
  link: `🔗 链接卡片明细（${linkCardCount.value} · 跨全部台面）`,
  '': ''
}[statDrawer.value]))

// ---- 动态条抽屉（交互对齐北极星：点击数字 → 右侧抽屉逐条明细） ----
type DynDrawerType = '' | 'today-add' | 'today-del' | 'week-add' | 'week-del' | 'cum-del'
const dynDrawer = ref<DynDrawerType>('')
function openDynDrawer(t: DynDrawerType) { dynDrawer.value = t; dynPage.value = 1; dynSearch.value = ''; if (!eventLog.value.length) refreshEventLog() }
const dynRange = computed<[number, number] | null>(() => {
  switch (dynDrawer.value) {
    case 'today-add': case 'today-del': return [gStartOfToday, Infinity]
    case 'week-add': case 'week-del': return [gStartOfWeek, Infinity]
    default: return null
  }
})
// R48-B2：新增/删除明细改为卡片字段派生（与动态条数字同源，不再依赖事件日志是否齐全）——
// 新增=createdAt、导入=importedAt（双口径分徽标）、删除=deletedAt；累计删除仍走事件日志（保留 purge 记录）
type DynRow = Omit<CardEvent, 'action'> & { action: 'create' | 'delete' | 'import' }
const dynList = computed<DynRow[]>(() => {
  if (!dynDrawer.value) return []
  const [from, to] = dynRange.value || [0, Infinity]
  if (dynDrawer.value === 'cum-del') {
    // 累计删除沿用事件日志（含 purge）；类型上与 DynRow 兼容呈现（create/restore 徽标不会出现在该筛选下）
    return timelineEvents.value.filter(e => e.action === 'delete' || e.action === 'purge') as unknown as DynRow[]
  }
  const wantAdd = dynDrawer.value === 'today-add' || dynDrawer.value === 'week-add'
  const rows: DynRow[] = []
  for (const x of gFlat.value) {
    if (wantAdd) {
      if (x.deletedAt) continue
      if (x.importedAt && x.importedAt >= from && x.importedAt <= to)
        rows.push({ id: 'i-' + x.id, ts: x.importedAt, action: 'import', kind: x.kind, title: x.title, cardId: x.id })
      else if (x.createdAt >= from && x.createdAt <= to)
        rows.push({ id: 'c-' + x.id, ts: x.createdAt, action: 'create', kind: x.kind, title: x.title, cardId: x.id })
    } else if (x.deletedAt && x.deletedAt >= from && x.deletedAt <= to) {
      rows.push({ id: 'd-' + x.id, ts: x.deletedAt, action: 'delete', kind: x.kind, title: x.title, cardId: x.id })
    }
  }
  return rows.sort((a, b) => b.ts - a.ts)
})
const dynPage = ref(1)
const dynSearch = ref('')
const dynFiltered = computed<DynRow[]>(() => {
  const q = dynSearch.value.trim().toLowerCase()
  if (!q) return dynList.value
  return dynList.value.filter(e => e.title.toLowerCase().includes(q))
})
const dynPageCount = computed(() => Math.max(1, Math.ceil(dynFiltered.value.length / STAT_PAGE)))
const dynShown = computed(() => dynFiltered.value.slice((dynPage.value - 1) * STAT_PAGE, dynPage.value * STAT_PAGE))
function dynGo(delta: number) { dynPage.value = Math.min(dynPageCount.value, Math.max(1, dynPage.value + delta)) }
const dynDrawerTitle = computed(() => ({
  'today-add': `📈 今日新增明细（${dynList.value.length}）`,
  'today-del': `📉 今日删除明细（${dynList.value.length}）`,
  'week-add': `📈 本周新增明细（${dynList.value.length}）`,
  'week-del': `📉 本周删除明细（${dynList.value.length}）`,
  'cum-del': `🗑 累计删除明细（${dynList.value.length}）`,
  '': ''
}[dynDrawer.value]))

// ============================================================
// 第卌四轮 T-04/T-04'：策展台全景（双栏 Master-Detail + 批量移动双通道）
// R63-1：资源台/策展台两级——策展台计数与列表含镜像卡（boardCardsOf），镜像卡标 📡 可跳真身
interface PanCatNode { cat: { id: string; name: string; workspaceId: string }; count: number; children: PanCatNode[] }
interface PanWsNode { ws: { id: string; name: string; icon?: string }; count: number; cats: PanCatNode[] }
/** R67-F3：按原始数据查台——app store 的 workspaces getter 显式排除资源台（id=CURATION_WS_ID），
 *  全景内一切 isHubWs 判定不得走该 getter，否则资源台被判为「不存在」→ 右栏串台到策展台 */
function gWsById(wsId: string) { return (store.data?.workspaces || []).find(w => w.id === wsId) }
/** R63-1：分类计数——资源台按原生卡，策展台按台内+镜像（镜像归到台内落点分类）
 *  R131-C3：原实现每个分类节点全量扫一遍卡（panCountByCat × 分类数 = O(分类×卡)，且子分类递归再乘一遍）
 *  → 改为两趟 bucket：台级计数一张 Map，分类计数对「可见卡」一次遍历成 Map，建树时 O(1) 查表。 */
const panWsIdSet = computed(() => new Set(panHubWss.value.map(w => w.id)))
const panCounts = computed(() => {
  const catCount = new Map<string, number>()
  const wsCount = new Map<string, number>()
  // 键 = ws|cat：与旧实现「workspaceId + categoryId 双条件」口径一致（R109 F12-a 悬空分类不串计）
  const bump = (wsId: string, catId: string) => {
    wsCount.set(wsId, (wsCount.get(wsId) || 0) + 1)
    const k = wsId + '|' + catId
    catCount.set(k, (catCount.get(k) || 0) + 1)
  }
  for (const r of gResLive.value) if (panWsIdSet.value.has(r.workspaceId)) bump(r.workspaceId, r.categoryId || '')
  for (const w of panHubWss.value) if (!isHubWs(w)) for (const r of boardCardsOf(store.data!, w.id)) bump(w.id, r.categoryId || '')
  return { catCount, wsCount }
})
function panCountByCat(cat: { id: string; workspaceId: string }): number {
  return panCounts.value.catCount.get(cat.workspaceId + '|' + cat.id) || 0
}
/** R63-1：台卡片计数——资源台原生卡数；策展台含镜像（R65-F5 全景仅资源台，策展台分支保留兜底） */
function panCountByWs(wsId: string): number {
  return panCounts.value.wsCount.get(wsId) || 0
}
/** R65-F5：全景树只呈现资源台（策展台不进全景）｜ R66-F6：子分类递归 N 级渲染
 *  ｜ R67-F3：数据源改原始 workspaces（getter 排除资源台 → panTree 恒空 bug 根因） */
const panHubWss = computed(() => (store.data?.workspaces || []).filter(w => isHubWs(w) && !w.archived))
const panTree = computed<PanWsNode[]>(() =>
  panHubWss.value.map(w => {
    const roots = gd.value.categories.filter(c => c.workspaceId === w.id && !c.parentId && !c.deletedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // R109（F12-b）：软删分类不入全景
    const toNode = (c: { id: string; name: string; workspaceId: string }): PanCatNode => ({
      cat: { id: c.id, name: c.name, workspaceId: c.workspaceId },
      count: panCountByCat(c),
      children: gd.value.categories
        .filter(ch => ch.parentId === c.id && !ch.deletedAt)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(toNode)
    })
    return { ws: { id: w.id, name: w.name, icon: w.icon }, count: panCountByWs(w.id), cats: roots.map(toNode) }
  })
)
const panTotalCats = computed(() => gd.value.categories.filter(c => panHubWss.value.some(w => w.id === c.workspaceId) && !c.deletedAt).length)
const panTotalCards = computed(() => panHubWss.value.reduce((s, w) => s + panCountByWs(w.id), 0))
const panCollapsed = ref<Set<string>>(new Set()) // 默认全展开
/** R66-F6：递归扁平行（折叠沿祖先链：父收起则整棵子树不渲染）
 *  R131-C3：模板内直调改为 panFlatCats computed——原每次渲染对每个台各跑一遍递归建树，
 *  折叠一次全树重算 N 次；现在 panTree/panCollapsed 不变时直接命中缓存。 */
function flattenPanCats(cats: { cat: { id: string; name: string; workspaceId: string }; count: number; children: any[] }[], depth: number): { node: any; depth: number }[] {
  const out: { node: any; depth: number }[] = []
  for (const n of cats) {
    out.push({ node: n, depth })
    if (n.children?.length && !panCollapsed.value.has('cat:' + n.cat.id)) out.push(...flattenPanCats(n.children, depth + 1))
  }
  return out
}
const panFlatCats = computed(() => panTree.value.map(n => flattenPanCats(n.cats, 0)))
function togglePanCollapse(key: string) {
  const next = new Set(panCollapsed.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  panCollapsed.value = next
}
const panSelWs = ref('')
const panSelCat = ref('')
const panSelected = ref<Set<string>>(new Set())
const dropTarget = ref('')
let panDragIds: string[] = []
function selectPanWs(wsId: string) { panSelWs.value = wsId; panSelCat.value = ''; panSelected.value = new Set() }
function selectPanCat(catId: string) {
  const cat = gd.value.categories.find(c => c.id === catId)
  panSelCat.value = catId
  panSelWs.value = cat?.workspaceId || panSelWs.value
  panSelected.value = new Set()
}
const panCards = computed<ResourceCard[]>(() => {
  if (panSelWs.value && !isHubWs(gWsById(panSelWs.value))) {
    // R63-1：策展台 = 台内原生 + 镜像卡（视图模型），按分类过滤
    const cards = boardCardsOf(store.data!, panSelWs.value)
    return panSelCat.value ? cards.filter(r => (r.categoryId || '') === panSelCat.value) : cards
  }
  if (panSelCat.value) return gResLive.value.filter(r => r.workspaceId === panSelWs.value && r.categoryId === panSelCat.value) // R109（F12-a）：workspaceId 收紧——策展台卡不得混入资源台分类视图
  if (panSelWs.value) return gResLive.value.filter(r => r.workspaceId === panSelWs.value)
  return []
})
/** R131-C3：右栏大列表增量渲染（与主界面 RENDER_STEP 同构）——原一次全选分类即挂载数百 DOM，
 *  滚动到底部 400px 内追加一批；切台/切分类复位首屏 */
const PAN_RENDER_STEP = 32
const panRenderLimit = ref(PAN_RENDER_STEP)
watch([panSelWs, panSelCat], () => { panRenderLimit.value = PAN_RENDER_STEP })
const panVisibleCards = computed(() => panCards.value.length > panRenderLimit.value ? panCards.value.slice(0, panRenderLimit.value) : panCards.value)
const panHasMore = computed(() => panCards.value.length > panRenderLimit.value)
function onPanListScroll(e: Event) {
  if (!panHasMore.value) return
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) panRenderLimit.value += PAN_RENDER_STEP
}
// R132-T3：全景树分类双击行内改名——分类按 id 被卡片引用，只改 name + persist，无卡片级联
const panEdit = ref<{ id: string; value: string } | null>(null)
function panCatRename(catId: string) {
  const c = gd.value.categories.find(x => x.id === catId)
  if (c) panEdit.value = { id: catId, value: c.name }
}
function panCatRenameConfirm() {
  const ed = panEdit.value
  panEdit.value = null
  if (!ed) return
  const name = ed.value.trim()
  const cat = gd.value.categories.find(x => x.id === ed.id)
  if (!cat || !name || cat.name === name) return
  const dup = gd.value.categories.some(x => x.id !== cat.id && !x.deletedAt && x.workspaceId === cat.workspaceId && (x.parentId || '') === (cat.parentId || '') && x.name === name)
  if (dup) { showToast('同一层级下已有同名分类'); return }
  cat.name = name
  store.persist()
  showToast(`✓ 分类已重命名为「${name}」`)
}
const panCrumb = computed(() => {
  if (panSelCat.value) {
    const cat = gd.value.categories.find(c => c.id === panSelCat.value)
    if (cat) {
      const parent = cat.parentId ? gCatName(cat.parentId) + ' / ' : ''
      return `${gWsName(cat.workspaceId)} / ${parent}${cat.name} · ${panCards.value.length} 张`
    }
  }
  if (panSelWs.value) return `${gWsName(panSelWs.value)} · 全部卡片 ${panCards.value.length} 张`
  return '左侧选择策展台或分类'
})
const panAllChecked = computed(() => panCards.value.length > 0 && panCards.value.every(r => panSelected.value.has(r.id)))
function togglePanAll() {
  if (panAllChecked.value) panSelected.value = new Set()
  else panSelected.value = new Set(panCards.value.map(r => r.id))
}
function togglePanCard(id: string) {
  const next = new Set(panSelected.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  panSelected.value = next
}
function onPanDragStart(e: DragEvent, id: string) {
  panDragIds = panSelected.value.has(id) ? [...panSelected.value] : [id]
  if (!panSelected.value.has(id)) togglePanCard(id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onPanDrop(_key: string, wsId: string, catId: string) {
  dropTarget.value = ''
  if (!panDragIds.length) return
  movePanCards(panDragIds, wsId, catId)
  panDragIds = []
}
function movePanCards(ids: string[], wsId: string, catId: string) {
  const cat = catId ? gd.value.categories.find(c => c.id === catId) : null
  const targetWs = cat ? cat.workspaceId : wsId
  const targetIsHub = isHubWs(gWsById(targetWs))
  let moved = 0
  let mirrorMoved = 0
  for (const id of ids) {
    // R63-1：镜像卡移动 = 改投射落点（真身零影响）——先按视图模型判定
    const view = panCards.value.find(x => x.id === id)
    if (view && isMirrorView(view)) {
      const p = (gd.value.curationProjections || []).find(pp => pp.id === view.__mirrorProjId)
      if (p) {
        if (p.targetWsId !== targetWs) p.targetWsId = targetWs
        p.targetCatId = cat?.id
        mirrorMoved++
      }
      continue
    }
    const r = gd.value.resources.find(x => x.id === id)
    if (!r) continue
    // R63-1 → V3.7.0（R179）：池卡真身不搬台（真身唯一入池）——要进策展台走节点「🔗 关联资源卡」（投射引用）
    if (!targetIsHub && r.workspaceId === CURATION_WS_ID) { showToast('⚠ 池卡真身不能直接搬入策展台，请在策展台节点用「🔗 关联资源卡」'); continue }
    r.workspaceId = targetWs
    r.categoryId = cat ? cat.id : ''
    r.updatedAt = Date.now()
    moved++
  }
  if (moved || mirrorMoved) {
    store.persist()
    showToast(`✓ 已移动 ${moved} 张卡片${mirrorMoved ? ` · 调整 ${mirrorMoved} 个镜像落点` : ''}`)
    panSelected.value = new Set()
  }
}
const panMoveWs = ref('')
const panMoveCat = ref('')
const panMoveCatOptions = computed(() => {
  if (!panMoveWs.value) return []
  const roots = gd.value.categories.filter(c => c.workspaceId === panMoveWs.value && !c.parentId)
  const out: { id: string; name: string }[] = []
  for (const c of roots) {
    out.push({ id: c.id, name: c.name })
    for (const ch of gd.value.categories.filter(x => x.parentId === c.id)) out.push({ id: ch.id, name: c.name + ' / ' + ch.name })
  }
  return out
})
function movePanSelection() {
  if (!panMoveWs.value || !panSelected.value.size) return
  movePanCards([...panSelected.value], panMoveWs.value, panMoveCat.value)
  panMoveWs.value = ''; panMoveCat.value = ''
}
// 单击详情 / 双击打开（260ms 判定，与全产品统一）
const panDetail = ref< ResourceCard | null >(null)
/** R63-1：全景详情抽屉——镜像卡的真身引用（非镜像为 null） */
const panMirrorSrc = computed<ResourceCard | null>(() => {
  const det = panDetail.value
  if (!det || !isMirrorView(det)) return null
  const p = (gd.value.curationProjections || []).find(pp => pp.id === det.__mirrorProjId)
  if (!p?.cardId) return null
  return gd.value.resources.find(r => r.id === p.cardId) || null
})
function jumpMirrorSource() {
  const src = panMirrorSrc.value
  if (!src) return
  panDetail.value = null
  router.push(`/workspace/${CURATION_WS_ID}?hl=${src.id}`)
}
function panCardSub(r: ResourceCard): string {  const src = r.sourceType ? ({ official: '官方', academic: '学术', media: '媒体', personal: '个人', 'ai-tool': 'AI 工具', 'own-work': '自有' } as Record<string, string>)[r.sourceType] || '' : ''
  const host = r.linkType === 'url' ? (() => { try { return new URL(r.link).host } catch { return '' } })() : r.linkType === 'file' ? '本地文件' : 'Obsidian'
  return [host, src].filter(Boolean).join(' · ')
}
/** R126（诉求 6）：全景列表单击=选中（勾选态），双击=打开详情抽屉（原：单击详情 / 双击开链接） */
function onPanCardClick(r: ResourceCard) { togglePanCard(r.id) }
function onPanCardDblClick(r: ResourceCard) { recordResourceOpen(gd.value, r); store.persistHot(); panDetail.value = r }
watch(activePage, (p) => {
  /** R173-1：进仪表盘重读一次错误日志 —— 原来只在 setup 读一次，会话里新崩的看不见 */
  if (p === 'dashboard') { refreshEventLog(); refreshErrorCount() }
  if (p === 'panorama' && !panSelWs.value) {
    // R67-F3：默认选中资源台本体（原 workspaces[0] 是第一个策展台，右栏因此串台）
    const hubWs = panHubWss.value[0]
    if (hubWs) selectPanWs(hubWs.id)
    else if (store.workspaces.length) selectPanWs(store.workspaces[0].id)
  }
})
refreshEventLog()

// ---- R48-A1：运行错误留痕（zy_error_log，TDZ 排查弹药） ----
const errorLogCount = ref(0)
async function refreshErrorCount() { errorLogCount.value = (await readErrorLog()).length }
/** R173-1b：徽章跟落盘实时走 —— 同文档 hash 切换不触发 watch，只在换页重读会漏掉本会话新崩的错误 */
const offErrLog = subscribeErrorLog((n) => { errorLogCount.value = n })
onUnmounted(offErrLog)
async function exportErrorLog() {
  const logs = await readErrorLog()
  if (!logs.length) { showToast('没有运行错误记录'); return }
  const rows = logs.map(e =>
    `[${new Date(e.ts).toLocaleString('zh-CN', { hour12: false })}] ${e.source} @ ${e.route}\n${e.message}\n${e.stack}`
  ).join('\n\n———\n\n')
  const blob = new Blob([rows], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dt = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  a.href = url
  a.download = `zhiyuan_运行错误_${dt.getFullYear()}${p2(dt.getMonth() + 1)}${p2(dt.getDate())}.txt`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`✓ 已导出 ${logs.length} 条运行错误（含完整堆栈）`)
}
refreshErrorCount()

// ---- 资源卡实时预览（对齐原型） ----
const previewMode = ref<'card' | 'list' | 'kanban'>('card')
const previewModes = [
  { key: 'card' as const, label: '卡片' },
  { key: 'list' as const, label: '列表' },
  { key: 'kanban' as const, label: '看板' }
]
const previewModeLabel = computed(() => previewModes.find(m => m.key === previewMode.value)?.label || '')

const resourcePreviewHtml = computed(() => {
  const visible = [...fields.value.resource].sort((a, b) => a.order - b.order).filter(f => f.visible)
  const has = (key: string) => visible.some(f => f.key === key)

  if (previewMode.value === 'card') {
    let html = ''
    if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title">知源调度台V2.12全产品PRD手册</div>'
    if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link">🔗 D:\\zhiyuan-V2.12\\PRD手册.docx</span></div>'
    if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-field-text" style="color:var(--text-3);font-size: var(--fs-caption)">完整记录V2.12版本的功能设计、交互规范和数据模型...</span></div>'
    if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">来源:</span><span class="gs-pv-field-text">学术</span></div>'
    if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span><span class="gs-pv-tag">#产品设计</span></span></div>'
    if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">添加:</span><span class="gs-pv-field-text">2026-08-28</span></div>'
    return html
  }
  if (previewMode.value === 'list') {
    let html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    if (has('title')) html += '<span style="font-weight:600;font-size: var(--fs-sub)">知源调度台V2.12全产品PRD手册</span>'
    if (has('link')) html += '<span class="gs-pv-field-link">🔗</span>'
    if (has('description')) html += '<span style="font-size: var(--fs-tiny);color:var(--text-3)">PRD手册...</span>'
    if (has('sourceType')) html += '<span style="font-size: var(--fs-tiny);color:var(--text-3)">学术</span>'
    if (has('tags')) html += '<span class="gs-pv-tag">#PRD</span>'
    if (has('createdAt')) html += '<span style="font-size: var(--fs-tiny);color:var(--text-3)">08-28</span>'
    html += '</div>'
    return html
  }
  // kanban
  let html = ''
  if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title" style="font-size: var(--fs-sub)">知源调度台V2.12全产品PRD手册</div>'
  if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span></span></div>'
  if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link" style="font-size: var(--fs-tiny)">🔗 PRD手册.docx</span></div>'
  if (has('description')) html += '<div class="gs-pv-field"><span style="font-size: var(--fs-tiny);color:var(--text-3)">功能设计、交互规范...</span></div>'
  if (has('sourceType')) html += '<div class="gs-pv-field"><span style="font-size: var(--fs-tiny);color:var(--text-3)">学术</span></div>'
  if (has('createdAt')) html += '<div class="gs-pv-field"><span style="font-size: var(--fs-tiny);color:var(--text-3)">08-28</span></div>'
  return html
})

// ---- 导入 ----
const fileInput = ref<HTMLInputElement | null>(null)
const assetPackInput = ref<HTMLInputElement | null>(null)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const bookmarkTargetWs = ref('__new__')

function triggerFileImport() { fileInput.value?.click() }

function handleFileImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result as string) as AppData
      // R47-A2：版本校验（不兼容直接拒绝，不做部分导入）
      if (!imported || typeof imported !== 'object' || imported.version !== 2) {
        showToast('✗ 数据版本不兼容（需 v2 格式），已取消导入'); return
      }
      // R47-A2：导入前自动备份当前数据到本地文件（防误合并，T3 安全网）
      // R70：自动备份同样剥离 Airtable 凭证与同步映射——用户不会预期「我只是导入，怎么生成了一个含令牌的文件」。
      try {
        const safeBackup = { ...(store.data as unknown as Record<string, unknown>) }
        delete safeBackup.airtableSync
        downloadFile(`zhiyuan_auto_backup_before_import_${dateStr()}.json`, JSON.stringify(safeBackup, null, 2))
      } catch (e) {
        // R114-59：导入前自动备份是防误合并安全网——失败必须让用户知道（导入仍继续，但明示风险）
        console.warn('[zy] 导入前自动备份失败', e)
        showToast('⚠ 导入前自动备份失败（将直接导入，建议先取消并手动导出备份）')
      }
      const n = mergeImport(imported)
      // R66-F4：全量包附带 uiPrefs 时自动应用主题/密度（即时生效，不再询问）
      const ui = (imported as unknown as Record<string, unknown>).uiPrefs as Record<string, unknown> | undefined
      if (ui && typeof ui === 'object') {
        if (typeof ui.theme === 'string' && ui.theme) {
          // R156：ui.theme 可为 'auto'（跟随系统），落 data-theme 前统一解析
          document.documentElement.setAttribute('data-theme', resolveTheme(ui.theme))
          saveUIPrefs({ theme: ui.theme })
        }
        if (typeof ui.density === 'string' && ui.density) {
          if (ui.density === 'compact') document.documentElement.setAttribute('data-density', 'compact')
          else document.documentElement.removeAttribute('data-density')
          saveUIPrefs({ density: ui.density as 'compact' | 'cozy' })
        }
        // R72-G7：界面偏好包补齐「卡片视图列数」（按模块键 + 4/5/6/7 白名单校验后落库，非法值丢弃）
        const cols = sanitizeCardCols(ui.cardCols)
        if (Object.keys(cols).length) saveUIPrefs({ cardCols: cols })
        // R84（W2-②）：界面偏好包补齐「各台视图模式」（按台 id + 四值白名单校验后落库，非法值丢弃）
        const wv = sanitizeWsView(ui.wsViewMode)
        if (Object.keys(wv).length) saveUIPrefs({ wsViewMode: wv })
      }
      showToast(`✓ 导入完成（并集）：卡片 ${n.cards}、罗盘方向 ${n.dirs}、策展台 ${n.ws}${ui ? '；界面偏好已应用' : ''}${n.catFix ? `；分类树已自动修复（${n.catFix}）` : ''}${n.thesisClear ? `；中心论点重复已净化（清 ${n.thesisClear} 张多余标记）` : ''}；已自动下载导入前备份`)
    } catch { showToast('✗ 文件格式错误，请选择有效的JSON文件') }
  }
  reader.readAsText(file)
  input.value = ''
}

/** 解析 Netscape 书签 HTML（浏览器导出格式） */
interface BkNode { title: string; url: string; path: string[] }
function parseBookmarksHtml(html: string): BkNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: BkNode[] = []
  function walk(dl: Element | null, path: string[]) {
    if (!dl) return
    for (const dt of Array.from(dl.children).filter(el => el.tagName === 'DT')) {
      const h3 = dt.querySelector(':scope > h3')
      const a = dt.querySelector(':scope > a')
      if (h3) {
        const name = h3.textContent?.trim() || '未命名'
        walk(dt.querySelector(':scope > dl'), [...path, name])
      } else if (a) {
        const url = a.getAttribute('href') || ''
        if (url && /^(https?:|file:|obsidian:)/i.test(url)) {
          out.push({ title: a.textContent?.trim() || url, url, path })
        }
      }
    }
  }
  walk(doc.querySelector('dl'), [])
  return out
}

function handleBookmarkImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const items = parseBookmarksHtml(reader.result as string)
      if (!items.length) { showToast('未在文件中解析到书签，请确认是浏览器导出的书签 HTML'); return }
      const d = store.data!
      let ws = d.workspaces.find(w => w.id === bookmarkTargetWs.value)
      if (!ws) {
        ws = {
          id: uid('ws'), name: '🔖 书签导入 ' + new Date().toLocaleDateString(), icon: '🔖',
          color: 'var(--accent)', coverTheme: 'deep-sea', desc: '从浏览器书签导入', order: d.workspaces.length, archived: false
        }
        d.workspaces.push(ws)
      }
      let cat = d.categories.find(c => c.workspaceId === ws!.id && c.name === '待分类')
      if (!cat) {
        cat = { id: uid('cat'), workspaceId: ws!.id, name: '待分类', order: d.categories.filter(c => c.workspaceId === ws!.id).length }
        d.categories.push(cat)
      }
      const importedIds: string[] = []
      for (const b of items) {
        const tags = Array.from(new Set(b.path.filter(p => p && p !== '书签栏')))
        let linkType: ResourceCard['linkType'] = 'url'
        if (b.url.startsWith('file:')) linkType = 'file'
        else if (b.url.startsWith('obsidian:')) linkType = 'obsidian'
        const rid = uid('rc')
        importedIds.push(rid)
        d.resources.unshift({
          id: rid, kind: 'resource', title: b.title.substring(0, 120), linkType, link: b.url,
          workspaceId: ws!.id, categoryId: cat.id, description: '', tags,
          customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
        })
      }
      store.persist()
      showToast('✓ 已导入 ' + items.length + ' 个书签到「' + ws.name + '」（文件夹已作为标签）')
      // R138-H3 → R154（E3）：导入完成**不自动弹**评审抽屉（它抢焦点、用户也没点过它），
      // 改成导入回执那一行的显式入口——范式是"点击 → 弹窗"，不是"导入 → 弹窗"
      pendingImportEnrich.value = importedIds
    } catch { showToast('✗ 书签文件解析失败') }
  }
  reader.readAsText(file)
  input.value = ''
}

/** R47-A2：全量并集合并——罗盘（愿景/使命/方向→项目→指标）+ 引擎数据 + 全部关系字段
 *  原则：卡片/指标按 id 去重合并；「关系列表」（taskIds/linkedResourceIds 等）一律取并集；
 *        计数类（stats.wrr）取最大值；标量以导入方覆盖（无 updatedAt 的层级按导入值合并）。 */
function mergeImport(imported: AppData): { cards: number; dirs: number; ws: number; catFix: string; thesisClear: number } {
  const d = store.data!
  // R70：分类树结构净化（唯一的导入防线）——此前只认 version。含环的 categories 经下面的
  // mergeById（{ ...existing, ...incoming } 会覆盖 parentId）进库后，分类树渲染/计数递归会无限
  // 展开（或 while 上行走链死转）→ 资源台与相关策展台永久打不开，且界面里没有入口能删掉坏分类。
  // 净化失败（节点数超上限）时只跳过分类段，其余段照常合并，把损失限制到最小。
  const catSan = sanitizeCategoryTree(imported.categories || [])
  const safeCats = catSan.ok ? catSan.cats : []
  const catFix = catSan.ok ? (catTreeFixedAny(catSan.fixed) ? catTreeFixNote(catSan.fixed) : '') : '分类数量超上限，已跳过分类段'
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(x => [x.id, x]))
    for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
    return [...map.values()]
  }
  const union = (...lists: (ID[] | undefined)[]): ID[] => Array.from(new Set(lists.flatMap(l => l || [])))
  const wsBefore = d.workspaces.length

  // ---- 方向台：策展台 / 分类 / 三卡 ----
  // R48-B2：导入卡片统一打 importedAt 戳（双口径统计「新建 X · 导入 Y」的依据；合并进既有卡也重打——它确实在本次被导入）
  const importedNow = Date.now() // R166（实测 K5a）：mergeById 覆盖式合并且导入晚于载入 ⇒ 退役字段在下面三行各剥一次（真源 repository.RETIRED_CARD_KEYS）
  d.workspaces = mergeById(d.workspaces, imported.workspaces || [])
  d.categories = mergeById(d.categories, safeCats)
  d.resources = mergeById(d.resources, stripRetiredCardKeys<ResourceCard>(imported.resources).map(r => ({ ...r, importedAt: importedNow })))
  d.tasks = mergeById(d.tasks, stripRetiredCardKeys<TaskCard>(imported.tasks).map(t => ({ ...t, importedAt: importedNow })))
  d.curiosities = mergeById(d.curiosities, stripRetiredCardKeys<CuriosityCard>(imported.curiosities).map(c => ({ ...c, importedAt: importedNow })))
  const cardsAdded = (imported.resources?.length || 0) + (imported.tasks?.length || 0) + (imported.curiosities?.length || 0)

  // ---- 调度台：愿景/使命（内容取较新，关联取并集）----
  if (imported.compass) {
    const ic = imported.compass
    for (const key of ['vision', 'mission'] as const) {
      const inc = ic[key]
      if (!inc) continue
      const cur = d.compass[key]
      if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) {
        d.compass[key] = { ...inc, linkedResourceIds: union(cur?.linkedResourceIds, inc.linkedResourceIds), linkedCuriosityIds: union(cur?.linkedCuriosityIds, inc.linkedCuriosityIds) }
      } else {
        cur.linkedResourceIds = union(cur.linkedResourceIds, inc.linkedResourceIds)
        cur.linkedCuriosityIds = union(cur.linkedCuriosityIds, inc.linkedCuriosityIds)
      }
    }
    // ---- 方向 → 项目 → 指标 三层按 id 合并，指标 taskIds 取并集（保留任务↔指标关系）----
    for (const incDir of ic.directions || []) {
      const curDir = d.compass.directions.find(x => x.id === incDir.id)
      if (!curDir) { d.compass.directions.push(JSON.parse(JSON.stringify(incDir))); continue }
      curDir.name = incDir.name ?? curDir.name
      curDir.status = incDir.status ?? curDir.status
      curDir.term = incDir.term ?? curDir.term
      curDir.calibratedAt = incDir.calibratedAt ?? curDir.calibratedAt
      for (const incProj of incDir.projects || []) {
        const curProj = curDir.projects.find(x => x.id === incProj.id)
        if (!curProj) { curDir.projects.push(JSON.parse(JSON.stringify(incProj))); continue }
        Object.assign(curProj, incProj, { metrics: curProj.metrics })
        for (const incMet of incProj.metrics || []) {
          const curMet = curProj.metrics.find(x => x.id === incMet.id)
          if (!curMet) { curProj.metrics.push(JSON.parse(JSON.stringify(incMet))); continue }
          Object.assign(curMet, incMet, { taskIds: union(curMet.taskIds, incMet.taskIds) })
        }
      }
    }
  }

  // ---- 今日三件事：按日期合并，槽位按 id 去重 ----
  if (imported.dailyFocus) {
    for (const [date, slots] of Object.entries(imported.dailyFocus)) {
      const cur = d.dailyFocus[date]
      if (!cur) { d.dailyFocus[date] = slots; continue }
      const seen = new Set(cur.map(s => s.id))
      for (const s of slots) if (!seen.has(s.id)) cur.push(s)
    }
  }

  // ---- 统计：计数取最大，map 按键取较大时间/次数 ----
  if (imported.stats) {
    if (imported.stats.wrr && d.stats.wrr) {
      d.stats.wrr.totalCumulativeUsage = Math.max(d.stats.wrr.totalCumulativeUsage || 0, imported.stats.wrr.totalCumulativeUsage || 0)
      // R129-B10：本周档不再是裸取最大——先各自按周戳折算成「本周值」再取最大（老数据无戳按旧口径全留），
      // 合并结果统一归属到本周，避免导入上周/上月数据把本周 WRR 顶高。
      const wkNow = weekStartKey(dateKey(new Date()))
      const weekVal = (w?: { thisWeekUsage?: number; thisWeekStart?: string }) =>
        !w ? 0 : (!w.thisWeekStart || w.thisWeekStart === wkNow) ? (w.thisWeekUsage || 0) : 0
      d.stats.wrr.thisWeekUsage = Math.max(weekVal(d.stats.wrr), weekVal(imported.stats.wrr))
      d.stats.wrr.thisWeekStart = wkNow
      d.stats.wrr.lastUpdatedAt = Math.max(d.stats.wrr.lastUpdatedAt || 0, imported.stats.wrr.lastUpdatedAt || 0)
    }
    for (const key of ['lastReuse', 'lastVisits'] as const) {
      const inc = imported.stats[key]
      if (!inc) continue
      const cur = d.stats[key] as Record<string, number>
      for (const [k, v] of Object.entries(inc)) cur[k] = Math.max(cur[k] || 0, v)
    }
  }

  // ---- 行为日志：按 id 追加去重 ----
  // R58-B5：activityLogs 已退役（事件日志迁 zy_event_log），导入不再搬运死字段
  d.activityLogs = []

  // ---- R53-E1（P0 修复）：策展投射清单并入——此前导入合并遗漏此字段，备份→恢复会静默丢弃全部策展投射 ----
  if (imported.curationProjections?.length || d.curationProjections?.length) {
    d.curationProjections = mergeById(d.curationProjections || [], imported.curationProjections || [])
  }

  // ---- R63-2：Airtable 映射表并入（recordId 以导入方为准同 id 覆盖；不覆盖本地较新的 syncedAt） ----
  if (imported.airtableMap) {
    d.airtableMap = { ...(imported.airtableMap), ...(d.airtableMap || {}) }
  }

  // ---- 标签体系 / 字段配置（原有逻辑保留）----
  if (imported.tagTree?.length) {
    const existIds = new Set(d.tagTree.map(t => t.id))
    for (const root of imported.tagTree) if (!existIds.has(root.id)) d.tagTree.push(root)
  }
  if (imported.fieldConfig) {
    const cfg = d.fieldConfig
    // R62-3：thesis 组老数据可能缺失——先补默认再合并
    if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()
    for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const) {
      const importedGroup = imported.fieldConfig[key]
      const group = cfg[key]
      if (!importedGroup || !group) continue
      const existingKeys = new Set(group.map(f => f.key))
      for (const f of importedGroup) {
        if (!existingKeys.has(f.key)) group.push(f)
      }
    }
  }
  // R171-A1：覆盖式合并可能让同台多张 isThesis 并存，导入即归一（口径=保留首张）
  const thesisFix = sanitizeThesisDuplicates(d)
  store.persist()
  return { cards: cardsAdded, dirs: imported.compass?.directions?.length || 0, ws: d.workspaces.length - wsBefore + (imported.workspaces?.length || 0), catFix, thesisClear: thesisFix.cleared }
}


// ---- 导出 ----
const exportWsId = ref('')
const csvWsId = ref('')

function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function dateStr() { return new Date().toISOString().slice(0, 10) }

/** R66-F4：全量导出 = AppData 全段 + UI 偏好（主题/密度等 zy_ui_v2 独立键并入 uiPrefs 段，导入侧自动应用） */
async function exportAll() {
  const d = store.data!
  let uiPrefs: Record<string, unknown> | undefined
  // R114-59：读 UI 偏好失败 → 降级为「不带 uiPrefs 段导出」，需告警而非静默（导出物缺主题段会让用户困惑）
  try { uiPrefs = await loadUIPrefs() as unknown as Record<string, unknown> } catch (e) { console.warn('[zy] 导出时读取 UI 偏好失败，本次导出将不含 uiPrefs 段', e) }
  // R70：剥离 Airtable 凭证与同步映射——导出物会被分享/传网盘（产品本身就鼓励「导出即带走」），
  // airtableSync.pat 明文随文件外流＝拿到的人可读写用户的 Airtable Base，与「数据 100% 本机、不代持凭证」冲突。
  const safeData = { ...(d as unknown as Record<string, unknown>) }
  delete safeData.airtableSync
  const payload = uiPrefs ? { ...safeData, uiPrefs } : safeData
  downloadFile(`zhiyuan_backup_${dateStr()}.json`, JSON.stringify(payload, null, 2))
  markBackupNow()
  showToast('✓ 全量数据已导出（含全部策展台与界面偏好）')
}

/** 第卌一轮 REQ-055：资源目录字段 → CSV 单元格文本（系统字段键值映射；自定义字段取 customFields） */
function resCsvValue(r: ResourceCard, key: string): string {
  if (key.startsWith('custom_')) {
    const v = r.customFields?.[key]
    return v == null ? '' : String(v)
  }
  switch (key) {
    case 'title': return r.title
    case 'link': return r.link || ''
    case 'description': return r.description || ''
    case 'sourceType': return r.sourceType || ''
    case 'tags': return (r.tags || []).join(';')
    case 'createdAt': return new Date(r.createdAt).toISOString().slice(0, 10)
    case 'assets':
      // 附件列 = 文本摘要（与 fieldValue assets 同规则：N 图 · N PDF · M HTML）
      // R81（R15）：原实现把 PDF 算进 HTML 档，改调共享 assetSummary，与徽标/字段值三出口同源
      return assetSummary(r.assets)
    default: {
      const v = (r as unknown as Record<string, unknown>)[key]
      return v == null ? '' : String(v)
    }
  }
}

/** 按策展台导出 CSV —— 第卌一轮 REQ-055：动态列对齐字段目录
 * 目录字段（title/link/description/sourceType/tags/createdAt/assets + 自定义）全按目录配置：
 * 系统字段无条件导出、自定义字段按可见性过滤，列顺序 = fieldDef.order、列标题 = fieldDef.label（跟随重命名/显隐/排序）；
 * 目录外管理列（链接类型/分类/置顶/星标/更新时间）为卡片固有元数据，固定尾随。 */
function exportCsvForWorkspace() {
  if (!csvWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === csvWsId.value)
  if (!ws) return
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  // R63-2：资源台 = 原生卡；策展台 = 台内 + 镜像（boardCardsOf），与台内视图一致
  const isBoard = !isHubWs(ws)
  const cards = isBoard
    ? boardCardsOf(d, ws.id)
    : d.resources.filter(r => !r.deletedAt && r.workspaceId === csvWsId.value)
  // 动态目录列：系统字段全导出（无视 visible，保证数据基线完整）+ 自定义字段按可见性过滤，按 order 排序
  const dirCols = allFields(d.fieldConfig, 'resource')
    .filter(f => !f.key.startsWith('custom_') || f.visible)
    .sort((a, b) => a.order - b.order)
  const cols: Array<{ label: string; get: (r: ResourceCard) => string }> = dirCols.map(f => ({ label: f.label, get: r => resCsvValue(r, f.key) }))
  // 目录外管理列（卡片固有元数据，固定尾随）
  cols.push(
    { label: '链接类型', get: r => (r.linkType === 'url' ? 'URL' : r.linkType === 'file' ? '本地文件' : 'Obsidian') },
    { label: '分类', get: r => catMap.get(r.categoryId || "") || '待分类' },
    // R63-2：金字塔路径/层级/中心论点（适配多维表分层分析）
    { label: '分类路径', get: r => catPathOf(d, r.workspaceId, r.categoryId).path || '待分类' },
    { label: '层级', get: r => String(catPathOf(d, r.workspaceId, r.categoryId).level) },
    { label: '是否中心论点', get: r => (r.isThesis ? '是' : '') },
    { label: '镜像标记', get: r => (isMirrorView(r) ? '📡' : '') },
    { label: '置顶', get: r => (r.pinned ? '是' : '') },
    { label: '星标', get: r => (r.starred ? '是' : '') },
    { label: '更新时间', get: r => (r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '') }
  )
  const headers = cols.map(c => c.label)
  const rows = cards.map(r => cols.map(c => csvEscape(c.get(r))))
  downloadFile(`zhiyuan_${wsDisplayNameOf(ws)}_${dateStr()}.csv`,
    '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
    'text/csv;charset=utf-8')
  markBackupNow()
  showToast(`✓ 「${wsDisplayNameOf(ws)}」已导出 ${cards.length} 条资源卡 CSV`)
}

function exportWorkspace() {
  if (!exportWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === exportWsId.value)
  if (!ws) return
  const cats = d.categories.filter(c => c.workspaceId === ws.id)
  // R70：同 exportAll——导出物不含 Airtable 凭证
  const rootForExport = { ...(d as unknown as Record<string, unknown>) }
  delete rootForExport.airtableSync
  const subset: AppData = {
    ...(rootForExport as unknown as AppData), workspaces: [ws], categories: cats,
    resources: d.resources.filter(r => r.workspaceId === ws.id),
    tasks: d.tasks,
    curiosities: d.curiosities,
    // R63-2：只带本台的镜像引用（projection 指向资源台真身，导入合并按 id 并集恢复）
    curationProjections: (d.curationProjections || []).filter(p => p.targetWsId === ws.id)
  }
  downloadFile(`zhiyuan_${ws.name}_${dateStr()}.json`, JSON.stringify(subset, null, 2))
  markBackupNow()
  showToast(`✓ 「${ws.name}」已导出`)
}

function exportMarkdown() {
  const d = store.data!
  const wsMap = new Map(d.workspaces.map(w => [w.id, w.name]))
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  let md = '# 知源调度台 · 资源卡导出\n\n'
  for (const ws of d.workspaces) {
    const cards = d.resources.filter(r => r.workspaceId === ws.id && !r.deletedAt)
    if (cards.length === 0) continue
    md += `## ${ws.icon} ${ws.name}\n\n`
    for (const cat of d.categories.filter(c => c.workspaceId === ws.id)) {
      const catCards = cards.filter(r => r.categoryId === cat.id)
      if (catCards.length === 0) continue
      md += `### ${cat.name}\n\n`
      for (const r of catCards) {
        md += `- [${r.title}](${r.link})`
        if (r.description) md += ` — ${r.description}`
        if (r.tags?.length) md += ` ${r.tags.map(t => `#${t}`).join(' ')}`
        md += '\n'
      }
      md += '\n'
    }
  }
  downloadFile(`zhiyuan_resources_${dateStr()}.md`, md, 'text/markdown;charset=utf-8')
  markBackupNow()
  showToast('✓ 资源卡已导出为Markdown')
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

// ---- 重置 ----
const showResetModal = ref(false)
const resetConfirmText = ref('')
function closeResetModal() {
  showResetModal.value = false
  resetConfirmText.value = ''
}
function doReset() {
  if (resetConfirmText.value !== '回滚') return
  const fresh = createDefaultData()
  store.data!.compass = fresh.compass
  store.data!.workspaces = fresh.workspaces
  store.data!.categories = fresh.categories
  store.data!.resources = []
  store.data!.tasks = []
  store.data!.curiosities = []
  store.data!.dailyFocus = {}
  store.data!.fieldConfig = fresh.fieldConfig
  store.data!.tagTree = fresh.tagTree
  store.data!.stats = fresh.stats
  store.data!.activityLogs = []
  store.persist()
  clearHot() // R148-P0b：热度拆键后，回滚必须连热度键一起清，否则旧 stats 下次启动会覆盖回来
  closeResetModal()
  showToast('✓ 已回滚至初始状态')
  setTimeout(() => router.push('/compass'), 800)
}
/** R128-A3：与回收站页共用同一硬删引擎（此前这里只 filter 数组——附件 Blob 全量泄漏成孤儿、
 *  任务卡脱离 metric.taskIds、指向已删卡的镜像投射记录悬空）
 *  R146（回退契约）：加确认闸——同页「一键回滚」要打字确认，而这个更常用的清空却单击即物理删除，
 *  两个相邻按钮给出相反的风险信号。 */
async function emptyRecycleBin() {
  const d = store.data!
  const targets = recycledCardsOf(d)
  const n = targets.resources.length + targets.tasks.length + targets.curiosities.length + targets.categories.length
  if (!n) { showToast('回收站已是空的'); return }
  if (!(await useConfirm({ title: '清空回收站', message: `确定永久删除回收站里全部 ${n} 项？\n不可恢复，且仅被这些卡引用的附件本体会一并清除。`, confirmText: `永久删除 ${n} 项` }))) return
  const r = await purgeCardsCompletely(d, targets)
  store.persist()
  const parts = [`✓ 回收站已清空，永久删除 ${r.cards} 项`]
  if (r.assetsPurged) parts.push(`清理 ${r.assetsPurged} 个附件本体`)
  if (r.assetsShared) parts.push(`${r.assetsShared} 个共享附件保留`)
  showToast(parts.join(' · ') + (r.assetsFailed ? ` ⚠ ${r.assetsFailed} 个附件删除失败（可清理孤儿）` : ''))
}
/** R146：这行按钮原先是**假回执**（函数体只有一句 showToast('✓ 缓存已清除')，什么都没做）——
 *  它会污染用户对其它 ✓ 的信任。现在真做事：清 AI 抓过的网页正文会话缓存与整体梳理抽读缓存
 *  （都是内存态，关掉页面本来也没了；此处提供"立刻重来一遍"的手动闸）。
 *  孤儿附件本体不在此列——它在「数据管理」里有专属按钮（cleanupOrphanAssetsAction）。 */
function clearCache() {
  const links = clearLinkCache()
  const snips = reviseSnips.size
  reviseSnips.clear()
  showToast(links || snips ? `✓ 缓存已清：${links} 篇网页正文 · ${snips} 篇梳理抽读正文（卡片数据未动）` : '✓ 没有需要清理的缓存（AI 会话正文是空的）')
}

// ---- 抓取偏好 ----
const capturePref = reactive({ defaultWsId: '', autoFolderName: true })
// R1.5：defaultCaptureWs 计算属性随「默认存入台面」控件退役（采集单形态落池，defaultWsId 零消费方）
function persistCapturePref() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ zy_capture_pref: { ...capturePref } })
  }
}
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(K.CAPTURE_PREF).then(r => {
    if (r.zy_capture_pref) Object.assign(capturePref, r.zy_capture_pref)
  })
}

// ---- 快捷键设置（H） ----
interface CmdInfo { name: string; description: string; shortcut: string }
const chromeCommands = ref<CmdInfo[]>([])
if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
  chrome.commands.getAll(cmds => {
    chromeCommands.value = cmds.map(c => ({
      name: c.name || '',
      description: ({
        'open-dashboard': '打开知源调度台（新标签页）',
        'quick-capture': '快速采集当前浏览的页面',
        'search': '打开全局搜索',
        'inspire': '好奇心采集'
      } as Record<string, string>)[c.name || ''] || c.description || c.name || ''
      , shortcut: c.shortcut || '未设置'
    }))
  })
}

const wsMod = computed({
  get: () => store.ui?.wsSwitchMod || 'ctrl',
  set: (v: 'ctrl' | 'alt') => {
    if (store.ui) { store.ui.wsSwitchMod = v; saveUIPrefs({ wsSwitchMod: v }) }
  }
})
function saveWsMod() { /* computed setter 已持久化 */ }

/** 第廿九轮：快捷键跟随位置（顺序即快捷键），自定义绑定已移除——槽位由顶部 Tab 顺序派生 */
function modLabel(): string {
  const m = store.ui?.wsSwitchMod || 'alt'
  return m === 'ctrl' ? 'Ctrl' : m === 'ctrl-shift' ? 'Ctrl+Shift' : m === 'alt-shift' ? 'Alt+Shift' : m === 'none' ? '数字键' : 'Alt'
}

// ---- Airtable 同步（R63-4） ----
const atBusy = ref(false)
const atTableName = ref('')
const atPat = ref('')
const atBaseId = ref('')
const atTableId = ref('')
// 配置回填（不在模板直接 v-model 到 storage——「改完即写」会把半截 PAT 存库；失焦/操作时统一写回）
watchEffect(() => {
  const s = store.data?.airtableSync
  if (!s) return
  if (!atPat.value) atPat.value = s.pat
  if (!atBaseId.value) atBaseId.value = s.baseId
  if (!atTableId.value) atTableId.value = s.tableId
  if (s.tableName && !atTableName.value) atTableName.value = s.tableName
})
function syncAtConfig() {
  const s = store.data!.airtableSync!
  s.pat = atPat.value.trim()
  s.baseId = atBaseId.value.trim()
  s.tableId = atTableId.value.trim()
  store.persist()
}
const atState = computed(() => store.data!.airtableSync!)
const atPoll = computed(() => !!atState.value.pollEnabled)
const atLog = computed(() => atState.value.log || [])
const quotaText = computed(() => quotaHint(atState.value))
const atStatusText = computed(() => {
  const s = atState.value
  if (!s.lastSyncAt) return ''
  const parts = [new Date(s.lastSyncAt).toLocaleString('zh-CN')]
  if (s.lastSyncedCount != null) parts.push(`推送 ${s.lastSyncedCount} 条`)
  if (s.lastSyncMs != null) parts.push(`耗时 ${(s.lastSyncMs / 1000).toFixed(1)}s`)
  if (s.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join(' · ')
})
const atErrorText = computed(() => atState.value.lastError || '')

async function testAtConnection() {
  if (atBusy.value) return
  atBusy.value = true
  try {
    syncAtConfig()
    const name = await testConnection(atState.value)
    atTableName.value = name
    atState.value.tableName = name
    store.persist()
    showToast('✓ 连接成功：' + name)
  } catch (e) {
    showToast('✗ ' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

async function runAtSync() {
  if (atBusy.value) return
  if (!atPat.value.trim() || !atBaseId.value.trim() || !atTableId.value.trim()) { showToast('请先填写完整连接配置'); return }
  atBusy.value = true
  try {
    syncAtConfig()
    const r = await runSync(store.data!)
    store.persist()
    showToast(`✓ 同步完成：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('✗ 同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

function toggleAtPoll() {
  const s = atState.value
  s.pollEnabled = !s.pollEnabled
  store.persist()
  // 轮询注册由 background 监听 storage 变化自管（63-10）
  showToast(s.pollEnabled ? '✓ 已开启 3 小时自动轮询' : '已关闭自动轮询')
}


// ---- N4 标签管理 ----
interface TagNodeLite { id: string; name: string; children?: TagNodeLite[] }
const tagTree = computed<TagNodeLite[]>(() => (store.data?.tagTree || []).filter(n => n && typeof n.id === 'string'))
const ttCollapsed = ref<Set<string>>(new Set())
const ttEditing = ref<{ id: string | null; parentId: string | null; value: string } | null>(null)
const ttFlashId = ref<string | null>(null)
function ttFlash(id: string) { ttFlashId.value = id; setTimeout(() => { if (ttFlashId.value === id) ttFlashId.value = null }, 2000) }
let ttDragId: string | null = null
const vFocus = { mounted: (el: HTMLInputElement) => el.focus() }

interface FlatT { id: string; name: string; depth: number; node: TagNodeLite; parent: TagNodeLite | null }
// B30b：遍历前过滤 null/残缺节点（用户数据中可能存在残缺标签导致渲染崩溃）
function safeNodes(nodes: TagNodeLite[] | undefined): TagNodeLite[] {
  return (nodes || []).filter(n => n && typeof n.id === 'string')
}
function tagFlat(): FlatT[] {
  const out: FlatT[] = []
  const walk = (nodes: TagNodeLite[], parent: TagNodeLite | null, depth: number) =>
    safeNodes(nodes).forEach(n => { out.push({ id: n.id, name: n.name || '未命名标签', depth, node: n, parent }); if (n.children?.length) walk(n.children, n, depth + 1) })
  walk(tagTree.value, null, 0)
  return out
}
function tagDepth(id: string): number { return tagFlat().find(t => t.id === id)?.depth || 0 }
/** B30b：模板子级遍历同样过滤残缺节点 */
function safeChildren(root: TagNodeLite): TagNodeLite[] { return safeNodes(root.children) }
function findTagNode(id: string): { node: TagNodeLite; parent: TagNodeLite | null; list: TagNodeLite[]; index: number } | null {
  // B37a：必须遍历 store 原始数组并返回其引用——否则根级 splice 落在过滤副本上，
  // 删除/拖拽不落库（子级 children 是真实引用所以此前只有根级坏）
  const walk = (nodes: TagNodeLite[], parent: TagNodeLite | null): { node: TagNodeLite; parent: TagNodeLite | null; list: TagNodeLite[]; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n || typeof n.id !== 'string') continue
      if (n.id === id) return { node: n, parent, list: nodes, index: i }
      if (Array.isArray(n.children) && n.children.length) { const r = walk(n.children, n); if (r) return r }
    }
    return null
  }
  return walk(store.data!.tagTree || [], null)
}
function tagSubtreeIds(id: string): string[] {
  const out: string[] = []
  const walk = (n: TagNodeLite) => { out.push(n.id); n.children?.forEach(walk) }
  const hit = findTagNode(id)
  if (hit) walk(hit.node)
  return out
}
/**
 * R130-T1 → R151：卡片-标签命中判据唯一口径（左树角标与右列 ttRows 共用）。
 * R151 用户拍板改口径：**根标签角标 = 含子树合计**（卡存「父/子」时也要计入「父」），
 * 这样「整体梳理」蓝图里本地核算的预估张数与页头角标是同一个数——两处对不上，用户就没法信方案。
 * 仍排除回收站软删卡；一张卡在同一节点的子树里出现多次只算一次。
 */
function cardHasTag(tags: string[] | undefined, name: string): boolean {
  if (!Array.isArray(tags) || !tags.length) return false
  const leaf = name.split('/').pop() || name
  return tags.some(t => t === name || t === leaf || t.startsWith(name + '/'))
}
/**
 * R148-P1b：一次遍历建表（原来按节点各调一次 = O(标签数 × 全部卡)）。
 * R151：表键 = **树节点路径**（顶层名 / 「父/子」），命中子标签时同时给祖先计数；
 * 树里没有的裸标签仍按原样入表（右列「未入树」分组要用），不至于悄悄丢数。
 * 失效依据 = repository 的内存脏计数（每次 persist 同步自增）+ 树版本戳。
 */
let tagUseCache: { seq: number; size: number; rev: number; map: Map<string, number> } | null = null
function tagUsageMap(): Map<string, number> {
  const d = store.data!
  const size = d.resources.length + d.tasks.length + d.curiosities.length
  const seq = getMutationSeq()
  const rev = d.tagTreeRevision || 0
  if (tagUseCache && tagUseCache.seq === seq && tagUseCache.size === size && tagUseCache.rev === rev) return tagUseCache.map
  const map = new Map<string, number>()
  const bump = (k: string) => map.set(k, (map.get(k) || 0) + 1)
  // 叶子名 → 树路径（可能同名多父，全部算命中）
  const leafIndex = new Map<string, string[]>()
  const pathSet = new Set<string>()
  for (const r of d.tagTree || []) {
    pathSet.add(r.name)
    for (const c of r.children || []) {
      const p = r.name + '/' + c.name
      pathSet.add(p)
      leafIndex.set(c.name, [...(leafIndex.get(c.name) || []), p])
    }
  }
  const walk = (arr?: { deletedAt?: number; tags?: string[] }[]) => {
    for (const x of arr || []) {
      if (x.deletedAt || !Array.isArray(x.tags)) continue
      const nodes = new Set<string>()
      for (const t of x.tags) {
        if (typeof t !== 'string' || !t) continue
        const lf = t.split('/').pop() || t
        if (pathSet.has(t)) nodes.add(t)
        for (const p of leafIndex.get(lf) || []) nodes.add(p)
        if (!pathSet.has(t) && !(leafIndex.get(lf) || []).length) nodes.add(t)   // 树外裸标签：原样计数
      }
      for (const n of nodes) { bump(n); const i = n.indexOf('/'); if (i > 0) bump(n.slice(0, i)) }
    }
  }
  walk(d.resources as unknown as { deletedAt?: number; tags?: string[] }[])
  walk(d.tasks as unknown as { deletedAt?: number; tags?: string[] }[])
  walk(d.curiosities as unknown as { deletedAt?: number; tags?: string[] }[])
  tagUseCache = { seq, size, rev, map }
  return map
}
function tagUsage(name: string): number {
  return tagUsageMap().get(name) || 0
}
function ttToggle(id: string) {
  const set = new Set(ttCollapsed.value)
  set.has(id) ? set.delete(id) : set.add(id)
  ttCollapsed.value = set
}
/** B16：行内新建根标签 */
function ttAddRoot() {
  ttEditing.value = { id: null, parentId: null, value: '' }
}
/** B16：行内新建子标签 */
function ttAddChild(parentId: string) {
    if (tagDepth(parentId) >= 1) { showToast('最多两级标签，子标签下不能再新建'); return }
  ttEditing.value = { id: null, parentId, value: '' }
  ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parentId))
}
// ---- R127：标签管理双栏——左树选中 + 右列卡片（三卡合一 / 类型过滤 / 搜索 / 多选拖拽移动=替换语义） ----
const ttActiveTag = ref('')
const ttCardKind = ref<'all' | 'resource' | 'task' | 'curiosity'>('all')
const ttCardQ = ref('')
const ttPicked = ref<Set<string>>(new Set())
// R130-T3：拖拽视觉反馈——目标标签行 dragover 高亮（对齐全景页 .drop 样式）+ 被拖卡片行降透明度
const ttDropTarget = ref('')
const ttCardDragging = ref(false)
interface TtRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; sub: string; link?: string; desc?: string; status?: string; tags: string[] }
const ttDetail = ref<TtRow | null>(null)
let ttCardDragIds: string[] | null = null
function selectTtTag(path: string) { ttActiveTag.value = path; ttPicked.value = new Set() }
function ttTogglePick(id: string) { const s = new Set(ttPicked.value); if (s.has(id)) s.delete(id); else s.add(id); ttPicked.value = s }
const ttRows = computed<TtRow[]>(() => {
  const tag = ttActiveTag.value
  if (!tag) return []
  const q = ttCardQ.value.trim().toLowerCase()
  const kind = ttCardKind.value
  const out: TtRow[] = []
  if (kind === 'all' || kind === 'resource') {
    for (const r of store.data!.resources || []) {
      if (r.deletedAt || !cardHasTag(r.tags, tag)) continue
      out.push({ kind: 'resource', id: r.id, title: r.title, sub: `${gWsName(r.workspaceId)} / ${gCatName(r.categoryId || '')}`, link: r.link, desc: r.description, tags: r.tags || [] })
    }
  }
  if (kind === 'all' || kind === 'task') {
    for (const t of store.data!.tasks || []) {
      if (t.deletedAt || !cardHasTag(t.tags, tag)) continue
      out.push({ kind: 'task', id: t.id, title: t.title, sub: t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始', status: t.status, tags: t.tags || [] })
    }
  }
  if (kind === 'all' || kind === 'curiosity') {
    for (const c of store.data!.curiosities || []) {
      if (c.deletedAt || !cardHasTag(c.tags, tag)) continue
      out.push({ kind: 'curiosity', id: c.id, title: c.question, sub: c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索', status: c.status, tags: c.tags || [] })
    }
  }
  return q ? out.filter(x => (x.title + ' ' + x.sub + ' ' + (x.link || '')).toLowerCase().includes(q)) : out
})
function onTtRowClick(row: TtRow) { ttTogglePick(row.id) }
// R132-T1：全选本标签——口径为当前类型过滤/搜索结果集（ttRows），与全景「全选本分类」一致
const ttAllChecked = computed(() => ttRows.value.length > 0 && ttRows.value.every(r => ttPicked.value.has(r.id)))
function toggleTtAll() { ttPicked.value = ttAllChecked.value ? new Set() : new Set(ttRows.value.map(r => r.id)) }

// ============== R134-F（批次 F）· AI 助手：接入配置 + 批量补全 + 沉睡唤醒 + 深度诊断 v0 ==============
// 纪律：建议只活在抽屉内存态；采纳才走既有字段写入 + persist 一次；全部手动触发、零常驻、零启动链。
const aiJob = shallowRef<AiJob | null>(null)
/** R148-T：绑 runner 的功能身份（空=旧绑法，抽屉即任务） */
const aiJobKey = ref('')
const aiModels = ref<string[]>([])
const aiBusy = ref<'' | 'models' | 'test'>('')
const aiMsg = ref('')
// R158：沉睡天数参数随沉睡扫描入口迁往 GlobalPopups「AI 建议」面板
const aiGenre = ref('')
const aiPersonas = computed(() => allPersonas())
const aiPersonaSel = ref<string[]>([])
let aiPersonaSynced = false
const aiNewP = reactive({ name: '', brief: '', focus: '' })
watch(activePage, async (p) => { if (p === 'ai') { await loadAiConfig(); if (!aiPersonaSynced) { aiPersonaSel.value = aiPersonas.value.map(x => x.id); aiPersonaSynced = true } } if (p === 'tags') void aiCheckReviseBak() })
// GS 本身即懒路由：挂载时预载一次，标签管理等页的 AI 钮 disabled 态首帧即正确
void loadAiConfig()

function aiAddPersona() {
  const name = aiNewP.name.trim(); const focus = aiNewP.focus.trim()
  if (!name || !focus) { showToast('自建专家至少要有名称与关注面'); return }
  const list = [...(aiConfig.value.customPersonas || []), { id: 'custom-' + Date.now(), name, brief: aiNewP.brief.trim() || '用户自定义专家', focus }]
  patchAiConfig({ customPersonas: list })
  aiPersonaSel.value = [...aiPersonaSel.value, list[list.length - 1].id]
  aiNewP.name = ''; aiNewP.brief = ''; aiNewP.focus = ''
  showToast(`✓ 已添加专家「${name}」`)
}
function aiRemovePersona(id: string) {
  patchAiConfig({ customPersonas: (aiConfig.value.customPersonas || []).filter(x => x.id !== id) })
  aiPersonaSel.value = aiPersonaSel.value.filter(x => x !== id)
}
// R140：专家编辑面——启停/风格覆盖持久化（personas[]），自建专家三元组可改
const aiEditP = ref('')
function aiPersonaCfg(id: string) { return (aiConfig.value.personas || []).find(x => x.id === id) }
function aiPatchPersona(id: string, p: Partial<{ enabled: boolean; style: string; brief: string; focus: string }>) {
  const list = [...(aiConfig.value.personas || [])]
  const i = list.findIndex(x => x.id === id)
  const next = { id, enabled: true, style: '', ...(i >= 0 ? list[i] : {}), ...p }
  if (i >= 0) list[i] = next; else list.push(next)
  patchAiConfig({ personas: list })
  if (p.enabled === false) aiPersonaSel.value = aiPersonaSel.value.filter(x => x !== id)
}
function aiCustomPatch(id: string, k: 'name' | 'brief' | 'focus', v: string) {
  const val = v.trim()
  if (k === 'name' && !val) { showToast('专家名不能为空'); return }
  patchAiConfig({ customPersonas: (aiConfig.value.customPersonas || []).map(x => x.id === id ? { ...x, [k]: val || x[k] } : x) })
}
/** R137 治理四钮（标签体检入口在标签管理页；其余三个在 AI 页） */
function aiOpenJob(job: AiJob | null, emptyMsg: string) {
  if (!aiGuard()) return
  if (!job) { showToast(emptyMsg); return }
  aiJobKey.value = job.key || ''
  aiJob.value = job
}
/** R148-T：任务托盘——后台在跑/跑完的 AI 任务一览，点「展开」回到那份结果（不重跑） */
const aiTray = computed(() => listJobStates())
function aiOpenState(s: JobState) { aiJobKey.value = s.key; aiJob.value = s.job }
function aiTrayClear() { clearFinished() }
async function aiTagGovern() { await loadAiConfig(); aiOpenJob(buildTagGovernJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '标签体系还是空的，先给卡片打几个标签') }
// R143（反馈）：标签整体梳理——蓝图评审门 → 采纳自动接力全卡归架门；快照还原钮随备份存在而现
const aiReviseBak = ref<{ at: number } | null>(null)
async function aiTagRevise() {
  if (!aiGuard()) return
  await loadAiConfig()
  const jb = buildTagBlueprintJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!jb) { showToast('⚠ 全库卡还太少（三类合计不足 6 张），整体梳理等有库了再来'); return }
  aiJob.value = jb
}
function aiJobClosed() {
  if (consumeTagBlueprintAdopted()) {
    aiReviseBak.value = { at: Date.now() }
    const aj = buildTagAssignJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() })
    if (aj) { aiJob.value = aj; showToast('✓ 蓝图已落地，接着全卡归架打标'); return }
  }
  aiJob.value = null
  aiJobKey.value = ''
}
async function aiCheckReviseBak() { aiReviseBak.value = await getTagReviseBackup() }
async function aiRestoreRevise() {
  if (!(await useConfirm({ title: '还原上次整体梳理', message: '标签树与卡片标签将回滚到上次「整体梳理」之前（其余数据不动）。继续？', confirmText: '还原' }))) return
  showToast(await restoreTagReviseBackup(gd.value, () => store.persist()))
  aiReviseBak.value = null
}
// R158：aiCrossDeck / aiThesisDrift / aiDormantScan 三函数随被动入口迁往 GlobalPopups「AI 建议」面板退役
// （job 构造逻辑逐项原样搬迁，见 GlobalPopups.vue aiAdviceRun；本页不再持有被动型入口）
function aiTrashRescue() { aiOpenJob(buildTrashRescueJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '回收站是空的') }
/** R138-F2′：本周回顾草稿（采纳=存为一张周回顾资源卡） */
function aiWeeklyReview() { aiOpenJob(buildReviewJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() }), '近 7 天没有台账数据（任务/打开记录都是空的）') }
/** R144 · G4：成果文稿（论点+目标+近期完成 → 可交付文稿；采纳=存卡，次通道=下载 .md） */
function aiDeliver() {
  aiOpenJob(buildDeliverJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist(), genre: aiGenre.value.trim() }), '库里还没有论点卡或已完成任务——先立个论点或做完一件事再来成文')
}

function aiErr(e: unknown): string { return (e as Error)?.message || String(e) }
function aiGuard(): boolean {
  if (!aiReady.value) { showToast('请先在「AI 助手」页填好 API 地址 / Key / 模型并测试连接'); activePage.value = 'ai'; return false }
  return true
}
async function aiFetchModels() {
  aiBusy.value = 'models'; aiMsg.value = ''
  try { aiModels.value = await listModels(); aiMsg.value = `✓ 拉到 ${aiModels.value.length} 个模型，可直接选用` }
  catch (e) { aiModels.value = []; aiMsg.value = `⚠ 列表拉取失败：${aiErr(e)}（模型名可手填）` }
  aiBusy.value = ''
}
async function aiTestConn() {
  aiBusy.value = 'test'; aiMsg.value = ''
  try { aiMsg.value = `✓ 连接成功：${await aiTestConnection()}` }
  catch (e) { aiMsg.value = `⚠ ${aiErr(e)}` }
  aiBusy.value = ''
}
function aiTogglePersona(id: string) {
  aiPersonaSel.value = aiPersonaSel.value.includes(id) ? aiPersonaSel.value.filter(x => x !== id) : [...aiPersonaSel.value, id]
}
/** 分类候选词表（限选中卡涉及的台；categoryId 供模型回填，sanitizeRefs 再校验） */
function aiCatVocab(d: AppData, cards: ResourceCard[]): string {
  const wsIds = new Set(cards.map(c => c.workspaceId))
  const lines: string[] = []
  for (const c of d.categories) {
    if (c.deletedAt || !wsIds.has(c.workspaceId)) continue
    lines.push(`categoryId=${c.id}：${aiCatPathOf(d, c.id)}`)
    if (lines.length >= 60) break
  }
  return lines.join('\n')
}

/** R154（E3）：书签导入完攒下的卡 id——等用户点「归类并补全这批」才起评审，不再自动弹 */
const pendingImportEnrich = ref<string[] | null>(null)
function aiImportEnrichNow() {
  const ids = pendingImportEnrich.value
  if (!ids || !ids.length) return
  pendingImportEnrich.value = null
  aiEnrichIds(new Set(ids))
}
/** A1-批量：标签管理右列选中卡 → 逐卡补标签/描述/分类建议 */
function aiTtEnrich() { aiEnrichIds(ttPicked.value) }
/** R138-H3：泛型化——任意 id 集走批量补全评审（书签导入完成后复用同一条 job） */
function aiEnrichIds(ids: Set<string>) {
  if (!aiGuard()) return
  const d = gd.value
  const { text, cards } = projectCards(d, ids, aiConfig.value.depth)
  if (!cards.length) { showToast('勾选里没有资源卡（批量补全只处理资源卡）'); return }
  const catList = aiCatVocab(d, cards)
  const known = knownTagSet(d)
  const drop = { ghost: 0, fresh: 0, empty: 0 }
  aiJob.value = {
    // R149：key 里带入选集——同一批卡再点=attach 看进度，换一批=新起任务（不会拿旧结果糊弄）
    key: 'enrich:batch:' + [...ids].sort().join('|'),
    title: `批量补全（${cards.length} 张卡）`,
    hint: '逐卡建议：标签（优先复用词表）/ 描述（只补空描述）/ 分类迁移。勾选采纳即直接写入。左栏是这批卡的现状，右栏是补全后的样子（按卡对齐）。',
    promptScope: 'enrich:batch',
    before: () => cards.map(c => ({ key: c.id, main: `${c.title}`.slice(0, 40) || '（无名卡）', sub: `标签 ${(c.tags || []).join('、') || '（无）'} · 描述 ${c.description ? c.description.slice(0, 30) : '（空）'}` })),
    build: () => ({ messages: [
      { role: 'system', content: batchEnrichSystem() },
      { role: 'user', content: text + (catList ? `\n\n【分类候选】\n${catList}` : '') },
    ] }),
    parse: (raw) => {
      const items = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: EnrichSuggestion[] }).items : []
      const rows: AiRow[] = []
      for (const s0 of items) {
        const s = sanitizeRefs(s0, d)
        if (!s.cardId) continue
        const card = cards.find(c => c.id === s.cardId)
        if (!card) continue
        // R162：先归一回既有标签体系，查不到才保留为真新词
        const addTags = canonicalTagsOf(d, (s.tags || []).filter(t => typeof t === 'string' && t.trim())).filter(t => !(card.tags || []).includes(t))
        const fresh = freshTagsOf(addTags, known)
        if (fresh.length) drop.fresh++
        const parts: string[] = []
        if (addTags.length) parts.push(`标签 +${addTags.join('、')}${fresh.length ? `（其中 ${fresh.join('、')} 是体系外新词）` : ''}`)
        if (s.description?.trim() && !card.description) parts.push(`描述：${s.description.trim()}`)
        if (s.categoryId && s.categoryId !== card.categoryId) parts.push(`分类 → ${aiCatPathOf(d, s.categoryId)}`)
        if (!parts.length) { drop.empty++; continue }
        // R147-a：只往体系里塞新词、别无实料的行=默认不勾
        rows.push({ key: s.cardId, pair: card.id, changeType: 'edit', main: `${card.title}`.slice(0, 40) || '（无名卡）', sub: parts.join('\n') + (s.reason ? `\n· ${s.reason}` : ''), weak: fresh.length > 0 && !s.description?.trim() && !s.categoryId, data: { ...s, addTags } })
      }
      return rows
    },
    audit: () => [drop.ghost ? `${drop.ghost} 行 cardId 不在勾选里` : '', drop.fresh ? `${drop.fresh} 张卡被塞了体系外新词（已判弱）` : '', drop.empty ? `${drop.empty} 行没有可落项` : ''].filter(Boolean).join('、') || null,
    apply: (rows) => {
      const dd = gd.value
      let n = 0
      for (const r of rows) {
        const s = r.data as EnrichSuggestion & { addTags?: string[] }
        const card = dd.resources.find(x => x.id === s.cardId && !x.deletedAt)
        if (!card) continue
        if (s.addTags?.length) card.tags = [...new Set([...(card.tags || []), ...canonicalTagsOf(dd, s.addTags)])].slice(0, 10)
        if (s.description?.trim() && !card.description) card.description = s.description.trim()
        if (s.categoryId && dd.categories.some(c => c.id === s.categoryId && !c.deletedAt)) card.categoryId = s.categoryId
        card.updatedAt = Date.now()
        n++
      }
      if (n) store.persist()
      return `✓ 已补全 ${n} 张卡`
    },
  }
}

// R158：aiDormantScan（沉睡资源唤醒 job 构造）随入口迁往 GlobalPopups「AI 建议」面板，此处退役。

/** 深度诊断 v1：所选专家逐一会诊（自定义 run 接管多轮调用与进度回显）；发现可勾选采纳=生成跟进任务卡 */
function aiDiagnose() {
  if (!aiGuard()) return
  const d = gd.value
  const ov = personaOverrides()
  const sel = aiPersonas.value.filter(p => aiPersonaSel.value.includes(p.id) && ov[p.id]?.enabled !== false)
  if (!sel.length) { showToast('至少勾选一位专家'); return }
  const digest = projectLibrary(d, aiConfig.value.depth)
  aiOpenJob(withReport({
    key: 'diag',
    title: `深度诊断 · ${sel.length} 位专家会诊`,
    hint: `整库摘要投料 ${digest.length} 字（${aiConfig.value.depth === 'eco' ? '经济' : aiConfig.value.depth === 'deep' ? '深度' : '标准'}档）。勾选发现采纳=各生成一张跟进任务卡（未归属，自行挂链）；不勾即纯参考。`,
    build: () => ({ messages: [{ role: 'user', content: digest }] }),
    parse: () => [],
    apply: (rows) => {
      const dd = gd.value
      let n = 0
      for (const r of rows) {
        const f = r.data as { severity?: string; title?: string; detail?: string; suggestion?: string }
        if (!f.title) continue
        dd.tasks.unshift({
          id: uid('tk'), kind: 'task', title: String(f.title).slice(0, 40), status: 'todo',
          priority: f.severity === 'high' ? 'high' : f.severity === 'low' ? 'low' : 'medium',
          description: ['🧠 诊断发现：', f.detail, f.suggestion && `➜ 建议：${f.suggestion}`].filter(Boolean).join('\n').slice(0, 600),
          customFields: {},
          createdAt: Date.now(), updatedAt: Date.now(),
        } as import('@/shared/models').TaskCard)
        n++
      }
      if (n) store.persist()
      return `✓ 已生成 ${n} 张诊断跟进任务（在任务面板未归类区，可再挂链）`
    },
    async run({ signal, onDelta }) {
      let progress = ''
      const rows: AiRow[] = []
      for (const p of sel) {
        if (signal.aborted) break
        progress += `⏳ ${p.icon} ${p.name} 分析中…\n`
        onDelta(progress)
        const text = await chatStream({
          messages: [{ role: 'system', content: diagnosisSystem(p, ov[p.id]?.style || '') }, { role: 'user', content: digest }],
          signal,
          onDelta: t => onDelta(progress + t.slice(-400)),
        })
        const parsed = extractJson<{ findings?: { severity: string; title: string; detail?: string; suggestion?: string }[] }>(text)
        const found = Array.isArray(parsed?.findings) ? parsed.findings : []
        found.forEach((f, i) => rows.push({
          key: `${p.id}:${i}`,
          badge: `${p.icon}${f.severity === 'high' ? '高' : f.severity === 'mid' ? '中' : '低'}`,
          badgeType: f.severity === 'high' ? 'danger' : f.severity === 'mid' ? 'warn' : 'neutral',
          main: f.title,
          sub: [f.detail, f.suggestion && `➜ ${f.suggestion}`].filter(Boolean).join('\n'),
          data: f,
        }))
        progress = progress.replace(`⏳ ${p.icon} ${p.name} 分析中…\n`, `✅ ${p.icon} ${p.name}：${found.length} 条发现\n`)
        onDelta(progress)
      }
      if (!rows.length) throw new Error('各位专家都没有给出可成立的发现（数据太稀疏或模型过于保守，可换深度档重试）')
      return rows
    },
  }, { d, persist: () => store.persist() },
    () => `🧠 深度诊断 ${new Date().toLocaleDateString('zh-CN')}`,
    (rows) => rows.map(r => `## ${r.badge || ''} ${r.main}\n${r.sub || ''}`).join('\n\n'),
    ['深度诊断']), '各位专家没有给出可成立的发现')
}
function onTtRowDblClick(row: TtRow) { ttDetail.value = row }
function onTtRowDragStart(e: DragEvent, row: TtRow) { ttCardDragIds = ttPicked.value.has(row.id) ? [...ttPicked.value] : [row.id]; if (!ttPicked.value.has(row.id)) ttTogglePick(row.id); ttCardDragging.value = true; e.dataTransfer?.setData('text/plain', ttCardDragIds.join(',')) }
function onTtRowDragEnd() { ttCardDragIds = null; ttCardDragging.value = false; ttDropTarget.value = '' }
/** R127：替换语义——从当前选中标签移到目标标签（移除源 + 添加目标；三类卡同步） */
function ttMoveCards(targetPath: string) {
  const ids = new Set(ttCardDragIds || [])
  const from = ttActiveTag.value
  if (!ids.size || !from || targetPath === from) return
  let moved = 0
  // R132-T2 ★BUG 修复：移动判据与右列展示判据（cardHasTag 路径+叶子双口径）统一——
  // 原 tags.includes(from) 精确匹配，卡上存裸叶子名而选中态是「父/子」路径（或反之）时
  // 该行被静默 continue，表现为「拖过去 A 不减 B 不增」。
  const fromLeaf = from.split('/').pop() || from
  const apply = (arr?: { id: string; tags?: string[] }[]) => {
    for (const x of arr || []) {
      if (!ids.has(x.id)) continue
      const tags = Array.isArray(x.tags) ? x.tags : []
      const kept = tags.filter(t => t !== from && t !== fromLeaf)
      if (kept.length === tags.length) continue
      x.tags = [...new Set(kept.concat(targetPath))]
      moved++
    }
  }
  apply(store.data!.resources as { id: string; tags?: string[] }[])
  apply(store.data!.tasks as unknown as { id: string; tags?: string[] }[])
  apply(store.data!.curiosities as unknown as { id: string; tags?: string[] }[])
  store.persist()
  ttPicked.value = new Set()
  showToast(moved ? `已移动 ${moved} 张卡片 → #${targetPath}` : '没有可移动的卡片')
}
function openCardLink(r: { linkType?: string; link?: string; assets?: Array<{ id: string; kind: string }> }) {
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
    const meta = (r.assets || []).find(a => a.id === assetId)
    if (meta && (meta.kind === 'html' || meta.kind === 'pdf')) { openHtmlAsset(meta as never); return }
  }
  const url = toOpenableUrl(r.linkType as never, r.link || '')
  if (url) openExternalLink(url)
  else showToast('⛔ 该卡片无可打开链接')
}
/** B16：行内重命名 */
function ttRename(id: string) {
  const hit = findTagNode(id)
  if (!hit) return
  ttEditing.value = { id, parentId: null, value: hit.node.name }
}
function ttConfirm() {
  const ed = ttEditing.value
  if (!ed) return
  ttEditing.value = null
  const name = ed.value.trim()
  if (!name) return
  const dup = tagFlat().some(t => t.name === name && t.id !== ed.id)
  if (dup) { showToast('已存在同名标签'); return }
  if (ed.id) {
    // 重命名：级联同步所有卡片
    const hit = findTagNode(ed.id)
    if (!hit) return
    const oldName = hit.node.name
    const parentName = hit.parent?.name
    const oldPath = parentName ? parentName + '/' + oldName : oldName
    const newPath = parentName ? parentName + '/' + name : name
    hit.node.name = name
    const d = store.data!
    // R126：路径感知级联（自身 + 子路径前缀整体替换）
    // R129-B4：同步数直接取本次实际改动的卡数——原先二次调 tagUsage(裸名) 统计，子标签因卡上存的是
    // 「父/新名」路径恒得 0，toast 便谎报「同步 0 张卡片」。
    const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => {
      if (t === oldPath) return newPath
      if (t.startsWith(oldPath + '/')) return newPath + t.slice(oldPath.length)
      return t
    }) : [])
    let synced = 0
    const applySwap = (card: { tags?: string[] }) => {
      const before = (card.tags || []).join('\u0000')
      card.tags = swap(card.tags)
      if ((card.tags || []).join('\u0000') !== before) synced++
    }
    d.resources.forEach(applySwap)
    d.tasks.forEach(applySwap)
    d.curiosities.forEach(applySwap)
    store.persist()
    showToast(synced ? `✓ 已重命名并同步 ${synced} 张卡片` : '✓ 已重命名（该标签当前无卡片挂载）')
  } else if (ed.parentId) {
    const parent = findTagNode(ed.parentId)
    if (!parent) return
    parent.node.children = parent.node.children || []
    const nid = uid('tag')
    parent.node.children.push({ id: nid, name })
    store.persist()
    ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parent.node.id))
    ttFlash(nid)
    showToast(`✓ 已在 #${parent.node.name} 下创建 #${name}`)
  } else {
    const nid = uid('tag')
    store.data!.tagTree.push({ id: nid, name })
    store.persist()
    ttFlash(nid)
    showToast(`✓ 已创建 #${name}`)
  }
}
function ttCancel() { ttEditing.value = null }
async function ttRemove(id: string) {
  const hit = findTagNode(id)
  if (!hit) return
  const ids = tagSubtreeIds(id)
  const names = tagFlat().filter(t => ids.includes(t.id)).map(t => '#' + t.name)
  const subCount = ids.length - 1
  if (!(await useConfirm({ title: '删除标签', message: `确定删除 ${names.join(' ')} ？${subCount > 0 ? `\n（含 ${subCount} 个子标签）` : ''}\n卡片上的对应标签会一并移除。`, confirmText: '确认删除' }))) return
  // R126（诉求 7）：删除级联——同步移除卡片上的路径标签（含子路径）
  const killPaths = new Set<string>()
  const collectPaths = (node: { name: string; children?: unknown[] }, parentName?: string) => {
    killPaths.add(parentName ? parentName + '/' + node.name : node.name)
    for (const c of (node.children || []) as { name: string; children?: unknown[] }[]) collectPaths(c, parentName ? parentName + '/' + node.name : node.name)
  }
  collectPaths(hit.node as { name: string; children?: unknown[] }, hit.parent?.name)
  hit.list.splice(hit.index, 1)
  const d = store.data!
  const killList = [...killPaths]
  const strip = (arr: string[] | undefined): string[] => (Array.isArray(arr) ? arr.filter(t => !killPaths.has(t) && !killList.some(p => t.startsWith(p + '/'))) : [])
  d.resources.forEach(r => r.tags = strip(r.tags))
  d.tasks.forEach(t => t.tags = strip(t.tags))
  d.curiosities.forEach(c => c.tags = strip(c.tags))
  store.persist()
  showToast(`🗑 已删除 ${names.join(' ')}${subCount > 0 ? `（含 ${subCount} 个子标签）` : ''}`)
}
function ttDragStart(e: DragEvent, id: string) { ttDragId = id }
function ttDragEnd() { ttDragId = null; ttDropTarget.value = '' }
/** R126（诉求 7）：拖拽挂载=根→根一级（最多两级）；卡片标签同步重写为「父/子」路径 */
function ttDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  ttDropTarget.value = ''
  // R127：卡片拖拽（右列 → 左树）优先：移动=替换语义
  if (ttCardDragIds && ttCardDragIds.length) {
    const hit0 = findTagNode(targetId)
    if (hit0) ttMoveCards(hit0.parent ? hit0.parent.name + '/' + hit0.node.name : hit0.node.name)
    ttCardDragIds = null
    return
  }
  if (!ttDragId || ttDragId === targetId) return
  if (tagSubtreeIds(ttDragId).includes(targetId)) { showToast('不能挂载到自己的子标签下'); return }
  if (tagDepth(targetId) >= 1) { showToast('最多两级：只能挂到根标签下'); return }
  const from = findTagNode(ttDragId)
  const to = findTagNode(targetId)
  if (!from || !to) return
  if (from.parent) { showToast('子标签不能再挂载'); return }
  if (safeChildren(from.node).length) { showToast('含子标签的标签不可再挂载（最多两级）'); return }
  const oldPath = from.node.name
  const newPath = to.node.name + '/' + from.node.name
  from.list.splice(from.index, 1)
  to.node.children = to.node.children || []
  to.node.children.push(from.node)
  const d = store.data!
  const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => (t === oldPath ? newPath : t)) : [])
  d.resources.forEach(r => r.tags = swap(r.tags))
  d.tasks.forEach(t => t.tags = swap(t.tags))
  d.curiosities.forEach(c => c.tags = swap(c.tags))
  store.persist()
  ttDragId = null
  showToast(`✅ 「${from.node.name}」已成为「${to.node.name}」的子标签（卡片同步为 #${newPath}）`)
}
/** R126（诉求 7）：子标签提升为根（卡片路径回退为名称） */
function ttUnnest(rootId: string, childId: string) {
  const root = findTagNode(rootId)
  const child = findTagNode(childId)
  if (!root || !child || !root.node.children) return
  const oldPath = root.node.name + '/' + child.node.name
  const newName = child.node.name
  root.node.children = root.node.children.filter(c => c.id !== childId)
  store.data!.tagTree.push(child.node)
  const d = store.data!
  const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => (t === oldPath ? newName : t)) : [])
  d.resources.forEach(r => r.tags = swap(r.tags))
  d.tasks.forEach(t => t.tags = swap(t.tags))
  d.curiosities.forEach(c => c.tags = swap(c.tags))
  store.persist()
  showToast(`⇪ 「${newName}」已提升为根标签`)
}
/** R126（诉求 7）：从卡片收纳标签——三卡上未入树的标签批量注册为根/子标签 */
function ttCollectFromCards() {
  const d = store.data!
  const roots = new Set((d.tagTree || []).map(n2 => n2.name))
  const childPaths = new Set<string>()
  for (const r0 of d.tagTree || []) for (const c0 of safeChildren(r0)) childPaths.add(r0.name + '/' + c0.name)
  const seen = new Set<string>()
  let added = 0
  const all = [...(d.resources || []), ...(d.tasks || []), ...(d.curiosities || [])]
  for (const card of all) {
    for (const t of card.tags || []) {
      if (!t || seen.has(t)) continue
      seen.add(t)
      if (t.includes('/')) {
        const parts = t.split('/')
        const rn = parts[0], cn = parts.slice(1).join('/')
        if (!rn || !cn || childPaths.has(t)) continue
        let root = (d.tagTree || []).find(x => x.name === rn)
        if (!root) { root = { id: uid('tag'), name: rn }; d.tagTree.push(root); roots.add(rn); added++ }
        root.children = root.children || []
        root.children.push({ id: uid('tag'), name: cn })
        childPaths.add(t); added++
      } else if (!roots.has(t)) {
        d.tagTree.push({ id: uid('tag'), name: t }); roots.add(t); added++
      }
    }
  }
  if (added) { store.persist(); showToast(`⤓ 已收纳 ${added} 个标签到标签树`) } else showToast('没有需要收纳的新标签')
}

const appShortcuts = [
  { label: '保存（所有编辑弹窗）', keys: 'Ctrl+Enter' },
  { label: '关闭弹窗/浮层', keys: 'Esc' },
  { label: '搜索浮层内过滤类型', keys: '输入「任务/资源/好奇心」+ Tab' },
  { label: '资源台：双击卡片打开链接', keys: '双击' },
  { label: '资源卡批量管理', keys: '资源台工具条「☑ 批量管理」' }
]

// ---- 使用手册（第二十轮：数据外置 manual-data.ts，五篇结构） ----
const activeManualSec = ref('quick-1')

</script>

<style scoped>
.gs-page { display: flex; max-width: 1440px; margin: 0 auto; }

/* 返回按钮 */
.gs-back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: var(--fs-body); color: var(--text-2); cursor: pointer; transition: all var(--dur); margin-bottom: 16px; text-decoration: none; width: fit-content; }
.gs-back-btn:hover { background: var(--surface-3); color: var(--text); }

/* 左侧导航 */
/* R178（原型 settings-nav-sidebar）：浮动卡片轨（radius-lg + 卡影 + sticky 66px），边线分栏退役 */
.gs-nav { width: 210px; flex-shrink: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 10px; background: var(--surface); box-shadow: var(--shadow-sm); position: sticky; top: 66px; height: fit-content; align-self: flex-start; display: flex; flex-direction: column; gap: 3px; }
/* R178（原型 sns-group-title）：组标题 11px/700 三级字 */
.gs-nav-group { margin-bottom: 10px; }
.gs-nav-group:last-child { margin-bottom: 0; }
.gs-nav-group-title { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); padding: 8px 8px 4px; letter-spacing: .04em; }
/* R178（原型 sns-nav-item）：12.5px 档 + hover 浅底 + active accent-light */
.gs-nav-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius-sm); font-size: var(--fs-sub); font-weight: 500; color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); margin-bottom: 0; }
.gs-nav-item:hover { background: var(--surface-3); color: var(--text); }
.gs-nav-item:hover { background: var(--surface-3); color: var(--text); }
.gs-nav-item.active { background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.gs-nav-icon { font-size: 14px; width: 18px; text-align: center; }

/* 右侧内容 */
.gs-content { flex: 1; min-width: 0; max-width: 1100px; padding: 24px 32px; overflow-y: auto; } /* R155-①：容器放到 1440 后右栏会到 1230px，表单强行拉满则单行过长 → 内容列限宽 1100 */
.gs-page-header { margin-bottom: 22px; position: relative; }
/* R3-F38：交互点高亮开关（工具条位） */
.gs-dash-hl { position: absolute; right: 0; top: 0; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); font-weight: 600; border-radius: var(--radius-sm); padding: 5px 12px; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.gs-dash-hl:hover { border-color: var(--accent); color: var(--accent); }
.gs-dash-hl.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.gs-page-title { font-size: 18px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
.gs-page-desc { font-size: var(--fs-sub); color: var(--text-3); margin-top: 4px; }

/* 卡片 */
/* R178（原型 settings-section-card）：radius-lg + 卡影 + 分隔节奏 */
.gs-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
.gs-card-header { padding: 13px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.gs-card-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.gs-card-desc { font-size: var(--fs-caption); color: var(--text-3); margin-left: auto; }
.gs-card-body { padding: 16px 18px; }

/* 设置行 */
.gs-setting-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.gs-setting-row:last-child { border-bottom: none; }
.gs-sr-label { font-size: var(--fs-body); color: var(--text); min-width: 120px; }
.gs-sr-control { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* 开关 */
.gs-toggle { width: 38px; height: 21px; border-radius: 99px; background: var(--border-strong); cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
.gs-toggle.on { background: var(--accent); }
.gs-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.gs-toggle.on::after { transform: translateX(17px); }

/* 输入框/下拉 */
.gs-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: var(--fs-sub); color: var(--text); background: var(--surface); outline: none; transition: all var(--dur); font-family: inherit; }
.gs-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }

/* 按钮 */
.gs-btn { padding: 7px 16px; border-radius: 8px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all var(--dur); display: inline-flex; align-items: center; gap: 5px; font-family: inherit; }
.gs-btn:hover { border-color: var(--accent); color: var(--accent); }
.gs-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-btn-primary:hover { background: var(--accent-hover); }
.gs-btn-danger { color: var(--danger); border-color: rgba(196,68,68,.3); }
.gs-btn-danger:hover { background: var(--tag-danger-bg); border-color: var(--danger); }
.gs-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

/* 字段管理 */

.gs-field-add { margin-top: 10px; padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 8px; text-align: center; cursor: pointer; font-size: var(--fs-body); color: var(--text-3); transition: all var(--dur); }
.gs-field-add:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.gs-field-hint { margin-top: 12px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; font-size: var(--fs-sub); color: var(--accent-ink); line-height: 1.7; }

/* 预览 */
.gs-preview-section { margin-top: 16px; }
.gs-preview-title { font-size: var(--fs-sub); font-weight: 600; color: var(--text-3); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.gs-preview-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.gs-preview-tab { padding: 4px 11px; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); transition: all var(--dur); }
.gs-preview-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-preview-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 14px; min-height: 80px; }
.gs-pv-field { margin-bottom: 6px; font-size: var(--fs-sub); }
.gs-pv-field:last-child { margin-bottom: 0; }
.gs-pv-field-title { font-weight: 600; color: var(--text); font-size: var(--fs-body); }
.gs-pv-field-label { color: var(--text-3); font-size: var(--fs-tiny); margin-right: 4px; }
.gs-pv-field-text { color: var(--text-2); }
.gs-pv-field-tags { display: inline-flex; gap: 4px; }
.gs-pv-tag { font-size: var(--fs-micro); padding: 1px 6px; border-radius: 99px; background: var(--accent-light); color: var(--accent-ink); }
.gs-pv-field-link { font-size: var(--fs-caption); color: var(--accent); }

/* 导入导出 */
.gs-import-option { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 10px; cursor: pointer; transition: all var(--dur); background: var(--surface); }
.gs-import-option:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-io-icon { font-size: var(--fs-display); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: 8px; flex-shrink: 0; }
.gs-io-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-io-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }
.gs-io-btn { margin-left: auto; flex-shrink: 0; white-space: nowrap; align-self: center; }
.gs-export-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-export-row:last-child { border-bottom: none; }
.gs-er-info { flex: 1; }
.gs-er-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-er-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }

/* 第卅六轮 REQ-038：开关 + 容量/异常行 */
.gs-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex: 0 0 auto; }
.gs-switch input { opacity: 0; width: 0; height: 0; }
.gs-switch-slider { position: absolute; cursor: pointer; inset: 0; background: var(--surface-3); border-radius: 99px; transition: .2s; }
.gs-switch-slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 2px; top: 2px; background: var(--text); border-radius: 50%; transition: .2s; }
.gs-switch input:checked + .gs-switch-slider { background: var(--accent); }
.gs-switch input:checked + .gs-switch-slider::before { transform: translateX(16px); background: #fff; }

.gs-storage-detail { color: var(--text-3); font-size: var(--fs-caption); }
.gs-about-row-danger { color: var(--danger); }
.gs-about-row-danger .label { color: var(--danger); }
.gs-save-error-kind { display: inline-block; padding: 1px 6px; background: rgba(196,68,68,.12); color: var(--danger); border-radius: 4px; font-weight: 500; font-size: var(--fs-caption); margin-right: 4px; }

/* 危险区 */
.gs-danger-zone { border-color: rgba(196,68,68,.2); }
.gs-danger-zone .gs-card-header { border-bottom-color: rgba(196,68,68,.15); }
.gs-danger-zone .gs-card-title { color: var(--danger); }
.gs-danger-action { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-danger-action:last-child { border-bottom: none; }
.gs-da-info { flex: 1; }
.gs-da-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-da-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }

/* 状态徽章 */
.gs-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: var(--fs-caption); font-weight: 500; }
.gs-status-badge.connected { background: var(--tag-ok-bg); color: var(--success); }
.gs-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

/* 按键 */
.gs-keycap { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); font-size: var(--fs-sub); font-family: monospace; color: var(--text); min-width: 120px; justify-content: center; }
.gs-keycap-link { text-decoration: none; cursor: pointer; transition: all var(--dur); }
.gs-keycap-link:hover { border-color: var(--accent); color: var(--accent); }
.gs-shortcut-link { font-size: var(--fs-sub); color: var(--accent); text-decoration: none; }
.gs-shortcut-link:hover { text-decoration: underline; }

/* 关于 */
.gs-about-card { text-align: center; padding: 28px 20px; }
.gs-about-logo { width: 64px; height: 64px; border-radius: 16px; overflow: hidden; margin: 0 auto 14px; box-shadow: var(--shadow); }
.gs-about-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gs-about-name { font-size: 16px; font-weight: 700; color: var(--text); }
.gs-about-version { font-size: var(--fs-body); color: var(--text-2); margin-bottom: 4px; }
.gs-about-motto { font-size: var(--fs-sub); color: var(--text-3); font-style: italic; margin-bottom: 0; }
.gs-about-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.gs-about-row:last-child { border-bottom: none; }
.gs-about-row .label { color: var(--text-3); }
.gs-about-row .value { color: var(--text-2); }
.gs-about-row .value.gs-link { color: var(--accent); cursor: pointer; }
.gs-about-row .value.gs-link:hover { text-decoration: underline; }

/* 弹窗 */
.gs-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: var(--z-modal); display: none; align-items: center; justify-content: center; }
.gs-modal-overlay.open { display: flex; }
.gs-modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 420px; max-width: 90vw; overflow: hidden; }
.gs-modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text); }
.gs-modal-body { padding: 18px 20px; }
.gs-modal-body p { font-size: var(--fs-body); color: var(--text-2); line-height: 1.6; margin-bottom: 12px; }
.gs-confirm-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: var(--fs-sub); outline: none; font-family: inherit; margin-top: 8px; background: var(--surface); color: var(--text); }
.gs-confirm-input:focus { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(196,68,68,.15); }
.gs-modal-footer { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

/* 使用手册（左目录右内容） */
.gs-manual { display: flex; gap: 16px; align-items: flex-start; }
.gs-manual-nav { width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 8px; position: sticky; top: 16px; }
.gs-mn-part { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 10px 10px 5px; }
.gs-mn-item { font-size: var(--fs-body); color: var(--text-2); padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: all var(--dur-fast); }
.gs-mn-item:hover { background: var(--surface-3); color: var(--text); }
.gs-mn-item.active { background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.gs-manual-body { flex: 1; min-width: 0; }
.gs-mc-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 34px 40px; margin-bottom: 20px; }
.gs-mc-title { font-size: var(--fs-title); font-weight: 700; color: var(--text); margin-bottom: 10px; }
.gs-mc-content { font-size: var(--fs-body); color: var(--text-2); line-height: 1.9; }
.gs-manual-open { padding: 10px 22px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.gs-manual-open:hover { background: var(--accent-hover); }

/* 手册富文本（v-html 内容） */
.gs-mc-content p { margin: 8px 0; }
.gs-mc-content h4 { font-size: var(--fs-body); font-weight: 700; color: var(--text); margin: 16px 0 6px; padding-left: 9px; border-left: 3px solid var(--accent); }
.gs-mc-content ul { margin: 6px 0; padding-left: 20px; }
.gs-mc-content li { margin: 5px 0; }
.gs-mc-content li b, .gs-mc-content p b { color: var(--text); }
.gs-mc-content strong { color: var(--accent); font-weight: 700; }
.gs-mc-content code { background: var(--surface-3); border-radius: 4px; padding: 1px 6px; font-size: var(--fs-sub); color: var(--text-2); }
.gs-mc-content kbd { background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: var(--fs-caption); color: var(--text); margin: 0 2px; box-shadow: 0 1px 0 var(--border-strong); white-space: nowrap; }
.gs-mc-content .mc-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 8px; padding: 10px 14px; margin: 10px 0; font-size: var(--fs-body); color: var(--text); }
.gs-mc-content .mc-tip { background: var(--accent-light); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: var(--fs-body); color: var(--text-2); line-height: 1.8; }
.gs-mc-content .mc-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: var(--fs-body); line-height: 1.8; }
.gs-mc-content .mc-quote { background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 40%, var(--surface))); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 12px 0; font-size: var(--fs-body); line-height: 2; color: var(--text); }
.gs-mc-content .mc-steps { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.gs-mc-content .mc-step { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: 10px; padding: 9px 12px; font-size: var(--fs-body); color: var(--text-2); line-height: 1.7; }
.gs-mc-content .mc-step b:first-child { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; font-size: var(--fs-caption); display: flex; align-items: center; justify-content: center; font-weight: 700; margin-top: 1px; }
.gs-mc-content .mc-note { display: flex; gap: 8px; font-size: var(--fs-sub); color: var(--text-3); padding: 6px 2px; line-height: 1.7; }
.gs-mc-content .mc-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: var(--fs-body); }
.gs-mc-content .mc-table th { text-align: left; background: var(--surface-3); color: var(--text); font-weight: 600; padding: 7px 10px; border: 1px solid var(--border); }
.gs-mc-content .mc-table td { padding: 7px 10px; border: 1px solid var(--border); color: var(--text-2); vertical-align: top; }
.gs-mc-content .mc-table tr:hover td { background: var(--surface-2); }

/* 一封信 */
/* 信纸排版（第廿九轮：明显留白——行距 2.75 / 段距 32px / 640px 窄栏 / 落款前 72px，给读者呼吸感） */
.gs-letter { max-width: 640px; margin: 0 auto; padding: 80px 64px !important; background: var(--surface); font-family: "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif; }
.gs-letter .lp-saluta { font-size: var(--fs-title); margin-bottom: 44px; color: var(--text); }
.gs-letter .lp-body p { font-size: var(--fs-body); line-height: 3.1; margin: 0 0 40px; text-align: justify; color: var(--text-2); }
.gs-letter .lp-body b { color: var(--text); }
.gs-letter .lp-sign { margin-top: 84px; text-align: right; font-size: var(--fs-body); line-height: 2.2; color: var(--text-3); }
.gs-letter .lp-sign b { font-size: 14px; color: var(--text); }
.gs-letter .lp-date { font-size: var(--fs-caption); color: var(--text-4); margin-top: 10px; letter-spacing: .05em; }
/* 第卅轮：模块化分节——lp-h 节头（粗体转折句独立成节） lp-turn 节内停顿（短句）/ lp-creed 信念行；R49 加大留白 */
.gs-letter .lp-body p.lp-h { margin: 68px 0 40px; font-size: var(--fs-title); color: var(--text); }
.gs-letter .lp-body p.lp-turn { margin: 24px 0 40px; color: var(--text); }
.gs-letter .lp-body p.lp-creed { margin: 56px 0 0; letter-spacing: .08em; color: var(--text); font-weight: 600; }
/* 标签管理（N4） */
.gs-tt-row.editing { border-color: var(--accent); }
.gs-tt-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: var(--fs-body); font-family: inherit; color: var(--text); padding: 2px 4px; }
.gs-tt-ico { font-size: var(--fs-sub); flex-shrink: 0; }
/* Bug2：层级缩进与从属视觉（!important 兜底，确保不被其他规则覆盖） */
.gs-tt-row { padding-left: 10px; }
.gs-tt-row[data-depth="1"], .gs-tt-row.subrow { padding-left: 34px !important; margin-left: 16px; position: relative; }
/* B37d：子标签树形隶属引导线（竖线自父级垂下 + 横向分支线） */
.gs-tt-row[data-depth="1"]::before, .gs-tt-row.subrow::before { content: ''; position: absolute; left: 6px; top: -3px; bottom: 50%; width: 2px; background: linear-gradient(to bottom, var(--accent), var(--accent-light)); border-radius: 2px; }
.gs-tt-row[data-depth="1"]::after, .gs-tt-row.subrow::after { content: ''; position: absolute; left: 6px; top: 50%; width: 16px; height: 2px; background: var(--accent-light); border-radius: 2px; }
.gs-tt-row[data-depth="2"], .gs-tt-row[data-depth="2"].subrow { padding-left: 58px !important; margin-left: 40px; }
.gs-tt-toggle.leaf { opacity: 0; pointer-events: none; }
/* B37c：新建标签高亮闪烁 */
.gs-tt-row.flash { animation: ttFlashAnim 2s ease-out; }
@keyframes ttFlashAnim { 0%, 40% { background: var(--accent-light); box-shadow: inset 3px 0 0 var(--accent); } 100% { background: transparent; } }
.gs-tt-empty { padding: 26px; text-align: center; color: var(--text-3); font-size: var(--fs-body); border: 1.5px dashed var(--border-strong); border-radius: 8px; }

.gs-tagtree { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.gs-tt-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; cursor: grab; transition: all var(--dur-fast); }
.gs-tt-row:hover { border-color: var(--accent); }
.gs-tt-toggle { width: 16px; font-size: var(--fs-tiny); color: var(--text-3); cursor: pointer; flex-shrink: 0; }
.gs-tt-name { font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.gs-tt-name.sub { font-weight: 500; color: var(--text-2); }
.gs-tt-count { font-size: var(--fs-tiny); color: var(--text-3); background: var(--surface-3); padding: 1px 7px; border-radius: 99px; }
.gs-tt-actions { margin-left: auto; display: flex; gap: 4px; opacity: 0; transition: opacity var(--dur); }
.gs-tt-row:hover .gs-tt-actions { opacity: 1; }
.gs-tt-act { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: var(--fs-caption); color: var(--text-3); cursor: pointer; }
.gs-tt-act:hover { background: var(--surface-3); color: var(--text); }
.gs-tt-act.del:hover { color: var(--danger); }

/* ===== 第卌四轮：知源仪表盘 ===== */
.gs-dash-en { font-size: var(--fs-tiny); color: var(--text-3); letter-spacing: 2px; margin-left: 6px; }
.gs-dash-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
.gs-dash-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; cursor: pointer; transition: all var(--dur); }
.gs-dash-stat:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ds-label { font-size: var(--fs-sub); color: var(--text-2); margin-bottom: 6px; }
.gs-ds-value { font-size: 24px; font-weight: 700; color: var(--text); line-height: 1.1; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 8px; }
.gs-ds-today { font-size: var(--fs-caption); font-weight: 600; color: var(--accent-ink); background: var(--accent-light); border-radius: 99px; padding: 1px 8px; }
.gs-ds-sub { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 3px; }
.gs-dash-dynamic { display: flex; align-items: center; gap: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 11px 16px; margin-bottom: 14px; }
.gs-dd-seg { font-size: var(--fs-body); color: var(--text-2); cursor: pointer; border-radius: 6px; padding: 2px 6px; transition: all var(--dur); }
.gs-dd-seg:hover { background: var(--accent-light); color: var(--accent-ink); }
.gs-dd-seg b.up { color: var(--accent); font-size: var(--fs-title); }
.gs-dd-seg b.down { color: var(--danger); font-size: var(--fs-title); }
.gs-dd-imp { font-size: var(--fs-caption) !important; color: var(--text-3) !important; margin-left: 4px; font-weight: 600 !important; }
.gs-dd-err { color: var(--danger); }
.gs-dd-err b { font-size: var(--fs-body) !important; }
/* R48-B1：明细抽屉搜索框 + 翻页器 */
.gs-drawer-search { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.gs-drawer-search input { flex: 1; padding: 7px 11px; border: 1px solid var(--border); border-radius: 8px; font-size: var(--fs-sub); font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
.gs-drawer-search input:focus { border-color: var(--accent); }
.gs-drawer-search .cnt { font-size: var(--fs-caption); color: var(--text-3); white-space: nowrap; }
.gs-pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 2px 0; border-top: 1px solid var(--border); }
.gs-pager span { font-size: var(--fs-caption); color: var(--text-3); }
.gs-pager button { padding: 5px 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; font-family: inherit; transition: all var(--dur-fast); }
.gs-pager button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.gs-pager button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.gs-dd-sep { color: var(--border); }
.gs-dd-export { margin-left: auto; }
/* R172-T8：记录条自身的筛选行/明细行样式随内联卡退役 —— 三维筛选与明细已在 DashboardLogDrawer.vue */
.gs-ev-list { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; }
/* R51-B7：抽屉内列表撑满高度——搜索固定、列表 flex 撑满、翻页贴底，消除下方大片空白 */
.gs-drawer-fill { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.gs-drawer-fill .gs-drawer-search { flex-shrink: 0; }
.gs-drawer-fill .gs-ev-list { flex: 1; max-height: none; overflow-y: auto; min-height: 0; }
.gs-drawer-fill .gs-pager { flex-shrink: 0; margin-top: 10px; }
.gs-ev-row { display: flex; align-items: center; gap: 10px; padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); cursor: pointer; transition: all var(--dur-fast); font-size: var(--fs-body); }
.gs-ev-row:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ev-row.static { cursor: default; }
.gs-ev-row.static:hover { border-color: var(--border); background: var(--surface); }
/* V2.20.1 BUG-3b：下钻明细行可点击定位 + 加载更多 */
.gs-ev-row.static.clickable { cursor: pointer; }
.gs-ev-row.static.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ev-time { font-size: var(--fs-caption); color: var(--text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.gs-ev-badge { font-size: var(--fs-caption); border-radius: 5px; padding: 2px 8px; font-weight: 600; flex-shrink: 0; }
.gs-ev-badge.create { color: #7fbf8a; background: rgba(127,191,138,.14); }
.gs-ev-badge.delete { color: #e07a7a; background: rgba(224,122,122,.14); }
.gs-ev-badge.restore { color: var(--accent-ink); background: var(--accent-light); }
.gs-ev-badge.call { color: var(--tag-info-text); background: var(--tag-info-bg); }
/* R117（04-61 C3）：好奇心探索状态变更事件 */
.gs-ev-badge.status { color: var(--tag-warn-text); background: var(--tag-warn-bg); }
.gs-ev-badge.purge { color: #d46a6a; background: rgba(212,106,106,.2); }
/* R47-B2：任务明细行「项目 · 指标」归属徽标 */
.gs-ev-owner { font-size: var(--fs-caption); color: var(--text-2); background: var(--bg-3, rgba(127,127,127,.12)); border-radius: 4px; padding: 1px 6px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.gs-ev-kind { font-size: var(--fs-caption); color: var(--text-3); flex-shrink: 0; }
.gs-ev-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.gs-ev-empty { text-align: center; padding: 22px; color: var(--text-3); font-size: var(--fs-body); }

/* ===== 第卌四轮：策展台全景（双栏 Master-Detail） ===== */
.gs-pan-panel { display: flex; flex-direction: column; }
.gs-pan-wrap { display: grid; grid-template-columns: 250px 1fr; gap: 12px; align-items: start; }
.gs-pan-tree { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; max-height: 560px; overflow-y: auto; }
.gs-pan-tree-head { font-size: var(--fs-caption); color: var(--text-3); padding: 2px 6px 8px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
.gs-pan-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: var(--fs-body); color: var(--text-2); transition: all var(--dur-fast); border: 1px dashed transparent; }
.gs-pan-row:hover { background: var(--surface-3); color: var(--text); }
.gs-pan-row.active { background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.gs-pan-row.drop { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-ws-row { font-weight: 600; color: var(--text); }
.gs-pan-cat-row { padding-left: 18px; }
.gs-pan-sub-row { padding-left: 34px; font-size: var(--fs-sub); }
.gs-pan-toggle { width: 14px; flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-3); text-align: center; cursor: pointer; user-select: none; }
.gs-pan-toggle.leaf { cursor: default; opacity: .4; }
.gs-pan-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-pan-rename-input { flex: 1; min-width: 0; border: 1px solid var(--accent); border-radius: 4px; background: var(--surface); }
.gs-pan-kind { display: inline-block; margin-left: 6px; padding: 0 6px; font-size: var(--fs-tiny); line-height: 16px; border-radius: 99px; background: var(--accent-light); color: var(--accent-ink); vertical-align: 1px; }
.gs-pan-count { font-size: var(--fs-caption); color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 1px 8px; flex-shrink: 0; }
.gs-pan-row.active .gs-pan-count { color: var(--accent-ink); background: var(--accent-light); }
.gs-pan-list-wrap { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; max-height: 560px; }
.gs-pan-list-head { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--border); }
.gs-pan-crumb { font-size: var(--fs-body); font-weight: 600; color: var(--text); flex: 1; }
.gs-pan-allcheck { display: flex; align-items: center; gap: 5px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; }
.gs-pan-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.gs-pan-card { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); cursor: pointer; transition: all var(--dur-fast); }
.gs-pan-card:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-card.selected { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-check { flex-shrink: 0; cursor: pointer; }
.gs-pan-card-main { flex: 1; min-width: 0; }
.gs-pan-card-title { font-size: var(--fs-body); font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-pan-card-sub { font-size: var(--fs-caption); color: var(--text-4); margin-top: 1px; }
.gs-pan-card-date { font-size: var(--fs-caption); color: var(--text-3); flex-shrink: 0; }
.gs-pan-batch { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); background: var(--accent-light); border-radius: 0 0 var(--radius) var(--radius); }
.gs-pan-batch-n { font-size: var(--fs-sub); font-weight: 700; color: var(--accent); white-space: nowrap; }
.gs-pan-foot { padding: 9px 14px; border-top: 1px solid var(--border); font-size: var(--fs-caption); color: var(--text-3); }
.gs-pd-title { font-size: var(--fs-title); font-weight: 600; color: var(--text); line-height: 1.5; margin-bottom: 12px; }
.gs-pd-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.gs-pd-k { width: 40px; flex-shrink: 0; color: var(--text-4); }
.gs-pd-v { flex: 1; min-width: 0; color: var(--text-2); word-break: break-all; line-height: 1.6; }
.gs-pd-actions { display: flex; gap: 8px; margin-top: 14px; }

/* R126（诉求 5）：阈值设置弹窗 */
.lc-set-global { display: flex; align-items: center; gap: 8px; margin: 10px 0 4px; font-size: var(--fs-body); color: var(--text-2); }
.lc-set-list { max-height: 260px; overflow-y: auto; margin-top: 8px; border-top: 1px solid var(--border); }
.lc-set-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.lc-set-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-sub); color: var(--text-2); }
/* R127：标签管理双栏（左树 + 右列卡片） */
.tt-wrap { display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start; }
.gs-tt-row.active { border-color: var(--accent); background: var(--accent-light); }
/* R130-T3：拖拽落点高亮（比 active 多一圈实心内环，选中行被划过时也能分辨）+ 被拖卡片行降透明度 */
.gs-tt-row.drop { border-color: var(--accent); background: var(--accent-light); box-shadow: inset 0 0 0 1.5px var(--accent); }
.gs-pan-card.dragging { opacity: .45; }
.tt-tools { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tt-picked { font-size: var(--fs-caption); color: var(--accent); white-space: nowrap; }
.tt-list { display: flex; flex-direction: column; gap: 6px; max-height: 560px; overflow-y: auto; }
@media (max-width: 1100px) { .tt-wrap { grid-template-columns: 1fr; } }

/* ===== R134-F · AI 助手页 ===== */
.ai-form { display: flex; flex-direction: column; gap: 10px; }
.ai-field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sub); color: var(--text-3); }
.ai-field.inline { flex-direction: row; align-items: center; gap: 8px; font-size: var(--fs-sub); color: var(--text-2); }
.ai-field .gs-input { width: 100%; }
.ai-form-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ai-days { width: 72px; }
.ai-genre { width: 260px; font-size: var(--fs-sub); }
.ai-depth { width: auto; }
.ai-msg { font-size: var(--fs-sub); color: var(--success); max-width: 100%; word-break: break-all; }
.ai-msg.err { color: var(--danger); }
.ai-textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: var(--fs-body); font-family: inherit; line-height: 1.7; resize: vertical; }
.ai-textarea:focus { outline: none; border-color: var(--accent); }
.ai-persona-row { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; }
.ai-guide { font-size: var(--fs-sub); line-height: 1.7; color: var(--text-3); background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 0 var(--radius-xs) var(--radius-xs) 0; padding: 7px 11px; margin-bottom: 9px; }
.ai-pedit { display: flex; flex-direction: column; gap: 6px; margin: 0 0 8px 22px; padding: 9px 11px; border: 1px dashed var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.ai-pedit .gs-input { font-size: var(--fs-sub); }
.ai-pedit-row { display: flex; gap: 8px; }
.ai-persona { display: flex; align-items: center; gap: 6px; font-size: var(--fs-body); color: var(--text); cursor: pointer; white-space: nowrap; }
.ai-persona-brief { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.6; }

.gs-btn.ai-batch-btn { margin-left: 10px; padding: 3px 10px; font-size: var(--fs-sub); }
.ai-tray { margin: 0 0 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.ai-tray-head { display: flex; align-items: center; gap: 10px; font-size: var(--fs-sub); color: var(--text); }
.ai-tray-hint { font-size: var(--fs-caption); font-weight: 400; color: var(--text-4); flex: 1; }
.ai-tray-row { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sub); color: var(--text-2); }
.ai-tray-t { font-weight: 600; color: var(--text); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-tray-st { flex: 1; color: var(--text-3); }
.ai-tray-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-4); flex-shrink: 0; }
.ai-tray-dot.running { background: var(--accent); animation: breathe 1.2s ease-in-out infinite; }
.ai-tray-dot.done { background: var(--success); }
.ai-tray-dot.error { background: var(--danger); }
.ai-tray-dot.queued { background: var(--warning); }
.ai-tray-dot.stopped { background: var(--text-3); }
.gs-btn.ai-batch-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.ai-pnew { display: flex; gap: 8px; align-items: center; margin: 8px 0 10px; flex-wrap: wrap; }
.ai-pnew .gs-input { flex: 1; min-width: 130px; }
.ai-btn-mini { width: 20px; height: 20px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: transparent; color: var(--text-3); font-size: var(--fs-tiny); cursor: pointer; line-height: 1; }
.ai-btn-mini.on { border-color: var(--accent); color: var(--accent); }
.ai-btn-mini.danger:hover { color: var(--danger); border-color: var(--danger); }
</style>
