<template>
  <div class="ws-page" v-if="workspace">
    <!-- R84（W1）：台身份页头——图标 + 台名 + 台描述 + 右端结构摘要（一行 ≤40px）。
         改前：仅资源台有一段 R73-S5a 写死的 .ws-hub-head（无图标、非台名剥图标/description），
         而 **策展台的台名与台描述在页面内零出现**——用户置身于某个策展台，却不知道这是哪个台。
         现统一为这一条，所有台都渲染。V3.7.0（R179）：资源台退役，hub 回落文案与 ? 教学气泡随之下线。 -->
      <!-- 左侧分类导航（第八轮：树形 2 级 + 置顶分区 + 拖拽排序/挂子级；R48-V2：Linear 风格树 + 展开/折叠） -->
      <div class="ws-content">
      <!-- R109（F13）：顶部三模块移入滚动容器（与卡片同 padding/滚动域）——顶栏/指标条/工具条/网格右缘成一条直线 -->
    <!-- V3.9.13：台身份与中心论点合成同一条上下文带；论点不再独占整行，工具条紧接其后。 -->
    <div class="ws-hero">
      <div class="ws-id-head">
        <span class="wsh-icon"><template v-if="workspace.icon">{{ workspace.icon }}</template><Icon v-else name="folder" :size="13"/></span>
        <b class="wsh-name">{{ wsDisplayNameOf(workspace) }}</b>
        <!-- V3.7.0（R179）：资源台页头分支退役——策展台两态描述 + 摘要 + 更新流水入口为唯一形态 -->
        <span v-if="wsHeadDescOwn" class="wsh-desc" :title="wsHeadDescOwn">· {{ wsHeadDescOwn }}</span>
        <span class="wsh-spacer" />
        <span class="wsh-summary">{{ categories.length }} 个分类<template v-if="metrics.mirrored"> · 镜像 {{ metrics.mirrored }} 条</template><span class="wsh-upd" v-pressable title="查看最近更新流水" @click.stop="openDrill('recent')"> · 更新 {{ lastUpdateText }}</span></span>
      </div>
      <!-- R126（原型还原）：中心论点横幅常驻；V3.9.13 起与台身份并排，保留原入口与键盘语义。 -->
      <div class="thesis-banner" :class="{ empty: !thesisCard }" role="button" tabindex="0"
        :aria-label="thesisCard ? '打开中心论点卡详情' : '确立中心论点'"
        @click="thesisCard ? openThesisCard() : openThesisCreate()"
        @keydown.enter.prevent="thesisCard ? openThesisCard() : openThesisCreate()"
        @keydown.space.prevent="thesisCard ? openThesisCard() : openThesisCreate()">
        <template v-if="thesisCard">
          <span class="tb-badge"><Icon name="landmark" :size="13"/> 中心论点</span>
          <span class="tb-title" :title="thesisCard.title">{{ thesisCard.title }}</span>
          <span class="tb-desc" :title="thesisCard.description || ''">{{ thesisCard.description || '点击打开论点卡详情' }}</span>
          <span class="tb-open">论点卡详情 <Icon name="arrowright" :size="13"/></span>
        </template>
        <template v-else>
          <span class="tb-badge gray"><Icon name="landmark" :size="13"/> 中心论点</span><span class="tb-hint">＋ 点击确立本策展台的 L1 中心论点，让研究从判断出发</span><button class="tb-btn" @click.stop="openThesisCreate">＋ 确立中心论点</button>
        </template>
      </div>
    </div>
    <!-- R64-F13：hero 大标题区删除——重命名/图标/描述编辑收进 ⚙ 菜单，导入/新建按钮上移工具条 -->
    <Teleport to="body">
      <div v-if="iconPickOpen" class="icon-pick-mask" @click="iconPickOpen = false" />
      <div v-if="iconPickOpen" class="icon-pick" data-a11y-container :style="{ left: iconPickPos.left + 'px', top: iconPickPos.top + 'px' }" @click.stop>
        <div class="ip-title"><Icon name="palette" :size="13"/> 策展台图标</div>
        <div class="ip-grid">
          <span v-for="e in WS_ICONS" :key="e" class="ip-cell" v-pressable :class="{on: workspace.icon === e}" @click="setWsIcon(e)">{{ e }}</span>
        </div>
        <div class="ip-custom">
          <input v-model="iconCustom" class="ip-input" maxlength="4" placeholder="自定义 emoji" @keydown.enter.prevent="setWsIcon(iconCustom.trim())">
          <button class="ip-btn" @click="setWsIcon(iconCustom.trim())">使用</button>
        </div>
        <div class="ip-foot">
          <button class="ip-btn ghost" @click="setWsIcon('')"><Icon name="trash" :size="13"/> 删除图标</button>
          <button class="ip-btn ghost" @click="iconPickOpen = false">关闭</button>
        </div>
      </div>
    </Teleport>

    <!-- R75（R18）指标条按台身份分流 → V3.7.0（R179）：资源台 3 格随资源台退役，策展台 3 格为唯一形态 -->
    <!-- R62-1：策展台指标条——R98（W8）5 格 → 3 格：构成明细本就与总数格 hint 同源同文（并入即删格）；
         「🕐 最近更新」降为页头摘要「· 更新 X」（可点进流水下钻，入口不断） -->
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
    <div class="settings-menu" :class="{open: settingsMenuOpen}" data-a11y-container @click.stop>
      <!-- R88（W6）：「⬇ 导入」自工具条收进此处，并**按台身份改名**消歧义（资源台=导入资源，策展台=导入策展台数据包）。
           V3.7.0（R179）：资源台退役——「导入」只剩数据包一种，消歧义前提消失，名称不再按台分支。 -->
      <div class="sm-item" v-pressable @click="openImport"><Icon name="download" :size="13"/> 导入 JSON 备份</div>
      <!-- V3.9.8：策展画布不再提供卡片批量栏。池卡的批量动作统一在调度台「资源卡池」，
           本页设置菜单不再保留无落点的“批量管理”入口。 -->
      <!-- R106（F7）：一键批量清理本台镜像卡（投射记录删除，源卡保留在资源卡池） -->
      <div class="sm-item" v-pressable @click="cleanAllMirrors"><Icon name="broom" :size="13"/> 清理本台镜像卡</div>
      <!-- R108（T3）：金字塔 Markdown 模板导入 —— R113-N4 已提到一级工具条（见「📋 导入模板」按钮），此处移除 -->
      <div class="sm-divider"></div>
      <div class="sm-item" v-pressable @click="renameWs"><Icon name="edit" :size="13"/> 重命名</div>
      <div class="sm-item" v-pressable @click="editDesc"><Icon name="filetext" :size="13"/> 编辑描述</div>
      <div class="sm-item" v-pressable @click="toggleIconPick($event)"><Icon name="palette" :size="13"/> 更换图标</div>
      <div class="sm-divider"></div>
      <div class="sm-item" v-pressable @click="exportWorkspace"><Icon name="package" :size="13"/> 导出 JSON 备份</div>
      <div class="sm-divider"></div>
      <div class="sm-item danger" v-pressable @click="deleteWorkspace"><Icon name="trash" :size="13"/> 删除策展台</div>
    </div>

    <!-- V3.9.10：指标与工具合并为单行，分享固定在最右侧；为画布腾出纵向空间。 -->
    <div class="ws-toolbar cur-toolbar" data-curation-metrics="2">
      <span class="toolbar-mode"><Icon name="tree" :size="13"/> 策展画布</span>
      <!-- V3.9.10：两项读数仍保持独立下钻，但视觉上收成同一枚双段指标胶囊，
           避免两枚 126px 卡盒在 1024px 宽度下把工具条挤成第二行。 -->
      <div class="cur-metrics" data-curation-metrics="2">
        <button class="cur-metric" type="button" title="点击查看全部卡片明细（台内 + 镜像）" @click="openDrill('total')">
          <span class="mbox-label"><Icon name="barchart" :size="13"/> 论据卡片总数</span>
          <span class="mbox-value">{{ metrics.total }}<span v-if="metrics.mirrored" class="mbox-sub">（源卡镜像 <Icon name="satellite" :size="13"/> {{ metrics.mirrored }}）</span></span>
        </button>
        <button class="cur-metric" type="button" title="点击查看附件明细" @click="openDrill('assets')">
          <span class="mbox-label"><Icon name="paperclip" :size="13"/> 佐证附件数量</span>
          <span class="mbox-value">{{ metrics.attachmentCount }}<span v-if="assetKindBreakdown" class="mbox-sub">（{{ assetKindBreakdown }}）</span></span>
        </button>
      </div>
      <!-- V3.9.8 体验收口：分支只由节点键盘操作创建；成果 HTML 是独立回导链，不再伪装成 JSON 数据包。 -->
      <button class="hero-btn ghost" title="导入知源分享的策展成果 HTML" @click="openShareHtmlImport"><Icon name="download" :size="13"/> 导入成果 HTML</button>
      <!-- R113-N4：金字塔模板导入提到一级。原藏在 ⚙ 菜单第 4 项（用户反馈"埋太深、不方便"），
           与「＋新建」同属"往本台生成内容"，紧邻放置；V3.7.0（R179）：资源台退役后无 hub 门控，按钮常驻。 -->
      <button class="hero-btn settings py-import-btn" title="导入金字塔 Markdown 模板（中心论点 + 论证分支一次生成）"
        @click="pyramidImportOpen = true"><Icon name="filetext" :size="13"/> 导入模板</button>
      <div class="toolbar-spacer"></div>
      <div class="toolbar-search">
        <span class="s-icon"><Icon name="search" :size="13"/></span>
        <input type="text" v-model="searchQuery" placeholder="检索论证节点..."
          title="全台检索：匹配节点标题与说明，以及节点下资源卡的标题、描述、标签与来源">
      </div>
      <!-- R110-LC：生命周期面板入口（活跃 / 冷却 / 归档三态；归档卡从默认视图隐藏，在此恢复） -->
      <button class="hero-btn settings" title="策展台设置" @click.stop="toggleSettingsMenu"><Icon name="settings" :size="13"/></button>
      <button class="hero-btn ghost share-action" title="分享为高清长图或自包含 HTML" @click="shareOpen = true"><Icon name="share" :size="13"/> 分享成果</button>
    </div>

    <!-- 下钻抽屉（R62-2） -->
    <CurationDrillDrawer :open="drillOpen" :mode="drillMode" :cat-rows="drillCatRows" :native-cards="drillNative" :mirror-cards="drillMirror" :card-rows="drillCardRows" :asset-rows="metrics.attachmentItems" :recent-rows="drillRecent"
      :card-exists="cardExistsGlobally" :referenced-asset-ids="referencedAssetIds"
      @close="drillOpen=false" @jump-cat="onDrillJumpCat" @open-card="onDrillOpenCard" @locate="onDrillLocate"
      @locate-asset="onDrillLocateAsset" @cleanup-asset="onDrillCleanupAsset" @cleanup-orphans="onDrillCleanupOrphans" />

    <!-- R110-LC（T3）：归档卡已从默认视图隐藏——底部一行降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
    <div v-if="archivedHintCount" class="ws-archived-hint" v-pressable @click="router.push('/profile#lifecycle')">
      <Icon name="package" :size="13"/> 另有 {{ archivedHintCount }} 张已归档卡片未显示（点此在 设置 › 总览 · 资源生命周期 中查看 / 恢复）
    </div>

    <!-- ③ 策展画布：金字塔 / 树状共享同一份 Category 树；左侧目录与旧四视图已退役 -->
    <CurationMindMap
      class="curation-workspace"
      :layout="mind.layout.value"
      :thesis="thesisCard"
      :nodes="wsCats"
      :roots="mind.rootCats.value"
      :selected-id="mind.selectedId.value"
      :selected-label="mind.selectedLabel.value"
      :selected-level="mind.selectedLevel.value"
      :selected-card-count="mind.selectedCards.value.length"
      :node-count="mind.nodeCount.value"
      :linked-resource-count="mind.linkedResourceCount.value"
      :edit-request-id="mind.editRequestId.value"
      :edit-request-seq="mind.editRequestSeq.value"
      :cards-by-cat="mind.cardsByCat.value"
      :search-query="debouncedQuery"
      :keyboard-drag-source="mind.keyboardDragSource.value"
      :keyboard-drag-target="mind.keyboardDragTarget.value"
      :reveal-id="mind.revealId.value"
      :keyboard-drag-hint="mind.keyboardDragHint.value"
      :fullscreen="mind.fullscreen.value"
      :fullscreen-fallback="mind.fullscreenFallback.value"
      @update:layout="mind.setLayout"
      @select="mind.selectNode"
      @create-child="onMindCreateChild"
      @create-sibling="onMindCreateSibling"
      @cut="mind.cutNode"
      @paste="mind.pasteInto"
      @rename="mind.renameNode"
      @update-description="mind.updateDescription"
      @link-resource="openLinkCards"
      @unlink-resource="onUnlinkResource"
      @open-resource="onCardClick"
      @open-resource-link="openResourceLink"
      @open-resource-context="openResCtx"
      @open-thesis="openThesisCard"
      @open-create-thesis="openThesisCreate"
      @move="mind.moveNode"
      @keyboard-drag-start="mind.startKeyboardDrag"
      @keyboard-drag-target="mind.moveKeyboardTarget"
      @keyboard-drag-confirm="mind.confirmKeyboardMove"
      @keyboard-drag-cancel="mind.cancelKeyboardDrag"
      @remove-node="mind.removeNode"
      @update:fullscreen="mind.setFullscreenState($event.on, $event.fallback)" />
    </div>

    <CurationThesisDrawer :open="thesisOpen" :card="thesisCard" :nodes="wsCats" :ws-id="workspaceId" :ws-name="wsDisplayName"
      :root-count="mind.rootBranchCount.value" :resource-count="mind.linkedResourceCount.value"
      :attachment-count="metrics.attachmentCount"
      @close="thesisOpen = false" @save="saveThesisCard" @open-create="openThesisCreate"
    />

    <CurationShareDrawer :open="shareOpen" :workspace-name="wsDisplayName" :thesis="thesisCard"
      :nodes="wsCats" :cards="shareCards" @close="shareOpen = false" />

    <!-- 资源卡详情抽屉（单击打开）
         R168：改 `v-if` 点开才挂——常驻 168 节点（含分类下拉 88 个 `<option>`）是每次进台面的固定成本。
         V3.7.0（R179）：分类控件整体退役（池语义——归属由标签与投射表达），R169-老账① 随宿主消失结清；
         CatPicker 组件本体保留（shared/components/CatPicker.vue），随 R2 管理面再议。
         R169-老账③：自绘 `.drawer` 容器退役，改走共享 Drawer.vue 壳（Teleport + Esc + 遮罩 + 进出场
         + reduced-motion 全部单源），两代抽屉容器合并为一代；width=520px 与 bodyClass（镜像只读态）
         经壳的 props 传入。页脚按钮类 .dr-footer-btn 因 Workspace 各弹窗仍在复用而保留（见交付说明）。 -->
    <Drawer :open="drawerOpen" width="520px" :body-class="drawerReadonly ? 'dr-readonly' : undefined" @close="closeDrawer">
      <!-- R167（OPPO 质感 · 与 App 级资源抽屉同一套件）：
           ① 主标题进抽屉头（kicker 说归属 + 就地可编辑，回车=保存／镜像只读卡=定位源卡），
              正文不再重复一份标题框；② AI 入口从标题行降到正文首行「一行两格」，
              与 R166 任务卡三入口同语言（镜像卡不给入口）。
           字段区已抽至共享 ResourceEditForm（第卅九轮 #61），两宿主同源单份。 -->
      <template #title>
        <DetailTitle :model-value="editingResource.title" kicker="资源卡 · 策展台镜像"
          :readonly="drawerReadonly" placeholder="资源卡标题..."
          @update:model-value="editingResource.title = $event"
          @enter="drawerReadonly ? locateMirrorSourceCard() : saveResource()" />
      </template>
      <!-- 第卅九轮 #61 / R106（F4）：镜像卡只读——表单禁交互（pointer-events），footer 换「定位回资源台编辑」 -->
      <div v-if="drawerReadonly" class="dr-readonly-banner">
        <Icon name="satellite" :size="13"/> 镜像卡为引用（只读）——编辑请到资源卡池；<span class="dr-ro-link" v-pressable @click="locateMirrorSourceCard">定位到源卡 ›</span>
      </div>
      <ResourceAiStrip v-if="!drawerReadonly" :card="editingResource" :on-adopted="syncEditingFromStore" />
      <ResourceEditForm
        ref="resFormRef"
        :model="editingResource"
        height-key="ws-note"
        @save="saveResource"
      >
        <!-- R166 T7：资源侧「支持的任务」只读反查（与 RDD 同一组件，两宿主同源） -->
        <template #extra>
          <SupportTasksPanel v-if="d && editingResource.id" :d="d" :resource="editingResource" @open-task="gotoTaskOwner" />
        </template>
        <!-- 链接动作贴对象：打开/复制不再放页脚 -->
        <template v-if="!drawerReadonly" #link-actions>
          <button class="ds-ib" title="打开链接" @click="openResourceLink(editingResource)"><Icon name="external" :size="13"/></button>
          <button class="ds-ib" title="复制链接" @click="copyLink">⧉</button>
        </template>
      </ResourceEditForm>
      <template #footer>
        <template v-if="drawerReadonly">
          <button class="dr-footer-btn" @click="openResourceLink(editingResource)"><Icon name="external" :size="13"/> 打开链接</button>
          <button class="dr-footer-btn primary" @click="locateMirrorSourceCard"><Icon name="mappin" :size="13"/> 定位到源卡</button>
        </template>
        <!-- R165-A：页脚收敛两钮——删除（二次确认）+ 保存（Ctrl+↩） -->
        <template v-else>
          <ArmDeleteButton @confirm="deleteCurrentResource" />
          <button class="dr-footer-btn primary" @click="saveResource"><Icon name="check" :size="13"/> 保存<span class="dr-kbd">Ctrl+<Icon name="arrowleft" :size="13"/></span></button>
        </template>
      </template>
    </Drawer>

    <!-- R73-S2（R16 收敛）：导入弹窗改为 **mode-aware**
         · hub（资源台）→ 书签 HTML 导入 + 本地文件导入（自 CurationCenter 迁入）
         · 策展台 → 只收策展数据包 JSON -->
    <div v-if="importModalOpen" class="modal-overlay open" @click.self="importModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span class="mh-ico"><Icon name="download" :size="13"/></span>
          <span class="mh-title">导入策展台数据包</span>
          <button class="modal-close" type="button" aria-label="关闭" @click="importModalOpen=false">×</button>
        </div>
        <div class="modal-body">
          <!-- 旧 JSON 备份降级为高级恢复通道；一级工具条的「导入成果 HTML」才是策展成果回导主场。 -->
          <!-- V3.7.0（R179）：hub 导入分支（书签/本地文件）随资源台退役——
               书签导入唯一路线收敛到 设置→导入数据（文件夹→标签）；
               ★R2-⑧：本地文件导入入口已按 R179 的既定去向重落到 调度台「资源卡池」控制行
               （PoolCardsPanel 复用 useWorkspaceImport 同一条链路，workspaceId 钉成池 id），
               本页不再保留 fileImportInput。★R4-Db：parked 的 bookmarkInput 与其文件夹弹窗已删除（书签导入唯一路线在设置页）。 -->
          <div class="modal-option" v-pressable @click="boardImportInput?.click()">
            <span class="mo-icon"><Icon name="puzzle" :size="13"/></span>
            <div>
              <div class="mo-name">导入策展台数据包（JSON）</div>
              <div class="mo-desc">选择本台「<Icon name="settings" :size="13"/> 导出策展台数据」导出的 JSON 文件：论点分类树 + 论证节点卡 + 镜像投射按 ID 并集合并，现有数据不受影响</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <input ref="boardImportInput" type="file" accept=".json,application/json" class="file-hidden" @change="handleBoardImport" />

    <!-- R4-Db：书签导入「文件夹勾选 → 建池内分类」弹窗随死链一并删除——
         书签唯一路线在 设置→导入数据（目标台 + 文件夹转标签），本页不再有第二个入口 -->

    <!-- R65-F3：节点关联资源卡（资源台全量卡选择器：关键词过滤 + 多选 + 镜像到节点）
         R161-④：① 加「AI 检索」——与全局检索面板同一个 semanticSearch，按语义把**可镜像的卡**顶到最前
                    ② 弹窗本体抽成 LinkCardsModal.vue 并换到 R161 的新壳 Modal.vue
                       （宿主回到 ≤1500 行验收线 + 少一套私有 modal 实现的消费方） -->
    <LinkCardsModal
      :open="!!linkCardsModal" :cat-name="linkCardsModal?.catName || ''" :picked="linkCardsModal?.picked"
      :q="linkCardsQ" :cat="linkCardsCat" :cat-options="linkCatOptions" :list="linkShowList"
      :ai-busy="linkAiBusy" :ai-on="linkAiOn" :ai-hits="linkAiHits" :ai-fed="linkAiFed" :ai-took="linkAiTook"
      :ai-scope="linkAiScope" :ai-note="linkAiNote"
      @update:q="linkCardsQ = $event" @update:cat="linkCardsCat = $event" @toggle-pick="toggleLinkPick"
      @confirm="confirmLinkCards" @close="linkCardsModal = null" @ai-run="linkAiRun" />

    <!-- N8（V3.8.18）镜像到策展台——推送方向的选台弹窗（与上面的「移动分类」同款 modal 形态）。
         只选台、不选分类：targetCatId 只是"镜像时刻源卡所在分类"的历史快照，不参与任何业务判定
         （hub.ts:62 已写明），为一个陈旧快照多让用户选一次是白付的成本。 -->
    <div v-if="mirrorOpen" class="modal-overlay open" @click.self="mirrorOpen=false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <span class="mh-ico"><Icon name="satellite" :size="13"/></span>
          <span class="mh-title">镜像「{{ mirrorTarget?.title.slice(0, 20) }}…」到策展台</span>
          <button class="modal-close" type="button" aria-label="关闭" @click="mirrorOpen=false">×</button>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <div class="dr-label">目标策展台</div>
            <select class="dr-category-select" v-model="mirrorWsId">
              <option v-for="w in mirrorBoards" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name }}</option>
            </select>
            <div class="dr-hint">引用投射——源卡仍留在资源卡池，投错了在目标台「移出镜像」即可。</div>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="mirrorOpen=false">取消</button>
          <button class="dr-footer-btn primary" :disabled="!mirrorWsId" @click="confirmMirrorToBoard"><Icon name="check" :size="13"/> 确认镜像</button>
        </div>
      </div>
    </div>

    <!-- 成果 HTML 回导：新建或合并由用户当场选；先预览节点/资源规模再落库。 -->
    <div v-if="shareImportPending" class="modal-overlay open" @click.self="closeShareHtmlImport">
      <div class="modal modal-sm">
        <div class="modal-header">
          <span class="mh-ico"><Icon name="upload" :size="13"/></span>
          <span class="mh-title">导入策展成果 HTML</span>
          <button class="modal-close" type="button" aria-label="关闭" @click="closeShareHtmlImport">×</button>
        </div>
        <div class="modal-body">
          <div>
            <div class="mb-label">成果名称</div>
            <div class="share-import-name">{{ shareImportPending.snapshot.thesis.title }}</div>
            <div class="dr-hint">{{ shareImportPending.filename }} · {{ shareImportPending.nodeCount }} 个论证节点 · {{ shareImportPending.cardCount }} 张资源卡</div>
          </div>
          <div class="share-import-mode">
            <div class="mb-label">导入方式</div>
            <div class="share-import-option" v-pressable @click="confirmNewShareImport">
              <span class="mo-icon"><Icon name="folderopen" :size="13"/></span>
              <span><b>新建一个策展台</b><small>保留成果的 L1–L4 结构，并切换到新台。</small></span>
            </div>
            <div class="share-import-option" v-pressable @click="confirmMergeShareImport">
              <span class="mo-icon"><Icon name="branch" :size="13"/></span>
              <span><b>合并到当前策展台</b><small>同路径同标题的节点更新，不同则追加；重名自动加序号。</small></span>
            </div>
          </div>
          <div v-if="shareImportError" class="share-import-error">{{ shareImportError }}</div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="closeShareHtmlImport">取消</button>
        </div>
      </div>
    </div>
    <input ref="shareImportInput" type="file" accept=".html,.htm,text/html" class="file-hidden" @change="handleShareHtmlFile" />

    <!-- 第八轮：通用输入弹窗（策展台重命名/描述） -->
    <div v-if="inputModal.open" class="modal-overlay open" @click.self="inputModal.open=false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <span class="mh-ico"><Icon name="edit" :size="13"/></span>
          <span class="mh-title">{{ inputModal.title }}</span>
          <button class="modal-close" type="button" aria-label="关闭" @click="inputModal.open=false">×</button>
        </div>
        <div class="modal-body">
          <input type="text" class="ws-modal-input" v-model="inputModal.value" placeholder="输入内容…"
            @keydown.enter.prevent="confirmInputModal" @keydown.esc="inputModal.open=false" />
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="inputModal.open=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmInputModal"><Icon name="check" :size="13"/> 保存</button>
        </div>
      </div>
    </div>

    <!-- B5：右键菜单（R62 接线：组件此前已导入但未渲染，卡片/镜像菜单自此生效） -->
    <ContextMenu :state="resCtx" :items="resCtxItems" @close="resCtx.open = false" />

    <!-- R80（R14）：图片附件卡预览——双击 `zy-asset://` 图片卡就地弹窗（此前会落到「文档附件不存在」误报） -->
    <AssetPreview :open="previewOpen" :url="previewUrl" :name="previewName" @close="closePreview" />

    <!-- V3.7.0（R179）：📡/📤 镜像推送弹窗随资源台退役（推送入口与弹窗一并移除；
         池卡入库走节点「🔗 关联资源卡」/ 投射，参考侧「移出镜像 · 定位源卡」保留） -->

  </div>
  <div v-else class="ws-empty">策展台不存在</div>
</template>
<script setup lang="ts">
// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
defineOptions({ name: 'WorkspaceView' })
import Icon from '@/shared/components/Icon.vue'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { useCompass } from '@/newtab/stores/compass'
import { recordWorkspaceOpen } from '@/shared/storage/stats'
import { saveUIPrefs } from '@/shared/storage/repository'
import { showToast } from '@/shared/components/toast'
import AssetPreview from '@/shared/components/AssetPreview.vue'; import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'; import DetailTitle from '@/newtab/components/DetailTitle.vue'; import ResourceAiStrip from '@/newtab/components/ResourceAiStrip.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'; import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'; import ImportTemplateModal from '@/newtab/components/ImportTemplateModal.vue'; import SupportTasksPanel from '@/shared/components/SupportTasksPanel.vue'
// R161-④：关联资源卡（镜像）弹窗整体抽出（宿主回到 ≤1500 行验收线 + 换 R161 新壳 Modal.vue）
import LinkCardsModal from '@/newtab/components/LinkCardsModal.vue'
import CurationDrillDrawer from '@/newtab/components/CurationDrillDrawer.vue'
import type { DrillCatRow, DrillCardRow } from '@/newtab/components/CurationDrillDrawer.vue'
import CurationMindMap from '@/newtab/components/curation/CurationMindMap.vue'
import CurationThesisDrawer from '@/newtab/components/curation/CurationThesisDrawer.vue'
import CurationShareDrawer from '@/newtab/components/curation/CurationShareDrawer.vue'
// R169-老账③：两代抽屉容器合并——资源详情抽屉改走共享壳（Esc/遮罩/Teleport/进出场单源）
import Drawer from '@/shared/components/Drawer.vue'
import { useConfirm } from '@/shared/components/confirm'
import { buildCatIndex, buildBucketIndex } from '@/shared/utils/catIndex'
import { type ResourceCard, type Category } from '@/shared/models'
import { boardCardsOf, isMirrorView, curationMetrics, setThesis } from '@/shared/storage/hub'
import { useCurationDrill } from '@/newtab/composables/useCurationDrill'
import { useWorkspaceMirror } from '@/newtab/composables/useWorkspaceMirror'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import { useResourceDrawer } from '@/newtab/composables/useResourceDrawer'
import { useWorkspaceImport } from '@/newtab/composables/useWorkspaceImport'
import { useCurationShareImport } from '@/newtab/composables/useCurationShareImport'
import { usePyramid } from '@/newtab/composables/usePyramid'
import { useCurationMindMap } from '@/newtab/composables/useCurationMindMap'
import { useWsMeta } from '@/newtab/composables/useWsMeta'
import { useWsAssetHygiene } from '@/newtab/composables/useWsAssetHygiene'
// R113-N2：LifecyclePanel / useLifecycle 移除——入口收敛到 设置→总览（GlobalSettings）
// R115：视图/侧栏/打开/抽屉/拖拽/金字塔六域拆入 composables（04-59 技术债第三批）；实现原位迁出、零行为变更。

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)
/** R166 T7：资源侧反查行点击=去那个任务的归属项目页（只读跳转，不改任何数据；解绑只在任务侧） */
function gotoTaskOwner(t: { projectId?: string }): void { closeDrawer(); router.push(t.projectId ? `/compass/projects?p=${t.projectId}` : '/compass') }
/** R113-N5：浮层动态宿主——真全屏时 Teleport 目标指向全屏元素（否则挂 body 的浮层不可见） */
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
// ===== R62-1/2：策展台 5 指标 + 下钻 =====
// R112 性能：复用 allResources 已算好的 boardCardsOf 结果（此前 metrics 与 allResources
// 各算一遍 boardCardsOf ⇒ 每次切换/搜索对全部资源多做一次全量遍历 + 建 Map/Set）
const metrics = computed(() => curationMetrics(d.value, workspaceId.value, allResources.value))
/**
 * R84（W1）：页头描述——有台描述就用它，**为空则不占位**（原文验收要点）。
 * V3.7.0（R179）：资源台退役，「无描述回落定位语 + ? 教学气泡」两态随 hub 页头一并下线，
 * `wsHeadDescOwn` 成为唯一形态（策展台自写描述内联）。
 */
const wsHeadDescOwn = computed(() => (workspace.value?.desc || '').trim())
const thesisCard = computed<ResourceCard | null>(() => {
  const t = metrics.value.thesisId
  if (!t) return null
  return allResources.value.find(r => r.id === t) || null
})
const thesisOpen = ref(false)
const shareOpen = ref(false)

function openThesisCard(): void {
  if (thesisCard.value) thesisOpen.value = true
  else openThesisCreate()
}

function saveThesisCard(patch: { title: string; description: string }): void {
  const card = thesisCard.value
  if (!card) return
  card.title = patch.title
  card.description = patch.description
  card.updatedAt = Date.now()
  store.persist()
  showToast('中心论点卡已保存')
}

/** 资源 chip 的 × 只解除当前节点关联：镜像删投射记录，台内原生卡回到未分类；池卡本体不改。 */
function onUnlinkResource(nodeId: string, card: ResourceCard): void {
  if (isMirrorView(card)) {
    removeMirror(card)
    return
  }
  const live = d.value.resources.find(r => r.id === card.id && !r.deletedAt)
  if (!live || (live.categoryId || '') !== nodeId) {
    showToast('ℹ 这张资源卡已不在当前节点')
    return
  }
  live.categoryId = ''
  live.updatedAt = Date.now()
  store.persist()
  showToast('已解除节点关联；资源卡仍在资源卡池')
}

function onMindCreateChild(id: string): void {
  mind.createChild(id)
}

function onMindCreateSibling(id: string): void {
  mind.createSibling(id)
}

function setThesisCard(r: ResourceCard) {
  if (isMirrorView(r)) { showToast('镜像卡不能作为本台中心论点——请先移出镜像或选台内卡'); return }
  setThesis(d.value, workspaceId.value, r.id)
  store.persist()
  showToast(`「${r.title.slice(0, 16)}」已设为中心论点（金字塔 L1 根）`)
}
function unsetThesis() {
  setThesis(d.value, workspaceId.value, null)
  store.persist()
  showToast('已取消中心论点')
}
/** R64-F12：点击空态 → 弹出新建抽屉（预置 isThesis），保存后自动落为 L1 根节点 */
function openThesisCreate() {
  openNewResource()
  editingResource.isThesis = true
  showToast('填写论点标题保存后，自动成为中心论点（L1 根）')
}

// R47-B4：进入/切换策展台 = 一次「调用」，计入热度（全局检索无输入时策展台参与热度排序）
// R112 性能：**落盘节流**。原实现每次切台立即 store.persist()，300ms 防抖后同步执行整树
// JSON.stringify + JSON.parse（medium 规模 ~800 卡 / 100 分类）——切台窗口长任务的来源之一。
// R173-T2（用户拍板 a）：4s 后那笔从 **persist() 整库** 改走 **persistHot() 小载荷**——进台只改
// workspaces[].callCount/lastCalledAt 两个字段，真库实测整库序列化要 49~84ms（每次进台都付），
// 而热度键帧已扩 ws（hotStats.ts）。页面隐藏/卸载补写走 persistHot(true)：补写必须跳过防抖——
// 250ms 定时器会随页面一起被冻结/销毁，这正是原 flush 存在的意义。
let wsOpenPersistTimer: ReturnType<typeof setTimeout> | null = null
function scheduleWsOpenPersist() {
  if (wsOpenPersistTimer) clearTimeout(wsOpenPersistTimer)
  wsOpenPersistTimer = setTimeout(() => { wsOpenPersistTimer = null; store.persistHot() }, 4000)
}
function flushWsOpenPersist() {
  if (wsOpenPersistTimer) { clearTimeout(wsOpenPersistTimer); wsOpenPersistTimer = null; store.persistHot(true) }
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
const mind = useCurationMindMap({
  d,
  workspaceId,
  wsCats,
  catIdx,
  allResources,
  thesisCard,
  persist: () => store.persist(),
})
watch(workspaceId, () => mind.resetForWorkspace())
const shareCards = computed(() => allResources.value.filter(r => !r.isThesis))
const categories = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value).sort((a,b) => a.order - b.order))
function isUncat(r: ResourceCard, validIds: { has(id: string): boolean }): boolean {
  return !r.categoryId || !validIds.has(r.categoryId)
}
const lastUpdateText = computed(() => {
  const latest = allResources.value.reduce((max, r) => Math.max(max, r.updatedAt || r.createdAt), 0)
  if (!latest) return '—'
  const diff = Date.now() - latest
  if (diff < 86400000) return '今天'
  if (diff < 172800000) return '昨天'
  return new Date(latest).toLocaleDateString('zh-CN')
})
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

// ===== 下钻抽屉（R62-2）：状态与数据拆入 useCurationDrill =====
// 状态与数据迁入 composable，落点导航回调（onDrill*）留宿主——它们写视图状态，是接线不是实现。
const { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillCardRows, drillRecent } = useCurationDrill({
  allResources, resBucket, catIdx, isUncat
})

function onDrillJumpCat(id: string) {
  drillOpen.value = false
  if (id === 'uncat') {
    mind.selectNode('root')
    showToast('待分类资源尚未挂到论证分支——可在资源卡池中打开卡片并关联到具体节点')
    return
  }
  if (!mind.revealNode(id)) showToast('该分类节点已不存在')
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

// 画布是唯一工作区：只保留本页真正需要的搜索、归档提示与附件构成。
const searchQuery = ref('')
const debouncedQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (v) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)
})
const archivedHintCount = computed(() => allResources.value.filter(r => r.lifecycleArchived).length)
const assetKindBreakdown = computed(() => {
  const counts = new Map<string, number>()
  for (const r of allResources.value) {
    for (const a of r.assets || []) counts.set(a.kind, (counts.get(a.kind) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${kind === 'image' ? '图片' : kind === 'pdf' ? 'PDF' : 'HTML'} ${n}`)
    .join(' · ')
})
// R65-F7：KeepAlive 缓存实例——切换不同策展台（:id 变化）时复位本台局部状态，防上一台残留
// R129-B1：keep-alive 离开也让 nv=undefined，旧条件 nv&&ov&&nv!==ov 在 A→/compass→B 真换台时判假→空白页；改记上次所在台
let lastResetWsId = route.params.id as string | undefined
watch(() => route.params.id, (nv) => {
  if (typeof nv !== 'string' || !nv) return
  if (nv === lastResetWsId) return
  lastResetWsId = nv
  searchQuery.value = ''
  debouncedQuery.value = ''
})

// ===== R103（纯拆分第四批）：镜像域拆入 useWorkspaceMirror =====
// V3.7.0（R179）：只留引用侧（移出镜像/落点更新/定位源卡）——推送侧（单卡 📡/分类 📤）与拉取侧
// （分类镜像到本台）随资源台退役（hub 分类已迁标签树，池卡入库走「🔗 关联资源卡」/ 投射）。
const {
  isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,
} = useWorkspaceMirror({ d, categories, router, persist: () => store.persist() })

// ===== R115 拆分接线：资源打开域（预览/双击打开统一通道）=====
const { previewOpen, previewUrl, previewName, closePreview, openImageAsset, openResourceLink } = useResourceOpen({ store, d })

// ===== R115 拆分接线：编辑抽屉域（单击/双击分流/CRUD/右键菜单）=====
const {
  onCardClick, onCardDblClick,
  drawerOpen, editingResource, isNewResource, drawerReadonly,
  newCardCatId, openNewResource, openMirrorDetail,
  cleanAllMirrors, locateMirrorSourceCard, openResource, closeDrawer, syncEditingFromStore,
  saveResource, deleteCurrentResource, deleteResource, togglePin, toggleStar, copyLink,
  resFormRef, fixLink, resCtx, resCtxItems, openResCtx,
  // N8：镜像到策展台（推送方向，右键菜单 → 选台弹窗）
  mirrorOpen, mirrorTarget, mirrorWsId, mirrorBoards, openMirrorToBoard, confirmMirrorToBoard,
} = useResourceDrawer({
  store, d, workspaceId, router, categories, activeCategory: mind.selectedId, thesisCard,
  openResourceLink, openImageAsset, setThesisCard, unsetThesis,
  removeMirror, locateMirrorSource,
})

// ===== R100（纯拆分第一批）：导入三链路（数据包 / 书签 / 本地文件）拆入 useWorkspaceImport =====
// 实现原位迁出、零行为变更；标识符经解构保留原绑定——模板与既有断言的入口面不变（04-49 任务书）。
// ★R2-⑧：本地文件链路（fileImport / handleFileImport / fileImportInput）不再由本页持有——入口重落到
// 调度台「资源卡池」，实现仍留在 useWorkspaceImport 一条口径（池面板以 workspaceId=池 id 复用）。
const {
  importModalOpen, boardImportInput,
  handleBoardImport
} = useWorkspaceImport({ d, workspaceId, newCardCatId, persist: () => store.persist() })

const {
  shareImportInput, shareImportPending, shareImportError,
  openShareHtmlImport, handleShareHtmlFile, closeShareHtmlImport,
  confirmNewShareImport, confirmMergeShareImport,
} = useCurationShareImport({
  d,
  workspaceId,
  persist: () => store.persist(),
  navigate: (id) => router.push(`/workspace/${id}`),
})

// ===== 画布辅助域：模板导入 / 关联资源 / 全屏（旧金字塔视图已退出宿主）=====
const {
  pyramidImportOpen, confirmPyramidImport,
  linkCardsModal, linkCardsQ, linkCardsCat, linkCatOptions, openLinkCards, toggleLinkPick, confirmLinkCards,
  linkAiBusy, linkAiHits, linkAiFed, linkAiTook, linkAiOn, linkAiScope, linkAiNote, linkAiRun, linkShowList, linkAiHitOf,
} = usePyramid({ store, d, workspaceId, thesisCard, mind })

// ===== 设置菜单 =====
const settingsMenuOpen = ref(false)
function closeSettingsMenu() { settingsMenuOpen.value = false }
function toggleSettingsMenu() {
  const next = !settingsMenuOpen.value
  settingsMenuOpen.value = next
}
/** R88（W6）：导入弹窗（自工具条收进 ⚙ 后，入口与弹窗标题同为 mode-aware） */
function openImport() {
  settingsMenuOpen.value = false
  importModalOpen.value = true
}

onMounted(() => { document.addEventListener('click', closeSettingsMenu); document.addEventListener('visibilitychange', onWsOpenVisibility) })
// R112：同时补一次热度落盘（组件真正卸载时，节流中的待写数据不能丢）
onUnmounted(() => { flushWsOpenPersist(); if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null } document.removeEventListener('click', closeSettingsMenu); document.removeEventListener('visibilitychange', onWsOpenVisibility) })

// ===== 设置菜单关闭 + 采集跳转高亮 =====
// ===== R115 拆分接线：附件卫生域（R110-BUG2 跨台判定/定位/清理）=====
const { cardExistsGlobally, referencedAssetIds, onDrillLocateAsset, onDrillCleanupAsset, onDrillCleanupOrphans } = useWsAssetHygiene({
  store, d, workspaceId, router, drillOpen, revealNode: mind.revealNode,
})
// 第廿九轮：document click / window dragend 监听统一在上方 onMounted 注册

// ===== R117 拆分接线：资源台定位域（?hl= 卡片定位 / ?cat= 分类定位，均含增量渲染前置）=====
// 实现迁至 composables/useWsLocate.ts——两条链路共用「先切分类（展开祖先）再滚卡片」一套口径，
// 并统一在做 querySelector 之前调 ensureCardRendered（R112/R116 增量渲染后目标卡可能未进渲染集）。
// ===== R115 拆分接线：台元信息域（台名/图标/描述/重命名/导出/删除）=====
const {
  wsDisplayName, onNameBlur, onNameEnter,
  WS_ICONS, iconPickOpen, iconCustom, iconPickPos, toggleIconPick, setWsIcon,
  onDescBlur, onDescEnter, renameWs, editDesc, exportWorkspace, deleteWorkspace,
} = useWsMeta({ store, d, workspaceId, workspace, router, settingsMenuOpen, openInputModal })
// ===== 分类管理（第八轮：新建/重命名/删除入口统一到左栏与应用内弹窗） =====

</script>

<style scoped src="./workspace.css"></style>
