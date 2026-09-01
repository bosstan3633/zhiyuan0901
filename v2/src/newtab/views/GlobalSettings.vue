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

      <!-- ===== 资源卡字段 ===== -->
      <div v-if="activePage === 'resource'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">📇 资源卡字段设计</div>
          <div class="gs-page-desc">拖拽字段调整顺序，开关控制在卡片/列表/看板视图中是否显示</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.resource" card-type="resource" @change="onFieldChange" @notify="showToast" />
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
            <FieldEditor :fields="fields.task" card-type="task" @change="onFieldChange" @notify="showToast" />
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
            <FieldEditor :fields="fields.curiosity" card-type="curiosity" @change="onFieldChange" @notify="showToast" />
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
              <div><div class="gs-io-name">导入知源工作台数据</div><div class="gs-io-desc">选择JSON文件，与现有数据取并集（同ID更新，不同ID新增）</div></div>
              <button class="gs-btn gs-btn-primary gs-io-btn">选择文件</button>
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
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="handleFileImport" />
        <input ref="bookmarkInput" type="file" accept=".html,.htm" style="display:none" @change="handleBookmarkImport" />
      </div>

      <!-- ===== 导出数据 ===== -->
      <div v-if="activePage === 'export'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⬆ 导出数据</div>
          <div class="gs-page-desc">导出工作台数据用于备份或跨设备迁移</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">导出方式</span></div>
          <div class="gs-card-body">
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出全部数据</div><div class="gs-er-desc">所有工作台、资源卡、任务卡、好奇心卡导出为JSON文件</div></div>
              <button class="gs-btn gs-btn-primary" @click="exportAll">导出</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">按工作台导出CSV</div><div class="gs-er-desc">字段：标题/链接/链接类型/标签/分类/描述/创建时间/更新时间，适配Airtable等多维表</div></div>
              <select class="gs-select" v-model="csvWsId">
                <option value="">选择工作台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name }}</option>
              </select>
              <button class="gs-btn" @click="exportCsvForWorkspace" :disabled="!csvWsId">导出CSV</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出指定工作台</div><div class="gs-er-desc">选择一个工作台导出为JSON</div></div>
              <select class="gs-select" v-model="exportWsId">
                <option value="">选择工作台…</option>
                <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name }}</option>
              </select>
              <button class="gs-btn" @click="exportWorkspace" :disabled="!exportWsId">导出</button>
            </div>
            <div class="gs-export-row">
              <div class="gs-er-info"><div class="gs-er-name">导出为Markdown</div><div class="gs-er-desc">将资源卡导出为带链接和注解的Markdown文档</div></div>
              <button class="gs-btn" @click="exportMarkdown">导出MD</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 快捷键设置 ===== -->
      <div v-if="activePage === 'shortcuts'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">⌨ 快捷键设置</div>
          <div class="gs-page-desc">💡 系统级快捷键请在浏览器地址栏打开 chrome://extensions/shortcuts 自定义（高效使用知源的第一步）；应用内快捷键开箱即用</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">全局快捷键（任意网页可用）</span><span class="gs-card-desc">由 Chrome 统一管理</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row" v-for="c in chromeCommands" :key="c.name">
              <span class="gs-sr-label">{{ c.description }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ c.shortcut || '未设置' }}</span></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">修改全局快捷键</span>
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
            <option value="alt">Alt + 数字键（1=知源罗盘，2+=第 N 个工作台）</option>
            <option value="ctrl">Ctrl + 数字键（1=知源罗盘，2+=第 N 个工作台）</option>
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

      <!-- ===== 工作台快捷键（第廿九轮：顺序即快捷键，跟随顶部 Tab 位置） ===== -->
      <div v-if="activePage === 'shortcuts'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title">🎛 工作台快捷键</div>
          <div class="gs-page-desc">在工作台标签页内按「修饰键 + 数字」直达；数字 1 固定留给知源罗盘；顺序即快捷键——拖动顶部工作台 Tab 调整位置，快捷键随之变化</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">映射表（按顶部导航顺序）</span><span class="gs-card-desc">第 N 个工作台 = 修饰键 + N+1（最多到数字 9）</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row" v-for="(w, i) in store.workspaces" :key="w.id">
              <span class="gs-sr-label">第 {{ i + 1 }} 个 · {{ w.icon }} {{ w.name.replace(/^[^\s]+\s/, '') }}</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ i + 2 <= 9 ? modLabel() + ' + ' + (i + 2) : '—' }}</span></div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">修饰键</span>
              <div class="gs-sr-control"><span class="gs-keycap">{{ modLabel() }} + 数字</span></div>
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
          <div class="gs-page-desc">donge 哥 · 致每一位知源工作台的同行者</div>
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
              <div class="gs-da-info"><div class="gs-da-name">一键回滚至初始状态</div><div class="gs-da-desc">清空所有用户创建的工作台和所有资源卡、好奇心卡、任务卡，仅保留知源罗盘首页、任务中心和工作台</div></div>
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
              <div class="gs-sr-control" style="color:var(--text-2);font-size:12px">V2.14.0</div>
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
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ w.name }}（待分类）</option>
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
            <div class="gs-about-logo"><img :src="logoUrl" alt="知源工作台" /></div>
            <div class="gs-about-name">知源工作台</div>
            <div class="gs-about-version">版本 V2.1</div>
            <div class="gs-about-motto">"从好奇出发，向源头求证"</div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body">
            <div class="gs-about-row"><span class="label">数据存储</span><span class="value">所有数据存储在本地，不上传云端</span></div>
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
            <p>此操作将清空所有用户创建的工作台和所有资源卡、好奇心卡、任务卡，<b style="color:var(--danger)">仅保留知源罗盘首页、任务中心和工作台</b>。</p>
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
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import FieldEditor from './FieldEditor.vue'
import logoUrl from '@/assets/logo.png'
import { createDefaultData } from '@/shared/storage/defaults'
import { LETTER_HTML, buildLetterStandaloneHtml } from '../letter-data'
import { uid } from '@/shared/utils'
import type { FieldDef, AppData, ResourceCard, Workspace, Category, TagNode } from '@/shared/models'

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
const activePage = ref('resource')
/** 深链：/settings?page=tags 直达指定面板（TagPicker 空体系引导跳转用） */
function pageFromQuery(): string | null {
  const p = route.query.page
  if (typeof p !== 'string') return null
  return navGroups.some(g => g.items.some(i => i.key === p)) ? p : null
}
onMounted(() => { const p = pageFromQuery(); if (p) activePage.value = p })
watch(() => route.query.page, () => { const p = pageFromQuery(); if (p) activePage.value = p })
const navGroups = [
  { title: '卡片字段', items: [
    { key: 'resource', icon: '📇', label: '资源卡' },
    { key: 'task', icon: '✅', label: '任务卡' },
    { key: 'curiosity', icon: '💡', label: '好奇心卡' },
  ]},
  { title: '数据管理', items: [
    { key: 'tags', icon: '🏷', label: '标签管理' },
    { key: 'import', icon: '⬇', label: '导入数据' },
    { key: 'export', icon: '⬆', label: '导出数据' },
    { key: 'reset', icon: '🔄', label: '重置与回滚' },
  ]},
  { title: '其他', items: [
    { key: 'extension', icon: '🔌', label: '扩展设置' },
    { key: 'shortcuts', icon: '⌨', label: '快捷键设置' },
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
    if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title">知源工作台V2.12全产品PRD手册</div>'
    if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link">🔗 D:\\zhiyuan-V2.12\\PRD手册.docx</span></div>'
    if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-field-text" style="color:var(--text-3);font-size:11px">完整记录V2.12版本的功能设计、交互规范和数据模型...</span></div>'
    if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">来源:</span><span class="gs-pv-field-text">学术</span></div>'
    if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span><span class="gs-pv-tag">#产品设计</span></span></div>'
    if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">添加:</span><span class="gs-pv-field-text">2026-08-28</span></div>'
    return html
  }
  if (previewMode.value === 'list') {
    let html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    if (has('title')) html += '<span style="font-weight:600;font-size:12px">知源工作台V2.12全产品PRD手册</span>'
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
  if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title" style="font-size:12px">知源工作台V2.12全产品PRD手册</div>'
  if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span></span></div>'
  if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link" style="font-size:10px">🔗 PRD手册.docx</span></div>'
  if (has('description')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">功能设计、交互规范...</span></div>'
  if (has('sourceType')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">学术</span></div>'
  if (has('createdAt')) html += '<div class="gs-pv-field"><span style="font-size:10px;color:var(--text-3)">08-28</span></div>'
  return html
})

// ---- 导入 ----
const fileInput = ref<HTMLInputElement | null>(null)
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
      mergeImport(imported)
      showToast('✓ 导入成功，与现有数据取并集')
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

function mergeImport(imported: AppData) {
  const d = store.data!
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(x => [x.id, x]))
    for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
    return [...map.values()]
  }
  d.workspaces = mergeById(d.workspaces, imported.workspaces || [])
  d.categories = mergeById(d.categories, imported.categories || [])
  d.resources = mergeById(d.resources, imported.resources || [])
  d.tasks = mergeById(d.tasks, imported.tasks || [])
  d.curiosities = mergeById(d.curiosities, imported.curiosities || [])
  if (imported.tagTree?.length) {
    const existIds = new Set(d.tagTree.map(t => t.id))
    for (const root of imported.tagTree) if (!existIds.has(root.id)) d.tagTree.push(root)
  }
  if (imported.fieldConfig) {
    for (const key of ['resource', 'task', 'curiosity'] as const) {
      const existingKeys = new Set(d.fieldConfig[key].map(f => f.key))
      for (const f of imported.fieldConfig[key]) {
        if (!existingKeys.has(f.key)) d.fieldConfig[key].push(f)
      }
    }
  }
  store.persist()
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
  showToast('✓ 全部数据已导出为JSON')
}

/** 按工作台导出 CSV（字段：标题/链接/链接类型/标签/分类/描述/创建时间/更新时间——第卅二轮 REQ-006 补更新时间列） */
function exportCsvForWorkspace() {
  if (!csvWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === csvWsId.value)
  if (!ws) return
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  const cards = d.resources.filter(r => !r.deletedAt && r.workspaceId === csvWsId.value)
  const headers = ['标题', '链接', '链接类型', '标签', '分类', '描述', '置顶', '星标', '创建时间', '更新时间']
  const rows = cards.map(r => [
    r.title,
    r.link,
    r.linkType === 'url' ? 'URL' : r.linkType === 'file' ? '本地文件' : 'Obsidian',
    (r.tags || []).join(';'),
    catMap.get(r.categoryId) || '待分类',
    r.description || '',
    r.pinned ? '是' : '',
    r.starred ? '是' : '',
    new Date(r.createdAt).toISOString().slice(0, 10),
    r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : ''
  ].map(csvEscape))
  downloadFile(`zhiyuan_${ws.name.replace(/^[^\s]+\s/, '')}_${dateStr()}.csv`,
    '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
    'text/csv;charset=utf-8')
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
    curiosities: d.curiosities.filter(c => c.relatedResourceIds?.some(rid => d.resources.find(r => r.id === rid)?.workspaceId === ws.id))
  }
  downloadFile(`zhiyuan_${ws.name}_${dateStr()}.json`, JSON.stringify(subset, null, 2))
  showToast(`✓ 「${ws.name}」已导出`)
}

function exportMarkdown() {
  const d = store.data!
  const wsMap = new Map(d.workspaces.map(w => [w.id, w.name]))
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  let md = '# 知源工作台 · 资源卡导出\n\n'
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
        'open-dashboard': '打开知源工作台（新标签页）',
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
.gs-letter { max-width: 640px; margin: 0 auto; padding: 72px 64px !important; background: var(--surface); font-family: "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif; }
.gs-letter .lp-saluta { font-size: 15px; margin-bottom: 36px; color: var(--text); }
.gs-letter .lp-body p { font-size: 13.5px; line-height: 2.75; margin: 0 0 32px; text-align: justify; color: var(--text-2); }
.gs-letter .lp-body b { color: var(--text); }
.gs-letter .lp-sign { margin-top: 72px; text-align: right; font-size: 13px; line-height: 2.2; color: var(--text-3); }
.gs-letter .lp-sign b { font-size: 14px; color: var(--text); }
.gs-letter .lp-date { font-size: 11px; color: var(--text-4); margin-top: 10px; letter-spacing: .05em; }
/* 第卅轮：模块化分节——lp-h 节头（粗体转折句独立成节）/ lp-turn 节内停顿（短句）/ lp-creed 信念行 */
.gs-letter .lp-body p.lp-h { margin: 56px 0 32px; font-size: 14.5px; color: var(--text); }
.gs-letter .lp-body p.lp-turn { margin: 20px 0 32px; color: var(--text); }
.gs-letter .lp-body p.lp-creed { margin: 48px 0 0; letter-spacing: .08em; color: var(--text); font-weight: 600; }
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
</style>
