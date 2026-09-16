<template>
  <div ref="wsPageRef" class="ws-page" :class="{ 'ws-fs-on': pyFs }" v-if="workspace" :style="{ '--grid-cols': String(colsNow) }">
    <!-- R84（W1）：台身份页头——图标 + 台名 + 台描述 + 右端结构摘要（一行 ≤40px）。
         改前：仅资源台有一段 R73-S5a 写死的 .ws-hub-head（无图标、非 workspace.name.replace(/^[^\s]+\s/, '')/description），
         而 **策展台的台名与台描述在页面内零出现**——用户置身于某个策展台，却不知道这是哪个台。
         现统一为这一条，所有台都渲染；hub 描述为空时回落 R73 原文案（零信息损失）。 -->
      <!-- 左侧分类导航（第八轮：树形 2 级 + 置顶分区 + 拖拽排序/挂子级；R48-V2：Linear 风格树 + 展开/折叠） -->
      <div class="ws-content" @scroll.passive="onContentScroll">
      <!-- R109（F13）：顶部三模块移入滚动容器（与卡片同 padding/滚动域）——顶栏/指标条/工具条/网格右缘成一条直线 -->
    <div class="ws-id-head">
      <span class="wsh-icon">{{ workspace.icon || (isHub ? '📦' : '🗂') }}</span>
      <b class="wsh-name">{{ workspace.name.replace(/^[^\s]+\s/, '') }}</b>
      <!-- R90（R8-③）：台描述分两态——**用户自写的台描述仍内联**（R84 / W1 要的就是台身份可见）；
           资源台无描述时回落的定位语「资源卡唯一存储 · 镜像源头」**降为 ⓘ tooltip**（它是定位语，不是每屏必读） -->
      <!-- R119：资源台无自写描述时，原型把定位语「资源卡唯一存储 · 镜像源头」**内联常显**（原为 ⓘ 悬停才见）；
           非 hub 台保持 ⓘ 收敛——其页头右端已有「更新 X」信息位，不再叠加第二段说明。 -->
      <span v-if="wsHeadDescOwn" class="wsh-desc" :title="wsHeadDescOwn">· {{ wsHeadDescOwn }}</span>
      <span v-else-if="wsHeadDescFallback && isHub" class="wsh-desc" title="资源台定位">{{ wsHeadDescFallback }}</span>
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

    <!-- R75（R18）：指标条按台身份分流——资源台 3 格 / 策展台 3 格（数据源同为 hub.curationMetrics） -->
    <!-- 资源台（hub）3 格：论点格与来源构成格对资源台无意义——单向挂载红线 ⇒ 无投射指向资源台，metrics.mirrored 恒 0 -->
    <!-- R119：按原型 .metric-box —— **单行**「label 左 / value 右」（原为 label→value→hint 三行纵排），
         原 hint 文案一字不丢、降为整格 title 提示；附件格补原型的三档构成「(N图 · NPDF · NHTML)」 -->
    <div v-if="isHub" class="ws-metrics hub3">
      <div class="metric-card" @click="openDrill('total')" :title="hubCountHint + ' · 点击查看分类明细'">
        <span class="mc-label">📊 卡片总数</span>
        <span class="mc-value">{{ metrics.total }}</span>
      </div>
      <div class="metric-card" @click="openDrill('assets')" :title="'点击查看附件明细' + (assetKindText ? ' · ' + assetKindText : '')">
        <span class="mc-label">📎 附件数量</span>
        <span class="mc-value">{{ metrics.attachmentCount }}<span v-if="assetKindText" class="mc-sub">{{ assetKindText }}</span></span>
      </div>
      <div class="metric-card" @click="openDrill('recent')" title="点击查看更新流水">
        <span class="mc-label">🕐 最近更新</span>
        <span class="mc-value small">{{ lastUpdateText }}</span>
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
      :card-exists="cardExistsGlobally" :referenced-asset-ids="referencedAssetIds"
      @close="drillOpen=false" @jump-cat="onDrillJumpCat" @open-card="onDrillOpenCard" @locate="onDrillLocate"
      @locate-asset="onDrillLocateAsset" @cleanup-asset="onDrillCleanupAsset" @cleanup-orphans="onDrillCleanupOrphans" />

    <!-- R113-N2：生命周期入口收敛到 设置→总览（原就地面板移除） -->

    <!-- R108（T3）：金字塔 Markdown 模板导入弹窗（仅策展台入口；hasThesis 决定 H1 是否被采用） -->
    <ImportTemplateModal
      :open="pyramidImportOpen"
      mode="pyramid"
      :target-name="workspace?.name || ''"
      :has-thesis="!!thesisCard"
      @close="pyramidImportOpen = false"
      @confirm="confirmPyramidImport"
    />

    <!-- 设置下拉菜单（固定定位，避免被 hero 圆角裁剪） -->
    <div class="settings-menu" :class="{open: settingsMenuOpen}" @click.stop>
      <!-- R88（W6）：「⬇ 导入」自工具条收进此处，并**按台身份改名**消歧义——
           同一个「导入」二字在两台其实是两回事（资源台=导入资源，策展台=导入策展台数据包） -->
      <div class="sm-item" @click="openImport">{{ isHub ? '⬇ 导入资源' : '⬇ 导入数据包' }}</div>
      <!-- 批量管理的入口也收进此处；**退出**仍留在一级（批量中显示「✓ 完成批量」） -->
      <div v-if="!batchMode" class="sm-item" @click="toggleBatchMode">☑ 批量管理</div>
      <!-- R106（F7）：一键批量清理本台镜像卡（投射记录删除，源卡保留在资源台） -->
      <div v-if="!isHub" class="sm-item" @click="cleanAllMirrors">🧹 清理本台镜像卡</div>
      <!-- R108（T3）：金字塔 Markdown 模板导入 —— R113-N4 已提到一级工具条（见「📋 导入模板」按钮），此处移除 -->
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
      <!-- R113-N4：金字塔模板导入提到一级。原藏在 ⚙ 菜单第 4 项（用户反馈"埋太深、不方便"），
           与「＋新建」同属"往本台生成内容"，紧邻放置；资源台（hub）无金字塔概念，不露出。 -->
      <button v-if="!isHub" class="hero-btn settings py-import-btn" title="导入金字塔 Markdown 模板（论点 + 分类节点 + 节点卡片一次生成）"
        @click="pyramidImportOpen = true">📋 导入模板</button>
      <!-- R118（T4.1）：待分类轻量警告——待分类是系统桶，不进金字塔（金字塔只铺真实业务分类），
           但桶里有卡时必须让人看得见，否则这些卡在金字塔视图里彻底隐形。 -->
      <button v-if="!isHub && uncategorizedCount" class="uncat-warn"
        :title="`有 ${uncategorizedCount} 张卡尚未归入任何业务分类 —— 点击切回卡片视图并聚焦「待分类」`"
        @click="setViewMode('card'); activeCategory = 'uncat'">⚠ 待分类 {{ uncategorizedCount }} 张</button>
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
            <ColsPicker v-model="colsNow" label="列数" />
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
      <!-- R110-LC：生命周期面板入口（活跃 / 冷却 / 归档三态；归档卡从默认视图隐藏，在此恢复） -->
      <button class="hero-btn settings" title="策展台设置" @click.stop="toggleSettingsMenu">⚙</button>
    </div>

    <!-- R110-LC（T3）：归档卡已从默认视图隐藏——底部一行降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
    <div v-if="archivedHintCount" class="ws-archived-hint" @click="router.push('/settings?page=lifecycle')">
      📦 另有 {{ archivedHintCount }} 张已归档卡片未显示（点此在 设置 → 总览 · 资源生命周期 中查看 / 恢复）
    </div>

    <!-- ③ 资源策展区 -->
      <div class="ws-columns">
      <div class="ws-sidebar" :style="{ width: wsSideW + 'px' }">
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
            <!-- R113-N1：原 5 个图标平铺（且 hover 时把计数顶掉、把分类名挤没）→ 收敛为
                 「＋ 子分类」+「⋯ 更多」两项；置顶 / 镜像 / 重命名 / 删除 收进 ⋯ 菜单，
                 主次分明、破坏性操作进二级（误删风险下降）。计数恢复常驻。 -->
            <span class="cat-actions">
              <span v-if="sc.depth < 3" class="cat-act" title="创建子分类" @click.stop="openCreateCat(sc.cat.id)">＋</span>
              <span class="cat-act more" title="更多操作（置顶 / 镜像 / 重命名 / 删除）" @click.stop="openCatMenu($event, sc)">⋯</span>
            </span>
            <span class="cat-count" :title="sc.hasChildren ? `仅本分类直属 ${sc.directCount} 张 · 含 ${sc.childCount} 个子分类（共 ${sc.aggCount} 张）` : `仅本分类直属 ${sc.directCount} 张`">{{ sc.directCount }}</span>
            <!-- R118（T3.3）：直属 / 聚合口径与右侧分类头**逐字统一**——两处都呈现「N · 含 M 个子分类」，
                 不再一处只给数字、另一处给「含 N 个子分类」，消除同屏两套算法的错觉。
                 聚合总数只在 tooltip 里作补充说明，不冒充主值。 -->
            <span v-if="sc.hasChildren" class="cat-sub" :title="`本分类下辖 ${sc.childCount} 个子分类（含子分类卡聚合共 ${sc.aggCount} 张）`">· 含 {{ sc.childCount }} 个子分类</span>
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
      <!-- R113-N1：树宽拖拽手柄（160–420px；双击复位 200px；窄屏隐藏） -->
      <div class="ws-side-split" title="拖拽调整分类树宽度（双击复位）" @mousedown.prevent="startSideResize" @dblclick="resetSideWidth"></div>

      <!-- R113-N1：分类行「⋯」溢出菜单（fixed 定位——不被侧栏 overflow-y 裁剪；out-of-flow 不进 flex 布局） -->
      <div v-if="catMenu.open" class="ctm-mask" @click="catMenu.open = false" @contextmenu.prevent="catMenu.open = false"></div>
      <div v-if="catMenu.open" class="ctm" :style="{ left: catMenu.x + 'px', top: catMenu.y + 'px' }">
        <div v-if="catMenu.depth === 0" class="ctm-item" @click="runCatMenu('pin')">📌 {{ catMenu.pinned ? '取消置顶' : '置顶分类' }}</div>
        <div v-if="catMenu.canMirror" class="ctm-item" @click="runCatMenu('mirror')">📤 镜像到策展台</div>
        <div class="ctm-item" @click="runCatMenu('rename')">✎ 重命名</div>
        <div class="ctm-sep"></div>
        <div class="ctm-item danger" @click="runCatMenu('delete')">🗑 删除分类</div>
      </div>

      <!-- 右侧展示区 -->

        <!-- ===== 卡片视图：REQ-027 按分类分组分区；R64-F9 树状递归分组（depth 缩进呈现层级） ===== -->
        <div v-if="viewMode==='card'">
          <!-- R84（W2-①）：中心论点提到首屏——此前论点只出现在指标条第一格与金字塔 L1 根，
               卡片视图（默认视图）里完全看不到。已设立 → 标题 + 查看金字塔；未设立 → 一行轻引导。
               R118（T3.2）：资源台（isHub）**一律不渲染**本横幅——「中心论点 / 金字塔 L1」是策展台的概念，
               资源台是资源卡的唯一存储、不是论证现场，此前在资源台渲染出的空态引导指向了台内并不存在的
               设立入口（右键菜单里根本没有该项），属对用户的错误引导。 -->
          <template v-if="!isHub">
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
          </template>
          <template v-for="(g, gi) in renderedGroups" :key="g.key">
            <div :style="g.depth ? 'margin-left:' + (g.depth * 16) + 'px' : ''">
            <div class="section-label ws-cat-head" :class="{first: gi===0, sub: g.depth>0}" @click="toggleGroupCollapse(g.key)">
              <span>{{ g.depth ? '↳' : '📁' }} {{ g.title }} · {{ g.count }}<template v-if="groupChildCount(g.key)"> · 含 {{ groupChildCount(g.key) }} 个子分类</template></span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="card-grid"
              @dragover="onAreaDragOver($event, g.key)" @drop="onAreaDrop($event, g.key)">
              <div v-for="r in g.items" :key="r.id" class="res-card" :class="{mirror: isMirrorView(r), pinned: r.pinned, 'warning-broken': isBrokenPath(r), flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
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
                  <!-- R119（对齐原型 .rc-hover-actions「hover 只 2 项」）：真身卡 hover 只留「📋 挂载 / ⭐ 星标」。
                       置顶 / 移动分类 / 镜像到策展台 / 删除 四项能力**零删减**——全部由右键菜单 openResCtx 承接
                       （置顶 / 移动分类 / 📡 镜像到策展台 / 删除 均在菜单内），主视觉不再被 7 个图标挤占。 -->
                  <template v-if="!isMirrorView(r)">
                    <div class="rc-action mount" :class="{on: mountedTaskCount(r) > 0}" @click.stop="openMountOne(r)" :title="mountedTaskCount(r) ? `已挂载 ${mountedTaskCount(r)} 个任务 · 点击管理` : '挂载到任务（右键可置顶 / 移动 / 镜像 / 删除）'">📋</div>
                    <div class="rc-action" :class="{on: r.starred}" :title="r.starred?'取消星标':'星标'" @click.stop="toggleStar(r)">⭐</div>
                  </template>
                  <template v-else>
                    <div class="rc-action locate" title="定位到资源台源卡" @click.stop="locateMirrorSource(r)">🎯</div>
                    <div class="rc-action delete" title="移出镜像（源卡保留）" @click.stop="removeMirror(r)">✕</div>
                  </template>
                </div>
                <div class="rc-fields">
                  <template v-for="f in fieldsOf(r)" :key="f.key">
                    <div v-if="isTitleKey(f.key)" class="rc-title"><NewBadge :at="r.createdAt" /><span class="rc-type-icon" aria-hidden="true">{{ r.link ? linkIcon(r.linkType) : (r.assets?.length ? '📎' : '📄') }}</span><span v-if="isMirrorView(r)" class="rc-mirror-badge" title="镜像卡 · 源在资源台">📡</span>{{ val(r, f.key) }}</div>
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
              <div v-if="gi === renderedGroups.length - 1 && !hasMoreToRender" class="rc-add-card" @click="openNewResource">
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
          <!-- R112 性能：增量渲染的显式入口（滚动到此处也会自动追加一屏） -->
          <div v-if="hasMoreToRender" class="render-more" @click="renderMore">
            ↓ 已显示 {{ renderedCount }} / {{ totalVisibleCount }} 张 —— 点此加载更多
          </div>
        </div>

        <!-- ===== 列表视图：REQ-027 按分类分组分区（每分区标题行 + 其下条目）；R64-F9 树状缩进 ===== -->
        <div v-if="viewMode==='list'">
          <template v-for="(g, gi) in renderedGroups" :key="g.key">
            <div :style="g.depth ? 'margin-left:' + (g.depth * 16) + 'px' : ''">
            <div class="section-label ws-cat-head" :class="{first: gi===0, sub: g.depth>0}" @click="toggleGroupCollapse(g.key)">
              <span>{{ g.depth ? '↳' : '📁' }} {{ g.title }} · {{ g.count }}<template v-if="groupChildCount(g.key)"> · 含 {{ groupChildCount(g.key) }} 个子分类</template></span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="res-list">
              <div v-for="r in g.items" :key="r.id" class="res-row" :class="{mirror: isMirrorView(r), pinned: r.pinned, flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :data-rid="r.id" :draggable="!batchMode" @click="onCardClick(r)" @dblclick="onCardDblClick(r)"
                @dragstart="onDragStart($event,r)" @dragover.prevent="markDrop($event, r.id, 'x')" @drop="onDropCard($event,r)" @dragend="clearDragState" @dragleave="clearDropMark"
                @contextmenu.prevent="openResCtx($event, r)">
                <!-- R117（04-61 F1）：列表行用行内勾选框 .rr-check（原复用卡片 absolute 定位的 .rc-batch-check 会逃逸重叠） -->
                <div v-if="batchMode" class="rr-check" :class="{on: selectedIds.has(r.id)}" @click.stop="toggleSelect(r.id)">{{ selectedIds.has(r.id)?'✓':'' }}</div>
                <span v-else class="rr-drag">⋮⋮</span>
                <span class="rr-title"><NewBadge :at="r.createdAt" /><span v-if="isMirrorView(r)" class="rc-mirror-badge" title="镜像卡 · 源在资源台">📡</span>{{ val(r, titleKey) }}</span>
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
          <!-- R112 性能：增量渲染的显式入口（列表视图同口径） -->
          <div v-if="hasMoreToRender" class="render-more" @click="renderMore">
            ↓ 已显示 {{ renderedCount }} / {{ totalVisibleCount }} 张 —— 点此加载更多
          </div>
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
            <!-- R116 性能：列体增量渲染——滚动近底自动追加（与卡片/列表 R112 同构） -->
            <div class="kc-body" @scroll="onKanbanColScroll($event, cat.key)">
              <div v-for="r in cat.items" :key="r.id" class="kc-card" :class="{mirror: isMirrorView(r), pinned: r.pinned, 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
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
              <!-- R116 性能：增量渲染的显式入口（看板列同口径，保证键盘/触屏场景可达） -->
              <div v-if="cat.hiddenCount > 0" class="kc-more" @click="kanbanMore(cat.key)">显示更多 {{ cat.hiddenCount }} 张</div>
            </div>
          </div>
        </div>

        <!-- ===== R62-5：金字塔视图（L1 中心论点根 + 分类树逐层铺开 + 卡片拖换节点）；R64-F11 SVG 结构连线 ===== -->
        <div v-if="viewMode==='pyramid'" class="pyramid" ref="pyWrapRef" :class="{ 'py-fs-fallback': pyFsFallback }">
          <!-- R110-FS：全屏切换（路线 A：Fullscreen API 元素级真全屏，浏览器原生 ESC；路线 B：fixed 覆盖层降级） -->
          <button class="py-fs-btn" @click.stop="togglePyFullscreen"
            :title="pyFs ? '退出全屏（ESC）' : '全屏查看金字塔（ESC 退出）'">{{ pyFs ? '⛶ 退出全屏' : '⛶ 全屏' }}</button>
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
          <!-- R98（W7）：层级折叠——仅 L2 / 到 L3 / 全部（本地视图态）；金字塔只有一层时无折叠意义，不渲染
               R118（T4.2）：形态对齐原型 [仅论据 L2 ｜ 全部展开]——三档保留（到 L3 是现有能力的真子集关系，
               删档即能力丢失），仅收敛措辞：L2 在金字塔里就是「论据层」，全部 = 全部展开。 -->
          <div v-if="pyramidLevels.length >= 2" class="py-fold">
            <span class="py-fold-label">层级</span>
            <button class="py-fold-btn" :class="{on: pyFold==='l2'}" @click="pyFold='l2'">仅论据 L2</button>
            <button class="py-fold-btn" :class="{on: pyFold==='l3'}" @click="pyFold='l3'">到 L3</button>
            <button class="py-fold-btn" :class="{on: pyFold==='all'}" @click="pyFold='all'">全部展开</button>
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
              <!-- R65-F3：节点双入口——关联资源卡（资源台选择器镜像）/ 新建卡片（台内卡，可挂附件）
                   R118（T4.3）：由「常驻实心按钮」降为**底部虚线微文字触手**（去掉面底色，只留虚线边与
                   次要文字色），措辞对齐原型：关联资源卡 → 「关联佐证素材」（金字塔语境下它就是论据素材；
                   函数入口 openLinkCards 未变，title 里写明「从资源台选择资源卡镜像到该节点」保住可发现性）。 -->
              <div class="py-node-foot">
                <span class="py-foot-btn" title="从资源台选择资源卡镜像到该节点（论据素材）" @click.stop="openLinkCards(cell.cat)">＋ 关联佐证素材</span>
                <span class="py-foot-btn" title="新建台内卡（可挂附件，真身留在本台）" @click.stop="addResourceToCategory(cell.cat.id)">＋ 新建卡片</span>
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
      <!-- R106（F4）：镜像卡只读详情——表单禁交互（pointer-events），footer 换「定位回资源台编辑」；
           Ctrl+Enter 语义随只读态切换为定位（用户拍板三键：单击详情 / 双击开链接 / Ctrl+Enter 定位） -->
      <div class="dr-body" :class="{ 'dr-readonly': drawerReadonly }">
        <div v-if="drawerReadonly" class="dr-readonly-banner">
          📡 镜像卡为引用（只读）——编辑请到资源台；<span class="dr-ro-link" @click="locateMirrorSourceCard">定位到源卡 ›</span>
        </div>
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
        <template v-if="drawerReadonly">
          <button class="dr-footer-btn" @click="openResourceLink(editingResource)">↗ 打开链接</button>
          <button class="dr-footer-btn primary" @click="locateMirrorSourceCard">📍 定位到资源台编辑</button>
        </template>
        <template v-else>
          <button class="dr-footer-btn danger" @click="deleteCurrentResource">🗑 删除</button>
          <button class="dr-footer-btn" @click="copyLink">🔗 复制链接</button>
          <button class="dr-footer-btn" @click="openResourceLink(editingResource)">↗ 打开链接</button>
          <button class="dr-footer-btn primary" @click="saveResource">✓ 保存</button>
        </template>
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

    <!-- R62-6：金字塔节点菜单（⋯ 展开，6 项）——R113-N5：动态宿主，真全屏下仍可用 -->
    <Teleport :to="overlayTarget">
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { useCompass } from '@/newtab/stores/compass'
import { recordWorkspaceOpen } from '@/shared/storage/stats'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useOverlayTarget } from '@/shared/utils/overlayHost'
import { showToast } from '@/shared/components/toast'
import { deleteAsset, cleanupOrphanAssets } from '@/shared/storage/assets'
import AssetPreview from '@/shared/components/AssetPreview.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'
import ImportTemplateModal from '@/newtab/components/ImportTemplateModal.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
// R117（04-61 C3）：当日新增角标（自然日口径）——资源卡卡片视图 / 列表视图同一枚
import NewBadge from '@/shared/components/NewBadge.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import CurationDrillDrawer from '@/newtab/components/CurationDrillDrawer.vue'
import type { DrillCatRow, DrillCardRow } from '@/newtab/components/CurationDrillDrawer.vue'
import { useConfirm } from '@/shared/components/confirm'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import { buildCatIndex, buildBucketIndex } from '@/shared/utils/catIndex'
import { CURATION_WS_ID, type ResourceCard, type Category, type FieldDef, type AssetMeta } from '@/shared/models'
import { boardCardsOf, isMirrorView, curationMetrics, setThesis, isHubWs } from '@/shared/storage/hub'
import { useCurationDrill } from '@/newtab/composables/useCurationDrill'
import { useResourceView } from '@/newtab/composables/useResourceView'
import { useCatSidebar, type SidebarCat } from '@/newtab/composables/useCatSidebar'
import { useWorkspaceMirror } from '@/newtab/composables/useWorkspaceMirror'
import { useCategoryCrud } from '@/newtab/composables/useCategoryCrud'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import { useWorkspaceBatch } from '@/newtab/composables/useWorkspaceBatch'
import { useResourceDrawer } from '@/newtab/composables/useResourceDrawer'
import { useWorkspaceImport } from '@/newtab/composables/useWorkspaceImport'
import { useResourceDragDrop } from '@/newtab/composables/useResourceDragDrop'
import { usePyramid } from '@/newtab/composables/usePyramid'
import { useWsMeta } from '@/newtab/composables/useWsMeta'
import { useWsAssetHygiene } from '@/newtab/composables/useWsAssetHygiene'
// R117（04-61 B）：资源台定位域（?hl= 卡片定位 / ?cat= 分类定位，含增量渲染前置）——宿主 ≤1500 行验收线
import { useWsLocate } from '@/newtab/composables/useWsLocate'
// R113-N2：LifecyclePanel / useLifecycle 移除——入口收敛到 设置→总览（GlobalSettings）
// R115：视图/侧栏/打开/抽屉/拖拽/金字塔六域拆入 composables（04-59 技术债第三批）；实现原位迁出、零行为变更。

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)
/** R113-N5：浮层动态宿主——真全屏时 Teleport 目标指向全屏元素（否则挂 body 的浮层不可见） */
const overlayTarget = useOverlayTarget()
/** R82（R4）：取项目扁平表（任务的项目名展示）——与方向台共用 useCompass 的口径 */
const { allProjects } = useCompass()

/**
 * R112 性能（P0）：路由离开 /workspace 时**保持最后一个台 id**。
 * 原实现直接取 `route.params.id`——切到调度台/方向台/设置页时它变为 undefined，
 * 而 workspaceId 是**几乎全部 computed 的根依赖**（allResources / metrics / catIdx /
 * resBucket / sidebarCats / resourceGroups / referencedAssetIds …），
 * 于是 KeepAlive 缓存中的本组件在**隐藏期间**仍被触发一次全量重算 + 重渲染，
 * 切回来再触发一次 —— 每次切台白做两遍，这是 M2a 切台耗时的主要构成。
 * 保持上一个 id 后：切走与切回均零重算；切到**另一个台**时照常重算（行为不变）。
 */
const lastWsId = ref('')
watch(() => route.params.id, (id) => { if (typeof id === 'string' && id) lastWsId.value = id }, { immediate: true })
const workspaceId = computed<string>(() => {
  const id = route.params.id
  return (typeof id === 'string' && id) ? id : lastWsId.value
})
const workspace = computed(() => d.value.workspaces.find(w => w.id === workspaceId.value))
/** R62：资源台（isHub）不显示策展指标条与主题卡语义 */
const isHub = computed(() => isHubWs(workspace.value))

// ===== 树工具域（R115：视图/侧栏/拖拽/金字塔四域共用的基础索引，留宿主）=====
const wsCats = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value && !c.deletedAt)) // R109（F12-b）：软删分类不入树
/**
 * R71 性能治理：分类树索引（一次 O(n) 建表 → 此后 O(1) 查表）。
 * 此前 childCatsOf / rootCats / descendantIds / familyIds 全是「每次调用都全表扫描」的实现，
 * 而它们被递归函数与模板表达式反复调用（侧栏单个节点就要 5 次 childCatsOf）——
 * 整棵树一次重渲染是 O(n²)，这正是切换视图/展开目录时卡顿的主因。
 */
const catIdx = computed(() => buildCatIndex(wsCats.value))
/** 卡片按分类分桶（O(1) 取「某分类的卡」，替代反复 filter 全量卡） */
const resBucket = computed(() => buildBucketIndex(allResources.value, (r) => r.categoryId || ''))
const rootCats = computed(() => catIdx.value.roots)
function childCatsOf(pid: string): Category[] {
  return catIdx.value.childrenOf.get(pid) || []
}
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
/** 节点深度（根=0）——R70：带 visited 显式防环（此前仅靠「parentId 单向链」的假设） */
function pyDepthOf(c: Category): number {
  // R71：改走索引缓存（此前每次沿父链全表 find；本函数在 pyramidLevels 里对每个分类各调一次）
  return catIdx.value.depthOf(c.id) - 1  // 索引 depthOf 以根=1 计，本函数历史口径根=0
}
function pyHeightOf(c: Category, seen = new Set<string>()): number {
  // R70：带 visited——防环
  if (seen.has(c.id)) return 1
  seen.add(c.id)
  const ch = catIdx.value.childrenOf.get(c.id) || []
  return ch.length ? Math.max(...ch.map(x => pyHeightOf(x, seen))) + 1 : 1
}
/** 层级上限工具（复用 R61-4 口径：分类最多 4 级） */
function pyLevelOf(c: Category): number { return pyDepthOf(c) + 1 }

// ===== R62-1/2：策展台 5 指标 + 下钻 =====
// R112 性能：复用 allResources 已算好的 boardCardsOf 结果（此前 metrics 与 allResources
// 各算一遍 boardCardsOf ⇒ 每次切换/搜索对全部资源多做一次全量遍历 + 建 Map/Set）
const metrics = computed(() => curationMetrics(d.value, workspaceId.value, allResources.value))
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

// R47-B4：进入/切换策展台 = 一次「调用」，计入热度（全局检索无输入时策展台参与热度排序）
// R112 性能：**落盘节流**。原实现每次切台立即 store.persist()，300ms 防抖后同步执行整树
// JSON.stringify + JSON.parse（medium 规模 ~800 卡 / 100 分类）——切台窗口长任务的来源之一。
// 热度是统计信息：内存态即时更新已保证本会话 UI 正确，落盘合并到 4s 后；
// 页面隐藏 / 组件卸载时补一次，避免「切台后立刻关页」丢数据。
let wsOpenPersistTimer: ReturnType<typeof setTimeout> | null = null
function scheduleWsOpenPersist() {
  if (wsOpenPersistTimer) clearTimeout(wsOpenPersistTimer)
  wsOpenPersistTimer = setTimeout(() => { wsOpenPersistTimer = null; store.persist() }, 4000)
}
function flushWsOpenPersist() {
  if (wsOpenPersistTimer) { clearTimeout(wsOpenPersistTimer); wsOpenPersistTimer = null; store.persist() }
}
function onWsOpenVisibility() { if (document.visibilityState === 'hidden') flushWsOpenPersist() }
watch(workspaceId, (id) => {
  if (!id) return
  const ws = d.value?.workspaces?.find(w => w.id === id)
  if (ws) { recordWorkspaceOpen(d.value, ws); scheduleWsOpenPersist() }
}, { immediate: true })

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
 *  R110-BUG1：脏数据（视图模型标记被误持久化）已由启动期 scrubHubMirrorMarkers 净化 +
 *  curationMetrics 对 hub 台镜像计数恒 0 双重兜底，此处异常提示分支已退役，
 *  口径恒为「分类 N · 待分类 M」。 */
const hubCountHint = computed(() => `分类 ${metrics.value.categoryCount} · 待分类 ${uncategorizedCount.value}`)
/** R119：资源台指标条「附件数量」格的三档构成后缀（原型「(12图 · 4PDF · 2HTML)」）——
 *  数据源就是 drill 抽屉在用的 metrics.attachmentItems（同源同口径，不新增计算）。
 *  三档全为 0 时返回空串，模板侧 v-if 不渲染，避免出现「(0图 · 0PDF · 0HTML)」噪声。 */
const assetKindText = computed(() => {
  const it = metrics.value.attachmentItems
  if (!it.length) return ''
  let img = 0, pdf = 0, html = 0
  for (const a of it) {
    if (a.kind === 'image') img++
    else if (a.kind === 'pdf') pdf++
    else html++
  }
  const seg: string[] = []
  if (img) seg.push(`${img}图`)
  if (pdf) seg.push(`${pdf}PDF`)
  if (html) seg.push(`${html}HTML`)
  return seg.length ? `(${seg.join(' · ')})` : ''
})

// ===== 字段渲染（F1：全局设置的字段设计在此生效） =====
const rFields = computed(() => visibleFields(d.value.fieldConfig, 'resource'))
/** R112 性能：主题卡字段组也预计算（此前 fieldsOf 每次调用都跑一遍 visibleFields 过滤） */
const thesisFields = computed(() => visibleFields(d.value.fieldConfig, 'thesis'))
/** R62-3：主题卡（isThesis 资源卡）走 thesis 独立字段组，其余走 resource 组
 *  R112：改为返回**已缓存的 computed 引用**——此前每卡每次重渲染都新建一个数组，
 *  400 卡 × 每次键入重渲染会持续产生垃圾（CPU profile 中 (program) 占比高即 GC 压力）。 */
function fieldsOf(r: ResourceCard): FieldDef[] {
  return (r.isThesis && !isMirrorView(r)) ? thesisFields.value : rFields.value
}
const titleKey = computed(() => rFields.value.find(f => isTitleKey(f.key))?.key || 'title')
/** R117（04-61 D）：取消原 slice(0, 3) 截断——「卡片与字段管理」里设为可见的字段必须都能在列表上看到 */
const listFields = computed(() => rFields.value.filter(f => !isTitleKey(f.key) && f.key !== 'assets'))
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

// ===== 卡面所属分类徽标工具（R64-F10 / 批量移动共用）=====
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

// ===== R49-G3：全局检索分类定位闪节点（/workspace/:id?cat=xx）=====
const catFlashId = ref<string | null>(null)

// ===== 下钻抽屉（R62-2）：状态与数据拆入 useCurationDrill =====
// 状态与数据迁入 composable，落点导航回调（onDrill*）留宿主——它们写视图状态，是接线不是实现。
const { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillRecent } = useCurationDrill({
  allResources, resBucket, catIdx, isUncat
})

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

// R113-N2：生命周期面板接线移除（原 R110-LC 块）——归档提示条改跳 设置→总览·资源生命周期

// ===== R115 拆分接线：视图域（视图模式/排序/筛选/搜索/分组/增量渲染/看板）=====
const {
  viewMode, applyWsView, setViewMode, pyFold, resCols, colsNow,
  SORT_BY_KEYS, SORT_LABELS, FILTER_KEYS, FILTER_LABELS,
  sortBy, sortDir, filterBy, searchQuery, debouncedQuery, activeCategory,
  toggleSortDir, density, activeCategoryLabel, mountedResIds,
  hasActiveFilter, filterLabel, parseQuery, matchCard, resetFilters,
  filterSummary, filterPopTitle, resetAllFilters, isBrokenPath, FILTER_PREDICATES,
  applyViewFilters, filteredResources, archivedHintCount,
  applySort, applyGroupSort, sortedResources,
  collapsedGroups, toggleGroupCollapse, resourceGroups,
  RENDER_STEP, renderLimit, totalVisibleCount, renderedGroups, renderedCount, hasMoreToRender,
  onContentScroll, renderMore, ensureCardRendered, groupChildCount,
  kanbanCategories, resourcesByCategory, kanbanColumns,
  kanbanMore, onKanbanColScroll,
} = useResourceView({
  store, d, workspaceId, allResources, thesisCard, categories, wsCats, catIdx, resBucket,
  rootCats, childCatsOf, familyIds, isUncat, isHub,
})
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

// ===== R115 拆分接线：分类侧栏 UI 域（树折叠/侧栏序列/树宽拖拽）=====
const {
  pinnedRootCats, unpinnedRootCats, treeCatOptions,
  collapsedCats, toggleCatCollapse, collapseAllCats, expandAllCats, selectSidebarCat, sidebarCats,
  SIDE_W_DEF, wsSideW, startSideResize, resetSideWidth,
} = useCatSidebar({
  store, wsCats, catIdx, resBucket, rootCats, activeCategory, childCatsOf, catAggCount,
})

// ===== R103（纯拆分第四批）：镜像域拆入 useWorkspaceMirror =====
// 引用侧（移出镜像/落点更新/定位源卡）+ 推送侧（单卡 📡/分类 📤）+ 拉取侧（分类镜像到本台）
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
const {
  isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,
  boards, mirrorPushModal, openMirrorCard, openMirrorCat, mirrorPushTargetCats, confirmMirrorPush,
  mirrorCatModal, hubCatOptions, confirmMirrorCat
} = useWorkspaceMirror({ d, workspaceId, categories, router, treeCatOptions, persist: () => store.persist() })

// ===== R104（纯拆分第五批·收缩版）：分类 CRUD 拆入 useCategoryCrud =====
// 新建/重命名/删除（含镜像级联清理）/置顶/重复合并 实现随迁；拖拽与侧栏折叠/选择是视图接线，留宿主
// （与金字塔深度工具、卡片拖拽状态双向咬合，硬拆需先立共享拖拽状态层——R115 已立 dragState）。
const { normalizeCatOrders, catModal, openCreateCat, openRenameCat, catNameDup, confirmCatModal, deleteCategory, toggleCatPin, mergeDupCats } = useCategoryCrud({
  d, persist: () => store.persist(), workspaceId, wsCats, activeCategory, allResources,
  pyDepthOf, childCatsOf, catAggCount
})

// ===== R115 拆分接线：资源打开域（预览/双击打开统一通道）=====
const { previewOpen, previewUrl, previewName, closePreview, openImageAsset, openResourceLink } = useResourceOpen({ store, d })

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

// ===== R115 拆分接线：编辑抽屉域（单击/双击分流/CRUD/右键菜单）=====
const {
  onCardClick, onCardDblClick,
  drawerOpen, editingResource, isNewResource, drawerReadonly,
  newCardCatId, openNewResource, addResourceToCategory, openMirrorDetail,
  cleanAllMirrors, locateMirrorSourceCard, openResource, closeDrawer,
  saveResource, deleteCurrentResource, deleteResource, togglePin, toggleStar, copyLink, goToTask,
  resFormRef, fixLink, resCtx, resCtxItems, openResCtx,
} = useResourceDrawer({
  store, d, workspaceId, router, isHub, categories, activeCategory, thesisCard,
  openResourceLink, openImageAsset, setThesisCard, unsetThesis,
  batchMode, toggleSelect, openMoveOne, openMountOne, mountedTaskCount,
  openMirrorCard, removeMirror, locateMirrorSource,
})

// ===== R100（纯拆分第一批）：导入三链路（数据包 / 书签 / 本地文件）拆入 useWorkspaceImport =====
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——模板与既有断言的入口面不变（04-49 任务书）。
const {
  importModalOpen, boardImportInput,
  bookmarkInput, fileImportInput, bookmarkModalOpen, bkFolders,
  allBkChecked, bkTotalCount,
  handleBoardImport, handleBookmarkImport, confirmBookmarkImport, toggleAllBk,
  fileImport, handleFileImport, makeHubResource
} = useWorkspaceImport({ d, workspaceId, newCardCatId, persist: () => store.persist() })

// ===== R115 拆分接线：拖拽域（卡片/看板/分类/区域拖拽全量；共享拖拽状态层 dragState）=====
const {
  dragState, dropMark, markDrop, clearDropMark, acceptDragOver, clearDragState, onDragStart,
  groupKeyOf, onDropCard, onKanbanCardDrop, onDropToCategory,
  catKeyToCatId, onAreaDragOver, onAreaDrop, reorderMixed,
  catDropTarget, catDropMode, cardDropTarget,
  onUncatDragOver, onUncatDrop, clearCardDropTarget,
  onCatDragStart, onCatDragEnd, onCatDragOver, onCatDrop, onCatRootDrop,
} = useResourceDragDrop({
  store, d, wsCats, rootCats, categories, activeCategory, sortBy, isUncat,
  familyIds, childCatsOf, childIds, pyDepthOf, pyHeightOf,
  moveMirrorTo, normalizeCatOrders,
})
/** 模板「升为一级」落点显隐消费 dragCatId（原宿主 let 变量的派生只读视图） */
const dragCatId = computed(() => dragState.cat)

// ===== R115 拆分接线：金字塔域（布局/连线/全屏/节点拖拽/节点菜单/打包/模板导入）=====
const {
  pyramidImportOpen, confirmPyramidImport,
  pyramidLevels, pyLayout, moveCatSibling,
  linkCardsModal, linkCardsQ, openLinkCards, toggleLinkPick, linkCandidates, confirmLinkCards,
  pyWrapRef, pyFs, pyFsFallback, wsPageRef,
  enterPyFullscreen, exitPyFullscreen, togglePyFullscreen,
  pyLinkPaths, drawPyLinks, pyLinksThrottled,
  pyDropTarget, pyDropMode, pyRootDrop, onPyDragOver, onPyDrop, onPyRootDragOver, onPyRootDrop,
  selectPyNode,
  nodeMenu, openNodeMenu, nmCreateChild, nmCreateSibling, nmMirrorCat, nmPack, nmRename, nmDelete,
  packIntoNode,
} = usePyramid({
  store, d, workspaceId, wsCats, catIdx, allResources, thesisCard,
  viewMode, pyFold, activeCategory, catFlashId, setViewMode, openInputModal,
  pyDepthOf, pyHeightOf, pyLevelOf, childIds,
  dragState, onCatDragEnd, clearCardDropTarget,
  moveMirrorTo, mirrorCatModal, normalizeCatOrders, openCreateCat, openRenameCat, deleteCategory,
  selectedCards, selectedIds,
})

// ---- R113-N1：分类行「⋯」溢出菜单（fixed 定位——不被侧栏 overflow-y 裁剪；out-of-flow 不进 flex 布局）----
// 原实现把 5 个操作图标平铺在分类行上、且 hover 时顶掉计数，用户反馈"入口太多快淹没文件夹"。
// 现只留「＋ 子分类」与「⋯」，其余四项收进本菜单（主次分明 + 破坏性操作进二级）。
const catMenu = ref<{ open: boolean; x: number; y: number; cat: Category | null; depth: number; pinned: boolean; canMirror: boolean }>(
  { open: false, x: 0, y: 0, cat: null, depth: 0, pinned: false, canMirror: false }
)
function openCatMenu(ev: MouseEvent, sc: SidebarCat) {
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  const MENU_W = 168
  catMenu.value = {
    open: true,
    x: Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8)),
    y: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 172)),
    cat: sc.cat,
    depth: sc.depth,
    pinned: !!sc.cat.pinned,
    canMirror: !!(isHub.value && !isMirrorCat(sc.cat))
  }
}
function runCatMenu(action: 'pin' | 'mirror' | 'rename' | 'delete') {
  const c = catMenu.value.cat
  catMenu.value.open = false
  if (!c) return
  if (action === 'pin') toggleCatPin(c)
  else if (action === 'mirror') openMirrorCat(c)
  else if (action === 'rename') openRenameCat(c)
  else if (action === 'delete') void deleteCategory(c)
}

// ===== R88（W3）：工具条分级——「筛选」气泡与 ⚙ 菜单（互斥浮层，留宿主）=====
const filterPopOpen = ref(false)
function toggleFilterPop() {
  const next = !filterPopOpen.value
  settingsMenuOpen.value = false        // 与 ⚙ 互斥
  filterPopOpen.value = next
}
function closeFilterPop() { filterPopOpen.value = false }
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

onMounted(() => { applyWsView(); window.addEventListener('dragend', clearCardDropTarget); document.addEventListener('click', closeSettingsMenu); document.addEventListener('click', closeFilterPop); window.addEventListener('resize', pyLinksThrottled); document.addEventListener('visibilitychange', onWsOpenVisibility); nextTick(drawPyLinks) })
// R88（W3）：筛选气泡与 ⚙ 菜单同为"点外部关闭"的浮层，卸载时一并摘掉监听
// R112：同时补一次热度落盘（组件真正卸载时，节流中的待写数据不能丢）
onUnmounted(() => { flushWsOpenPersist(); window.removeEventListener('dragend', clearCardDropTarget); window.removeEventListener('resize', pyLinksThrottled); document.removeEventListener('click', closeSettingsMenu); document.removeEventListener('click', closeFilterPop); document.removeEventListener('visibilitychange', onWsOpenVisibility) })

// ===== 设置菜单关闭 + 采集跳转高亮 =====
const highlightId = ref<string | null>(null)
// ===== R115 拆分接线：附件卫生域（R110-BUG2 跨台判定/定位/清理）=====
const { cardExistsGlobally, referencedAssetIds, onDrillLocateAsset, onDrillCleanupAsset, onDrillCleanupOrphans } = useWsAssetHygiene({
  store, d, workspaceId, router, drillOpen, activeCategory, viewMode, highlightId, ensureCardRendered,
})
// 第廿九轮：document click / window dragend 监听统一在上方 onMounted 注册

// ===== R117 拆分接线：资源台定位域（?hl= 卡片定位 / ?cat= 分类定位，均含增量渲染前置）=====
// 实现迁至 composables/useWsLocate.ts——两条链路共用「先切分类（展开祖先）再滚卡片」一套口径，
// 并统一在做 querySelector 之前调 ensureCardRendered（R112/R116 增量渲染后目标卡可能未进渲染集）。
useWsLocate({
  route, router, categories, collapsedCats, activeCategory, viewMode,
  highlightId, catFlashId, searchQuery, debouncedQuery, allResources, familyIds, ensureCardRendered,
})

// ===== R115 拆分接线：台元信息域（台名/图标/描述/重命名/导出/删除）=====
const {
  wsDisplayName, onNameBlur, onNameEnter,
  WS_ICONS, iconPickOpen, iconCustom, iconPickPos, toggleIconPick, setWsIcon,
  onDescBlur, onDescEnter, renameWs, editDesc, exportWorkspace, deleteWorkspace,
} = useWsMeta({ store, d, workspaceId, workspace, router, settingsMenuOpen, openInputModal })
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
// uid 已从 @/shared/utils 导入（此前为本地重复实现，已统一；R115 随域迁入各 composable）
</script>

<style scoped src="./workspace.css"></style>
