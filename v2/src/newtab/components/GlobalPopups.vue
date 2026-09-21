<template>
  <!-- 全局搜索 -->
  <div class="gp-overlay" :class="{open: activePanel==='search'}" @click.self="closeAll">
    <div class="gp-panel">
      <div class="gp-search-head">
        <div class="gp-search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </div>
        <div class="gp-search-input-wrap">
          <span v-if="currentType !== 'all'" class="gp-search-chip">
            <span>{{ filterLabel }}</span>
            <span class="gp-chip-x" @click="clearFilter">×</span>
          </span>
          <input ref="searchInput" type="text" class="gp-search-input" v-model="searchQueryRaw"
            placeholder="搜索全部卡片…" autocomplete="off" spellcheck="false"
            @keydown="onSearchKeydown">
        </div>
        <button class="gp-search-esc" @click="closeAll">Esc</button>
      </div>
      <!-- R146-d：tab 去 emoji 图标（实测带图标在窄屏逐字换行成两行）+ nowrap 锁死 -->
      <div class="gp-type-tabs">
        <div class="gp-type-tab" :class="{active: currentType==='all'}" @click="setType('all')">搜全部 <span class="gp-tt-count">{{ counts.all }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='res'}" @click="setType('res')">资源卡 <span class="gp-tt-count">{{ counts.res }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='task'}" @click="setType('task')">任务卡 <span class="gp-tt-count">{{ counts.task }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='curio'}" @click="setType('curio')">好奇心 <span class="gp-tt-count">{{ counts.curio }}</span></div>
        <!-- R49-G：策展台（分类树定位）/ 项目（直达项目详情）双类型 -->
        <div class="gp-type-tab" :class="{active: currentType==='ws'}" @click="setType('ws')">策展台 <span class="gp-tt-count">{{ counts.ws }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='proj'}" @click="setType('proj')">项目 <span class="gp-tt-count">{{ counts.proj }}</span></div>
        <!-- R150：AI 检索（自然语言 → 三类卡语义召回，只读；跑动中再点=取消；键入路径零 AI） -->
        <div class="gp-type-tab gp-ai-tab" :class="{active: !!aiSearch, busy: aiBusy}" @click="aiSearchRun(false)"
          :title="aiBusy ? '点击取消本次 AI 检索（不写任何数据）' : 'AI 读懂你这句话，从库内资源卡/任务/好奇卡里按相关度取一批投料，挑出真正贴合的（只读不改数据；结果出来后会写明扫了多少张/库内共多少张；再点=清除）'">
          <ZhiMark :size="13" :spin="aiBusy" /><span>{{ aiBusy ? aiProgress : 'AI 检索' }}</span>
        </div>
      </div>
      <div class="gp-results" ref="resultsEl">
        <!-- R150：AI 检索组（置顶呈现；原分组列表不动；手势与主列表逐字一致） -->
        <template v-if="aiTopRows.length && !isBrowseMode">
          <div class="gp-group-title gp-ai-title">
            <ZhiMark :size="12" /> AI 检索
            <span class="gp-ai-fed">挑出 {{ aiTopRows.length }} 条 · 投料 {{ aiSearch?.scanned }}/{{ aiSearch?.total }} 张 · {{ aiDur(aiTook) }}<template v-if="aiSearch && aiSearch.batches > 1"> · {{ aiSearch.batches }} 批</template></span>
            <span v-if="aiSearch && aiSearch.note" class="gp-ai-note">{{ aiSearch.note }}</span>
            <span v-if="aiSearch && aiSearch.dropped" class="gp-ai-drop">消毒：{{ aiSearch.dropped }} 条 id 不在候选内</span>
            <button v-if="aiSearch && aiSearch.scanned < aiSearch.total" class="gp-ai-more" :disabled="aiBusy"
              :title="`本次只看了相关性最高的 ${aiSearch.scanned} 张；全库共 ${aiSearch.total} 张，分批扫约 ${aiMoreBatches} 次请求、会慢`" @click.stop="aiSearchRun(true)">全库分批扫</button>
          </div>
          <div v-for="pair in aiTopRows" :key="'ai' + pair.hit.id" class="gp-result-item" :class="{selected: pair.item.id===selectedId}"
            @click="pickRow(pair.item)" @mouseenter="selectHover(pair.item)"
            :title="'单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处'">
            <div class="gp-ri-icon" :class="pair.item.iconClass">{{ pair.item.iconText }}</div>
            <div class="gp-ri-main">
              <div class="gp-ri-title">{{ pair.item.title }}</div>
              <div class="gp-ri-meta">
                <span class="gp-ri-badge ws">{{ pair.item.ws }}</span>
                <span class="gp-ri-badge cat">{{ pair.item.cat }}</span>
                <span v-if="pair.hit.weak" class="gp-ri-badge weak" title="模型给的分低或没给理由——它在猜，自己核一眼再用">低置信</span>
                <span v-if="pair.hit.why" class="gp-ai-why">{{ pair.hit.why }}</span>
              </div>
            </div>
            <span class="gp-ri-link url">↵</span>
          </div>
        </template>
        <!-- B1：浏览模式（空查询）= 快捷操作 + 最近打开 -->
        <template v-if="isBrowseMode">
          <div class="gp-group-title">快捷操作</div>
          <div v-for="(qa, i) in QUICK_ACTIONS" :key="'qa' + i"
            class="gp-result-item" :class="{selected: selIndex===i}" @click="runFlat(i)" @mouseenter="selIndex=i">
            <div class="gp-ri-icon res"><Icon :name="qa.icon" :size="15" /></div>
            <div class="gp-ri-main"><div class="gp-ri-title">{{ qa.label }}</div></div>
            <span class="gp-ri-link url">↵</span>
          </div>
          <template v-if="recentResources.length">
            <div class="gp-group-title">🔥 近期最常用 · 按调用次数</div>
            <div v-for="(r, j) in recentResources" :key="r.id"
              class="gp-result-item" :class="{selected: selIndex===QUICK_ACTIONS.length+j}"
              @click="runFlat(QUICK_ACTIONS.length+j)" @mouseenter="selIndex=QUICK_ACTIONS.length+j"
              :title="'单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处'">
              <div class="gp-ri-icon" :class="r.iconClass">{{ r.iconText }}</div>
              <div class="gp-ri-main"><div class="gp-ri-title">{{ r.title }}</div>
                <div class="gp-ri-cat">{{ r.ws }}<template v-if="r.cat"> · {{ r.cat }}</template></div>
              </div>
              <span class="gp-ri-link url">🔥{{ (r.raw as any).callCount || 0 }}</span>
            </div>
          </template>
        </template>
        <!-- B1：搜索模式 = 分组 + 关键词高亮 -->
        <template v-else>
        <!-- R49-G2：策展台类型 → 策展台→分类树（点击分类定位：有卡=高亮第一张，无卡=高亮分类行） -->
        <template v-if="currentType==='ws'">
          <div v-if="!wsTree.length" class="gp-search-empty">
            <div class="gp-se-icon">🗂</div>
            <div class="gp-se-text">没有匹配的策展台</div>
          </div>
          <template v-for="wsn in wsTree" :key="wsn.id">
            <div class="gp-group-title">🗂 {{ wsNameOf(wsn.id) }} <span class="gp-group-cnt">{{ wsn.cards }} 张卡</span></div>
            <div v-for="cn in wsn.cats" :key="wsn.id + '-' + cn.id"
              class="gp-result-item" @click="locateCat(wsn.id, cn)"
              title="单击 → 定位到该分类（有卡高亮第一张，无卡高亮分类行）">
              <div class="gp-ri-icon ws">📁</div>
              <div class="gp-ri-main">
                <div class="gp-ri-title">{{ cn.name }}</div>
                <div class="gp-ri-meta">
                  <span class="gp-ri-badge cat">{{ cn.count }} 张卡</span>
                  <span v-if="!cn.count" class="gp-ri-badge">空分类 · 定位到分类</span>
                </div>
              </div>
              <span class="gp-ri-link url">定位 ↗</span>
            </div>
            <div v-if="!wsn.cats.length" class="gp-group-more">该策展台暂无分类</div>
          </template>
        </template>
        <template v-else>
        <!-- R110-LC（T3）：归档卡已从默认检索结果排除——一行降级提示（不打断结果流） -->
        <div v-if="archivedMatchCount" class="gp-archived-hint">
          📦 另有 {{ archivedMatchCount }} 张已归档卡片匹配（在「⏳ 生命周期」中查看 / 恢复）
        </div>
        <div v-if="!filteredResults.length" class="gp-search-empty">
          <div class="gp-se-icon">🪹</div>
          <div class="gp-se-text">没有匹配的卡片<br><span style="font-size:11px">试试更短的关键词</span></div>
        </div>
        <template v-for="grp in groupedResults" :key="grp.label">
          <div class="gp-group-title">{{ grp.label }} <span class="gp-group-cnt">{{ grp.total }}</span></div>
          <div v-for="item in grp.items" :key="item.id"
            class="gp-result-item" :class="{selected: item.id===selectedId}"
            @click="pickRow(item)" @mouseenter="selectHover(item)"
            :title="'单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处'">
            <div class="gp-ri-icon" :class="item.iconClass">{{ item.iconText }}</div>
            <div class="gp-ri-main">
              <div class="gp-ri-title" v-html="hlTitle(item.title)"></div>
            <div class="gp-ri-meta">
              <span class="gp-ri-badge ws">{{ item.ws }}</span>
              <span class="gp-ri-badge cat">{{ item.cat }}</span>
              <span v-for="b in item.badges" :key="b.text" class="gp-ri-badge" :class="b.type">{{ b.text }}</span>
              <span v-if="item.link" class="gp-ri-link" :class="item.link.type">{{ item.link.icon }} {{ item.link.text }}</span>
              <span v-if="item.due" class="gp-ri-due" :class="{overdue: item.dueOverdue}">{{ item.dueOverdue ? '⏰' : '📅' }} {{ item.due }}</span>
            </div>
            <div v-if="item.summary" class="gp-ri-summary" v-html="hlTitle(item.summary)"></div>
          </div>
          <div v-if="grp.total > grp.items.length" class="gp-group-more">… 还有 {{ grp.total - grp.items.length }} 条，输入更精确的关键词</div>
          <div class="gp-ri-actions">
            <template v-if="item.type==='res'">
              <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)">⭐</button>
              <button class="gp-ri-act del" title="删除" @click.stop="deleteItem(item)">🗑</button>
              <button class="gp-ri-act go" title="打开链接（外开浏览器）" @click.stop="openResLink(item)">↗</button>
            </template>
            <template v-else-if="item.type==='task'">
              <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)">⭐</button>
              <button class="gp-ri-act del" title="删除" @click.stop="deleteItem(item)">🗑</button>
              <button class="gp-ri-act go" title="定位到任务卡片" @click.stop="openItem(item)">↗</button>
            </template>
            <template v-else-if="item.type==='curio'">
              <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)">⭐</button>
              <div class="gp-ri-act convert" title="转化为...">
                <span @click.stop="toggleConvertMenu(item.id)">🔄▾</span>
                <div class="gp-convert-menu" :class="{open: convertMenuId===item.id}" @click.stop>
                  <div class="gp-convert-menu-item" @click="convertCurio(item, 'res')">📄 转化为资源卡</div>
                  <div class="gp-convert-menu-item" @click="convertCurio(item, 'task')">✅ 转化为任务卡</div>
                </div>
              </div>
              <button class="gp-ri-act go" title="定位到好奇心卡片" @click.stop="openItem(item)">↗</button>
            </template>
          </div>
          </div><!-- /gp-result-item -->
        </template>
        </template>
        </template><!-- /R49-G ws 树分支 v-else -->
      </div>
      <div class="gp-panel-foot">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>⏎</kbd> 打开链接</span>
        <span><kbd>Ctrl+⏎</kbd> 定位卡片</span>
        <span><kbd>Tab</kbd> 过滤类型</span>
        <span><kbd>Esc</kbd> 关闭</span>
        <span class="gp-foot-brand">知源调度台 · 万千可调用，自有我方向</span>
      </div>
    </div>
  </div>

  <!-- 采集资源卡 -->
  <div class="gp-overlay corner" :class="{open: activePanel==='capture'}" @click.self="closeAll">
    <div class="gp-panel gp-panel-narrow">
      <template v-if="!capSaved">
        <div class="gp-cap-head">
          <div class="gp-cap-icon res">📥</div>
          <div class="gp-cap-titles">
            <div class="gp-cap-title">快速采集资源卡</div>
            <div class="gp-cap-sub">把当前页面收进你的来源网络</div>
          </div>
          <button class="gp-cap-close" @click="closeAll">×</button>
        </div>
        <div class="gp-cap-body">
          <div class="gp-field">
            <label class="gp-field-label">标题</label>
            <input ref="capTitleInput" type="text" class="gp-field-input" v-model="capForm.title" placeholder="资源卡标题"
              @keydown.ctrl.enter.prevent="saveCapture" @keydown.meta.enter.prevent="saveCapture">
          </div>
          <div class="gp-field">
            <label class="gp-field-label">链接类型</label>
            <div class="gp-seg-control">
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='url'}" @click="capForm.linkType='url'">🔗 URL</button>
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='file'}" @click="capForm.linkType='file'">📁 本地文件</button>
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='obsidian'}" @click="capForm.linkType='obsidian'">📝 Obsidian</button>
            </div>
            <input type="text" class="gp-field-input" v-model="capForm.link" :placeholder="capLinkPlaceholder"
              @keydown.ctrl.enter.prevent="saveCapture" @keydown.meta.enter.prevent="saveCapture">
          </div>
          <div class="gp-field">
            <label class="gp-field-label">描述（选中文本自动填入，可编辑）</label>
            <textarea class="gp-field-input gp-cap-desc" v-model="capForm.description"
              placeholder="对该资源的注解、摘录、引用…"
              @keydown.ctrl.enter.prevent="saveCapture" @keydown.meta.enter.prevent="saveCapture"></textarea>
          </div>
          <div class="gp-field-row">
            <div class="gp-field">
              <label class="gp-field-label">存入台面</label>
              <select class="gp-status-select" v-model="capForm.workspaceId">
                <option v-for="ws in userWorkspaces" :key="ws.id" :value="ws.id">{{ ws.icon }} {{ ws.name }}</option>
                <option disabled>🧭 方向台（系统）</option>
                <option disabled>✅ 任务调度（系统）</option>
              </select>
            </div>
            <div class="gp-field">
              <label class="gp-field-label">分类</label>
              <select class="gp-status-select" v-model="capForm.categoryId">
                <option value="">📥 待分类</option>
                <option v-for="cat in capCategories" :key="cat.id" :value="cat.id">📂 {{ cat.label }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="gp-cap-foot">
          <label class="gp-cap-enrich" title="保存成功后自动打开 AI 补全评审（勾选采纳才写库）"><input type="checkbox" v-model="capEnrichOn" @change="capEnrichSave" /> <ZhiMark :size="12" /> 保存后补全</label>
          <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
          <button class="gp-btn gp-btn-primary" @click="saveCapture">💾 保存（Ctrl+Enter）</button>
        </div>
      </template>

      <!-- 已保存状态条：Enter 打开看板 / Esc 关闭 / 5 秒自动消失 -->
      <template v-else>
        <div class="gp-saved">
          <div class="gp-saved-icon">✓</div>
          <div class="gp-saved-title">资源卡已保存</div>
          <div class="gp-saved-hint">按 <kbd>Enter</kbd> 打开看板 · 定位新卡片</div>
          <div class="gp-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
          <div class="gp-saved-actions">
            <button class="gp-btn gp-btn-ghost" @click="closeAll">关闭</button>
            <button v-if="capEnrichReady" class="gp-btn" @click="aiReopenEnrich"><ZhiMark :size="13" /> 补全建议</button>
            <button class="gp-btn gp-btn-primary" @click="openSavedBoard">打开看板（Enter）</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- R55-C：快速采集任务（四字段全非必填，直存全域任务） -->
  <div class="gp-overlay" :class="{open: activePanel==='taskcapture'}" @click.self="closeAll">
    <div class="gp-panel gp-panel-narrow">
      <template v-if="!tcSaved">
        <div class="gp-cap-head">
          <div class="gp-cap-icon res">⚡</div>
          <div class="gp-cap-titles">
            <div class="gp-cap-title">快速采集任务</div>
            <div class="gp-cap-sub">四项皆可留空 · 存入全域任务统一管理</div>
          </div>
          <button class="gp-cap-close" @click="closeAll">×</button>
        </div>
        <div class="gp-cap-body">
          <div class="gp-field">
            <label class="gp-field-label">任务名称</label>
            <input ref="tcTitleInput" type="text" class="gp-field-input" v-model="tcForm.title" placeholder="要做什么（可留空）"
              @keydown.ctrl.enter.prevent="saveTaskCapture" @keydown.meta.enter.prevent="saveTaskCapture">
          </div>
          <div class="gp-field">
            <label class="gp-field-label">任务内容</label>
            <textarea class="gp-field-input gp-cap-desc" v-model="tcForm.description"
              placeholder="补充说明、上下文、验收标准（可留空）"
              @keydown.ctrl.enter.prevent="saveTaskCapture" @keydown.meta.enter.prevent="saveTaskCapture"></textarea>
          </div>
          <div class="gp-field-row">
            <div class="gp-field">
              <label class="gp-field-label">所属项目（可留空）</label>
              <select class="gp-status-select" v-model="tcForm.projectId">
                <option value="">未关联项目</option>
                <option v-for="p in tcProjects" :key="p.id" :value="p.id">📦 {{ p.name }}</option>
              </select>
            </div>
            <div class="gp-field">
              <label class="gp-field-label">所属指标（可留空）</label>
              <select class="gp-status-select" v-model="tcForm.metricId" :disabled="!tcForm.projectId">
                <option value="">暂不归属</option>
                <option v-for="m in tcMetrics" :key="m.id" :value="m.id">🎯 {{ m.title }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="gp-cap-foot">
          <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
          <button class="gp-btn gp-btn-primary" @click="saveTaskCapture">⚡ 保存任务（Ctrl+Enter）</button>
        </div>
      </template>
      <template v-else>
        <div class="gp-saved">
          <div class="gp-saved-icon">⚡</div>
          <div class="gp-saved-title">任务已保存</div>
          <div class="gp-saved-sub">{{ tcForm.projectId ? '已挂项目/指标 · 全域任务统一管理' : '暂为未归档任务 · 可随时在方向台归档' }}</div>
          <div class="gp-saved-hint">按 <kbd>Enter</kbd> 打开任务管理</div>
          <div class="gp-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
          <div class="gp-saved-actions">
            <button class="gp-btn gp-btn-ghost" @click="resetTcForm(); closeAll()">关闭</button>
            <button class="gp-btn gp-btn-primary" @click="tcOpenBoard">打开任务管理（Enter）</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- 采集好奇心 -->
  <div class="gp-overlay" :class="{open: activePanel==='curio'}" @click.self="closeAll">
    <div class="gp-panel gp-panel-curio">
      <div class="gp-cap-head">
        <div class="gp-cap-icon curio">💡</div>
        <div class="gp-cap-titles">
          <div class="gp-cap-title">采集好奇心</div>
          <div class="gp-cap-sub">从好奇出发，向源头求证</div>
        </div>
        <button class="gp-cap-close" @click="closeAll">×</button>
      </div>
      <div class="gp-cap-body">
        <div class="gp-field">
          <label class="gp-field-label">你的问题或想法</label>
          <textarea ref="curioInput" class="gp-field-input gp-curio-text" v-model="curioForm.text"
            placeholder="看到什么、想到什么、想探索什么？&#10;按 Enter 换行，Ctrl+Enter 保存"
            @keydown.ctrl.enter.prevent="saveCurio"></textarea>
          <div class="gp-field" style="margin-top:10px">
            <label class="gp-field-label">🔗 来源链接{{ curioForm.sourceUrl ? '（已自动捕获，可编辑）' : '（可选，留空即无来源）' }}</label>
            <input type="text" class="gp-field-input" v-model="curioForm.sourceUrl" placeholder="https://…">
          </div>
          <div class="gp-field">
            <label class="gp-field-label">📝 来源标题</label>
            <input type="text" class="gp-field-input" v-model="curioForm.sourceTitle" placeholder="来源页面标题（可选）">
          </div>
        </div>
      </div>
      <div class="gp-cap-foot">
        <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
        <button class="gp-btn gp-btn-primary" @click="saveCurio">💾 保存到罗盘</button>
      </div>
    </div>
  </div>

  <!-- B3：快捷键速查面板（? 呼出） -->
  <div class="gp-overlay" :class="{open: activePanel==='shortcuts'}" @click.self="closeAll">
    <div class="gp-panel gp-panel-shortcuts">
      <div class="gp-cap-head">
        <div class="gp-cap-icon res"><Icon name="settings" :size="18" /></div>
        <div class="gp-cap-titles">
          <div class="gp-cap-title">快捷键速查</div>
          <div class="gp-cap-sub">键盘优先 · 按 Esc 关闭</div>
        </div>
        <button class="gp-cap-close" @click="closeAll">×</button>
      </div>
      <div class="gp-sc-body">
        <div v-for="grp in SHORTCUT_GROUPS" :key="grp.title" class="gp-sc-group">
          <div class="gp-sc-title">{{ grp.title }}</div>
          <div v-for="it in grp.items" :key="it.keys" class="gp-sc-row">
            <span class="gp-sc-keys"><kbd v-for="k in it.keys.split('+')" :key="k">{{ k }}</kbd></span>
            <span class="gp-sc-desc">{{ it.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 快捷键速查面板（? 呼出） -->

  <!-- R138-H1′：采集后补全评审抽屉（懒组件，盖在所有 gp-overlay 之上） -->
  <AiDrawerGP v-if="aiEnrichJob" :job="aiEnrichJob" @close="aiEnrichJob = null" />
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import { uid, normalizeUrl } from '@/shared/utils'
import { CURATION_WS_ID } from '@/shared/models'
// V2.21：拼音字典改为按需加载（约 296KB），未就绪时降级为纯文本匹配
import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { recordResourceOpen, recordCardOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { useConfirm } from '@/shared/components/confirm'
import Icon from '@/shared/components/Icon.vue'
// R146-b：AI 入口统一徽标「知」（纯 CSS 组件，零 AI 字面量，可进启动链）
import ZhiMark from '@/shared/components/ZhiMark.vue'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
// R146（回退契约）：检索浮层删任务改走软删真源（同时摘 metric.taskIds，守 R141 双向不变量）
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { markRank } from '@/shared/utils/marksort'
import { buildCatOptions } from '@/shared/utils/catTree'

const router = useRouter()
const store = useAppStore()
const d = computed(() => store.data!)

// 弹窗状态
type PanelType = 'search' | 'capture' | 'curio' | 'shortcuts' | 'taskcapture' | null
const activePanel = ref<PanelType>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const capTitleInput = ref<HTMLInputElement | null>(null)
const curioInput = ref<HTMLTextAreaElement | null>(null)
const tcTitleInput = ref<HTMLInputElement | null>(null)
const resultsEl = ref<HTMLDivElement | null>(null)

let lastFocused: HTMLElement | null = null
function openPanel(p: PanelType) {
  lastFocused = document.activeElement as HTMLElement | null
  activePanel.value = p
  if (p === 'capture') {
    capSaved.value = false
    // R138-H1′：入口宿主必须全懒——读 AI 配置仅同步勾选态展示，失败静默
    void import('@/shared/ai/config').then(m => { m.loadAiConfig().then(() => { capEnrichOn.value = m.aiConfig.value.captureEnrich }) })
  }
  // V2.21：字典按需加载——仅在搜索面板被打开时才拉取，不进新标签页首屏同步路径
  // R47-A4：每次唤起清空上次查询词，恢复浏览态（无输入=近期热度排序）
  // R60-2：selectedId 与 searchQuery 必须同时清空，否则下次唤起会锚定到上一次选中的卡
  if (p === 'search') { currentType.value = 'all'; setSearchQuery(''); selectedId.value = ''; void ensurePinyin() }
  if (p === 'taskcapture') {
    // R55-C：快速采集任务——四字段全非必填，直存全域任务
    tcSaved.value = false
    tcForm.title = ''
    tcForm.description = ''
    tcForm.projectId = ''
    tcForm.metricId = ''
  }
  if (p === 'curio') {
    // 第十七轮：仅当选中文本时附带来源；无选中 → 链接为空，不预设默认值
    curioForm.sourceTitle = ''
    curioForm.sourceUrl = ''
    const sel = window.getSelection?.()?.toString().trim()
    if (sel) {
      if (!curioForm.text.trim()) curioForm.text = sel
      getRecentWebTab().then(t => {
        if (t && activePanel.value === 'curio') {
          curioForm.sourceTitle = t.title || ''
          curioForm.sourceUrl = t.url || ''
        }
      })
    }
  }
  nextTick(() => {
    if (p === 'search') { searchInput.value?.focus(); runSearch() }
    if (p === 'capture') {
      prefillCapture()
      // R64-F8：默认选中资源台（下拉回显一致）
      if (!capForm.workspaceId) capForm.workspaceId = defaultCaptureWsId()
      if (capSaved.value) return
      capTitleInput.value?.focus(); capTitleInput.value?.select()
    }
    if (p === 'curio') { curioInput.value?.focus() }
    if (p === 'taskcapture') { tcTitleInput.value?.focus() }
  })
}
function closeAll() {
  activePanel.value = null
  convertMenuId.value = null
  capSaved.value = false
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  // B8：焦点返还，关闭浮层后原地继续输入
  lastFocused?.focus?.()
  lastFocused = null
}

/** 已保存状态：按 Enter 打开看板定位新卡（G：走 background 单例定位） */
function openSavedBoard() {
  if (!savedWsId.value || !savedResourceId.value) { closeAll(); return }
  chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: savedWsId.value, hl: savedResourceId.value })
  resetCaptureForm()
  closeAll()
}

function onSavedKeydown(e: KeyboardEvent) {
  if (activePanel.value === 'taskcapture' && tcSaved.value) {
    if (e.key === 'Enter') { e.preventDefault(); tcOpenBoard() }
    else if (e.key === 'Escape') { e.preventDefault(); resetTcForm(); closeAll() }
    return
  }
  if (activePanel.value !== 'capture' || !capSaved.value) return
  if (e.key === 'Enter') { e.preventDefault(); openSavedBoard() }
  else if (e.key === 'Escape') { e.preventDefault(); closeAll() }
}

// 暴露给外部
defineExpose({ openPanel, closeAll, activePanel })
async function getRecentWebTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (active?.url && /^https?:\/\//.test(active.url)) return active
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    if (!tabs.length) return null
    return [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || tabs[0]
  } catch { return null }
}

/** 打开采集弹窗时自动预填最近网页的标题与链接 */
async function prefillCapture() {
  if (capForm.title || capForm.link) return
  const tab = await getRecentWebTab()
  if (tab) {
    capForm.title = tab.title || ''
    capForm.link = tab.url || ''
  }
}

// ===== 全局搜索 =====
// R131-C2：查询词防抖 120ms——输入框 v-model 绑 searchQueryRaw（即时回显），
// 整链 computed（counts/wsTree/filteredResults/archivedMatchCount/热度）只读防抖后的 searchQuery，
// 连续快打不再每键重算全库管线（原实现每击一键全链重跑）。
const searchQueryRaw = ref('')
const searchQuery = ref('')
let qDebounce: ReturnType<typeof setTimeout> | null = null
watch(searchQueryRaw, v => {
  if (qDebounce) clearTimeout(qDebounce)
  qDebounce = setTimeout(() => { qDebounce = null; searchQuery.value = v }, 120)
})
/** 程序化设置查询词（打开复位 / Tab 关键词消费）：raw 与防抖值同步落定，取消在途防抖 */
function setSearchQuery(v: string) {
  if (qDebounce) { clearTimeout(qDebounce); qDebounce = null }
  searchQueryRaw.value = v; searchQuery.value = v
}
onUnmounted(() => { if (qDebounce) clearTimeout(qDebounce) })
// R131-C2：浮层关闭 = 检索管线整体停摆。gp-overlay 恒挂载（opacity 隐藏），
// 模板绑定让整链在面板关闭时仍随全库每次变更重算；此守卫把关闭态的全部重计算压到 O(1)。
const searchActive = computed(() => activePanel.value === 'search')
/**
 * V2.21：拼音字典就绪状态（响应式）。
 * filteredResults 通过读取它建立依赖——字典异步加载完成后，
 * computed 自动重算一次，把拼音/首字母命中补进结果，无需用户重新输入。
 */
const pinyinReady = ref(isPinyinReady())
onPinyinReady(() => { pinyinReady.value = true })
/** B29：类型过滤单一状态源——搜索框 chip 与类型 Tab 行共用，Tab 切换两者同步
 *  R49-G：新增 'ws' 策展台（分类树定位）/ 'proj' 项目（直达项目详情）两类型 */
const currentType = ref<'all'|'res'|'task'|'curio'|'ws'|'proj'>('all')
const selIndex = ref(0)
/**
 * R60-1/2：选中项锚点 = 卡片 id。
 * 原实现以「下标」为锚，而下标会随结果重排漂移（拼音补跑 / 类型过滤 / 分组渲染顺序），
 * 导致「点 A 开 B」。改为 id 锚定后：点击、hover、Enter 三者永不脱钩。
 */
const selectedId = ref('')
/** 由下标反推 id（键盘上下键后调用） */
function syncIdFromIndex() {
  const it = flatList.value[selIndex.value]
  selectedId.value = it && it.kind !== 'qa' ? it.item.id : ''
}
/** 由 id 反推下标（点击 / hover 后调用，保证 Enter 打开的与高亮的是同一条） */
function syncIndexFromId() {
  selectedId.value = selectedId.value || ''
  selIndex.value = flatList.value.findIndex(x => x.kind !== 'qa' && x.item.id === selectedId.value)
}
const convertMenuId = ref<string | null>(null)

function typeLabel(t: 'all'|'res'|'task'|'curio'|'ws'|'proj'): string {
  return t === 'res' ? '📄 资源卡' : t === 'task' ? '✅ 任务卡' : t === 'curio' ? '💡 好奇心' : t === 'ws' ? '🗂 策展台' : t === 'proj' ? '📦 项目' : '🔍 搜全部'
}
const filterLabel = computed(() => typeLabel(currentType.value))

const counts = computed(() => {
  if (!searchActive.value) return { all: 0, res: 0, task: 0, curio: 0, ws: 0, proj: 0 }
  const all = d.value
  return {
    all: all.resources.filter(r=>!r.deletedAt).length + all.tasks.filter(t=>!t.deletedAt).length + all.curiosities.filter(c=>!c.deletedAt).length + all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length,
    res: all.resources.filter(r=>!r.deletedAt).length,
    task: all.tasks.filter(t=>!t.deletedAt).length,
    curio: all.curiosities.filter(c=>!c.deletedAt).length,
    ws: all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length,
    proj: allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).length
  }
})

interface SearchResult {
  id: string
  // 第卅二轮 REQ-008：新增 'ws' 策展台实体命中；R49-G：新增 'proj' 项目实体命中
  type: 'res'|'task'|'curio'|'ws'|'proj'
  iconClass: string
  iconText: string
  title: string
  ws: string
  cat: string
  badges: {type: string, text: string}[]
  link?: {type: string, icon: string, text: string}
  due?: string
  dueOverdue?: boolean
  summary?: string
  /** R110-LC（T3）：已归档卡（默认检索结果集排除，仅用于「另有 N 张」降级提示计数） */
  archived?: boolean
  raw: ResourceCard | TaskCard | CuriosityCard | Workspace
}

const allResults = computed<SearchResult[]>(() => {
  if (!searchActive.value) return []
  const results: SearchResult[] = []
  const all = d.value
  // R131-C2：查表索引一次成型——改前逐卡对全表 find（900 卡 × 200 台/类 ≈ 18 万次比较/轮）
  const wsById = new Map(all.workspaces.map(w => [w.id, w]))
  const catById = new Map(all.categories.map(c => [c.id, c]))
  const projById = new Map<string, { id: string; name: string }>()
  const projDirName = new Map<string, string>()
  for (const dir of all.compass.directions) for (const p of dir.projects) { projById.set(p.id, p); projDirName.set(p.id, dir.name) }
  const wsCardCount = new Map<string, number>()
  for (const r of all.resources) if (!r.deletedAt) wsCardCount.set(r.workspaceId, (wsCardCount.get(r.workspaceId) || 0) + 1)

  // 资源卡
  all.resources.filter(r=>!r.deletedAt).forEach(r => {
    const ws = wsById.get(r.workspaceId)
    const cat = catById.get(r.categoryId)
    const rlink = r.link
    results.push({
      id: r.id, type: 'res', iconClass: 'res', iconText: '📄',
      title: r.title, ws: ws?.name || '未知', cat: cat?.name || '待分类',
      badges: [],
      link: rlink ? { type: r.linkType, icon: r.linkType==='url'?'🔗':r.linkType==='file'?'📁':'📝', text: linkShort(rlink as string) } : undefined,
      summary: r.description,
      archived: !!r.lifecycleArchived,
      raw: r
    })
  })

  // 任务卡
  all.tasks.filter(t=>!t.deletedAt).forEach(t => {
    const proj = projById.get(t.projectId || '')
    const statusIcon = t.status==='done'?'✓':t.status==='doing'?'◐':'○'
    const statusClass = t.status==='done'?'task-done':t.status==='doing'?'task-doing':'task-todo'
    const badges: {type:string,text:string}[] = []
    if (t.priority==='high') badges.push({type:'prio-high', text:'🔴 高'})
    else if (t.priority==='medium') badges.push({type:'prio-mid', text:'🟡 中'})
    badges.push({type:`status-${t.status}`, text: t.status==='done'?'已完成':t.status==='doing'?'进行中':'待开始'})
    results.push({
      id: t.id, type: 'task', iconClass: statusClass, iconText: statusIcon,
      title: t.title, ws: '任务中心', cat: proj?.name || '未归属',
      badges,
      summary: t.description,
      archived: !!t.lifecycleArchived,
      raw: t
    })
  })

  // 好奇心
  all.curiosities.filter(c=>!c.deletedAt).forEach(c => {
    const statusText = c.status==='todo'?'🔵 待探索':c.status==='doing'?'🟡 探索中':c.status==='done'?'🟢 已求证':'⚪ 已搁置'
    results.push({
      id: c.id, type: 'curio', iconClass: 'curio', iconText: '💡',
      title: c.question, ws: '调度台', cat: '好奇心',
      badges: [{type:'curio-status', text: statusText}],
      archived: !!c.lifecycleArchived,
      raw: c
    })
  })

  // 第卅二轮 REQ-008：检索范围扩展至策展台实体（模糊匹配策展台名称，专属图标区分类别）
  // R70：补 CURATION_WS_ID 过滤——R68 修口径时计数（counts）与类型树（wsTree）都排除了资源台本体，
  // 唯独结果集漏了（此处直读 d.value.workspaces，绕过了 store 的 workspaces getter）。
  d.value.workspaces.filter(w => !w.archived && w.id !== CURATION_WS_ID).forEach(w => {
    const cardCount = wsCardCount.get(w.id) || 0
    results.push({
      id: w.id, type: 'ws', iconClass: 'ws', iconText: '🗂',
      title: w.name, ws: '策展台', cat: `${cardCount} 张资源卡`,
      badges: [{ type: 'ws-badge', text: '策展台' }],
      summary: '',
      raw: w
    })
  })

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=；受已完成显隐开关约束）
  allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).forEach(p => {
    const dir = { name: projDirName.get(p.id) || '—' }
    const badges: {type:string,text:string}[] = []
    if (p.isFocused) badges.push({ type: 'prio-high', text: '🚀 主攻' })
    if (p.status === 'archived') badges.push({ type: 'curio-status', text: '已完成' })
    results.push({
      id: p.id, type: 'proj', iconClass: 'ws', iconText: '📦',
      title: p.name, ws: '方向台', cat: dir?.name || '—',
      badges,
      summary: '',
      raw: p as any
    })
  })

  return results
})

/** R49-G4：项目类型受已完成显隐开关约束（与主航线/项目总览/完整方向树共用 UIPrefs） */
const showDoneProjects = computed(() => (store.ui as any)?.showDoneProjects !== false)

/** R49-G2：策展台类型 → 策展台→分类树（含分类卡片数；关键字过滤策展台名/分类名） */
const wsTree = computed(() => {
  if (!searchActive.value) return []
  const q = searchQuery.value.trim().toLowerCase()
  // R131-C2：计数 bucket 一次成型——改前每个分类都全表 filter 一遍资源/子分类（O(台×类×卡)）
  const byWs = new Map<string, number>()
  const byCat = new Map<string, number>()
  const catWsOf = new Map(d.value.categories.map(c => [c.id, c.workspaceId]))
  for (const r of d.value.resources) {
    if (r.deletedAt) continue
    byWs.set(r.workspaceId, (byWs.get(r.workspaceId) || 0) + 1)
    // 与改前判据一致：卡须同时满足「属本台」且「分类在族内」（悬空/跨台脏数据不串计）
    if (r.categoryId && catWsOf.get(r.categoryId) === r.workspaceId) byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + 1)
  }
  const childIds = new Map<string, string[]>()
  for (const c of d.value.categories) if (c.parentId) { const a = childIds.get(c.parentId) || []; a.push(c.id); childIds.set(c.parentId, a) }
  // R68-F1：口径对齐台签栏——排除资源台本体实体（固定 Tab，非台签策展台），历史遗留实体不再混入
  return d.value.workspaces.filter(w => !w.archived && w.id !== CURATION_WS_ID)
    .filter(w => !q || w.name.toLowerCase().includes(q))
    .map(w => {
      const cats = d.value.categories.filter(c => c.workspaceId === w.id)
        .filter(c => !q || c.name.toLowerCase().includes(q))
        .map(c => ({ id: c.id, name: c.name, count: (byCat.get(c.id) || 0) + (childIds.get(c.id) || []).reduce((n, cid) => n + (byCat.get(cid) || 0), 0) }))
      return { id: w.id, name: w.name, cards: byWs.get(w.id) || 0, cats }
    })
})
function wsNameOf(id: string): string {
  return wsDisplayNameOf(d.value.workspaces.find(w => w.id === id))
}
/** R49-G3：点击分类 → 定位策展台该分类（有卡=高亮第一张；无卡=高亮分类行） */
function locateCat(wsId: string, cat: { id: string; name: string }) {
  recordWorkspaceOpen(d.value, d.value.workspaces.find(w => w.id === wsId))
  store.persist()
  closeAll()
  router.push({ path: `/workspace/${wsId}`, query: { cat: cat.id } })
  showToast(`↗ 定位到「${cat.name}」`)
}

/**
 * R117（04-61 F6）：检索归一化 —— 字符级精确匹配不再是唯一判据。
 * 归一化链：NFKC（全角→半角）+ 去零宽/BOM + 小写 + **去空白与常见分隔符**（空格 - _ / \ . · 、 |）。
 * 收益：「db skill」≡「dbskill」≡「DB_Skill」≡「ｄｂｓｋｉｌｌ」等价命中——对应反馈
 * 「关键词一样但中间有空格也要检索出来」。归一化只放宽**召回**，排序仍按命中强度分级。
 */
function normKey(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .toLowerCase()
    .replace(/[\s\-_/\\.,·、|]+/g, '')
}
/** 命中字段拼接（R58-B4 两端同构：搜索面板与网页浮层一致；raw 为原始卡） */
function blobOf(r: SearchResult): string {
  const rawTags = Array.isArray((r.raw as { tags?: string[] })?.tags) ? ((r.raw as { tags?: string[] }).tags as string[]).join(' ') : ''
  return r.title + ' ' + r.ws + ' ' + r.cat + ' ' + (r.summary || '') + ' ' + (r.link?.text || '') + ' ' + rawTags
}
/**
 * R110-LC（T3）：检索命中判据——默认结果集与归档提示计数共用同一实现（两处必须同口径）。
 * R117（04-61 F6）两层判据：
 *   ① 整串归一命中（最强）：「db skill」→ nq="dbskill"，字段归一后含之即命中；
 *   ② 分词 AND 命中（原语义）+ 每词归一兜底 + 拼音（V2.21 懒加载就绪后自动补跑）。
 */
function hitResult(r: SearchResult, parts: string[]): boolean {
  if (!parts.length) return true
  const blob = blobOf(r).toLowerCase()
  const nb = normKey(blob)
  // ① 整串归一：允许用户输入的词间空格/分隔符与数据不一致
  const nq = parts.join('')
  if (nq && nb.includes(nq)) return true
  // ② 分词 AND：每词「原文子串 或 归一子串」命中；中文标题另有拼音通道
  const pinyinOn = pinyinReady.value
  return parts.every(p => blob.includes(p) || (!!normKey(p) && nb.includes(normKey(p))) || (pinyinOn && matchPinyin(r.title, p)))
}
const filteredResults = computed<SearchResult[]>(() => {
  // R110-LC（T3）：归档卡从默认检索结果消失（只在「另有 N 张」提示里报数）
  let list = allResults.value.filter(r => !r.archived)
  if (currentType.value !== 'all') list = list.filter(r => r.type === currentType.value)
  const q = searchQuery.value.trim().toLowerCase()
  const parts = q ? q.split(/\s+/) : []
  if (q) list = list.filter(r => hitResult(r, parts))
  // 第卅三轮 REQ-020：置顶 > 星标 ｜ R58-O1 + R117（F6）：命中强度分级 > 调用热度 > 最近调出
  // R131-C2：hitRank 装饰-排序-去装饰——比较器内不再重复计算（改前 O(n log n) 次 × 每次归一化+拼音匹配）
  const decorated = list.map(r => ({ r, mr: markRank(r.raw as AnyCard), hr: parts.length ? hitRank(r, parts) : 0 }))
  decorated.sort((a, b) => {
    const mr = b.mr - a.mr
    if (mr) return mr
    if (a.hr !== b.hr) return b.hr - a.hr
    const dc = (((b.r.raw as AnyCard).callCount || 0) - ((a.r.raw as AnyCard).callCount || 0))
    if (dc) return dc
    return (((b.r.raw as AnyCard).lastCalledAt || 0) - ((a.r.raw as AnyCard).lastCalledAt || 0))
  })
  return decorated.map(x => x.r)
})
/**
 * R117（04-61 F6）：命中强度分级（只影响排序，不决定是否命中）
 * 2 = 标题整串归一命中（正是用户要找的）· 1 = 标题分词/拼音命中 · 0 = 仅字段/摘要命中
 */
function hitRank(x: SearchResult, parts: string[]): number {
  if (!parts.length) return 0
  const title = x.title.toLowerCase()
  const nt = normKey(x.title)
  const nq = parts.join('')
  if (nq && nt.includes(nq)) return 2
  const pinyinOn = pinyinReady.value
  if (parts.every(p => title.includes(p) || (!!normKey(p) && nt.includes(normKey(p))) || (pinyinOn && matchPinyin(x.title, p)))) return 1
  return 0
}

/**
 * R110-LC（T3）：归档卡命中数——归档卡已从默认结果集排除，这里用**同一命中判据**报「另有 N 张」。
 * 只在有关键词时计数（浏览模式不提示）。
 */
const archivedMatchCount = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return 0
  const parts = q.split(/\s+/)
  let list = allResults.value.filter(r => r.archived)
  if (currentType.value !== 'all') list = list.filter(r => r.type === currentType.value)
  return list.filter(r => hitResult(r, parts)).length
})

// R60-2：换查询词 / 换类型 = 换了条件，选中态重置（必须在下一条 watch 之前注册）
watch([searchQuery, currentType], () => { selectedId.value = '' })
// R60-2：结果集变化（含「拼音字典就绪后补跑命中」）→ 优先锚定回原选中项。
// 原实现无条件 `selIndex = 0`，补跑一发生就把用户当前选中弹回第一条，且顺序已变 → 点 A 开 B。
watch(filteredResults, () => {
  if (selectedId.value) {
    const i = flatList.value.findIndex(x => x.kind !== 'qa' && x.item.id === selectedId.value)
    if (i >= 0) { selIndex.value = i; return }
  }
  // 无锚点或锚点已消失 → 默认选中第一条（需求：默认选中检索结果到第一个）
  selIndex.value = flatList.value.length ? 0 : -1
  syncIdFromIndex()
})

// ---- B1：命令面板升级（分组 / 高亮 / 快捷操作 / 最近打开） ----
const isBrowseMode = computed(() => !searchQuery.value.trim() && currentType.value === 'all')

// ============== R150：AI 检索（自然语言 → 三类卡语义召回，只读）· 沿用 R146-d 实测骨架：流式早停 + 30s 硬超时 + 可取消 + 同词缓存 ==============
// ★本组件被 App.vue 静态挂载（入口 chunk）：AI 依赖只在点击时 dynamic import，绝不静态引 '@/shared/ai/'。
// 键入路径零参与：不发请求、不参与 filteredResults 计算；结果只活内存态，改词即清。
const aiSearch = shallowRef<AiOut | null>(null)
const aiBusy = ref(false)
const aiSecs = ref(0)
const aiChars = ref(0)
const aiTook = ref(0)
const aiScanned = ref(0)
const aiTotal = ref(0)
const aiFound = ref(0)
/** 回执里的耗时：亚秒说毫秒，不把 13ms 报成「1s」 */
function aiDur(ms: number) { return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's' }
/**
 * 契约形状的真源在 shared/ai/select.ts（AiSearchCand / AiSearchHit / AiSearchOut）。
 * 这里刻意不写任何指向 AI 目录的 import（连 import type 都不写）：R138-1 是按字面量钉入口
 * chunk 的，类型导入同样会命中那条守卫——宁可留三行同形声明，也不给启动链开豁免。
 */
type AiCand = { id: string; type: string; title: string; ws: string; cat: string; summary?: string; tags?: string[]; callCount?: number; updatedAt?: number }
type AiHit = { id: string; why: string; confidence: number; weak: boolean }
type AiOut = { hits: AiHit[]; note: string; scanned: number; total: number; dropped: number; batches: number }
let aiAbortCtl: AbortController | null = null
let aiTick: ReturnType<typeof setInterval> | null = null
/** 取消话术：undefined=没取消 · ''=静默取消（改词/关浮层，不打扰用户） · 非空=要点名提示 */
let aiCancelMsg: string | undefined
/** 同词同类型不重复外发（清除后再点秒回）；全库扫是显式慢路径，不进缓存 */
const aiCache = new Map<string, AiOut>()
function aiStopTick() { if (aiTick) { clearInterval(aiTick); aiTick = null } }
function aiAbort(msg: string | null) {
  aiStopTick()
  if (aiAbortCtl) { aiCancelMsg = msg ?? ''; aiAbortCtl.abort(); aiAbortCtl = null }
}
watch(activePanel, (p) => { if (p !== 'search') aiAbort(null) })
/** 候选=库内三类卡（不受字面命中限制，这正是与旧「AI 理解」的分工差别）；跟着类型 tab 收窄，切到「任务卡」就只投任务。
 *  ★只在点击时求值：模板里不引用它——那会让每次键入渲染都重扫一遍全库建候选数组（浮层是热路径）。 */
const aiCands = computed<AiCand[]>(() => {
  const want = currentType.value === 'all' ? null : currentType.value
  if (want === 'ws' || want === 'proj') return [] // 台/项目不参与语义召回（它们不是"卡"）
  const out: AiCand[] = []
  for (const r of allResults.value) {
    if (r.archived) continue
    if (want && r.type !== want) continue
    if (r.type !== 'res' && r.type !== 'task' && r.type !== 'curio') continue
    const raw = r.raw as AnyCard
    out.push({
      id: r.id, type: r.type, title: r.title, ws: r.ws, cat: r.cat, summary: r.summary,
      tags: (raw as { tags?: string[] }).tags, callCount: (raw as { callCount?: number }).callCount, updatedAt: raw.updatedAt,
    })
  }
  return out
})
/** 跑动态一句话：批扫点名"已扫 a/b 张 + 已命中 k"；单次投料没有中间进度，就报库内张数与已回字数（不假装有进度） */
const aiProgress = computed(() => {
  if (!aiBusy.value) return 'AI 检索'
  const mid = aiScanned.value > 0
    ? `已扫 ${aiScanned.value}/${aiTotal.value} 张${aiFound.value ? ` · 已命中 ${aiFound.value}` : ''}`
    : `库内 ${aiTotal.value} 张里挑`
  return `检索中 ${aiSecs.value}s · ${mid}${aiChars.value ? ` · 已回 ${aiChars.value} 字` : ''}`
})
const aiMoreBatches = computed(() => {
  const s = aiSearch.value
  return s ? Math.max(1, Math.ceil(s.total / Math.max(60, s.scanned))) : 1
})
async function aiSearchRun(allScope: boolean) {
  if (aiBusy.value) { aiAbort('已取消 AI 检索（未采用任何结果）'); return }
  if (aiSearch.value && !allScope) { aiSearch.value = null; return }
  const q = searchQuery.value.trim()
  const cands = aiCands.value
  if (!q) { showToast('先写下你要找什么（一句话就行），再点 AI 检索'); return }
  if (cands.length < 2) { showToast('库里还没有可检索的卡（资源/任务/好奇至少 2 条才谈得上挑）'); return }
  const key = `${q}|${currentType.value}|${cands.length}`
  if (!allScope) {
    const cached = aiCache.get(key)
    if (cached) {
      aiSearch.value = cached.hits.length ? cached : null
      showToast(cached.hits.length ? `✓ 秒回（这句刚问过）：AI 挑出 ${cached.hits.length} 条` : 'AI 认为库里没有贴合这句的——换个说法或全库扫')
      return
    }
  }
  aiBusy.value = true; aiSecs.value = 0; aiChars.value = 0; aiCancelMsg = undefined
  aiScanned.value = 0; aiTotal.value = cands.length; aiFound.value = 0
  const ctl = new AbortController(); aiAbortCtl = ctl
  aiTick = setInterval(() => { aiSecs.value++ }, 1000)
  const t0 = Date.now()
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, { semanticSearch, semanticSearchAll }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    const depth = aiConfig.value.depth
    const out = allScope
      ? await semanticSearchAll(q, cands, depth, {
        signal: ctl.signal,
        onDelta: (n) => { aiChars.value = n },
        onProgress: (p) => { aiScanned.value = p.scanned; aiTotal.value = p.total; aiFound.value = p.found },
      })
      : await semanticSearch(q, cands, depth, { signal: ctl.signal, onDelta: (n) => { aiChars.value = n } })
    aiTook.value = Date.now() - t0
    aiScanned.value = out.scanned; aiTotal.value = out.total
    if (allScope) showToast(out.hits.length ? `✓ 全库扫完：${out.batches} 批 / ${out.scanned} 张 · 挑出 ${out.hits.length} 条 · ${aiDur(aiTook.value)}` : `✓ 全库 ${out.scanned} 张都看了，没有真正贴合这句的`)
    else {
      if (aiCache.size >= 12) aiCache.delete(aiCache.keys().next().value as string)
      aiCache.set(key, out)
      aiSearch.value = out.hits.length ? out : null
      showToast(out.hits.length ? `✓ AI 挑出 ${out.hits.length} 条（看了 ${out.scanned}/${out.total} 张）· ${aiDur(aiTook.value)}` : 'AI 认为这批候选里没有贴合的——换个说法，或点「全库分批扫」')
    }
    if (allScope) aiSearch.value = out.hits.length ? out : null
  } catch (e) {
    if (aiCancelMsg !== undefined) { if (aiCancelMsg) showToast(aiCancelMsg); return }
    aiSearch.value = null
    showToast('⚠ AI 检索失败：' + ((e as Error).message || String(e)).slice(0, 80))
  } finally { aiStopTick(); if (aiAbortCtl === ctl) aiAbortCtl = null; aiBusy.value = false }
}
const aiTopRows = computed(() => {
  if (!aiSearch.value) return [] as { hit: AiHit; item: SearchResult }[]
  return aiSearch.value.hits
    .map(hit => ({ hit, item: allResults.value.find(r => r.id === hit.id) }))
    .filter((x): x is { hit: AiHit; item: SearchResult } => !!x.item)
})
watch(searchQuery, () => { aiSearch.value = null; aiAbort('') })
/** 类型 tab 一换，候选集就换了——旧结果留着会指着不相干的卡 */
watch(currentType, () => { aiSearch.value = null; aiAbort('') })

const QUICK_ACTIONS = [
  { label: '打开方向台', icon: 'compass', run: () => { closeAll(); router.push('/compass') } },
  { label: '打开项目详情', icon: 'layout', run: () => { closeAll(); router.push('/compass/projects') } },
  { label: '打开方向树', icon: 'branch', run: () => { closeAll(); router.push('/compass/tree') } },
  { label: '打开设置', icon: 'settings', run: () => { closeAll(); router.push('/settings') } },
  { label: '采集资源卡（Ctrl+Shift+J）', icon: 'download', run: () => openPanel('capture') },
  { label: '采集好奇心（Ctrl+Shift+I）', icon: 'bulb', run: () => openPanel('curio') },
]
// R47-B4：浏览模式热度列表——全类型（资源/任务/好奇/策展台）按调用次数降序，次数并列按最近打开时间
const recentResources = computed<SearchResult[]>(() => {
  const heat = allResults.value.filter(x => !x.archived && (x.raw as AnyCard | Workspace).callCount)
  heat.sort((a, b) => {
    const dc = ((b.raw as any).callCount || 0) - ((a.raw as any).callCount || 0)
    return dc !== 0 ? dc : ((b.raw as any).lastCalledAt || 0) - ((a.raw as any).lastCalledAt || 0)
  })
  return heat.slice(0, 8)
})
/** 浏览模式的扁平列表（快捷操作 + 最近打开） */
type FlatItem = { kind: 'qa'; qa: typeof QUICK_ACTIONS[number] } | { kind: 'res'; item: SearchResult } | { kind: 'result'; item: SearchResult }
const flatList = computed<FlatItem[]>(() => {
  if (!isBrowseMode.value) {
    // R60-1：搜索模式下的展开顺序必须与模板「按类型分组渲染」的顺序完全一致。
    // 原实现直接 map(filteredResults)，而模板按 res/task/curio/ws/proj 分组渲染，
    // 两者顺序不同 → selIndex 指向的条目与用户看到的条目不是同一条（键盘/Enter 错位）。
    const out: FlatItem[] = []
    // R150：AI 检索组渲染在主列表之上，就必须排在 flatList 最前——否则方向键选中的行
    // 与眼睛看到的行差着 AI 那几条（R60-1 同型错位，旧「AI 理解」组就是这么漏的）
    for (const pair of aiTopRows.value) out.push({ kind: 'result' as const, item: pair.item })
    for (const g of groupedResults.value) for (const item of g.items) out.push({ kind: 'result' as const, item })
    return out
  }
  const out: FlatItem[] = []
  QUICK_ACTIONS.forEach(qa => out.push({ kind: 'qa', qa }))
  recentResources.value.forEach(item => out.push({ kind: 'res', item }))
  return out
})
const groupedResults = computed(() => {
  const defs: { type: 'res'|'task'|'curio'|'ws'|'proj'; label: string }[] = [
    { type: 'res', label: '📄 资源卡' }, { type: 'task', label: '✅ 任务卡' }, { type: 'curio', label: '💡 好奇心' },
    { type: 'ws', label: '🗂 策展台' }, { type: 'proj', label: '📦 项目' }
  ]
  // REQ-046 速度优化：每组最多渲染 30 条，防超大结果集首屏卡顿
  const MAX_PER_GROUP = 30
  let offset = 0
  const out: { label: string; items: SearchResult[]; offset: number; total: number }[] = []
  for (const d0 of defs) {
    const all = filteredResults.value.filter(r => r.type === d0.type)
    if (all.length) { out.push({ label: d0.label, items: all.slice(0, MAX_PER_GROUP), offset, total: all.length }); offset += all.length }
  }
  return out
})
function escapeHtmlTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function hlTitle(title: string): string {
  const q = searchQuery.value.trim()
  if (!q) return escapeHtmlTitle(title)
  // R70：先在**原始标题**上定位，再对切片分别转义。
  // 此前是「先整体转义、再按原始查询长度切分」——转义会把 & 变成 &amp;（长度变化），
  // 于是标题 AT&T 搜 & 时切片落到实体中间，渲染出 AT&amp;T（用户看到字面量）。
  const i = title.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return escapeHtmlTitle(title)
  return escapeHtmlTitle(title.slice(0, i))
    + '<mark class="gp-hl">' + escapeHtmlTitle(title.slice(i, i + q.length)) + '</mark>'
    + escapeHtmlTitle(title.slice(i + q.length))
}
function runFlat(index: number) {
  // R120 键位统一：单击 / Enter —— 打开卡片链接（无链接则定位到卡片所在处）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'qa') { it.qa.run(); return }
  openLinkOrLocate(it.item)
}

function runFlatLocator(index: number) {
  // R120 键位统一：Ctrl+Enter —— **仅定位到卡片所在处**（不再打开详情抽屉）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'qa') { it.qa.run(); return }
  locateOnly(it.item)
}

/** R120 键位统一：单击 / Enter —— 打开卡片链接优先；无链接/不可打开则定位到卡片所在处 */
function openLinkOrLocate(item: SearchResult) {
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    if (toOpenableUrl(r.linkType, r.link)) { openResLink(item); return }
    openItem(item)
    return
  }
  // task / curio / proj / ws：无"外链"概念，走既有打开语义
  // （ws 打开策展台、proj 打开项目详情、task/curio 定位到卡片所在处）
  openItem(item)
}

/** R120 键位统一：Ctrl+Enter —— 仅定位到卡片所在处（资源卡带所在分类；不开详情抽屉） */
function locateOnly(item: SearchResult) {
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    const query: Record<string, string> = { hl: item.id, hk: 'res' }
    if (r.categoryId) query.cat = r.categoryId
    router.push({ path: `/workspace/${r.workspaceId}`, query })
    closeAll()
    showToast('🎯 已定位到卡片所在处')
    return
  }
  if (item.type === 'task') {
    router.push({ path: '/', query: { hl: item.id, hk: 'task' } })
    closeAll()
    showToast('🎯 已定位到任务卡片')
    return
  }
  if (item.type === 'curio') {
    router.push({ path: '/', query: { hl: item.id, hk: 'curio' } })
    closeAll()
    showToast('🎯 已定位到好奇心卡片')
    return
  }
  // ws / proj：打开目标页即视为"定位到所在处"
  openItem(item)
}

function runSearch() { /* reactive, no-op */ }
function setType(t: 'all'|'res'|'task'|'curio'|'ws'|'proj') { currentType.value = t }
function clearFilter() { currentType.value = 'all' }

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); selIndex.value = Math.min(selIndex.value+1, flatList.value.length-1); syncIdFromIndex(); scrollToSelected() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selIndex.value = Math.max(selIndex.value-1, 0); syncIdFromIndex(); scrollToSelected() }
  else if (e.key === 'Enter') {
    e.preventDefault()
    if (selIndex.value < 0 || selIndex.value >= flatList.value.length) return
    // R120 键位统一：Enter = 打开卡片链接（无链接则定位）；Ctrl+Enter = 仅定位到卡片所在处
    if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)
    else runFlat(selIndex.value)
  }
  else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；chip 与类型 Tab 行高亮同步更新
    e.preventDefault()
    const q = searchQueryRaw.value.trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['策展台', 'ws'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
    if (kw) { currentType.value = kw[1]; setSearchQuery('') }
    else {
      const cycle: Array<'all'|'res'|'task'|'curio'|'ws'|'proj'> = ['all', 'res', 'task', 'curio', 'ws', 'proj']
      currentType.value = cycle[(cycle.indexOf(currentType.value) + 1) % cycle.length]
    }
    selIndex.value = 0
    showToast('🔍 ' + typeLabel(currentType.value))
  }
  else if (e.key === 'Escape') { closeAll() }
}

function scrollToSelected() {
  nextTick(() => {
    const el = resultsEl.value?.querySelector('.gp-result-item.selected') as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  })
}

/**
 * R60-1：点击搜索结果 —— 直接以「结果对象」为准，彻底绕开下标。
 * 原实现 `openItem(filteredResults.value[i])`，模板传入的 i = grp.offset+j，
 * 而 offset 是按类型分组累计的，与排序后的混合列表下标并不对应 → 点 A 开 B。
 * R120 键位统一：单击 = 打开卡片链接（无链接则定位）；双击不单独定义（300ms 去重保证不双开）。
 */
function pickRow(item: SearchResult) {
  selectedId.value = item.id
  syncIndexFromId()
  openLinkOrLocate(item)
}
/** R60-1：hover 只改高亮不开卡，同样以 id 为准（保证 Enter 打开的与高亮的是同一条） */
function selectHover(item: SearchResult) {
  if (selectedId.value === item.id && selIndex.value >= 0) return
  selectedId.value = item.id
  syncIndexFromId()
}

// 第卅七轮 REQ-045：300ms 同项去重——单击/双击都走 openItem，避免双击双开
let lastOpenId = ''
let lastOpenTs = 0
function openItem(item: SearchResult) {
  const now = Date.now()
  if (item?.id && item.id === lastOpenId && now - lastOpenTs < 300) return
  if (item?.id) { lastOpenId = item.id; lastOpenTs = now }
  if (item.type === 'ws') {
    // 第卅二轮 REQ-008：策展台条目 → 直接打开对应策展台
    recordWorkspaceOpen(d.value, d.value.workspaces.find(w => w.id === item.id))
    store.persist()
    router.push(`/workspace/${item.id}`)
    closeAll()
    return
  }
  if (item.type === 'proj') {
    // R49-G：项目条目 → 直达项目详情（二级页）
    router.push({ path: '/compass/projects', query: { p: item.id } })
    closeAll()
    showToast('↗ 已打开项目详情')
    return
  }
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    // R117（04-61 B · 拍板反转）：单击 = **定位到该卡在资源台的位置并高亮**。
    // 旧行为「有链接直接外开浏览器」与「先定位到卡片所在处」的诉求相反，已废——
    // 外开降级为行内「↗ 打开链接」按钮（openResLink）与 Ctrl+Enter 定位后开详情。
    const openable = !!toOpenableUrl(r.linkType, r.link)
    router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: r.id, hk: 'res' } })
    if (!openable && r.link) showToast('⚠ 本地文件缺少完整路径，已定位到卡片')
    else showToast('↗ 已定位到卡片所在资源台')
  } else if (item.type === 'task') {
    recordCardOpen(d.value, d.value.tasks.find(t => t.id === item.id))
    store.persistHot()
    // R117（04-61 B）：hk 显式分派——调度台同时挂着任务卡与好奇心卡两个 hl 消费者
    router.push({ path: '/', query: { hl: item.id, hk: 'task' } })
    showToast('↗ 已定位到任务卡片')
  } else {
    recordCardOpen(d.value, d.value.curiosities.find(c => c.id === item.id))
    store.persistHot()
    router.push({ path: '/', query: { hl: item.id, hk: 'curio' } })
    showToast('↗ 已定位到好奇心卡片')
  }
  closeAll()
}

/**
 * R117（04-61 B）：搜索结果行内「↗ 打开链接」——把旧默认行为（外开）显式化为按钮。
 * 无链接/链接不可打开时降级为定位（等价单击）。
 */
function openResLink(item: SearchResult) {
  const r = item.raw as ResourceCard
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { openItem(item); return }
  recordResourceOpen(d.value, r)
  store.persistHot()
  openExternalLink(url)
  closeAll()
}

function editItem(item: SearchResult) {
  showToast('✏️ 编辑功能（开发中）')
}

/** 第卅三轮 REQ-019/020：搜索结果行星标切换（点亮持久化，置顶>星标>命中度） */
function isStarred(item: SearchResult): boolean {
  return !!(item.raw as AnyCard).starred
}
function toggleStar(item: SearchResult) {
  const card = item.raw as AnyCard
  card.starred = !card.starred
  card.updatedAt = Date.now()
  store.persist()
  showToast(card.starred ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
}

async function deleteItem(item: SearchResult) {
  // R55-H1：检索结果删除免二次确认（软删，可撤销 / 回收站恢复）
  // R146（回退契约）：① 任务改走 softDeleteTaskToTrash——原裸赋值 deletedAt 不摘 metric.taskIds，
  //   破坏 R141 的双向不变量；② 回执点名 + 给撤销（原只有一句"可在回收站恢复"，既不知删了哪张，
  //   也没有回收站的路）。
  const raw = item.raw as ResourceCard | TaskCard | CuriosityCard
  const name = ('title' in raw ? (raw as ResourceCard).title : (raw as CuriosityCard).question) || '未命名'
  if (item.type === 'task') softDeleteTaskToTrash(store.data!, raw as TaskCard)
  else raw.deletedAt = Date.now()
  store.persist()
  showToast(`已删除「${name.slice(0, 16)}」· 回收站可恢复`, { label: '撤销', cb: () => {
    if (!raw.deletedAt) return
    raw.deletedAt = undefined
    if (item.type === 'task') {
      const t = raw as TaskCard
      if (t.metricId) for (const dir of store.data!.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
        if (m.id === t.metricId && !m.taskIds.includes(t.id)) m.taskIds.push(t.id)
    }
    store.persist()
    showToast('✓ 已撤销删除')
  } })
}

function toggleConvertMenu(id: string) {
  convertMenuId.value = convertMenuId.value === id ? null : id
}

function convertCurio(item: SearchResult, target: 'res'|'task') {
  const c = item.raw as CuriosityCard
  if (target === 'res') {
    const r: ResourceCard = {
      id: uid('res'), kind: 'resource', title: c.question, linkType: 'url', link: '',
      workspaceId: d.value.workspaces[0]?.id || '', categoryId: '', description: '',
      tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
    }
    d.value.resources.unshift(r)
    c.deletedAt = Date.now()
    store.persist()
    showToast('✓ 已转化为资源卡，存入待分类', { label: '查看', cb: () => {
      if (r.workspaceId) router.push(`/workspace/${r.workspaceId}`)
    } })
  } else {
    const t: TaskCard = {
      id: uid('tk'), kind: 'task', title: c.question, status: 'todo', priority: 'medium',
      projectId: '', metricId: '', description: '', mountedResourceIds: [], mountedCuriosityIds: [],
      customFields: {}, createdAt: Date.now(), updatedAt: Date.now()
    }
    d.value.tasks.unshift(t)
    c.deletedAt = Date.now()
    store.persist()
    showToast('✓ 已转化为任务，前往任务调度', { label: '查看', cb: () => router.push('/') })
  }
  closeAll()
}

// ===== B3：快捷键速查数据 =====
const SHORTCUT_GROUPS = [
  { title: '全局（任意网页）', items: [
    { keys: 'Ctrl+Shift+J', desc: '快速采集当前网页' },
    { keys: 'Ctrl+Shift+I', desc: '采集好奇心（选中文字可附带来源）' },
    { keys: 'Ctrl+K', desc: '全局搜索' },
    { keys: 'Ctrl+Shift+K', desc: '打开调度台' },
  ]},
  { title: '应用内', items: [
    { keys: 'Alt+1', desc: '调度台（修饰键可自定义）' },
    { keys: 'Alt+2', desc: '方向台' },
    { keys: 'Alt+3', desc: '资源台' },
    { keys: 'Alt+4…9', desc: '各策展台（按台签顺序）' },
    { keys: '?', desc: '呼出本速查' },
  ]},
  { title: '编辑与导航', items: [
    { keys: 'Ctrl+Enter', desc: '保存并关闭（所有弹窗/抽屉）' },
    { keys: 'Esc', desc: '逐层关闭（浮层→抽屉→展板）' },
    { keys: 'Tab', desc: '搜索内循环切换类型' },
    { keys: '↑↓ / Enter', desc: '搜索结果选择 / 打开链接' },
    { keys: 'Ctrl+Enter（搜索内）', desc: '定位到卡片所在处' },
    { keys: '双击', desc: '打开卡片链接（三卡一致）' },
    { keys: '右键', desc: '卡片上下文菜单' },
  ]},
]

// ===== 采集资源卡 =====
const capForm = reactive({
  title: '', linkType: 'url' as 'url'|'file'|'obsidian', link: '', description: '',
  workspaceId: '', categoryId: ''
})
/** 保存后的「已保存」状态：Enter=打开看板，Esc=关闭，5 秒无操作自动消失 */
const capSaved = ref(false)
const savedResourceId = ref('')
const savedWsId = ref('')
let savedTimer: ReturnType<typeof setTimeout> | null = null

const userWorkspaces = computed(() => d.value.workspaces.filter(w => !w.archived))
/** R64-F8：采集默认落资源台（未被删即资源台，否则回退第一个台） */
function defaultCaptureWsId(): string {
  const hub = d.value.workspaces.find(w => w.id === CURATION_WS_ID && !w.archived)
  return hub?.id || userWorkspaces.value[0]?.id || ''
}
// R117（04-61 A）：分类口径统一——过滤软删（原实现漏 deletedAt，软删分类成为下拉「幽灵项」）
// 且与资源台同视觉（buildCatOptions 层级缩进 label）
const capCategories = computed(() => buildCatOptions(d.value.categories.filter(c => c.workspaceId === capForm.workspaceId)))

// ===== R55-C：快速采集任务（四字段全非必填，直存全域任务；未挂项目=未归档） =====
const tcForm = reactive({ title: '', description: '', projectId: '', metricId: '' })
const tcSaved = ref(false)
let tcSavedTimer: ReturnType<typeof setTimeout> | null = null
const tcProjects = computed(() => d.value.compass.directions.flatMap(dir => dir.projects).filter(p => showDoneProjects.value || !isProjectDone(p)))
const tcMetrics = computed(() => tcProjects.value.find(p => p.id === tcForm.projectId)?.metrics || [])
watch(() => tcForm.projectId, () => { tcForm.metricId = '' })
function saveTaskCapture() {
  const now = Date.now()
  const task = {
    id: uid('tk'), kind: 'task' as const,
    title: tcForm.title.trim() || '快速任务',
    description: tcForm.description.trim(),
    status: 'todo' as const, priority: 'medium' as const,
    projectId: tcForm.projectId || undefined,
    metricId: tcForm.metricId || undefined,
    mountedResourceIds: [] as string[], mountedCuriosityIds: [] as string[],
    customFields: {}, tags: [] as string[], pinned: false,
    createdAt: now, updatedAt: now
  }
  d.value.tasks.unshift(task)
  if (task.metricId) {
    for (const dir of d.value.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
      if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
  }
  store.persist()
  tcSaved.value = true
  if (tcSavedTimer) clearTimeout(tcSavedTimer)
  tcSavedTimer = setTimeout(() => { closeAll(); tcSaved.value = false }, 5000)
}
function tcOpenBoard() {
  resetTcForm()
  closeAll()
  // R117（04-61 C1）：任务调度面板已迁调度台底部 tab ⇒ 改走 ?bottom=task（原 /compass?zone=task 失效）
  router.push({ path: '/', query: { bottom: 'task' } })
}
function resetTcForm() {
  tcForm.title = ''; tcForm.description = ''; tcForm.projectId = ''; tcForm.metricId = ''
  if (tcSavedTimer) { clearTimeout(tcSavedTimer); tcSavedTimer = null }
  tcSaved.value = false
}

const capLinkPlaceholder = computed(() => {
  if (capForm.linkType === 'url') return 'https://…'
  if (capForm.linkType === 'file') return 'D:\\path\\to\\file.pdf'
  return 'obsidian://open?vault=…'
})

watch(() => capForm.workspaceId, () => { capForm.categoryId = '' })

function resetCaptureForm() {
  capForm.title = ''; capForm.link = ''; capForm.description = ''; capForm.categoryId = ''
  savedResourceId.value = ''
  savedWsId.value = ''
}

async function saveCapture() {
  if (!capForm.title.trim()) { showToast('请输入标题'); return }
  // B5 去重：相同归一化链接 → 只能跳转，不新建副本
  if (capForm.linkType === 'url' && capForm.link.trim()) {
    const fp = normalizeUrl(capForm.link.trim())
    const dup = d.value.resources.find(r => !r.deletedAt && r.linkType === 'url' && r.link && normalizeUrl(r.link) === fp)
    if (dup) {
      if (!(await useConfirm({ title: '重复采集', message: `该页面已收录为「${dup.title.slice(0, 40)}」。\n点击确认将定位到已有卡片。`, confirmText: '定位到卡片' }))) { return }
      chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
      resetCaptureForm()
      closeAll()
      return
    }
  }
  const r: ResourceCard = {
    id: uid('res'), kind: 'resource', title: capForm.title.trim(),
    linkType: capForm.linkType, link: capForm.link.trim(),
    workspaceId: capForm.workspaceId || defaultCaptureWsId(),
    categoryId: capForm.categoryId, description: capForm.description.trim(),
    tags: [], customFields: {}, pinned: false, callCount: 0,
    createdAt: Date.now(), updatedAt: Date.now()
  }
  d.value.resources.unshift(r)
  store.persist()
  // 进入「已保存」状态条：Enter=打开看板·定位新卡，Esc=关闭，5 秒自动消失
  savedResourceId.value = r.id
  savedWsId.value = r.workspaceId
  capSaved.value = true
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { resetCaptureForm(); closeAll() }, 5000)
  // R138-H1′：勾选「保存后补全」→ 自动拉起 AI 评审抽屉（采纳才写库；不勾不拦保存主流程）
  if (capEnrichOn.value) void runCardEnrich(r)
}

// R138-H1′：采集后补全——AiSuggestionDrawer/ai 栈全懒（GP 在启动 chunk，静态引会把 AI 卷进首屏）
const AiDrawerGP = defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))
const aiEnrichJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const capEnrichOn = ref(false)
const capEnrichReady = ref(false)
let lastEnrichCard: ResourceCard | null = null
async function runCardEnrich(card: ResourceCard) {
  lastEnrichCard = card
  capEnrichReady.value = false
  const [{ loadAiConfig, aiReady, aiConfig }, { buildCardEnrichJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('AI 尚未接入（设置 → AI 助手），卡已正常保存'); return }
  aiEnrichJob.value = buildCardEnrichJob(card, { d: d.value, depth: aiConfig.value.depth, persist: () => store.persist() })
  capEnrichReady.value = true
}
async function aiReopenEnrich() { if (lastEnrichCard) await runCardEnrich(lastEnrichCard) }
async function capEnrichSave(e: Event) {
  const on = (e.target as HTMLInputElement).checked
  capEnrichOn.value = on
  const m = await import('@/shared/ai/config')
  m.patchAiConfig({ captureEnrich: on })
}

// ===== 采集好奇心 =====
const curioForm = reactive({ text: '', sourceTitle: '', sourceUrl: '' })

function saveCurio() {
  if (!curioForm.text.trim()) { showToast('请输入内容'); return }
  const c: CuriosityCard = {
    id: uid('cur'), kind: 'curiosity', question: curioForm.text.trim(),
    sourceUrl: curioForm.sourceUrl || undefined, sourceTitle: curioForm.sourceTitle || undefined,
    status: 'todo', pinned: false, relatedResourceIds: [], customFields: {},
    createdAt: Date.now(), updatedAt: Date.now()
  }
  d.value.curiosities.unshift(c)
  store.persist()
  curioForm.text = ''
  closeAll()
  showToast('💗好奇心+1')
}

// ===== 工具函数 =====
function linkShort(link: string) {
  if (link.startsWith('http')) return link.replace(/^https?:\/\//,'').substring(0,30)
  if (link.startsWith('obsidian')) return 'Obsidian笔记'
  const parts = link.split(/[\\/]/)
  return parts[parts.length-1].substring(0,25)
}

/** R49-G：跨方向扁平项目列表（复用 useCompass 口径，避免多处手写双循环漂移） */
function allProjects() {
  return d.value.compass.directions.flatMap(dir => dir.projects)
}
/** R52-BUG-2：项目完成口径与 useCompass.isProjectDone 一致（手动 done/archived 或全任务完成派生） */
function isProjectDone(p: { status: string; id: string }): boolean {
  if (p.status === 'done' || p.status === 'archived') return true
  const ts = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
  return ts.length > 0 && ts.every(t => t.status === 'done')
}

// 快捷键由 App.vue 统一管理，通过 openPanel/closeAll 暴露方法
// 「已保存」状态下捕获 Enter / Esc
onMounted(() => window.addEventListener('keydown', onSavedKeydown, true))
onUnmounted(() => window.removeEventListener('keydown', onSavedKeydown, true))
</script>

<style scoped>
/* 遮罩 */
.gp-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; opacity: 0; pointer-events: none; transition: opacity .22s ease;
  background: var(--overlay-bg); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); }
.gp-overlay.open { opacity: 1; pointer-events: auto; }
/* B12：采集小窗贴近插件图标（右上角，对标浏览器插件弹窗） */
.gp-overlay.corner { align-items: flex-start; justify-content: flex-end; padding: 10px 10px 14px; }
.gp-overlay.corner .gp-panel { width: 400px; max-height: min(600px, calc(100vh - 72px)); overflow-y: auto; }

/* 面板通用 */
.gp-panel { position: relative; width: 680px; max-width: 92vw; background: var(--surface); border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  transform: translateY(-12px) scale(.98); opacity: 0; transition: all var(--dur) cubic-bezier(.16,1,.3,1); overflow: hidden; }
.gp-overlay.open .gp-panel { transform: translateY(0) scale(1); opacity: 1; }

.gp-panel-narrow { width: 400px; max-height: 600px; overflow-y: auto; }
.gp-panel-curio { width: 640px; }
.gp-panel-shortcuts { width: 560px; }
.gp-sc-body { padding: 14px 24px 20px; max-height: 60vh; overflow-y: auto; }
.gp-sc-group { margin-bottom: 16px; }
.gp-sc-group:last-child { margin-bottom: 0; }
.gp-sc-title { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
.gp-sc-row { display: flex; align-items: center; gap: 12px; padding: 5px 0; font-size: 12.5px; color: var(--text-2); }
.gp-sc-keys { min-width: 150px; display: flex; gap: 4px; flex-shrink: 0; }
.gp-sc-keys kbd { background: var(--surface-3); border: 1px solid var(--border); border-radius: 5px; padding: 1px 7px; font-size: 11px; color: var(--text); font-family: inherit; box-shadow: 0 1px 0 var(--border); }
.gp-cap-desc { min-height: 64px; }

/* 已保存状态条 */
.gp-saved { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 52px 24px 44px; text-align: center; }
.gp-saved-icon { width: 52px; height: 52px; border-radius: 50%; background: var(--tag-ok-bg); color: var(--tag-ok-text); font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; animation: gp-pop .35s cubic-bezier(.34,1.56,.64,1); }
@keyframes gp-pop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.gp-saved-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.gp-saved-hint { font-size: 13px; color: var(--accent); font-weight: 600; }
.gp-saved-hint kbd, .gp-saved-sub kbd { background: var(--surface-3); border: 1px solid var(--border); border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: 11px; color: var(--text-2); }
.gp-saved-sub { font-size: 11.5px; color: var(--text-3); margin-top: 4px; }
.gp-saved-actions { display: flex; gap: 10px; margin-top: 20px; }

/* 搜索头部 */
.gp-search-head { display: flex; align-items: center; gap: 12px; padding: 18px 22px 0; }
.gp-search-icon { width: 22px; height: 22px; color: var(--text-3); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.gp-search-input-wrap { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.gp-search-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px;
  background: var(--accent-light); color: var(--accent); font-size: 12.5px; font-weight: 600; flex-shrink: 0;
  animation: gp-chipIn .2s ease; }
.gp-chip-x { width: 15px; height: 15px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: .6; transition: all var(--dur-fast); font-size: 11px; }
.gp-chip-x:hover { opacity: 1; background: color-mix(in srgb, var(--accent) 15%, transparent); }
@keyframes gp-chipIn { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
.gp-search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 17px; font-weight: 500;
  color: var(--text); font-family: inherit; min-width: 0; line-height: 1.4; }
.gp-search-input::placeholder { color: var(--text-4); font-weight: 400; }
/* R150：AI 检索的消毒账 / 全库兜底钮 / 低置信徽标 */
.gp-ai-drop { font-size: 10.5px; color: var(--warning); }
.gp-ai-more { padding: 1px 7px; font-size: 10.5px; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-2); cursor: pointer; }
.gp-ai-more:hover { border-color: var(--accent); color: var(--accent); }
.gp-ai-more:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.gp-ri-badge.weak { background: var(--warning-bg-soft); color: var(--warning); }
/* R136-1d 起、R150 改名：检索类 AI 钮与置顶组 · R146-d：跑动中点名可取消，秒数等宽不抖 */
.gp-ai-tab { margin-left: auto; color: var(--text-2); font-variant-numeric: tabular-nums; }
.gp-ai-tab.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.gp-ai-tab.busy { color: var(--accent); cursor: pointer; }
.gp-ai-title { color: var(--accent); display: flex; align-items: center; gap: 6px; }
.gp-ai-fed { font-weight: 400; font-size: 10.5px; color: var(--text-4); }
.gp-ai-note { margin-left: 8px; font-weight: 400; color: var(--text-3); }
.gp-ai-why { font-size: 11px; color: var(--accent); background: var(--accent-light); border-radius: var(--radius-xs); padding: 1px 6px; }
.gp-ai-row { border-left: 2px solid var(--accent); }
.gp-search-esc { font-size: 11px; color: var(--text-4); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; padding: 3px 8px; flex-shrink: 0; cursor: pointer; transition: all var(--dur-fast); font-family: inherit; }
.gp-search-esc:hover { color: var(--text-2); border-color: var(--border-strong); }

/* 类型Tab · R146-d：去 emoji 图标 + tab 内锁 nowrap——窄窗宁可整枚换到第二行，也不把「搜全部」劈成两截 */
.gp-type-tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 12px 22px 8px; }
.gp-type-tab { padding: 5px 12px; border-radius: 8px; font-size: 12.5px; color: var(--text-3); cursor: pointer;
  transition: all var(--dur-fast); display: flex; align-items: center; gap: 5px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.gp-type-tab:hover { color: var(--text-2); background: var(--surface-2); }
.gp-type-tab.active { color: var(--accent); background: var(--accent-light); font-weight: 600; }
.gp-tt-count { font-size: 10.5px; color: var(--text-4); font-weight: 500; }
.gp-type-tab.active .gp-tt-count { color: var(--accent); opacity: .7; }

/* B1：分组标题与关键词高亮 */
.gp-group-title { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .08em; padding: 10px 12px 4px; display: flex; align-items: center; gap: 6px; }
.gp-group-cnt { font-weight: 500; color: var(--text-4); }
.gp-group-more { font-size: 11px; color: var(--text-4); padding: 6px 12px; border-top: 1px dashed var(--border); }
.gp-ri-title :deep(mark.gp-hl), .gp-ri-summary :deep(mark.gp-hl) { background: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--text); border-radius: 3px; padding: 0 1px; }

/* 结果区 */
.gp-results { max-height: 48vh; overflow-y: auto; padding: 4px 12px 8px; }
.gp-results::-webkit-scrollbar { width: 6px; }
.gp-results::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
.gp-result-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer;
  border-left: 3px solid transparent; transition: background .1s, border-color .1s; position: relative; margin-bottom: 2px;
  animation: gp-itemIn var(--dur-slow) cubic-bezier(.16,1,.3,1) backwards; }
.gp-result-item:nth-child(1) { animation-delay: .03s; }
.gp-result-item:nth-child(2) { animation-delay: .06s; }
.gp-result-item:nth-child(3) { animation-delay: .09s; }
@keyframes gp-itemIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.gp-result-item:hover, .gp-result-item.selected {
  background: var(--accent-light);
  border-left-color: var(--accent); }
.gp-result-item.selected { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent); }
.gp-ri-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0; }
.gp-ri-icon.res { background: var(--tag-info-bg); }
.gp-ri-icon.task-done { background: var(--tag-ok-bg); }
.gp-ri-icon.task-doing { background: var(--tag-warn-bg); }
.gp-ri-icon.task-todo { background: var(--tag-neutral-bg); }
.gp-ri-icon.curio { background: var(--curio-bg); }
.gp-ri-icon.ws { background: var(--accent-light); }
.gp-ri-badge.ws-badge { background: var(--accent-light); color: var(--accent); }
.gp-ri-main { flex: 1; min-width: 0; }
/* R47-B4：浏览态热度条目的归属小字 */
.gp-ri-cat { font-size: 11px; color: var(--text-3); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-ri-title { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; line-height: 1.4; }
.gp-ri-meta { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; align-items: center; }
.gp-ri-badge { font-size: 10.5px; padding: 1.5px 8px; border-radius: 99px; font-weight: 500; line-height: 1.5; }
.gp-ri-badge.ws { background: var(--accent-light); color: var(--accent); }
.gp-ri-badge.cat { background: var(--surface-3); color: var(--text-2); }
.gp-ri-badge.prio-high { background: var(--tag-danger-bg); color: var(--tag-danger-text); }
.gp-ri-badge.prio-mid { background: var(--tag-warn-bg); color: var(--curio-amber); }
.gp-ri-badge.status-todo { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.gp-ri-badge.status-doing { background: var(--tag-warn-bg); color: var(--curio-amber); }
.gp-ri-badge.status-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.gp-ri-badge.curio-status { background: var(--surface-3); color: var(--text-2); }
.gp-ri-link { font-size: 11px; color: var(--text-3); display: flex; align-items: center; gap: 3px; white-space: nowrap; }
.gp-ri-link.url { color: var(--accent); }
.gp-ri-link.file { color: var(--curio-amber); }
.gp-ri-link.obsidian { color: var(--violet); }
.gp-ri-due { font-size: 10.5px; color: var(--text-3); }
.gp-ri-due.overdue { color: var(--tag-danger-text); font-weight: 600; }
.gp-ri-summary { font-size: 11.5px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 操作按钮 */
.gp-ri-actions { display: flex; gap: 3px; flex-shrink: 0; opacity: 0; transition: opacity var(--dur); }
.gp-result-item:hover .gp-ri-actions, .gp-result-item.selected .gp-ri-actions { opacity: 1; }
.gp-ri-act { width: 28px; height: 28px; border-radius: 8px; border: 1px solid transparent; background: transparent;
  display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; color: var(--text-3);
  transition: all var(--dur-fast); font-family: inherit; padding: 0; position: relative; }
.gp-ri-act:hover { background: var(--surface); border-color: var(--border); color: var(--text); }
.gp-ri-act.go { background: var(--accent); color: #fff; border-color: var(--accent); }
.gp-ri-act.go:hover { background: var(--accent-hover); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 14%, transparent); }
.gp-ri-act.del:hover { background: var(--tag-danger-bg); border-color: var(--tag-danger-bg); color: var(--tag-danger-text); }
/* 第卅三轮 REQ-019/020：搜索结果星标高亮 */
.gp-ri-act.on { background: color-mix(in srgb, #f5b942 16%, transparent); border-color: color-mix(in srgb, #f5b942 40%, transparent); color: #d99a1e; }
.gp-convert-menu { position: absolute; bottom: calc(100% + 6px); right: 0; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: 0 8px 28px rgba(0,0,0,.12); padding: 5px;
  min-width: 150px; display: none; z-index: 10; }
.gp-convert-menu.open { display: block; }
.gp-convert-menu-item { padding: 7px 10px; border-radius: 6px; font-size: 12px; color: var(--text-2); cursor: pointer;
  display: flex; align-items: center; gap: 8px; white-space: nowrap; transition: all .1s; }
.gp-convert-menu-item:hover { background: var(--accent-light); color: var(--accent); }

/* 空状态 */
.gp-search-empty { padding: 40px 20px; text-align: center; color: var(--text-3); }
/* R110-LC（T3）：归档卡降级提示（搜索结果流顶部一行） */
.gp-archived-hint { margin: 6px 0 2px; padding: 6px 10px; border: 1px dashed var(--border-strong); border-radius: 7px; font-size: 11px; color: var(--text-3); }
.gp-se-icon { font-size: 32px; margin-bottom: 8px; opacity: .4; }
.gp-se-text { font-size: 13px; line-height: 1.7; }
.gp-se-text b { color: var(--text-2); font-weight: 600; }

/* 底部栏 */
.gp-panel-foot { display: flex; align-items: center; gap: 16px; padding: 10px 22px; border-top: 1px solid var(--border);
  background: var(--surface-2); font-size: 11px; color: var(--text-4); }
.gp-panel-foot kbd { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px;
  font-family: inherit; font-size: 10.5px; color: var(--text-2); margin: 0 2px; box-shadow: 0 1px 0 var(--border); }
.gp-foot-brand { margin-left: auto; font-size: 10.5px; color: var(--text-4); opacity: .7; letter-spacing: .3px; }

/* 采集弹窗通用 */
.gp-cap-head { padding: 22px 24px 0; display: flex; align-items: flex-start; gap: 12px; }
.gp-cap-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  font-size: 19px; flex-shrink: 0; }
.gp-cap-icon.res { background: var(--accent-light); }
.gp-cap-icon.curio { background: var(--curio-bg); }
.gp-cap-titles { flex: 1; min-width: 0; }
.gp-cap-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -.2px; }
.gp-cap-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
.gp-cap-close { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-3); font-size: 18px; transition: all var(--dur-fast); flex-shrink: 0; background: transparent;
  border: none; font-family: inherit; }
.gp-cap-close:hover { background: var(--surface-3); color: var(--text); }

.gp-cap-body { padding: 18px 24px 20px; }
.gp-field { margin-bottom: 14px; }
.gp-field:last-child { margin-bottom: 0; }
.gp-field-label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text-3); margin-bottom: 6px; letter-spacing: .2px; }
.gp-field-input { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 13.5px;
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; transition: all var(--dur); line-height: 1.5; }
.gp-field-input::placeholder { color: var(--text-4); }
.gp-field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }
textarea.gp-field-input { resize: vertical; min-height: 90px; font-size: 14px; line-height: 1.65; }
.gp-curio-text { min-height: 120px; }
.gp-curio-src { margin-top: 6px; font-size: 11px; color: var(--text-3); background: var(--surface-2); border: 1px dashed var(--border); border-radius: 6px; padding: 5px 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 链接类型 segmented */
.gp-seg-control { display: flex; gap: 3px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 3px; margin-bottom: 8px; }
.gp-seg-btn { flex: 1; padding: 7px 8px; border-radius: 8px; border: none; background: transparent; font-size: 12px;
  color: var(--text-3); cursor: pointer; transition: all var(--dur); font-family: inherit; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 4px; }
.gp-seg-btn:hover { color: var(--text-2); }
.gp-seg-btn.active { background: var(--surface); color: var(--accent); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent); }

/* 双字段行 */
.gp-field-row { display: flex; gap: 10px; }
.gp-field-row .gp-field { flex: 1; }

/* 状态选择 */
.gp-status-select { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 13px;
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; transition: all var(--dur);
  appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA0A6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 13px center; }
.gp-status-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }

/* 底部按钮 */
.gp-cap-foot { display: flex; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--border); background: var(--surface-2); align-items: center; }
/* R138-H1′：保存后补全开关（左置，与保存钮拉开） */
.gp-cap-enrich { margin-right: auto; display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-3); cursor: pointer; user-select: none; }
.gp-btn { padding: 9px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all var(--dur); border: 1px solid transparent; display: inline-flex; align-items: center; gap: 6px; }
.gp-btn-ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); }
.gp-btn-ghost:hover { border-color: var(--border-strong); color: var(--text); }
.gp-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); margin-left: auto;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--accent) 20%, transparent), 0 4px 12px color-mix(in srgb, var(--accent) 15%, transparent); }
.gp-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--accent) 25%, transparent), 0 8px 20px color-mix(in srgb, var(--accent) 20%, transparent); }
.gp-btn-primary:active { transform: translateY(0); }
</style>
