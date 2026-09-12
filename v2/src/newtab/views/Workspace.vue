<template>
  <div class="ws-page" v-if="workspace" :style="{ '--grid-cols': String(resCols) }">
    <!-- R84（W1）：台身份页头——图标 + 台名 + 台描述 + 右端结构摘要（一行 ≤40px）。
         改前：仅资源台有一段 R73-S5a 写死的 .ws-hub-head（无图标、非 workspace.name/description），
         而 **策展台的台名与台描述在页面内零出现**——用户置身于某个策展台，却不知道这是哪个台。
         现统一为这一条，所有台都渲染；hub 描述为空时回落 R73 原文案（零信息损失）。 -->
    <div class="ws-id-head">
      <span class="wsh-icon">{{ workspace.icon || (isHub ? '📦' : '🗂') }}</span>
      <b class="wsh-name">{{ workspace.name }}</b>
      <!-- R90（R8-③）：台描述分两态——**用户自写的台描述仍内联**（R84 / W1 要的就是台身份可见）；
           资源台无描述时回落的定位语「资源卡唯一存储 · 镜像源头」**降为 ⓘ tooltip**（它是定位语，不是每屏必读） -->
      <span v-if="wsHeadDescOwn" class="wsh-desc" :title="wsHeadDescOwn">· {{ wsHeadDescOwn }}</span>
      <span v-else-if="wsHeadDescFallback" class="wsh-locator" :title="wsHeadDescFallback">ⓘ</span>
      <!-- R98（W8）：「🕐 最近更新」自指标条降为页头摘要，可点进流水下钻（入口不断，仅非 hub） -->
      <span class="wsh-summary">{{ categories.length }} 个分类<template v-if="!isHub && metrics.mirrored"> · 镜像 {{ metrics.mirrored }} 条</template><span v-if="!isHub" class="wsh-upd" title="查看最近更新流水" @click.stop="openDrill('recent')"> · 更新 {{ lastUpdateText }}</span></span>
      <!-- R90（R8-①）：常驻教学文案改「?」气泡——原文案一字不丢（见 HUB_HELP_TEXT），只是不再每屏占位 -->
      <span v-if="isHub" class="wsh-help" :title="HUB_HELP_TEXT">?</span>
    </div>
    <!-- R64-F13：hero 大标题区删除——重命名/图标/描述编辑收进 ⚙ 菜单，导入/新建按钮上移工具条 -->
    <Teleport to="body">
      <div v-if="iconPickOpen" class="icon-pick-mask" @click="iconPickOpen = false" />
      <div v-if="iconPickOpen" class="icon-pick" :style="{ left: iconPickPos.left + 'px', top: iconPickPos.top + 'px' }" @click.stop>
        <div class="ip-title">🎨 策展台图标</div>
        <div class="ip-grid">
          <span v-for="e in WS_ICONS" :key="e" class="ip-cell" :class="{on: workspace.icon === e}" @click="setWsIcon(e)">{{ e }}</span>
        </div>
        <div class="ip-custom">
          <input v-model="iconCustom" class="ip-input" maxlength="4" placeholder="自定义 emoji" @keydown.enter.prevent="setWsIcon(iconCustom.trim())">
          <button class="ip-btn" @click="setWsIcon(iconCustom.trim())">使用</button>
        </div>
        <div class="ip-foot">
          <button class="ip-btn ghost" @click="setWsIcon('')">🗑 删除图标</button>
          <button class="ip-btn ghost" @click="iconPickOpen = false">关闭</button>
        </div>
      </div>
    </Teleport>

    <!-- R75（R18）：指标条按台身份分流——资源台 3 格 / 策展台 5 格（数据源同为 hub.curationMetrics） -->
    <!-- 资源台（hub）3 格：论点格与来源构成格对资源台无意义——单向挂载红线 ⇒ 无投射指向资源台，metrics.mirrored 恒 0 -->
    <div v-if="isHub" class="ws-metrics hub3">
      <div class="metric-card" @click="openDrill('total')">
        <div class="mc-label">📊 卡片总数</div>
        <div class="mc-value">{{ metrics.total }}</div>
        <div class="mc-hint">{{ hubCountHint }}</div>
      </div>
      <div class="metric-card" @click="openDrill('assets')">
        <div class="mc-label">📎 附件数量</div>
        <div class="mc-value">{{ metrics.attachmentCount }}</div>
        <div class="mc-hint">点击查看明细</div>
      </div>
      <div class="metric-card" @click="openDrill('recent')">
        <div class="mc-label">🕐 最近更新</div>
        <div class="mc-value small">{{ lastUpdateText }}</div>
        <div class="mc-hint">点击查看流水</div>
      </div>
    </div>
    <!-- R62-1：策展台指标条——R98（W8）5 格 → 3 格：构成明细本就与总数格 hint 同源同文（并入即删格）；
         「🕐 最近更新」降为页头摘要「· 更新 X」（可点进流水下钻，入口不断） -->
    <div v-if="!isHub" class="ws-metrics">
      <!-- R67-F2：策展主题格高亮——主题色描边+微底色，与后续统计格拉开层级 -->
      <div class="metric-card thesis-hl" @click="openThesisDetail">
        <div class="mc-label">🏛 策展主题</div>
        <div class="mc-value thesis" :title="thesisCard?.title">{{ thesisCard?.title || '未设立' }}</div>
        <div class="mc-hint">{{ thesisCard ? '点击编辑论点卡' : '右键台内卡片可设立' }}</div>
      </div>
      <div class="metric-card" @click="openDrill('total')">
        <div class="mc-label">📊 卡片总数</div>
        <div class="mc-value">{{ metrics.total }}</div>
        <div class="mc-hint">台内 {{ metrics.native }} · 镜像 {{ metrics.mirrored }}</div>
      </div>
      <div class="metric-card" @click="openDrill('assets')">
        <div class="mc-label">📎 附件数量</div>
        <div class="mc-value">{{ metrics.attachmentCount }}</div>
        <div class="mc-hint">点击查看明细</div>
      </div>
    </div>

    <!-- 下钻抽屉（R62-2） -->
    <CurationDrillDrawer :open="drillOpen" :mode="drillMode" :cat-rows="drillCatRows" :native-cards="drillNative" :mirror-cards="drillMirror" :asset-rows="metrics.attachmentItems" :recent-rows="drillRecent"
      @close="drillOpen=false" @jump-cat="onDrillJumpCat" @open-card="onDrillOpenCard" @locate="onDrillLocate" />

    <!-- 设置下拉菜单（固定定位，避免被 hero 圆角裁剪） -->
    <div class="settings-menu" :class="{open: settingsMenuOpen}" @click.stop>
      <!-- R88（W6）：「⬇ 导入」自工具条收进此处，并**按台身份改名**消歧义——
           同一个「导入」二字在两台其实是两回事（资源台=导入资源，策展台=导入策展台数据包） -->
      <div class="sm-item" @click="openImport">{{ isHub ? '⬇ 导入资源' : '⬇ 导入数据包' }}</div>
      <!-- 批量管理的入口也收进此处；**退出**仍留在一级（批量中显示「✓ 完成批量」） -->
      <div v-if="!batchMode" class="sm-item" @click="toggleBatchMode">☑ 批量管理</div>
      <div class="sm-divider"></div>
      <div class="sm-item" @click="renameWs">✏️ 重命名</div>
      <div class="sm-item" @click="editDesc">📝 编辑描述</div>
      <div class="sm-item" @click="toggleIconPick($event)">🎨 更换图标</div>
      <div class="sm-divider"></div>
      <div class="sm-item" @click="exportWorkspace">📦 导出策展台数据</div>
      <div class="sm-divider"></div>
      <div class="sm-item danger" @click="deleteWorkspace">🗑 删除策展台</div>
    </div>

    <!-- ② 策展工具条 -->
    <div class="ws-toolbar">
      <div class="view-tabs">
        <div class="view-tab" :class="{active: viewMode==='card'}" @click="setViewMode('card')">▦ 卡片</div>
        <div class="view-tab" :class="{active: viewMode==='list'}" @click="setViewMode('list')">☰ 列表</div>
        <div class="view-tab" :class="{active: viewMode==='kanban'}" @click="setViewMode('kanban')">▤ 看板</div>
        <!-- R62-5：金字塔结构视图 -->
        <div class="view-tab" :class="{active: viewMode==='pyramid'}" @click="setViewMode('pyramid')">⬡ 金字塔</div>
      </div>
      <!-- R90（R8-②）：主 CTA「＋新建」前置——从最右移到视图 Tab 之后、搜索之前。
           R88 只做了"分级"（一级收到 5 件），**位置仍在右端**；R8 要的是"主 CTA 不被挤到最右"。 -->
      <button class="hero-btn primary" @click="openNewResource">＋ 新建</button>
      <div class="toolbar-spacer"></div>
      <div class="toolbar-search">
        <span class="s-icon">🔍</span>
        <input type="text" v-model="searchQuery" placeholder="搜索策展台内资源..."
          title="匹配标题 / 描述 / 标签 / 自定义字段；输入 #标签 可按标签直筛（多个取交集，如 #前端 #待读）">
      </div>
      <!-- R88（W3）：工具条分级——一级只留「视图 Tab ｜ 搜索 ｜ 筛选 ｜ ＋新建 ｜ ⚙」。
           排序(+方向) / 类型筛选 / 密度 / 列数 是"改看法"的，全部收进下面的「筛选」气泡；
           低频的导入与批量管理收进 ⚙。改前这一行堆了 11 个控件，主次不分。 -->
      <div class="filter-wrap">
        <button class="toolbar-filter" :class="{on: filterSummary.length}" :title="filterPopTitle"
          @click.stop="toggleFilterPop">
          <span class="tf-main">🔣 筛选</span>
          <template v-if="filterSummary.length">
            <span v-for="s in filterSummary.slice(0, 2)" :key="s" class="tf-chip">{{ s }}</span>
            <span v-if="filterSummary.length > 2" class="tf-chip more">+{{ filterSummary.length - 2 }}</span>
          </template>
        </button>
        <!-- 气泡：相对定位（.ws-page / .ws-toolbar 均无 overflow:hidden），会跟随触发按钮——
             比写死 right 的 fixed 定位更健壮（筛选按钮宽度随徽标变化） -->
        <div class="filter-pop" :class="{open: filterPopOpen}" @click.stop>
          <div class="fp-row">
            <span class="fp-label">排序</span>
            <select class="toolbar-select" v-model="sortBy">
              <option value="manual">手动拖拽</option>
              <option value="recent">最近添加</option>
              <option value="visited">最近访问</option>
              <option value="hot">调用最多</option>
              <option value="title">标题 A-Z</option>
            </select>
            <!-- 第卅二轮 REQ-007：时间排序方向切换（默认倒序，偏好本地记忆） -->
            <button v-if="sortBy==='recent' || sortBy==='visited'" class="toolbar-select sort-dir-btn" :title="sortDir==='desc' ? '当前倒序（新→旧），点击切换正序' : '当前正序（旧→新），点击切换倒序'" @click="toggleSortDir">{{ sortDir==='desc' ? '↓ 新→旧' : '↑ 旧→新' }}</button>
          </div>
          <div class="fp-row">
            <span class="fp-label">类型</span>
            <!-- R87（R5-②）：8 档分两组——原四档是 linkType 维度，新四档是语义谓词维度 -->
            <select class="toolbar-select" v-model="filterBy">
              <optgroup label="按链接类型">
                <option value="all">全部</option>
                <option value="url">URL链接</option>
                <option value="file">本地文件</option>
                <option value="obsidian">Obsidian</option>
              </optgroup>
              <optgroup label="按状态">
                <option value="hasLink">有链接</option>
                <option value="brokenPath">⚠ 待补全路径</option>
                <option value="hasAssets">有附件</option>
                <!-- R89（W5）：星标筛选——`starred` 字段早就在模型里、三视图 ⭐ 也早就能切换，缺的只是筛出口 -->
                <option value="starred">⭐ 星标</option>
                <option value="unmounted">未挂载任务</option>
              </optgroup>
            </select>
          </div>
          <div class="fp-row">
            <span class="fp-label">密度</span>
            <!-- 第卅三轮 REQ-026：密度档位（紧凑/舒适，记忆 UIPrefs.density） -->
            <select class="toolbar-select" v-model="density" :title="'密度档位：' + (density === 'compact' ? '紧凑' : '舒适')">
              <option value="cozy">舒适密度</option>
              <option value="compact">紧凑密度</option>
            </select>
          </div>
          <!-- R72：卡片视图横向列数（4/5/6/7）——W3 要求列数选择器一并收进「筛选」气泡 -->
          <div v-if="viewMode==='card'" class="fp-row">
            <span class="fp-label">列数</span>
            <ColsPicker v-model="resCols" label="列数" />
          </div>
          <div class="fp-foot">
            <span class="fp-reset" @click="resetAllFilters">重置全部</span>
          </div>
        </div>
      </div>
      <!-- R88（W3）：批量模式激活时**必须**在一级留退出按钮——.batch-bar 浮动栏的条件是
           batchMode && selectedIds.size，一张都没选时它不出现，此时这里是唯一退出通道 -->
      <!-- 注：主 CTA「＋新建」已按 R8 前置到视图 Tab 之后（见上），此处不再重复 -->
      <button v-if="batchMode" class="toolbar-batch active" @click="toggleBatchMode">✓ 完成批量</button>
      <button class="hero-btn settings" title="策展台设置" @click.stop="toggleSettingsMenu">⚙</button>
    </div>

    <!-- ③ 资源策展区 -->
    <div class="ws-body">
      <!-- 左侧分类导航（第八轮：树形 2 级 + 置顶分区 + 拖拽排序/挂子级；R48-V2：Linear 风格树 + 展开/折叠） -->
      <div class="ws-sidebar">
        <div class="cat-toolbar">
          <span class="ct-label">目录</span>
          <span class="ct-actions">
            <span class="ct-btn" title="一键收纳为策展台根部" @click="collapseAllCats">⊟ 收起</span>
            <span class="ct-btn" title="全部展开" @click="expandAllCats">⊞ 展开</span>
          </span>
        </div>
        <div class="cat-item" :class="{active: activeCategory==='all'}" @click="activeCategory='all'">
          <span class="cat-icon">📁</span><span class="cat-name">全部</span>
          <span class="cat-count" title="本台全部可见卡（策展台含资源台镜像卡）">{{ allResources.length }}</span>
        </div>
        <!-- 第廿九轮：「待分类」成为卡片归属落点 -->
        <div class="cat-item" :class="{active: activeCategory==='uncat', 'card-drop': cardDropTarget==='uncat'}" @click="activeCategory='uncat'"
          @dragover="onUncatDragOver" @dragleave="cardDropTarget==='uncat' && (cardDropTarget='')" @drop.stop="onUncatDrop">
          <span class="cat-icon">📥</span><span class="cat-name">待分类</span>
          <span class="cat-count" title="未归入任何分类，或所属分类已失效">{{ uncategorizedCount }}</span>
        </div>
        <div class="cat-divider"></div>
        <template v-for="sc in sidebarCats" :key="sc.cat.id">
          <div v-if="sc.sectionLabel" class="cat-section-label">{{ sc.sectionLabel }}</div>
          <div class="cat-item" :class="{
              active: activeCategory===sc.cat.id,
              sub: sc.depth>=1,
              collapsed: sc.hasChildren && collapsedCats.has(sc.cat.id),
              flash: catFlashId===sc.cat.id,
              'card-drop': cardDropTarget===sc.cat.id,
              'drop-child': catDropTarget===sc.cat.id && catDropMode==='child',
              'drop-before': catDropTarget===sc.cat.id && catDropMode==='before',
              'drop-after': catDropTarget===sc.cat.id && catDropMode==='after'
            }"
            :style="sc.depth > 1 ? { marginLeft: ((sc.depth - 1) * 14) + 'px' } : undefined"
            :data-catid="sc.cat.id"
            :draggable="!batchMode"
            @click="selectSidebarCat(sc)"
            @dragstart="onCatDragStart($event, sc.cat)" @dragend="onCatDragEnd"
            @dragover.prevent.stop="onCatDragOver($event, sc.cat)" @drop.stop="onCatDrop($event, sc.cat)">
            <span v-if="sc.hasChildren" class="cat-caret" :class="{open: !collapsedCats.has(sc.cat.id)}" title="展开/折叠" @click.stop="toggleCatCollapse(sc.cat.id)">▸</span>
            <span v-else class="cat-caret placeholder"></span>
            <span class="cat-icon" :title="sc.hasChildren ? '展开/折叠' : ''" @click.stop="sc.hasChildren && toggleCatCollapse(sc.cat.id)">{{ sc.depth>0 && !sc.hasChildren ? '↳' : sc.cat.pinned ? '📌' : (sc.hasChildren ? (collapsedCats.has(sc.cat.id) ? '📁' : '📂') : '📁') }}<template v-if="isMirrorCat(sc.cat)">📡</template></span>
            <!-- R62-4：层级色点（L1-L4 一眼分层） -->
            <span class="cat-depth-dot" :data-lv="sc.depth"></span>
            <span class="cat-name">{{ sc.cat.name }}</span>
            <span class="cat-actions">
              <span v-if="sc.depth===0" class="cat-act" :class="{on: sc.cat.pinned}" :title="sc.cat.pinned?'取消置顶':'置顶'" @click.stop="toggleCatPin(sc.cat)">📌</span>
              <!-- R73-S3：镜像分类到策展台（仅资源台、且非镜像分类——镜像分类源头已在策展台） -->
              <span v-if="isHub && !isMirrorCat(sc.cat)" class="cat-act" title="镜像分类到策展台（含现有卡片）" @click.stop="openMirrorCat(sc.cat)">📤</span>
              <!-- R61-4：父级分类 hover 出现「创建子分类」入口（4 级内） -->
              <span v-if="sc.depth < 3" class="cat-act" title="创建子分类" @click.stop="openCreateCat(sc.cat.id)">＋</span>
              <span class="cat-act" title="重命名" @click.stop="openRenameCat(sc.cat)">✎</span>
              <span class="cat-act danger" title="删除" @click.stop="deleteCategory(sc.cat)">🗑</span>
            </span>
            <span class="cat-count" :title="sc.hasChildren ? `仅本分类直属 ${sc.directCount} 张 · 含 ${sc.childCount} 个子分类（共 ${sc.aggCount} 张）` : `仅本分类直属 ${sc.directCount} 张`">{{ sc.directCount }}</span>
          </div>
        </template>
        <div v-if="dragCatId" class="cat-root-drop" @dragover.prevent @drop="onCatRootDrop">⬆ 松手升为一级分类</div>
        <div class="cat-add" @click="openCreateCat()">
          <span>＋</span><span>新建分类</span>
        </div>
        <!-- 第卅三轮 REQ-021：存量重复分类合并工具 -->
        <div class="cat-merge" @click="mergeDupCats">
          <span>🛠</span><span>合并重复分类</span>
        </div>
      </div>

      <!-- 右侧展示区 -->
      <div class="ws-content">
        <!-- ===== 卡片视图：REQ-027 按分类分组分区；R64-F9 树状递归分组（depth 缩进呈现层级） ===== -->
        <div v-if="viewMode==='card'">
          <!-- R84（W2-①）：中心论点提到首屏——此前论点只出现在指标条第一格与金字塔 L1 根，
               卡片视图（默认视图）里完全看不到。已设立 → 标题 + 查看金字塔；未设立 → 一行轻引导。 -->
          <div class="thesis-banner" :class="{ empty: !thesisCard }">
            <template v-if="thesisCard">
              <span class="tb-mark">🏛</span>
              <span class="tb-label">中心论点</span>
              <span class="tb-title" :title="thesisCard.title" @click.stop="onCardClick(thesisCard)">{{ thesisCard.title }}</span>
              <span class="tb-go" @click="setViewMode('pyramid')">查看金字塔 →</span>
            </template>
            <template v-else>
              <span class="tb-mark">🏛</span>
              <span class="tb-hint">尚未设立中心论点 —— 右键台内卡片可设立（设立后即成为金字塔 L1 根）</span>
            </template>
          </div>
          <template v-for="(g, gi) in resourceGroups" :key="g.key">
            <div :style="g.depth ? 'margin-left:' + (g.depth * 16) + 'px' : ''">
            <div class="section-label ws-cat-head" :class="{first: gi===0, sub: g.depth>0}" @click="toggleGroupCollapse(g.key)">
              <span>{{ g.depth ? '↳' : '📁' }} {{ g.title }} · {{ g.count }}<template v-if="groupChildCount(g.key)"> · 含 {{ groupChildCount(g.key) }} 个子分类</template></span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="card-grid"
              @dragover="onAreaDragOver($event, g.key)" @drop="onAreaDrop($event, g.key)">
              <div v-for="r in g.items" :key="r.id" class="res-card" :class="{pinned: r.pinned, flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :data-rid="r.id" :draggable="!batchMode" @click="onCardClick(r)" @dblclick="onCardDblClick(r)"
                @dragstart="onDragStart($event,r)" @dragover.prevent="markDrop($event, r.id, 'x')" @drop="onDropCard($event,r)" @dragend="clearDragState" @dragleave="clearDropMark"
                @contextmenu.prevent="openResCtx($event, r)">
                <div v-if="batchMode" class="rc-batch-check" :class="{on: selectedIds.has(r.id)}" @click.stop="toggleSelect(r.id)">{{ selectedIds.has(r.id)?'✓':'' }}</div>
                <div class="res-card-actions">
                  <!-- R79（R1 收尾）：R1 方案列的第一个动作「↗ 打开」此前缺失——双击才能开链接，
                       单手点到卡片右上角的动作条时没有开链入口。无链接时点击给「请先补全链接」提示，
                       恰好把"待补全"显性化，比按钮消失更容易被发现 -->
                  <div class="rc-action open" @click.stop="openResourceLink(r)" title="打开链接（无链接则提示补全）">↗</div>
                  <!-- R89（W4）：镜像卡是策展台里的**只读引用**——此前景泰七动作无条件渲染，
                       其中四个点了只会弹「镜像卡为引用」的提示，🗑 更是名不副实（干的是"移出镜像"）。
                       现写动作只对真身卡出现，镜像卡改给三个**真能用**的：打开 / 定位源 / 移出镜像。 -->
                  <template v-if="!isMirrorView(r)">
                    <div class="rc-action pin" @click.stop="togglePin(r)" title="置顶">📌</div>
                    <div class="rc-action" :class="{on: r.starred}" :title="r.starred?'取消星标':'星标'" @click.stop="toggleStar(r)">⭐</div>
                    <div class="rc-action" @click.stop="openMoveOne(r)" title="移动分类">📂</div>
                    <!-- R73-S3：镜像到策展台（仅资源台真身卡；镜像卡为引用，源头在资源台，故不提供） -->
                    <div v-if="isHub" class="rc-action" title="镜像到策展台" @click.stop="openMirrorCard(r)">📡</div>
                    <!-- R82（R4）：挂载到任务——写在 task.mountedResourceIds 上，不碰资源卡（单向挂载红线）。
                         镜像卡不给入口：它是策展台里的只读引用，写动作一律回落资源台真身卡（R61/R79 口径）。 -->
                    <div class="rc-action mount" :class="{on: mountedTaskCount(r) > 0}" @click.stop="openMountOne(r)" :title="mountedTaskCount(r) ? `已挂载 ${mountedTaskCount(r)} 个任务 · 点击管理` : '挂载到任务'">📋</div>
                    <div class="rc-action delete" @click.stop="deleteResource(r)" title="删除">🗑</div>
                  </template>
                  <template v-else>
                    <div class="rc-action locate" title="定位到资源台源卡" @click.stop="locateMirrorSource(r)">🎯</div>
                    <div class="rc-action delete" title="移出镜像（源卡保留）" @click.stop="removeMirror(r)">✕</div>
                  </template>
                </div>
                <div class="rc-fields">
                  <template v-for="f in fieldsOf(r)" :key="f.key">
                    <div v-if="isTitleKey(f.key)" class="rc-title"><span v-if="isMirrorView(r)" class="rc-mirror-badge" title="镜像卡 · 源在资源台">📡</span>{{ val(r, f.key) }}</div>
                    <div v-else-if="f.key==='link' && r.link" class="rc-link" :class="r.linkType">{{ linkIcon(r.linkType) }} {{ linkDisplay(r.link) }}</div>
                    <div v-else-if="f.key==='description' && r.description" class="rc-summary">{{ r.description }}</div>
                    <div v-else-if="f.key==='tags' && r.tags.length" class="rc-tags"><span v-for="t in r.tags" :key="t" class="rc-tag">#{{ t }}</span></div>
                    <div v-else-if="f.key==='sourceType' && r.sourceType" class="rc-src">{{ srcLabel(r.sourceType) }}</div>
                    <div v-else-if="f.key==='createdAt' && val(r,f.key)" class="rc-date">🕐 {{ val(r,f.key) }}</div>
                    <div v-else-if="f.key==='assets' && r.assets?.length" class="rc-assets"><AssetBadge :assets="r.assets" /></div>
                    <div v-else-if="f.key.startsWith('custom_') && val(r,f.key)" class="rc-custom"><span>{{ f.label }}:</span>{{ val(r,f.key) }}</div>
                  </template>
                </div>
                <div class="rc-footer">
                  <span class="rc-cat" title="点击查看所在分类" @click.stop="activeCategory = r.categoryId || 'uncat'">{{ catIconOf(r) }} {{ catNameOfFamily(r) }}</span>
                  <!-- R87（R7-①）：⚠ 待补全徽标（此前只有编辑抽屉里才有这条提示，卡片上看不见） -->
                  <span v-if="isBrokenPath(r)" class="rc-broken" title="仅存文件名，双击无法打开 —— 点击补全完整路径" @click.stop="fixLink(r)">⚠ 待补全</span>
                  <span v-if="r.callCount" class="rc-calls" title="被打开次数">🔥{{ r.callCount }}</span>
                  <span class="rc-open-hint">双击打开链接</span>
                </div>
              </div>
              <div v-if="gi === resourceGroups.length - 1" class="rc-add-card" @click="openNewResource">
                <span style="font-size:20px">＋</span><span>新建资源卡</span>
              </div>
            </div>
            </div>
          </template>

          <!-- R87（R5 收尾）：有筛选/搜索却零结果时，空态要说明**原因**并给一键清除——
               否则用户只看到「暂无资源卡」，会以为卡丢了（与 D-B 项目总览同款口径） -->
          <EmptyState v-if="!resourceGroups.length" icon="folder"
            :title="hasActiveFilter ? '当前筛选没有匹配的资源卡' : '暂无资源卡'"
            :desc="hasActiveFilter ? '已按「' + filterLabel + '」过滤' + (debouncedQuery.trim() ? '，且搜索「' + debouncedQuery.trim() + '」无命中' : '') : '双击卡片直达链接；单击查看详情。用 Ctrl+Shift+J 可从任意网页采集'"
            :action-label="hasActiveFilter ? '清除筛选' : '＋ 新建资源卡'"
            @action="hasActiveFilter ? resetFilters() : openNewResource()" />
        </div>

        <!-- ===== 列表视图：REQ-027 按分类分组分区（每分区标题行 + 其下条目）；R64-F9 树状缩进 ===== -->
        <div v-if="viewMode==='list'">
          <template v-for="(g, gi) in resourceGroups" :key="g.key">
            <div :style="g.depth ? 'margin-left:' + (g.depth * 16) + 'px' : ''">
            <div class="section-label ws-cat-head" :class="{first: gi===0, sub: g.depth>0}" @click="toggleGroupCollapse(g.key)">
              <span>{{ g.depth ? '↳' : '📁' }} {{ g.title }} · {{ g.count }}<template v-if="groupChildCount(g.key)"> · 含 {{ groupChildCount(g.key) }} 个子分类</template></span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="res-list">
              <div v-for="r in g.items" :key="r.id" class="res-row" :class="{pinned: r.pinned, flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :data-rid="r.id" :draggable="!batchMode" @click="onCardClick(r)" @dblclick="onCardDblClick(r)"
                @dragstart="onDragStart($event,r)" @dragover.prevent="markDrop($event, r.id, 'x')" @drop="onDropCard($event,r)" @dragend="clearDragState" @dragleave="clearDropMark"
                @contextmenu.prevent="openResCtx($event, r)">
                <div v-if="batchMode" class="rc-batch-check" :class="{on: selectedIds.has(r.id)}" @click.stop="toggleSelect(r.id)">{{ selectedIds.has(r.id)?'✓':'' }}</div>
                <span v-else class="rr-drag">⋮⋮</span>
                <span class="rr-title"><span v-if="isMirrorView(r)" class="rc-mirror-badge" title="镜像卡 · 源在资源台">📡</span>{{ val(r, titleKey) }}</span>
                <AssetBadge v-if="hasField('assets') && r.assets?.length" :assets="r.assets" class="rr-assets" />
                <!-- R87（R7-①）：列表视图同一枚徽标（三视图与卡片同源，见 R79 立的推平原则） -->
                <span v-if="isBrokenPath(r)" class="rr-broken" title="仅存文件名，双击无法打开 —— 点击补全完整路径" @click.stop="fixLink(r)">⚠ 待补全</span>
                <!-- R79（R1-列）：调用次数不在字段池里（callCount 无 FieldDef），故与卡片视图一样硬编码一行 -->
                <span v-if="r.callCount" class="rr-calls" title="被打开次数">🔥{{ r.callCount }}</span>
                <span class="rr-f" v-for="f in listFields" :key="f.key">{{ shortVal(r, f) }}</span>
                <span class="rr-actions">
                  <!-- R79（R1-列）：动作条对齐卡片视图六动作同一顺序——此前只有 📌⭐🗑 -->
                  <span class="rr-action open" @click.stop="openResourceLink(r)" title="打开链接（无链接则提示补全）">↗</span>
                  <!-- R89（W4）：与卡片视图同款——真身卡七动作、镜像卡只读三件套 -->
                  <template v-if="!isMirrorView(r)">
                    <span class="rr-action" @click.stop="togglePin(r)" :title="r.pinned?'取消置顶':'置顶'">📌</span>
                    <span class="rr-action" :class="{on: r.starred}" @click.stop="toggleStar(r)" :title="r.starred?'取消星标':'星标'">⭐</span>
                    <span class="rr-action" @click.stop="openMoveOne(r)" title="移动分类">📂</span>
                    <span v-if="isHub" class="rr-action" title="镜像到策展台" @click.stop="openMirrorCard(r)">📡</span>
                    <span class="rr-action mount" :class="{on: mountedTaskCount(r) > 0}" @click.stop="openMountOne(r)" :title="mountedTaskCount(r) ? `已挂载 ${mountedTaskCount(r)} 个任务 · 点击管理` : '挂载到任务'">📋</span>
                    <span class="rr-action delete" @click.stop="deleteResource(r)" title="删除">🗑</span>
                  </template>
                  <template v-else>
                    <span class="rr-action locate" title="定位到资源台源卡" @click.stop="locateMirrorSource(r)">🎯</span>
                    <span class="rr-action delete" title="移出镜像（源卡保留）" @click.stop="removeMirror(r)">✕</span>
                  </template>
                </span>
              </div>
            </div>
            </div>
          </template>
          <div v-if="!resourceGroups.length" class="empty-state">暂无资源卡，点击右上角"新建资源卡"添加</div>
        </div>

        <!-- 看板视图 -->
        <div v-if="viewMode==='kanban'" class="kanban">
          <div v-for="cat in kanbanColumns" :key="cat.key" class="kanban-col"
            @dragover.prevent @drop="onDropToCategory($event,cat.key)">
            <div class="kc-header">
              <span class="kc-name">📂 {{ cat.name }}</span>
              <span class="kc-count">{{ cat.count }}</span>
              <div class="kc-add" @click="addResourceToCategory(cat.key)" title="在此分类新建">＋</div>
            </div>
            <div class="kc-body">
              <div v-for="r in cat.items" :key="r.id" class="kc-card" :class="{pinned: r.pinned, 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :draggable="!batchMode" @dragstart="onDragStart($event,r)" @dragover.prevent.stop="markDrop($event, r.id, 'y')" @dragend="clearDragState" @dragleave="clearDropMark" @drop.stop="onKanbanCardDrop($event, r)" @click="onCardClick(r)" @dblclick="onCardDblClick(r)">
                <!-- R79（R1-看）：看板此前只有 🗑 删除 + 只读星标，动作条与卡片/列表视图严重不齐 -->
                <div class="kc-actions">
                  <span class="kc-action open" @click.stop="openResourceLink(r)" title="打开链接（无链接则提示补全）">↗</span>
                  <!-- R89（W4）：与卡片/列表视图同款 -->
                  <template v-if="!isMirrorView(r)">
                    <span class="kc-action" @click.stop="togglePin(r)" :title="r.pinned?'取消置顶':'置顶'">📌</span>
                    <span class="kc-action" :class="{on: r.starred}" @click.stop="toggleStar(r)" :title="r.starred?'取消星标':'星标'">⭐</span>
                    <span class="kc-action" @click.stop="openMoveOne(r)" title="移动分类">📂</span>
                    <span v-if="isHub" class="kc-action" title="镜像到策展台" @click.stop="openMirrorCard(r)">📡</span>
                    <span class="kc-action mount" :class="{on: mountedTaskCount(r) > 0}" @click.stop="openMountOne(r)" :title="mountedTaskCount(r) ? `已挂载 ${mountedTaskCount(r)} 个任务 · 点击管理` : '挂载到任务'">📋</span>
                    <span class="kc-action delete" title="删除" @click.stop="deleteResource(r)">🗑</span>
                  </template>
                  <template v-else>
                    <span class="kc-action locate" title="定位到资源台源卡" @click.stop="locateMirrorSource(r)">🎯</span>
                    <span class="kc-action delete" title="移出镜像（源卡保留）" @click.stop="removeMirror(r)">✕</span>
                  </template>
                </div>
                <div class="kc-card-title">
                  <span v-if="r.starred" class="kc-star" title="已星标">⭐</span>{{ val(r, titleKey) }}
                </div>
                <div class="kc-card-footer">
                  <!-- R87（R7-①）：看板同第三枚 -->
                  <span v-if="isBrokenPath(r)" class="kc-broken" title="仅存文件名，双击无法打开 —— 点击补全完整路径" @click.stop="fixLink(r)">⚠ 待补全</span>
                  <span v-if="r.callCount" class="kc-calls" title="被打开次数">🔥{{ r.callCount }}</span>
                  <span v-if="hasField('tags') && r.tags.length" v-for="t in r.tags" :key="t" class="kc-card-tag">#{{ t }}</span>
                  <span class="kc-card-link" :class="r.linkType" v-if="r.link">{{ linkIcon(r.linkType) }}</span>
                  <span v-if="hasField('assets') && r.assets?.length" class="kc-card-assets"><AssetBadge :assets="r.assets" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== R62-5：金字塔视图（L1 中心论点根 + 分类树逐层铺开 + 卡片拖换节点）；R64-F11 SVG 结构连线 ===== -->
        <div v-if="viewMode==='pyramid'" class="pyramid" ref="pyWrapRef">
          <svg class="py-links-svg" aria-hidden="true">
            <path v-for="(pth, pi) in pyLinkPaths" :key="pi" :d="pth" />
          </svg>
          <!-- L1 根：中心论点卡 -->
          <div class="py-root" :class="{droppable: pyRootDrop}" @dragover.prevent="onPyRootDragOver" @dragleave="pyRootDrop=false" @drop.stop.prevent="onPyRootDrop">
            <template v-if="thesisCard">
              <div class="py-root-card" @click="onCardClick(thesisCard)" @dblclick.stop="openResourceLink(thesisCard)">
                <span class="py-root-badge">🏛 中心论点</span>
                <span class="py-root-title">{{ thesisCard.title }}</span>
                <span v-if="thesisCard.description" class="py-root-desc">{{ thesisCard.description }}</span>
              </div>
              <span class="py-root-unset" title="取消中心论点" @click.stop="unsetThesis">✕</span>
            </template>
            <div v-else class="py-root-empty clickable" @click="openThesisCreate">🏛 点击设立中心论点 —— 填写卡片保存后自动落为 L1 根节点</div>
          </div>
          <!-- L2 起分类节点（R66-F5：居中树布局——叶子占列、父节点跨其子组全部列：父模块横向恒=子组横向、居中悬于子组上方，子组永不跨入其他父节点的横向空间；连线横平竖直直角折线） -->
          <!-- R98（W7）：层级折叠——仅 L2 / 到 L3 / 全部（本地视图态）；金字塔只有一层时无折叠意义，不渲染 -->
          <div v-if="pyramidLevels.length >= 2" class="py-fold">
            <span class="py-fold-label">层级</span>
            <button class="py-fold-btn" :class="{on: pyFold==='l2'}" @click="pyFold='l2'">仅 L2</button>
            <button class="py-fold-btn" :class="{on: pyFold==='l3'}" @click="pyFold='l3'">到 L3</button>
            <button class="py-fold-btn" :class="{on: pyFold==='all'}" @click="pyFold='all'">全部</button>
          </div>
          <div class="py-board" :style="{ gridTemplateColumns: `repeat(${pyLayout.cols}, minmax(170px, 250px))` }">
            <div v-for="cell in pyLayout.cells" :key="cell.cat.id" class="py-node"
              :class="{ 'drop-child': pyDropTarget===cell.cat.id && pyDropMode==='child', 'drop-sib': pyDropTarget===cell.cat.id && pyDropMode!=='child', flash: catFlashId===cell.cat.id }"
              :style="{ gridRow: cell.depth + 1, gridColumn: `${cell.colStart + 1} / span ${cell.colSpan}` }"
              :data-pyid="cell.cat.id"
              @dragover.prevent.stop="onPyDragOver($event, cell.cat)" @dragleave.stop="pyDropTarget=''" @drop.stop.prevent="onPyDrop($event, cell.cat)">
              <div class="py-node-head" :draggable="!batchMode" @dragstart.stop="onCatDragStart($event, cell.cat)" @dragend="onCatDragEnd">
                <span class="py-node-lv">L{{ cell.depth + 2 }}</span>
                <span class="py-node-name" :title="cell.cat.name" @click="selectPyNode(cell.cat)">{{ cell.cat.name }}<template v-if="isMirrorCat(cell.cat)"> 📡</template></span>
                <span class="py-node-count">{{ cell.cards.length }}</span>
                <span class="py-node-ops">
                  <span class="py-op" title="前移" @click.stop="moveCatSibling(cell.cat, -1)">⟨</span>
                  <span class="py-op" title="后移" @click.stop="moveCatSibling(cell.cat, 1)">⟩</span>
                  <span class="py-op" title="节点菜单" @click.stop="openNodeMenu($event, cell.cat)">⋯</span>
                </span>
              </div>
              <div class="py-node-body">
                <span v-for="r in cell.cards" :key="r.id" class="py-card-chip" :draggable="!batchMode" :data-rid="r.id"
                  @dragstart="onDragStart($event, r)" @dragend="clearCardDropTarget"
                  @click.stop="onCardClick(r)" @dblclick.stop="onCardDblClick(r)" @contextmenu.prevent.stop="openResCtx($event, r)">
                  <span v-if="isMirrorView(r)" class="rc-mirror-badge" title="镜像卡 · 源在资源台">📡</span>{{ r.title }}
                </span>
                <span v-if="!cell.cards.length" class="py-node-empty">拖入资源卡</span>
              </div>
              <!-- R65-F3：节点双入口——关联资源卡（资源台选择器镜像）/ 新建卡片（台内卡，可挂附件） -->
              <div class="py-node-foot">
                <span class="py-foot-btn" title="从资源台选择资源卡镜像到该节点" @click.stop="openLinkCards(cell.cat)">🔗 关联资源卡</span>
                <span class="py-foot-btn" title="新建台内卡（可挂附件，真身留在本台）" @click.stop="addResourceToCategory(cell.cat.id)">➕ 新建卡片</span>
              </div>
              <span v-if="pyDepthOf(cell.cat) < 3" class="py-node-add" title="新建子节点" @click.stop="openCreateCat(cell.cat.id)">＋</span>
            </div>
          </div>
          <div v-if="!pyLayout.cells.length && thesisCard" class="py-level-empty" style="text-align:center;padding:10px 0">还没有论点节点 —— 节点卡右上「＋」或左侧目录「＋ 新建分类」建立骨架</div>
          <EmptyState v-if="!pyramidLevels.length && !thesisCard" icon="folder" title="金字塔还空着"
            desc="左侧目录「＋ 新建分类」建立论点骨架；右键台内卡片可设为中心论点（L1 根）" />
        </div>
      </div>
    </div>

    <!-- ===== 批量操作浮动栏 ===== -->
    <Transition name="batch">
      <div v-if="batchMode && selectedIds.size" class="batch-bar">
        <span class="batch-count">已选 {{ selectedIds.size }} 张</span>
        <button class="batch-btn" @click="selectAllVisible">全选/反选</button>
        <button class="batch-btn" @click="batchOpen">🔗 批量打开链接</button>
        <button class="batch-btn" @click="openBatchMove">📦 移动到…</button>
        <button class="batch-btn danger" @click="batchDelete">🗑 批量删除</button>
        <button class="batch-btn" @click="selectedIds.clear()">取消</button>
      </div>
    </Transition>

    <!-- 资源卡详情抽屉（单击打开） -->
    <div class="overlay" :class="{open: drawerOpen}" @click="closeDrawer"></div>
    <div class="drawer" :class="{open: drawerOpen}">
      <!-- 第卅九轮 #61：资源字段表单已抽至共享 ResourceEditForm（搜索抽屉 / 内联抽屉同源单份） -->
      <div class="dr-body">
        <ResourceEditForm
          ref="resFormRef"
          :model="editingResource"
          height-key="ws-note"
          :show-close="true"
          @save="saveResource"
          @goto-task="goToTask"
          @close="closeDrawer"
        />
      </div>
      <div class="dr-footer">
        <button class="dr-footer-btn danger" @click="deleteCurrentResource">🗑 删除</button>
        <button class="dr-footer-btn" @click="copyLink">🔗 复制链接</button>
        <button class="dr-footer-btn" @click="openResourceLink(editingResource)">↗ 打开链接</button>
        <button class="dr-footer-btn primary" @click="saveResource">✓ 保存</button>
      </div>
    </div>

    <!-- R73-S2（R16 收敛）：导入弹窗改为 **mode-aware**
         · hub（资源台）→ 书签 HTML 导入 + 本地文件导入（自 CurationCenter 迁入）
         · 策展台 → 只收策展数据包 JSON -->
    <div class="modal-overlay" :class="{open: importModalOpen}" @click.self="importModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span style="font-size:16px">⬇</span>
          <span class="mh-title">{{ isHub ? '导入资源到资源台' : '导入策展台数据包' }}</span>
          <div class="modal-close" @click="importModalOpen=false">×</div>
        </div>
        <div class="modal-body">
          <template v-if="isHub">
            <div class="modal-option" @click="bookmarkInput?.click()">
              <span class="mo-icon">🔖</span>
              <div>
                <div class="mo-name">导入书签文件</div>
                <div class="mo-desc">选择浏览器导出的书签 HTML，文件夹结构生成为分类（最多 2 级），链接+标题按原归类写入资源卡</div>
              </div>
            </div>
            <div class="modal-option" @click="fileImport">
              <span class="mo-icon">📁</span>
              <div>
                <div class="mo-name">本地文件导入</div>
                <div class="mo-desc">获取文件名写入资源卡，双击打开前补全完整路径即可本地打开</div>
              </div>
            </div>
          </template>
          <div v-else class="modal-option" @click="boardImportInput?.click()">
            <span class="mo-icon">🧩</span>
            <div>
              <div class="mo-name">导入策展台数据包（JSON）</div>
              <div class="mo-desc">选择本台「⚙ 导出策展台数据」导出的 JSON 文件：论点分类树 + 台内卡 + 镜像投射按 ID 并集合并，现有数据不受影响</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <input ref="boardImportInput" type="file" accept=".json,application/json" style="display:none" @change="handleBoardImport" />
    <input ref="bookmarkInput" type="file" accept=".html,.htm" style="display:none" @change="handleBookmarkImport" />
    <!-- R80（R13）：accept 列出支持类型（图片 / HTML / PDF）——改前是裸 multiple，选了 zip/docx 只能导入后才发现被跳过 -->
    <input ref="fileImportInput" type="file" multiple accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.ico,.html,.htm,.pdf,application/pdf,text/html" style="display:none" @change="handleFileImport" />

    <!-- R73-S2：书签导入文件夹选择（自 CurationCenter 迁入） -->
    <div class="modal-overlay" :class="{open: bookmarkModalOpen}" @click.self="bookmarkModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span style="font-size:16px">🔖</span>
          <span class="mh-title">选择要导入的书签文件夹</span>
          <div class="modal-close" @click="bookmarkModalOpen=false">×</div>
        </div>
        <div class="modal-body bk-body">
          <div class="bk-hint">导入后将按文件夹结构生成分类（前 2 级，同名自动合并），卡片归入原文件夹对应的分类；更深层级转为标签。后续可自行增删改分类。</div>
          <label class="bk-all"><input type="checkbox" :checked="allBkChecked" @change="toggleAllBk" /> 全部导入（{{ bkTotalCount }} 个书签）</label>
          <div class="bk-list">
            <label v-for="f in bkFolders" :key="f.path" class="bk-item">
              <input type="checkbox" v-model="f.checked" />
              <span class="bk-name">📁 {{ f.path }}</span>
              <span class="bk-count">{{ f.count }} 个书签</span>
            </label>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="bookmarkModalOpen=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmBookmarkImport">✓ 导入所选</button>
        </div>
      </div>
    </div>

    <!-- 批量移动弹窗（第八轮：策展台→分类级联，含当前策展台） -->
    <div class="modal-overlay" :class="{open: moveModalOpen}" @click.self="moveModalOpen=false">
      <div class="modal" style="width:420px">
        <div class="modal-header">
          <span style="font-size:16px">📦</span>
          <span class="mh-title">移动 {{ selectedIds.size }} 张资源卡</span>
          <div class="modal-close" @click="moveModalOpen=false">×</div>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <div class="dr-label">目标策展台（含当前策展台，可只换分类）</div>
            <select class="dr-category-select" v-model="moveWsId">
              <option v-for="w in moveWorkspaces" :key="w.id" :value="w.id">
                {{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}{{ w.id === workspaceId ? '（当前）' : '' }}
              </option>
            </select>
          </div>
          <div class="dr-section">
            <div class="dr-label">目标分类（默认待分类）</div>
            <select class="dr-category-select" v-model="moveCatId">
              <option value="">📥 待分类</option>
              <option v-for="opt in moveCatOptions" :key="opt.id" :value="opt.id">📂 {{ opt.label }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="moveModalOpen=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmBatchMove">✓ 确认移动</button>
        </div>
      </div>
    </div>

    <!-- R65-F3：节点关联资源卡（资源台全量卡选择器：关键词过滤 + 多选 + 镜像到节点） -->
    <div class="modal-overlay" :class="{open: !!linkCardsModal}" @click.self="linkCardsModal=null">
      <div class="modal" style="width:480px">
        <div class="modal-header">
          <span style="font-size:16px">🔗</span>
          <span class="mh-title">关联资源卡到「{{ linkCardsModal?.catName }}」</span>
          <div class="modal-close" @click="linkCardsModal=null">×</div>
        </div>
        <div class="modal-body">
          <div class="lc-search">
            <span>🔍</span>
            <input v-model="linkCardsQ" placeholder="关键词过滤资源台资源卡（标题/链接）" />
          </div>
          <div class="lc-list">
            <label v-for="c in linkCandidates" :key="c.r.id" class="lc-item" :class="{ picked: linkCardsModal?.picked.has(c.r.id), mirrored: c.mirrored }">
              <input v-if="!c.mirrored" type="checkbox" :checked="linkCardsModal?.picked.has(c.r.id)" @change="toggleLinkPick(c.r.id)" />
              <span v-else class="lc-badge">已在该台</span>
              <span class="lc-title">{{ c.r.pinned ? '📌 ' : '' }}{{ c.r.title }}</span>
              <span class="lc-link">{{ c.r.link }}</span>
            </label>
            <div v-if="!linkCandidates.length" class="lc-empty">无匹配的资源台资源卡</div>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="linkCardsModal=null">取消</button>
          <button class="dr-footer-btn primary" @click="confirmLinkCards">📡 镜像所选到该节点</button>
        </div>
      </div>
    </div>

    <!-- 第八轮：单卡移动分类弹窗 -->
    <div class="modal-overlay" :class="{open: moveOneOpen}" @click.self="moveOneOpen=false">
      <div class="modal" style="width:380px">
        <div class="modal-header">
          <span style="font-size:16px">📂</span>
          <span class="mh-title">移动「{{ moveOneTarget?.title.slice(0, 20) }}…」到分类</span>
          <div class="modal-close" @click="moveOneOpen=false">×</div>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <div class="dr-label">目标分类</div>
            <select class="dr-category-select" v-model="moveOneCatId">
              <option value="">📥 待分类</option>
              <option v-for="opt in moveOneOptions" :key="opt.id" :value="opt.id">📂 {{ opt.label }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="moveOneOpen=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmMoveOne">✓ 确认移动</button>
        </div>
      </div>
    </div>

    <!-- R82（R4）：挂载到任务弹窗——搜索 + 最近任务，点一下即挂载/取消（多选切换即生效） -->
    <div class="modal-overlay" :class="{open: mountOneOpen}" @click.self="closeMountOne">
      <div class="modal" style="width:420px">
        <div class="modal-header">
          <span style="font-size:16px">📋</span>
          <span class="mh-title">挂载「{{ mountTarget?.title.slice(0, 16) }}…」到任务</span>
          <div class="modal-close" @click="closeMountOne">×</div>
        </div>
        <div class="modal-body">
          <input type="text" class="ws-modal-input" v-model="mountSearch" placeholder="🔍 搜索任务…" @keydown.enter.prevent />
          <div class="mt-list">
            <div v-for="t in mountTaskOptions" :key="t.id" class="mt-item" :class="{on: isMountedOn(t)}"
              @click="toggleMountTask(t)" :title="isMountedOn(t) ? '点击取消挂载' : '点击挂载'">
              <span class="mt-mark">{{ isMountedOn(t) ? '✓' : '＋' }}</span>
              <span class="mt-title">{{ t.title }}</span>
              <span v-if="mountProjectName(t)" class="mt-proj">{{ mountProjectName(t) }}</span>
            </div>
            <div v-if="!mountTaskOptions.length" class="mt-empty">没有匹配的任务</div>
          </div>
        </div>
        <div class="modal-footer-row">
          <span class="mt-hint">单向挂载 · 点条目即生效</span>
          <button class="dr-footer-btn primary" @click="closeMountOne">✓ 完成</button>
        </div>
      </div>
    </div>

    <!-- 第八轮：分类新建/重命名弹窗 -->
    <div class="modal-overlay" :class="{open: catModal.open}" @click.self="catModal.open=false">
      <div class="modal" style="width:380px">
        <div class="modal-header">
          <span style="font-size:16px">{{ catModal.mode==='create' ? '🗂' : '✎' }}</span>
          <span class="mh-title">{{ catModal.mode==='create' ? (catModal.parentId ? '新建子分类' : '新建分类') : '重命名分类' }}</span>
          <div class="modal-close" @click="catModal.open=false">×</div>
        </div>
        <div class="modal-body">
          <input type="text" class="ws-modal-input" :class="{dup: catNameDup}" v-model="catModal.name" placeholder="分类名称…"
            @keydown.enter.prevent="confirmCatModal" @keydown.esc="catModal.open=false" autofocus />
          <div v-if="catNameDup" class="ws-modal-error">⚠ 该策展台已存在同名分类，请更换名称</div>
          <div v-if="catModal.mode==='create' && catModal.parentId" class="ws-modal-hint">
            将创建在「{{ wsCats.find(c=>c.id===catModal.parentId)?.name }}」之下
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="catModal.open=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmCatModal">{{ catModal.mode==='create' ? '✓ 创建' : '✓ 保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 第八轮：通用输入弹窗（策展台重命名/描述） -->
    <div class="modal-overlay" :class="{open: inputModal.open}" @click.self="inputModal.open=false">
      <div class="modal" style="width:380px">
        <div class="modal-header">
          <span style="font-size:16px">✏️</span>
          <span class="mh-title">{{ inputModal.title }}</span>
          <div class="modal-close" @click="inputModal.open=false">×</div>
        </div>
        <div class="modal-body">
          <input type="text" class="ws-modal-input" v-model="inputModal.value" placeholder="输入内容…"
            @keydown.enter.prevent="confirmInputModal" @keydown.esc="inputModal.open=false" />
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="inputModal.open=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmInputModal">✓ 保存</button>
        </div>
      </div>
    </div>

    <!-- B5：右键菜单（R62 接线：组件此前已导入但未渲染，卡片/镜像菜单自此生效） -->
    <ContextMenu :state="resCtx" :items="resCtxItems" @close="resCtx.open = false" />

    <!-- R80（R14）：图片附件卡预览——双击 `zy-asset://` 图片卡就地弹窗（此前会落到「文档附件不存在」误报） -->
    <AssetPreview :open="previewOpen" :url="previewUrl" :name="previewName" @close="closePreview" />

    <!-- R62-6：金字塔节点菜单（⋯ 展开，6 项） -->
    <Teleport to="body">
      <div v-if="nodeMenu.open" class="node-menu-mask" @click="nodeMenu.open=false" />
      <div v-if="nodeMenu.open" class="node-menu" :style="{ left: nodeMenu.x + 'px', top: nodeMenu.y + 'px' }" @click.stop>
        <div class="nm-item" @click="nmCreateChild">🌳 新建子论点（子节点）</div>
        <div class="nm-item" @click="nmCreateSibling">🌿 新建同级节点</div>
        <div class="nm-item" @click="nmMirrorCat">📤 从资源台镜像分类</div>
        <div class="nm-item" @click="nmPack">🗂 打包所选卡片入此节点</div>
        <div class="nm-item" @click="nmRename">✎ 重命名</div>
        <div class="nm-divider"></div>
        <div class="nm-item danger" @click="nmDelete">🗑 删除节点（卡片回待分类）</div>
      </div>
    </Teleport>

    <!-- R62-6：从资源台镜像分类弹窗 -->
    <div class="modal-overlay" :class="{open: mirrorCatModal.open}" @click.self="mirrorCatModal.open=false">
      <div class="modal" style="width:420px">
        <div class="modal-header">
          <span style="font-size:16px">📤</span>
          <span class="mh-title">从资源台镜像分类到本台</span>
          <div class="modal-close" @click="mirrorCatModal.open=false">×</div>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <div class="dr-label">选择资源台分类（含子分类，现有卡自动镜像）</div>
            <select class="dr-category-select" v-model="mirrorCatModal.catId">
              <option v-for="opt in hubCatOptions" :key="opt.id" :value="opt.id">📂 {{ opt.label }}</option>
            </select>
          </div>
          <div v-if="!hubCatOptions.length" class="ws-modal-hint">资源台暂无分类——先去资源台建分类、收资源</div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="mirrorCatModal.open=false">取消</button>
          <button class="dr-footer-btn primary" :disabled="!mirrorCatModal.catId" @click="confirmMirrorCat">✓ 镜像到本台</button>
        </div>
      </div>
    </div>

    <!-- R73-S3：镜像到策展台（资源台 → 策展台；单卡 📡 / 分类 📤） -->
    <div class="modal-overlay" :class="{open: !!mirrorPushModal}" @click.self="mirrorPushModal=null">
      <div class="modal" style="width:440px">
        <div class="modal-header">
          <span style="font-size:16px">{{ mirrorPushModal?.kind === 'card' ? '📡' : '📤' }}</span>
          <span class="mh-title">{{ mirrorPushModal?.kind === 'card' ? '镜像卡片到策展台' : '镜像分类到策展台' }}</span>
          <div class="modal-close" @click="mirrorPushModal=null">×</div>
        </div>
        <div class="modal-body">
          <template v-if="mirrorPushModal">
            <div class="dr-section">
              <div class="dr-label">目标策展台 *</div>
              <select class="dr-category-select" v-model="mirrorPushModal.toWs">
                <option v-for="b in boards" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div v-if="mirrorPushModal.kind === 'card'" class="dr-section">
              <div class="dr-label">落入分类（可留空 = 该台未分类）</div>
              <select class="dr-category-select" v-model="mirrorPushModal.toCat">
                <option value="">未分类（该台）</option>
                <option v-for="c in mirrorPushTargetCats" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div v-else class="dr-section">
              <div class="dr-label">说明</div>
              <div class="ws-modal-hint">「{{ mirrorPushModal.catName }}」将物化为目标台的镜像分类，现有卡片一并投射；此后源分类新增卡片需手动再镜像。</div>
            </div>
          </template>
          <div v-if="!boards.length" class="ws-modal-hint">还没有策展台——顶栏「＋ 新建策展台」先建一个</div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="mirrorPushModal=null">取消</button>
          <button class="dr-footer-btn primary" :disabled="!boards.length" @click="confirmMirrorPush">✓ 镜像</button>
        </div>
      </div>
    </div>

  </div>
  <div v-else class="ws-empty">策展台不存在</div>
</template>

<script setup lang="ts">
// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
defineOptions({ name: 'WorkspaceView' })
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { useCompass } from '@/newtab/stores/compass'
import { recordResourceOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { saveUIPrefs } from '@/shared/storage/repository'
import { showToast } from '@/shared/components/toast'
import { toOpenableUrl, openExternalLink, linkStateOf } from '@/shared/utils/link'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { getAssetBlob } from '@/shared/storage/assets'
import AssetPreview from '@/shared/components/AssetPreview.vue'
import { uid } from '@/shared/utils'
import { MAX_CAT_LEVEL } from '@/shared/utils/catTree'
import { buildCatIndex, buildBucketIndex } from '@/shared/utils/catIndex'
import EmptyState from '@/shared/components/EmptyState.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'
import { useWorkspaceImport } from '@/newtab/composables/useWorkspaceImport'
import { useCurationDrill } from '@/newtab/composables/useCurationDrill'
import { useWorkspaceBatch } from '@/newtab/composables/useWorkspaceBatch'
import { useWorkspaceMirror } from '@/newtab/composables/useWorkspaceMirror'
import { useConfirm } from '@/shared/components/confirm'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import { markRank } from '@/shared/utils/marksort'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { useCardCols, CARD_COLS_DEFAULT } from '@/shared/utils/cardCols'
import { readWsView, writeWsView } from '@/shared/utils/wsView'
import { CURATION_WS_ID, type AppData, type ResourceCard, type Category, type Workspace, type TaskCard, type FieldDef, type AssetMeta } from '@/shared/models'
import { boardCardsOf, isMirrorView, removeProjection, curationMetrics, setThesis, mirrorCategoryToBoard, canMountInNode, isHubWs, projectCardToBoard, curationBoards, type MirrorView } from '@/shared/storage/hub'
import CurationDrillDrawer from '@/newtab/components/CurationDrillDrawer.vue'
import type { DrillCatRow, DrillCardRow } from '@/newtab/components/CurationDrillDrawer.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)
/** R82（R4）：取项目扁平表（任务的项目名展示）——与方向台共用 useCompass 的口径 */
const { allProjects } = useCompass()

const workspaceId = computed(() => route.params.id as string)
// R65-F7：KeepAlive 缓存实例——切换不同策展台（:id 变化）时复位本台局部状态，防上一台残留
watch(() => route.params.id, (nv, ov) => {
  if (nv && ov && nv !== ov) {
    activeCategory.value = 'all'
    searchQuery.value = ''
    debouncedQuery.value = ''
    selectedIds.value.clear()
    collapsedGroups.value = new Set()
  }
})
const workspace = computed(() => d.value.workspaces.find(w => w.id === workspaceId.value))
/** R62：资源台（isHub）不显示策展指标条与主题卡语义 */
const isHub = computed(() => isHubWs(workspace.value))

// ===== R62-1/2：策展台 5 指标 + 下钻 =====
const metrics = computed(() => curationMetrics(d.value, workspaceId.value))
/**
 * R84（W1）：页头描述——有台描述就用它，**为空则不占位**（原文验收要点）。
 * R90（R8-③）：拆成两态——
 *   · `wsHeadDescOwn`      用户自写的台描述（信息量真实）→ **内联**显示
 *   · `wsHeadDescFallback` 资源台无描述时回落的定位语 → 降为 **ⓘ tooltip**
 * 合并成一个 `wsHeadDesc` 时二者不可区分，一刀切降 tooltip 会把 W1 刚立起来的台身份又抹掉。
 */
const wsHeadDescOwn = computed(() => (workspace.value?.desc || '').trim())
const wsHeadDescFallback = computed(() => (wsHeadDescOwn.value ? '' : (isHub.value ? '资源卡唯一存储 · 镜像源头' : '')))
/**
 * R90（R8-①）：常驻提示条的教学文案（04-18 §R8 原句，一字未改）收进 `?` 的 title。
 * 用原生 title 而非自绘气泡：页头高度已锁 max-height:40px（R84 约束），自绘会撑破或需 Teleport。
 */
const HUB_HELP_TEXT = '卡片在此存储为真身 · 📡 单卡 / 📤 分类可镜像到各策展台 · 源数据零影响'
const thesisCard = computed<ResourceCard | null>(() => {
  const t = metrics.value.thesisId
  if (!t) return null
  return allResources.value.find(r => r.id === t) || null
})
function setThesisCard(r: ResourceCard) {
  if (isMirrorView(r)) { showToast('📡 镜像卡不能作为本台中心论点——请先移出镜像或选台内卡'); return }
  setThesis(d.value, workspaceId.value, r.id)
  store.persist()
  showToast(`🏛 「${r.title.slice(0, 16)}」已设为中心论点（金字塔 L1 根）`)
}
function unsetThesis() {
  setThesis(d.value, workspaceId.value, null)
  store.persist()
  showToast('已取消中心论点')
}
function openThesisDetail() {
  if (thesisCard.value) openResource(thesisCard.value)
  else openThesisCreate()
}
/** R64-F12：点击空态 → 弹出新建抽屉（预置 isThesis），保存后自动落为 L1 根节点 */
function openThesisCreate() {
  openNewResource()
  editingResource.isThesis = true
  showToast('🏛 填写论点标题保存后，自动成为中心论点（L1 根）')
}

function onDrillJumpCat(id: string) {
  drillOpen.value = false
  if (id === 'uncat') { activeCategory.value = 'uncat'; if (viewMode.value === 'pyramid') viewMode.value = 'card'; return }
  activeCategory.value = id
  if (viewMode.value === 'pyramid') { catFlashId.value = id; setTimeout(() => { catFlashId.value = null }, 2000) }
}
function onDrillOpenCard(id: string) {
  drillOpen.value = false
  const r = allResources.value.find(x => x.id === id)
  if (r && !isMirrorView(r)) openResource(r)
}
function onDrillLocate(id: string) {
  drillOpen.value = false
  const r = allResources.value.find(x => x.id === id)
  if (r) locateMirrorSource(r)
}

// R47-B4：进入/切换策展台 = 一次「调用」，计入热度（全局检索无输入时策展台参与热度排序）
watch(workspaceId, (id) => {
  if (!id) return
  const ws = d.value?.workspaces?.find(w => w.id === id)
  if (ws) { recordWorkspaceOpen(d.value, ws); store.persist() }
}, { immediate: true })
// R84（W2-②）：切台时重算视图偏好——不同台各有各的选择，不能把 A 台的金字塔串到 B 台
watch(workspaceId, () => nextTick(applyWsView))


// ===== 数据 =====
// R61：本台全量可见卡 = 台内原生卡 + 资源台镜像卡（boardCardsOf 注入视图模型：
// 镜像卡为浅拷贝 + categoryId 重映射到台内分类，带 __mirrorProjId 标记——写操作一律拦截/回落资源台）
const allResources = computed<ResourceCard[]>(() => boardCardsOf(d.value, workspaceId.value))
const categories = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value).sort((a,b) => a.order - b.order))
const resourceCount = computed(() => allResources.value.length)
const categoryCount = computed(() => categories.value.length)
/** R76（R3）：待分类判据——无分类，**或**分类已失效（categoryId 指向本台不存在的分类）。
 *  此前左树与指标条用严格口径（只看 !categoryId），而卡面「所在分类」、卡片/列表分组、下钻抽屉
 *  都用宽松口径 ⇒ 卡面写着「待分类」的悬空卡，点左树「待分类」却找不到。此处收敛为唯一实现。
 *  @param validIds 本台有效分类集合（catIdx.byId 的 Map，或自建 id Set）——只用到 has，故二者皆可 */
function isUncat(r: ResourceCard, validIds: { has(id: string): boolean }): boolean {
  return !r.categoryId || !validIds.has(r.categoryId)
}
const uncategorizedCount = computed(() => allResources.value.filter(r => isUncat(r, catIdx.value.byId)).length)
/** R61：本台分类是否为资源台镜像分类 */
// R45-2（V2.20.0）：页头新增「今日新增/今日删除」字段——策展台范围实时派生（含软删口径：新增排除已删、删除取 deletedAt）
const startOfToday = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); return dt.getTime() })()
const wsTodayAdd = computed(() => d.value.resources
  .filter(r => r.workspaceId === workspaceId.value && r.createdAt >= startOfToday)
  .length)
const wsTodayDel = computed(() => d.value.resources
  .filter(r => r.workspaceId === workspaceId.value && r.deletedAt && r.deletedAt >= startOfToday)
  .length)
const lastUpdateText = computed(() => {
  const latest = allResources.value.reduce((max, r) => Math.max(max, r.updatedAt || r.createdAt), 0)
  if (!latest) return '—'
  const diff = Date.now() - latest
  if (diff < 86400000) return '今天'
  if (diff < 172800000) return '昨天'
  return new Date(latest).toLocaleDateString('zh-CN')
})
/** R75（R18）：资源台「卡片总数」格的补充口径。
 *  拍板原文是「台内 / 镜像」提示，但单向挂载红线 ⇒ 无投射指向资源台，metrics.mirrored 恒 0，
 *  照搬会常驻「镜像 0」噪声 ⇒ 改用结构口径（分类数 / 待分类数），数据源全部现成、无需新计算。
 *  镜像数 > 0 只可能是历史脏数据，此时优先暴露异常提示清理。 */
const hubCountHint = computed(() =>
  metrics.value.mirrored > 0
    ? `⚠ 镜像 ${metrics.value.mirrored} 条待清理`
    : `分类 ${metrics.value.categoryCount} · 待分类 ${uncategorizedCount.value}`
)

// ===== 字段渲染（F1：全局设置的字段设计在此生效） =====
const rFields = computed(() => visibleFields(d.value.fieldConfig, 'resource'))
/** R62-3：主题卡（isThesis 资源卡）走 thesis 独立字段组，其余走 resource 组 */
function fieldsOf(r: ResourceCard): FieldDef[] {
  return (r.isThesis && !isMirrorView(r))
    ? visibleFields(d.value.fieldConfig, 'thesis')
    : rFields.value
}
const titleKey = computed(() => rFields.value.find(f => isTitleKey(f.key))?.key || 'title')
const listFields = computed(() => rFields.value.filter(f => !isTitleKey(f.key) && f.key !== 'assets').slice(0, 3))
function hasField(key: string): boolean {
  return rFields.value.some(f => f.key === key)
}
/** R71：分类名 / 台名索引（O(1)）——val() 由模板逐卡逐字段调用，此前每次都是一次全表 find */
const catNameById = computed(() => {
  const m = new Map<string, string>()
  for (const c of d.value.categories) m.set(c.id, c.name)
  return m
})
const wsNameById = computed(() => {
  const m = new Map<string, string>()
  for (const w of d.value.workspaces) m.set(w.id, w.name)
  return m
})
function val(r: ResourceCard, key: string): string {
  return fieldValue(r, key, {
    catName: (id) => catNameById.value.get(id) || '待分类',
    wsName: (id) => wsNameById.value.get(id) || ''
  })
}
function isTitleKey(key: string): boolean {
  return key === 'title' || key === 'question'
}
function shortVal(r: ResourceCard, f: FieldDef): string {
  const v = val(r, f.key)
  if (f.key === 'link') return v ? linkIcon(r.linkType) : ''
  return v.length > 14 ? v.slice(0, 14) + '…' : v
}
function srcLabel(s?: string): string {
  return s || ''
}

// ===== 视图状态 =====
/**
 * R84（W2-②）：视图模式改为**按台记忆**并持久化。
 * - 改前 `ref('card')` 纯内存 ⇒ 切台/重开都回到卡片视图，原文"用户切过视图后记忆其选择"无从谈起。
 * - 现在：① 该台已存偏好 → 用它；② 无偏好 → **已设中心论点 ⇒ 金字塔，否则卡片**。
 * - ⚠ 不复用 UIPrefs.viewMode（全局死字段、且不含 pyramid）；用 UIPrefs.wsViewMode[<台 id>]。
 */
const viewMode = ref<'card'|'list'|'kanban'|'pyramid'>('card')
function applyWsView() {
  const saved = readWsView(store.ui, workspaceId.value)
  viewMode.value = saved || (thesisCard.value ? 'pyramid' : 'card')
}
function setViewMode(m: 'card'|'list'|'kanban'|'pyramid') {
  viewMode.value = m
  writeWsView(store.ui, workspaceId.value, m)
}
/** R98（W7）：金字塔层级折叠——`仅 L2 / 到 L3 / 全部`。**本地视图态，不进 UIPrefs**（视图态
 *  持久化会造成「每次打开都被折叠」，与 D-B 拍板同口径）；同一组件跨台复用，折叠态跟随会话。 */
const pyFold = ref<'l2' | 'l3' | 'all'>('all')
// R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.res；网格模板由 --grid-cols 驱动）
// 资源台（isHub）与策展台为同一组件同一网格 ⇒ 共用 'res' 键，列数在两台一致
const resCols = useCardCols('res', store.ui)
/** R87（R5-①）：排序档位白名单——sortPrefs.res.by 是持久化字段，防止未来退役档位后读到死值卡住 UI */
const SORT_BY_KEYS = ['manual', 'recent', 'visited', 'hot', 'title']
/** R87（R5-②）：筛选档位白名单（4 类型 + 4 状态）；筛选是临时视图态，**不进 UIPrefs**——
 *  持久化会造成「下次打开发现卡少了」的困惑，与既有行为一致 */
// R89（W5）：加 starred（⭐ 星标）——W5 的另两项 hot 排序与 hasAssets 筛选已在 R87 顺带交付
// （R16 收敛后资源台与策展台同为 Workspace.vue 同一工具条，R5 与 W5 是同一份实现）
const FILTER_KEYS = ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets', 'starred', 'unmounted']
const sortBy = ref('manual')
// 第卅二轮 REQ-007：时间排序方向（默认倒序）+ 排序偏好本地记忆（UIPrefs.sortPrefs.res）
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.res?.dir === 'asc') ? 'asc' : 'desc')
const filterBy = ref('all')
const searchQuery = ref('')
// REQ-031 P-031-5：应用内搜索 150ms 防抖——输入框即时回显，过滤计算延迟触发（快速键入不卡顿）
const debouncedQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (v) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)
})
const activeCategory = ref('all')

if (store.ui?.sortPrefs?.res?.by && SORT_BY_KEYS.includes(store.ui.sortPrefs.res.by)) sortBy.value = store.ui.sortPrefs.res.by
watch([sortBy, sortDir], () => {
  const sp = { ...(store.ui?.sortPrefs || {}), res: { by: sortBy.value, dir: sortDir.value } }
  if (store.ui) store.ui.sortPrefs = sp
  saveUIPrefs({ sortPrefs: sp })
})
function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }

// 第卅三轮 REQ-026：密度档位（compact/cozy，记忆 UIPrefs.density，html[data-density] 驱动 tokens 变量）
const density = computed({
  get: () => store.ui?.density || 'cozy',
  set: (v: 'compact' | 'cozy') => {
    if (store.ui) store.ui.density = v
    saveUIPrefs({ density: v })
    if (v === 'compact') document.documentElement.setAttribute('data-density', 'compact')
    else document.documentElement.removeAttribute('data-density')
  }
})

const activeCategoryLabel = computed(() => {
  if (activeCategory.value === 'all') return '全部'
  if (activeCategory.value === 'uncat') return '待分类'
  return categories.value.find(c => c.id === activeCategory.value)?.name || '分组'
})

/**
 * R87（R5-②）：反查索引 —— 被未软删任务挂载的资源 id 集合。
 * ★ 单向挂载红线：资源卡不得新增反向字段，要知道「有没有被挂载」只能反查 d.tasks；
 *   但不能在筛选里逐卡 mountedTaskCount（O(卡数×任务数)，触 R83 性能红线），故一次遍历建 Set。
 */
const mountedResIds = computed<Set<string>>(() => {
  const s = new Set<string>()
  for (const t of d.value.tasks) {
    if (t.deletedAt) continue
    for (const id of t.mountedResourceIds || []) s.add(id)
  }
  return s
})
/** R87（R5 收尾）：当前是否有生效的过滤（类型/状态筛选 或 搜索词）——空态据此换文案与动作 */
const hasActiveFilter = computed(() => filterBy.value !== 'all' || !!debouncedQuery.value.trim())
const FILTER_LABELS: Record<string, string> = {
  all: '全部', url: 'URL链接', file: '本地文件', obsidian: 'Obsidian',
  hasLink: '有链接', brokenPath: '⚠ 待补全路径', hasAssets: '有附件', starred: '⭐ 星标', unmounted: '未挂载任务'
}
const filterLabel = computed(() => FILTER_LABELS[filterBy.value] || '全部')

// ===== R89（R6）：搜索判据 =====
/**
 * 解析查询串：`#前端 #待读 关键词` → `{ tags:['前端','待读'], kw:'关键词' }`。
 * 单个 `#`（长度 1）不算标签，回落为普通词，避免边输入边筛选。
 */
function parseQuery(raw: string): { tags: string[]; kw: string } {
  const tags: string[] = []
  const rest: string[] = []
  for (const tok of (raw || '').trim().split(/\s+/)) {
    if (!tok) continue
    if (tok.length > 1 && tok.startsWith('#')) tags.push(tok.slice(1).toLowerCase())
    else rest.push(tok.toLowerCase())
  }
  return { tags, kw: rest.join(' ') }
}
/**
 * 卡片是否命中查询（三视图共用——它们都走 filteredResources）。
 * - `#标签`：**全部命中才算**（取交集）。"直筛"是收窄，不是扩大。
 * - 普通词：标题 / 描述 / 标签 / **自定义字段值**。
 *   ⚠ 自定义字段此前能在卡片上显示（`fieldValue` 的 `custom_` 分支）却搜不到——R6 要补的就是这一处。
 */
function matchCard(r: ResourceCard, p: { tags: string[]; kw: string }): boolean {
  const cardTags = (Array.isArray(r.tags) ? r.tags : []).map(t => t.toLowerCase())
  for (const t of p.tags) if (!cardTags.includes(t)) return false
  if (!p.kw) return true
  if (r.title.toLowerCase().includes(p.kw)) return true
  if ((r.description || '').toLowerCase().includes(p.kw)) return true
  if (cardTags.some(t => t.includes(p.kw))) return true
  for (const v of Object.values(r.customFields || {})) {
    if (v != null && String(v).toLowerCase().includes(p.kw)) return true
  }
  return false
}
function resetFilters() {
  filterBy.value = 'all'
  searchQuery.value = ''
  debouncedQuery.value = ''
}

// ===== R88（W3）：工具条分级——「筛选」气泡与生效值徽标 =====
const filterPopOpen = ref(false)
function toggleFilterPop() {
  const next = !filterPopOpen.value
  settingsMenuOpen.value = false        // 与 ⚙ 互斥
  filterPopOpen.value = next
}
function closeFilterPop() { filterPopOpen.value = false }
/** 排序档位的中文标签（生效值徽标与气泡共用；与 SORT_BY_KEYS 同序） */
const SORT_LABELS: Record<string, string> = {
  manual: '手动拖拽', recent: '最近添加', visited: '最近访问', hot: '调用最多', title: '标题 A-Z'
}
/**
 * 当前**非默认**的视图设置（W3 的「生效值徽标」）。
 * 全默认时返回空数组 ⇒ 按钮上不挂任何 chip（没有筛选时不喧哗）。
 */
const filterSummary = computed<string[]>(() => {
  const out: string[] = []
  if (sortBy.value !== 'manual') out.push(SORT_LABELS[sortBy.value] || sortBy.value)
  if (filterBy.value !== 'all') out.push(filterLabel.value)
  if (density.value !== 'cozy') out.push('紧凑')
  // 列数只在卡片视图出现，非卡片视图时不该算作"生效中"
  if (viewMode.value === 'card' && resCols.value !== CARD_COLS_DEFAULT.res) out.push(resCols.value + ' 列')
  return out
})
/** 徽标挤不下时的兜底：hover 给出全部生效值 */
const filterPopTitle = computed(() => filterSummary.value.length
  ? '当前生效：' + filterSummary.value.join(' · ') + '（点击展开筛选面板）'
  : '排序 · 类型筛选 · 密度 · 列数（点击展开筛选面板）')
/** 气泡底部的「重置全部」：四项回默认，并清空搜索 */
function resetAllFilters() {
  sortBy.value = 'manual'
  filterBy.value = 'all'
  density.value = 'cozy'
  resCols.value = CARD_COLS_DEFAULT.res
  resetFilters()
}
/** R87（R7）：链接三态的卡片级封装——三视图徽标、筛选、双击 toast 共用同一个判据 */
function isBrokenPath(r: ResourceCard): boolean {
  return linkStateOf(r.linkType, r.link) === 'incomplete'
}
/** R87（R5-②）：8 档筛选谓词表。类型四档沿用 linkType 直判（保留既有持久化值），状态四档为语义谓词 */
const FILTER_PREDICATES: Record<string, (r: ResourceCard) => boolean> = {
  url: (r) => r.linkType === 'url',
  file: (r) => r.linkType === 'file',
  obsidian: (r) => r.linkType === 'obsidian',
  hasLink: (r) => linkStateOf(r.linkType, r.link) !== 'none',
  brokenPath: (r) => isBrokenPath(r),
  hasAssets: (r) => (r.assets?.length || 0) > 0,
  starred: (r) => !!r.starred,
  unmounted: (r) => !mountedResIds.value.has(r.id)
}

// 筛选（第八轮：点击父分类 = 聚合显示本级 + 全部子分类）
const filteredResources = computed(() => {
  let list = allResources.value
  if (activeCategory.value === 'uncat') list = list.filter(r => !r.categoryId)
  else if (activeCategory.value !== 'all') {
    const ids = familyIds(activeCategory.value)
    list = list.filter(r => r.categoryId && ids.includes(r.categoryId))
  }
  const pred = FILTER_PREDICATES[filterBy.value]
  if (pred) list = list.filter(pred)
  // R89（R6）：搜索判据收敛到 parseQuery + matchCard 一处（自定义字段纳入、`#标签` 直筛）
  if (debouncedQuery.value.trim()) {
    const p = parseQuery(debouncedQuery.value)
    list = list.filter(r => matchCard(r, p))
  }
  return list
})

// 排序（第卅二轮 REQ-007：时间类排序支持正/倒序方向）
function applySort(list: ResourceCard[]): ResourceCard[] {
  const out = [...list]
  const dirMul = sortDir.value === 'asc' ? 1 : -1
  // R56-V1：手动（默认）态 = 拖拽序优先（curOrder），无拖拽序的最新在前
  if (sortBy.value === 'manual') {
    const hasDrag = out.some(r => r.curOrder != null)
    if (!hasDrag) { out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return out }
    out.sort((a, b) => (a.curOrder ?? 999999) - (b.curOrder ?? 999999))
    return out
  }
  if (sortBy.value === 'recent') out.sort((a,b) => dirMul * ((a.createdAt||0) - (b.createdAt||0)))
  else if (sortBy.value === 'visited') out.sort((a,b) => dirMul * ((a.lastCalledAt||0) - (b.lastCalledAt||0)))
  // R87（R5-①）：调用最多 —— callCount 降序，同热度用最近调用时间兜底（避免零热度段次序随机）
  else if (sortBy.value === 'hot') out.sort((a,b) => ((b.callCount||0) - (a.callCount||0)) || ((b.lastCalledAt||0) - (a.lastCalledAt||0)))
  else if (sortBy.value === 'title') out.sort((a,b) => a.title.localeCompare(b.title, 'zh-CN'))
  return out
}

// REQ-028 F-028-1：分组视图分区内置顶排序——先按当前排序规则，再按 marksort 权重稳定重排（置顶>星标>普通）
function applyGroupSort(list: ResourceCard[]): ResourceCard[] {
  const sorted = applySort(list)
  // 稳定排序：同权重保持 applySort 相对序（manual 保持拖拽序）
  return sorted.sort((a, b) => markRank(b) - markRank(a))
}

// 全量可见列表（批量全选 / 空状态共用）
const sortedResources = computed(() => applySort(filteredResources.value))

// ===== REQ-027：卡片/列表视图取消全平铺，按分类分组分区 =====
interface ResourceGroup { key: string; title: string; count: number; items: ResourceCard[]; depth: number }
/** F-027-4 折叠增强：点击分组标题折叠/展开（内存态，不持久化） */
const collapsedGroups = ref<Set<string>>(new Set())
function toggleGroupCollapse(key: string) {
  const s = new Set(collapsedGroups.value)
  if (s.has(key)) s.delete(key); else s.add(key)
  collapsedGroups.value = s
}
/**
 * 分区规则（R64-F9 树状递归分组：子分类不再混入父组平铺，逐级下钻、depth 缩进呈现层级）：
 * - 「全部」：按左树顺序逐分类 walk——直属卡一组（组标题=分类名），子分类递归（depth+1）；
 *   无分类卡归「待分类」分区置于最前
 * - 选中父分类：直属卡一组，其下子分类递归
 * 分区内按当前排序规则排列（applyGroupSort；manual 保持数组序=手动拖拽序）。
 */
const resourceGroups = computed<ResourceGroup[]>(() => {
  const filtered = filteredResources.value
  const groups: ResourceGroup[] = []
  const validIds = catIdx.value.byId
  /** R71：先按分类分桶一次，后续所有「某分类的卡」都是 O(1) 取用——
   *  此前每个节点都要对 filtered 全量 filter（O(节点数×卡数)），并对每个子节点再扫一遍判空 */
  const bucket = buildBucketIndex(filtered, (r) => r.categoryId || '')
  const uncat = applyGroupSort(filtered.filter(r => isUncat(r, validIds)))
  if (uncat.length) groups.push({ key: 'uncat', title: '待分类', count: uncat.length, items: uncat, depth: 0 })
  /** 子树内是否有卡（含直属）——查分桶，空分支不生成组 */
  const subtreeHasCards = (catId: string) => {
    for (const id of catIdx.value.family(catId)) if ((bucket.get(id) || []).length) return true
    return false
  }
  const seenGroup = new Set<string>()  // R70：防环
  const walk = (catId: string, name: string, depth: number) => {
    if (seenGroup.has(catId)) return
    seenGroup.add(catId)
    const direct = applyGroupSort(bucket.get(catId) || [])
    if (direct.length) groups.push({ key: catId, title: name, count: direct.length, items: direct, depth })
    for (const sub of childCatsOf(catId)) {
      if (subtreeHasCards(sub.id)) walk(sub.id, sub.name, depth + 1)
    }
  }
  if (activeCategory.value === 'all') {
    for (const root of rootCats.value) {
      if (subtreeHasCards(root.id)) walk(root.id, root.name, 0)
    }
  } else if (activeCategory.value !== 'uncat') {
    const sel = wsCats.value.find(c => c.id === activeCategory.value)
    if (sel) walk(sel.id, sel.name, 0)
  }
  return groups
})
/** R98（W9）：分组标题补「含 N 个子分类」——组内 count 是**直属**口径（walk 只 push 有直属卡的组），
 *  与左树的聚合数不同源；同屏「左树 A 显示 5 / 分组 A 显示 3」会被当成对不上账，须写明。
 *  子分类各自的卡有自己的组（walk 递归）；待分类无子分类。 */
function groupChildCount(key: string): number {
  if (key === 'uncat') return 0
  return catIdx.value.childrenOf.get(key)?.length || 0
}

const kanbanCategories = computed(() => {
  const cats: { key: string; name: string }[] = []
  for (const root of rootCats.value) {
    cats.push({ key: root.id, name: root.name })
    for (const id of catIdx.value.descendants(root.id)) {
      const c = catIdx.value.byId.get(id)
      if (c) cats.push({ key: c.id, name: catIdx.value.pathOf(c.id) })
    }
  }
  cats.push({ key: '', name: '待分类' })
  return cats
})

function resourcesByCategory(catId: string) {
  // R56-V1：看板列内与卡片/列表视图同口径——applySort 消费（手动=拖拽序 curOrder 优先，无拖拽序最新在前）
  // R71：改走分桶索引（此前每列一次全量 filter）
  return applySort(resBucket.value.get(catId || '') || [])
}
/** R71：看板列（名字 + 计数 + 卡列表）一次算好——模板此前每列把 resourcesByCategory 调两次
 *  （一次计数、一次渲染），等于每列对全量卡 filter+sort 两遍 */
const kanbanColumns = computed(() => kanbanCategories.value.map(c => {
  const items = resourcesByCategory(c.key)
  return { key: c.key, name: c.name, items, count: items.length }
}))

// ===== 链接打开（E1：双击 = 打开链接；第卅二轮 REQ-010 归一化逻辑统一在 shared/utils/link） =====
/** 图片附件预览（R80/R14）：blob URL 需回收，打开下一张前先 revoke 上一张 */
const previewOpen = ref(false)
const previewUrl = ref('')
const previewName = ref('')
let lastPreviewUrl = ''
function revokePreview() {
  if (lastPreviewUrl) { URL.revokeObjectURL(lastPreviewUrl); lastPreviewUrl = '' }
}
function closePreview() { previewOpen.value = false; revokePreview(); previewUrl.value = '' }
async function openImageAsset(meta: AssetMeta) {
  let blob: Blob | null = null
  try { blob = await getAssetBlob(meta.id) } catch { blob = null }
  if (!blob) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return }
  revokePreview()
  previewUrl.value = URL.createObjectURL(blob)
  lastPreviewUrl = previewUrl.value
  previewName.value = meta.name
  previewOpen.value = true
}
/** 第卌二轮 REQ-061：双击卡片打开——挂了 HTML 附件的资源卡（link=zy-asset://<id>）走 openHtmlAsset
 *  file:// 落盘完整打开，与详情内打开同一函数同一效果（新标签页，内联脚本可运行）
 *  R80（R14）：补上 image 分支——此前判据只放行 html/pdf，图片附件卡双击会落到
 *  「文档附件不存在或已失效」的误报；现图片走 AssetPreview 就地预览。 */
function openResourceLink(r: ResourceCard) {
  recordResourceOpen(d.value, r)
  store.persist()
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
    const meta = (r.assets || []).find(a => a.id === assetId)
    if (!meta) { showToast('⚠ 卡片指向的附件不存在或已失效，请重新上传'); return }
    if (meta.kind === 'image') { void openImageAsset(meta); return }
    if (meta.kind === 'html' || meta.kind === 'pdf') { openHtmlAsset(meta); return }
    showToast('⚠ 卡片指向的附件不存在或已失效，请重新上传')
    return
  }
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) {
    // R87（R7-③）：此前一律回「本地文件需完整路径」，对 URL 型空链接卡是错话。按链接三态分流：
    const st = linkStateOf(r.linkType, r.link)
    if (st === 'none') showToast('⚠ 该卡还没填链接 —— 点卡片右上角 ↗ 或进入详情补一个')
    else if (st === 'incomplete') showToast('⚠ 仅存文件名，需补全完整路径（如 D:\\docs\\file.pdf）')
    else showToast('⚠ 该链接无法打开（协议不受支持）')
    return
  }
  openExternalLink(url)
}

/**
 * R87（R7-②）：「⚠ 待补全」徽标的一键补全 —— 打开详情抽屉并把光标送进链接输入框。
 * 镜像卡是策展台里的只读引用（与 📌⭐🗑 同款拦截），补全得上资源台真身卡。
 */
const resFormRef = ref<InstanceType<typeof ResourceEditForm> | null>(null)
function fixLink(r: ResourceCard) {
  if (isMirrorView(r)) { showToast('📡 镜像卡为引用——补全路径请到资源台'); return }
  openResource(r)
  nextTick(() => resFormRef.value?.focusLink())
}

// 单击（详情）与双击（打开链接）区分
let clickTimer: ReturnType<typeof setTimeout> | null = null
function onCardClick(r: ResourceCard) {
  if (batchMode.value) { toggleSelect(r.id); return }
  if (isMirrorView(r)) {
    // R61：镜像卡单击 = 只读提示（编辑请到资源台；双击打开链接照常）
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
    clickTimer = setTimeout(() => { clickTimer = null; showToast('📡 镜像卡为引用（源在资源台）——双击打开链接，编辑请定位到资源台') }, 260)
    return
  }
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
  clickTimer = setTimeout(() => { clickTimer = null; openResource(r) }, 260)
}
function onCardDblClick(r: ResourceCard) {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  openResourceLink(r)
}

// ===== 资源卡编辑抽屉 =====
const drawerOpen = ref(false)
const editingResource = reactive<ResourceCard>(emptyResource())
const isNewResource = ref(false)

// 表单主体已抽至共享 ResourceEditForm（REQ-042/#61）；此处仅保留宿主动作：打开/保存/删除/复制/跳转
let drawerOriginalWsId = '' // REQ-004：跨策展台迁移检测基准（打开/新建时记录）

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: workspaceId.value, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0 }
}

/**
 * R73-S4a（L4）：资源台聚合哨兵回落。
 * 当前分类处于「全部」（聚合根）或「待分类」时，新建卡 / 导入文件 / 空白区落卡
 * 一律回落「未分类」（''），**不得把聚合键写进数据层**。
 * 口径与 CurationCenter 的 newCardCatId() 一致（'all' = 全部分类聚合根，'uncat' = 待分类）。
 */
function newCardCatId(): string {
  const c = activeCategory.value
  return (c && c !== 'uncat' && c !== 'all') ? c : ''
}

function openNewResource() {
  Object.assign(editingResource, emptyResource())
  editingResource.id = uid('res')
  editingResource.createdAt = Date.now()
  drawerOriginalWsId = editingResource.workspaceId
  // R73-S4a：聚合/待分类视图下回落未分类（与导入、空白区落卡同口径）
  editingResource.categoryId = newCardCatId()
  isNewResource.value = true
  drawerOpen.value = true
}
function addResourceToCategory(catId: string) {
  Object.assign(editingResource, emptyResource())
  editingResource.id = uid('res')
  editingResource.createdAt = Date.now()
  editingResource.categoryId = catId
  drawerOriginalWsId = editingResource.workspaceId
  isNewResource.value = true
  drawerOpen.value = true
}
function openResource(r: ResourceCard) {
  Object.assign(editingResource, JSON.parse(JSON.stringify(r)))
  drawerOriginalWsId = editingResource.workspaceId
  isNewResource.value = false
  drawerOpen.value = true
  // 单击打开详情 = 一次调用（WRR 口径）
  recordResourceOpen(d.value, r)
  store.persist()
}
function closeDrawer() { drawerOpen.value = false }
function saveResource() {
  if (!editingResource.title.trim()) { showToast('请输入标题'); return }
  // REQ-004：检测是否跨策展台迁移，保存后给出迁移反馈
  const wsChanged = !isNewResource.value && !!drawerOriginalWsId && editingResource.workspaceId !== drawerOriginalWsId
  editingResource.updatedAt = Date.now()
  if (isNewResource.value) {
    d.value.resources.unshift({ ...editingResource })
  } else {
    const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
    if (idx >= 0) d.value.resources[idx] = { ...editingResource }
  }
  store.persist()
  drawerOpen.value = false
  if (wsChanged) {
    const target = d.value.workspaces.find(w => w.id === editingResource.workspaceId)
    showToast(`✓ 已保存并迁移至「${target?.name.replace(/^[^\s]+\s/, '') || '目标策展台'}」`)
  } else {
    showToast('✓ 已保存')
  }
}
async function deleteCurrentResource() {
  const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
  if (idx >= 0) d.value.resources[idx].deletedAt = Date.now()
  store.persist()
  drawerOpen.value = false
  const target = idx >= 0 ? d.value.resources[idx] : null
  showToast(target ? `已删除「${target.title.slice(0, 20)}」` : '资源卡已删除', { label: '撤销', cb: () => {
    // REQ-030：按 id 从当前数据树查找（persist 后 onChanged 会整树替换引用，闭包旧引用已失效）
    const cur = d.value.resources.find(x => x.id === editingResource.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}
async function deleteResource(r: ResourceCard) {
  if (isMirrorView(r)) { removeMirror(r); return }
  r.deletedAt = Date.now()
  store.persist()
  // REQ-030：3 秒内可撤销（按 id 定位当前树，根治引用替换导致的撤销失效）
  showToast(`已删除「${r.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = d.value.resources.find(x => x.id === r.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}
function togglePin(r: ResourceCard) {
  if (isMirrorView(r)) { showToast('📡 镜像卡为引用——置顶请在资源台操作'); return }
  r.pinned = !r.pinned
  r.updatedAt = Date.now()
  store.persist()
  showToast(r.pinned ? '📌 已置顶' : '已取消置顶')
}
/** 第卅三轮 REQ-020：星标切换（独立于置顶，可叠加） */
function toggleStar(r: ResourceCard) {
  if (isMirrorView(r)) { showToast('📡 镜像卡为引用——星标请在资源台操作'); return }
  r.starred = !r.starred
  r.updatedAt = Date.now()
  store.persist()
  showToast(r.starred ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
}
function copyLink() {
  if (!editingResource.link) { showToast('无链接'); return }
  navigator.clipboard.writeText(editingResource.link).then(() => showToast('✓ 链接已复制'))
}
// 挂载任务点击（共享表单 emit goto-task）→ 跳任务中心
function goToTask(t: TaskCard) {
  router.push('/')
  showToast(`已跳转任务中心：${t.title}`)
}

// ===== 拖拽排序 =====
let draggedItem: ResourceCard | null = null
// B5：右键菜单
const resCtx = ref({ open: false, x: 0, y: 0 })
const resCtxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
function openResCtx(e: MouseEvent, r: ResourceCard) {
  if (isMirrorView(r)) {
    // R61：镜像卡右键——只读引用语义（打开/复制/定位源/移出镜像）
    resCtxItems.value = [
      { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
      { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
      { label: '🎯 定位到资源台', icon: 'folder', cb: () => locateMirrorSource(r) },
      { label: '✕ 移出镜像', icon: 'trash', danger: true, cb: () => removeMirror(r) }
    ]
  } else {
    resCtxItems.value = [
      { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
      { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
      // R90（R10）：编辑——右键直达抽屉。此前右键菜单只有"打开链接"，要**改**内容必须先单击卡进详情
      { label: '✏️ 编辑详情', icon: 'edit', cb: () => openResource(r) },
      { label: '移动分类', icon: 'folder', cb: () => openMoveOne(r) },
      // R82（R4）：挂载到任务——与动作条同一入口的两条路径之一。镜像分支不提供（只读引用）。
      { label: mountedTaskCount(r) ? `挂载到任务（已挂 ${mountedTaskCount(r)}）` : '挂载到任务…', icon: 'clipboard', cb: () => openMountOne(r) },
      // R90（R10）：镜像到策展台——**仅资源台真身卡**有语义（策展台的卡源头就是资源台，再推给别的台无意义）。
      // openMirrorCard 内部已对「还没有策展台」给提示，此处不重复兜底。
      ...(isHub.value ? [{ label: '📡 镜像到策展台', icon: 'share', cb: () => openMirrorCard(r) }] : []),
      { label: r.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => togglePin(r) },
      // R90（R10）：星标——toggleStar 能力早就在、hover 动作条早早就有 ⭐，右键此前一直缺
      { label: r.starred ? '☆ 取消星标' : '⭐ 星标', icon: 'star', cb: () => toggleStar(r) },
      // R62-3：中心论点（每台一张；设立即替换旧论点）
      // R90：图标 'star' → 'target' —— ICONS 原本没有 star 键，会静默回落成罗盘；且星标项已占用 star
      r.isThesis
        ? { label: '取消中心论点', icon: 'target', cb: () => unsetThesis() }
        : { label: '🏛 设为中心论点', icon: 'target', cb: () => setThesisCard(r) },
      { label: '删除', icon: 'trash', danger: true, cb: () => deleteResource(r) }
    ]
  }
  resCtx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 240) }
}

// B6：拖拽插入线（X 轴卡片 / Y 轴列表）
const dropMark = ref('')
function markDrop(e: DragEvent, key: string, axis: 'x' | 'y') {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const after = axis === 'x'
    ? (e.clientX - rect.left) / rect.width > 0.5
    : (e.clientY - rect.top) / rect.height > 0.5
  dropMark.value = key + (after ? '-b' : '-t')
}
function clearDropMark() { dropMark.value = '' }
/** R73-S4b（L5）：接受拖入的统一应答（preventDefault + dropEffect=move，防真实拖拽被判定为不可落） */
function acceptDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
/** R73-S4b（L5）：拖拽结束统一复位（drop 后也会触发，防取消拖拽时状态残留） */
function clearDragState() { draggedItem = null; dragCatId = null; dropMark.value = '' }
function onDragStart(e: DragEvent, r: ResourceCard) {
  draggedItem = r
  e.dataTransfer?.setData('text/plain', r.id)
}
// REQ-028 F-028-3：卡片所属渲染分区（与 resourceGroups 分区 key 对齐）
function groupKeyOf(r: ResourceCard): string {
  const validIds = new Set(wsCats.value.map(c => c.id))
  if (isUncat(r, validIds)) return 'uncat'
  if (activeCategory.value === 'all') {
    for (const root of rootCats.value) {
      if (familyIds(root.id).includes(r.categoryId)) return root.id
    }
    return 'uncat'
  }
  if (activeCategory.value === 'uncat') return 'uncat'
  if (childCatsOf(activeCategory.value).some(s => s.id === r.categoryId)) return r.categoryId
  return 'direct'
}

function onDropCard(e: DragEvent, target: ResourceCard) {
  if (!draggedItem || draggedItem.id === target.id) { clearDropMark(); return }
  const moved = draggedItem
  // R61：镜像卡拖拽 = 只改投射落点（源卡零影响，不参与物理排序）
  if (isMirrorView(moved)) {
    const mCat = target.categoryId && wsCats.value.some(c => c.id === target.categoryId) ? target.categoryId : ''
    moveMirrorTo(moved, mCat)
    draggedItem = null
    clearDropMark()
    return
  }
  const after = dropMark.value.endsWith('-b')
  // REQ-028 F-028-3：跨分区拖拽 = 修改分类归属（轻提示）；同分区 = 局部排序
  const crossGroup = groupKeyOf(moved) !== groupKeyOf(target)
  const newCat = target.categoryId && wsCats.value.some(c => c.id === target.categoryId) ? target.categoryId : ''
  const catChanged = (moved.categoryId || '') !== (newCat || '')
  if (catChanged) {
    moved.categoryId = newCat
    moved.updatedAt = Date.now()
    if (crossGroup) showToast(`✓ 已移动至「${newCat ? categories.value.find(c => c.id === newCat)?.name : '待分类'}」`)
  }
  sortBy.value = 'manual'
  const fromIdx = d.value.resources.findIndex(r => r.id === moved.id)
  const toIdx = d.value.resources.findIndex(r => r.id === target.id)
  if (fromIdx < 0 || toIdx < 0) { clearDropMark(); return }
  const [item] = d.value.resources.splice(fromIdx, 1)
  const newIdx = d.value.resources.findIndex(r => r.id === target.id)
  d.value.resources.splice(after ? newIdx + 1 : newIdx, 0, item)
  // R56-V1：拖拽序物化——落位分区按物理序全量重写 curOrder（否则「无拖拽序=最新在前」会吞掉拖拽结果）
  const landedKey = groupKeyOf(moved)
  d.value.resources.filter(r => !r.deletedAt && groupKeyOf(r) === landedKey).forEach((r, i) => { r.curOrder = i })
  store.persist()
  draggedItem = null
  clearDropMark()
}
// O8：看板列内卡片拖拽排序；第廿八轮：跨分类列落卡 = 改分类归属（插入位置不变）
function onKanbanCardDrop(e: DragEvent, target: ResourceCard) {
  e.preventDefault(); e.stopPropagation()
  const after = dropMark.value.endsWith('-b')
  clearDropMark()
  if (!draggedItem || draggedItem.id === target.id) return
  sortBy.value = 'manual'
  const moved = draggedItem
  // R61：镜像卡拖拽 = 只改投射落点
  if (isMirrorView(moved)) {
    moveMirrorTo(moved, target.categoryId || '')
    draggedItem = null
    return
  }
  const fromIdx = d.value.resources.findIndex(x => x.id === moved.id)
  const toIdx = d.value.resources.findIndex(x => x.id === target.id)
  if (fromIdx < 0 || toIdx < 0) return
  if ((moved.categoryId || '') !== (target.categoryId || '')) {
    moved.categoryId = target.categoryId || ''
    moved.updatedAt = Date.now()
    showToast(`✓ 已移动到${target.categoryId ? categories.value.find(c => c.id === target.categoryId)?.name : '待分类'}`)
  }
  const [item] = d.value.resources.splice(fromIdx, 1)
  const newToIdx = d.value.resources.findIndex(x => x.id === target.id)
  d.value.resources.splice(after ? newToIdx + 1 : newToIdx, 0, item)
  // R56-V1：看板拖拽同样物化拖拽序——落位列全量重写 curOrder，列内 applySort 稳定消费
  const colKey = target.categoryId || ''
  d.value.resources.filter(r => !r.deletedAt && (r.categoryId || '') === colKey).forEach((r, i) => { r.curOrder = i })
  store.persist()
  draggedItem = null
  showToast('✓ 已调整排序')
}
function onDropToCategory(e: DragEvent, catId: string) {
  if (!draggedItem) return
  // R61：镜像卡落树节点 = 只改投射落点
  if (isMirrorView(draggedItem)) { moveMirrorTo(draggedItem, catId); draggedItem = null; clearCardDropTarget(); return }
  draggedItem.categoryId = catId
  draggedItem.updatedAt = Date.now()
  store.persist()
  showToast(`✓ 已移入「${catId ? categories.value.find(c=>c.id===catId)?.name : '待分类'}」`)
  draggedItem = null
  clearCardDropTarget()
}

// ===== R73-S4b（L5）：区域级落卡 + 混排重编号（自 CurationCenter 迁入，补齐 hub 缺口） =====
/** 分区 key → 真实分类 id（聚合哨兵 'all' / 'uncat' 一律回落「未分类」''） */
function catKeyToCatId(key?: string): string {
  const k = key ?? ''
  return (k === 'all' || k === 'uncat') ? '' : k
}
/** 区域级 dragover —— 卡片拖拽悬停于分区网格任意处（含空白）均可落 */
function onAreaDragOver(e: DragEvent, groupKey?: string) {
  if (draggedItem) acceptDragOver(e)
  void groupKey
}
/** 区域级 drop —— 拖到分区网格空白处 = 移入该分区（聚合视图回落未分类；镜像卡只改投射落点） */
function onAreaDrop(e: DragEvent, groupKey?: string) {
  clearDropMark()
  const moved = draggedItem
  draggedItem = null
  if (!moved) return
  const targetKey = catKeyToCatId(groupKey)
  // R61：镜像卡为引用 —— 拖拽只改投射落点，源卡零影响
  if (isMirrorView(moved)) { moveMirrorTo(moved, targetKey); return }
  const changed = (moved.categoryId || '') !== targetKey
  if (changed) {
    moved.categoryId = targetKey
    moved.updatedAt = Date.now()
    sortBy.value = 'manual'
  }
  // 落位分区按物理序全量重写 curOrder（与 onDropCard 同口径）
  const landedKey = groupKeyOf(moved)
  d.value.resources.filter(r => !r.deletedAt && groupKeyOf(r) === landedKey).forEach((r, i) => { r.curOrder = i })
  store.persist()
  showToast(changed ? `✓ 已移动至「${targetKey ? categories.value.find(c => c.id === targetKey)?.name : '待分类'}」` : '✓ 已更新')
}
/** 混排重编号 —— 把 id 插到 targetId 之前，并把落位分区内的 curOrder 统一重写 */
function reorderMixed(groupKey: string, id: string, targetId: string): boolean {
  const key = catKeyToCatId(groupKey)
  const list = d.value.resources.filter(r => !r.deletedAt && (r.categoryId || '') === key)
  const fi = list.findIndex(r => r.id === id)
  const ti = list.findIndex(r => r.id === targetId)
  if (fi < 0 || ti < 0) return false
  const [moved] = list.splice(fi, 1)
  const tj = list.findIndex(r => r.id === targetId)
  list.splice(tj, 0, moved)
  list.forEach((r, i) => { r.curOrder = i })
  return true
}

// ===== 批量操作（E4） =====
function catNameOf(r: ResourceCard): string {
  if (!r.categoryId) return '待分类'
  return catIdx.value.byId.get(r.categoryId)?.name || '待分类'
}
function catIconOf(r: ResourceCard): string {
  return r.categoryId && catIdx.value.byId.has(r.categoryId) ? '📂' : '📥'
}
/** R64-F10：卡面所属文件夹徽标——完整分类路径（根→当前，4 级全链）
 *  R71：走索引缓存（此前沿父链反复全表 find，O(depth×n)；且此函数在卡面模板里逐卡调用） */
function catNameOfFamily(r: ResourceCard): string {
  if (isUncat(r, catIdx.value.byId)) return '待分类'
  return catIdx.value.pathOf(r.categoryId)
}

// ===== 第八轮：分类树（2 级）+ 置顶 + 聚合计数 =====
const wsCats = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value))
/**
 * R71 性能治理：分类树索引（一次 O(n) 建表 → 此后 O(1) 查表）。
 * 此前 childCatsOf / rootCats / descendantIds / familyIds 全是「每次调用都全表扫描」的实现，
 * 而它们被递归函数与模板表达式反复调用（侧栏单个节点就要 5 次 childCatsOf）——
 * 整棵树一次重渲染是 O(n²)，这正是切换视图/展开目录时卡顿的主因。
 */
const catIdx = computed(() => buildCatIndex(wsCats.value))
/** 卡片按分类分桶（O(1) 取「某分类的卡」，替代反复 filter 全量卡） */
const resBucket = computed(() => buildBucketIndex(allResources.value, (r) => r.categoryId || ''))

// ===== R101（纯拆分第二批）：下钻抽屉的状态与数据拆入 useCurationDrill =====
// 状态/数据下沉（惰性求值随迁），落点导航回调（onDrill*）留宿主——它们写视图状态，是接线不是实现。
const { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillRecent } = useCurationDrill({
  allResources, resBucket, catIdx, isUncat
})

function childCatsOf(pid: string): Category[] {
  return catIdx.value.childrenOf.get(pid) || []
}
const rootCats = computed(() => catIdx.value.roots)
const pinnedRootCats = computed(() => rootCats.value.filter(c => c.pinned))
const unpinnedRootCats = computed(() => rootCats.value.filter(c => !c.pinned))
/** R61-4：全部后代 id（深层递归）——4 级树过滤/计数/防环共用；R70 带 visited；R71 走索引缓存 */
function descendantIds(catId: string): string[] {
  return catIdx.value.descendants(catId)
}
function childIds(catId: string): string[] {
  return descendantIds(catId)
}
/** 家族 id（自己 + 全部后代分类）——过滤与计数共用口径（R61-4 深化至 4 级） */
function familyIds(catId: string): string[] {
  return catIdx.value.family(catId)
}
/** 家族聚合卡数：索引查表 + 分桶计数 O(家族规模)（此前是 familyIds + 全量 filter + includes） */
function catAggCount(catId: string): number {
  let n = 0
  for (const id of familyIds(catId)) n += (resBucket.value.get(id) || []).length
  return n
}
/** 分类选择器的层级化选项（下拉/弹窗共用）——R61-4：递归支持 4 级 */
function treeCatOptions(cats: Category[]): { id: string; label: string }[] {
  // R71：本函数被多个 computed 调用（移动分类下拉等），改为一次建索引后查表
  const idx = buildCatIndex(cats)
  const out: { id: string; label: string }[] = []
  const seenOpt = new Set<string>()  // R70：防环
  const push = (c: Category, depth: number) => {
    if (seenOpt.has(c.id)) return
    seenOpt.add(c.id)
    out.push({ id: c.id, label: '└'.repeat(depth) + (depth ? ' ' : '') + c.name })
    for (const ch of idx.childrenOf.get(c.id) || []) push(ch, depth + 1)
  }
  for (const r0 of idx.roots) push(r0, 0)
  return out
}
/** 左栏渲染的扁平序列（分区标签 + 缩进标记）——R61-4：递归支持 4 级 */
// R76（R3）：count 一律取 directCount（与看板列、卡片/列表分组同口径）；
// childCount + aggCount 只用于 title 补充说明，不再作为显示值，避免同屏出现两个数
interface SidebarCat { cat: Category; depth: number; sectionLabel: string; hasChildren: boolean; childCount: number; aggCount: number; directCount: number }
// R48-V2：树状目录展开/折叠（默认全局展开；折叠状态仅会话内记忆）
const collapsedCats = ref<Set<string>>(new Set())
function toggleCatCollapse(id: string) {
  const s = new Set(collapsedCats.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  collapsedCats.value = s
}
/** 一键收纳为策展台根部：所有含子分类的父级全部折叠 */
function collapseAllCats() {
  collapsedCats.value = new Set(wsCats.value.filter(c => catIdx.value.hasChildren(c.id)).map(c => c.id))
}
function expandAllCats() { collapsedCats.value = new Set() }
function selectSidebarCat(sc: SidebarCat) {
  activeCategory.value = sc.cat.id
  // 选中深层分类时自动展开其全部祖先，避免「选中被藏住」
  let pid = sc.cat.parentId
  const guard = new Set<string>([sc.cat.id])  // R70：防环
  while (pid && !guard.has(pid) && collapsedCats.value.has(pid)) {
    guard.add(pid)
    const s = new Set(collapsedCats.value); s.delete(pid); collapsedCats.value = s
    pid = wsCats.value.find(c => c.id === pid)?.parentId
  }
}
const sidebarCats = computed<SidebarCat[]>(() => {
  const out: SidebarCat[] = []
  const seenSide = new Set<string>()  // R70：防环
  const pushTree = (c: Category, depth: number, sectionLabel: string) => {
    if (seenSide.has(c.id)) return
    seenSide.add(c.id)
    out.push({
      cat: c, depth, sectionLabel,
      hasChildren: catIdx.value.hasChildren(c.id),
      childCount: childCatsOf(c.id).length,
      aggCount: catAggCount(c.id),
      directCount: (resBucket.value.get(c.id) || []).length
    })
    if (depth > 0 && collapsedCats.value.has(c.id)) return
    if (!collapsedCats.value.has(c.id)) for (const k of childCatsOf(c.id)) pushTree(k, depth + 1, '')
  }
  pinnedRootCats.value.forEach((c, i) => {
    pushTree(c, 0, i === 0 ? '📌 置顶' : '')
  })
  unpinnedRootCats.value.forEach((c, i) => {
    pushTree(c, 0, (i === 0 && pinnedRootCats.value.length) ? '📁 分类' : '')
  })
  return out
})
function normalizeCatOrders(parentId: string) {
  wsCats.value
    .filter(c => (c.parentId || '') === parentId)
    .sort((a, b) => a.order - b.order)
    .forEach((c, i) => { c.order = i })
}

// ===== 分类新建/重命名（第八轮：应用内弹窗，替代原生 prompt） =====
const catModal = ref<{ open: boolean; mode: 'create' | 'rename'; name: string; parentId: string; editId: string }>(
  { open: false, mode: 'create', name: '', parentId: '', editId: '' })
function openCreateCat(parentId = '') {
  catModal.value = { open: true, mode: 'create', name: '', parentId, editId: '' }
}
function openRenameCat(cat: Category) {
  catModal.value = { open: true, mode: 'rename', name: cat.name, parentId: '', editId: cat.id }
}
/** 第卅三轮 REQ-021：同名即时校验（作用域=当前策展台全分类树，重命名排除自身） */
const catNameDup = computed(() => {
  const m = catModal.value
  const name = m.name.trim()
  if (!name) return false
  return wsCats.value.some(c => c.name === name && c.id !== m.editId)
})
function confirmCatModal() {
  const m = catModal.value
  const name = m.name.trim()
  if (!name) { showToast('请输入分类名称'); return }
  if (catNameDup.value) { showToast('该策展台已存在同名分类，请更换名称'); return }
  if (m.mode === 'create') {
    // R61-4：4 级上限校验
    if (m.parentId) {
      const parent = wsCats.value.find(c => c.id === m.parentId)
      // R70：改用 pyDepthOf（带 visited 防环）——内联的 while 上行走链在环数据下会死转
      if (parent && pyDepthOf(parent) + 2 > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——该分类已处于最深层`); return }
    }
    const siblings = wsCats.value.filter(c => (c.parentId || '') === m.parentId)
    const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: siblings.length, parentId: m.parentId || undefined }
    d.value.categories.push(cat)
    activeCategory.value = cat.id
    showToast('✓ 分类已创建')
  } else {
    const cat = wsCats.value.find(c => c.id === m.editId)
    if (cat) cat.name = name
    showToast('✓ 分类已重命名')
  }
  store.persist()
  catModal.value.open = false
}
async function deleteCategory(cat: Category) {
  const kids = childCatsOf(cat.id)
  const n = catAggCount(cat.id)
  const msg = kids.length
    ? `确定删除「${cat.name}」？\n其下 ${kids.length} 个子分类将升级为一级分类，资源卡不受影响。`
    : (n ? `确定删除「${cat.name}」？\n其中 ${n} 张资源卡将移入「待分类」，可在回收站查看。` : `确定删除「${cat.name}」？`)
  if (!(await useConfirm({ title: '删除分类', message: msg, confirmText: '确认删除' }))) return
  kids.forEach(k => { k.parentId = undefined })
  if (kids.length) {
    const target = kids[0]!.id
    allResources.value.forEach(r => { if (r.categoryId === cat.id) r.categoryId = target })
  } else {
    allResources.value.forEach(r => { if (r.categoryId === cat.id) r.categoryId = '' })
  }
  d.value.categories = d.value.categories.filter(c => c.id !== cat.id)
  // R61：清理以该分类为落点的镜像记录（落点回落该台待分类；源卡零影响）
  for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetWsId === workspaceId.value && p.targetCatId === cat.id) p.targetCatId = undefined
  // R53-A3：级联清理该源分类的策展镜像分类（旧方向遗留逻辑，R61 后 hub 分类无 curFrom，保留兜底）
  const mirrorCats = d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID && c.curFrom?.catId === cat.id)
  for (const mc of mirrorCats) {
    const midIds = new Set<string>([mc.id])
    for (const r of d.value.resources) if (r.workspaceId === CURATION_WS_ID && midIds.has(r.categoryId || '')) r.categoryId = ''
    for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetCatId && midIds.has(p.targetCatId)) p.targetCatId = undefined
    for (const c of d.value.categories) if (c.parentId && midIds.has(c.parentId)) c.parentId = undefined
    d.value.categories = d.value.categories.filter(c => c.id !== mc.id)
  }
  if (activeCategory.value === cat.id) activeCategory.value = 'all'
  normalizeCatOrders('')
  store.persist()
  showToast('已删除分类')
}
function toggleCatPin(cat: Category) {
  cat.pinned = !cat.pinned
  store.persist()
  showToast(cat.pinned ? '📌 分类已置顶' : '已取消置顶')
}
/** 第卅三轮 REQ-021：存量重复分类合并工具（同一策展台内同名分组，资源并入首个，子分类升级一级） */
async function mergeDupCats() {
  const groups = new Map<string, Category[]>()
  for (const c of wsCats.value) {
    const key = c.name.trim()
    if (!key) continue
    const arr = groups.get(key) || []
    arr.push(c)
    groups.set(key, arr)
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1)
  if (!dupGroups.length) { showToast('当前策展台无重复分类 ✨'); return }
  const totalDup = dupGroups.reduce((s, g) => s + g.length - 1, 0)
  if (!(await useConfirm({
    title: '合并重复分类',
    message: `发现 ${dupGroups.length} 组、共 ${totalDup} 个重复分类。\n资源卡将合并到每组第一个分类；重复分类的子分类将升级为一级分类。\n继续合并？`,
    confirmText: '合并'
  }))) return
  let merged = 0
  for (const g of dupGroups) {
    const keep = g[0]!
    for (const dup of g.slice(1)) {
      allResources.value.forEach(r => { if (r.categoryId === dup.id) r.categoryId = keep.id })
      childCatsOf(dup.id).forEach(k => { k.parentId = undefined })
      d.value.categories = d.value.categories.filter(c => c.id !== dup.id)
      merged++
    }
  }
  normalizeCatOrders('')
  store.persist()
  showToast(`✓ 已合并 ${merged} 个重复分类`)
}

// ===== 分类拖拽（第八轮）：同级排序 / 挂子级 / 升一级，防循环，2 级上限 =====
// 第廿九轮：侧栏分类行同时是资源卡归属落点——按拖起对象分流（卡片→改归属；分类→排序/挂子级）
let dragCatId: string | null = null
const catDropTarget = ref('')
const catDropMode = ref<'' | 'child' | 'before' | 'after'>('')
/** 卡片拖拽时的目标分类高亮（'分类id' 或 'uncat'） */
const cardDropTarget = ref('')
function onUncatDragOver(e: DragEvent) {
  if (!draggedItem) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  cardDropTarget.value = 'uncat'
}
function onUncatDrop(e: DragEvent) {
  e.preventDefault(); e.stopPropagation()
  cardDropTarget.value = ''
  if (!draggedItem) return
  onDropToCategory(e, '')
}
function clearCardDropTarget() { cardDropTarget.value = '' }
onMounted(() => { applyWsView(); window.addEventListener('dragend', clearCardDropTarget); document.addEventListener('click', closeSettingsMenu); document.addEventListener('click', closeFilterPop); window.addEventListener('resize', pyLinksThrottled); nextTick(drawPyLinks) })
// R88（W3）：筛选气泡与 ⚙ 菜单同为"点外部关闭"的浮层，卸载时一并摘掉监听
onUnmounted(() => { window.removeEventListener('dragend', clearCardDropTarget); window.removeEventListener('resize', pyLinksThrottled); document.removeEventListener('click', closeSettingsMenu); document.removeEventListener('click', closeFilterPop) })
// R65-F7：resize 重绘节流（150ms 尾随，防拖拽窗口时高频全量重算）
let pyLinksTimer: ReturnType<typeof setTimeout> | null = null
function pyLinksThrottled() {
  if (pyLinksTimer) return
  pyLinksTimer = setTimeout(() => { pyLinksTimer = null; drawPyLinks() }, 150)
}
function onCatDragStart(e: DragEvent, cat: Category) {
  dragCatId = cat.id
  e.dataTransfer!.effectAllowed = 'move'
}
function onCatDragEnd() {
  dragCatId = null; catDropTarget.value = ''; catDropMode.value = ''
}
function onCatDragOver(e: DragEvent, cat: Category) {
  // 卡片拖入：整行高亮为归属落点（与分类拖拽的 before/after/child 指示区分）
  if (draggedItem && !dragCatId) {
    cardDropTarget.value = cat.id
    return
  }
  if (!dragCatId || dragCatId === cat.id) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const h = rect.height
  const dragged = wsCats.value.find(c => c.id === dragCatId)
  // 中带 + 目标是根分类 + 拖动的也是根分类 → 成为子分类；否则上下沿 = 同级排序
  if (y > h * 0.3 && y < h * 0.7 && dragged && !dragged.parentId && !cat.parentId) {
    catDropMode.value = 'child'
  } else {
    catDropMode.value = y < h / 2 ? 'before' : 'after'
  }
  catDropTarget.value = cat.id
}
function onCatDrop(e: DragEvent, cat: Category) {
  e.preventDefault(); e.stopPropagation()
  // 卡片落分类 = 改归属（落父分类=归入本级；落子分类=归入该子分类；置顶保留）
  if (draggedItem && !dragCatId) {
    cardDropTarget.value = ''
    onDropToCategory(e, cat.id)
    return
  }
  const mode = catDropMode.value
  const targetId = catDropTarget.value
  const draggedId = dragCatId
  onCatDragEnd()
  if (!draggedId || draggedId === targetId) return
  const dragged = wsCats.value.find(c => c.id === draggedId)
  const target = wsCats.value.find(c => c.id === targetId)
  if (!dragged || !target) return
  if (childIds(dragged.id).includes(target.id)) { showToast('不能移动到自己的子分类'); return }
  // R61-4：层级工具（4 级上限）
  // R70：层级/高度一律走带 visited 的实现（pyDepthOf 防环上行、pyHeightOf 防环下降）
  const levelOf = (c: Category): number => pyDepthOf(c) + 1
  const heightOf = (c: Category): number => pyHeightOf(c)
  if (mode === 'child') {
    if (levelOf(target) + heightOf(dragged) > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——「${dragged.name}」（含 ${heightOf(dragged) - 1} 层子级）放入后将超出层级上限`); return }
    dragged.parentId = target.id
    dragged.pinned = undefined
    dragged.order = childCatsOf(target.id).length
    normalizeCatOrders('')
    showToast(`✓ 「${dragged.name}」已归入「${target.name}」`)
  } else {
    const pid = target.parentId || ''
    if (dragged.parentId !== (pid || undefined)) dragged.parentId = pid || undefined
    if (pid) dragged.pinned = undefined
    const sibs = wsCats.value
      .filter(c => (c.parentId || '') === pid && c.id !== draggedId)
      .sort((a, b) => a.order - b.order)
    const ti = sibs.findIndex(c => c.id === targetId)
    sibs.splice(mode === 'before' ? ti : ti + 1, 0, dragged)
    sibs.forEach((c, i) => { c.order = i })
  }
  store.persist()
}
/** 拖到「升为一级」投放区 = 取消子分类归属（先取引用再清理状态） */
function onCatRootDrop(e: DragEvent) {
  e.preventDefault()
  const draggedId = dragCatId
  onCatDragEnd()
  cardDropTarget.value = ''
  if (!draggedId) return
  const dragged = wsCats.value.find(c => c.id === draggedId)
  if (!dragged || !dragged.parentId) return
  dragged.parentId = undefined
  dragged.order = rootCats.value.length
  normalizeCatOrders('')
  store.persist()
  showToast(`✓ 「${dragged.name}」已升为一级分类`)
}

// ===== R102（纯拆分第三批）：卡片整理动作域（批量选择/批量移动/单卡移动/挂载）拆入 useWorkspaceBatch =====
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——三视图模板（勾选框/batch-bar/移动与挂载弹窗）零改动。
// ★ 单向挂载红线随迁：挂载只写 task.mountedResourceIds，资源卡零新增反向字段，被谁挂着一律反查 d.tasks。
const {
  batchMode, selectedIds, toggleBatchMode, toggleSelect, selectAllVisible, selectedCards, batchOpen, batchDelete,
  moveModalOpen, moveWsId, moveCatId, moveWorkspaces, moveCatOptions, openBatchMove, confirmBatchMove,
  moveOneOpen, moveOneCatId, moveOneOptions, openMoveOne, confirmMoveOne,
  mountOneOpen, mountSearch, mountedTaskCount, isMountedOn, mountTaskOptions, mountProjectName, openMountOne, toggleMountTask, closeMountOne,
  moveOneTarget, mountTarget,
} = useWorkspaceBatch({ d, persist: () => store.persist(), workspaceId, wsCats, allResources, allProjects, sortedResources, openResourceLink, treeCatOptions })

// ===== 通用输入弹窗（第八轮：策展台重命名/描述，替代原生 prompt） =====
const inputModal = ref<{ open: boolean; title: string; value: string; cb: ((v: string) => void) | null }>(
  { open: false, title: '', value: '', cb: null })
function openInputModal(title: string, value: string, cb: (v: string) => void) {
  inputModal.value = { open: true, title, value, cb }
}
function confirmInputModal() {
  const v = inputModal.value.value.trim()
  if (v && inputModal.value.cb) inputModal.value.cb(v)
  inputModal.value.open = false
}

// ===== R62-5/6/8：金字塔视图逻辑 =====
interface PyNode { cat: Category; depth: number; cards: ResourceCard[] }
/** 节点深度（根=0）——R70：带 visited 显式防环（此前仅靠「parentId 单向链」的假设） */
function pyDepthOf(c: Category): number {
  // R71：改走索引缓存（此前每次沿父链全表 find；本函数在 pyramidLevels 里对每个分类各调一次）
  return catIdx.value.depthOf(c.id) - 1  // 索引 depthOf 以根=1 计，本函数历史口径根=0
}
/** 金字塔层级数据：按分类深度铺开（深度0=L2）；卡片=直属（排除主题卡，主题卡是 L1 根）
 *  R65-F3：各层节点按树先序（DFS）排序——同父节点严格紧邻，兄弟顺序跟随父节点位置 */
const pyramidLevels = computed<PyNode[][]>(() => {
  const byDepth = new Map<number, PyNode[]>()
  for (const c of wsCats.value) {
    const depth = pyDepthOf(c)
    if (!byDepth.has(depth)) byDepth.set(depth, [])
    byDepth.get(depth)!.push({ cat: c, depth, cards: [] })
  }
  // R65-F3：树先序遍历序号（同父紧邻的依据）
  const dfsOrder = new Map<string, number>()
  let seq = 0
  const seenDfs = new Set<string>()  // R70：防环
  const walk = (pid: string) => {
    for (const c of (pid ? (catIdx.value.childrenOf.get(pid) || []) : catIdx.value.roots)) {
      if (seenDfs.has(c.id)) continue
      seenDfs.add(c.id)
      dfsOrder.set(c.id, seq++)
      walk(c.id)
    }
  }
  walk('')
  for (const arr of byDepth.values()) arr.sort((a, b) => (dfsOrder.get(a.cat.id) ?? 0) - (dfsOrder.get(b.cat.id) ?? 0))
  // R71：先建「分类 id → 节点」表，卡片一次遍历即可归位（此前每张卡都要逐层 arr.find，O(卡数×分类数)）
  const nodeByCat = new Map<string, PyNode>()
  for (const arr of byDepth.values()) for (const n of arr) nodeByCat.set(n.cat.id, n)
  for (const r of allResources.value) {
    if (r.isThesis) continue
    nodeByCat.get(r.categoryId)?.cards.push(r)
  }
  return [...byDepth.keys()].sort((a, b) => a - b).map(k => byDepth.get(k)!)
})
/** R66-F5：居中树布局——叶子节点各占 1 列（树先序），父节点跨「其子组全部列」：
 *  父模块横向恒等于子组横向并居中悬于其上；子组永不跨入其他父节点的横向空间（列独占）；
 *  宽度自适应（列宽 minmax(170px,250px)），整体不占满横向空间。 */
const pyLayout = computed<{ cols: number; cells: { cat: Category; depth: number; colStart: number; colSpan: number; cards: ResourceCard[] }[] }>(() => {
  // R98（W7）：层级折叠——超过 maxDepth 的节点不再下钻（按叶子布点）。在布局层收口而非渲染层
  // v-if 隐藏：父节点的 colSpan 只跨**可见**子组的列，折叠后居中树几何仍然自洽（不会留下空跨列）。
  const maxDepth = pyFold.value === 'l2' ? 0 : pyFold.value === 'l3' ? 1 : Number.POSITIVE_INFINITY
  const cardsBy = new Map<string, ResourceCard[]>()
  for (const r of allResources.value) {
    if (r.isThesis) continue
    const arr = cardsBy.get(r.categoryId) || []
    arr.push(r)
    cardsBy.set(r.categoryId, arr)
  }
  const cells: { cat: Category; depth: number; colStart: number; colSpan: number; cards: ResourceCard[] }[] = []
  let leafSeq = 0
  /** R70：visited——环状树不得让后序布点无限递归 */
  const placed = new Set<string>()
  /** 后序布点：叶子占新列；父节点跨其子组全部列（列独占，兄弟子树互不侵入） */
  const placeCat = (cat: Category, depth: number): { start: number; span: number } => {
    placed.add(cat.id)
    // R98（W7）：到达折叠深度 → 按叶子收口（子树不入列，父节点自身直属卡照常呈现）
    const kids = depth >= maxDepth ? [] : (catIdx.value.childrenOf.get(cat.id) || []).filter(x => !placed.has(x.id))
    if (!kids.length) {
      const col = leafSeq++
      cells.push({ cat, depth, colStart: col, colSpan: 1, cards: cardsBy.get(cat.id) || [] })
      return { start: col, span: 1 }
    }
    let start = Infinity
    let end = -1
    for (const k of kids) {
      const sub = placeCat(k, depth + 1)
      start = Math.min(start, sub.start)
      end = Math.max(end, sub.start + sub.span - 1)
    }
    const span = end - start + 1
    cells.push({ cat, depth, colStart: start, colSpan: span, cards: cardsBy.get(cat.id) || [] })
    return { start, span }
  }
  for (const root of catIdx.value.roots) placeCat(root, 0)
  // R70：环内节点无根可达，此前被静默忽略——分类与其卡会从金字塔里凭空消失（数据静默丢失）。
  // 补一轮纳入布局，保证「树里有多少节点，金字塔里就渲染多少节点」。
  for (const c of wsCats.value) { if (!placed.has(c.id)) placeCat(c, 0) }
  return { cols: Math.max(leafSeq, 1), cells }
})
/** 同级顺序调整（⟨ 前移 / ⟩ 后移） */
function moveCatSibling(cat: Category, dir: -1 | 1) {
  const pid = cat.parentId || ''
  const sibs = wsCats.value.filter(c => (c.parentId || '') === pid).sort((a, b) => a.order - b.order)
  const i = sibs.findIndex(c => c.id === cat.id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sibs.length) return
  const tmp = sibs[i]!; sibs[i] = sibs[j]!; sibs[j] = tmp
  sibs.forEach((c, k) => { c.order = k })
  store.persist()
}

// ===== R65-F3：节点关联资源卡（资源台全量卡选择器 → 镜像到节点）=====
const linkCardsModal = ref<{ catId: string; catName: string; picked: Set<string> } | null>(null)
const linkCardsQ = ref('')
function openLinkCards(cat: Category) {
  linkCardsQ.value = ''
  linkCardsModal.value = { catId: cat.id, catName: cat.name, picked: new Set() }
}
function toggleLinkPick(id: string) {
  const m = linkCardsModal.value
  if (!m) return
  if (m.picked.has(id)) m.picked.delete(id)
  else m.picked.add(id)
}
/** 候选 = 资源台全部资源卡（关键词过滤）；已镜像到本台的标记「已在该台」不可重选 */
const linkCandidates = computed<{ r: ResourceCard; mirrored: boolean }[]>(() => {
  if (!linkCardsModal.value) return []
  const q = linkCardsQ.value.trim().toLowerCase()
  const mirroredSet = new Set((d.value.curationProjections || [])
    .filter(p => p.kind === 'card' && p.targetWsId === workspaceId.value).map(p => p.cardId))
  return d.value.resources
    .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .filter(r => !q || (r.title + ' ' + (r.link || '')).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
    .map(r => ({ r, mirrored: mirroredSet.has(r.id) }))
})
function confirmLinkCards() {
  const m = linkCardsModal.value
  if (!m) return
  const targets = [...m.picked].filter(id => !linkCandidates.value.find(c => c.r.id === id)?.mirrored)
  if (!targets.length) { showToast('未选择可镜像的资源卡'); return }
  let ok = 0
  for (const id of targets) {
    if (projectCardToBoard(d.value, id, workspaceId.value, m.catId)) ok++
  }
  store.persist()
  linkCardsModal.value = null
  showToast(ok ? `📡 已镜像 ${ok} 张资源卡到「${m.catName}」` : 'ℹ 所选卡片均已在该台镜像中')
}
/** 层级上限工具（复用 R61-4 口径：分类最多 4 级） */
function pyLevelOf(c: Category): number { return pyDepthOf(c) + 1 }

// ===== R64-F11：金字塔 SVG 结构连线（根→L2、父节点→子节点，贝塞尔细线） =====
const pyWrapRef = ref<HTMLElement | null>(null)
const pyLinkPaths = ref<string[]>([])
function drawPyLinks() {
  const wrap = pyWrapRef.value
  if (!wrap || viewMode.value !== 'pyramid') { pyLinkPaths.value = []; return }
  // R66-F5：横向滚动时连线画布覆盖全部滚动区（CSS 不再定宽，由 JS 设定）
  const svgEl = wrap.querySelector('svg.py-links-svg')
  if (svgEl) { svgEl.setAttribute('width', String(wrap.scrollWidth)); svgEl.setAttribute('height', String(wrap.scrollHeight)) }
  const wr = wrap.getBoundingClientRect()
  const anchor = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left - wr.left + r.width / 2, top: r.top - wr.top, bottom: r.bottom - wr.top }
  }
  const link = (a: { x: number; bottom: number }, b: { x: number; top: number }) => {
    // R66-F5：横平竖直直角折线（父底中点 ↓ 横移 ↑/↓ 子顶中点），替代贝塞尔曲线
    const mid = (a.bottom + b.top) / 2
    return `M ${a.x} ${a.bottom} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.top}`
  }
  const lines: string[] = []
  const allNodes = [...wrap.querySelectorAll('[data-pyid]')] as HTMLElement[]
  const byId = new Map(allNodes.map(el => [el.dataset.pyid!, el]))
  const rootEl = wrap.querySelector('.py-root-card, .py-root-empty')
  if (rootEl) {
    const rc = anchor(rootEl)
    for (const n of allNodes.filter(el => {
      const cat = wsCats.value.find(c => c.id === el.dataset.pyid)
      return cat && !cat.parentId
    })) {
      lines.push(link(rc, anchor(n)))
    }
  }
  for (const c of wsCats.value) {
    if (!c.parentId) continue
    const pe = byId.get(c.parentId); const ce = byId.get(c.id)
    if (!pe || !ce) continue
    lines.push(link(anchor(pe), anchor(ce)))
  }
  pyLinkPaths.value = lines
}
watch([pyLayout, viewMode, thesisCard], () => nextTick(drawPyLinks))
function pyHeightOf(c: Category, seen = new Set<string>()): number {
  // R70：带 visited——防环
  if (seen.has(c.id)) return 1
  seen.add(c.id)
  const ch = catIdx.value.childrenOf.get(c.id) || []
  return ch.length ? Math.max(...ch.map(x => pyHeightOf(x, seen))) + 1 : 1
}
// 节点拖拽状态（卡片走 draggedItem；分类走 dragCatId）
const pyDropTarget = ref('')
const pyDropMode = ref<'' | 'child' | 'before' | 'after'>('')
const pyRootDrop = ref(false)
function onPyDragOver(e: DragEvent, cat: Category) {
  if (draggedItem && !dragCatId) {
    // 卡片拖入：整节点高亮为归属落点
    pyDropTarget.value = cat.id; pyDropMode.value = 'child'
    return
  }
  if (!dragCatId || dragCatId === cat.id) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  pyDropMode.value = y > rect.height * 0.75 ? 'before' : 'child'
  pyDropTarget.value = cat.id
}
function onPyDrop(e: DragEvent, cat: Category) {
  e.preventDefault(); e.stopPropagation()
  const targetId = pyDropTarget.value; const mode = pyDropMode.value
  pyDropTarget.value = ''; pyDropMode.value = ''
  // ① 卡片落节点 = 改归属（canMountInNode 校验：金字塔节点只挂资源卡）
  if (draggedItem && !dragCatId) {
    if (!canMountInNode(draggedItem)) { showToast('⚠ 金字塔节点只允许挂资源卡'); return }
    if (isMirrorView(draggedItem)) { moveMirrorTo(draggedItem, cat.id) }
    else {
      draggedItem.categoryId = cat.id
      draggedItem.updatedAt = Date.now()
      store.persist()
      showToast(`✓ 已挂入「${cat.name}」`)
    }
    draggedItem = null
    clearCardDropTarget()
    return
  }
  // ② 分类落节点：上沿=同级排序，其余=挂子级（成环 + 层级校验）
  const draggedId = dragCatId
  onCatDragEnd()
  if (!draggedId || draggedId === targetId) return
  const dragged = wsCats.value.find(c => c.id === draggedId)
  const target = wsCats.value.find(c => c.id === targetId)
  if (!dragged || !target) return
  if (childIds(dragged.id).includes(target.id)) { showToast('不能移动到自己的子分类'); return }
  if (mode === 'before') {
    moveCatSibling(target, 1) // 空出目标位
    dragged.parentId = target.parentId || undefined
    const sibs = wsCats.value.filter(c => (c.parentId || '') === (target.parentId || '') && c.id !== draggedId).sort((a, b) => a.order - b.order)
    const ti = sibs.findIndex(c => c.id === targetId)
    sibs.splice(Math.max(0, ti), 0, dragged)
    sibs.forEach((c, i) => { c.order = i })
    store.persist()
    return
  }
  if (pyLevelOf(target) + pyHeightOf(dragged) > 4) {
    showToast(`ℹ 最多 4 级——「${dragged.name}」（含 ${pyHeightOf(dragged) - 1} 层子级）放入后将超出层级上限`)
    return
  }
  dragged.parentId = target.id
  dragged.pinned = undefined
  dragged.order = wsCats.value.filter(c => c.parentId === target.id).length - 1
  normalizeCatOrders('')
  store.persist()
  showToast(`✓ 「${dragged.name}」已挂入「${target.name}」`)
}
function onPyRootDragOver() {
  if (!dragCatId) return
  pyRootDrop.value = true
}
/** 根区落点：分类升为一级；卡片拖到根 = 提示（主题卡唯一，不收卡） */
function onPyRootDrop(e: DragEvent) {
  e.preventDefault(); e.stopPropagation()
  pyRootDrop.value = false
  if (draggedItem && !dragCatId) { showToast('🏛 中心论点位不收卡——请拖到具体节点'); draggedItem = null; return }
  const draggedId = dragCatId
  onCatDragEnd()
  if (!draggedId) return
  const dragged = wsCats.value.find(c => c.id === draggedId)
  if (!dragged || !dragged.parentId) return
  dragged.parentId = undefined
  dragged.order = rootCats.value.length
  normalizeCatOrders('')
  store.persist()
  showToast(`✓ 「${dragged.name}」已升为一级节点`)
}
/** 金字塔节点点击定位：与左侧树联动（选中 + 闪节点） */
function selectPyNode(cat: Category) {
  activeCategory.value = cat.id
  catFlashId.value = cat.id
  setTimeout(() => { if (catFlashId.value === cat.id) catFlashId.value = null }, 1600)
}

// ===== R62-6：节点菜单（⋯ 6 项） =====
const nodeMenu = ref<{ open: boolean; x: number; y: number; catId: string }>({ open: false, x: 0, y: 0, catId: '' })
function openNodeMenu(e: MouseEvent, cat: Category) {
  nodeMenu.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 240), catId: cat.id }
}
function nmCat(): Category | null { return wsCats.value.find(c => c.id === nodeMenu.value.catId) || null }
function nmCreateChild() {
  const cat = nmCat(); nodeMenu.value.open = false
  if (cat) openCreateCat(cat.id)
}
function nmCreateSibling() {
  const cat = nmCat(); nodeMenu.value.open = false
  if (cat) openCreateCat(cat.parentId || '')
}
function nmMirrorCat() {
  nodeMenu.value.open = false
  mirrorCatModal.value = { open: true, catId: '' }
}
function nmPack() {
  const cat = nmCat(); nodeMenu.value.open = false
  packIntoNode(cat || undefined)
}
function nmRename() {
  const cat = nmCat(); nodeMenu.value.open = false
  if (cat) openRenameCat(cat)
}
async function nmDelete() {
  const cat = nmCat(); nodeMenu.value.open = false
  if (cat) await deleteCategory(cat)
}
/** R62-6：打包所选卡片成节点（batchBar / 节点菜单共用；入参节点 = 挂其下，否则建一级） */
function packIntoNode(parentCat?: Category) {
  const natives = selectedCards().filter(r => !isMirrorView(r))
  if (!selectedIds.value.size) { showToast('请先开启「☑ 批量管理」选择卡片'); return }
  if (!natives.length) { showToast('📡 所选均为镜像卡，打包请在资源台操作'); return }
  const mirrorNote = selectedIds.value.size - natives.length
  openInputModal(parentCat ? `🗂 新节点（挂「${parentCat.name}」下）` : '🗂 新节点（一级）', '', (name) => {
    if (parentCat && pyLevelOf(parentCat) + 1 > 4) { showToast('ℹ 最多 4 级——该节点已处于最深层'); return }
    const siblings = wsCats.value.filter(c => (c.parentId || '') === (parentCat?.id || ''))
    const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: siblings.length, parentId: parentCat?.id || undefined }
    d.value.categories.push(cat)
    natives.forEach(r => { r.categoryId = cat.id; r.updatedAt = Date.now() })
    store.persist()
    selectedIds.value.clear()
    showToast(`✓ 已打包 ${natives.length} 张卡入「${name}」${mirrorNote ? `（${mirrorNote} 张镜像卡未移动）` : ''}`)
  })
}

// ===== R103（纯拆分第四批）：镜像域拆入 useWorkspaceMirror =====
// 引用侧（移出镜像/落点更新/定位源卡）+ 推送侧（单卡 📡/分类 📤）+ 拉取侧（分类镜像到本台）
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
const {
  isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,
  boards, mirrorPushModal, openMirrorCard, openMirrorCat, mirrorPushTargetCats, confirmMirrorPush,
  mirrorCatModal, hubCatOptions, confirmMirrorCat
} = useWorkspaceMirror({ d, workspaceId, categories, router, treeCatOptions, persist: () => store.persist() })

// ===== R100（纯拆分第一批）：导入三链路（数据包 / 书签 / 本地文件）拆入 useWorkspaceImport =====
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——模板与既有断言的入口面不变（04-49 任务书）。
const {
  importModalOpen, boardImportInput,
  bookmarkInput, fileImportInput, bookmarkModalOpen, bkFolders,
  allBkChecked, bkTotalCount,
  handleBoardImport, handleBookmarkImport, confirmBookmarkImport, toggleAllBk,
  fileImport, handleFileImport, makeHubResource
} = useWorkspaceImport({ d, workspaceId, newCardCatId, persist: () => store.persist() })

// ===== 设置菜单 =====
const settingsMenuOpen = ref(false)
function closeSettingsMenu() { settingsMenuOpen.value = false }
/** R88（W3）：⚙ 与「筛选」气泡互斥——两个都是点击外部关闭的浮层，同时开只会互相遮挡 */
function toggleSettingsMenu() {
  const next = !settingsMenuOpen.value
  filterPopOpen.value = false
  settingsMenuOpen.value = next
}
/** R88（W6）：导入弹窗（自工具条收进 ⚙ 后，入口与弹窗标题同为 mode-aware） */
function openImport() {
  settingsMenuOpen.value = false
  importModalOpen.value = true
}

// ===== 设置菜单关闭 + 采集跳转高亮 =====
const highlightId = ref<string | null>(null)
// 第廿九轮：document click / window dragend 监听统一在上方 onMounted 注册

watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  highlightId.value = hl
  activeCategory.value = 'all'
  searchQuery.value = ''
  debouncedQuery.value = ''
  viewMode.value = 'card'
  nextTick(() => {
    setTimeout(() => {
      document.querySelector(`[data-rid="${hl}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
    }, 300)
  })
  router.replace({ path: route.path })
}, { immediate: true })

// ===== R49-G3：全局检索分类定位（/workspace/:id?cat=xx）=====
// 有卡 → 选中分类 + 高亮该分类下第一张卡；无卡 → 展开 + 高亮分类行本身
const catFlashId = ref<string | null>(null)
watch(() => route.query.cat, (cat) => {
  if (!cat || typeof cat !== 'string' || typeof route.query.hl === 'string') return
  const c = categories.value.find(x => x.id === cat)
  if (!c) return
  activeCategory.value = cat
  // 展开全部祖先（折叠态下定位会落空）
  let p = c.parentId ? categories.value.find(x => x.id === c.parentId) : null
  while (p) { collapsedCats.value.delete(p.id); p = p.parentId ? categories.value.find(x => x.id === p!.parentId) : null }
  const family = new Set(familyIds(cat))
  const first = allResources.value.find(r => family.has(r.categoryId || ''))
  nextTick(() => {
    setTimeout(() => {
      if (first) {
        highlightId.value = first.id
        document.querySelector(`[data-rid="${first.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => { highlightId.value = null }, 2000)
      } else {
        catFlashId.value = cat
        document.querySelector(`[data-catid="${cat}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => { catFlashId.value = null }, 2000)
      }
    }, 300)
  })
  router.replace({ path: route.path })
}, { immediate: true })

// ===== Hero 编辑 =====
/** B32：名称展示统一剥离 icon 前缀（数据约定：name 首段为图标） */
const wsDisplayName = computed(() => (workspace.value?.name || '').replace(/^[^\s]+\s/, ''))
function onNameBlur(e: FocusEvent) {
  const name = (e.target as HTMLElement).textContent?.trim()
  if (name && workspace.value) {
    // 保持「图标前缀 + 名称」的数据约定，同步回写
    workspace.value.name = (workspace.value.icon ? workspace.value.icon + ' ' : '') + name
    store.persist()
  }
}
function onNameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }

// ===== B32：图标管理 =====
const WS_ICONS = ['💼', '🛠', '📚', '🎨', '🔬', '🌱', '✍️', '🎯', '🏠', '❤️', '⭐', '🔥', '💡', '📈', '🧠', '🚀', '🎵', '🏀', '🍎', '🌿', '🐘', '🦊', '🐳', '📌']
const iconPickOpen = ref(false)
const iconCustom = ref('')
const iconPickPos = ref({ left: 0, top: 0 })
function toggleIconPick(e: MouseEvent) {
  iconPickOpen.value = !iconPickOpen.value
  if (iconPickOpen.value) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    iconPickPos.value = {
      left: Math.min(r.left, window.innerWidth - 290),
      top: Math.min(r.bottom + 8, window.innerHeight - 320)
    }
  }
}
function setWsIcon(icon: string) {
  if (!workspace.value) return
  if (icon && !/^\p{Extended_Pictographic}$/u.test(icon)) { showToast('请输入单个 emoji 图标'); return }
  const raw = workspace.value.name.replace(/^[^\s]+\s/, '')
  workspace.value.icon = icon || ''
  workspace.value.name = (icon ? icon + ' ' : '') + raw
  store.persist()
  iconPickOpen.value = false
  iconCustom.value = ''
  showToast(icon ? '✓ 图标已更新' : '已删除图标（导航将显示默认图标）')
}
function onDescBlur(e: FocusEvent) {
  const desc = (e.target as HTMLElement).textContent?.trim()
  if (workspace.value) { workspace.value.desc = desc || ''; store.persist() }
}
function onDescEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }
function renameWs() {
  const raw = workspace.value?.name || ''
  const current = raw.replace(/^[^\s]+\s/, '')
  settingsMenuOpen.value = false
  openInputModal('✏️ 重命名策展台', current, (v) => {
    if (!workspace.value) return
    workspace.value.name = (workspace.value.icon ? workspace.value.icon + ' ' : '') + v
    store.persist()
    showToast('✓ 已重命名')
  })
}
function editDesc() {
  settingsMenuOpen.value = false
  openInputModal('📝 编辑策展台描述', workspace.value?.desc || '', (v) => {
    if (!workspace.value) return
    workspace.value.desc = v
    store.persist()
    showToast('✓ 描述已更新')
  })
}
function exportWorkspace() {
  const ws = workspace.value
  if (!ws) return
  const wsId = workspaceId.value
  // R56-I：改为 AppData 子集同构导出——旧自定义形状 {workspace,categories,resources} 缺 version/tagTree/
  // tasks/curiosities/compass/stats，导入端版本校验直接拒绝，标签体系等全局数据随之丢失。
  // 现为 ...d 全量展开（全局段随行）+ 策展台段按当前台过滤；导出物可直接走「导入数据」并集合并。
  // R70：剥离 Airtable 凭证与映射——导出物会被分享/传网盘，明文 PAT 泄露＝对方可读写用户 Base。
  // 与设置页「导出数据」同口径：数据可带走，凭证不随行。
  const rootForExport = { ...d.value } as Record<string, unknown>
  delete rootForExport.airtableSync
  const data = JSON.parse(JSON.stringify({
    ...rootForExport,
    workspaces: [ws],
    categories: d.value.categories.filter(c => c.workspaceId === wsId),
    resources: d.value.resources.filter(r => r.workspaceId === wsId)
  })) as AppData
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${ws.name}_数据.json`
  a.click(); URL.revokeObjectURL(url)
  showToast('✓ 策展台数据已导出（含标签树/罗盘/任务/好奇心等全局段）')
  settingsMenuOpen.value = false
}
async function deleteWorkspace() {
  // R58-B1：资源台是全局策展空间，不可从此入口删除
  if (workspaceId.value === CURATION_WS_ID) { showToast('ℹ 资源台为系统空间，不在此删除'); return }
  // R58-B1：红线修复——资源卡一律软删（deletedAt，回收站可恢复），不再物理移除
  if (!(await useConfirm({ title: '删除策展台', message: `确定删除策展台「${workspace.value?.name.replace(/^[^\s]+\s/, '')}」？\n其中资源卡将全部移入回收站（可恢复），分类与策展台本身将删除且不可恢复。`, confirmText: '确认删除' }))) return
  const idx = d.value.workspaces.findIndex(w => w.id === workspaceId.value)
  if (idx >= 0) d.value.workspaces.splice(idx, 1)
  const now = Date.now()
  for (const r of d.value.resources) if (r.workspaceId === workspaceId.value && !r.deletedAt) r.deletedAt = now
  d.value.categories = d.value.categories.filter(c => c.workspaceId !== workspaceId.value)
  store.persist()
  showToast('策展台已删除（资源卡已移入回收站）')
  router.push('/compass')
}

// ===== 分类管理（第八轮：新建/重命名/删除入口统一到左栏与应用内弹窗） =====

// ===== 链接显示 =====
function linkIcon(type: string) { return type==='url'?'🔗':type==='file'?'📁':'📝' }
function linkDisplay(link: string) {
  if (!link) return ''
  if (link.startsWith('http')) return link.replace(/^https?:\/\//,'').substring(0,30)
  if (link.startsWith('obsidian')) return 'Obsidian笔记'
  const parts = link.split(/[\\/]/)
  return parts[parts.length-1].substring(0,25)
}

// ===== 工具 =====
// uid 已从 @/shared/utils 导入（此前为本地重复实现，已统一）
</script>

<style scoped>
.ws-page { min-height: 100vh; background: var(--bg); padding: 0 20px 24px; }
.ws-empty { display: flex; align-items: center; justify-content: center; height: 100vh; color: var(--text-3); }

/* R73-S5a：资源台页头（R64-F13 删掉 hero 大标题后，hub 一直没有页面标题；
    R16 收敛后 CurationCenter 的 crumb 也不再出现 ⇒ 在此补回） */
/* R84（W1）：台身份页头——图标 + 台名 + 台描述 + 右端结构摘要（一行 ≤40px，所有台都渲染）。
   改前只有资源台一段写死的 .ws-hub-head（padding 18/14 ⇒ 约 60px 高），策展台零页头。 */
.ws-id-head { display: flex; align-items: center; gap: 8px; min-height: 34px; max-height: 40px; padding: 6px 0 8px; overflow: hidden; }
.wsh-icon { flex-shrink: 0; font-size: 16px; line-height: 1; }
/* 19px 沿用 R51-F11「页头标题统一放大」的既有规范（三主页面 + 项目详情/方向树 crumb 同款），
   不另起字号；19px 行高 ≈23px + padding 14px = 37px，仍在 W1 的 ≤40px 之内 */
.wsh-name { flex-shrink: 0; font-size: 19px; letter-spacing: .3px; font-weight: 700; color: var(--text); }
.wsh-desc { flex: 1; min-width: 0; font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wsh-summary { flex-shrink: 0; margin-left: auto; font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* R98（W8）：页头「更新 X」摘要——自指标条降级而来，保留流水下钻入口 */
.wsh-upd { cursor: pointer; }
.wsh-upd:hover { color: var(--accent); }
/* R98（W7）：金字塔层级折叠控制条——右对齐一行，档位沿用分段控件惯例（tokens 令牌，零硬编码色） */
.py-fold { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin: 0 0 8px; }
.py-fold-label { font-size: 11px; color: var(--text-3); }
.py-fold-btn { font-size: 11px; color: var(--text-3); background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 2px 10px; cursor: pointer; font-family: inherit; transition: all .15s; }
.py-fold-btn:hover { color: var(--accent); border-color: var(--accent); }
.py-fold-btn.on { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
/* R90（R8-①/③）：ⓘ 定位语（fallback 降为 tooltip 后的落点）与 ? 教学气泡触发点。
   页头高度锁 40px，故两点都做成 ≤16px 的行内元素，不新增行高 */
.wsh-locator { flex-shrink: 0; font-size: 11px; color: var(--text-3); cursor: help; }
.wsh-help { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-left: 6px; border: 1px solid var(--border); border-radius: 50%; font-size: 9.5px; line-height: 1; color: var(--text-3); background: var(--surface-2); cursor: help; }
.wsh-help:hover { color: var(--accent); border-color: var(--accent); }
/* R84（W2-①）：中心论点横幅（卡片视图顶部）——已设立 / 未设立两态 */
.thesis-banner { display: flex; align-items: center; gap: 8px; height: 34px; margin-bottom: 10px; padding: 0 12px; background: color-mix(in srgb, var(--accent) 7%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); border-radius: var(--radius-sm); }
.thesis-banner.empty { background: var(--surface-2); border-color: var(--border); }
.tb-mark { flex-shrink: 0; font-size: 13px; }
.tb-label { flex-shrink: 0; font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--accent); background: var(--accent-light); padding: 2px 7px; border-radius: 99px; }
.tb-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.tb-title:hover { color: var(--accent); }
.tb-go { flex-shrink: 0; font-size: 11px; color: var(--accent); cursor: pointer; white-space: nowrap; }
.tb-go:hover { text-decoration: underline; }
.tb-hint { flex: 1; min-width: 0; font-size: 11.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Hero 已删（R64-F13：大标题区移除，编辑入口收进 ⚙ 菜单）——仅保留图标管理弹层样式 */
.ws-icon-btn { cursor: pointer; border-radius: 8px; padding: 2px 7px; transition: background .15s; }
.ws-icon-btn:hover { background: var(--surface-3); }
.icon-pick-mask { position: fixed; inset: 0; z-index: 690; }
.icon-pick { position: fixed; z-index: 691; width: 272px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 14px; animation: ipIn .18s cubic-bezier(.16,1,.3,1); }
@keyframes ipIn { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
.ip-title { font-size: 12.5px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
.ip-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 10px; }
.ip-cell { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; border-radius: 6px; cursor: pointer; transition: all .12s; border: 1px solid transparent; }
.ip-cell:hover { background: var(--surface-3); }
.ip-cell.on { background: var(--accent-light); border-color: var(--accent); }
.ip-custom { display: flex; gap: 6px; margin-bottom: 10px; }
.ip-input { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12.5px; background: var(--surface); color: var(--text); outline: none; font-family: inherit; }
.ip-input:focus { border-color: var(--accent); }
.ip-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.ip-btn:hover { background: var(--accent-hover); }
.ip-btn.ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); flex: 1; }
.ip-btn.ghost:hover { border-color: var(--accent); color: var(--accent); background: var(--surface); }
.ip-foot { display: flex; gap: 8px; }
.name-text { outline: none; border-radius: 4px; padding: 2px 4px; }
.name-text:focus { background: rgba(255,255,255,.15); }
/* hero-btn 保留（R64 上移工具条继续使用） */
.hero-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 5px; font-weight: 500; border: none; }
.hero-btn.primary { background: var(--accent); color: #fff; }
.hero-btn.primary:hover { background: var(--accent-hover); }
.hero-btn.ghost { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); }
.hero-btn.ghost:hover { background: var(--surface-3); color: var(--text); }
.hero-btn.settings { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); padding: 6px 10px; }
.hero-btn.settings:hover { background: var(--surface-3); color: var(--text); }

/* 设置菜单（R64：hero 删除后上移至工具条下方） */
.settings-menu { position: fixed; top: 54px; right: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 36px rgba(0,0,0,.12); z-index: 60; min-width: 190px; overflow: hidden; display: none; }
.settings-menu.open { display: block; }
.sm-item { padding: 9px 14px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: all .1s; display: flex; align-items: center; gap: 8px; }
.sm-item:hover { background: var(--surface-3); color: var(--text); }
.sm-item.danger { color: var(--danger); }
.sm-item.danger:hover { background: var(--tag-danger-bg); }
.sm-divider { height: 1px; background: var(--border); margin: 4px 0; }
.cover-swatch:hover { background: var(--surface-3); }
.cover-swatch.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }

/* 工具条 */
.ws-toolbar { display: flex; align-items: center; gap: 10px; padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--surface); }
.view-tabs { display: flex; background: var(--surface-2); border-radius: 8px; padding: 3px; gap: 2px; }
.view-tab { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; color: var(--text-2); transition: all .15s; display: flex; align-items: center; gap: 4px; }
.view-tab:hover { color: var(--text); }
.view-tab.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.toolbar-select { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 11.5px; color: var(--text-2); cursor: pointer; outline: none; transition: all .15s; }
.sort-dir-btn { font-family: inherit; white-space: nowrap; }
.sort-dir-btn:hover { border-color: var(--accent); color: var(--text-1); }
.toolbar-select:hover { border-color: var(--accent); color: var(--accent); }
/* R90（R8-②）：右推职责交给 .toolbar-spacer（主 CTA 前置后，搜索不再是第一个右端元素） */
.toolbar-spacer { flex: 1; }
.toolbar-search { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); transition: all .15s; }
.toolbar-search:focus-within { border-color: var(--accent); }
.toolbar-search input { border: none; outline: none; font-size: 12px; width: 160px; background: transparent; color: var(--text); }
.toolbar-search .s-icon { color: var(--text-3); font-size: 13px; }
.toolbar-batch { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; white-space: nowrap; }
.toolbar-batch:hover { border-color: var(--accent); color: var(--accent); }
.toolbar-batch.active { background: var(--accent-light); border-color: var(--accent); color: var(--accent); font-weight: 600; }
/* R88（W3）：筛选触发按钮 + 气泡（一级只留这一颗，其余四项收进气泡） */
.filter-wrap { position: relative; display: flex; align-items: center; }
.toolbar-filter { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; white-space: nowrap; }
.toolbar-filter:hover { border-color: var(--accent); color: var(--accent); }
.toolbar-filter.on { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.tf-main { flex-shrink: 0; }
.tf-chip { font-size: 9.5px; padding: 1px 5px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toolbar-filter.on .tf-chip { background: var(--surface); color: var(--accent); }
.tf-chip.more { font-weight: 600; }
/* 气泡用相对定位（.ws-page / .ws-toolbar 均无 overflow:hidden），跟随触发按钮 */
.filter-pop { position: absolute; top: calc(100% + 6px); right: 0; z-index: 60; min-width: 268px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 36px rgba(0,0,0,.12); padding: 10px 12px; display: none; flex-direction: column; gap: 9px; }
.filter-pop.open { display: flex; }
.fp-row { display: flex; align-items: center; gap: 8px; }
.fp-label { width: 28px; flex-shrink: 0; font-size: 10.5px; color: var(--text-3); }
.fp-row .toolbar-select { flex: 1; min-width: 0; }
.fp-foot { display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 7px; }
.fp-reset { font-size: 11px; color: var(--text-3); cursor: pointer; }
.fp-reset:hover { color: var(--accent); }

/* Body */
.ws-body { display: flex; min-height: calc(100vh - 52px - 170px - 47px); }

/* 侧边栏（R48-V2：Linear 风格树——紧凑行高、缩进导轨、chevron 旋转、弱化计数） */
.ws-sidebar { width: 200px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface); padding: 10px 10px 14px; overflow-y: auto; }
.cat-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 2px 8px 8px; }
.cat-toolbar .ct-label { font-size: 10px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; }
.cat-toolbar .ct-actions { display: inline-flex; gap: 2px; }
.cat-toolbar .ct-btn { font-size: 10.5px; color: var(--text-3); padding: 2px 6px; border-radius: 5px; cursor: pointer; transition: all .12s; }
.cat-toolbar .ct-btn:hover { color: var(--accent); background: var(--accent-light); }
.cat-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: background .1s, color .1s; margin-bottom: 1px; }
.cat-item:hover { background: var(--surface-3); color: var(--text); }
.cat-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
/* 第廿九轮：卡片拖入分类行的归属落点高亮（与分类拖拽指示区分） */
.cat-item.card-drop { background: var(--accent-light); color: var(--accent); font-weight: 600; box-shadow: inset 0 0 0 1px var(--accent); }
.cat-item .cat-icon { font-size: 12.5px; flex-shrink: 0; }
.cat-item .cat-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cat-item .cat-count { font-size: 10px; color: var(--text-3); background: transparent; padding: 1px 6px; border-radius: 99px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.cat-item:hover .cat-count { background: var(--surface-2); }
.cat-item.active .cat-count { color: var(--accent); font-weight: 600; }
.cat-add { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; font-size: 11.5px; color: var(--text-3); cursor: pointer; transition: all .1s; margin-top: 6px; }
.cat-add:hover { color: var(--accent); background: var(--accent-light); }
.cat-merge { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; font-size: 11.5px; color: var(--text-3); cursor: pointer; transition: all .1s; border: 1px dashed var(--border); margin-top: 4px; }
.cat-merge:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.cat-divider { height: 1px; background: var(--border); margin: 8px 10px; }
/* 第八轮：分类树 + 置顶分区 + 拖拽指示 + hover 操作 */
.cat-section-label { font-size: 10px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 8px 8px 4px; }
/* R48-V2：Linear 风格树——子级缩进 + 左侧导轨线；caret 点击展开/折叠（旋转过渡） */
.cat-item.sub { margin-left: 12px; position: relative; padding-left: 14px; }
.cat-item.sub::before { content: ''; position: absolute; left: 4px; top: 0; bottom: 0; width: 1px; background: var(--border); }
.cat-caret { width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; color: var(--text-3); flex-shrink: 0; line-height: 1; cursor: pointer; border-radius: 4px; transition: transform .15s ease, background .12s; margin-left: -4px; }
.cat-caret:hover { background: var(--surface-3); color: var(--text); }
.cat-caret.open { transform: rotate(90deg); }
.cat-caret.placeholder { cursor: default; }
.cat-item.collapsed { color: var(--text-2); }
.cat-item .cat-actions { display: none; gap: 2px; flex-shrink: 0; }
.cat-item:hover .cat-actions { display: inline-flex; }
.cat-item:hover .cat-count { display: none; }
.cat-act { width: 18px; height: 18px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-3); cursor: pointer; }
.cat-act:hover { background: var(--surface); color: var(--text); }
.cat-act.on { color: var(--accent); }
.cat-act.danger:hover { color: var(--danger); }
.cat-item.drop-child { background: var(--accent-light); box-shadow: inset 0 0 0 1.5px var(--accent); }
.cat-item.drop-before { box-shadow: inset 0 2px 0 var(--accent); }
.cat-item.drop-after { box-shadow: inset 0 -2px 0 var(--accent); }
.cat-root-drop { margin: 8px 0 2px; padding: 8px 10px; border: 1.5px dashed var(--accent); border-radius: 6px; font-size: 11px; color: var(--accent); text-align: center; background: var(--accent-light); }
.ws-modal-input { width: 100%; padding: 10px 13px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--surface); color: var(--text); outline: none; font-family: inherit; transition: all .15s; }
.ws-modal-input.dup { border-color: #e5484d; box-shadow: 0 0 0 2px color-mix(in srgb, #e5484d 15%, transparent); }
.ws-modal-error { color: #e5484d; font-size: 12px; margin-top: 6px; }
.ws-modal-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
.ws-modal-hint { margin-top: 8px; font-size: 11px; color: var(--text-3); }

/* 内容区 */
.ws-content { flex: 1; padding: 18px 22px 90px; overflow-y: auto; }

/* 分区标签（置顶区/非置顶区） */
.section-label { font-size: 12px; font-weight: 600; color: var(--text-2); margin: 4px 0 10px; padding-left: 2px; }
.card-grid + .section-label, .res-list + .section-label { margin-top: 22px; }
/* REQ-027：分组分区标题（点击折叠/展开 F-027-4） */
.ws-cat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer;
  user-select: none; border-radius: 8px; padding: 6px 10px; margin-left: -10px; margin-right: -10px;
  transition: background .15s ease; }
.ws-cat-head:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.ws-cat-collapse { font-size: 10px; color: var(--text-4); transition: transform .18s ease; }

/* 卡片视图（第卅三轮 REQ-026：间距/内边距/最小宽引用 tokens 密度令牌，一处切换全局生效） */
/* R72：卡片视图列数由 --grid-cols 驱动（4/5/6/7）；容器放不下 N 列时自动降列，卡片最小 --card-min-w */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(var(--card-min-w), calc((100% - (var(--grid-cols, 5) - 1) * var(--card-gap)) / var(--grid-cols, 5))), 1fr)); gap: var(--card-gap); }
.res-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.res-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.res-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: var(--card-pad-vert) var(--card-pad-horz); cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; min-height: 120px; /* R55-F4：屏外卡片跳过渲染（切策展台 595ms 的渲染段优化） */ content-visibility: auto; contain-intrinsic-size: auto 132px; }
.res-card:hover { border-color: var(--accent); background: var(--surface-2); }
.res-card.selected { border-color: var(--accent); background: var(--accent-light); }
.res-card.pinned { border-left: 3px solid var(--accent); }
.rc-batch-check { position: absolute; top: 10px; left: 10px; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border-strong); background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; z-index: 3; }
.rc-batch-check.on { background: var(--accent); border-color: var(--accent); }
.res-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 3px; opacity: 0; transition: opacity .15s; z-index: 2; }
.res-card:hover .res-card-actions { opacity: 1; }
.rc-action { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all .1s; background: var(--surface); }
.rc-action:hover { background: var(--surface-3); color: var(--text); }
.rc-action.pin:hover { color: var(--accent); }
/* R79（R1 收尾）：↗ 打开用链接蓝，与「开链接」语义呼应；六动作里只有 pin 用强调色，主色仍稀缺 */
.rc-action.open:hover, .rr-action.open:hover, .kc-action.open:hover { color: var(--info-blue); }
.rc-action.delete:hover { color: var(--danger); }
.rc-fields { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.rc-title { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 20px; }
/* R61：镜像卡徽标 */
.rc-mirror-badge { display: inline-block; font-size: 10px; margin-right: 4px; opacity: .85; filter: saturate(.9); }
.rc-summary { font-size: 11.5px; color: var(--text-3); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rc-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.rc-tag { font-size: 10px; padding: 2px 7px; border-radius: 99px; background: var(--accent-light); color: var(--accent); }
.rc-src { font-size: 10px; padding: 1px 8px; border-radius: 99px; background: var(--tag-info-bg); color: var(--tag-info-text); align-self: flex-start; font-weight: 500; }
.rc-date { font-size: 10px; color: var(--text-3); }
.rc-assets { margin-top: 1px; }
.rc-custom { font-size: 11px; color: var(--text-2); }
.rc-custom span { color: var(--text-3); margin-right: 4px; }
.rc-footer { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.rc-cat { font-size: 10px; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 99px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; cursor: pointer; flex-shrink: 0; }
/* R64-F9：子分类分组标题弱化样式（层级由缩进表达） */
.ws-cat-head.sub span { color: var(--text-3); font-weight: 500; }
.rc-cat:hover { background: var(--accent); color: #fff; }
.rc-link { font-size: 10.5px; color: var(--text-3); display: flex; align-items: center; gap: 3px; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-link.url { color: var(--info-blue); }
.rc-link.file { color: var(--curio-amber); }
.rc-link.obsidian { color: var(--violet); }
.rc-calls { font-size: 10px; color: var(--curio-amber); background: var(--curio-bg); padding: 1px 7px; border-radius: 99px; font-weight: 500; }
/* R79（R1-列/看）：列表与看板的调用次数徽章——同一条规则覆盖两个类，与卡片 .rc-calls 同色同形 */
.rr-calls, .kc-calls { font-size: 10px; color: var(--curio-amber); background: var(--curio-bg); padding: 1px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; }
/* R87（R7-①）：⚠ 待补全徽标——三视图同形（与 .rc-calls 同一视觉语法：10px / 99px 圆角），
   颜色只走 tokens 的 --warning，不引新色；hover 加下划线提示可点 */
.rc-broken, .rr-broken, .kc-broken { font-size: 10px; color: var(--warning); background: var(--surface-2); border: 1px solid var(--warning); padding: 0 7px; border-radius: 99px; font-weight: 500; cursor: pointer; flex-shrink: 0; white-space: nowrap; }
.rc-broken:hover, .rr-broken:hover, .kc-broken:hover { text-decoration: underline; }
.rc-open-hint { margin-left: auto; font-size: 9.5px; color: var(--text-4); opacity: 0; transition: opacity .15s; }
.res-card:hover .rc-open-hint { opacity: 1; }
.rc-add-card { border: 1.5px dashed var(--border-strong); border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 120px; cursor: pointer; color: var(--text-3); font-size: 12px; transition: all .15s; flex-direction: column; gap: 6px; }
.rc-add-card:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

/* 采集跳转高亮（2秒渐隐） */
.res-card.flash, .res-row.flash { animation: rc-flash 2s ease-out; }
.cat-item.flash { animation: rc-flash 2s ease-out; }
@keyframes rc-flash {
  0% { box-shadow: 0 0 0 3px var(--accent), 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent); background: var(--accent-light); }
  60% { box-shadow: 0 0 0 3px var(--accent); background: var(--accent-light); }
  100% { box-shadow: none; }
}

/* 列表视图 */
.res-list { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.res-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all .1s;
  /* R71：屏外行跳过布局/绘制——长列表滚动时把成本限制在视口内 */
  content-visibility: auto; contain-intrinsic-size: auto 44px; }
.res-row.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.res-row.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.res-row:last-child { border-bottom: none; }
.res-row:hover { background: var(--surface-2); }
.res-row.selected { background: var(--accent-light); }
.res-row.pinned { border-left: 3px solid var(--accent); }
.rr-drag { color: var(--text-3); font-size: 12px; cursor: grab; flex-shrink: 0; }
.rr-title { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res-row.pinned .rr-title { font-weight: 600; }
.rr-f { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rr-assets { flex-shrink: 0; display: inline-flex; margin-left: 2px; }
.rr-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.res-row:hover .rr-actions { opacity: 1; }
.rr-action { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all .1s; }
.rr-action:hover { background: var(--surface-3); color: var(--text); }
.rr-action.delete:hover { color: var(--danger); }
/* R82（R4）：📋 挂载的已挂载态——用强调色，与 ⭐ 的金色区分；三视图同一表现，样式全走 tokens */
.rc-action.mount.on, .rr-action.mount.on, .kc-action.mount.on { color: var(--accent); background: var(--accent-light); }
/* 第卅三轮 REQ-020：列表行星标高亮 + 卡片操作区星标高亮 */
.rr-action.on, .rc-action.on { color: #d99a1e; }
.rc-action.on { background: color-mix(in srgb, #f5b942 14%, transparent); }
.kc-star { font-size: 12px; margin-right: 4px; }
.empty-state { padding: 40px; text-align: center; color: var(--text-3); font-size: 13px; }

/* 看板视图 */
.kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 10px; min-height: 400px; }
.kanban-col { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; width: 260px; flex-shrink: 0; display: flex; flex-direction: column; max-height: calc(100vh - 340px); }
.kc-header { position: sticky; top: 0; z-index: 1; background: var(--surface-2); padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.kc-name { font-size: 12px; font-weight: 600; color: var(--text); }
.kc-count { font-size: 10px; background: var(--surface); color: var(--text-3); padding: 1px 7px; border-radius: 99px; }
.kc-add { margin-left: auto; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; cursor: pointer; color: var(--text-3); font-size: 14px; transition: all .1s; }
.kc-add:hover { background: var(--surface-3); color: var(--accent); }
.kc-body { padding: 8px; overflow-y: auto; flex: 1; min-height: 60px; }
.kc-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.kc-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
/* R79（R1-看）：position: relative 为 hover 动作条的绝对定位提供参照（插入线走 box-shadow: inset，不受影响） */
.kc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 7px; cursor: pointer; transition: all .15s; position: relative; }
.kc-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 8%, transparent); }
.kc-card.pinned { border-left: 3px solid var(--accent); }
.kc-card-title { font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
/* R79（R1-看）：看板 hover 动作条——取代原仅有的 kc-del 删除图标，与卡片/列表视图同六动作同顺序 */
.kc-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s; z-index: 2; }
.kc-card:hover .kc-actions { opacity: 1; }
.kc-action { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 11px; color: var(--text-3); cursor: pointer; transition: all .1s; background: var(--surface); }
.kc-action:hover { background: var(--surface-3); color: var(--text); }
.kc-action.on { color: #d99a1e; background: color-mix(in srgb, #f5b942 14%, transparent); }
.kc-action.delete:hover { color: var(--danger); }
.kc-card-footer { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kc-card-assets { display: inline-flex; }
.kc-card-tag { font-size: 9px; padding: 1px 5px; border-radius: 99px; background: var(--accent-light); color: var(--accent); }
.kc-card-link { font-size: 10px; margin-left: auto; }
.kc-card-link.url { color: var(--info-blue); }
.kc-card-link.file { color: var(--curio-amber); }
.kc-card-link.obsidian { color: var(--violet); }

/* 批量操作浮动栏 */
.batch-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 150; display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); flex-wrap: wrap; }
.batch-count { font-size: 12.5px; font-weight: 700; color: var(--accent); margin-right: 4px; }
.batch-btn { padding: 6px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all .15s; font-family: inherit; }
.batch-btn:hover { border-color: var(--accent); color: var(--accent); }
.batch-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.batch-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.batch-enter-active, .batch-leave-active { transition: all .2s cubic-bezier(.16,1,.3,1); }
.batch-enter-from, .batch-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* 抽屉 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; opacity: 0; pointer-events: none; transition: opacity .25s; }
.overlay.open { opacity: 1; pointer-events: auto; }
.drawer { position: fixed; top: 0; right: 0; width: 440px; height: 100%; background: var(--surface); z-index: 201; transform: translateX(100%); transition: transform .3s cubic-bezier(.4,0,.2,1); box-shadow: 0 10px 36px rgba(0,0,0,.08); display: flex; flex-direction: column; }
.drawer.open { transform: translateX(0); }
.dr-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
.dr-footer { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
.dr-footer-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all .15s; font-family: inherit; }
.dr-footer-btn:hover { border-color: var(--accent); color: var(--accent); }
.dr-footer-btn.danger:hover { border-color: var(--danger); color: var(--danger); }
.dr-footer-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.dr-footer-btn.primary:hover { background: var(--accent-hover); }

/* 导入弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 300; display: none; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: var(--surface); border-radius: 12px; box-shadow: 0 10px 36px rgba(0,0,0,.12); width: 480px; max-width: 90vw; overflow: hidden; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.modal-header .mh-title { font-size: 14px; font-weight: 600; color: var(--text); flex: 1; }
.modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 16px; }
.modal-close:hover { background: var(--surface-3); color: var(--text); }
.modal-body { padding: 18px 20px; max-height: 50vh; overflow-y: auto; }
.modal-footer-row { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }
.modal-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 10px; cursor: pointer; transition: all .15s; }
.modal-option:hover { border-color: var(--accent); background: var(--accent-light); }
.modal-option .mo-icon { font-size: 20px; }
.modal-option .mo-name { font-size: 13px; font-weight: 500; color: var(--text); }
.modal-option .mo-desc { font-size: 10.5px; color: var(--text-3); margin-top: 2px; line-height: 1.5; }
/* R82（R4）：挂载任务选择器——与任务侧 TaskDetailDrawer 的挂载列表同构（✓/＋ 切换） */
.mt-list { margin-top: 10px; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.mt-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all .12s; }
.mt-item:hover { border-color: var(--accent); background: var(--accent-light); }
.mt-item.on { border-color: var(--accent); background: var(--accent-light); }
.mt-mark { flex-shrink: 0; width: 16px; font-size: 12px; color: var(--text-3); text-align: center; }
.mt-item.on .mt-mark { color: var(--accent); }
.mt-title { flex: 1; min-width: 0; font-size: 12.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mt-proj { flex-shrink: 0; font-size: 10.5px; color: var(--text-3); }
.mt-empty { padding: 18px; text-align: center; font-size: 12px; color: var(--text-3); }
.mt-hint { flex: 1; font-size: 11px; color: var(--text-3); line-height: 1; align-self: center; }

/* R73-S2：书签导入文件夹选择（自 CurationCenter 迁入） */
.bk-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.7; padding: 8px 10px; background: var(--surface-2); border-radius: 6px; margin-bottom: 8px; }
.bk-all { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text); padding: 6px 0 10px; cursor: pointer; }
.bk-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bk-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.bk-item:hover { background: var(--surface-2); }
.bk-name { flex: 1; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-count { font-size: 10.5px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; }

/* 书签文件夹选择 */
.bk-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.7; padding: 8px 10px; background: var(--surface-2); border-radius: 6px; margin-bottom: 8px; }
.bk-all { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text); padding: 6px 0 10px; cursor: pointer; }
.bk-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bk-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.bk-item:hover { background: var(--surface-2); }
.bk-name { flex: 1; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-count { font-size: 10.5px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; }

/* Toast */

/* ===== R62-1：指标条（策展台 5 格；R75 起资源台 3 格） ===== */
/* R64-F13：指标条压缩为紧凑单行（非重点信息，让位策展区） */
/* R75（R18）：资源台 3 格版——论点格与来源构成格对 hub 无意义；只加修饰类，不改 5 格本体 */
.ws-metrics.hub3 { grid-template-columns: repeat(3, 1fr); }
.ws-metrics { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 8px; margin: 10px 0 0; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 4px 12px; cursor: pointer; transition: all .15s; min-width: 0; display: flex; align-items: center; gap: 10px; }
.metric-card:hover { border-color: var(--accent); background: var(--surface-2); }
/* R67-F2：策展主题格常亮高亮（主题色描边+淡底+微光），非 hover 态也可辨识 */
.metric-card.thesis-hl { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--accent-light); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent), 0 2px 10px color-mix(in srgb, var(--accent) 12%, transparent); }
.metric-card.thesis-hl .mc-label { color: var(--accent); }
.mc-label { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }
.mc-value { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.2; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-value.thesis { font-size: 12.5px; font-weight: 600; flex: 1; }
.mc-value.small { font-size: 12.5px; }
.mc-sep { color: var(--text-4); font-weight: 400; margin: 0 3px; }
.mc-hint { font-size: 10px; color: var(--text-4); margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }

/* ===== R62-4：层级色点 ===== */
.cat-depth-dot { width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0; }
.cat-depth-dot[data-lv="0"] { background: var(--accent); }
.cat-depth-dot[data-lv="1"] { background: #4A7FB5; }
.cat-depth-dot[data-lv="2"] { background: #8b6fc9; }
.cat-depth-dot[data-lv="3"] { background: #d99a1e; }

/* ===== R62-5：金字塔视图 ===== */
/* R66-F5：结构连线层（横平竖直直角折线；画布尺寸由 drawPyLinks 按滚动区设定） */
.pyramid { display: flex; flex-direction: column; gap: 14px; position: relative; overflow-x: auto; }
.py-links-svg { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0; }
.py-links-svg path { fill: none; stroke: var(--border-strong, #555); stroke-width: 1; opacity: .5; }
.pyramid .py-root, .pyramid .py-board { position: relative; z-index: 1; }
.py-root { position: relative; display: flex; justify-content: center; padding: 6px 0 10px; border-radius: 10px; transition: background .15s, box-shadow .15s; }
.py-root.droppable { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-light); }
.py-root-card { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface)); border: 1.5px solid var(--accent); border-radius: 12px; padding: 12px 22px; max-width: 520px; text-align: center; cursor: pointer; transition: all .15s; }
.py-root-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 18%, transparent); }
.py-root-badge { display: block; font-size: 10px; color: var(--accent); font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
.py-root-title { display: block; font-size: 15px; font-weight: 700; color: var(--text); line-height: 1.5; }
.py-root-desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 11.5px; color: var(--text-3); margin-top: 4px; line-height: 1.5; }
.py-root-unset { position: absolute; top: 2px; right: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; color: var(--text-3); cursor: pointer; }
.py-root-unset:hover { background: var(--surface-3); color: var(--danger); }
.py-root-empty { border: 1.5px dashed var(--border-strong); border-radius: 12px; padding: 14px 24px; font-size: 12px; color: var(--text-3); text-align: center; width: 100%; }
.py-root-empty.clickable { cursor: pointer; transition: all .15s; }
.py-root-empty.clickable:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
/* R66-F5：居中树 board——列宽自适应 minmax(170px,250px)，整体 fit-content 水平居中不占满；
   行距 34px 留出直角连线空间；父节点跨子组全部列（横向恒=子组、居中悬于其上） */
.py-board { display: grid; gap: 34px 12px; width: fit-content; margin: 6px auto 0; align-items: stretch; min-width: 40%; }
.py-node { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; min-width: 0; transition: border-color .15s, box-shadow .15s; }
.py-node:hover { border-color: var(--border-strong); }
.py-node.drop-child { border-color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
.py-node.drop-sib { box-shadow: inset 0 2px 0 var(--accent); }
.py-node.flash { animation: rc-flash 1.6s ease-out; }
.py-node-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border); cursor: grab; }
/* R66-F5：节点层级小徽标（原每行 L 标签随 board 布局退役） */
.py-node-lv { font-size: 9px; font-weight: 700; color: var(--text-4); background: var(--surface-3); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; letter-spacing: .5px; }
.py-node-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.py-node-name:hover { color: var(--accent); }
.py-node-count { font-size: 10px; color: var(--accent); background: var(--accent-light); padding: 1px 7px; border-radius: 99px; font-weight: 600; }
.py-node-ops { display: inline-flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.py-node-head:hover .py-node-ops { opacity: 1; }
.py-op { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; color: var(--text-3); cursor: pointer; }
.py-op:hover { background: var(--surface-3); color: var(--accent); }
.py-node-body { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px 10px; min-height: 34px; }
.py-card-chip { font-size: 11px; color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; cursor: pointer; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: all .12s; }
.py-card-chip:hover { border-color: var(--accent); color: var(--text); background: var(--accent-light); }
.py-node-empty { font-size: 10.5px; color: var(--text-4); }
/* R65-F3：节点双入口底栏 */
.py-node-foot { display: flex; gap: 6px; padding: 0 10px 9px; }
.py-foot-btn { flex: 1; text-align: center; font-size: 10.5px; color: var(--text-3); background: var(--surface-2); border: 1px dashed var(--border); border-radius: 6px; padding: 4px 6px; cursor: pointer; transition: all .12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.py-foot-btn:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
/* R65-F3：关联资源卡选择器 */
.lc-search { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); margin-bottom: 10px; }
.lc-search input { border: none; outline: none; background: transparent; font-size: 12px; flex: 1; color: var(--text); }
.lc-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.lc-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.lc-item:hover { background: var(--surface-2); }
.lc-item.picked { background: var(--accent-light); }
.lc-item.mirrored { opacity: .55; cursor: default; }
.lc-badge { font-size: 10px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; flex-shrink: 0; }
.lc-title { flex: 1; min-width: 0; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-link { font-size: 10px; color: var(--text-4); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
.lc-empty { text-align: center; padding: 24px; font-size: 12px; color: var(--text-4); }
.py-node-add { position: absolute; right: -8px; top: -8px; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; border-radius: 6px; background: var(--accent); color: #fff; font-size: 13px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.py-node:hover .py-node-add { display: flex; }
.py-level-empty { font-size: 10.5px; color: var(--text-4); padding: 4px 0; }
.py-empty { font-size: 12px; color: var(--text-3); padding: 24px 0; text-align: center; }

/* ===== R62-6：节点菜单 ===== */
.node-menu-mask { position: fixed; inset: 0; z-index: 690; }
.node-menu { position: fixed; z-index: 691; width: 216px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; animation: ipIn .16s cubic-bezier(.16,1,.3,1); }
.nm-item { padding: 8px 11px; border-radius: 7px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: all .1s; }
.nm-item:hover { background: var(--surface-3); color: var(--text); }
.nm-item.danger { color: var(--danger); }
.nm-item.danger:hover { background: var(--tag-danger-bg); }
.nm-divider { height: 1px; background: var(--border); margin: 4px 6px; }
</style>
