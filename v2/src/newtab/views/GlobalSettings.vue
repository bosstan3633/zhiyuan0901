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
          <AiEntryButton v-if="item.mark" class="gs-nav-icon" /><Icon v-else-if="item.icon" class="gs-nav-icon" :name="item.icon" :size="14" />{{ item.label }}
        </div>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <main class="gs-content">
      <!-- 返回按钮 -->
      <div class="gs-back-btn" @click="router.push('/compass')">← 返回</div>

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
            <div v-for="m in previewModes" :key="m.key" class="gs-preview-tab" :class="{ active: previewMode === m.key }" @click="previewMode = m.key">{{ m.label }}</div>
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
                      <span class="gs-tt-act" title="重命名" @click="ttRename(root.id)"><Icon name="edit" :size="13"/></span>
                      <span class="gs-tt-act del" title="删除" @click="ttRemove(root.id)"><Icon name="trash" :size="13"/></span>
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
                  <div v-for="child in safeChildren(root)" :key="child.id" class="gs-tt-row subrow" :class="{editing: ttEditing?.id === child.id, flash: ttFlashId === child.id, active: ttActiveTag === root.name + '/' + child.name, drop: ttDropTarget === child.id}" :data-depth="tagDepth(child.id)" :style="{ paddingLeft: 8 + tagDepth(child.id) * 18 + 'px' }" draggable="true"
                    @dragstart="ttDragStart($event, child.id)" @dragend="ttDragEnd"
                    @dragover.prevent="ttDropTarget = child.id" @dragleave="ttDropTarget === child.id && (ttDropTarget = '')" @drop.prevent="ttDrop($event, child.id)" @click="selectTtTag(root.name + '/' + child.name)" @dblclick="ttRename(child.id)">
                    <input v-if="ttEditing?.id === child.id" v-model="ttEditing.value" class="gs-tt-input" v-focus
                      @keydown.enter.prevent="ttConfirm" @keydown.esc="ttCancel" @blur="ttConfirm">
                    <template v-else>
                      <span class="gs-tt-name sub">#{{ child.name || '未命名标签' }}</span>
                                            <span class="gs-tt-count">{{ tagUsage(root.name + '/' + child.name) }} 卡</span>
                      <span class="gs-tt-actions">
                                                <span class="gs-tt-act" title="提升为根标签" @click="ttUnnest(root.id, child.id)"><Icon name="upload" :size="13"/></span>
                        <span class="gs-tt-act" title="重命名" @click="ttRename(child.id)"><Icon name="edit" :size="13"/></span>
                        <span class="gs-tt-act del" title="删除" @click="ttRemove(child.id)"><Icon name="trash" :size="13"/></span>
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
                  <div v-for="row in ttRows" :key="row.id" class="tt-card" :class="{ selected: ttPicked.has(row.id), dragging: ttCardDragging && ttPicked.has(row.id) }" draggable="true"
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

      <!-- ===== 导入数据 ===== -->
      <div v-if="activePage === 'import'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="download" :size="13"/> 导入数据</div>
          <div class="gs-page-desc">从外部导入资源卡或策展台数据，导入时与现有数据取并集</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">导入方式</span></div>
          <div class="gs-card-body">
            <div class="gs-import-option" @click="triggerFileImport">
              <div class="gs-io-icon"><Icon name="package" :size="13"/></div>
              <div><div class="gs-io-name">导入知源调度台数据</div><div class="gs-io-desc">选择 JSON 文件，与现有数据取并集（同 ID 更新，不同 ID 新增）；全量包附带界面偏好（主题/密度）时自动应用。<b>导入前会先自动下载一份当前数据备份</b>（防误合并，不含 Airtable 凭证）</div></div>
              <button class="gs-btn gs-btn-primary gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="assetPackInput?.click()">
              <div class="gs-io-icon"><Icon name="folder" :size="13"/></div>
              <div><div class="gs-io-name">导入附件包</div><div class="gs-io-desc">选择「导出附件包」生成的 zip，附件本体按 assetId 写回（同 ID 覆盖）；先导 JSON 再导附件包 = 完整迁移</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <div class="gs-import-option" @click="bookmarkImport()">
              <div class="gs-io-icon"><Icon name="bookmark" :size="13"/></div>
              <div><div class="gs-io-name">导入书签文件</div><div class="gs-io-desc">选择浏览器导出的书签 HTML：<b>本页只把文件夹层级写成标签</b>，链接 + 标题进资源卡；文件夹›分类的建树导入已随资源台退役。</div></div>
              <button class="gs-btn gs-io-btn">选择文件</button>
            </div>
            <!-- R154（E3）：导入完不再自动弹评审抽屉——它抢焦点、也没人点过它。改成回执上的显式入口 -->
            <div v-if="pendingImportEnrich && pendingImportEnrich.length" class="gs-setting-row gs-setting-row--gap">
              <span class="gs-sr-label">刚导入 {{ pendingImportEnrich.length }} 张卡</span>
              <div class="gs-sr-control">
                <button class="gs-btn" :disabled="!aiReady" @click="aiImportEnrichNow">{{ aiReady ? '归类并补全这批' : '先在 AI 助手完成接入' }}</button>
                <button class="gs-btn" @click="pendingImportEnrich = null">这次不用</button>
              </div>
            </div>
            <div class="gs-setting-row gs-setting-row--gap">
              <span class="gs-sr-label">书签导入到</span>
              <div class="gs-sr-control">
                <select class="gs-select" v-model="bookmarkTargetWs">
                  <option value="__new__">新建「书签导入 &lt;今天日期&gt;」策展台</option>
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <input ref="fileInput" type="file" accept=".json" class="gs-file-hidden" @change="handleFileImport" />
        <input ref="assetPackInput" type="file" accept=".zip" class="gs-file-hidden" @change="handleAssetPackImport" />
        <input ref="bookmarkInput" type="file" accept=".html,.htm" class="gs-file-hidden" @change="onBookmarkFile" />
      </div>

      <!-- ===== 导出数据 ===== -->
      <div v-if="activePage === 'export'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="upload" :size="13"/> 导出数据</div>
          <div class="gs-page-desc">导出数据用于备份或跨设备迁移（全量 JSON + 附件包两步才算完整迁移）</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">备份提醒</span></div>
          <div class="gs-card-body">
            <!-- V2.20.1 BUG-2：存量归属修复记录（静默回填，仅修复时显示） -->
            <div v-if="gd.projBackfillFixed" class="gs-export-row">
              <div class="gs-er-info">
                <div class="gs-er-name"><Icon name="wrench" :size="13"/> 存量归属修复（V2.20.1）</div>
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
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="paperclip" :size="12"/> 附件存储</span><span class="gs-card-desc">图片/HTML 本体在 IndexedDB，不占主数据</span></div>
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
          <div class="gs-page-title">快捷键设置</div>
          <div class="gs-page-desc"><Icon name="bulb" :size="13"/> 系统级快捷键（含完整方向树/快速采集任务/同步到 Airtable 等六条无默认键命令）请在浏览器地址栏打开 chrome://extensions/shortcuts 自定义（高效使用知源的第一步）；应用内快捷键开箱即用</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-header"><span class="gs-card-title">全局快捷键（任意网页可用）</span><span class="gs-card-desc">由 Chrome 统一管理 · 下表是本扩展的全部命令，键位显示「未设置」的几条没有默认键，需到 chrome://extensions/shortcuts 手动分配</span></div>
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
          <div class="gs-page-title"><Icon name="sliders" :size="13"/> 策展台快捷键</div>
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

      <!-- ===== 使用手册（第廿一轮：独立页入口） ===== -->
      <div v-if="activePage === 'manual'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="book" :size="13"/> 产品使用手册</div>
          <div class="gs-page-desc">速览 / 基础 / 方法 / 理念 / 附录 —— 五篇图文教程，独立页面阅读体验最佳</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body gs-empty">
            <!-- ★V3.8.25（B1-a）：原来外层 div 写死 font-size:34px、内层 Icon 却是 :size="13"——
                 Icon 用 width/height 定尺寸，外层 font-size 对它无效，所以这颗"大图标"一直是 13px，
                 比旁边的正文还小。改成直接给 :size="34"，外层只留排版的 flex 项。 -->
            <div class="gs-empty-ico"><Icon name="book" :size="34"/></div>
            <div class="gs-empty-title">使用手册已升级为独立阅读页</div>
            <div class="gs-empty-desc">五篇结构：速览一页上手 › 基础篇 › 方法篇（认知增强方法论）› 理念篇（知源哲学与理论根基）› 附录（快捷键全表与数据安全）。点击下方按钮在新标签页打开，支持左侧目录锚点定位。</div>
            <button class="gs-manual-open" @click="openManualTab"><Icon name="book" :size="13"/> 打开使用手册（新标签页）</button>
          </div>
        </div>
      </div>

      <!-- ===== 写给用户的一封信 ===== -->
      <div v-if="activePage === 'letter'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="mail" :size="13"/> 写给用户的一封信</div>
          <div class="gs-page-desc">donge 哥 · 致每一位知源调度台的同行者</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body gs-letter" v-html="LETTER_HTML"></div>
        </div>
        <div class="gs-letter-actions">
          <button class="gs-manual-open" @click="downloadLetter"><Icon name="download" :size="13"/> 下载这封信（分享 HTML）</button>
        </div>
      </div>

      <!-- ===== 重置与回滚 ===== -->
      <div v-if="activePage === 'reset'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="refresh" :size="13"/> 重置与回滚</div>
          <div class="gs-page-desc">危险操作，请谨慎执行，建议操作前先导出备份</div>
        </div>
        <div class="gs-card gs-danger-zone">
          <div class="gs-card-header"><span class="gs-card-title"><Icon name="warn" :size="12"/> 危险操作区</span></div>
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
          <div class="gs-page-title"><Icon name="plug" :size="13"/> 浏览器扩展设置</div>
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
              <div class="gs-sr-control gs-sr-note">V{{ runtimeVersion }}</div>
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

      <!-- ===== 产品更新日志（W5 / V3.8.5 · V3.8.38 S5 结构化） ===== -->
      <div v-if="activePage === 'changelog'" class="gs-panel">
        <div class="gs-page-header">
          <div class="gs-page-title"><Icon name="clock" :size="13"/> 产品更新日志</div>
          <div class="gs-page-desc">每个版本的发版时间与功能要点——看看这个产品是怎么一步步长成今天这样的</div>
        </div>
        <div class="gs-card">
          <div class="gs-card-body">
            <div class="gs-cl-list">
              <!-- S5：当前版本置顶（CHANGELOG 本身倒序，「最新」自然在首；此处的置顶是对
                   「数据顺序与展示顺序是两件事」的显式声明——将来若有人把数组改成正序，
                   置顶不靠运气。徽章仍由 runtimeVersion 对照，不用数组下标。 -->
              <div v-for="e in orderedChangelog" :key="e.version" class="gs-cl-item" :class="{ current: e.version === runtimeVersion }">
                <div class="gs-cl-meta">
                  <span class="gs-cl-ver">V{{ e.version }}</span>
                  <span class="gs-cl-date">{{ e.date }}</span>
                  <span v-if="e.version === runtimeVersion" class="gs-cl-now">当前版本</span>
                </div>
                <div class="gs-cl-title">{{ e.title }}</div>
                <!-- S5：三段式（新增 / 修复 / 优化）。kindGroupsOf 返回 null 的版本
                     （v2 时代单要点、标注缺失或脱节）走平铺列表，不硬造空段。 -->
                <template v-if="kindGroupsOf(e)">
                  <div v-for="g in kindGroupsOf(e)" :key="g.kind" class="gs-cl-group">
                    <div class="gs-cl-group-h"><span class="gs-cl-group-k">{{ g.label }}</span><span class="gs-cl-group-n">{{ g.items.length }}</span></div>
                    <ul class="gs-cl-points"><li v-for="(p, i) in g.items" :key="i"><RichText :text="p" /></li></ul>
                  </div>
                </template>
                <ul v-else class="gs-cl-points"><li v-for="(p, i) in e.points" :key="i"><RichText :text="p" /></li></ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 关于 ===== -->
      <div v-if="activePage === 'about'" class="gs-panel">
        <div class="gs-page-header"><div class="gs-page-title"><Icon name="question" :size="13"/> 关于</div></div>
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
              <span class="label"><Icon name="warn" :size="13"/> 写入异常</span>
              <span class="value">
                <span class="gs-save-error-kind">{{ saveErrorLabel(saveError.kind) }}</span>
                · {{ saveError.message }}
                <span v-if="saveError.bytesInUse != null">（当前 {{ formatBytes(saveError.bytesInUse) }}）</span>
                <span class="gs-link gs-link--spaced" @click="markSaveErrorRead">已处理 ›</span>
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
          <div class="gs-modal-header"><Icon name="warn" :size="13"/> 确认回滚至初始状态</div>
          <div class="gs-modal-body">
            <p>此操作将清空所有用户创建的策展台和所有资源卡、好奇心卡、任务卡，<b class="gs-danger-text">仅保留调度台、方向台（任务中心）和默认策展台</b>。</p>
            <p>此操作<b class="gs-danger-text">不可恢复</b>，建议先导出数据备份。</p>
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
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'

import { ref, reactive, computed, watch, watchEffect, onMounted, shallowRef } from 'vue'
import { wsDisplayNameOf, wsNameById } from '@/shared/utils/wsName'
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
import { testConnection, runSync, quotaHint, catPathOf, DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'
import { LETTER_HTML, buildLetterStandaloneHtml } from '../letter-data'
import { CHANGELOG, kindGroupsOf } from '../changelog-data'
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
import DataCheckupCard from '../components/DataCheckupCard.vue'
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
// V3.8.9（W9）：默认首屏改为「资源卡」——原「知源仪表盘」退役迁至画像洞察页（/profile），
// 「资源生命周期」面板同步迁出；R44-6 门禁带退役重指备案改写。
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
/** 清理孤儿附件：与策展台钻取抽屉同一条实现（`cleanupOrphanAssetsOf` 一份 keepIds 算式，含论证卡）
 *  ★R4-Dc 补确认门：这一枚钮点下去是**物理删除不可恢复的 IndexedDB 本体**，此前单击即删；
 *  同一张卡上「导出附件包」被写成"完整可迁移备份"，两个相邻动作给出相反的风险信号——
 *  与 R146 当年给「清空回收站」补门是同一条理由（见本文件 emptyRecycleBin 那段注释）。 */
async function cleanupOrphanAssetsAction() {
  const all = store.data
  if (!all) return
  let orphans: string[] = []
  try {
    orphans = await listOrphanAssetIds(collectReferencedAssetIds(all))
  } catch (err) {
    console.error('[assets] scan failed:', err)
    showToast('盘点失败，请重试')
    return
  }
  if (!orphans.length) { showToast('无孤儿附件，一切干净'); return }
  const ok = await useConfirm({
    title: '清理孤儿附件',
    message: `共发现 ${orphans.length} 个未被任何卡片（含回收站里的卡与论证卡）引用的附件本体。\n清理后不可恢复，但不会影响任何现存卡片的附件。\n想先留一份，可点上面的「导出附件包」。`,
    confirmText: `清理 ${orphans.length} 个`
  })
  if (!ok) return
  try {
    const n = await cleanupOrphanAssetsOf(all)
    await refreshAssetStats()
    showToast(n > 0 ? `已清理 ${n} 个孤儿附件` : '无孤儿附件，一切干净')
  } catch (err) {
    console.error('[assets] cleanup failed:', err)
    showToast('清理失败，请重试')
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
    showToast(`附件包已导出：${all.length} 个附件`)
  } catch (err) {
    console.error('[assets] export pack failed:', err)
    showToast('附件包导出失败，请重试')
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
    if (!assets.length) { showToast('附件包内无附件数据（manifest 或 zip 格式不符）'); return }
    await putAssets(assets.map(en => ({ id: en.name.slice('assets/'.length), blob: new Blob([en.data]) })))
    await refreshAssetStats()
    showToast(`附件包导入完成：${assets.length} 个附件（同 ID 已覆盖）`)
  } catch (err) {
    console.error('[assets] import pack failed:', err)
    showToast(`附件包导入失败：${err instanceof Error ? err.message : '格式不符'}`)
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

// ---- 导入 ----
const fileInput = ref<HTMLInputElement | null>(null)
const assetPackInput = ref<HTMLInputElement | null>(null)
const bookmarkTargetWs = ref('__new__')
// R4-Db：书签导入的解析与落库全部住在 useBookmarkImport（原先本页自带第二份解析器，
// 与 useWorkspaceImport 那份互为副本、且漏了实体解码与软删分类排除两处硬化）
const { bookmarkInput, bookmarkImport, handleBookmarkImport } = useBookmarkImport({
  d: computed(() => store.data!),
  persist: () => store.persist()
})
/** 导入回执：把新建卡 id 交给「归类并补全这批」入口（R138-H3：不自动弹抽屉） */
async function onBookmarkFile(e: Event) {
  const ids = await handleBookmarkImport(e, bookmarkTargetWs.value)
  if (ids.length) pendingImportEnrich.value = ids
}

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
        showToast('数据版本不兼容（需 v2 格式），已取消导入'); return
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
        showToast('导入前自动备份失败（将直接导入，建议先取消并手动导出备份）')
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
      showToast(`导入完成（并集）：卡片 ${n.cards}、罗盘方向 ${n.dirs}、策展台 ${n.ws}${ui ? '；界面偏好已应用' : ''}${n.catFix ? `；分类树已自动修复（${n.catFix}）`: ''}${n.thesisClear ? `；中心论点重复已净化（清 ${n.thesisClear} 张多余标记）`: ''}；已自动下载导入前备份`)
    } catch { showToast('文件格式错误，请选择有效的JSON文件') }
  }
  reader.readAsText(file)
  input.value = ''
}

/** 解析 Netscape 书签 HTML（浏览器导出格式） */
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
  showToast('全量数据已导出（含全部策展台与界面偏好）')
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
    { label: '镜像标记', get: r => (isMirrorView(r) ? '是' : '') },
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
  showToast(`「${wsDisplayNameOf(ws)}」已导出 ${cards.length} 条资源卡 CSV`)
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
  showToast(`「${ws.name}」已导出`)
}

function exportMarkdown() {
  const d = store.data!
  const wsMap = new Map(d.workspaces.map(w => [w.id, wsNameById(d.workspaces, w.id)]))
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  let md = '# 知源调度台 · 资源卡导出\n\n'
  // R4-Dg：按**卡自己的** workspaceId/categoryId 分组，不再按 workspace 实体枚举——
  // 资源卡池既可能没有实体（新建库），其卡又恒无分类（categoryId 置空＝待分类），
  // 旧的两层 for（先台后分类）会把池卡整批静默漏掉。
  const byWs = new Map<string, ResourceCard[]>()
  for (const r of d.resources.filter(x => !x.deletedAt)) {
    const arr = byWs.get(r.workspaceId)
    if (arr) arr.push(r); else byWs.set(r.workspaceId, [r])
  }
  for (const [wsId, cards] of byWs) {
    md += `## ${wsNameById(d.workspaces, wsId) || '未知来源'}\n\n`
    const byCat = new Map<string, ResourceCard[]>()
    for (const r of cards) {
      const k = r.categoryId || ''
      const arr = byCat.get(k)
      if (arr) arr.push(r); else byCat.set(k, [r])
    }
    for (const [catId, catCards] of byCat) {
      md += `### ${catMap.get(catId) || '待分类'}\n\n`
      for (const r of catCards) {
        md += `- [${r.title}](${r.link})`
        if (r.description) md += `— ${r.description}`
        if (r.tags?.length) md += `${r.tags.map(t => `#${t}`).join(' ')}`
        md += '\n'
      }
      md += '\n'
    }
  }
  downloadFile(`zhiyuan_resources_${dateStr()}.md`, md, 'text/markdown;charset=utf-8')
  markBackupNow()
  showToast('资源卡已导出为Markdown')
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
  showToast('已回滚至初始状态')
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
  const parts = [`回收站已清空，永久删除 ${r.cards} 项`]
  if (r.assetsPurged) parts.push(`清理 ${r.assetsPurged} 个附件本体`)
  if (r.assetsShared) parts.push(`${r.assetsShared} 个共享附件保留`)
  showToast(parts.join('· ') + (r.assetsFailed ? `  ${r.assetsFailed} 个附件删除失败（可清理孤儿）` : ''))
}
/** R146：这行按钮原先是**假回执**（函数体只有一句 showToast('✓ 缓存已清除')，什么都没做）——
 *  它会污染用户对其它 ✓ 的信任。现在真做事：清 AI 抓过的网页正文会话缓存与整体梳理抽读缓存
 *  （都是内存态，关掉页面本来也没了；此处提供"立刻重来一遍"的手动闸）。
 *  孤儿附件本体不在此列——它在「数据管理」里有专属按钮（cleanupOrphanAssetsAction）。 */
function clearCache() {
  const links = clearLinkCache()
  const snips = reviseSnips.size
  reviseSnips.clear()
  showToast(links || snips ? `缓存已清：${links} 篇网页正文 · ${snips} 篇梳理抽读正文（卡片数据未动）` : '没有需要清理的缓存（AI 会话正文是空的）')
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

const appShortcuts = [
  { label: '保存（所有编辑弹窗）', keys: 'Ctrl+Enter' },
  { label: '关闭弹窗/浮层', keys: 'Esc' },
  { label: '搜索浮层内过滤类型', keys: '输入「任务/资源/好奇心」+ Tab' },
  { label: '资源卡池 / 策展台：双击卡片打开链接', keys: '双击' },
  { label: '资源卡批量管理', keys: '资源卡池控制行「批量」' }
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
.gs-content { flex: 1; min-width: 0; max-width: 1100px; padding: 24px 32px; overflow-y: auto; } /* R155-①：容器放到 1440 后右栏会到 1230px，表单强行拉满则单行过长 → 内容列限宽 1100 */
.gs-page-header { margin-bottom: 22px; position: relative; }
/* R3-F38：交互点高亮开关（工具条位） */
.gs-dash-hl { position: absolute; right: 0; top: 0; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); font-weight: 600; border-radius: var(--radius-sm); padding: 5px 12px; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.gs-dash-hl:hover { border-color: var(--accent); color: var(--accent); }
.gs-dash-hl.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
/* ★V3.8.30：18px 是字阶表外的孤立取值（表内最接近的是 headline 17）。归位到令牌，顺带压 1px。 */
.gs-page-title { font-size: var(--fs-headline); font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
.gs-page-desc { font-size: var(--fs-sub); color: var(--text-3); margin-top: 4px; }

/* 卡片 */
/* R178（原型 settings-section-card）：radius-lg + 卡影 + 分隔节奏 */
.gs-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
/* ★V3.8.30（S2 补完）：分区名与左侧导航组标题同档（caption 11 / 700 / 正字距）。
   为什么敢压到 11：这一层不是「标题」，是卡片的**标签**——它下面紧跟的是 13px 正文，
   原来 13px/600 与正文同字号，只能靠字重区分，八区在长页里反而糊成一片。
   压小后层级由「字号差」变成「字号 + 字距 + 字重」三点差，且颜色仍是 --text（不下调，
   守 R153-4 的 AA 底线：11px 与 13px 的对比度门槛同为 4.5:1）。 */
.gs-card-header { padding: 10px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.gs-card-title { font-size: var(--fs-caption); font-weight: 700; color: var(--text); letter-spacing: var(--tracking-sm); }
.gs-card-desc { font-size: var(--fs-caption); color: var(--text-3); margin-left: auto; }
.gs-card-body { padding: 16px 18px; }

/* 设置行 */
.gs-setting-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.gs-setting-row:last-child { border-bottom: none; }
/* ★V3.8.25（B1-a）：两条修饰类，收的是原先写在模板上的内联样式 */
.gs-setting-row--gap { margin-top: 6px; }
.gs-setting-row--top { align-items: flex-start; }
.gs-sr-label { font-size: var(--fs-body); color: var(--text); min-width: 120px; }
.gs-sr-label--nowrap { white-space: nowrap; }
.gs-sr-control { margin-left: auto; display: flex; align-items: center; gap: 8px; }
/* 按钮 + 状态文字并排：只把 gap 从 8 放大到 10，其余沿用 .gs-sr-control */
.gs-sr-control--inline { gap: 10px; }
/* R4-Dd：带说明文字的setting行——说明占满余下宽度并允许换行，输入框不被挤扁 */
.gs-sr-control-wrap { gap: 10px; flex-wrap: wrap; }
.gs-sr-hint { font-size: var(--fs-caption); color: var(--text-3); flex: 1; min-width: 220px; }
/* ★V3.8.25（B1-a）：设置行右侧的说明性文字（同步范围 / 增量游标 / 上次同步 / 扩展版本）
   原先每处各写一份内联 `font-size + color`，现归成一个基类 + 三个修饰。 */
.gs-sr-note { font-size: var(--fs-sub); color: var(--text-2); }
.gs-sr-note--muted { color: var(--text-3); }
.gs-sr-note--danger { color: var(--danger); }
.gs-sr-note--wrap { max-width: 380px; line-height: 1.7; text-align: left; }
.gs-sr-note--log { max-width: 420px; text-align: left; }
/* 连接测试成功态：原先是 `var(--ok, var(--info-green, #3A6B4C))`，两个令牌都不存在 ⇒ 四主题一律吃硬编码 */
.gs-sr-ok { font-size: var(--fs-sub); color: var(--success); }
.gs-log-ico { flex-shrink: 0; }
.gs-log-ico.ok { color: var(--success); }
.gs-log-ico.err { color: var(--danger); }
.gs-log-dot { color: var(--text-4); }

/* 开关 */
.gs-toggle { width: 38px; height: 21px; border-radius: 99px; background: var(--border-strong); cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
.gs-toggle.on { background: var(--accent); }
.gs-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.gs-toggle.on::after { transform: translateX(17px); }

/* 输入框/下拉 */
/* R4-Dh：`.gs-input` 此前全站没有一条自有规则（只有三处 `.ai-field .gs-input` 之类的复合选择器改宽度/字号），
   实测四主题 × 设置页输入框全部吃浏览器默认：底色 rgb(255,255,255)、字色黑、边框 2px 灰——
   在 linear / raycast 两个深色主题里就是两排白块，其中一枚是 PAT（凭据）框。按同段 .gs-select 的语言补齐。 */
.gs-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--fs-sub); color: var(--text); background: var(--surface); outline: none; transition: all var(--dur); font-family: inherit; }
.gs-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.gs-input::placeholder { color: var(--text-4); }
.gs-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--fs-sub); color: var(--text); background: var(--surface); outline: none; transition: all var(--dur); font-family: inherit; }
.gs-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
/* ★V3.8.25（B1-a）：Airtable 连接区三种输入框宽度（原先写在模板内联 style 上）。
   `--pat` 是 PAT 凭据框（占位提示最长，320）；`--ident` 是 Base/Table/标签列名（260）。 */
.gs-input--pat { width: 320px; }
.gs-input--ident { width: 260px; }
/* 隐藏的原生 file input（导入 JSON / 附件包 / 书签 HTML 三个触发器） */
.gs-file-hidden { display: none; }

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
/* 两个并列的虚线按钮（新建根标签 / 从卡片收纳）：原先第二个写内联 margin-left:8px */
.gs-field-add + .gs-field-add { margin-left: 8px; }
.gs-field-hint { margin-top: 12px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; font-size: var(--fs-sub); color: var(--accent-ink); line-height: 1.7; }

/* ★V3.8.25（B1-a）：手册页的"已升级为独立阅读页"空态。
   原先是一串内联 flex + 三处 font-size，其中大图标因为 Icon 用 width/height 定尺寸而一直是 13px。
   注意本段必须排在 `.gs-card-body` 之后，否则同为单类选择器时 padding 抢不过 16px 18px。 */
.gs-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 40px 20px; text-align: center; }
.gs-empty-ico { line-height: 1; }
.gs-empty-title { font-size: var(--fs-title); font-weight: 600; color: var(--text); }
.gs-empty-desc { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.8; max-width: 420px; }

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
/* ★S3（V3.8.29）：三态补齐。未连接走中性 surface-3（不是灰字压白底——那在 notion 下几乎看不见）；
   「推送异常」才用琥珀，且只在真有 lastError 时出现，不做常驻警示。 */
.gs-status-badge.idle { background: var(--surface-3); color: var(--text-2); }
.gs-status-badge.error { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
/* ★S2（V3.8.29）：字段级错误内联。原先只有整行 gs-sr-note--danger（错误出现在"上次错误"行，
   输入框本身毫无提示，用户要读到卡片底部才知道哪个字段写错了）。 */
.gs-input.is-invalid { border-color: var(--danger); }
.gs-input.is-invalid:focus { border-color: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent); }
.gs-field-err { flex-basis: 100%; font-size: var(--fs-caption); color: var(--danger); line-height: 1.5; text-align: left; }
.gs-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

/* 按键 */
.gs-keycap { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); font-size: var(--fs-sub); font-family: monospace; color: var(--text); min-width: 120px; justify-content: center; }
.gs-keycap-link { text-decoration: none; cursor: pointer; transition: all var(--dur); }
.gs-keycap-link:hover { border-color: var(--accent); color: var(--accent); }
.gs-shortcut-link { font-size: var(--fs-sub); color: var(--accent); text-decoration: none; }
.gs-shortcut-link:hover { text-decoration: underline; }

/* 产品更新日志（W5 / V3.8.5 · V3.8.38 S5 结构化）——时间线：左轨 + 圆点，当前版本整轨染 accent */
.gs-cl-list { position: relative; }
.gs-cl-item { border-left: 2px solid var(--border); padding: 0 0 22px 18px; position: relative; }
.gs-cl-item:last-child { border-left-color: transparent; padding-bottom: 0; }
.gs-cl-item::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--surface-3); border: 2px solid var(--border-strong); }
.gs-cl-item.current { border-left-color: var(--accent); }
.gs-cl-item.current::before { background: var(--accent); border-color: var(--accent); }
.gs-cl-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
/* S5：版本号走等宽字体。版本号是一串要被逐位比对的字符（3.8.37 / 3.8.4 谁新谁旧），
   等宽下 8 与 3 的宽度一致、竖排时小数点自然对齐；比例字体下这些数字宽窄不一，
   扫一列版本号时找不到对齐线。 */
.gs-cl-ver { font-weight: 700; font-size: var(--fs-sub); color: var(--text); font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
/* S5：日期升到 --text-3。此前用 --text-4，在浅色主题下约 2:1（真机近乎隐形）——
   日期是"这个版本什么时候发的"这一层事实，不该弱到读不出来。降噪只动字号与间距，不动对比度。 */
.gs-cl-date { font-size: var(--fs-caption); color: var(--text-3); }
.gs-cl-now { font-size: var(--fs-micro); background: var(--accent-light); color: var(--accent-ink); border-radius: 99px; padding: 1px 8px; font-weight: 600; }
.gs-cl-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); margin-bottom: 4px; }
/* S5：正文行宽 ≤68ch。设置页内容列宽 1100px，12px 正文铺满一行有近 90 个汉字，
   眼睛从行尾扫回行首会迷路；限宽后一行约 34 个汉字（中文按半角折算），落在可读区间。
   只限正文与标题，左轨继续通到卡片右缘——轨是时间轴的脊，不该被行宽截断。 */
.gs-cl-title, .gs-cl-points { max-width: 68ch; }
.gs-cl-points { margin: 0; padding-left: 18px; font-size: var(--fs-sub); color: var(--text-2); line-height: 1.75; }
.gs-cl-points li { margin-bottom: 6px; }
.gs-cl-points li:last-child { margin-bottom: 0; }
/* S5：要点里的 `**加粗**` 由 RichText 渲染成真加粗（此前星号原样显示给用户） */
.gs-cl-points b { color: var(--text); font-weight: 600; }
/* S5：变更分组（新增 / 修复 / 优化）。段头弱而不隐——它是扫读时的路标，
   用 caption 字号 + --text-2，不靠加粗抢眼（内容本身才是主角）。 */
.gs-cl-group { margin-top: 10px; }
.gs-cl-group:first-of-type { margin-top: 6px; }
.gs-cl-group-h { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.gs-cl-group-k { font-size: var(--fs-caption); font-weight: 600; color: var(--text-2); letter-spacing: var(--tracking-sm); }
.gs-cl-group-n { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 0 6px; line-height: var(--lh-micro); }

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
/* ★V3.8.25（B1-a）：保存异常行里"已处理 ›"需要与前面的字节数拉开 8px（原先写内联 margin-left） */
.gs-about-row .value .gs-link--spaced { margin-left: 8px; }
/* 回滚确认弹窗里的高危强调（原先两处写内联 color:var(--danger)） */
.gs-danger-text { color: var(--danger); }

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
.gs-manual-open { padding: 10px 22px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
/* 信件页底部"下载这封信"按钮的居中容器（原先写内联 text-align + margin-top） */
.gs-letter-actions { text-align: center; margin-top: 14px; }
.gs-manual-open:hover { background: var(--accent-hover); }

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
