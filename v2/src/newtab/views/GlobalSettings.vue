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
          v-pressable
          :class="{ active: activePage === item.key }"
          @click="onNavClick(item)"
        >
          <AiEntryButton v-if="item.mark" class="gs-nav-icon" /><Icon v-else-if="item.icon" class="gs-nav-icon" :name="item.icon" :size="14" />{{ item.label }}
        </div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <main class="gs-content">
      <!-- 返回按钮 -->
      <div class="gs-back-btn" v-pressable @click="router.push('/compass')">← 返回</div>

      <!-- ===== V3.8.9（W9）：知源仪表盘面板退役 —— 概览带 + 复盘段 + 操作记录 + 全量抽屉 + 两个下钻抽屉
           整体迁至画像洞察页（/profile · ProfileInsights.vue）。热力图此前已随 W2 迁调度台 HeatmapModule。
           退役重指备案：R44/R46/R48/R51/R172-T6 系列门禁改判 ProfileInsights.vue；openReview 改指 /profile。 ===== -->

      <!-- ===== 资源卡字段 ===== -->
      <div v-if="activePage === 'resource'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="contact" :size="13"/> 资源卡字段设计</div>
          <div class="gs-page-desc">拖拽字段调整顺序，开关控制在卡片/列表/看板视图中是否显示</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">字段列表</span><span class="gs-card-desc">顺序即视图展示顺序</span></div>
          <div class="gs-card-body">
            <FieldEditor :fields="fields.resource" card-type="resource" :cross-fields="fields" @change="onFieldChange" @notify="showToast" />
          </div>
        </div>
        <div class="gs-preview-section">
          <div class="gs-preview-title"><Icon name="eye" :size="13"/> 实时预览 · {{ previewModeLabel }}视图</div>
          <div class="gs-preview-tabs">
            <div v-for="m in previewModes" :key="m.key" class="gs-preview-tab" v-pressable :class="{ active: previewMode === m.key }" @click="previewMode = m.key">{{ m.label }}</div>
          </div>
          <div class="gs-preview-card" v-html="resourcePreviewHtml"></div>
        </div>
      </div>

      <!-- ===== 任务卡字段 ===== -->
      <div v-if="activePage === 'task'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="check" :size="13"/> 任务卡字段设计</div>
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
          <div class="gs-page-title"><Icon name="bulb" :size="13"/> 好奇心卡字段设计</div>
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
          <div class="gs-page-title"><Icon name="landmark" :size="13"/> 策展主题卡字段设计</div>
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
          <div class="gs-page-title"><Icon name="tag" :size="13"/> 标签管理 <button class="gs-btn ai-batch-btn" :disabled="!aiReady" title="AI 体检标签体系：同义合并 + 裸标签归位（勾选采纳才级联改卡与树）" @click="aiTagGovern"><AiEntryButton variant="inline" label="标签体检" /></button><button class="gs-btn ai-batch-btn" :disabled="!aiReady" title="AI 整体梳理：盘点全库三类卡（只看卡面字段，不读链接正文）→ 结合愿景/目标重建标签树蓝图（每个标签标出预计收几张卡）→ 采纳即整树替换并同步改写卡标签 → 全卡补全打标，两道评审门 + 自动快照可还原" @click="aiTagRevise"><AiEntryButton variant="inline" label="整体梳理" /></button><button v-if="aiReviseBak" class="gs-btn ai-batch-btn" title="回滚到上次整体梳理之前（标签树与卡片标签全还原）" @click="aiRestoreRevise"><Icon name="rotateccw" :size="13"/> 还原上次梳理</button></div>
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
                <span class="gs-tt-ico"><Icon name="tag" :size="13"/></span>
                <input v-model="ttEditing.value" class="gs-tt-input" v-focus
                  placeholder="输入根标签名称，Enter 确认 · Esc 取消"
                  @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
              </div>
              <template v-for="root in tagTree" :key="root.id">
                <div class="gs-tt-row" v-pressable :class="{editing: ttEditing?.id === root.id, flash: ttFlashId === root.id, active: ttActiveTag === root.name, drop: ttDropTarget === root.id}" :data-depth="tagDepth(root.id)" :style="{ paddingLeft: 8 + tagDepth(root.id) * 18 + 'px' }" draggable="true"
                  @dragstart="ttDragStart($event, root.id)" @dragend="ttDragEnd"
                  @dragover.prevent="ttDropTarget = root.id" @dragleave="ttDropTarget === root.id && (ttDropTarget = '')" @drop.prevent="ttDrop($event, root.id)" @click="selectTtTag(root.name)" @dblclick="ttRename(root.id)">
                  <span class="gs-tt-toggle" v-pressable :class="{leaf: !safeChildren(root).length}" @click="ttToggle(root.id)">{{ ttCollapsed.has(root.id) ? '▸' : '▾' }}</span>
                  <input v-if="ttEditing?.id === root.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                    @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                  <template v-else>
                    <span class="gs-tt-name">#{{ root.name || '未命名标签' }}</span>
                    <span class="gs-tt-count">{{ tagUsage(root.name) }} 卡</span>
                    <span class="gs-tt-actions">
                      <span class="gs-tt-act" v-pressable title="添加子标签" @click="ttAddChild(root.id)">＋</span>
                      <span class="gs-tt-act" v-pressable title="重命名" @click="ttRename(root.id)"><Icon name="edit" :size="13"/></span>
                      <span class="gs-tt-act del" v-pressable title="删除" @click="ttRemove(root.id)"><Icon name="trash" :size="13"/></span>
                    </span>
                  </template>
                </div>
                <!-- 新建子标签：行内输入 -->
                <div v-if="ttEditing && !ttEditing.id && ttEditing.parentId === root.id" class="gs-tt-row editing" :style="{ paddingLeft: 8 + (tagDepth(root.id) + 1) * 18 + 'px' }">
                  <span class="gs-tt-ico"><Icon name="tag" :size="13"/></span>
                  <input v-model="ttEditing.value" class="gs-tt-input" v-focus
                    placeholder="输入子标签名称，Enter 确认 · Esc 取消"
                    @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                </div>
                <template v-if="!ttCollapsed.has(root.id)">
                  <div v-for="child in safeChildren(root)" :key="child.id" class="gs-tt-row subrow" v-pressable :class="{editing: ttEditing?.id === child.id, flash: ttFlashId === child.id, active: ttActiveTag === root.name + '/' + child.name, drop: ttDropTarget === child.id}" :data-depth="tagDepth(child.id)" :style="{ paddingLeft: 8 + tagDepth(child.id) * 18 + 'px' }" draggable="true"
                    @dragstart="ttDragStart($event, child.id)" @dragend="ttDragEnd"
                    @dragover.prevent="ttDropTarget = child.id" @dragleave="ttDropTarget === child.id && (ttDropTarget = '')" @drop.prevent="ttDrop($event, child.id)" @click="selectTtTag(root.name + '/' + child.name)" @dblclick="ttRename(child.id)">
                    <input v-if="ttEditing?.id === child.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                      @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                    <template v-else>
                      <span class="gs-tt-name sub">#{{ child.name || '未命名标签' }}</span>
                                            <span class="gs-tt-count">{{ tagUsage(root.name + '/' + child.name) }} 卡</span>
                      <span class="gs-tt-actions">
                        <span class="gs-tt-act" v-pressable title="提升为根标签" @click="ttUnnest(root.id, child.id)"><Icon name="upload" :size="13"/></span>
                        <span class="gs-tt-act" v-pressable title="重命名" @click="ttRename(child.id)"><Icon name="edit" :size="13"/></span>
                        <span class="gs-tt-act del" v-pressable title="删除" @click="ttRemove(child.id)"><Icon name="trash" :size="13"/></span>
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
            <button class="gs-field-add" @click="ttCollectFromCards">⤓ 从卡片收纳标签</button>
                        <div class="gs-field-hint"><Icon name="bulb" :size="13"/> 重命名 / 删除 / 挂载会<b>同步更新卡片上的标签值</b>（子标签以「父/子」路径保存）；删除标签时，卡片上的对应标签一并移除。打标签入口：资源卡/任务卡/好奇心卡的详情编辑处。</div>
          </div>
        </div>
          <!-- R127：右列——当前标签下的卡片（三卡合一 / 类型过滤 / 搜索 / 多选拖拽移动） -->
          <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-title">#{{ ttActiveTag || '未选择标签' }}{{ ttActiveTag ? ' · ' + ttRows.length + ' 张' : '' }}</span><label v-if="ttActiveTag" class="tt-allcheck"><input type="checkbox" :checked="ttAllChecked" @change="toggleTtAll" /> 全选本标签</label><button v-if="ttPicked.size" class="gs-btn ai-batch-btn" :disabled="!aiReady" title="对勾选卡片做 AI 批量补全（标签/描述/分类建议）" @click="aiTtEnrich"><AiEntryButton variant="inline" :label="'批量补全(' + ttPicked.size + ')'" /></button><span class="gs-card-desc">单击选中 · 双击详情 · 多选后拖到左侧标签即移动（替换）</span></div>
            <div class="gs-card-body">
              <div v-if="!ttActiveTag" class="gs-tt-empty">点击左侧标签查看其下卡片</div>
              <template v-else>
                <div class="tt-tools">
                  <select v-model="ttCardKind" class="gs-select">
                    <option value="all">全部类型</option>
                    <!-- ★V3.8.25（B1-a）：`<option>` 的内容模型是纯文本，子元素一律不渲染。
                         G1 把 `🗂 资源卡` 这类 emoji 机械换成 `<Icon>` 后，这三处图标**从来没显示过**
                         （浏览器丢弃 option 内的 SVG）——比原来的 emoji 还少一个标识。故移除，只留文字。 -->
                    <option value="resource">资源卡</option>
                    <option value="task">任务卡</option>
                    <option value="curiosity">好奇心卡</option>
                  </select>
                  <!-- ★V3.8.25（B1-a）：原来这里写内联 `flex: 1`，但 `.gs-tt-input` 自有规则里已经是
                       `flex: 1; min-width: 0` —— 这条内联是纯冗余，直接删掉即可（不是收进类，是删除）。 -->
                  <input v-model="ttCardQ" class="gs-tt-input" placeholder="搜索标题 / 链接 / 描述…" />
                  <span v-if="ttPicked.size" class="tt-picked">已选 {{ ttPicked.size }} 张 · 拖到左侧标签即可移动</span>
                </div>
                <div class="tt-list">
                  <div v-for="row in ttRows" :key="row.id" class="tt-card" v-pressable :class="{ selected: ttPicked.has(row.id), dragging: ttCardDragging && ttPicked.has(row.id) }" draggable="true"
                    @click="onTtRowClick(row)" @dblclick="onTtRowDblClick(row)" @dragstart="onTtRowDragStart($event, row)" @dragend="onTtRowDragEnd">
                    <input type="checkbox" class="tt-check" :checked="ttPicked.has(row.id)" @click.stop @change="ttTogglePick(row.id)" />
                    <div class="tt-card-main">
                      <div class="tt-card-title"><Icon v-if="row.kind === 'resource'" name="package" :size="14"/><Icon v-else-if="row.kind === 'task'" name="checksquare" :size="14"/><Icon v-else name="bulb" :size="14"/> {{ row.title }}</div>
                      <div class="tt-card-sub">{{ row.sub }}</div>
                    </div>
                  </div>
                  <EmptyState v-if="!ttRows.length" size="inline" icon="folder" title="该标签下暂无卡片" hint="给卡片打上这个标签后，会在这里列出来" />
                </div>
              </template>
            </div>
          </div>
        </div>
        <!-- R130-T2：详情抽屉必须挂在标签管理面板内——R127 误放进「资源台全景」面板（v-if activePage==='panorama'），
             在标签管理页该面板整体不渲染，双击 ttDetail 赋值后无人消费 → 抽屉永不出现 -->
        <Drawer :open="!!ttDetail" title="卡片详情" @close="ttDetail = null">
          <template v-if="ttDetail">
            <div class="gs-pd-title">{{ ttDetail.title }}</div>
            <div class="gs-pd-row" v-if="ttDetail.link"><span class="gs-pd-k">链接</span><span class="gs-pd-v">{{ ttDetail.link }}</span></div>
            <div class="gs-pd-row" v-if="ttDetail.desc"><span class="gs-pd-k">描述</span><span class="gs-pd-v">{{ ttDetail.desc }}</span></div>
            <div class="gs-pd-row"><span class="gs-pd-k">类型</span><span class="gs-pd-v">{{ ttDetail.kind === 'resource' ? '资源卡' : ttDetail.kind === 'task' ? '任务卡 · ' + (ttDetail.status === 'done' ? '已完成' : ttDetail.status === 'doing' ? '进行中' : '待开始') : '好奇心卡 · ' + (ttDetail.status || '') }}</span></div>
            <div class="gs-pd-row" v-if="ttDetail.tags.length"><span class="gs-pd-k">标签</span><span class="gs-pd-v">#{{ ttDetail.tags.join(' #') }}</span></div>
            <div class="gs-pd-actions">
              <button v-if="ttDetail.kind === 'resource' && ttDetail.link" class="gs-btn gs-btn-primary" @click="openCardLink({ link: ttDetail.link })"><Icon name="external" :size="13"/> 打开链接</button>
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
          <b>AI 任务 {{ aiTray.length }}</b><span class="ai-tray-hint">关掉抽屉也在后台跑；同一功能再点=回到这份进度，跑完可「<Icon name="refresh" :size="13"/> 重新运行」</span>
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
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="plug" :size="12"/> 接入配置</span><span class="gs-card-desc">DeepSeek / Kimi / 通义 / OpenAI 等兼容协议均可；模型可手填</span></div>
          <div class="gs-card-body ai-form">
            <label class="ai-field"><span>API 地址（baseUrl）</span><input class="gs-input" :value="aiConfig.baseUrl" placeholder="如 https://api.deepseek.com/v1" @change="patchAiConfig({ baseUrl: ($event.target as HTMLInputElement).value })" /></label>
            <label class="ai-field"><span>API Key</span><input class="gs-input" type="password" :value="aiConfig.apiKey" placeholder="sk-…（仅存本机 chrome.storage）" @change="patchAiConfig({ apiKey: ($event.target as HTMLInputElement).value })" /></label>
            <label class="ai-field"><span>模型</span>
              <input class="gs-input" list="ai-model-list" :value="aiConfig.model" placeholder="如 deepseek-chat" @change="patchAiConfig({ model: ($event.target as HTMLInputElement).value })" />
              <datalist id="ai-model-list"><option v-for="m in aiModels" :key="m" :value="m" /></datalist>
            </label>
            <div class="ai-form-row">
              <button class="gs-btn" :disabled="aiBusy !== '' || !aiConfig.baseUrl || !aiConfig.apiKey" @click="aiFetchModels"><Icon v-if="aiBusy !== 'models'" name="download" :size="13"/>{{ aiBusy === 'models' ? '拉取中…' : '拉取模型列表' }}</button>
              <button class="gs-btn" :disabled="aiBusy !== '' || !aiReady" @click="aiTestConn"><Icon v-if="aiBusy !== 'test'" name="zap" :size="13"/>{{ aiBusy === 'test' ? '测试中…' : '测试连接' }}</button>
              <span v-if="aiMsg" class="ai-msg" :class="{ err: aiMsg.startsWith('') }">{{ aiMsg }}</span>
            </div>
          </div>
        </div>

        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="contact" :size="12"/> 关于我（全局画像 · 注入所有 AI 场景）</span><span class="gs-card-desc">写你在做什么、偏好什么风格、忌讳什么，模型不必每个场景重新交代背景</span></div>
          <div class="gs-card-body">
            <textarea class="ai-textarea" rows="3" :value="aiConfig.aboutMe" placeholder="例：在读研究生，主线是毕业论文 + 个人知识体系；建议直接、给可执行动作，不要客套话与空泛鼓励" @change="patchAiConfig({ aboutMe: ($event.target as HTMLTextAreaElement).value })" />
          </div>
        </div>

        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="brain" :size="12"/> 深度诊断</span><span class="gs-card-desc">整库结构摘要投喂所选专家，逐员出「发现+建议」；勾选采纳=生成跟进任务卡</span></div>
          <div class="gs-card-body">
            <div class="ai-guide">三步上手：① 上方接入配置完成（<Icon name="zap" :size="13"/> 测试连接通过）› ② 勾选本轮出诊专家（<Icon name="settings" :size="13"/> 可调启停 / 行文风格 / 自建资料）› ③ 一键诊断。发现勾选采纳=逐条生成跟进任务卡；不采纳即纯看。</div>
            <div v-for="p in aiPersonas" :key="p.id" class="ai-pwrap">
              <div class="ai-persona-row">
                <label class="ai-persona"><input type="checkbox" :checked="aiPersonaSel.includes(p.id)" @change="aiTogglePersona(p.id)" /> {{ p.icon }} {{ p.name }}</label>
                <span class="ai-persona-brief">{{ p.brief }}</span>
                <button class="ai-btn-mini" :class="{ on: aiEditP === p.id }" title="调整该专家：出诊启停 / 行文风格" @click="aiEditP = aiEditP === p.id ? '' : p.id"><Icon name="settings" :size="13"/></button>
                <button v-if="p.id.startsWith('custom-')" class="ai-btn-mini danger" title="删除该自建专家" @click="aiRemovePersona(p.id)"><Icon name="x" :size="13"/></button>
              </div>
              <div v-if="aiEditP === p.id" class="ai-pedit">
                <label class="ai-persona"><input type="checkbox" :checked="aiPersonaCfg(p.id)?.enabled !== false" @change="aiPatchPersona(p.id, { enabled: ($event.target as HTMLInputElement).checked })" /> 参与会诊与执笔</label>
                <input class="gs-input" placeholder="风格覆盖（可选，如：直说问题、只给三个动作、少用形容词）" :value="aiPersonaCfg(p.id)?.style || ''" maxlength="120" @change="aiPatchPersona(p.id, { style: ($event.target as HTMLInputElement).value })" />
                <template v-if="!p.id.startsWith('custom-')">
                  <!-- R142（反馈 #6）：内置两员开放人设/关注面覆盖编辑，留空=用内置默认 -->
                  <textarea class="ai-textarea" rows="2" title="人设覆盖（留空=内置默认）" :value="p.brief" maxlength="120" @change="aiPatchPersona(p.id, { brief: ($event.target as HTMLTextAreaElement).value })" />
                  <textarea class="ai-textarea" rows="2" title="关注面覆盖（留空=内置默认）" :value="p.focus" maxlength="200" @change="aiPatchPersona(p.id, { focus: ($event.target as HTMLTextAreaElement).value })" />
                  <div><button class="ai-btn-mini ai-btn-mini--text" title="清空覆盖，恢复内置默认人设与关注面" @click="aiPatchPersona(p.id, { brief: '', focus: '' })"><Icon name="rotateccw" :size="13"/> 恢复内置默认</button></div>
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
                <option value="default">默认执笔：场景内置角色</option>
                <option v-for="p in aiPersonas.filter(x => personaOverrides()[x.id]?.enabled !== false)" :key="p.id" :value="p.id">{{ p.icon }} {{ p.name }} 执笔</option>
              </select>
              <button class="gs-btn gs-btn-primary" :disabled="!aiReady" @click="aiDiagnose"><Icon name="brain" :size="13"/> 一键诊断</button>
            </div>
          </div>
        </div>

        <div class="gs-card">
          <!-- R158：被动型 AI 入口（跨台镜像/主题漂移/沉睡唤醒）迁 AI 建议面板（命令面板 Ctrl+K → AI 建议）；
               本页只留主动型（回收站捞回 / 本周回顾 / 成果文稿）与轻量指引 -->
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="compass" :size="12"/> 库内治理与成文</span><span class="gs-card-desc">主动型：回收站捞回 / 本周回顾 / 成果文稿（标签体检与整体梳理在「标签管理」页；被动建议在命令面板 Ctrl+K › AI 建议）</span></div>
          <div class="gs-card-body ai-form-row">
            <button class="gs-btn" :disabled="!aiReady" @click="aiTrashRescue"><Icon name="trash" :size="13"/> 回收站捞回</button>
            <button class="gs-btn" :disabled="!aiReady" title="近 7 天台账 → 周回顾草稿；跑完自动存为一张周回顾卡（同日重跑只刷新那张）" @click="aiWeeklyReview"><Icon name="calendar" :size="13"/> 本周回顾</button>
            <label class="ai-field inline"><input class="gs-input ai-genre" type="text" v-model="aiGenre" placeholder="体裁（可留空）：公众号短文 / 分享稿 / 结项说明…" @keydown.enter.prevent="aiDeliver" /></label>
            <button class="gs-btn" :disabled="!aiReady" title="论点卡 + 活跃目标 + 近 30 天完成 → 一篇可交付文稿；跑完自动存为一张成果文稿卡（同日重跑只刷新那张），也可下载 .md" @click="aiDeliver"><Icon name="filetext" :size="13"/> 成果文稿</button>
          </div>
        </div>

        <p class="gs-field-hint">隐私与性能口径：仅投本场景相关实体文本（KB 级），附件本体与其它数据不出本机；全部手动触发、无常驻轮询；AI 建议不入库，勾选采纳才落。</p>
      </div>



      <!-- ===== 数据管理 ===== 原导入/导出/Airtable 三页合并为一个子域；内部用分段切换。 -->
      <SettingsDataManagement v-if="activePage === 'data'"
        :format-bytes="formatBytes" :ai-ready="aiReady" :ai-enrich-ids="aiEnrichIds"
        :initial-tab="dataManagementTab" />

      <!-- 回收站：取消独立二级页，直接在设置页右侧内容区呈现。 -->
      <RecycleBin v-else-if="activePage === 'recycle'" embedded @navigate="router.push($event)" />

      <!-- ===== 快捷键设置 =====（V3.8.42 P0-3 第五批：已拆为 settings/SettingsShortcutsPanel.vue，
           含「快捷键设置」与「策展台快捷键」两个 gs-panel、chrome.commands 动态拉取、
           wsMod 切台修饰键下拉与 appShortcuts（经 shortcuts.ts 派生）。
           shortcutsUrl 继续由宿主传入（extension 子域共用同一份）。
           判据锚：R49-26/R50-F8 命令表动态拉取、R69-4 键位随偏好派生、H1 策展台映射、
           H3-4 回落值与生效值一致、B7-e H3 三处同源 —— 均走 read() 聚合层可命中） -->
      <SettingsShortcutsPanel v-if="activePage === 'shortcuts'"
        :shortcuts-url="shortcutsUrl"
        :ws-display-name-of="wsDisplayNameOf" />

      <!-- V3.8.42 P0-3 第二批：「使用手册」子域已搬至 settings/SettingsManualPanel.vue -->
      <SettingsManualPanel v-if="activePage === 'manual'" />

      <!-- ===== 写给用户的一封信 ===== -->
      <!-- V3.8.42 P0-3 第一批：子域已搬至 settings/SettingsLetterPanel.vue（判据锚点由 helpers 的
           设置页聚合读取层接住，214 处读设置页正文的判据因此零改动仍绿）。 -->
      <SettingsLetterPanel v-if="activePage === 'letter'" />


      <!-- V3.8.42 P0-3 第三批：「重置与回滚」子域（含回滚确认弹窗）已搬至 settings/SettingsResetPanel.vue -->
      <SettingsResetPanel v-if="activePage === 'reset'" />


      <!-- V3.8.42 P0-3 第三批：「扩展设置」子域已搬至 settings/SettingsExtensionPanel.vue -->
      <SettingsExtensionPanel v-if="activePage === 'extension'"
        :runtime-version="runtimeVersion" :shortcuts-url="shortcutsUrl" />

      <!-- V3.8.42 P0-3 第二批：子域已搬至 settings/SettingsChangelogPanel.vue -->
      <SettingsChangelogPanel v-if="activePage === 'changelog'" :runtime-version="runtimeVersion" :ordered-changelog="orderedChangelog" />

      <!-- V3.8.42 P0-3 第二批：子域已搬至 settings/SettingsAboutPanel.vue。
           存储态与订阅仍留宿主（onMounted 的 refreshStorage / subscribeSaveError 属宿主生命周期，
           随 v-if 拆出去会导致切页时反复退订重订），子组件只收 props、发事件。 -->
      <SettingsAboutPanel v-if="activePage === 'about'"
        :logo-url="logoUrl" :runtime-version="runtimeVersion"
        :bytes-in-use="bytesInUse" :unlimited-storage="unlimitedStorage" :save-error="saveError"
        @dismiss-save-error="markSaveErrorRead" @toast="showToast" />

    </main>

    <!-- R134-F：AI 建议评审抽屉（批量补全/沉睡唤醒/深度诊断共用消费面） -->
    <AiSuggestionDrawer v-if="aiJob" :job="aiJob" :job-key="aiJobKey || undefined" @close="aiJobClosed" />

  </div>
</template>

<script setup lang="ts">
// 设置页只保留视图壳；导航、字段编辑、标签、AI 与面板状态分别由 composable 持有。
defineOptions({ name: 'GlobalSettingsView' })
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { showToast } from '@/shared/components/toast'
import FieldEditor from './FieldEditor.vue'
import { aiConfig, patchAiConfig, aiReady, type AiDepth } from '@/shared/ai/config'
import { personaOverrides } from '@/shared/ai/scenarios'
import SettingsLetterPanel from './settings/SettingsLetterPanel.vue'
import SettingsManualPanel from './settings/SettingsManualPanel.vue'
import SettingsChangelogPanel from './settings/SettingsChangelogPanel.vue'
import SettingsAboutPanel from './settings/SettingsAboutPanel.vue'
import SettingsResetPanel from './settings/SettingsResetPanel.vue'
import SettingsExtensionPanel from './settings/SettingsExtensionPanel.vue'
import SettingsDataManagement from './settings/SettingsDataManagement.vue'
import RecycleBin from './RecycleBin.vue'
import SettingsShortcutsPanel from './settings/SettingsShortcutsPanel.vue'
import MigrateReportCard from '../components/MigrateReportCard.vue'
import Drawer from '@/shared/components/Drawer.vue'
import AiSuggestionDrawer from '@/newtab/components/AiSuggestionDrawer.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { useGlobalSettings } from './useGlobalSettings'

const {
  logoUrl, router, shortcutsUrl, activePage,
  onNavClick, dataManagementTab, navGroups,
  runtimeVersion, orderedChangelog, bytesInUse, unlimitedStorage, saveError,
  markSaveErrorRead, formatBytes, fields, onFieldChange,
  previewMode, previewModes, previewModeLabel, resourcePreviewHtml,
  tagTree, ttCollapsed, ttEditing, ttFlashId, vFocus,
  safeChildren, tagDepth, tagUsage, ttToggle, ttAddRoot,
  ttAddChild, ttActiveTag, ttCardKind, ttCardQ, ttPicked,
  ttDropTarget, ttCardDragging, ttDetail, selectTtTag,
  ttTogglePick, ttRows, onTtRowClick, ttAllChecked, toggleTtAll,
  aiJob, aiJobKey, aiModels, aiBusy, aiMsg, aiGenre, aiPersonas,
  aiPersonaSel, aiNewP, aiAddPersona, aiRemovePersona, aiEditP,
  aiPersonaCfg, aiPatchPersona, aiCustomPatch, aiOpenJob, aiTray,
  aiOpenState, aiTrayClear, aiTagGovern, aiReviseBak, aiTagRevise,
  aiJobClosed, aiRestoreRevise, aiTrashRescue, aiWeeklyReview,
  aiDeliver, aiFetchModels, aiTestConn, aiTogglePersona,
  aiTtEnrich, aiEnrichIds, aiDiagnose, onTtRowDblClick,
  onTtRowDragStart, onTtRowDragEnd, openCardLink, ttRename,
  ttConfirm, ttCancel, ttRemove, ttDragStart, ttDragEnd,
  ttDrop, ttUnnest, ttCollectFromCards,
} = useGlobalSettings()
</script>

<!-- V3.8.42：跨子域共享基类（.gs-card/.gs-btn/.gs-setting-row…）已外提为 settings/base.css。
     必须非 scoped —— Vue 的 scoped 命中不了子组件内部元素，外提前四个已拆子域的卡片外壳全部失效。 -->
<style src="./settings/base.css"></style>

<style scoped src="./settings/GlobalSettings.css"></style>
