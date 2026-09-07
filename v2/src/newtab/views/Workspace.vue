<template>
  <div class="ws-page" v-if="workspace">
    <!-- ① Hero头部 -->
    <div class="ws-hero">
      <div class="hero-name">
        <!-- B32：图标可点击管理（选择/自定义/删除），名称按规范剥离 icon 前缀显示 -->
        <span class="icon ws-icon-btn" title="点击更换或删除图标" @click.stop="toggleIconPick">{{ workspace.icon || '📁' }}</span>
        <span class="name-text" contenteditable="true" spellcheck="false" @blur="onNameBlur" @keydown.enter.prevent="onNameEnter">{{ wsDisplayName }}</span>
      </div>
      <!-- B32：图标管理弹层（Teleport 到 body，避免被 hero overflow 裁剪） -->
      <Teleport to="body">
        <div v-if="iconPickOpen" class="icon-pick-mask" @click="iconPickOpen = false" />
        <div v-if="iconPickOpen" class="icon-pick" :style="{ left: iconPickPos.left + 'px', top: iconPickPos.top + 'px' }" @click.stop>
          <div class="ip-title">🎨 工作台图标</div>
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
      <div class="hero-desc" contenteditable="true" @blur="onDescBlur" @keydown.enter.prevent="onDescEnter">{{ workspace.desc || '点击编辑工作台描述...' }}</div>
      <div class="hero-bottom">
        <div class="hero-stats">
          <span>📊 <b>{{ resourceCount }}</b> 张资源卡</span>
          <span>📁 <b>{{ categoryCount }}</b> 个分类</span>
          <span>🟢 今日新增 <b>{{ wsTodayAdd }}</b></span>
          <span>🔴 今日删除 <b>{{ wsTodayDel }}</b></span>
          <span>🕐 最近更新 {{ lastUpdateText }}</span>
        </div>
        <div class="hero-actions">
          <button class="hero-btn primary" @click="importModalOpen = true">⬇ 导入资源</button>
          <button class="hero-btn ghost" @click="openNewResource">＋ 新建资源卡</button>
          <button class="hero-btn settings" @click.stop="settingsMenuOpen = !settingsMenuOpen">⚙</button>
        </div>
      </div>
    </div>

    <!-- 设置下拉菜单（固定定位，避免被 hero 圆角裁剪） -->
    <div class="settings-menu" :class="{open: settingsMenuOpen}" @click.stop>
      <div class="sm-item" @click="renameWs">✏️ 重命名</div>
      <div class="sm-item" @click="editDesc">📝 编辑描述</div>
      <div class="sm-divider"></div>
      <div class="sm-item" @click="exportWorkspace">📦 导出工作台数据</div>
      <div class="sm-divider"></div>
      <div class="sm-item danger" @click="deleteWorkspace">🗑 删除工作台</div>
    </div>

    <!-- ② 策展工具条 -->
    <div class="ws-toolbar">
      <div class="view-tabs">
        <div class="view-tab" :class="{active: viewMode==='card'}" @click="viewMode='card'">▦ 卡片</div>
        <div class="view-tab" :class="{active: viewMode==='list'}" @click="viewMode='list'">☰ 列表</div>
        <div class="view-tab" :class="{active: viewMode==='kanban'}" @click="viewMode='kanban'">▤ 看板</div>
      </div>
      <select class="toolbar-select" v-model="sortBy">
        <option value="manual">手动拖拽</option>
        <option value="recent">最近添加</option>
        <option value="visited">最近访问</option>
        <option value="title">标题 A-Z</option>
      </select>
      <!-- 第卅二轮 REQ-007：时间排序方向切换（默认倒序，偏好本地记忆） -->
      <button v-if="sortBy==='recent' || sortBy==='visited'" class="toolbar-select sort-dir-btn" :title="sortDir==='desc' ? '当前倒序（新→旧），点击切换正序' : '当前正序（旧→新），点击切换倒序'" @click="toggleSortDir">{{ sortDir==='desc' ? '↓ 新→旧' : '↑ 旧→新' }}</button>
      <select class="toolbar-select" v-model="filterBy">
        <option value="all">全部</option>
        <option value="url">URL链接</option>
        <option value="file">本地文件</option>
        <option value="obsidian">Obsidian</option>
      </select>
      <!-- 第卅三轮 REQ-026：密度档位（紧凑/舒适，记忆 UIPrefs.density） -->
      <select class="toolbar-select" v-model="density" :title="'密度档位：' + (density === 'compact' ? '紧凑' : '舒适')">
        <option value="cozy">舒适密度</option>
        <option value="compact">紧凑密度</option>
      </select>
      <div class="toolbar-search">
        <span class="s-icon">🔍</span>
        <input type="text" v-model="searchQuery" placeholder="搜索工作台内资源...">
      </div>
      <button class="toolbar-batch" :class="{active: batchMode}" @click="toggleBatchMode">{{ batchMode ? '✓ 完成批量' : '☑ 批量管理' }}</button>
    </div>

    <!-- ③ 资源策展区 -->
    <div class="ws-body">
      <!-- 左侧分类导航（第八轮：树形 2 级 + 置顶分区 + 拖拽排序/挂子级；R48-V2：Linear 风格树 + 展开/折叠） -->
      <div class="ws-sidebar">
        <div class="cat-toolbar">
          <span class="ct-label">目录</span>
          <span class="ct-actions">
            <span class="ct-btn" title="一键收纳为工作台根部" @click="collapseAllCats">⊟ 收起</span>
            <span class="ct-btn" title="全部展开" @click="expandAllCats">⊞ 展开</span>
          </span>
        </div>
        <div class="cat-item" :class="{active: activeCategory==='all'}" @click="activeCategory='all'">
          <span class="cat-icon">📁</span><span class="cat-name">全部</span>
          <span class="cat-count">{{ allResources.length }}</span>
        </div>
        <!-- 第廿九轮：「待分类」成为卡片归属落点 -->
        <div class="cat-item" :class="{active: activeCategory==='uncat', 'card-drop': cardDropTarget==='uncat'}" @click="activeCategory='uncat'"
          @dragover="onUncatDragOver" @dragleave="cardDropTarget==='uncat' && (cardDropTarget='')" @drop.stop="onUncatDrop">
          <span class="cat-icon">📥</span><span class="cat-name">待分类</span>
          <span class="cat-count">{{ uncategorizedCount }}</span>
        </div>
        <div class="cat-divider"></div>
        <template v-for="sc in sidebarCats" :key="sc.cat.id">
          <div v-if="sc.sectionLabel" class="cat-section-label">{{ sc.sectionLabel }}</div>
          <div class="cat-item" :class="{
              active: activeCategory===sc.cat.id,
              sub: sc.depth===1,
              collapsed: sc.depth===0 && collapsedCats.has(sc.cat.id),
              flash: catFlashId===sc.cat.id,
              'card-drop': cardDropTarget===sc.cat.id,
              'drop-child': catDropTarget===sc.cat.id && catDropMode==='child',
              'drop-before': catDropTarget===sc.cat.id && catDropMode==='before',
              'drop-after': catDropTarget===sc.cat.id && catDropMode==='after'
            }"
            :data-catid="sc.cat.id"
            :draggable="!batchMode"
            @click="selectSidebarCat(sc)"
            @dragstart="onCatDragStart($event, sc.cat)" @dragend="onCatDragEnd"
            @dragover.prevent.stop="onCatDragOver($event, sc.cat)" @drop.stop="onCatDrop($event, sc.cat)">
            <span v-if="sc.depth===0 && childCatsOf(sc.cat.id).length" class="cat-caret" :class="{open: !collapsedCats.has(sc.cat.id)}" title="展开/折叠" @click.stop="toggleCatCollapse(sc.cat.id)">▸</span>
            <span v-else-if="sc.depth===0" class="cat-caret placeholder"></span>
            <span class="cat-icon" :title="sc.depth===0 && childCatsOf(sc.cat.id).length ? '展开/折叠' : ''" @click.stop="sc.depth===0 && childCatsOf(sc.cat.id).length && toggleCatCollapse(sc.cat.id)">{{ sc.depth===1 ? '↳' : sc.cat.pinned ? '📌' : (childCatsOf(sc.cat.id).length ? (collapsedCats.has(sc.cat.id) ? '📁' : '📂') : '📁') }}</span>
            <span class="cat-name">{{ sc.cat.name }}</span>
            <span class="cat-actions">
              <span v-if="sc.depth===0" class="cat-act" :class="{on: sc.cat.pinned}" :title="sc.cat.pinned?'取消置顶':'置顶'" @click.stop="toggleCatPin(sc.cat)">📌</span>
              <!-- 第卅三轮 BUG-C 修复 + REQ-022：父级分类 hover 出现「创建子分类」入口（此前 openCreateCat 恒空参，弹窗父级提示不可达） -->
              <span v-if="sc.depth===0" class="cat-act" title="创建子分类" @click.stop="openCreateCat(sc.cat.id)">＋</span>
              <span class="cat-act" title="重命名" @click.stop="openRenameCat(sc.cat)">✎</span>
              <span class="cat-act" title="整组投射到策展中心" @click.stop="projectCategoryToCuration(sc.cat)">📤</span>
              <span class="cat-act danger" title="删除" @click.stop="deleteCategory(sc.cat)">🗑</span>
            </span>
            <span class="cat-count">{{ sc.depth===1 ? allResources.filter(r=>r.categoryId===sc.cat.id).length : catAggCount(sc.cat.id) }}</span>
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
        <!-- ===== 卡片视图：REQ-027 按分类分组分区（取消全平铺/置顶独立分区） ===== -->
        <div v-if="viewMode==='card'">
          <template v-for="(g, gi) in resourceGroups" :key="g.key">
            <div class="section-label ws-cat-head" :class="{first: gi===0}" @click="toggleGroupCollapse(g.key)">
              <span>📁 {{ g.title }} · {{ g.count }}</span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="card-grid">
              <div v-for="r in g.items" :key="r.id" class="res-card" :class="{pinned: r.pinned, flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :data-rid="r.id" :draggable="!batchMode" @click="onCardClick(r)" @dblclick="onCardDblClick(r)"
                @dragstart="onDragStart($event,r)" @dragover.prevent="markDrop($event, r.id, 'x')" @drop="onDropCard($event,r)" @dragleave="clearDropMark"
                @contextmenu.prevent="openResCtx($event, r)">
                <div v-if="batchMode" class="rc-batch-check" :class="{on: selectedIds.has(r.id)}" @click.stop="toggleSelect(r.id)">{{ selectedIds.has(r.id)?'✓':'' }}</div>
                <div class="res-card-actions">
                  <div class="rc-action pin" @click.stop="togglePin(r)" title="置顶">📌</div>
                  <div class="rc-action" :class="{on: r.starred}" :title="r.starred?'取消星标':'星标'" @click.stop="toggleStar(r)">⭐</div>
                  <div class="rc-action" @click.stop="openMoveOne(r)" title="移动分类">📂</div>
                  <!-- R53-B：卡面单卡镜像入口（与右键菜单同函数） -->
                  <div v-if="r.workspaceId !== CURATION_WS_ID" class="rc-action" @click.stop="projectCardToCuration(r)" title="镜像到策展中心">📡</div>
                  <div class="rc-action delete" @click.stop="deleteResource(r)" title="删除">🗑</div>
                </div>
                <div class="rc-fields">
                  <template v-for="f in rFields" :key="f.key">
                    <div v-if="isTitleKey(f.key)" class="rc-title">{{ val(r, f.key) }}</div>
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
                  <span class="rc-cat" :class="{hidden: hideGroupBadge}" title="点击查看所在分类" @click.stop="activeCategory = r.categoryId || 'uncat'">{{ catIconOf(r) }} {{ catNameOfFamily(r) }}</span>
                  <span v-if="r.callCount" class="rc-calls" title="被打开次数">🔥{{ r.callCount }}</span>
                  <span class="rc-open-hint">双击打开链接</span>
                </div>
              </div>
              <div v-if="gi === resourceGroups.length - 1" class="rc-add-card" @click="openNewResource">
                <span style="font-size:20px">＋</span><span>新建资源卡</span>
              </div>
            </div>
          </template>

          <EmptyState v-if="!resourceGroups.length" icon="folder" title="暂无资源卡"
            desc="双击卡片直达链接；单击查看详情。用 Ctrl+Shift+J 可从任意网页采集"
            action-label="＋ 新建资源卡" @action="openNewResource" />
        </div>

        <!-- ===== 列表视图：REQ-027 按分类分组分区（每分区标题行 + 其下条目） ===== -->
        <div v-if="viewMode==='list'">
          <template v-for="(g, gi) in resourceGroups" :key="g.key">
            <div class="section-label ws-cat-head" :class="{first: gi===0}" @click="toggleGroupCollapse(g.key)">
              <span>📁 {{ g.title }} · {{ g.count }}</span>
              <span class="ws-cat-collapse">{{ collapsedGroups.has(g.key) ? '▸' : '▾' }}</span>
            </div>
            <div v-show="!collapsedGroups.has(g.key)" class="res-list">
              <div v-for="r in g.items" :key="r.id" class="res-row" :class="{pinned: r.pinned, flash: highlightId===r.id, selected: batchMode && selectedIds.has(r.id), 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :data-rid="r.id" :draggable="!batchMode" @click="onCardClick(r)" @dblclick="onCardDblClick(r)"
                @dragstart="onDragStart($event,r)" @dragover.prevent="markDrop($event, r.id, 'x')" @drop="onDropCard($event,r)" @dragleave="clearDropMark"
                @contextmenu.prevent="openResCtx($event, r)">
                <div v-if="batchMode" class="rc-batch-check" :class="{on: selectedIds.has(r.id)}" @click.stop="toggleSelect(r.id)">{{ selectedIds.has(r.id)?'✓':'' }}</div>
                <span v-else class="rr-drag">⋮⋮</span>
                <span class="rr-title">{{ val(r, titleKey) }}</span>
                <AssetBadge v-if="hasField('assets') && r.assets?.length" :assets="r.assets" class="rr-assets" />
                <span class="rr-f" v-for="f in listFields" :key="f.key">{{ shortVal(r, f) }}</span>
                <span class="rr-actions">
                  <span class="rr-action" @click.stop="togglePin(r)" :title="r.pinned?'取消置顶':'置顶'">📌</span>
                  <span class="rr-action" :class="{on: r.starred}" @click.stop="toggleStar(r)" :title="r.starred?'取消星标':'星标'">⭐</span>
                  <span class="rr-action delete" @click.stop="deleteResource(r)">🗑</span>
                </span>
              </div>
            </div>
          </template>
          <div v-if="!resourceGroups.length" class="empty-state">暂无资源卡，点击右上角"新建资源卡"添加</div>
        </div>

        <!-- 看板视图 -->
        <div v-if="viewMode==='kanban'" class="kanban">
          <div v-for="cat in kanbanCategories" :key="cat.key" class="kanban-col"
            @dragover.prevent @drop="onDropToCategory($event,cat.key)">
            <div class="kc-header">
              <span class="kc-name">📂 {{ cat.name }}</span>
              <span class="kc-count">{{ resourcesByCategory(cat.key).length }}</span>
              <div class="kc-add" @click="addResourceToCategory(cat.key)" title="在此分类新建">＋</div>
            </div>
            <div class="kc-body">
              <div v-for="r in resourcesByCategory(cat.key)" :key="r.id" class="kc-card" :class="{pinned: r.pinned, 'drop-line-t': dropMark===r.id+'-t', 'drop-line-b': dropMark===r.id+'-b'}"
                :draggable="!batchMode" @dragstart="onDragStart($event,r)" @dragover.prevent.stop="markDrop($event, r.id, 'y')" @dragleave="clearDropMark" @drop.stop="onKanbanCardDrop($event, r)" @click="onCardClick(r)" @dblclick="onCardDblClick(r)">
                <div class="kc-card-title">
                  <span v-if="r.starred" class="kc-star" title="已星标">⭐</span>{{ val(r, titleKey) }}
                  <span class="kc-del" title="删除" @click.stop="deleteResource(r)">🗑</span></div>
                <div class="kc-card-footer">
                  <span v-if="hasField('tags') && r.tags.length" v-for="t in r.tags" :key="t" class="kc-card-tag">#{{ t }}</span>
                  <span class="kc-card-link" :class="r.linkType" v-if="r.link">{{ linkIcon(r.linkType) }}</span>
                  <span v-if="hasField('assets') && r.assets?.length" class="kc-card-assets"><AssetBadge :assets="r.assets" /></span>
                </div>
              </div>
            </div>
          </div>
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

    <!-- 导入弹窗：书签导入 / 本地文件导入 -->
    <div class="modal-overlay" :class="{open: importModalOpen}" @click.self="importModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span style="font-size:16px">⬇</span>
          <span class="mh-title">导入资源</span>
          <div class="modal-close" @click="importModalOpen=false">×</div>
        </div>
        <div class="modal-body">
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
        </div>
      </div>
    </div>
    <input ref="bookmarkInput" type="file" accept=".html,.htm" style="display:none" @change="handleBookmarkImport" />
    <input ref="fileImportInput" type="file" multiple style="display:none" @change="handleFileImport" />

    <!-- 书签导入：文件夹选择（第卅轮：文件夹结构生成为分类树） -->
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

    <!-- 批量移动弹窗（第八轮：工作台→分类级联，含当前工作台） -->
    <div class="modal-overlay" :class="{open: moveModalOpen}" @click.self="moveModalOpen=false">
      <div class="modal" style="width:420px">
        <div class="modal-header">
          <span style="font-size:16px">📦</span>
          <span class="mh-title">移动 {{ selectedIds.size }} 张资源卡</span>
          <div class="modal-close" @click="moveModalOpen=false">×</div>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <div class="dr-label">目标工作台（含当前工作台，可只换分类）</div>
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
          <div v-if="catNameDup" class="ws-modal-error">⚠ 该工作台已存在同名分类，请更换名称</div>
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

    <!-- 第八轮：通用输入弹窗（工作台重命名/描述） -->
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

  </div>
  <div v-else class="ws-empty">工作台不存在</div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { recordResourceOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { saveUIPrefs } from '@/shared/storage/repository'
import { showToast } from '@/shared/components/toast'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { uid, safeDecodeText } from '@/shared/utils'
import EmptyState from '@/shared/components/EmptyState.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'
import { useConfirm } from '@/shared/components/confirm'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import { markRank } from '@/shared/utils/marksort'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import { CURATION_WS_ID, type AppData, type ResourceCard, type Category, type Workspace, type TaskCard, type FieldDef } from '@/shared/models'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

const workspaceId = computed(() => route.params.id as string)
const workspace = computed(() => d.value.workspaces.find(w => w.id === workspaceId.value))

// R47-B4：进入/切换工作台 = 一次「调用」，计入热度（全局检索无输入时工作台参与热度排序）
watch(workspaceId, (id) => {
  if (!id) return
  const ws = d.value?.workspaces?.find(w => w.id === id)
  if (ws) { recordWorkspaceOpen(d.value, ws); store.persist() }
}, { immediate: true })


// ===== 数据 =====
const allResources = computed(() => d.value.resources.filter(r => r.workspaceId === workspaceId.value && !r.deletedAt))
const categories = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value).sort((a,b) => a.order - b.order))
const resourceCount = computed(() => allResources.value.length)
const categoryCount = computed(() => categories.value.length)
const uncategorizedCount = computed(() => allResources.value.filter(r => !r.categoryId).length)
// R45-2（V2.20.0）：页头新增「今日新增/今日删除」字段——工作台范围实时派生（含软删口径：新增排除已删、删除取 deletedAt）
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

// ===== 字段渲染（F1：全局设置的字段设计在此生效） =====
const rFields = computed(() => visibleFields(d.value.fieldConfig, 'resource'))
const titleKey = computed(() => rFields.value.find(f => isTitleKey(f.key))?.key || 'title')
const listFields = computed(() => rFields.value.filter(f => !isTitleKey(f.key) && f.key !== 'assets').slice(0, 3))
function hasField(key: string): boolean {
  return rFields.value.some(f => f.key === key)
}
function val(r: ResourceCard, key: string): string {
  return fieldValue(r, key, {
    catName: (id) => categories.value.find(c => c.id === id)?.name || '待分类',
    wsName: (id) => d.value.workspaces.find(w => w.id === id)?.name || ''
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
const viewMode = ref<'card'|'list'|'kanban'>('card')
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

if (store.ui?.sortPrefs?.res?.by) sortBy.value = store.ui.sortPrefs.res.by
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

// 筛选（第八轮：点击父分类 = 聚合显示本级 + 全部子分类）
const filteredResources = computed(() => {
  let list = allResources.value
  if (activeCategory.value === 'uncat') list = list.filter(r => !r.categoryId)
  else if (activeCategory.value !== 'all') {
    const ids = familyIds(activeCategory.value)
    list = list.filter(r => r.categoryId && ids.includes(r.categoryId))
  }
  if (filterBy.value !== 'all') list = list.filter(r => r.linkType === filterBy.value)
  if (debouncedQuery.value.trim()) {
    const q = debouncedQuery.value.toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q) || (Array.isArray(r.tags) ? r.tags : []).join(',').toLowerCase().includes(q))
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
interface ResourceGroup { key: string; title: string; count: number; items: ResourceCard[] }
/** F-027-4 折叠增强：点击分组标题折叠/展开（内存态，不持久化） */
const collapsedGroups = ref<Set<string>>(new Set())
/** REQ-028：分组视图下分类徽标弱化/隐藏（归属已由分区标题表达，避免信息重复） */
const hideGroupBadge = ref(true)
function toggleGroupCollapse(key: string) {
  const s = new Set(collapsedGroups.value)
  if (s.has(key)) s.delete(key); else s.add(key)
  collapsedGroups.value = s
}
/**
 * 分区规则（分区顺序与左侧分类树一致）：
 * - 「全部」：每个一级分类一个分区（rootCats 顺序）；无分类卡归「待分类」分区置于最前
 * - 选中父分类：直属父级的卡归「未细分」分区置于最前；其下每个二级子分类一个分区（子分类名为分组标题）
 * - 选中「待分类」：单分区
 * 分区内按当前排序规则排列（applySort；manual 保持数组序=手动拖拽序）。
 */
const resourceGroups = computed<ResourceGroup[]>(() => {
  const filtered = filteredResources.value
  const groups: ResourceGroup[] = []
  const validIds = new Set(wsCats.value.map(c => c.id))
  const uncat = applyGroupSort(filtered.filter(r => !r.categoryId || !validIds.has(r.categoryId)))
  if (uncat.length) groups.push({ key: 'uncat', title: '待分类', count: uncat.length, items: uncat })
  if (activeCategory.value === 'all') {
    for (const root of rootCats.value) {
      const ids = familyIds(root.id)
      const items = applyGroupSort(filtered.filter(r => r.categoryId && ids.includes(r.categoryId)))
      if (items.length) groups.push({ key: root.id, title: root.name, count: items.length, items })
    }
  } else if (activeCategory.value !== 'uncat') {
    // REQ-032：直属未细分资源强制排在最上方第一区块（子分类分区之前）
    const direct = applyGroupSort(filtered.filter(r => r.categoryId === activeCategory.value))
    if (direct.length) groups.push({ key: 'direct', title: '未细分', count: direct.length, items: direct })
    for (const sub of childCatsOf(activeCategory.value)) {
      const items = applyGroupSort(filtered.filter(r => r.categoryId === sub.id))
      if (items.length) groups.push({ key: sub.id, title: sub.name, count: items.length, items })
    }
  }
  return groups
})

const kanbanCategories = computed(() => {
  const cats: { key: string; name: string }[] = []
  for (const root of rootCats.value) {
    cats.push({ key: root.id, name: root.name })
    for (const ch of childCatsOf(root.id)) cats.push({ key: ch.id, name: root.name + ' / ' + ch.name })
  }
  cats.push({ key: '', name: '待分类' })
  return cats
})

function resourcesByCategory(catId: string) {
  // R56-V1：看板列内与卡片/列表视图同口径——applySort 消费（手动=拖拽序 curOrder 优先，无拖拽序最新在前）
  return applySort(allResources.value.filter(r => (r.categoryId||'') === catId))
}

// ===== 链接打开（E1：双击 = 打开链接；第卅二轮 REQ-010 归一化逻辑统一在 shared/utils/link） =====
/** 第卌二轮 REQ-061：双击卡片打开——挂了 HTML 附件的资源卡（link=zy-asset://<id>）走 openHtmlAsset
 *  file:// 落盘完整打开，与详情内打开同一函数同一效果（新标签页，内联脚本可运行） */
function openResourceLink(r: ResourceCard) {
  recordResourceOpen(d.value, r)
  store.persist()
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
    const meta = (r.assets || []).find(a => a.id === assetId)
    if (!meta || (meta.kind !== 'html' && meta.kind !== 'pdf')) { showToast('⚠ 卡片指向的文档附件不存在或已失效'); return }
    openHtmlAsset(meta)
    return
  }
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { showToast('⚠ 请先补全链接（本地文件需完整路径，如 D:\\docs\\file.pdf）'); return }
  openExternalLink(url)
}

// 单击（详情）与双击（打开链接）区分
let clickTimer: ReturnType<typeof setTimeout> | null = null
function onCardClick(r: ResourceCard) {
  if (batchMode.value) { toggleSelect(r.id); return }
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
let drawerOriginalWsId = '' // REQ-004：跨工作台迁移检测基准（打开/新建时记录）

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: workspaceId.value, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0 }
}

function openNewResource() {
  Object.assign(editingResource, emptyResource())
  editingResource.id = uid('res')
  editingResource.createdAt = Date.now()
  drawerOriginalWsId = editingResource.workspaceId
  if (activeCategory.value !== 'all' && activeCategory.value !== 'uncat') editingResource.categoryId = activeCategory.value
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
  // REQ-004：检测是否跨工作台迁移，保存后给出迁移反馈
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
    showToast(`✓ 已保存并迁移至「${target?.name.replace(/^[^\s]+\s/, '') || '目标工作台'}」`)
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
  r.deletedAt = Date.now()
  store.persist()
  // REQ-030：3 秒内可撤销（按 id 定位当前树，根治引用替换导致的撤销失效）
  showToast(`已删除「${r.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = d.value.resources.find(x => x.id === r.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}
function togglePin(r: ResourceCard) {
  r.pinned = !r.pinned
  r.updatedAt = Date.now()
  store.persist()
  showToast(r.pinned ? '📌 已置顶' : '已取消置顶')
}
/** 第卅三轮 REQ-020：星标切换（独立于置顶，可叠加） */
function toggleStar(r: ResourceCard) {
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
  resCtxItems.value = [
    { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
    { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
    { label: '移动分类', icon: 'folder', cb: () => openMoveOne(r) },
    { label: r.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => togglePin(r) },
    { label: '📡 镜像到策展中心', icon: 'star', cb: () => projectCardToCuration(r) },
    { label: '删除', icon: 'trash', danger: true, cb: () => deleteResource(r) }
  ]
  resCtx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 240) }
}

/** R50-F3 + R53：单卡镜像到策展中心（引用式镜像记录，落「待分类」；策展中心实时渲染源卡，移出/清空零影响源数据） */
function projectCardToCuration(r: ResourceCard) {
  if (r.workspaceId === CURATION_WS_ID) { showToast('ℹ 策展中心原生卡无需镜像'); return }
  const d2 = d.value
  d2.curationProjections = d2.curationProjections || []
  if (d2.curationProjections.some(p => p.kind === 'card' && p.cardId === r.id)) { showToast('ℹ 该卡已在策展中心镜像中'); return }
  d2.curationProjections.push({ id: uid('curp'), kind: 'card', wsId: r.workspaceId, cardId: r.id, catId: r.categoryId, targetCatId: '', addedAt: Date.now() })
  store.persist()
  showToast('📡 已镜像到策展中心（引用式镜像）')
}

/** R53-A3（修订 R50-F3）：整组分类镜像——物化为带 curFrom 的真实策展分类（同树混排；源卡含子分类实时呈现） */
function projectCategoryToCuration(cat: Category) {
  const d2 = d.value
  if (d2.categories.some(x => x.workspaceId === CURATION_WS_ID && x.curFrom?.wsId === cat.workspaceId && x.curFrom?.catId === cat.id)) { showToast('ℹ 该分类已在策展中心镜像中'); return }
  let maxOrder = -1
  for (const c of d2.categories) if (c.workspaceId === CURATION_WS_ID && (c.order ?? 0) > maxOrder) maxOrder = c.order ?? 0
  d2.categories.push({ id: uid('cat'), workspaceId: CURATION_WS_ID, name: cat.name, order: maxOrder + 1, curFrom: { wsId: cat.workspaceId, catId: cat.id, projId: 'cat:' + cat.id } })
  store.persist()
  showToast('📡 已镜像分类到策展中心（含子分类实时呈现）')
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
function onDragStart(e: DragEvent, r: ResourceCard) {
  draggedItem = r
  e.dataTransfer?.setData('text/plain', r.id)
}
// REQ-028 F-028-3：卡片所属渲染分区（与 resourceGroups 分区 key 对齐）
function groupKeyOf(r: ResourceCard): string {
  const validIds = new Set(wsCats.value.map(c => c.id))
  if (!r.categoryId || !validIds.has(r.categoryId)) return 'uncat'
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
  draggedItem.categoryId = catId
  draggedItem.updatedAt = Date.now()
  store.persist()
  showToast(`✓ 已移入「${catId ? categories.value.find(c=>c.id===catId)?.name : '待分类'}」`)
  draggedItem = null
  clearCardDropTarget()
}

// ===== 批量操作（E4） =====
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedIds.value.clear()
}
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}
function selectAllVisible() {
  const all = sortedResources.value
  if (selectedIds.value.size >= all.length) selectedIds.value.clear()
  else all.forEach(r => selectedIds.value.add(r.id))
}
function selectedCards(): ResourceCard[] {
  return allResources.value.filter(r => selectedIds.value.has(r.id))
}
async function batchOpen() {
  const items = selectedCards().filter(r => r.link)
  if (!items.length) { showToast('所选资源卡均无链接'); return }
  if (items.length > 15 && !(await useConfirm({ title: '批量打开链接', message: `即将打开 ${items.length} 个标签页，确认继续？`, confirmText: '继续打开', danger: false }))) return
  items.forEach(r => openResourceLink(r))
  showToast(`✓ 已打开 ${items.length} 个链接`)
}
async function batchDelete() {
  const n = selectedIds.value.size
  const removed = selectedCards()
  removed.forEach(r => { r.deletedAt = Date.now() })
  store.persist()
  selectedIds.value.clear()
  showToast(`已删除 ${n} 张资源卡`, { label: '撤销', cb: () => {
    // REQ-030：按 id 批量定位当前树恢复
    removed.forEach(r => {
      const cur = d.value.resources.find(x => x.id === r.id)
      if (cur && cur.deletedAt) cur.deletedAt = undefined
    })
    store.persist()
  } })
}
function catNameOf(r: ResourceCard): string {
  if (!r.categoryId) return '待分类'
  return wsCats.value.find(c => c.id === r.categoryId)?.name || '待分类'
}
function catIconOf(r: ResourceCard): string {
  return r.categoryId && wsCats.value.some(c => c.id === r.categoryId) ? '📂' : '📥'
}
function catNameOfFamily(r: ResourceCard): string {
  const cat = wsCats.value.find(c => c.id === r.categoryId)
  if (!cat) return '待分类'
  const parent = cat.parentId ? wsCats.value.find(c => c.id === cat.parentId) : null
  return parent ? `${parent.name} / ${cat.name}` : cat.name
}

// ===== 第八轮：分类树（2 级）+ 置顶 + 聚合计数 =====
const wsCats = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value))
function childCatsOf(pid: string): Category[] {
  return wsCats.value.filter(c => c.parentId === pid).sort((a, b) => a.order - b.order)
}
const rootCats = computed(() => wsCats.value
  .filter(c => !c.parentId || !wsCats.value.some(p => p.id === c.parentId))
  .sort((a, b) => a.order - b.order))
const pinnedRootCats = computed(() => rootCats.value.filter(c => c.pinned))
const unpinnedRootCats = computed(() => rootCats.value.filter(c => !c.pinned))
function childIds(catId: string): string[] {
  return wsCats.value.filter(c => c.parentId === catId).map(c => c.id)
}
/** 家族 id（自己 + 全部子分类）——过滤与计数共用口径 */
function familyIds(catId: string): string[] {
  return [catId, ...childIds(catId)]
}
function catAggCount(catId: string): number {
  const ids = familyIds(catId)
  return allResources.value.filter(r => r.categoryId && ids.includes(r.categoryId)).length
}
/** 分类选择器的层级化选项（下拉/弹窗共用） */
function treeCatOptions(cats: Category[]): { id: string; label: string }[] {
  const roots = cats.filter(c => !c.parentId || !cats.some(p => p.id === c.parentId)).sort((a, b) => a.order - b.order)
  const out: { id: string; label: string }[] = []
  for (const r0 of roots) {
    out.push({ id: r0.id, label: r0.name })
    for (const ch of cats.filter(c => c.parentId === r0.id).sort((a, b) => a.order - b.order)) {
      out.push({ id: ch.id, label: '└ ' + ch.name })
    }
  }
  return out
}
/** 左栏渲染的扁平序列（分区标签 + 缩进标记） */
interface SidebarCat { cat: Category; depth: 0 | 1; sectionLabel: string }
// R48-V2：树状目录展开/折叠（默认全局展开；折叠状态仅会话内记忆）
const collapsedCats = ref<Set<string>>(new Set())
function toggleCatCollapse(id: string) {
  const s = new Set(collapsedCats.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  collapsedCats.value = s
}
/** 一键收纳为工作台根部：所有含子分类的父级全部折叠 */
function collapseAllCats() {
  collapsedCats.value = new Set(wsCats.value.filter(c => childCatsOf(c.id).length).map(c => c.id))
}
function expandAllCats() { collapsedCats.value = new Set() }
function selectSidebarCat(sc: SidebarCat) {
  activeCategory.value = sc.cat.id
  // 选中子分类时自动展开其父级，避免「选中被藏住」
  if (sc.depth === 1 && sc.cat.parentId && collapsedCats.value.has(sc.cat.parentId)) {
    const s = new Set(collapsedCats.value); s.delete(sc.cat.parentId); collapsedCats.value = s
  }
}
const sidebarCats = computed<SidebarCat[]>(() => {
  const out: SidebarCat[] = []
  pinnedRootCats.value.forEach((c, i) => {
    out.push({ cat: c, depth: 0, sectionLabel: i === 0 ? '📌 置顶' : '' })
    if (!collapsedCats.value.has(c.id)) childCatsOf(c.id).forEach(k => out.push({ cat: k, depth: 1, sectionLabel: '' }))
  })
  unpinnedRootCats.value.forEach((c, i) => {
    out.push({ cat: c, depth: 0, sectionLabel: (i === 0 && pinnedRootCats.value.length) ? '📁 分类' : '' })
    if (!collapsedCats.value.has(c.id)) childCatsOf(c.id).forEach(k => out.push({ cat: k, depth: 1, sectionLabel: '' }))
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
/** 第卅三轮 REQ-021：同名即时校验（作用域=当前工作台全分类树，重命名排除自身） */
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
  if (catNameDup.value) { showToast('该工作台已存在同名分类，请更换名称'); return }
  if (m.mode === 'create') {
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
  // R53-A3：级联清理该源分类的策展镜像分类（停入卡回落未分类、投射卡回待分类、子分类提根）
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
/** 第卅三轮 REQ-021：存量重复分类合并工具（同一工作台内同名分组，资源并入首个，子分类升级一级） */
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
  if (!dupGroups.length) { showToast('当前工作台无重复分类 ✨'); return }
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
onMounted(() => { window.addEventListener('dragend', clearCardDropTarget); document.addEventListener('click', closeSettingsMenu) })
onUnmounted(() => { window.removeEventListener('dragend', clearCardDropTarget) })
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
  if (mode === 'child') {
    if (dragged.parentId) { showToast('最多 2 级，子分类不能再嵌套'); return }
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

// ===== 批量移动（第八轮：工作台→分类级联，含当前工作台） =====
const moveModalOpen = ref(false)
const moveWsId = ref('')
const moveCatId = ref('')
const moveWorkspaces = computed(() => d.value.workspaces.filter(w => !w.archived))
const moveCatOptions = computed(() => treeCatOptions(d.value.categories.filter(c => c.workspaceId === moveWsId.value)))
watch(moveWsId, () => { moveCatId.value = '' })
function openBatchMove() {
  moveWsId.value = workspaceId.value
  moveCatId.value = ''
  moveModalOpen.value = true
}
function confirmBatchMove() {
  const items = selectedCards()
  if (!items.length || !moveWsId.value) { showToast('请选择目标工作台'); return }
  let catId = moveCatId.value
  if (!catId) {
    let cat = d.value.categories.find(c => c.workspaceId === moveWsId.value && c.name === '待分类')
    if (!cat) {
      cat = { id: uid('cat'), workspaceId: moveWsId.value, name: '待分类', order: 0 }
      d.value.categories.push(cat)
    }
    catId = cat.id
  }
  items.forEach(r => { r.workspaceId = moveWsId.value; r.categoryId = catId; r.updatedAt = Date.now() })
  store.persist()
  moveModalOpen.value = false
  showToast(`✓ 已移动 ${items.length} 张资源卡`)
  selectedIds.value.clear()
}

// ===== 单卡移动分类（第八轮：应用内弹窗，替代原生 prompt） =====
const moveOneOpen = ref(false)
const moveOneCatId = ref('')
let moveOneTarget: ResourceCard | null = null
const moveOneOptions = computed(() => treeCatOptions(wsCats.value))
function openMoveOne(r: ResourceCard) {
  moveOneTarget = r
  moveOneCatId.value = r.categoryId || ''
  moveOneOpen.value = true
}
function confirmMoveOne() {
  if (!moveOneTarget) return
  moveOneTarget.categoryId = moveOneCatId.value || ''
  moveOneTarget.updatedAt = Date.now()
  store.persist()
  moveOneOpen.value = false
  showToast('✓ 已移动分类')
}

// ===== 通用输入弹窗（第八轮：工作台重命名/描述，替代原生 prompt） =====
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

// ===== 导入：书签 HTML / 本地文件（E3） =====
const importModalOpen = ref(false)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const fileImportInput = ref<HTMLInputElement | null>(null)

interface BkFolder { path: string; name: string; count: number; checked: boolean }
interface BkNode { title: string; url: string; path: string[] }

const bookmarkModalOpen = ref(false)
const bkFolders = ref<BkFolder[]>([])
let bkBookmarks: BkNode[] = []

function ensureUncat(): Category {
  let cat = d.value.categories.find(c => c.workspaceId === workspaceId.value && c.name === '待分类')
  if (!cat) {
    cat = { id: uid('cat'), workspaceId: workspaceId.value, name: '待分类', order: d.value.categories.filter(c => c.workspaceId === workspaceId.value).length }
    d.value.categories.push(cat)
  }
  return cat
}
function makeResource(title: string, linkType: ResourceCard['linkType'], link: string, categoryId: string, tags: string[] = []): ResourceCard {
  return {
    id: uid('res'), kind: 'resource', title, linkType, link,
    workspaceId: workspaceId.value, categoryId, description: '', tags,
    customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
  }
}

/** 解析 Netscape 书签 HTML（浏览器导出格式） */
function parseBookmarksHtml(html: string): BkNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: BkNode[] = []
  function walk(dl: Element | null, path: string[]) {
    if (!dl) return
    for (const dt of Array.from(dl.children).filter(el => el.tagName === 'DT')) {
      const h3 = dt.querySelector(':scope > h3')
      const a = dt.querySelector(':scope > a')
      if (h3) {
        // 第廿九轮：文件夹名 URL 编码容错解码
        const name = safeDecodeText(h3.textContent?.trim() || '未命名')
        walk(dt.querySelector(':scope > dl'), [...path, name])
      } else if (a) {
        const url = a.getAttribute('href') || ''
        if (url && /^(https?:|file:|obsidian:)/i.test(url)) {
          out.push({ title: safeDecodeText(a.textContent?.trim() || url), url, path })
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
      bkBookmarks = parseBookmarksHtml(reader.result as string)
      if (!bkBookmarks.length) { showToast('未在文件中解析到书签，请确认是浏览器导出的书签 HTML'); return }
      // 按顶层文件夹归组；无文件夹的归入「未分组」
      const groups = new Map<string, BkNode[]>()
      for (const b of bkBookmarks) {
        const key = b.path.length ? b.path.join(' / ') : '未分组'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(b)
      }
      bkFolders.value = Array.from(groups.entries())
        .map(([path, items]) => ({ path, name: path.split(' / ').pop() || path, count: items.length, checked: true }))
        .sort((a, b) => b.count - a.count)
      bookmarkModalOpen.value = true
      importModalOpen.value = false
    } catch { showToast('✗ 书签文件解析失败') }
  }
  reader.readAsText(file)
  input.value = ''
}

const allBkChecked = computed(() => bkFolders.value.length > 0 && bkFolders.value.every(f => f.checked))
const bkTotalCount = computed(() => bkBookmarks.length)
function toggleAllBk() {
  const next = !allBkChecked.value
  bkFolders.value.forEach(f => { f.checked = next })
}

/** 第卅轮：浏览器标准根文件夹不生成分类（书签栏/收藏栏/其他书签等） */
const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签', 'Bookmarks bar', 'Bookmarks Toolbar', 'Favorites bar', 'Mobile bookmarks', '移动书签'])

/** 第卅轮：按路径前 2 级确保分类存在（同名同级复用，不重建），返回卡片归属的分类 id（'' = 待分类） */
function ensureBookmarkCategory(segs: string[]): string {
  let parentId: string | undefined
  let catId = ''
  for (const seg of segs.slice(0, 2)) {
    const name = seg.trim()
    if (!name) break
    let cat = d.value.categories.find(c => c.workspaceId === workspaceId.value && (c.parentId || undefined) === parentId && c.name === name)
    if (!cat) {
      cat = { id: uid('cat'), workspaceId: workspaceId.value, name, order: d.value.categories.filter(c => c.workspaceId === workspaceId.value && (c.parentId || undefined) === parentId).length }
      if (parentId) cat.parentId = parentId
      d.value.categories.push(cat)
    }
    catId = cat.id
    parentId = cat.id
  }
  return catId
}

function confirmBookmarkImport() {
  const checkedPaths = new Set(bkFolders.value.filter(f => f.checked).map(f => f.path))
  const items = bkBookmarks.filter(b => checkedPaths.has(b.path.length ? b.path.join(' / ') : '未分组'))
  if (!items.length) { showToast('未选择任何文件夹'); return }
  for (const b of items) {
    // 第卅轮：路径前 2 级（去除标准根）→ 分类树，卡片归入最深分类；第 3 级及更深 → 标签（分类层级不重复打标签）
    const segs = b.path.filter(p => p && !BK_ROOT_NAMES.has(p))
    const catId = ensureBookmarkCategory(segs)
    const tags = Array.from(new Set(segs.slice(2)))
    let linkType: ResourceCard['linkType'] = 'url'
    if (b.url.startsWith('file:')) linkType = 'file'
    else if (b.url.startsWith('obsidian:')) linkType = 'obsidian'
    d.value.resources.unshift(makeResource(b.title.substring(0, 120), linkType, b.url, catId, tags))
  }
  store.persist()
  bookmarkModalOpen.value = false
  showToast(`✓ 已导入 ${items.length} 个书签（文件夹结构已生成为分类，可自行增删改）`)
}

function fileImport() { fileImportInput.value?.click() }
function handleFileImport(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  const cat = ensureUncat()
  files.forEach(f => d.value.resources.unshift(makeResource(f.name.replace(/\.[^.]+$/, ''), 'file', f.name, cat.id)))
  store.persist()
  input.value = ''
  importModalOpen.value = false
  showToast(`✓ 已导入 ${files.length} 个文件（双击打开前请补全完整路径）`)
}

// ===== 设置菜单 =====
const settingsMenuOpen = ref(false)
function closeSettingsMenu() { settingsMenuOpen.value = false }

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
  openInputModal('✏️ 重命名工作台', current, (v) => {
    if (!workspace.value) return
    workspace.value.name = (workspace.value.icon ? workspace.value.icon + ' ' : '') + v
    store.persist()
    showToast('✓ 已重命名')
  })
}
function editDesc() {
  settingsMenuOpen.value = false
  openInputModal('📝 编辑工作台描述', workspace.value?.desc || '', (v) => {
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
  // 现为 ...d 全量展开（全局段随行）+ 工作台段按当前台过滤；导出物可直接走「导入数据」并集合并。
  const data = JSON.parse(JSON.stringify({
    ...d.value,
    workspaces: [ws],
    categories: d.value.categories.filter(c => c.workspaceId === wsId),
    resources: d.value.resources.filter(r => r.workspaceId === wsId)
  })) as AppData
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${ws.name}_数据.json`
  a.click(); URL.revokeObjectURL(url)
  showToast('✓ 工作台数据已导出（含标签树/罗盘/任务/好奇心等全局段）')
  settingsMenuOpen.value = false
}
async function deleteWorkspace() {
  // R58-B1：策展空间是全局工作台，不可从此入口删除
  if (workspaceId.value === CURATION_WS_ID) { showToast('ℹ 策展中心为全局空间，不在此删除'); return }
  // R58-B1：红线修复——资源卡一律软删（deletedAt，回收站可恢复），不再物理移除
  if (!(await useConfirm({ title: '删除工作台', message: `确定删除工作台「${workspace.value?.name.replace(/^[^\s]+\s/, '')}」？\n其中资源卡将全部移入回收站（可恢复），分类与工作台本身将删除且不可恢复。`, confirmText: '确认删除' }))) return
  const idx = d.value.workspaces.findIndex(w => w.id === workspaceId.value)
  if (idx >= 0) d.value.workspaces.splice(idx, 1)
  const now = Date.now()
  for (const r of d.value.resources) if (r.workspaceId === workspaceId.value && !r.deletedAt) r.deletedAt = now
  d.value.categories = d.value.categories.filter(c => c.workspaceId !== workspaceId.value)
  store.persist()
  showToast('工作台已删除（资源卡已移入回收站）')
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

/* Hero */
.ws-hero { position: relative; height: 150px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 28px 18px; }
.ws-hero::before { content: ''; position: absolute; top: -30px; right: -20px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.08), transparent 70%); }
.ws-hero::after { content: ''; position: absolute; bottom: -40px; left: 30%; width: 300px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.05), transparent 70%); }
.hero-name { font-size: 22px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
.hero-name .icon { font-size: 20px; }
/* B32：图标管理 */
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
.hero-desc { font-size: 12.5px; color: var(--text-3); margin-top: 4px; position: relative; z-index: 1; outline: none; border-radius: 4px; padding: 2px 4px; min-height: 18px; }
.hero-desc:focus { background: rgba(255,255,255,.1); }
.hero-bottom { display: flex; align-items: center; gap: 16px; margin-top: 10px; position: relative; z-index: 1; }
.hero-stats { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-3); }
.hero-stats b { color: var(--text); font-weight: 600; }
.hero-actions { margin-left: auto; display: flex; gap: 8px; }
.hero-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 5px; font-weight: 500; border: none; }
.hero-btn.primary { background: var(--accent); color: #fff; }
.hero-btn.primary:hover { background: var(--accent-hover); }
.hero-btn.ghost { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); }
.hero-btn.ghost:hover { background: var(--surface-3); color: var(--text); }
.hero-btn.settings { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); padding: 6px 10px; }
.hero-btn.settings:hover { background: var(--surface-3); color: var(--text); }

/* 设置菜单 */
.settings-menu { position: fixed; top: 130px; right: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 36px rgba(0,0,0,.12); z-index: 60; min-width: 190px; overflow: hidden; display: none; }
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
.toolbar-search { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); transition: all .15s; }
.toolbar-search:focus-within { border-color: var(--accent); }
.toolbar-search input { border: none; outline: none; font-size: 12px; width: 160px; background: transparent; color: var(--text); }
.toolbar-search .s-icon { color: var(--text-3); font-size: 13px; }
.toolbar-batch { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; white-space: nowrap; }
.toolbar-batch:hover { border-color: var(--accent); color: var(--accent); }
.toolbar-batch.active { background: var(--accent-light); border-color: var(--accent); color: var(--accent); font-weight: 600; }

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
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--card-min-w), 1fr)); gap: var(--card-gap); }
.res-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.res-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.res-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: var(--card-pad-vert) var(--card-pad-horz); cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; min-height: 120px; /* R55-F4：屏外卡片跳过渲染（切工作台 595ms 的渲染段优化） */ content-visibility: auto; contain-intrinsic-size: auto 132px; }
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
.rc-action.delete:hover { color: var(--danger); }
.rc-fields { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.rc-title { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 20px; }
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
/* REQ-028：分组视图下分类徽标隐藏（归属已由分区标题表达） */
.rc-cat.hidden { opacity: 0.35; background: transparent; color: var(--text-dim, #999); pointer-events: auto; }
.rc-cat:hover { background: var(--accent); color: #fff; }
.rc-link { font-size: 10.5px; color: var(--text-3); display: flex; align-items: center; gap: 3px; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-link.url { color: var(--info-blue); }
.rc-link.file { color: var(--curio-amber); }
.rc-link.obsidian { color: var(--violet); }
.rc-calls { font-size: 10px; color: var(--curio-amber); background: var(--curio-bg); padding: 1px 7px; border-radius: 99px; font-weight: 500; }
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
.res-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all .1s; }
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
.kc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 7px; cursor: pointer; transition: all .15s; }
.kc-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 8%, transparent); }
.kc-card.pinned { border-left: 3px solid var(--accent); }
.kc-card-title { font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kc-del { margin-left: auto; font-size: 11px; color: var(--text-3); cursor: pointer; opacity: 0; transition: all .12s; padding: 0 3px; border-radius: 4px; flex-shrink: 0; }
.kc-card-title:hover .kc-del { opacity: 1; }
.kc-del:hover { color: var(--danger); }
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

/* 书签文件夹选择 */
.bk-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.7; padding: 8px 10px; background: var(--surface-2); border-radius: 6px; margin-bottom: 8px; }
.bk-all { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text); padding: 6px 0 10px; cursor: pointer; }
.bk-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bk-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.bk-item:hover { background: var(--surface-2); }
.bk-name { flex: 1; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-count { font-size: 10.5px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; }

/* Toast */
</style>
