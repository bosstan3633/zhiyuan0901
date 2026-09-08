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
          @click="activePage = item.key"
        >
          <span class="gs-nav-icon">{{ item.icon }}</span>{{ item.label }}
        </div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <main class="gs-content">
      <!-- 返回按钮 -->
      <div class="gs-back-btn" @click="router.push('/compass')">← 返回</div>

      <!-- ===== 知源仪表盘（第卌四轮 T-03：默认首屏） ===== -->
      <div v-if="activePage === 'dashboard'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">📊 知源仪表盘 <span class="gs-dash-en">DASHBOARD</span></div>
          <div class="gs-page-desc">数据总览 · 操作有痕 · 一键导出核对（本页为设置默认首屏）</div>
        </div>

        <!-- ① 核心指标 5 卡 -->
        <div class="gs-dash-stats">
          <div class="gs-dash-stat" @click="openStatDrawer('all')">
            <div class="gs-ds-label">总卡片</div>
            <div class="gs-ds-value">{{ totalCards }}<span class="gs-ds-today" v-if="statTodayAdd">今日 +{{ statTodayAdd }}</span></div>
          </div>
          <div class="gs-dash-stat" @click="openStatDrawer('resource')">
            <div class="gs-ds-label">📇 资源卡</div>
            <div class="gs-ds-value">{{ resLiveCount }}<span class="gs-ds-today" v-if="statTodayRes">+{{ statTodayRes }}</span></div>
          </div>
          <div class="gs-dash-stat" @click="openStatDrawer('task')">
            <div class="gs-ds-label">✅ 任务卡</div>
            <div class="gs-ds-value">{{ taskLiveCount }}<span class="gs-ds-today" v-if="statTodayTask">+{{ statTodayTask }}</span></div>
          </div>
          <div class="gs-dash-stat" @click="openStatDrawer('curiosity')">
            <div class="gs-ds-label">💡 好奇心卡</div>
            <div class="gs-ds-value">{{ curioLiveCount }}<span class="gs-ds-today" v-if="statTodayCurio">+{{ statTodayCurio }}</span></div>
          </div>
          <div class="gs-dash-stat" @click="openStatDrawer('link')">
            <div class="gs-ds-label">🔗 链接卡片</div>
            <div class="gs-ds-value">{{ linkCardCount }}</div>
            <div class="gs-ds-sub">跨全部工作台</div>
          </div>
        </div>

        <!-- ② 动态条（可点击 → 抽屉明细，交互对齐北极星） -->
        <div class="gs-dash-dynamic">
          <div class="gs-dd-seg" @click="openDynDrawer('today-add')">今日 <b class="up">+{{ todayAddCount }}</b><b v-if="todayImportCount" class="up gs-dd-imp" :title="`其中 ${todayImportCount} 张来自导入（继承原创建时间）`">导{{ todayImportCount }}</b> / <b class="down">−{{ todayDelCount }}</b></div>
          <div class="gs-dd-sep">│</div>
          <div class="gs-dd-seg" @click="openDynDrawer('week-add')">本周 <b class="up">+{{ weekAddCount }}</b><b v-if="weekImportCount" class="up gs-dd-imp" :title="`其中 ${weekImportCount} 张来自导入（继承原创建时间）`">导{{ weekImportCount }}</b> / <b class="down">−{{ weekDelCount }}</b></div>
          <div class="gs-dd-sep">│</div>
          <div class="gs-dd-seg" @click="openDynDrawer('cum-del')">累计删除 <b>{{ cumDelCount }}</b></div>
          <div class="gs-dd-sep" v-if="errorLogCount">│</div>
          <!-- R48-A1：运行错误留痕入口（TDZ 排查弹药，一键导出堆栈） -->
          <div v-if="errorLogCount" class="gs-dd-seg gs-dd-err" title="点击导出运行错误堆栈（含 TDZ 类崩溃），供定位根因" @click="exportErrorLog">⚠ 运行错误 <b class="down">{{ errorLogCount }}</b></div>
          <button class="gs-btn gs-btn-primary gs-dd-export" @click="exportEventsCsv">⬇ 导出 CSV（按筛选）</button>
        </div>

        <!-- ③ 操作记录时间线 -->
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">🕘 操作记录</span><span class="gs-card-desc">类型 × 动作 × 时间 三维筛选 · 点击行展开详情 · CSV 按当前筛选导出</span></div>
          <div class="gs-card-body">
            <div class="gs-ev-filters">
              <span class="gs-ev-fl">类型</span>
              <select class="gs-select" v-model="evKind">
                <option value="all">全部</option><option value="resource">资源</option><option value="task">任务</option><option value="curiosity">好奇</option>
              </select>
              <span class="gs-ev-fl">动作</span>
              <select class="gs-select" v-model="evAction">
                <option value="all">全部</option><option value="create">新增</option><option value="delete">删除</option><option value="restore">恢复</option><option value="purge">永久删除</option>
              </select>
              <span class="gs-ev-fl">时间</span>
              <input type="date" class="gs-select gs-ev-date" v-model="evFrom" />
              <span class="gs-ev-tilde">~</span>
              <input type="date" class="gs-select gs-ev-date" v-model="evTo" />
              <span class="gs-ev-count">{{ filteredEvents.length }} 条</span>
            </div>
            <div class="gs-ev-list">
              <template v-for="e in filteredEvents.slice(0, 200)" :key="e.id">
                <div class="gs-ev-row" @click="expandedEventId = expandedEventId === e.id ? '' : e.id">
                  <span class="gs-ev-time">{{ fmtEventTime(e.ts) }}</span>
                  <span class="gs-ev-badge" :class="e.action">{{ eventActionLabel(e.action) }}</span>
                  <span class="gs-ev-kind">{{ eventKindLabel(e.kind) }}</span>
                  <span class="gs-ev-title">{{ e.title }}</span>
                  <span class="gs-ev-go">{{ expandedEventId === e.id ? '▾' : '▸' }}</span>
                </div>
                <div v-if="expandedEventId === e.id" class="gs-ev-detail">
                  <div v-for="line in eventDetailLines(e)" :key="line" class="gs-ev-dl">{{ line }}</div>
                </div>
              </template>
              <div v-if="!filteredEvents.length" class="gs-ev-empty">当前筛选下没有操作记录</div>
              <div v-if="filteredEvents.length > 200" class="gs-ev-empty">仅显示最近 200 条 · 导出 CSV 可获得完整筛选结果</div>
            </div>
            <div class="gs-field-hint">💡 日志容量 {{ eventLog.length }} / 5000 条滚动保留（含恢复与永久删除）；老数据无日志时自动回退为卡片时间派生。导出为 UTF-8+BOM CSV，可直接导入 Airtable。</div>
          </div>
        </div>

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

      <!-- ===== 资源台全景（第卌四轮 T-04 双栏 Master-Detail；R65-F5 只呈现资源台，策展台不再进全景） ===== -->
      <div v-if="activePage === 'panorama'" class="gs-panel gs-pan-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🗺 资源台全景</div>
          <div class="gs-page-desc">左栏看全景（资源台 → 分类 → 子分类），右栏做整理 · 勾选卡片拖到左栏目标分类即可批量移动 · 单击详情 / 双击打开</div>
        </div>
        <div class="gs-pan-wrap">
          <!-- 左栏：全景计数树（默认全展开） -->
          <div class="gs-pan-tree">
            <div class="gs-pan-tree-head">全景 · {{ panTree.length }} 工作台 · {{ panTotalCats }} 分类 · {{ panTotalCards }} 卡</div>
            <div v-for="wsNode in panTree" :key="wsNode.ws.id" class="gs-pan-ws">
              <div class="gs-pan-row gs-pan-ws-row" :class="{ active: panSelWs === wsNode.ws.id && !panSelCat, drop: dropTarget === 'ws:' + wsNode.ws.id }"
                draggable="false" @click="selectPanWs(wsNode.ws.id)"
                @dragover.prevent="dropTarget = 'ws:' + wsNode.ws.id" @dragleave="dropTarget === 'ws:' + wsNode.ws.id && (dropTarget = '')" @drop.prevent="onPanDrop('ws:' + wsNode.ws.id, wsNode.ws.id, '')">
                <span class="gs-pan-toggle leaf" @click.stop="togglePanCollapse('ws:' + wsNode.ws.id)">{{ panCollapsed.has('ws:' + wsNode.ws.id) ? '▸' : '▾' }}</span>
                <span class="gs-pan-name">{{ wsNode.ws.icon || '📁' }} {{ wsNode.ws.name.replace(/^[^\s]+\s/, '') }}<span class="gs-pan-kind">{{ isHubWs(store.workspaces.find(w => w.id === wsNode.ws.id)) ? '资源台' : '策展台' }}</span></span>
                <span class="gs-pan-count">{{ wsNode.count }}</span>
              </div>
              <template v-if="!panCollapsed.has('ws:' + wsNode.ws.id)">
                <div v-for="node in wsNode.cats" :key="node.cat.id">
                  <div class="gs-pan-row gs-pan-cat-row" :class="{ active: panSelCat === node.cat.id, drop: dropTarget === 'cat:' + node.cat.id }"
                    @click="selectPanCat(node.cat.id)"
                    @dragover.prevent="dropTarget = 'cat:' + node.cat.id" @dragleave="dropTarget === 'cat:' + node.cat.id && (dropTarget = '')" @drop.prevent="onPanDrop('cat:' + node.cat.id, node.cat.workspaceId, node.cat.id)">
                    <span v-if="node.children.length" class="gs-pan-toggle" @click.stop="togglePanCollapse('cat:' + node.cat.id)">{{ panCollapsed.has('cat:' + node.cat.id) ? '▸' : '▾' }}</span>
                    <span v-else class="gs-pan-toggle leaf">·</span>
                    <span class="gs-pan-name">📂 {{ node.cat.name }}</span>
                    <span class="gs-pan-count">{{ node.count }}</span>
                  </div>
                  <template v-if="!panCollapsed.has('cat:' + node.cat.id)">
                    <div v-for="ch in node.children" :key="ch.cat.id" class="gs-pan-row gs-pan-sub-row" :class="{ active: panSelCat === ch.cat.id, drop: dropTarget === 'cat:' + ch.cat.id }"
                      @click="selectPanCat(ch.cat.id)"
                      @dragover.prevent="dropTarget = 'cat:' + ch.cat.id" @dragleave="dropTarget === 'cat:' + ch.cat.id && (dropTarget = '')" @drop.prevent="onPanDrop('cat:' + ch.cat.id, ch.cat.workspaceId, ch.cat.id)">
                      <span class="gs-pan-toggle leaf">·</span>
                      <span class="gs-pan-name">└ {{ ch.cat.name }}</span>
                      <span class="gs-pan-count">{{ ch.count }}</span>
                    </div>
                  </template>
                </div>
              </template>
            </div>
            <div v-if="!panTree.length" class="gs-ev-empty">暂无工作台</div>
          </div>
          <!-- 右栏：当前分类卡片列表 -->
          <div class="gs-pan-list-wrap">
            <div class="gs-pan-list-head">
              <span class="gs-pan-crumb">{{ panCrumb }}</span>
              <label class="gs-pan-allcheck"><input type="checkbox" :checked="panAllChecked" @change="togglePanAll" /> 全选本分类</label>
            </div>
            <div class="gs-pan-list">
              <div v-for="r in panCards" :key="r.id" class="gs-pan-card" :class="{ selected: panSelected.has(r.id) }" draggable="true"
                @dragstart="onPanDragStart($event, r.id)" @dragend="dropTarget = ''"
                @click="onPanCardClick(r)" @dblclick="onPanCardDblClick(r)">
                <input type="checkbox" class="gs-pan-check" :checked="panSelected.has(r.id)" @click.stop @change="togglePanCard(r.id)" />
                <div class="gs-pan-card-main">
                  <div class="gs-pan-card-title"><span v-if="isMirrorView(r)" title="资源台镜像（真身在资源台）">📡 </span>{{ r.title }}</div>
                  <div class="gs-pan-card-sub">{{ panCardSub(r) }}</div>
                </div>
                <span class="gs-pan-card-date">{{ fmtDay(r.createdAt) }}</span>
              </div>
              <div v-if="!panCards.length" class="gs-ev-empty">左侧选择工作台或分类查看卡片</div>
            </div>
            <div v-if="panSelected.size" class="gs-pan-batch">
              <span class="gs-pan-batch-n">已选 {{ panSelected.size }} 张</span>
              <select class="gs-select" v-model="panMoveWs" @change="panMoveCat = ''">
                <option value="">目标工作台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</option>
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
            <div class="gs-pd-row"><span class="gs-pd-k">归属</span><span class="gs-pd-v">{{ gWsName(panDetail.workspaceId) }} / {{ gCatName(panDetail.categoryId) || '待分类' }}</span></div>
            <!-- R63-1：镜像卡展示真身归属 + 跳转 -->
            <template v-if="panMirrorSrc">
              <div class="gs-pd-row"><span class="gs-pd-k">📡 镜像</span><span class="gs-pd-v">真身在 {{ gWsName(panMirrorSrc.workspaceId) }} / {{ gCatName(panMirrorSrc.categoryId) || '待分类' }}</span></div>
              <div class="gs-pd-actions"><button class="gs-btn" @click="jumpMirrorSource">↩ 前往资源台真身</button></div>
            </template>
            <div class="gs-pd-row" v-if="panDetail.description"><span class="gs-pd-k">描述</span><span class="gs-pd-v">{{ panDetail.description }}</span></div>
            <div class="gs-pd-row" v-if="panDetail.tags && panDetail.tags.length"><span class="gs-pd-k">标签</span><span class="gs-pd-v">#{{ panDetail.tags.join(' #') }}</span></div>
            <div class="gs-pd-actions">
              <button class="gs-btn gs-btn-primary" @click="onPanCardDblClick(panDetail)">↗ 打开链接</button>
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
          <div class="gs-page-title">🏷 标签管理</div>
          <div class="gs-page-desc">树状标签体系 · 三种卡片打标签的唯一来源 · 支持拖拽调整层级</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">标签树</span><span class="gs-card-desc">拖拽标签到另一标签上可挂载为子标签</span></div>
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
                <div class="gs-tt-row" :class="{editing: ttEditing?.id === root.id, flash: ttFlashId === root.id}" :data-depth="tagDepth(root.id)" :style="{ paddingLeft: 8 + tagDepth(root.id) * 18 + 'px' }" draggable="true"
                  @dragstart="ttDragStart($event, root.id)" @dragend="ttDragEnd"
                  @dragover.prevent @drop="ttDrop($event, root.id)">
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
                  <div v-for="child in safeChildren(root)" :key="child.id" class="gs-tt-row subrow" :class="{editing: ttEditing?.id === child.id, flash: ttFlashId === child.id}" :data-depth="tagDepth(child.id)" :style="{ paddingLeft: 8 + tagDepth(child.id) * 18 + 'px' }" draggable="true"
                    @dragstart="ttDragStart($event, child.id)" @dragend="ttDragEnd"
                    @dragover.prevent @drop="ttDrop($event, child.id)">
                    <input v-if="ttEditing?.id === child.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                      @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                    <template v-else>
                      <span class="gs-tt-name sub">#{{ child.name || '未命名标签' }}</span>
                      <span class="gs-tt-count">{{ tagUsage(child.name) }} 卡</span>
                      <span class="gs-tt-actions">
                        <span class="gs-tt-act" title="添加第三级标签" @click="ttAddChild(child.id)">＋</span>
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
            <div class="gs-field-hint">💡 重命名会同步更新所有已打标签的卡片；删除标签后，卡片上的同名标签将显示为未归类。打标签入口：资源卡/任务卡/好奇心卡的详情编辑处。</div>
          </div>
        </div>
      </div>

      <!-- ===== 导入数据 ===== -->
      <div v-if="activePage === 'import'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⬇ 导入数据</div>
          <div class="gs-page-desc">从外部导入资源卡或工作台数据，导入时与现有数据取并集</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">导入方式</span></div>
          <div class="gs-card-body">
            <div class="gs-import-option" @click="triggerFileImport">
              <div class="gs-io-icon">📦</div>
              <div><div class="gs-io-name">导入知源调度台数据</div><div class="gs-io-desc">选择JSON文件，与现有数据取并集（同ID更新，不同ID新增）</div></div>
              <button class="gs-btn gs-btn-primary gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="assetPackInput?.click()">
              <div class="gs-io-icon">🗂</div>
              <div><div class="gs-io-name">导入附件包（第卌二轮）</div><div class="gs-io-desc">选择「导出附件包」生成的 zip，附件本体按 assetId 写回（同 ID 覆盖）；先导 JSON 再导附件包 = 完整迁移</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="bookmarkInput?.click()">
              <div class="gs-io-icon">🔖</div>
              <div><div class="gs-io-name">导入书签文件</div><div class="gs-io-desc">选择浏览器导出的书签HTML，文件夹作为标签，链接+标题写入资源卡</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <div class="gs-setting-row" style="margin-top:6px">
              <span class="gs-sr-label">书签导入到</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="bookmarkTargetWs">
                  <option value="__new__">🆕 新建工作台「书签导入」</option>
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</option>
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
          <div class="gs-page-desc">导出工作台数据用于备份或跨设备迁移</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">备份提醒（第卅六轮）</span></div>
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
              <div class="gs-er-info"><div class="gs-er-name">导出全部数据</div><div class="gs-er-desc">全量JSON：调度台（愿景/使命/方向/项目/成功指标）+ 方向台（工作台/三卡/标签/统计）及全部数据关系，用于整体迁移备份</div></div>
              <button class="gs-btn gs-btn-primary" @click="exportAll">导出</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">按工作台导出CSV</div><div class="gs-er-desc">字段：系统字段全导 + 自定义字段按可见性，列名/顺序跟随「字段管理」；尾随 链接类型/分类/置顶/星标/更新时间，适配Airtable等多维表</div></div>
              <select class="gs-select" v-model="csvWsId">
                <option value="">选择工作台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</option>
              </select>
              <button class="gs-btn" @click="exportCsvForWorkspace" :disabled="!csvWsId">导出CSV</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出指定工作台</div><div class="gs-er-desc">选择一个工作台导出为JSON</div></div>
              <select class="gs-select" v-model="exportWsId">
                <option value="">选择工作台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</option>
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
          <div class="gs-card-header"><span class="gs-card-title">📎 附件存储（第卅九轮）</span><span class="gs-card-desc">图片/HTML 本体在 IndexedDB，不占主数据</span></div>
          <div class="gs-card-body">
            <div class="gs-export-row">
              <div class="gs-er-info">
                <div class="gs-er-name">附件占用：{{ assetCount }} 个 · {{ formatBytes(assetBytes) }}</div>
                <div class="gs-er-desc">JSON 导出不含附件本体（保持轻量）；附件本体用下方附件包导出/导入迁移</div>
              </div>
              <button class="gs-btn" @click="refreshAssetStats">刷新</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出附件包（第卌二轮）</div><div class="gs-er-desc">全部附件本体打包为 zip；与「导出全部数据 JSON」配合 = 完整可迁移备份</div></div>
              <button class="gs-btn gs-btn-primary" @click="exportAssetPack">导出附件包</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">清理孤儿附件</div><div class="gs-er-desc">删除未被任何卡片引用的残留附件（上传中断等异常场景产生）</div></div>
              <button class="gs-btn" @click="cleanupOrphanAssetsAction">清理</button>
            </div>
          </div>
        </div>
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
              <span class="gs-sr-label">修改全局快捷键（含方向台 / 资源台 / 完整方向树）</span>
              <div class="gs-sr-control"><a :href="shortcutsUrl" target="_blank" class="gs-shortcut-link">前往 chrome://extensions/shortcuts ›</a></div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">应用内快捷键</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">切换工作台</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="wsMod" @change="saveWsMod">
            <option value="alt">Alt + 数字键（1=第 1 个工作台）</option>
            <option value="ctrl">Ctrl + 数字键（1=第 1 个工作台）</option>
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

      <!-- ===== 工作台快捷键（R49-I2：用户自建工作台从 1 起按创建顺序计数） ===== -->
      <div v-if="activePage === 'shortcuts'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🎛 工作台快捷键</div>
          <div class="gs-page-desc">在策展台标签页内按「修饰键 + 数字」直达；用户自建工作台从 1 起按创建顺序计数；调度台刷新自动回首页、方向台/资源台/完整方向树在浏览器快捷键（chrome://extensions/shortcuts）里自定义</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">映射表（按顶部导航顺序）</span><span class="gs-card-desc">第 N 个工作台 = 修饰键 + N（最多到数字 9）</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row" v-for="(w, i) in store.workspaces" :key="w.id">
              <span class="gs-sr-label">第 {{ i + 1 }} 个 · {{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ i + 1 <= 9 ? modLabel() + ' + ' + (i + 1) : '—' }}</span></div>
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
                <span v-if="atTableName" style="font-size:12px;color:var(--ok,var(--info-green,#3A6B4C))">✓ 已连上「{{ atTableName }}」</span>
              </div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步范围与触发</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">同步范围</span>
              <div class="gs-sr-control" style="font-size:12px;color:var(--text-2);max-width:380px;line-height:1.7;text-align:left">调度台好奇心卡 · 方向台任务卡 · 资源台资源卡 · 各策展台镜像卡（每条镜像为独立记录，带各自所属工作台标识）· 主题卡以「是否中心论点」列体现</div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">增量游标</span>
              <div class="gs-sr-control" style="font-size:12px;color:var(--text-2)">只推上次同步后有更新的卡（updatedAt 游标）</div>
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
                <span v-if="quotaText" style="font-size:12px;color:var(--text-3)">{{ quotaText }}</span>
              </div>
            </div>
            <div class="gs-setting-row" v-if="atStatusText">
              <span class="gs-sr-label">上次同步</span>
              <div class="gs-sr-control" style="font-size:12px;color:var(--text-2)">{{ atStatusText }}</div>
            </div>
            <div class="gs-setting-row" v-if="atErrorText">
              <span class="gs-sr-label">上次错误</span>
              <div class="gs-sr-control" style="font-size:12px;color:var(--danger,#c0392b)">{{ atErrorText }}</div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步日志</span><span class="gs-card-desc">最近 {{ atLog.length }} 条（最多保留 40 条）</span></div>
          <div class="gs-card-body">
            <div v-if="!atLog.length" class="gs-ev-empty">暂无同步记录——配置完成后点「立即同步」</div>
            <div v-for="(l, i) in atLog" :key="i" class="gs-setting-row" style="align-items:flex-start">
              <span class="gs-sr-label" style="white-space:nowrap">{{ new Date(l.at).toLocaleString('zh-CN') }}</span>
              <div class="gs-sr-control" style="font-size:12px;text-align:left;max-width:420px;color:var(--text-2)">{{ l.kind === 'error' ? '✗ ' : l.kind === 'ok' ? '✓ ' : '· ' }}{{ l.msg }}</div>
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
            <div style="font-size:14.5px;font-weight:600;color:var(--text)">使用手册已升级为独立阅读页</div>
            <div style="font-size:12px;color:var(--text-3);line-height:1.8;max-width:420px">五篇结构：速览一页上手 → 基础篇 → 方法篇（认知增强方法论）→ 理念篇（知源哲学与理论根基）→ 附录（快捷键全表与数据安全）。点击下方按钮在新标签页打开，支持左侧目录锚点定位。</div>
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
              <div class="gs-da-info"><div class="gs-da-name">一键回滚至初始状态</div><div class="gs-da-desc">清空所有用户创建的工作台和所有资源卡、好奇心卡、任务卡，仅保留调度台、方向台（任务中心）和默认工作台</div></div>
              <button class="gs-btn gs-btn-danger" @click="showResetModal = true">回滚</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">回收站</div><div class="gs-da-desc">浏览 / 恢复已删除的卡片，或永久删除（第卅三轮 REQ-018）</div></div>
              <button class="gs-btn" @click="router.push('/recycle')">进入</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">清空回收站</div><div class="gs-da-desc">永久删除所有已移入回收站的卡片，不可恢复</div></div>
              <button class="gs-btn gs-btn-danger" @click="emptyRecycleBin">清空</button>
            </div>
            <div class="gs-danger-action">
              <div class="gs-da-info"><div class="gs-da-name">清除缓存</div><div class="gs-da-desc">清除临时文件等，不影响卡片数据</div></div>
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
              <div class="gs-sr-control" style="color:var(--text-2);font-size:12px">V{{ runtimeVersion }}</div>
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
            <div class="gs-setting-row">
              <span class="gs-sr-label">默认存入工作台</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="defaultCaptureWs" @change="persistCapturePref">
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}（待分类）</option>
                </select>
              </div>
            </div>
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
            <div class="gs-about-motto">你不缺信息，你缺一座控制中心。</div>
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

    <!-- 回滚确认弹窗 -->
    <Teleport to="body">
      <div class="gs-modal-overlay" :class="{ open: showResetModal }" @click.self="closeResetModal">
        <div class="gs-modal">
          <div class="gs-modal-header">⚠ 确认回滚至初始状态</div>
          <div class="gs-modal-body">
            <p>此操作将清空所有用户创建的工作台和所有资源卡、好奇心卡、任务卡，<b style="color:var(--danger)">仅保留调度台、方向台（任务中心）和默认工作台</b>。</p>
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
import { ref, reactive, computed, watch, watchEffect, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { saveUIPrefs, getBytesInUse, subscribeSaveError, getLastSaveError, clearLastSaveError, hasUnlimitedStorage } from '@/shared/storage/repository'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import FieldEditor from './FieldEditor.vue'
import logoUrl from '@/assets/logo.png'
import { createDefaultData, defaultThesisFieldDefs } from '@/shared/storage/defaults'
// R63-4：Airtable 单向同步（连接测试 / 立即同步 / 配额提示）
import { testConnection, runSync, quotaHint, catPathOf } from '@/shared/storage/airtable'
import { LETTER_HTML, buildLetterStandaloneHtml } from '../letter-data'
import { uid } from '@/shared/utils'
import { getAssetStats, cleanupOrphanAssets, getAllAssets, putAssets } from '@/shared/storage/assets'
import { buildZip, readZip, type ZipEntry } from '@/shared/utils/zip'
import { visibleFields, allFields } from '@/shared/utils/fields'
import type { FieldDef, AppData, ResourceCard, Workspace, Category, TagNode, AssetMeta, ID } from '@/shared/models'
// R63-1/63-2：全景两级（资源台/策展台）与导出镜像卡适配
import { isHubWs, boardCardsOf, isMirrorView } from '@/shared/storage/hub'
import { CURATION_WS_ID } from '@/shared/models'

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
// 第卌四轮 T-03：设置默认首屏 = 知源仪表盘
const activePage = ref('dashboard')
/** 深链：/settings?page=tags 直达指定面板（TagPicker 空体系引导跳转用） */
function pageFromQuery(): string | null {
  const p = route.query.page
  if (typeof p !== 'string') return null
  return navGroups.some(g => g.items.some(i => i.key === p)) ? p : null
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
      type: 'zy_asset_pack', version: 1, exportedAt: new Date().toISOString(), count: all.length,
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
const navGroups = [
  // R54-E1（修订第卌四轮五组拍板）：总览 = 知源仪表盘 + 工作台全景并列，「整理」组取消
  { title: '总览', items: [
    { key: 'dashboard', icon: '📊', label: '知源仪表盘' },
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
  { title: '数据', items: [
    { key: 'import', icon: '⬇', label: '导入数据' },
    { key: 'export', icon: '⬆', label: '导出数据' },
    { key: 'reset', icon: '🔄', label: '重置与回滚' },
  ]},
  { title: '系统', items: [
    { key: 'extension', icon: '🔌', label: '扩展设置' },
    { key: 'shortcuts', icon: '⌨', label: '快捷键设置' },
    // R63-4：Airtable 单向同步（知源 → Airtable，手动为主）
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
// 第卌四轮 T-03/T-06/T-07：知源仪表盘（核心指标 + 动态条 + 操作记录 + CSV）
// ============================================================
import Drawer from '@/shared/components/Drawer.vue'
import { readEventLog, type CardEvent } from '@/shared/utils/eventLog'
import { readErrorLog } from '@/shared/utils/runtimeError'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '../stores/compass'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'

const gd = computed(() => store.data!)
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
const eventLog = ref<CardEvent[]>([])
const logEmpty = ref(true)
const expandedEventId = ref('')
const cumDelCount = ref(0)
const evKind = ref<'all' | 'resource' | 'task' | 'curiosity'>('all')
const evAction = ref<'all' | 'create' | 'delete' | 'restore' | 'purge'>('all')
const evFrom = ref('')
const evTo = ref('')

async function refreshEventLog() {
  const log = await readEventLog()
  eventLog.value = log.slice().reverse() // 新→旧
  logEmpty.value = log.length === 0
  cumDelCount.value = log.length
    ? log.filter(e => e.action === 'delete' || e.action === 'purge').length
    : gFlat.value.filter(x => x.deletedAt).length
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
const filteredEvents = computed<CardEvent[]>(() => {
  const from = evFrom.value ? new Date(evFrom.value + 'T00:00:00').getTime() : 0
  const to = evTo.value ? new Date(evTo.value + 'T23:59:59').getTime() : Infinity
  return timelineEvents.value.filter(e => {
    if (evKind.value !== 'all' && e.kind !== evKind.value && e.kind !== 'system') return false
    if (evAction.value !== 'all' && e.action !== evAction.value) return false
    if (e.ts < from || e.ts > to) return false
    return true
  })
})
function eventActionLabel(a: CardEvent['action']): string {
  return a === 'create' ? '+ 新增' : a === 'delete' ? '− 删除' : a === 'restore' ? '↩ 恢复' : '✕ 永久删除'
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
function eventDetailLines(e: CardEvent): string[] {
  const lines: string[] = [`卡片 ID：${e.cardId || '—'}`]
  const findCard = () => gd.value.resources.find(x => x.id === e.cardId) || gd.value.tasks.find(x => x.id === e.cardId) || gd.value.curiosities.find(x => x.id === e.cardId)
  if (e.kind === 'resource') {
    const r = gd.value.resources.find(x => x.id === e.cardId)
    if (r) { lines.push(`归属：${gWsName(r.workspaceId) || '—'} / ${gCatName(r.categoryId) || '待分类'}`); if (r.link) lines.push(`链接：${r.link}`) }
  } else if (e.kind === 'task') {
    const t = gd.value.tasks.find(x => x.id === e.cardId)
    if (t) lines.push(`状态：${t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待办'}`)
  } else if (e.kind === 'curiosity') {
    const c = gd.value.curiosities.find(x => x.id === e.cardId)
    if (c) lines.push(`探索状态：${c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索'}`)
  }
  if (!findCard() && e.kind !== 'system') lines.push('（卡片已不在库中：可能已永久删除）')
  return lines
}

// ---- CSV 导出（导出对象 = 操作记录时间线的当前筛选结果；Airtable 兼容 UTF-8+BOM） ----
function csvCell(v: string): string {
  const s = (v ?? '').toString()
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function exportEventsCsv() {
  const rows: string[] = [['时间', '动作', '卡片类型', '标题', '归属', '卡片ID'].join(',')]
  for (const e of filteredEvents.value) {
    let owner = ''
    if (e.kind === 'resource') {
      const r = gd.value.resources.find(x => x.id === e.cardId)
      if (r) owner = `${gWsName(r.workspaceId)} / ${gCatName(r.categoryId) || '待分类'}`
    }
    rows.push([fmtEventTime(e.ts), eventActionLabel(e.action), eventKindLabel(e.kind), csvCell(e.title), csvCell(owner), e.cardId].join(','))
  }
  // UTF-8 BOM：Excel/Airtable 打开不乱码
  const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dt = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  a.href = url
  a.download = `zhiyuan_操作记录_${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}.csv`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`✓ 已导出 ${filteredEvents.value.length} 条操作记录（按当前筛选）`)
}

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
function openStatCard(x: { kind: string; id: string }) {
  if (x.kind === 'resource') {
    const r = gd.value.resources.find(v => v.id === x.id)
    if (r) { router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: r.id } }); statDrawer.value = ''; return }
  } else if (x.kind === 'task') {
    router.push({ path: '/', query: { hl: x.id } }); statDrawer.value = ''; return
  } else {
    router.push({ path: '/', query: { hl: x.id } }); statDrawer.value = ''; return
  }
  showToast('⚠ 该卡片已不在库中')
}
const statDrawerTitle = computed(() => ({
  all: `📊 全部卡片明细（${totalCards.value}）`,
  resource: `📇 资源卡明细（${resLiveCount.value}）`,
  task: `✅ 任务卡明细（${taskLiveCount.value}）`,
  curiosity: `💡 好奇心卡明细（${curioLiveCount.value}）`,
  link: `🔗 链接卡片明细（${linkCardCount.value} · 跨全部工作台）`,
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
// 第卌四轮 T-04/T-04'：工作台全景（双栏 Master-Detail + 批量移动双通道）
// R63-1：资源台/策展台两级——策展台计数与列表含镜像卡（boardCardsOf），镜像卡标 📡 可跳真身
interface PanCatNode { cat: { id: string; name: string; workspaceId: string }; count: number; children: PanCatNode[] }
interface PanWsNode { ws: { id: string; name: string; icon?: string }; count: number; cats: PanCatNode[] }
/** R63-1：分类计数——资源台按原生卡，策展台按台内+镜像（镜像归到台内落点分类） */
function panCountByCat(cat: { id: string; workspaceId: string }): number {
  if (isHubWs(store.workspaces.find(w => w.id === cat.workspaceId))) {
    return gResLive.value.filter(r => r.categoryId === cat.id).length
  }
  return boardCardsOf(store.data!, cat.workspaceId).filter(r => (r.categoryId || '') === cat.id).length
}
/** R63-1：台卡片计数——资源台原生卡数；策展台含镜像（R65-F5 全景仅资源台，策展台分支保留兜底） */
function panCountByWs(wsId: string): number {
  if (isHubWs(store.workspaces.find(w => w.id === wsId))) {
    return gResLive.value.filter(r => r.workspaceId === wsId).length
  }
  return boardCardsOf(store.data!, wsId).length
}
/** R65-F5：全景树只呈现资源台（策展台不进全景） */
const panHubWss = computed(() => store.workspaces.filter(w => isHubWs(w)))
const panTree = computed<PanWsNode[]>(() =>
  panHubWss.value.map(w => {
    const roots = gd.value.categories.filter(c => c.workspaceId === w.id && !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const toNode = (c: { id: string; name: string; workspaceId: string }): PanCatNode => ({
      cat: { id: c.id, name: c.name, workspaceId: c.workspaceId },
      count: panCountByCat(c),
      children: gd.value.categories.filter(ch => ch.parentId === c.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(ch => ({
        cat: { id: ch.id, name: ch.name, workspaceId: ch.workspaceId }, count: panCountByCat(ch), children: []
      }))
    })
    return { ws: { id: w.id, name: w.name, icon: w.icon }, count: panCountByWs(w.id), cats: roots.map(toNode) }
  })
)
const panTotalCats = computed(() => gd.value.categories.filter(c => panHubWss.value.some(w => w.id === c.workspaceId)).length)
const panTotalCards = computed(() => panHubWss.value.reduce((s, w) => s + panCountByWs(w.id), 0))
const panCollapsed = ref<Set<string>>(new Set()) // 默认全展开
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
  if (panSelWs.value && !isHubWs(store.workspaces.find(w => w.id === panSelWs.value))) {
    // R63-1：策展台 = 台内原生 + 镜像卡（视图模型），按分类过滤
    const cards = boardCardsOf(store.data!, panSelWs.value)
    return panSelCat.value ? cards.filter(r => (r.categoryId || '') === panSelCat.value) : cards
  }
  if (panSelCat.value) return gResLive.value.filter(r => r.categoryId === panSelCat.value)
  if (panSelWs.value) return gResLive.value.filter(r => r.workspaceId === panSelWs.value)
  return []
})
const panCrumb = computed(() => {
  if (panSelCat.value) {
    const cat = gd.value.categories.find(c => c.id === panSelCat.value)
    if (cat) {
      const parent = cat.parentId ? gCatName(cat.parentId) + ' / ' : ''
      return `${gWsName(cat.workspaceId)} / ${parent}${cat.name} · ${panCards.value.length} 张`
    }
  }
  if (panSelWs.value) return `${gWsName(panSelWs.value)} · 全部卡片 ${panCards.value.length} 张`
  return '左侧选择工作台或分类'
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
  const targetIsHub = isHubWs(store.workspaces.find(w => w.id === targetWs))
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
    // R63-1：资源台真身不可直接搬进策展台——改用资源台「📡 镜像到策展台」入台
    if (!targetIsHub && r.workspaceId === CURATION_WS_ID) { showToast('⚠ 资源台真身不能直接搬入策展台，请用资源台的「📡 镜像到策展台」'); continue }
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
let panClickTimer: ReturnType<typeof setTimeout> | null = null
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
function onPanCardClick(r: ResourceCard) {
  if (panClickTimer) { clearTimeout(panClickTimer); panClickTimer = null; return }
  panClickTimer = setTimeout(() => { panClickTimer = null; panDetail.value = r }, 260)
}
function onPanCardDblClick(r: ResourceCard) {
  if (panClickTimer) { clearTimeout(panClickTimer); panClickTimer = null }  recordResourceOpen(gd.value, r)
  store.persist()
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
    const meta = (r.assets || []).find(a => a.id === assetId)
    if (meta && (meta.kind === 'html' || meta.kind === 'pdf')) { openHtmlAsset(meta); return }
  }
  const url = toOpenableUrl(r.linkType, r.link)
  if (url) openExternalLink(url)
  else showToast('⚠ 该卡片无可打开链接')
}
watch(activePage, (p) => {
  if (p === 'dashboard') refreshEventLog()
  if (p === 'panorama' && !panSelWs.value && store.workspaces.length) selectPanWs(store.workspaces[0].id)
})
refreshEventLog()

// ---- R48-A1：运行错误留痕（zy_error_log，TDZ 排查弹药） ----
const errorLogCount = ref(0)
async function refreshErrorCount() { errorLogCount.value = (await readErrorLog()).length }
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
    if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-field-text" style="color:var(--text-3);font-size:11px">完整记录V2.12版本的功能设计、交互规范和数据模型...</span></div>'
    if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">来源:</span><span class="gs-pv-field-text">学术</span></div>'
    if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span><span class="gs-pv-tag">#产品设计</span></span></div>'
    if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">添加:</span><span class="gs-pv-field-text">2026-08-28</span></div>'
    return html
  }
  if (previewMode.value === 'list') {
    let html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    if (has('title')) html += '<span style="font-weight:600;font-size:12px">知源调度台V2.12全产品PRD手册</span>'
    if (has('link')) html += '<span class="gs-pv-field-link">🔗</span>'
    if (has('description')) html += '<span style="font-size:10px;color:var(--text-3)">PRD手册...</span>'
    if (has('sourceType')) html += '<span style="font-size:10px;color:var(--text-3)">学术</span>'
    if (has('tags')) html += '<span class="gs-pv-tag">#PRD</span>'
    if (has('createdAt')) html += '<span style="font-size:10px;color:var(--text-3)">08-28</span>'
    html += '</div>'
    return html
  }
  // kanban
  let html = ''
  if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title" style="font-size:12px">知源调度台V2.12全产品PRD手册</div>'
  if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span></span></div>'
  if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link" style="font-size:10px">🔗 PRD手册.docx</span></div>'
  if (has('description')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">功能设计、交互规范...</span></div>'
  if (has('sourceType')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">学术</span></div>'
  if (has('createdAt')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">08-28</span></div>'
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
      try { downloadFile(`zhiyuan_auto_backup_before_import_${dateStr()}.json`, JSON.stringify(store.data, null, 2)) } catch {}
      const n = mergeImport(imported)
      showToast(`✓ 导入完成（并集）：卡片 ${n.cards}、罗盘方向 ${n.dirs}、工作台 ${n.ws}；已自动下载导入前备份`)
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
          color: 'var(--info-blue)', coverTheme: 'deep-sea', desc: '从浏览器书签导入', order: d.workspaces.length, archived: false
        }
        d.workspaces.push(ws)
      }
      let cat = d.categories.find(c => c.workspaceId === ws!.id && c.name === '待分类')
      if (!cat) {
        cat = { id: uid('cat'), workspaceId: ws!.id, name: '待分类', order: d.categories.filter(c => c.workspaceId === ws!.id).length }
        d.categories.push(cat)
      }
      for (const b of items) {
        const tags = Array.from(new Set(b.path.filter(p => p && p !== '书签栏')))
        let linkType: ResourceCard['linkType'] = 'url'
        if (b.url.startsWith('file:')) linkType = 'file'
        else if (b.url.startsWith('obsidian:')) linkType = 'obsidian'
        d.resources.unshift({
          id: uid('rc'), kind: 'resource', title: b.title.substring(0, 120), linkType, link: b.url,
          workspaceId: ws!.id, categoryId: cat.id, description: '', tags,
          customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
        })
      }
      store.persist()
      showToast('✓ 已导入 ' + items.length + ' 个书签到「' + ws.name + '」（文件夹已作为标签）')
    } catch { showToast('✗ 书签文件解析失败') }
  }
  reader.readAsText(file)
  input.value = ''
}

/** R47-A2：全量并集合并——罗盘（愿景/使命/方向→项目→指标）+ 引擎数据 + 全部关系字段
 *  原则：卡片/指标按 id 去重合并；「关系列表」（taskIds/linkedResourceIds 等）一律取并集；
 *        计数类（stats.wrr）取最大值；标量以导入方覆盖（无 updatedAt 的层级按导入值合并）。 */
function mergeImport(imported: AppData): { cards: number; dirs: number; ws: number } {
  const d = store.data!
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(x => [x.id, x]))
    for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
    return [...map.values()]
  }
  const union = (...lists: (ID[] | undefined)[]): ID[] => Array.from(new Set(lists.flatMap(l => l || [])))
  const wsBefore = d.workspaces.length

  // ---- 方向台：工作台 / 分类 / 三卡 ----
  // R48-B2：导入卡片统一打 importedAt 戳（双口径统计「新建 X · 导入 Y」的依据；合并进既有卡也重打——它确实在本次被导入）
  const importedNow = Date.now()
  d.workspaces = mergeById(d.workspaces, imported.workspaces || [])
  d.categories = mergeById(d.categories, imported.categories || [])
  d.resources = mergeById(d.resources, (imported.resources || []).map(r => ({ ...r, importedAt: importedNow })))
  d.tasks = mergeById(d.tasks, (imported.tasks || []).map(t => ({ ...t, importedAt: importedNow })))
  d.curiosities = mergeById(d.curiosities, (imported.curiosities || []).map(c => ({ ...c, importedAt: importedNow })))
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
      d.stats.wrr.thisWeekUsage = Math.max(d.stats.wrr.thisWeekUsage || 0, imported.stats.wrr.thisWeekUsage || 0)
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
  store.persist()
  return { cards: cardsAdded, dirs: imported.compass?.directions?.length || 0, ws: d.workspaces.length - wsBefore + (imported.workspaces?.length || 0) }
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

function exportAll() {
  const d = store.data!
  downloadFile(`zhiyuan_backup_${dateStr()}.json`, JSON.stringify(d, null, 2))
  markBackupNow()
  showToast('✓ 全部数据已导出为JSON')
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
    case 'assets': {
      // 附件列 = 文本摘要（与 fieldValue assets 同规则：N 图 · M HTML）
      const list = r.assets || []
      const imgs = list.filter(a => a.kind === 'image').length
      const htmls = list.length - imgs
      const parts: string[] = []
      if (imgs) parts.push(`${imgs} 图`)
      if (htmls) parts.push(`${htmls} HTML`)
      return parts.join(' · ')
    }
    default: {
      const v = (r as unknown as Record<string, unknown>)[key]
      return v == null ? '' : String(v)
    }
  }
}

/** 按工作台导出 CSV —— 第卌一轮 REQ-055：动态列对齐字段目录
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
    { label: '分类', get: r => catMap.get(r.categoryId) || '待分类' },
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
  downloadFile(`zhiyuan_${ws.name.replace(/^[^\s]+\s/, '')}_${dateStr()}.csv`,
    '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
    'text/csv;charset=utf-8')
  markBackupNow()
  showToast(`✓ 「${ws.name.replace(/^[^\s]+\s/, '')}」已导出 ${cards.length} 条资源卡 CSV`)
}

function exportWorkspace() {
  if (!exportWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === exportWsId.value)
  if (!ws) return
  const cats = d.categories.filter(c => c.workspaceId === ws.id)
  const subset: AppData = {
    ...d, workspaces: [ws], categories: cats,
    resources: d.resources.filter(r => r.workspaceId === ws.id),
    tasks: d.tasks.filter(t => t.mountedResourceIds?.some(rid => d.resources.find(r => r.id === rid)?.workspaceId === ws.id)),
    curiosities: d.curiosities.filter(c => c.relatedResourceIds?.some(rid => d.resources.find(r => r.id === rid)?.workspaceId === ws.id)),
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
  closeResetModal()
  showToast('✓ 已回滚至初始状态')
  setTimeout(() => router.push('/compass'), 800)
}
function emptyRecycleBin() {
  const d = store.data!
  const rCount = d.resources.filter(r => r.deletedAt).length
  const tCount = d.tasks.filter(t => (t as any).deletedAt).length
  const cCount = d.curiosities.filter(c => (c as any).deletedAt).length
  d.resources = d.resources.filter(r => !r.deletedAt)
  d.tasks = d.tasks.filter(t => !(t as any).deletedAt)
  d.curiosities = d.curiosities.filter(c => !(c as any).deletedAt)
  store.persist()
  showToast(`✓ 回收站已清空，永久删除 ${rCount + tCount + cCount} 张卡片`)
}
function clearCache() {
  showToast('✓ 缓存已清除')
}

// ---- 抓取偏好 ----
const capturePref = reactive({ defaultWsId: '', autoFolderName: true })
const defaultCaptureWs = computed({
  get: () => capturePref.defaultWsId || store.workspaces[0]?.id || '',
  set: (v: string) => { capturePref.defaultWsId = v }
})
function persistCapturePref() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ zy_capture_pref: { ...capturePref } })
  }
}
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get('zy_capture_pref').then(r => {
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
function tagUsage(name: string): number {
  const d = store.data!
  let n = 0
  ;(d.resources || []).forEach(r => { if (Array.isArray(r.tags) && r.tags.includes(name)) n++ })
  ;(d.tasks || []).forEach(t => { if (Array.isArray(t.tags) && t.tags.includes(name)) n++ })
  ;(d.curiosities || []).forEach(c => { if (Array.isArray(c.tags) && c.tags.includes(name)) n++ })
  return n
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
  if (tagDepth(parentId) >= 2) { showToast('标签最多 3 级'); return }
  ttEditing.value = { id: null, parentId, value: '' }
  ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parentId))
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
    hit.node.name = name
    const d = store.data!
    const swap = (arr?: string[]) => (Array.isArray(arr) ? arr.map(t => (t === oldName ? name : t)) : [])
    d.resources.forEach(r => r.tags = swap(r.tags))
    d.tasks.forEach(t => t.tags = swap(t.tags))
    d.curiosities.forEach(c => c.tags = swap(c.tags))
    store.persist()
    showToast(`✓ 已重命名并同步 ${tagUsage(name)} 张卡片`)
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
  if (!(await useConfirm({ title: '删除标签', message: `确定删除 ${names.join(' ')} ？${subCount > 0 ? `\n（含 ${subCount} 个子标签）` : ''}\n卡片上的同名标签会保留（显示为未归类）。`, confirmText: '确认删除' }))) return
  hit.list.splice(hit.index, 1)
  store.persist()
  showToast(`🗑 已删除 ${names.join(' ')}${subCount > 0 ? `（含 ${subCount} 个子标签）` : ''}`)
}
function ttDragStart(e: DragEvent, id: string) { ttDragId = id }
function ttDragEnd() { ttDragId = null }
function ttDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!ttDragId || ttDragId === targetId) return
  if (tagSubtreeIds(ttDragId).includes(targetId)) { showToast('不能挂载到自己的子标签下'); return }
  if (tagDepth(targetId) >= 2) { showToast('标签最多 3 级，无法再挂载子级'); return }
  const from = findTagNode(ttDragId)
  const to = findTagNode(targetId)
  if (!from || !to) return
  from.list.splice(from.index, 1)
  to.node.children = to.node.children || []
  to.node.children.push(from.node)
  store.persist()
  ttDragId = null
  showToast(`✓ 「${from.node.name}」已挂载到「${to.node.name}」下`)
}

const appShortcuts = [
  { label: '保存（所有编辑弹窗）', keys: 'Ctrl+Enter' },
  { label: '关闭弹窗/浮层', keys: 'Esc' },
  { label: '搜索浮层内过滤类型', keys: '输入「任务/资源/好奇心」+ Tab' },
  { label: '工作台：双击卡片打开链接', keys: '双击' },
  { label: '资源卡批量管理', keys: '工作台工具条「☑ 批量管理」' }
]

// ---- 使用手册（第二十轮：数据外置 manual-data.ts，五篇结构） ----
const activeManualSec = ref('quick-1')

</script>

<style scoped>
.gs-page { display: flex; max-width: 1200px; margin: 0 auto; }

/* 返回按钮 */
.gs-back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 13px; color: var(--text-2); cursor: pointer; transition: all .15s; margin-bottom: 16px; text-decoration: none; width: fit-content; }
.gs-back-btn:hover { background: var(--surface-3); color: var(--text); }

/* 左侧导航 */
.gs-nav { width: 210px; flex-shrink: 0; border-right: 1px solid var(--border); padding: 20px 12px; background: var(--surface); position: sticky; top: 52px; height: fit-content; }
.gs-nav-group { margin-bottom: 16px; }
.gs-nav-group-title { font-size: 10.5px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; padding: 0 10px; margin-bottom: 5px; }
.gs-nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 12.5px; color: var(--text-2); cursor: pointer; transition: all .1s; margin-bottom: 1px; }
.gs-nav-item:hover { background: var(--surface-3); color: var(--text); }
.gs-nav-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.gs-nav-icon { font-size: 14px; width: 18px; text-align: center; }

/* 右侧内容 */
.gs-content { flex: 1; padding: 24px 32px; overflow-y: auto; }
.gs-page-header { margin-bottom: 22px; }
.gs-page-title { font-size: 18px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
.gs-page-desc { font-size: 12px; color: var(--text-3); margin-top: 4px; }

/* 卡片 */
.gs-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 16px; overflow: hidden; }
.gs-card-header { padding: 13px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.gs-card-title { font-size: 13px; font-weight: 600; color: var(--text); }
.gs-card-desc { font-size: 11px; color: var(--text-3); margin-left: auto; }
.gs-card-body { padding: 16px 18px; }

/* 设置行 */
.gs-setting-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.gs-setting-row:last-child { border-bottom: none; }
.gs-sr-label { font-size: 12.5px; color: var(--text); min-width: 120px; }
.gs-sr-control { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* 开关 */
.gs-toggle { width: 38px; height: 21px; border-radius: 99px; background: var(--border-strong); cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
.gs-toggle.on { background: var(--accent); }
.gs-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.gs-toggle.on::after { transform: translateX(17px); }

/* 输入框/下拉 */
.gs-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text); background: var(--surface); outline: none; transition: all .15s; font-family: inherit; }
.gs-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }

/* 按钮 */
.gs-btn { padding: 7px 16px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all .15s; display: inline-flex; align-items: center; gap: 5px; font-family: inherit; }
.gs-btn:hover { border-color: var(--accent); color: var(--accent); }
.gs-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-btn-primary:hover { background: var(--accent-hover); }
.gs-btn-danger { color: var(--danger); border-color: rgba(196,68,68,.3); }
.gs-btn-danger:hover { background: var(--tag-danger-bg); border-color: var(--danger); }
.gs-btn:disabled { opacity: .5; cursor: not-allowed; }

/* 字段管理 */

.gs-field-add { margin-top: 10px; padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 8px; text-align: center; cursor: pointer; font-size: 12.5px; color: var(--text-3); transition: all .15s; }
.gs-field-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.gs-field-hint { margin-top: 12px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; font-size: 11.5px; color: var(--accent); line-height: 1.7; }

/* 预览 */
.gs-preview-section { margin-top: 16px; }
.gs-preview-title { font-size: 11.5px; font-weight: 600; color: var(--text-3); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.gs-preview-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.gs-preview-tab { padding: 4px 11px; border-radius: 6px; font-size: 11px; cursor: pointer; background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); transition: all .15s; }
.gs-preview-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-preview-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 14px; min-height: 80px; }
.gs-pv-field { margin-bottom: 6px; font-size: 11.5px; }
.gs-pv-field:last-child { margin-bottom: 0; }
.gs-pv-field-title { font-weight: 600; color: var(--text); font-size: 12.5px; }
.gs-pv-field-label { color: var(--text-3); font-size: 10px; margin-right: 4px; }
.gs-pv-field-text { color: var(--text-2); }
.gs-pv-field-tags { display: inline-flex; gap: 4px; }
.gs-pv-tag { font-size: 9.5px; padding: 1px 6px; border-radius: 99px; background: var(--accent-light); color: var(--accent); }
.gs-pv-field-link { font-size: 10.5px; color: var(--info-blue); }

/* 导入导出 */
.gs-import-option { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 10px; cursor: pointer; transition: all .15s; background: var(--surface); }
.gs-import-option:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-io-icon { font-size: 22px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: 8px; flex-shrink: 0; }
.gs-io-name { font-size: 13px; font-weight: 500; color: var(--text); }
.gs-io-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.gs-io-btn { margin-left: auto; }
.gs-export-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-export-row:last-child { border-bottom: none; }
.gs-er-info { flex: 1; }
.gs-er-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
.gs-er-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }

/* 第卅六轮 REQ-038：开关 + 容量/异常行 */
.gs-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex: 0 0 auto; }
.gs-switch input { opacity: 0; width: 0; height: 0; }
.gs-switch-slider { position: absolute; cursor: pointer; inset: 0; background: var(--surface-3); border-radius: 99px; transition: .2s; }
.gs-switch-slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 2px; top: 2px; background: var(--text); border-radius: 50%; transition: .2s; }
.gs-switch input:checked + .gs-switch-slider { background: var(--accent); }
.gs-switch input:checked + .gs-switch-slider::before { transform: translateX(16px); background: #fff; }

.gs-storage-detail { color: var(--text-3); font-size: 11px; }
.gs-about-row-danger { color: var(--danger); }
.gs-about-row-danger .label { color: var(--danger); }
.gs-save-error-kind { display: inline-block; padding: 1px 6px; background: rgba(196,68,68,.12); color: var(--danger); border-radius: 4px; font-weight: 500; font-size: 11px; margin-right: 4px; }

/* 危险区 */
.gs-danger-zone { border-color: rgba(196,68,68,.2); }
.gs-danger-zone .gs-card-header { border-bottom-color: rgba(196,68,68,.15); }
.gs-danger-zone .gs-card-title { color: var(--danger); }
.gs-danger-action { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-danger-action:last-child { border-bottom: none; }
.gs-da-info { flex: 1; }
.gs-da-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
.gs-da-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }

/* 状态徽章 */
.gs-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 500; }
.gs-status-badge.connected { background: var(--tag-ok-bg); color: var(--success); }
.gs-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

/* 按键 */
.gs-keycap { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); font-size: 12px; font-family: monospace; color: var(--text); min-width: 120px; justify-content: center; }
.gs-keycap-link { text-decoration: none; cursor: pointer; transition: all .15s; }
.gs-keycap-link:hover { border-color: var(--accent); color: var(--accent); }
.gs-shortcut-link { font-size: 12px; color: var(--accent); text-decoration: none; }
.gs-shortcut-link:hover { text-decoration: underline; }

/* 关于 */
.gs-about-card { text-align: center; padding: 28px 20px; }
.gs-about-logo { width: 64px; height: 64px; border-radius: 16px; overflow: hidden; margin: 0 auto 14px; box-shadow: var(--shadow); }
.gs-about-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gs-about-name { font-size: 16px; font-weight: 700; color: var(--text); }
.gs-about-version { font-size: 13px; color: var(--text-2); margin-bottom: 4px; }
.gs-about-motto { font-size: 12px; color: var(--text-3); font-style: italic; margin-bottom: 0; }
.gs-about-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.gs-about-row:last-child { border-bottom: none; }
.gs-about-row .label { color: var(--text-3); }
.gs-about-row .value { color: var(--text-2); }
.gs-about-row .value.gs-link { color: var(--accent); cursor: pointer; }
.gs-about-row .value.gs-link:hover { text-decoration: underline; }

/* 弹窗 */
.gs-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 300; display: none; align-items: center; justify-content: center; }
.gs-modal-overlay.open { display: flex; }
.gs-modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 420px; max-width: 90vw; overflow: hidden; }
.gs-modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text); }
.gs-modal-body { padding: 18px 20px; }
.gs-modal-body p { font-size: 12.5px; color: var(--text-2); line-height: 1.6; margin-bottom: 12px; }
.gs-confirm-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; outline: none; font-family: inherit; margin-top: 8px; background: var(--surface); color: var(--text); }
.gs-confirm-input:focus { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(196,68,68,.15); }
.gs-modal-footer { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

/* 使用手册（左目录右内容） */
.gs-manual { display: flex; gap: 16px; align-items: flex-start; }
.gs-manual-nav { width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 8px; position: sticky; top: 16px; }
.gs-mn-part { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 10px 10px 5px; }
.gs-mn-item { font-size: 12.5px; color: var(--text-2); padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: all .12s; }
.gs-mn-item:hover { background: var(--surface-3); color: var(--text); }
.gs-mn-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.gs-manual-body { flex: 1; min-width: 0; }
.gs-mc-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 34px 40px; margin-bottom: 20px; }
.gs-mc-title { font-size: 14.5px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
.gs-mc-content { font-size: 13px; color: var(--text-2); line-height: 1.9; }
.gs-manual-open { padding: 10px 22px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.gs-manual-open:hover { background: var(--accent-hover); }

/* 手册富文本（v-html 内容） */
.gs-mc-content p { margin: 8px 0; }
.gs-mc-content h4 { font-size: 13.5px; font-weight: 700; color: var(--text); margin: 16px 0 6px; padding-left: 9px; border-left: 3px solid var(--accent); }
.gs-mc-content ul { margin: 6px 0; padding-left: 20px; }
.gs-mc-content li { margin: 5px 0; }
.gs-mc-content li b, .gs-mc-content p b { color: var(--text); }
.gs-mc-content strong { color: var(--accent); font-weight: 700; }
.gs-mc-content code { background: var(--surface-3); border-radius: 4px; padding: 1px 6px; font-size: 11.5px; color: var(--text-2); }
.gs-mc-content kbd { background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: 11px; color: var(--text); margin: 0 2px; box-shadow: 0 1px 0 var(--border-strong); white-space: nowrap; }
.gs-mc-content .mc-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 8px; padding: 10px 14px; margin: 10px 0; font-size: 12.5px; color: var(--text); }
.gs-mc-content .mc-tip { background: var(--accent-light); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; color: var(--text-2); line-height: 1.8; }
.gs-mc-content .mc-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; line-height: 1.8; }
.gs-mc-content .mc-quote { background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 40%, var(--surface))); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 12px 0; font-size: 13.5px; line-height: 2; color: var(--text); }
.gs-mc-content .mc-steps { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.gs-mc-content .mc-step { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: 10px; padding: 9px 12px; font-size: 12.5px; color: var(--text-2); line-height: 1.7; }
.gs-mc-content .mc-step b:first-child { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-top: 1px; }
.gs-mc-content .mc-note { display: flex; gap: 8px; font-size: 12px; color: var(--text-3); padding: 6px 2px; line-height: 1.7; }
.gs-mc-content .mc-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; }
.gs-mc-content .mc-table th { text-align: left; background: var(--surface-3); color: var(--text); font-weight: 600; padding: 7px 10px; border: 1px solid var(--border); }
.gs-mc-content .mc-table td { padding: 7px 10px; border: 1px solid var(--border); color: var(--text-2); vertical-align: top; }
.gs-mc-content .mc-table tr:hover td { background: var(--surface-2); }

/* 一封信 */
/* 信纸排版（第廿九轮：明显留白——行距 2.75 / 段距 32px / 640px 窄栏 / 落款前 72px，给读者呼吸感） */
.gs-letter { max-width: 640px; margin: 0 auto; padding: 80px 64px !important; background: var(--surface); font-family: "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif; }
.gs-letter .lp-saluta { font-size: 15px; margin-bottom: 44px; color: var(--text); }
.gs-letter .lp-body p { font-size: 13.5px; line-height: 3.1; margin: 0 0 40px; text-align: justify; color: var(--text-2); }
.gs-letter .lp-body b { color: var(--text); }
.gs-letter .lp-sign { margin-top: 84px; text-align: right; font-size: 13px; line-height: 2.2; color: var(--text-3); }
.gs-letter .lp-sign b { font-size: 14px; color: var(--text); }
.gs-letter .lp-date { font-size: 11px; color: var(--text-4); margin-top: 10px; letter-spacing: .05em; }
/* 第卅轮：模块化分节——lp-h 节头（粗体转折句独立成节） lp-turn 节内停顿（短句）/ lp-creed 信念行；R49 加大留白 */
.gs-letter .lp-body p.lp-h { margin: 68px 0 40px; font-size: 14.5px; color: var(--text); }
.gs-letter .lp-body p.lp-turn { margin: 24px 0 40px; color: var(--text); }
.gs-letter .lp-body p.lp-creed { margin: 56px 0 0; letter-spacing: .08em; color: var(--text); font-weight: 600; }
/* 标签管理（N4） */
.gs-tt-row.editing { border-color: var(--accent); }
.gs-tt-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 12.5px; font-family: inherit; color: var(--text); padding: 2px 4px; }
.gs-tt-ico { font-size: 12px; flex-shrink: 0; }
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
.gs-tt-empty { padding: 26px; text-align: center; color: var(--text-3); font-size: 12.5px; border: 1.5px dashed var(--border-strong); border-radius: 8px; }

.gs-tagtree { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.gs-tt-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; cursor: grab; transition: all .12s; }
.gs-tt-row:hover { border-color: var(--accent); }
.gs-tt-toggle { width: 16px; font-size: 10px; color: var(--text-3); cursor: pointer; flex-shrink: 0; }
.gs-tt-name { font-size: 12.5px; font-weight: 600; color: var(--text); }
.gs-tt-name.sub { font-weight: 500; color: var(--text-2); }
.gs-tt-count { font-size: 10px; color: var(--text-3); background: var(--surface-3); padding: 1px 7px; border-radius: 99px; }
.gs-tt-actions { margin-left: auto; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.gs-tt-row:hover .gs-tt-actions { opacity: 1; }
.gs-tt-act { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 11px; color: var(--text-3); cursor: pointer; }
.gs-tt-act:hover { background: var(--surface-3); color: var(--text); }
.gs-tt-act.del:hover { color: var(--danger); }

/* ===== 第卌四轮：知源仪表盘 ===== */
.gs-dash-en { font-size: 10px; color: var(--text-3); letter-spacing: 2px; margin-left: 6px; }
.gs-dash-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
.gs-dash-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; cursor: pointer; transition: all .15s; }
.gs-dash-stat:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ds-label { font-size: 11.5px; color: var(--text-2); margin-bottom: 6px; }
.gs-ds-value { font-size: 24px; font-weight: 700; color: var(--text); line-height: 1.1; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 8px; }
.gs-ds-today { font-size: 10.5px; font-weight: 600; color: var(--accent); background: var(--accent-light); border-radius: 99px; padding: 1px 8px; }
.gs-ds-sub { font-size: 10px; color: var(--text-3); margin-top: 3px; }
.gs-dash-dynamic { display: flex; align-items: center; gap: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 11px 16px; margin-bottom: 14px; }
.gs-dd-seg { font-size: 13px; color: var(--text-2); cursor: pointer; border-radius: 6px; padding: 2px 6px; transition: all .15s; }
.gs-dd-seg:hover { background: var(--accent-light); color: var(--accent); }
.gs-dd-seg b.up { color: var(--accent); font-size: 15px; }
.gs-dd-seg b.down { color: var(--danger); font-size: 15px; }
.gs-dd-imp { font-size: 10.5px !important; color: var(--text-3) !important; margin-left: 4px; font-weight: 600 !important; }
.gs-dd-err { color: var(--danger); }
.gs-dd-err b { font-size: 13px !important; }
/* R48-B1：明细抽屉搜索框 + 翻页器 */
.gs-drawer-search { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.gs-drawer-search input { flex: 1; padding: 7px 11px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
.gs-drawer-search input:focus { border-color: var(--accent); }
.gs-drawer-search .cnt { font-size: 11px; color: var(--text-3); white-space: nowrap; }
.gs-pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 2px 0; border-top: 1px solid var(--border); }
.gs-pager span { font-size: 11px; color: var(--text-3); }
.gs-pager button { padding: 5px 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: 11.5px; color: var(--text-2); cursor: pointer; font-family: inherit; transition: all .12s; }
.gs-pager button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.gs-pager button:disabled { opacity: .4; cursor: not-allowed; }
.gs-dd-sep { color: var(--border); }
.gs-dd-export { margin-left: auto; }
.gs-ev-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.gs-ev-fl { font-size: 11.5px; color: var(--text-3); }
.gs-ev-date { width: auto; padding: 4px 8px; }
.gs-ev-tilde { color: var(--text-3); }
.gs-ev-count { margin-left: auto; font-size: 11px; color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 2px 9px; }
.gs-ev-list { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; }
/* R51-B7：抽屉内列表撑满高度——搜索固定、列表 flex 撑满、翻页贴底，消除下方大片空白 */
.gs-drawer-fill { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.gs-drawer-fill .gs-drawer-search { flex-shrink: 0; }
.gs-drawer-fill .gs-ev-list { flex: 1; max-height: none; overflow-y: auto; min-height: 0; }
.gs-drawer-fill .gs-pager { flex-shrink: 0; margin-top: 10px; }
.gs-ev-row { display: flex; align-items: center; gap: 10px; padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); cursor: pointer; transition: all .12s; font-size: 12.5px; }
.gs-ev-row:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ev-row.static { cursor: default; }
.gs-ev-row.static:hover { border-color: var(--border); background: var(--surface); }
/* V2.20.1 BUG-3b：下钻明细行可点击定位 + 加载更多 */
.gs-ev-row.static.clickable { cursor: pointer; }
.gs-ev-row.static.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-ev-time { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.gs-ev-badge { font-size: 10.5px; border-radius: 5px; padding: 2px 8px; font-weight: 600; flex-shrink: 0; }
.gs-ev-badge.create { color: #7fbf8a; background: rgba(127,191,138,.14); }
.gs-ev-badge.delete { color: #e07a7a; background: rgba(224,122,122,.14); }
.gs-ev-badge.restore { color: var(--accent); background: var(--accent-light); }
.gs-ev-badge.purge { color: #d46a6a; background: rgba(212,106,106,.2); }
/* R47-B2：任务明细行「项目 · 指标」归属徽标 */
.gs-ev-owner { font-size: 11px; color: var(--text-2); background: var(--bg-3, rgba(127,127,127,.12)); border-radius: 4px; padding: 1px 6px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.gs-ev-kind { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }
.gs-ev-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.gs-ev-go { font-size: 10px; color: var(--text-3); flex-shrink: 0; }
.gs-ev-detail { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 9px 13px; margin-top: -2px; }
.gs-ev-dl { font-size: 11.5px; color: var(--text-2); line-height: 1.7; word-break: break-all; }
.gs-ev-empty { text-align: center; padding: 22px; color: var(--text-3); font-size: 12.5px; }

/* ===== 第卌四轮：工作台全景（双栏 Master-Detail） ===== */
.gs-pan-panel { display: flex; flex-direction: column; }
.gs-pan-wrap { display: grid; grid-template-columns: 250px 1fr; gap: 12px; align-items: start; }
.gs-pan-tree { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; max-height: 560px; overflow-y: auto; }
.gs-pan-tree-head { font-size: 10.5px; color: var(--text-3); padding: 2px 6px 8px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
.gs-pan-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 12.5px; color: var(--text-2); transition: all .12s; border: 1px dashed transparent; }
.gs-pan-row:hover { background: var(--surface-3); color: var(--text); }
.gs-pan-row.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.gs-pan-row.drop { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-ws-row { font-weight: 600; color: var(--text); }
.gs-pan-cat-row { padding-left: 18px; }
.gs-pan-sub-row { padding-left: 34px; font-size: 12px; }
.gs-pan-toggle { width: 14px; flex-shrink: 0; font-size: 10px; color: var(--text-3); text-align: center; cursor: pointer; user-select: none; }
.gs-pan-toggle.leaf { cursor: default; opacity: .4; }
.gs-pan-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-pan-kind { display: inline-block; margin-left: 6px; padding: 0 6px; font-size: 10px; line-height: 16px; border-radius: 99px; background: var(--accent-light); color: var(--accent); vertical-align: 1px; }
.gs-pan-count { font-size: 10.5px; color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 1px 8px; flex-shrink: 0; }
.gs-pan-row.active .gs-pan-count { color: var(--accent); background: var(--accent-light); }
.gs-pan-list-wrap { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; max-height: 560px; }
.gs-pan-list-head { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--border); }
.gs-pan-crumb { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
.gs-pan-allcheck { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-2); cursor: pointer; }
.gs-pan-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.gs-pan-card { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); cursor: pointer; transition: all .12s; }
.gs-pan-card:hover { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-card.selected { border-color: var(--accent); background: var(--accent-light); }
.gs-pan-check { flex-shrink: 0; cursor: pointer; }
.gs-pan-card-main { flex: 1; min-width: 0; }
.gs-pan-card-title { font-size: 12.5px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-pan-card-sub { font-size: 10.5px; color: var(--text-4); margin-top: 1px; }
.gs-pan-card-date { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }
.gs-pan-batch { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); background: var(--accent-light); border-radius: 0 0 var(--radius) var(--radius); }
.gs-pan-batch-n { font-size: 12px; font-weight: 700; color: var(--accent); white-space: nowrap; }
.gs-pan-foot { padding: 9px 14px; border-top: 1px solid var(--border); font-size: 10.5px; color: var(--text-3); }
.gs-pd-title { font-size: 14.5px; font-weight: 600; color: var(--text); line-height: 1.5; margin-bottom: 12px; }
.gs-pd-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.gs-pd-k { width: 40px; flex-shrink: 0; color: var(--text-4); }
.gs-pd-v { flex: 1; min-width: 0; color: var(--text-2); word-break: break-all; line-height: 1.6; }
.gs-pd-actions { display: flex; gap: 8px; margin-top: 14px; }
</style>
