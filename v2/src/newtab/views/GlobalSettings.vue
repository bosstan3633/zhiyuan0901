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



      <!-- ===== 导出数据 =====（V3.8.42 P0-3 第四批：已拆为 settings/SettingsExportPanel.vue，
           连带附件统计 / 孤儿清理 / 附件包 zip / 备份提醒 / 导出四路 与 export-row、er-* 样式随迁。
           downloadFile 与 dateStr 的真源随之迁入本子域，import 子域改为 props 取同一份引用。
           判据锚：R42-15/16 附件包、R39-12 附件存储入口、R46-5 存量归属修复、R95-1 uiPrefs 并段、
           R110-B2-2 csvWsId 软删过滤、R171-3 数据体检卡挂载 —— 均走 read() 聚合层可命中） -->
      <SettingsExportPanel v-if="activePage === 'export'" ref="exportRef"
        :format-bytes="formatBytes" :ws-display-name-of="wsDisplayNameOf" />

      <!-- ===== 快捷键设置 =====（V3.8.42 P0-3 第五批：已拆为 settings/SettingsShortcutsPanel.vue，
           含「快捷键设置」与「策展台快捷键」两个 gs-panel、chrome.commands 动态拉取、
           wsMod 切台修饰键下拉与 appShortcuts（经 shortcuts.ts 派生）。
           shortcutsUrl 继续由宿主传入（extension 子域共用同一份）。
           判据锚：R49-26/R50-F8 命令表动态拉取、R69-4 键位随偏好派生、H1 策展台映射、
           H3-4 回落值与生效值一致、B7-e H3 三处同源 —— 均走 read() 聚合层可命中） -->
      <SettingsShortcutsPanel v-if="activePage === 'shortcuts'"
        :shortcuts-url="shortcutsUrl"
        :ws-display-name-of="wsDisplayNameOf" />


      <!-- ===== Airtable 同步（R63-4：单向推送，手动为主） ===== -->
      <div v-if="activePage === 'airtable'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="refresh" :size="13"/> Airtable 同步</div>
          <div class="gs-page-desc">单向：知源 › Airtable，绝不回写本地 · 缺失字段自动创建（已存在列不改名不改类型，计算列不碰）· 软删卡置「已删除」勾选不物理删 · 手动触发为主</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header">
            <span class="gs-card-title">连接配置</span>
            <span class="gs-status-badge" :class="atBadge.cls" :title="atBadge.tip"><span class="gs-status-dot"></span>{{ atBadge.label }}</span>
            <span class="gs-card-desc">PAT 明文仅存本机 chrome.storage.local，随设备不跨端</span>
          </div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">Personal Access Token</span>
              <div class="gs-sr-control gs-sr-control-wrap">
                <input class="gs-input gs-input--pat" :class="{ 'is-invalid': atFieldErr.pat }" type="password" v-model="atPat" :placeholder="atPatPlaceholder" />
                <span v-if="atFieldErr.pat" class="gs-field-err">{{ atFieldErr.pat }}</span>
                <span v-else-if="atPatSaved && !atPat" class="gs-sr-hint">已保存，替换需重填（原值不回显，避免凭据被复制）</span>
              </div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">Base ID</span>
              <div class="gs-sr-control gs-sr-control-wrap">
                <input class="gs-input gs-input--ident" :class="{ 'is-invalid': atFieldErr.base }" v-model="atBaseId" placeholder="app 开头" />
                <span v-if="atFieldErr.base" class="gs-field-err">{{ atFieldErr.base }}</span>
              </div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">Table ID</span>
              <div class="gs-sr-control gs-sr-control-wrap">
                <input class="gs-input gs-input--ident" :class="{ 'is-invalid': atFieldErr.tbl }" v-model="atTableId" placeholder="tbl 开头（表 URL 中获取）" />
                <span v-if="atFieldErr.tbl" class="gs-field-err">{{ atFieldErr.tbl }}</span>
              </div>
            </div>
            <!-- R4-Dd：标签列名可指到自己表里已有的列。★只存列名、不存列类型——
                 类型每次同步时读远端真值；存下来必然与 Airtable 漂移，而漂移的代价是把一批 422 当成成功。 -->
            <div class="gs-setting-row">
              <span class="gs-sr-label">标签列名</span>
              <div class="gs-sr-control gs-sr-control-wrap">
                <input class="gs-input gs-input--ident" v-model="atTagColumn" :placeholder="atTagColumnDefault" @change="applyTagColumn" />
                <span class="gs-sr-hint">留空即「{{ atTagColumnDefault }}」；该列若是多选（multipleSelects）会自动按数组写入，否则用分号分隔</span>
              </div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">连接测试</span>
              <div class="gs-sr-control gs-sr-control--inline">
                <button class="gs-btn" :disabled="atBusy || !atCredReady || !atBaseId || !atTableId" @click="testAtConnection">{{ atBusy ? '测试中…' : '测试连接' }}</button>
                <!-- ★V3.8.25（B1-a）：原写 `var(--ok, var(--info-green, #3A6B4C))`——两个令牌**都不存在**
                     （tokens.css 真名是 `--success`），于是四主题里一律渲染兜底的硬编码 #3A6B4C，
                     深色主题下对比度不足。改用 `--success`，跟随主题。 -->
                <span v-if="atTableName" class="gs-sr-ok"><Icon name="check" :size="13"/> 已连上「{{ atTableName }}」</span>
              </div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步范围与触发</span></div>
          <div class="gs-card-body">
            <div class="gs-setting-row">
              <span class="gs-sr-label">同步范围</span>
              <div class="gs-sr-control gs-sr-note gs-sr-note--wrap">调度台好奇心卡 · 方向台任务卡 · 资源卡池资源卡 · 各策展台镜像卡（每条镜像为独立记录，带各自所属工作台标识）· 主题卡以「是否中心论点」列体现</div>
            </div>
            <div class="gs-setting-row">
              <span class="gs-sr-label">增量游标</span>
              <div class="gs-sr-control gs-sr-note">只推上次同步后有更新的卡（updatedAt 游标）</div>
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
              <div class="gs-sr-control gs-sr-control--inline">
                <button class="gs-btn gs-btn-primary" :disabled="atBusy || !atCredReady || !atBaseId || !atTableId" @click="runAtSync">{{ atBusy ? '同步中…' : '立即同步' }}</button>
                <span v-if="quotaText" class="gs-sr-note gs-sr-note--muted">{{ quotaText }}</span>
              </div>
            </div>
            <div class="gs-setting-row" v-if="atStatusText">
              <span class="gs-sr-label">上次同步</span>
              <div class="gs-sr-control gs-sr-note">{{ atStatusText }}</div>
            </div>
            <div class="gs-setting-row" v-if="atErrorText">
              <span class="gs-sr-label">上次错误</span>
              <div class="gs-sr-control gs-sr-note gs-sr-note--danger">{{ atErrorText }}</div>
            </div>
          </div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">同步日志</span><span class="gs-card-desc">最近 {{ atLog.length }} 条（最多保留 40 条）</span></div>
          <div class="gs-card-body">
            <EmptyState v-if="!atLog.length" size="inline" icon="refresh" title="暂无同步记录" hint="配好连接后点「立即同步」，每次推送都会留一行日志" />
            <div v-for="(l, i) in atLog" :key="i" class="gs-setting-row gs-setting-row--top">
              <span class="gs-sr-label gs-sr-label--nowrap">{{ new Date(l.at).toLocaleString('zh-CN') }}</span>
              <!-- ★V3.8.25（B1-a）：原为 `l.kind === 'error' ? ' ' : l.kind === 'ok' ? ' ' : '· '`
                   —— 三支里两支返回同一个空格，是 G1 把 `⚠ / ✓ / ·` 剥成 emoji 后留下的死三元：
                   同步成功与失败两种日志在视觉上完全一样，只能靠读文字分辨。改为图标 + 只留正常行的小圆点。 -->
              <div class="gs-sr-control gs-sr-note gs-sr-note--log">
                <Icon v-if="l.kind === 'ok'" name="check" :size="12" class="gs-log-ico ok" />
                <Icon v-else-if="l.kind === 'error'" name="warn" :size="12" class="gs-log-ico err" />
                <span v-else class="gs-log-dot">·</span>
                <span>{{ l.msg }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- V3.8.42 P0-3 第二批：「使用手册」子域已搬至 settings/SettingsManualPanel.vue -->
      <SettingsManualPanel v-if="activePage === 'manual'" />

      <!-- ===== 写给用户的一封信 ===== -->
      <!-- V3.8.42 P0-3 第一批：子域已搬至 settings/SettingsLetterPanel.vue（判据锚点由 helpers 的
           设置页聚合读取层接住，214 处读设置页正文的判据因此零改动仍绿）。 -->
      <SettingsLetterPanel v-if="activePage === 'letter'" />


      <!-- V3.8.42 P0-3 第三批：「重置与回滚」子域（含回滚确认弹窗）已搬至 settings/SettingsResetPanel.vue -->
      <!-- ===== 导入数据 =====（V3.8.42 P0-3 第四批：已拆为 settings/SettingsImportPanel.vue，
           连带 import-option / io-* / file-hidden 五条专属样式随迁。判据锚：R42-16 assetPackInput、
           R110-B2-3 useBookmarkImport 握手、P0-2-1b 归一化位置、R170-3 gs-io-btn 三处按钮、
           R138-5 pendingImportEnrich 回执 —— 全部走 read() 聚合层，正文在 settings/ 下仍可命中） -->
      <SettingsImportPanel v-if="activePage === 'import'"
        :ai-ready="aiReady" :ai-enrich-ids="aiEnrichIds"
        :ws-display-name-of="wsDisplayNameOf"
        @asset-pack="onAssetPack" />
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
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'GlobalSettingsView' })
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'

import { ref, reactive, computed, watch, watchEffect, onMounted, shallowRef } from 'vue'
import { wsDisplayNameOf, wsNameById } from '@/shared/utils/wsName'
// B7-e H3：快捷键与速查面板 / 使用手册共用一份真源
import { shortcutsOf, modLabelOf } from '@/shared/utils/shortcuts'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { saveUIPrefs, loadUIPrefs, getBytesInUse, subscribeSaveError, getLastSaveError, clearLastSaveError, hasUnlimitedStorage, stripRetiredCardKeys, normalizeLegacyCards } from '@/shared/storage/repository'
import { K, EXPORT_MARKERS } from '@/shared/storage/keys'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import FieldEditor from './FieldEditor.vue'
const logoUrl = '/icons/icon128.png' // R174-2 减重：与 public/icons/icon128.png 逐字节同源，走公共路径不再重复入库
import { createDefaultData, defaultThesisFieldDefs } from '@/shared/storage/defaults'
// R63-4：Airtable 单向同步（连接测试 / 立即同步 / 配额提示）
import { testConnection, runSync, quotaHint, catPathOf, DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'
// V3.8.42 P0-3：「一封信」子域随迁（letter-data 仍留在原处，仅模板与下载函数搬出）
import { CHANGELOG, kindGroupsOf } from '../changelog-data'
// V3.8.42 P0-3：已搬出的子域组件（判据锚点由 helpers 的设置页聚合读取层接住，214 处读设置页正文的判据零改动）
import SettingsLetterPanel from './settings/SettingsLetterPanel.vue'
import SettingsManualPanel from './settings/SettingsManualPanel.vue'
import SettingsChangelogPanel from './settings/SettingsChangelogPanel.vue'
import SettingsAboutPanel from './settings/SettingsAboutPanel.vue'
import SettingsResetPanel from './settings/SettingsResetPanel.vue'
import SettingsExtensionPanel from './settings/SettingsExtensionPanel.vue'
import SettingsImportPanel from './settings/SettingsImportPanel.vue'
import SettingsExportPanel from './settings/SettingsExportPanel.vue'
import SettingsShortcutsPanel from './settings/SettingsShortcutsPanel.vue'
import RichText from '../components/RichText.vue'
import { uid, dateKey, weekStartKey } from '@/shared/utils'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { getAssetStats, cleanupOrphanAssetsOf, collectReferencedAssetIds, listOrphanAssetIds, getAllAssets, putAssets } from '@/shared/storage/assets'
import { purgeCardsCompletely, recycledCardsOf } from '@/shared/storage/purge'
import { clearHot } from '@/shared/storage/hotStats'
import { getMutationSeq } from '@/shared/storage/repository'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import { buildZip, readZip, type ZipEntry } from '@/shared/utils/zip'
import { visibleFields, allFields } from '@/shared/utils/fields'
import { sanitizeCardCols } from '@/shared/utils/cardCols'
import { sanitizeWsView } from '@/shared/utils/wsView'
import { assetSummary } from '@/shared/utils/assetKind'
import type { FieldDef, AppData, ResourceCard, TaskCard, CuriosityCard, Workspace, Category, TagNode, ID } from '@/shared/models'
// R63-1/63-2：全景两级（资源台/策展台）与导出镜像卡适配
import { isHubWs, boardCardsOf, isMirrorView, sanitizeThesisDuplicates } from '@/shared/storage/hub'
import MigrateReportCard from '../components/MigrateReportCard.vue'
/* ★W9 退役重指带备案：标签管理面板的「卡片详情」抽屉仍在本页（ttDetail），Drawer 壳的 import 不随
   仪表盘/生命周期两组抽屉一起删——本轮漏删导致模板 <Drawer> 无对应 import，被 R113-2 孤儿组件护栏抓到。 */
import Drawer from '@/shared/components/Drawer.vue'
import { CURATION_WS_ID } from '@/shared/models'
// R113-N2：资源生命周期聚合页（入口从三宿主收敛至此；内嵌式面板 + 三类卡聚合 + 跨台定位）
// V3.8.9（W9）：资源生命周期聚合页退役 —— LifecyclePanel + 宿主逻辑迁至画像洞察页 /profile §3。
// R110-LC-3/4 门禁带退役重指备案改写。
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


// ---- 导航 ----
/** R146（回退契约 ⑨）：导航项可挂路由出口——回收站是整页（列表+批量操作），设置页内不重复实现一份 */
interface NavItem { key: string; icon?: string; label: string; route?: string; mark?: boolean }
function onNavClick(item: NavItem) {
  if (item.route) { router.push(item.route); return }
  activePage.value = item.key
}
// V3.8.9（W9）：默认首屏改为「资源卡」——原「知源仪表盘」退役迁至画像洞察页（/profile），
// 「资源生命周期」面板同步迁出；R44-6 门禁带退役重指备案改写。
/** 附件包导入的**中转**：实现随「导出数据」子域搬走了（连附件统计刷新一起），
 *  而驱动它的是导入页那枚 zip input。两个子域不能互相引用（会成环），
 *  所以由宿主当一次转发点：import emit → 这里 → export 的 expose。 */
const exportRef = ref<{ handleAssetPackImport?: (e: Event) => void } | null>(null)
function onAssetPack(e: Event) { exportRef.value?.handleAssetPackImport?.(e) }

const activePage = ref('resource')
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

/**
 * S5 / V3.8.38：更新日志展示顺序——**当前版本恒在首位**，其余按数据原序（倒序）。
 * 为什么显式排而不靠数组顺序：数据文件本就倒序，「当前版本在首」目前是巧合；
 * 一旦有人把数组改成正序、或某版本尚未发 tag 就先进表，首位就不再是当前版本，
 * 「当前版本一眼可见」这条验收会静默失效。这里把展示顺序与数据顺序解耦。
 */
const orderedChangelog = (() => {
  const cur = CHANGELOG.find(e => e.version === runtimeVersion)
  if (!cur) return CHANGELOG
  return [cur, ...CHANGELOG.filter(e => e.version !== runtimeVersion)]
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

watch(() => route.query.page, () => { const p = pageFromQuery(); if (p) activePage.value = p })
const navGroups: { title: string; items: NavItem[] }[] = [
  // R54-E1（修订第卌四轮五组拍板）：总览 = 知源仪表盘 + 策展台全景并列，「整理」组取消
  // R178（原型 sns-group-title）：分组对齐设置中心原型——通用与度量 / 卡片与字段 / AI 认知协作者 / 数据与信任 / 系统信息（条目与功能零增减）
  { title: '通用与度量', items: [
    // V3.8.9（W9）：知源仪表盘（key: dashboard）与资源生命周期（key: lifecycle）退役——
    // 前者整体迁画像洞察页 /profile（概览带+复盘段+操作记录），后者迁 /profile §3。R110-LC-3/4 带退役备案改写。
    // 本组暂空；「通用与度量」语义由画像洞察页承担（/profile）。
  ]},
  { title: '卡片与字段', items: [
    { key: 'resource', icon: 'filetext', label: '资源卡' },
    { key: 'task', icon: 'checksquare', label: '任务卡' },
    { key: 'curiosity', icon: 'bulb', label: '好奇心卡' },
    // R62-3：策展主题卡字段组（isThesis 资源卡专用）
    { key: 'thesis', icon: 'landmark', label: '策展主题卡' },
    // 第卌四轮 Q-6：标签管理上移——它服务卡片呈现，与三卡同组
    { key: 'tags', icon: 'tag', label: '标签管理' },
  ]},
  // R178：AI 认知协作者独立成组（原型分组口径）
  { title: 'AI 认知协作者', items: [
    // R134-F：AI 助手（接入配置 + 沉睡唤醒 + 一键诊断）· R146/R152：入口徽标统一（真源 AiMark.vue）
    { key: 'ai', mark: true, label: 'AI 助手' },
  ]},
  { title: '数据与信任', items: [
    { key: 'import', icon: 'download', label: '导入数据' },
    { key: 'export', icon: 'upload', label: '导出数据' },
    // R146-⑨：删除有两条路（回收站可反悔 / 永久删除不可逆），入口必须常驻左栏而不是埋在危险区里
    { key: 'recycle', icon: 'trash', label: '回收站', route: '/recycle' },
    { key: 'reset', icon: 'rotateccw', label: '重置与回滚' },
  ]},
  { title: '系统信息', items: [
    { key: 'extension', icon: 'settings', label: '扩展设置' },
    { key: 'shortcuts', icon: 'zap', label: '快捷键设置' },
    // R178：Airtable 归入「数据与信任」语义组（原型口径；同键不动，仅分组位置）
    { key: 'airtable', icon: 'refresh', label: 'Airtable 同步' },
    { key: 'manual', icon: 'book', label: '使用手册' },
    { key: 'letter', icon: 'mail', label: '一封信' },
    // W5（V3.8.5）：产品更新日志——时间线看版本演变
    { key: 'changelog', icon: 'clipboard', label: '产品更新日志' },
    { key: 'about', icon: 'question', label: '关于' },
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
// V3.8.9（W9）：资源生命周期聚合页退役 —— LifecyclePanel + 宿主逻辑（lcCards/onLcArchive/
// onLcSnooze/onLcReactivate/onLcSetDays/阈值弹窗）整体迁至画像洞察页 /profile §3。
// R110-LC-3/4 门禁带退役重指备案改写。
// ============================================================

// ============================================================
// V3.8.9（W9）：知源仪表盘退役 —— 概览带/复盘段/操作记录/全量抽屉/两个下钻抽屉/错误日志
// 整体迁至画像洞察页 /profile。R44/R46/R48/R51/R172-T6 系列门禁带退役重指备案改写。
// 保留：gWsName/gCatName（导出页复用）、readErrorLog 相关（关于页/导出页仍用）。
// ============================================================
import { useBookmarkImport } from '@/newtab/composables/useBookmarkImport'
// V3.8.9（W9）：readEventLog/readErrorLog/subscribeErrorLog/curioCumulativeSince/countCurioCumulative/
// EVENT_LOG_CAP/CardEvent 随仪表盘退役迁至 ProfileInsights.vue（错误日志徽标+导出也迁走）。
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
// R156：主题「跟随系统」——导入界面偏好包时 ui.theme 可为 'auto'，落 data-theme 前统一解析
import { resolveTheme } from '@/shared/utils/theme'
import { recordResourceOpen } from '../stores/compass'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'

const gd = computed(() => store.data!)

// V3.8.9（W9）：仪表盘专属脚本已整体迁至 ProfileInsights.vue（概览带数据桥/复盘段依赖/
// 操作记录/四类入口/全量抽屉/核心指标下钻/动态条下钻/错误日志徽标/dzHl 高亮）。
// 本文件保留的通用能力：gWsName/gCatName（导出页）、readErrorLog（关于页）、
// useBookmarkImport（导入页）、recordResourceOpen / toOpenableUrl / openHtmlAsset（卡片预览）。

// V3.8.9（W9）：仪表盘脚本（gFlat/todayAdd/weekAdd/事件日志/timelineEvents/dash 数据桥/
// 复盘段依赖/报告出口/openLog/核心指标下钻/动态条下钻/错误日志徽标）已整体迁 ProfileInsights.vue。
// 保留：gWsName/gCatName（导出页 L1870 复用）。
function gWsName(id: string): string { return wsNameById(gd.value.workspaces, id) || '' }
function gCatName(id: string): string { return gd.value.categories.find(c => c.id === id)?.name || '' }

// ---- 资源卡实时预览（对齐原型） ----
const previewMode = ref<'card' | 'list' | 'kanban'>('card')
const previewModes = [
  { key: 'card' as const, label: '卡片' },
  { key: 'list' as const, label: '列表' },
  { key: 'kanban' as const, label: '看板' }
]
const previewModeLabel = computed(() => previewModes.find(m => m.key === previewMode.value)?.label || '')

/**
 * 字段管理 › 实时预览的骨架 HTML。
 *
 * ★V3.8.25（B1-a）：这一段里的样式**必须靠 `:deep()` 才生效**。
 *   本组件的样式块是 scoped 的，编译后选择器是 `.gs-pv-field[data-v-xxxx]`；而这里的 HTML 走
 *   `v-html` 注入，注入节点没有 `data-v-xxxx` 属性 ⇒ 原来的 8 条 `.gs-pv-*` 规则**一条都没命中**，
 *   预览卡实际只吃了那几个内联 style，标签是一串纯文字而不是胶囊。
 *   故：① 8 条规则改成 `.gs-preview-card :deep(.gs-pv-*)`（宿主 `.gs-preview-card` 带 scope id，
 *   `:deep()` 放行其内部）；② 原先散在字符串里的内联 style 一并收成 `.gs-pv-*` 类。
 *   边界：v-html 里的内容不许再写内联 style —— 写在这里的类是有规则的，写内联是绕过令牌的。
 *   注意：注释里不要出现 style 标签的字面量写法。`scripts/dead-css-scan.cjs` 用一条非贪婪正则抽样式块，
 *   脚本区里只要出现一句"样式标签"注释，就会被它当成真样式块的起点，于是整段 TS 被当 CSS 解析
 *   （本轮实测：规则数从 3721 涨到 4051，报出 16 条假的"祖先断"）。
 */
const resourcePreviewHtml = computed(() => {
  const visible = [...fields.value.resource].sort((a, b) => a.order - b.order).filter(f => f.visible)
  const has = (key: string) => visible.some(f => f.key === key)

  if (previewMode.value === 'card') {
    let html = ''
    if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title">知源调度台V2.12全产品PRD手册</div>'
    if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link"> D:\\zhiyuan-V2.12\\PRD手册.docx</span></div>'
    if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-field-text gs-pv-desc">完整记录V2.12版本的功能设计、交互规范和数据模型...</span></div>'
    if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">来源:</span><span class="gs-pv-field-text">学术</span></div>'
    if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span><span class="gs-pv-tag">#产品设计</span></span></div>'
    if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-field-label">添加:</span><span class="gs-pv-field-text">2026-08-28</span></div>'
    return html
  }
  if (previewMode.value === 'list') {
    let html = '<div class="gs-pv-list">'
    if (has('title')) html += '<span class="gs-pv-name">知源调度台V2.12全产品PRD手册</span>'
    if (has('link')) html += '<span class="gs-pv-field-link"></span>'
    if (has('description')) html += '<span class="gs-pv-meta">PRD手册...</span>'
    if (has('sourceType')) html += '<span class="gs-pv-meta">学术</span>'
    if (has('tags')) html += '<span class="gs-pv-tag">#PRD</span>'
    if (has('createdAt')) html += '<span class="gs-pv-meta">08-28</span>'
    html += '</div>'
    return html
  }
  // kanban
  let html = ''
  if (has('title')) html += '<div class="gs-pv-field gs-pv-field-title gs-pv-field-title--sm">知源调度台V2.12全产品PRD手册</div>'
  if (has('tags')) html += '<div class="gs-pv-field"><span class="gs-pv-field-tags"><span class="gs-pv-tag">#PRD</span></span></div>'
  if (has('link')) html += '<div class="gs-pv-field"><span class="gs-pv-field-link gs-pv-field-link--sm"> PRD手册.docx</span></div>'
  if (has('description')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">功能设计、交互规范...</span></div>'
  if (has('sourceType')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">学术</span></div>'
  if (has('createdAt')) html += '<div class="gs-pv-field"><span class="gs-pv-meta">08-28</span></div>'
  return html
})


/** 解析 Netscape 书签 HTML（浏览器导出格式） */
/** R47-A2：全量并集合并——罗盘（愿景/使命/方向→项目→指标）+ 引擎数据 + 全部关系字段
 *  原则：卡片/指标按 id 去重合并；「关系列表」（taskIds/linkedResourceIds 等）一律取并集；
 *        计数类（stats.wrr）取最大值；标量以导入方覆盖（无 updatedAt 的层级按导入值合并）。 */






// ---- Airtable 同步（R63-4） ----
const atBusy = ref(false)
const atTableName = ref('')
const atPat = ref('')
const atBaseId = ref('')
const atTableId = ref('')
const atTagColumn = ref('')
const atTagColumnDefault = DEFAULT_TAG_COLUMN
/* ★标签列名是改完即写的，与 PAT/Base/Table 三条不同：那三条是半成品凭据，存一半会污染连接测试；
   列名不存在「半截」这件事，且同步只在点「立即同步」时发生，失焦即写是唯一不丢改动的做法。 */
let atTagTouched = false
function applyTagColumn() {
  const st = store.data?.airtableSync
  atTagTouched = true
  if (!st) return
  st.tagColumn = atTagColumn.value.trim()
  store.persist()
}
// 配置回填（不在模板直接 v-model 到 storage——「改完即写」会把半截 PAT 存库；失焦/操作时统一写回）
/* ★S3（V3.8.29）：PAT 不再回填进输入框。原先那段回填把存储里的明文塞回 DOM，
   `type=password` 只是把它画成圆点——value 仍是明文，选中即可复制，开发者工具里也直接可见。
   规范要求「不显示密钥明文 + 已保存替换需重填」，因此改为：storage 里有凭据时只置 atPatSaved，
   输入框留空并以提示说明「已保存，替换请重填」；syncAtConfig 遇空不回写，避免把旧密钥清掉。 */
const atPatSaved = ref(false)
watchEffect(() => {
  const s = store.data?.airtableSync
  if (!s) return
  if (s.pat) atPatSaved.value = true
  if (!atBaseId.value) atBaseId.value = s.baseId
  if (!atTableId.value) atTableId.value = s.tableId
  if (s.tableName && !atTableName.value) atTableName.value = s.tableName
  /* ★只在用户没碰过这一栏时回填。加了「改完即写」之后这条必须带 touched 门，否则：
     用户把列名清空的那一刻，watchEffect 看见空值就把 storage 里的旧列名灌回输入框，
     清空这个动作被静默撤销（E2E-34 首轮就是这么抓到的）。 */
  if (!atTagTouched && s.tagColumn) atTagColumn.value = s.tagColumn
})
function syncAtConfig() {
  const s = store.data!.airtableSync!
  // 空 = 用户没填新密钥（沿用已保存的），不是「要清空」
  const typedPat = atPat.value.trim()
  if (typedPat) s.pat = typedPat
  s.baseId = atBaseId.value.trim()
  s.tableId = atTableId.value.trim()
  store.persist()
}
/** 连接凭据是否可用：已存过 PAT，或本次填了新的 */
const atCredReady = computed(() => !!atPat.value.trim() || atPatSaved.value)
const atPatPlaceholder = computed(() => atPatSaved.value
  ? '已保存（不回显）· 替换请直接重填'
  : 'pat…（需 data.records 读写 + schema.bases 写权限）')
/** 字段级内联校验：只在「填了东西但格式不对」时报，未填交给三态徽章说「未连接」 */
const atFieldErr = computed<Record<string, string>>(() => {
  const e: Record<string, string> = {}
  const pat = atPat.value.trim(), base = atBaseId.value.trim(), tbl = atTableId.value.trim()
  if (pat && !pat.startsWith('pat')) e.pat = 'PAT 以 pat 开头——请从 Airtable 账户页「创建令牌」后整段复制'
  if (base && !base.startsWith('app')) e.base = 'Base ID 以 app 开头——在表 URL 的 /appXXXX/ 段里'
  if (tbl && !tbl.startsWith('tbl')) e.tbl = 'Table ID 以 tbl 开头——在表 URL 的 /tblXXXX/ 段里'
  return e
})
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
  return parts.join('· ')
})
const atErrorText = computed(() => atState.value.lastError || '')
/* ★S3（V3.8.29）：三态徽章。优先级 异常 > 已连接 > 未连接 —— 一次推送失败比"上次连通过"更该先说。
   绿只给"已连接"、琥珀只给"推送异常"，这两个是状态而非评价（同 B3 的镜子口径）。 */
const atBadge = computed(() => {
  if (atErrorText.value) return { cls: 'error', label: '推送异常', tip: atErrorText.value }
  if (atTableName.value) return { cls: 'connected', label: '已连接', tip: `已连上「${atTableName.value}」` }
  return { cls: 'idle', label: '未连接', tip: '填好 PAT / Base ID / Table ID 后点「测试连接」' }
})

async function testAtConnection() {
  if (atBusy.value) return
  atBusy.value = true
  try {
    syncAtConfig()
    const name = await testConnection(atState.value)
    atTableName.value = name
    atState.value.tableName = name
    store.persist()
    showToast('连接成功：' + name)
  } catch (e) {
    showToast('' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

async function runAtSync() {
  if (atBusy.value) return
  if (!atCredReady.value || !atBaseId.value.trim() || !atTableId.value.trim()) { showToast('请先填写完整连接配置'); return }
  atBusy.value = true
  try {
    syncAtConfig()
    const r = await runSync(store.data!)
    store.persist()
    showToast(`同步完成：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atBusy.value = false }
}

function toggleAtPoll() {
  const s = atState.value
  s.pollEnabled = !s.pollEnabled
  store.persist()
  // 轮询注册由 background 监听 storage 变化自管（63-10）
  showToast(s.pollEnabled ? '已开启 3 小时自动轮询' : '已关闭自动轮询')
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
  return q ? out.filter(x => (x.title + '' + x.sub + '' + (x.link || '')).toLowerCase().includes(q)) : out
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
  showToast(`已添加专家「${name}」`)
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
  if (!jb) { showToast('全库卡还太少（三类合计不足 6 张），整体梳理等有库了再来'); return }
  aiJob.value = jb
}
function aiJobClosed() {
  if (consumeTagBlueprintAdopted()) {
    aiReviseBak.value = { at: Date.now() }
    const aj = buildTagAssignJob({ d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist() })
    if (aj) { aiJob.value = aj; showToast('蓝图已落地，接着全卡归架打标'); return }
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
  try { aiModels.value = await listModels(); aiMsg.value = `拉到 ${aiModels.value.length} 个模型，可直接选用` }
  catch (e) { aiModels.value = []; aiMsg.value = `列表拉取失败：${aiErr(e)}（模型名可手填）` }
  aiBusy.value = ''
}
async function aiTestConn() {
  aiBusy.value = 'test'; aiMsg.value = ''
  try { aiMsg.value = `连接成功：${await aiTestConnection()}` }
  catch (e) { aiMsg.value = `${aiErr(e)}` }
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
        if (addTags.length) parts.push(`标签 +${addTags.join('、')}${fresh.length ? `（其中 ${fresh.join('、')} 是体系外新词）`: ''}`)
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
      return `已补全 ${n} 张卡`
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
          description: ['诊断发现：', f.detail, f.suggestion && `➜ 建议：${f.suggestion}`].filter(Boolean).join('\n').slice(0, 600),
          customFields: {},
          createdAt: Date.now(), updatedAt: Date.now(),
        } as import('@/shared/models').TaskCard)
        n++
      }
      if (n) store.persist()
      return `已生成 ${n} 张诊断跟进任务（在任务面板未归类区，可再挂链）`
    },
    async run({ signal, onDelta }) {
      let progress = ''
      const rows: AiRow[] = []
      for (const p of sel) {
        if (signal.aborted) break
        progress += `${p.icon} ${p.name} 分析中…\n`
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
        progress = progress.replace(`${p.icon} ${p.name} 分析中…\n`, `${p.icon} ${p.name}：${found.length} 条发现\n`)
        onDelta(progress)
      }
      if (!rows.length) throw new Error('各位专家都没有给出可成立的发现（数据太稀疏或模型过于保守，可换深度档重试）')
      return rows
    },
  }, { d, persist: () => store.persist() },
    () => `深度诊断 ${new Date().toLocaleDateString('zh-CN')}`,
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
  else showToast('该卡片无可打开链接')
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
    showToast(synced ? `已重命名并同步 ${synced} 张卡片` : '已重命名（该标签当前无卡片挂载）')
  } else if (ed.parentId) {
    const parent = findTagNode(ed.parentId)
    if (!parent) return
    parent.node.children = parent.node.children || []
    const nid = uid('tag')
    parent.node.children.push({ id: nid, name })
    store.persist()
    ttCollapsed.value = new Set([...ttCollapsed.value].filter(x => x !== parent.node.id))
    ttFlash(nid)
    showToast(`已在 #${parent.node.name} 下创建 #${name}`)
  } else {
    const nid = uid('tag')
    store.data!.tagTree.push({ id: nid, name })
    store.persist()
    ttFlash(nid)
    showToast(`已创建 #${name}`)
  }
}
function ttCancel() { ttEditing.value = null }
async function ttRemove(id: string) {
  const hit = findTagNode(id)
  if (!hit) return
  const ids = tagSubtreeIds(id)
  const names = tagFlat().filter(t => ids.includes(t.id)).map(t => '#' + t.name)
  const subCount = ids.length - 1
  if (!(await useConfirm({ title: '删除标签', message: `确定删除 ${names.join(' ')} ？${subCount > 0 ? `\n（含 ${subCount} 个子标签）`: ''}\n卡片上的对应标签会一并移除。`, confirmText: '确认删除' }))) return
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
  showToast(`已删除 ${names.join(' ')}${subCount > 0 ? `（含 ${subCount} 个子标签）`: ''}`)
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
  showToast(`「${from.node.name}」已成为「${to.node.name}」的子标签（卡片同步为 #${newPath}）`)
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


// ---- 使用手册（第二十轮：数据外置 manual-data.ts，五篇结构） ----
const activeManualSec = ref('quick-1')

</script>

<!-- V3.8.42：跨子域共享基类（.gs-card/.gs-btn/.gs-setting-row…）已外提为 settings/base.css。
     必须非 scoped —— Vue 的 scoped 命中不了子组件内部元素，外提前四个已拆子域的卡片外壳全部失效。 -->
<style src="./settings/base.css"></style>

<style scoped>
.gs-page { display: flex; width: min(1440px, 100%); margin: 0 auto; padding: 24px 36px 64px; gap: 24px; }

/* 返回按钮 */
.gs-back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: var(--fs-body); color: var(--text-2); cursor: pointer; transition: all var(--dur); margin-bottom: 16px; text-decoration: none; width: fit-content; }
.gs-back-btn:hover { background: var(--surface-3); color: var(--text); }

/* 左侧导航 */
/* R178（原型 settings-nav-sidebar）：浮动卡片轨（radius-lg + 卡影 + sticky 66px），边线分栏退役 */
.gs-nav { width: 214px; flex-shrink: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 11px; background: var(--surface); box-shadow: var(--shadow-sm); position: sticky; top: 66px; max-height: calc(100vh - 90px); overflow-y: auto; align-self: flex-start; display: flex; flex-direction: column; gap: 3px; }
/* R178（原型 sns-group-title）：组标题 11px/700 三级字
   ★V3.8.30：字距改走 --tracking-sm（同值 0.04em 的令牌，不再写字面量）——
   与卡片分区名共用同一套「小字号 + 正字距 + 700」标签排印，两处只差颜色（导航侧 text-3，分区名 text）。 */
.gs-nav-group { margin-bottom: 10px; }
.gs-nav-group:last-child { margin-bottom: 0; }
.gs-nav-group-title { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); padding: 8px 8px 4px; letter-spacing: var(--tracking-sm); }
/* R178（原型 sns-nav-item）：12.5px 档 + hover 浅底 + active accent-light
   ★S1（V3.8.29）：当前态补「accent 左侧 2px 竖条」——原来只有填充底，与 hover 的浅底
   属于同一种「整块变色」，一眼分不出「我在这里」还是「鼠标在这里」。竖条是形状信号，
   不依赖色相差异，因此四主题下都成立（含对底色不敏感的高对比场景）。
   注：规范写"accent-soft 底"，tokens 里的实际令牌名是 --accent-light（同义），沿用不新造。
   原 2429/2430 两行完全重复的 hover 规则一并删去一条。 */
.gs-nav-item { position: relative; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius-sm); font-size: var(--fs-sub); font-weight: 500; color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); margin-bottom: 0; }
.gs-nav-item:hover { background: var(--surface-3); color: var(--text); }
.gs-nav-item.active { background: var(--accent-light); color: var(--accent-ink); font-weight: 600; }
.gs-nav-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 2px; height: 14px; border-radius: 0 2px 2px 0; background: var(--accent); }
.gs-nav-icon { font-size: 14px; width: 18px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }

/* 右侧内容 */
.gs-content { flex: 1; min-width: 0; padding: 0; overflow: visible; } /* V3.9.13：与调度台/方向台共用 1440px + 36px 页轴；具体阅读行宽由各内容块自控 */






/* 字段管理 */

.gs-field-add { margin-top: 10px; padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 8px; text-align: center; cursor: pointer; font-size: var(--fs-body); color: var(--text-3); transition: all var(--dur); }
.gs-field-add:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
/* 两个并列的虚线按钮（新建根标签 / 从卡片收纳）：原先第二个写内联 margin-left:8px */
.gs-field-add + .gs-field-add { margin-left: 8px; }
.gs-field-hint { margin-top: 12px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; font-size: var(--fs-sub); color: var(--accent-ink); line-height: 1.7; }

/* ★V3.8.25（B1-a）：手册页的"已升级为独立阅读页"空态。
   原先是一串内联 flex + 三处 font-size，其中大图标因为 Icon 用 width/height 定尺寸而一直是 13px。
   注意本段必须排在 `.gs-card-body` 之后，否则同为单类选择器时 padding 抢不过 16px 18px。 */

/* 预览 */
.gs-preview-section { margin-top: 16px; }
.gs-preview-title { font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tracking-sm); color: var(--text-3); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.gs-preview-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.gs-preview-tab { padding: 4px 11px; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); transition: all var(--dur); }
.gs-preview-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.gs-preview-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 14px; min-height: 80px; }
/* ★V3.8.25（B1-a）：以下 8 条原本是裸 `.gs-pv-*`，配合 `v-html` 注入的节点**从未生效**
   （注入节点没有 scope id，`.gs-pv-field[data-v-xxxx]` 匹配不到）。宿主 `.gs-preview-card`
   带 scope id，用 `:deep()` 放行其内部，规则才真正命中。新增的 `--sm` / `--meta` / `--desc` /
   `--list` / `--name` 是原来写在字符串内联 style 里的那几条，收进来一并生效。 */
.gs-preview-card :deep(.gs-pv-field) { margin-bottom: 6px; font-size: var(--fs-sub); }
.gs-preview-card :deep(.gs-pv-field:last-child) { margin-bottom: 0; }
.gs-preview-card :deep(.gs-pv-field-title) { font-weight: 600; color: var(--text); font-size: var(--fs-body); }
.gs-preview-card :deep(.gs-pv-field-title--sm) { font-size: var(--fs-sub); }
.gs-preview-card :deep(.gs-pv-field-label) { color: var(--text-3); font-size: var(--fs-tiny); margin-right: 4px; }
.gs-preview-card :deep(.gs-pv-field-text) { color: var(--text-2); }
.gs-preview-card :deep(.gs-pv-field-tags) { display: inline-flex; gap: 4px; }
.gs-preview-card :deep(.gs-pv-tag) { font-size: var(--fs-micro); padding: 1px 6px; border-radius: 99px; background: var(--accent-light); color: var(--accent-ink); }
.gs-preview-card :deep(.gs-pv-field-link) { font-size: var(--fs-caption); color: var(--accent); }
.gs-preview-card :deep(.gs-pv-field-link--sm) { font-size: var(--fs-tiny); }
.gs-preview-card :deep(.gs-pv-desc) { color: var(--text-3); font-size: var(--fs-caption); }
.gs-preview-card :deep(.gs-pv-list) { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gs-preview-card :deep(.gs-pv-name) { font-weight: 600; font-size: var(--fs-sub); }
.gs-preview-card :deep(.gs-pv-meta) { font-size: var(--fs-tiny); color: var(--text-3); }

/* 导入导出 */

/* 第卅六轮 REQ-038：开关 + 容量/异常行 */






/* 信件页底部"下载这封信"按钮的居中容器（原先写内联 text-align + margin-top） */
.gs-letter-actions { text-align: center; margin-top: 14px; }

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
/* V3.9.7：指标抽屉及其搜索、翻页、对账样式已迁入
   PiMetricDetailDrawer.vue；宿主只保留数据与动作，禁止在这里恢复旧规则。 */


/* ===== R4-Da（旧世界清账）：🗺 全景整页退役后，原同一段样式里仍被存活页面消费的规则补回。
   ★这一段不是"把全景样式留着"——它守的是两类连带损失：标签管理双栏与右列卡片（tt-*）、
   标签详情抽屉（gs-pd-*）。全景自己的双栏树样式（左树/ws 行/
   分类行/计数徽标/批量条/卡片日期）一律没补，退役类名按 R44-10/11 判据零命中。
   右列卡片原借全景的 gs-pan-* 类名，本轮改成标签管理本地 tt-*：类名跟着居所走，
   下一个读代码的人不会以为它属于已删的那一页。
   ★W9 退役重指带备案：第三类「生命周期阈值弹窗（lc-set-*）」随 LifecyclePanel 整块迁
   ProfileInsights（新页自带同名样式），本页那四条规则已成孤儿，一并删除。 ===== */
/* R127：标签管理双栏（左树 + 右列卡片） */
.tt-wrap { display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start; }
.gs-tt-row.active { border-color: var(--accent); background: var(--accent-light); }
/* R130-T3：拖拽落点高亮（比 active 多一圈实心内环）+ 被拖卡片行降透明度 */
.gs-tt-row.drop { border-color: var(--accent); background: var(--accent-light); box-shadow: inset 0 0 0 1.5px var(--accent); }
.tt-card.dragging { opacity: .45; }
.tt-tools { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tt-picked { font-size: var(--fs-caption); color: var(--accent); white-space: nowrap; }
.tt-list { display: flex; flex-direction: column; gap: 6px; max-height: 560px; overflow-y: auto; }
.tt-allcheck { display: flex; align-items: center; gap: 5px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; }
.tt-card { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); cursor: pointer; transition: all var(--dur-fast); }
.tt-card:hover { border-color: var(--accent); background: var(--accent-light); }
.tt-card.selected { border-color: var(--accent); background: var(--accent-light); }
.tt-check { flex-shrink: 0; cursor: pointer; }
.tt-card-main { flex: 1; min-width: 0; }
.tt-card-title { font-size: var(--fs-body); font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tt-card-sub { font-size: var(--fs-caption); color: var(--text-4); margin-top: 1px; }
/* 标签详情抽屉字段行 */
.gs-pd-title { font-size: var(--fs-title); font-weight: 600; color: var(--text); line-height: 1.5; margin-bottom: 12px; }
.gs-pd-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.gs-pd-k { width: 40px; flex-shrink: 0; color: var(--text-4); }
.gs-pd-v { flex: 1; min-width: 0; color: var(--text-2); word-break: break-all; line-height: 1.6; }
.gs-pd-actions { display: flex; gap: 8px; margin-top: 14px; }
@media (max-width: 1100px) { .tt-wrap { grid-template-columns: 1fr; } }
@media (max-width: 900px) {
  .gs-page { flex-direction: column; padding: 18px 18px 56px; gap: 16px; }
  .gs-nav { position: static; width: 100%; max-height: none; }
  .gs-content { width: 100%; }
}

/* ===== R134-F · AI 助手页 ===== */

.ai-form { display: flex; flex-direction: column; gap: 10px; }
.ai-field { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sub); color: var(--text-3); }
.ai-field.inline { flex-direction: row; align-items: center; gap: 8px; font-size: var(--fs-sub); color: var(--text-2); }
.ai-field .gs-input { width: 100%; }
.ai-form-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
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
/* ★V3.8.25（B1-a）：`.ai-btn-mini` 是 20×20 的方图标钮；"恢复内置默认"要带文字，
   故放开宽度、改内边距（原先写内联 width/padding）。 */
.ai-btn-mini--text { width: auto; padding: 2px 8px; }
</style>
