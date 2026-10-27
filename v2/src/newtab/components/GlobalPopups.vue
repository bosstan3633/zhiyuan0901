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
            <span class="gp-chip-x" v-pressable aria-label="清除筛选" @click="clearFilter">×</span>
          </span>
          <input ref="searchInput" type="text" class="gp-search-input" v-model="searchQueryRaw"
            placeholder="搜索全部卡片…" autocomplete="off" spellcheck="false"
            @keydown="onSearchKeydown">
        </div>
        <button class="gp-search-esc" @click="closeAll">Esc</button>
      </div>
      <!-- R161-②：常用检索词 —— 只在没在输入时露出（正在打字还铺一排"以前的词"只会碍事） -->
      <div v-if="!searchQueryRaw && topSearches.length" class="gp-hist">
        <span class="gp-hist-cap">常用检索</span>
        <button v-for="h in topSearches" :key="h.q" type="button" class="gp-hist-chip"
          :title="`用过 ${h.n} 次 · 点击放回检索框`" @click="useHistory(h.q)">{{ h.q }}</button>
      </div>
      <!-- R146-d：tab 去 emoji 图标（实测带图标在窄屏逐字换行成两行）+ nowrap 锁死 -->
      <div class="gp-type-tabs" role="tablist" aria-label="搜索类型">
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='all'" :class="{active: currentType==='all'}" @click="setType('all')">搜全部 <span class="gp-tt-count">{{ counts.all }}</span></div>
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='res'" :class="{active: currentType==='res'}" @click="setType('res')">资源卡 <span class="gp-tt-count">{{ counts.res }}</span></div>
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='task'" :class="{active: currentType==='task'}" @click="setType('task')">任务卡 <span class="gp-tt-count">{{ counts.task }}</span></div>
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='curio'" :class="{active: currentType==='curio'}" @click="setType('curio')">好奇心 <span class="gp-tt-count">{{ counts.curio }}</span></div>
        <!-- R49-G：策展台（分类树定位）/ 项目（直达项目详情）双类型 -->
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='ws'" :class="{active: currentType==='ws'}" @click="setType('ws')">策展台 <span class="gp-tt-count">{{ counts.ws }}</span></div>
        <div class="gp-type-tab" role="tab" v-pressable :aria-selected="currentType==='proj'" :class="{active: currentType==='proj'}" @click="setType('proj')">项目 <span class="gp-tt-count">{{ counts.proj }}</span></div>
        <!-- R150：AI 检索（自然语言 → 三类卡语义召回，只读；跑动中再点=取消；键入路径零 AI） -->
        <div class="gp-type-tab gp-ai-tab" role="tab" v-pressable :aria-selected="!!aiSearch" :class="{active: !!aiSearch, busy: aiBusy}" @click="aiSearchRun(false)"
          :title="aiBusy ? '点击取消本次 AI 检索（不写任何数据）' : 'AI 读懂你这句话，从库内资源卡/任务/好奇卡里按相关度取一批投料，挑出真正贴合的（只读不改数据；结果出来后会写明扫了多少张/库内共多少张；再点=清除）'">
          <AiEntryButton variant="inline" :spin="aiBusy" :label="aiBusy ? aiProgress : 'AI 检索'" />
        </div>
      </div>
      <div class="gp-results" ref="resultsEl">
        <!-- R150：AI 检索组（置顶呈现；原分组列表不动；手势与主列表逐字一致） -->
        <template v-if="aiTopRows.length && !isBrowseMode">
          <div class="gp-group-title gp-ai-title">
            <AiEntryButton variant="inline" label="AI 检索" />
            <span class="gp-ai-fed">挑出 {{ aiTopRows.length }} 条 · 投料 {{ aiSearch?.scanned }}/{{ aiSearch?.total }} 张 · {{ aiDur(aiTook) }}<template v-if="aiSearch && aiSearch.batches > 1"> · {{ aiSearch.batches }} 批</template></span>
            <!-- R161-③：把"按你这句话收窄到了什么范围"说清楚——不然 total 变小会被误读成"库里就这么点卡" -->
            <span v-if="aiSearch && aiSearch.scope" class="gp-ai-scope" title="按你这句话的指向性（点名的类型 / 台 / 分类）收窄了候选范围；识别不到指向就查全库"><Icon name="target" :size="13"/> 范围 {{ aiSearch.scope }}</span>
            <span v-if="aiSearch && aiSearch.note" class="gp-ai-note">{{ aiSearch.note }}</span>
            <span v-if="aiSearch && aiSearch.dropped" class="gp-ai-drop">消毒：{{ aiSearch.dropped }} 条 id 不在候选内</span>
            <button v-if="aiSearch && aiSearch.scanned < aiSearch.total" class="gp-ai-more" :disabled="aiBusy"
              :title="`本次只看了相关性最高的 ${aiSearch.scanned} 张；全库共 ${aiSearch.total} 张，分批扫约 ${aiMoreBatches} 次请求、会慢`" @click.stop="aiSearchRun(true)">全库分批扫</button>
          </div>
          <!-- R152：AI 命中不再单列一组——同一张卡在主列表只有一行，命中信息挂在行上（重复行会让
               键盘扁平列表里同一个 id 出现两次，选中高亮与执行落到不同那行，看着就是"手势没按约定走"） -->
        </template>
        <!-- B1：浏览模式（空查询）——W3 双 Tab：常用内容（近期最常用置顶）/ AI 动作（R158：AI 分组数据源=注册表纯声明） -->
        <template v-if="isBrowseMode">
          <!-- W3（需求 #6）：浏览态顶部「常用内容 / AI 动作」双 Tab 切换控件（真 Tab，非仅分组标题） -->
          <div class="gp-browse-tabs">
            <button class="gp-browse-tab" :class="{active: browseTab==='common'}" @click="setBrowseTab('common')">常用内容</button>
            <button class="gp-browse-tab" :class="{active: browseTab==='ai'}" @click="setBrowseTab('ai')">AI 动作</button>
          </div>
          <!-- AI 动作 Tab：AI 动作 + AI 建议 -->
          <template v-if="browseTab==='ai'">
            <template v-if="aiPanelRows.proactive.length">
              <div class="gp-group-title">AI 动作 <span class="gp-group-cnt">主动 · 到台面使用</span></div>
              <div v-for="(ai, i) in aiPanelRows.proactive" :key="'aip' + ai.id" v-pressable
                class="gp-result-item" :class="{selected: selIndex===i}" @click="runFlat(i)" @mouseenter="selIndex=i"
                :title="ai.panel.hint ? `${ai.title} —— ${ai.panel.hint}` : ai.title">
                <div class="gp-ri-icon res"><Icon :name="ai.panel.icon" :size="15" /></div>
                <div class="gp-ri-main"><div class="gp-ri-title">{{ ai.title }}</div>
                  <div class="gp-ri-cat">{{ ai.panel.hint }}</div></div>
                <span class="gp-ri-link url"><Icon name="external" :size="13"/></span>
              </div>
            </template>
            <template v-if="aiPanelRows.passive.length">
              <div class="gp-group-title">AI 建议 <span class="gp-group-cnt">被动 · AI 建议我看</span></div>
              <div v-for="(ai, j) in aiPanelRows.passive" :key="'aiv' + ai.id" v-pressable
                class="gp-result-item" :class="{selected: selIndex===aiProLen+j}" @click="runFlat(aiProLen+j)" @mouseenter="selIndex=aiProLen+j"
                :title="ai.panel.hint ? `${ai.title} —— ${ai.panel.hint}` : ai.title">
                <div class="gp-ri-icon res"><Icon :name="ai.panel.icon" :size="15" /></div>
                <div class="gp-ri-main"><div class="gp-ri-title">{{ ai.title }}</div>
                  <div class="gp-ri-cat">{{ ai.panel.hint }}</div></div>
                <span class="gp-ri-link url"><Icon name="external" :size="13"/></span>
              </div>
            </template>
          </template>
          <!-- 常用内容 Tab：近期最常用（置顶）→ 快捷操作 → 快速开关（索引 = recent + QA + TGL，与 flatList 逐项一致） -->
          <template v-if="browseTab==='common'">
            <template v-if="recentResources.length">
              <div class="gp-group-title"><Icon name="flame" :size="13"/> 近期最常用 · 按调用次数</div>
              <div v-for="(r, j) in recentResources" :key="r.id" v-pressable
                class="gp-result-item" :class="{selected: selIndex===j}"
                @click="runFlat(j)" @mouseenter="selIndex=j"
                :title="'单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处'">
                <div class="gp-ri-icon" :class="r.iconClass">{{ r.iconText }}</div>
                <div class="gp-ri-main"><div class="gp-ri-title">{{ r.title }}</div>
                  <div class="gp-ri-cat">{{ r.ws }}<template v-if="r.cat"> · {{ r.cat }}</template></div>
                </div>
                <span class="gp-ri-link url"><Icon name="flame" :size="13"/>{{ (r.raw as any).callCount || 0 }}</span>
              </div>
            </template>
            <div class="gp-group-title">快捷操作</div>
            <div v-for="(qa, i) in QUICK_ACTIONS" :key="'qa' + i" v-pressable
              class="gp-result-item" :class="{selected: selIndex===recentResources.length+i}" @click="runFlat(recentResources.length+i)" @mouseenter="selIndex=recentResources.length+i">
              <div class="gp-ri-icon res"><Icon :name="qa.icon" :size="15" /></div>
              <div class="gp-ri-main"><div class="gp-ri-title">{{ qa.label }}</div></div>
              <span class="gp-ri-link url"><Icon name="arrowleft" :size="13"/></span>
            </div>
            <!-- R171-C1：快速开关（04-63 任务书「全部开关收进去」的收口）——行内明示当前态，点了立即生效 -->
            <template v-if="PALETTE_TOGGLES.length">
              <div class="gp-group-title">快速开关</div>
              <div v-for="(tg, i) in PALETTE_TOGGLES" :key="'tg' + i" v-pressable
                class="gp-result-item" :class="{selected: selIndex===recentResources.length+QUICK_ACTIONS.length+i}" @click="runFlat(recentResources.length+QUICK_ACTIONS.length+i)" @mouseenter="selIndex=recentResources.length+QUICK_ACTIONS.length+i"
                :title="tg.hint">
                <div class="gp-ri-icon res"><Icon :name="tg.icon" :size="15" /></div>
                <div class="gp-ri-main"><div class="gp-ri-title">{{ tg.label }}</div></div>
                <span class="gp-ri-link" :class="tg.on ? 'url' : ''">{{ tg.on ? '● 开' : '○ 关' }}</span>
              </div>
            </template>
          </template>
        </template>
        <!-- B1：搜索模式 = 分组 + 关键词高亮 -->
        <template v-else>
        <!-- R49-G2：策展台类型 → 策展台→分类树（点击分类定位：有卡=高亮第一张，无卡=高亮分类行） -->
        <template v-if="currentType==='ws'">
          <div v-if="!wsTree.length" class="gp-search-empty">
            <div class="gp-se-icon"><Icon name="folder" :size="13"/></div>
            <div class="gp-se-text">没有匹配的策展台</div>
          </div>
          <template v-for="wsn in wsTree" :key="wsn.id">
            <div class="gp-group-title"><Icon name="folder" :size="13"/> {{ wsNameOf(wsn.id) }} <span class="gp-group-cnt">{{ wsn.cards }} 张卡</span></div>
            <div v-for="cn in wsn.cats" :key="wsn.id + '-' + cn.id" v-pressable
              class="gp-result-item" @click="locateCat(wsn.id, cn)"
              title="单击 → 定位到该分类（有卡高亮第一张，无卡高亮分类行）">
              <div class="gp-ri-icon ws"><Icon name="folder" :size="13"/></div>
              <div class="gp-ri-main">
                <div class="gp-ri-title">{{ cn.name }}</div>
                <div class="gp-ri-meta">
                  <span class="gp-ri-badge cat">{{ cn.count }} 张卡</span>
                  <span v-if="!cn.count" class="gp-ri-badge">空分类 · 定位到分类</span>
                </div>
              </div>
              <span class="gp-ri-link url">定位 <Icon name="external" :size="13"/></span>
            </div>
            <div v-if="!wsn.cats.length" class="gp-group-more">该策展台暂无分类</div>
          </template>
        </template>
        <template v-else>
        <!-- R110-LC（T3）：归档卡已从默认检索结果排除——一行降级提示（不打断结果流） -->
        <div v-if="archivedMatchCount" class="gp-archived-hint">
          <Icon name="package" :size="13"/> 另有 {{ archivedMatchCount }} 张已归档卡片匹配（在「生命周期」中查看 / 恢复）
        </div>
        <div v-if="!filteredResults.length" class="gp-search-empty">
          <div class="gp-se-icon"><Icon name="inbox" :size="13"/></div>
          <div class="gp-se-text">没有匹配的卡片<br><span class="gp-se-hint">试试更短的关键词</span></div>
        </div>
        <template v-for="grp in groupedResults" :key="grp.label">
          <div class="gp-group-title">{{ grp.label }} <span class="gp-group-cnt">{{ grp.total }}</span></div>
          <div v-for="item in grp.items" :key="item.id" v-pressable
            class="gp-result-item" :class="{selected: item.id===selectedId}"
            @click="pickRow(item, $event)" @mouseenter="selectHover(item)"
            :title="'单击/Enter → 打开链接（无链接则定位） · Ctrl+单击 或 Ctrl+Enter → 定位到卡片所在处'">
            <div class="gp-ri-icon" :class="item.iconClass">{{ item.iconText }}</div>
            <div class="gp-ri-main">
              <div class="gp-ri-title" v-html="hlTitle(item.title)"></div>
              <div class="gp-ri-meta">
                <span class="gp-ri-badge ws">{{ item.ws }}</span>
                <span class="gp-ri-badge cat">{{ item.cat }}</span>
                <span v-for="b in item.badges" :key="b.text" class="gp-ri-badge" :class="b.type">{{ b.text }}</span>
                <!-- R152：AI 命中挂在主列表这一行上（弱相关仍标"低置信"，判弱只用客观信号不藏） -->
                <!-- R152：命中信息并入主列表这一行；弱相关仍显式标「低置信」，不许因为并组就藏掉 -->
                <span v-if="aiHitById[item.id]" class="gp-ri-badge ai" :class="{ weak: aiHitById[item.id].weak }" :title="aiHitById[item.id].weak ? '模型给的分低或没给理由——它在猜，自己核一眼再用' : 'AI 从库内挑出来时点名了这张卡'"><Icon name="sparkle" :size="10"/>{{ aiHitById[item.id].weak ? '低置信' : '命中' }}</span>
                <span v-if="item.link" class="gp-ri-link" :class="item.link.type"><Icon :name="linkIconName(item.link.type)" :size="12"/> {{ item.link.text }}</span>
                <span v-if="item.due" class="gp-ri-due" :class="{overdue: item.dueOverdue}"><Icon v-if="item.dueOverdue" name="clock" :size="13"/> {{ item.due }}</span>
              </div>
              <div v-if="item.summary" class="gp-ri-summary" v-html="hlTitle(item.summary)"></div>
              <div v-if="aiHitById[item.id]?.why" class="gp-ai-why">{{ aiHitById[item.id].why }}</div>
            </div>
            <div class="gp-ri-actions">
              <template v-if="item.type==='res'">
                <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)"><Icon name="star" :size="13"/></button>
                <button class="gp-ri-act del" title="删除" @click.stop="deleteItem(item)"><Icon name="trash" :size="13"/></button>
                <button class="gp-ri-act go" title="打开链接（外开浏览器）" @click.stop="openResLink(item)"><Icon name="external" :size="13"/></button>
              </template>
              <template v-else-if="item.type==='task'">
                <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)"><Icon name="star" :size="13"/></button>
                <button class="gp-ri-act del" title="删除" @click.stop="deleteItem(item)"><Icon name="trash" :size="13"/></button>
                <button class="gp-ri-act go" title="定位到任务卡片" @click.stop="openItem(item)"><Icon name="external" :size="13"/></button>
              </template>
              <template v-else-if="item.type==='curio'">
                <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)"><Icon name="star" :size="13"/></button>
                <div class="gp-ri-act convert" title="转化为...">
                  <span v-pressable aria-label="转换卡片类型" @click.stop="toggleConvertMenu(item.id)"><Icon name="refresh" :size="13"/>▾</span>
                  <div class="gp-convert-menu" :class="{open: convertMenuId===item.id}" data-a11y-container @click.stop>
                    <div class="gp-convert-menu-item" role="menuitem" v-pressable @click="convertCurio(item, 'res')"><Icon name="filetext" :size="13"/> 转化为资源卡</div>
                    <div class="gp-convert-menu-item" role="menuitem" v-pressable @click="convertCurio(item, 'task')"><Icon name="check" :size="13"/> 转化为任务卡</div>
                  </div>
                </div>
                <button class="gp-ri-act go" title="定位到好奇心卡片" @click.stop="openItem(item)"><Icon name="external" :size="13"/></button>
              </template>
            </div>
          </div><!-- /gp-result-item -->
          <div v-if="grp.total > grp.items.length" class="gp-group-more">… 还有 {{ grp.total - grp.items.length }} 条，输入更精确的关键词</div>
        </template>
        </template>
        </template><!-- /R49-G ws 树分支 v-else -->
      </div>
      <div class="gp-panel-foot">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开链接</span>
        <span><kbd>Ctrl+Enter / 单击</kbd> 定位卡片</span>
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
          <div class="gp-cap-icon res"><Icon name="inbox" :size="13"/></div>
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
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='url'}" @click="capForm.linkType='url'"><Icon name="link" :size="13"/> URL</button>
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='file'}" @click="capForm.linkType='file'"><Icon name="folder" :size="13"/> 本地文件</button>
              <button class="gp-seg-btn" :class="{active: capForm.linkType==='obsidian'}" @click="capForm.linkType='obsidian'"><Icon name="filetext" :size="13"/> Obsidian</button>
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
            <!-- V3.7.0（R179）：资源台退役——采集统一入资源卡池，标签由「保存后补全」AI 建议（可保存后编辑） -->
            <div class="gp-field">
              <label class="gp-field-label">存入</label>
              <div class="gp-status-select gp-status-row"><Icon name="folder" :size="13"/> 资源卡池<span class="gp-status-note">· 标签保存后自动补</span></div>
            </div>
          </div>
        </div>
        <div class="gp-cap-foot">
          <!-- W4（V3.8.4）：「保存后补全」默认开——新卡入库自动预打标（AI 建议，勾选采纳才写库）。
               默认值由 config.ts 的一次性迁移接管（存量 false → true 一次；用户关掉后一直尊重），
               这里只保留开关本体与说明，不再改标签措辞。 -->
          <label class="gp-cap-enrich" title="保存成功后自动打开 AI 补全评审（勾选采纳才写库）；W4 起默认开——新卡入库自动预打标"><input type="checkbox" v-model="capEnrichOn" @change="capEnrichSave" /> <AiEntryButton variant="inline" label="保存后补全" /></label>
          <button class="gp-btn gp-btn-ghost" @click="closeAll">取消</button>
          <button class="gp-btn gp-btn-primary" @click="saveCapture"><Icon name="save" :size="13"/> 保存（Ctrl+Enter）</button>
        </div>
      </template>

      <!-- 已保存状态条：Enter 打开看板 / Esc 关闭 / 5 秒自动消失 -->
      <template v-else>
        <div class="gp-saved">
          <div class="gp-saved-icon"><Icon name="check" :size="13"/></div>
          <div class="gp-saved-title">资源卡已保存</div>
          <div class="gp-saved-hint">按 <kbd>Enter</kbd> 打开看板 · 定位新卡片</div>
          <div class="gp-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
          <div class="gp-saved-actions">
            <button class="gp-btn gp-btn-ghost" @click="closeAll">关闭</button>
            <button v-if="capEnrichReady" class="gp-btn" @click="aiReopenEnrich"><AiEntryButton variant="inline" label="补全建议" /></button>
            <button class="gp-btn gp-btn-primary" @click="openSavedBoard">打开看板（Enter）</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- R55-C：快速采集任务（四字段全非必填，直存全域任务） -->
  <!-- ★V3.9.20 第二梯队拆分 · 第二块：快速添加家族（任务速记 + 好奇采集）拆出为
       GlobalPopupsQuickAdd.vue（第一块是 V3.9.6 的 Shortcuts）。交互、类名与 DOM 结构一字未改；
       开面板初始化（预填/选中文本/来源捕获）与 saved 态键盘随面板迁入，宿主只管开关与转发。 -->
  <GlobalPopupsQuickAdd ref="quickAddRef" :task-active="activePanel==='taskcapture'" :curio-active="activePanel==='curio'"
    :prefill="panelPrefill" @close="closeAll" />

  <!-- B3：快捷键速查面板（? 呼出）—— ★V3.9.6 拆出为 GlobalPopupsShortcuts.vue
       （GlobalPopups 第二梯队拆分 · 第一块：按弹窗家族切，一轮一块不打包）。
       交互与类名一字未改：宿主只管「当前是不是这个面板」与「关掉」。 -->
  <GlobalPopupsShortcuts :active="activePanel==='shortcuts'" @close="closeAll" />

  <!-- R158：AI 建议面板（被动型入口统一建议流；命令面板 AI 建议组 / openPanel('ai-advice') 呼出） -->
  <div class="gp-overlay" :class="{open: activePanel==='ai-advice'}" @click.self="closeAll">
    <div class="gp-panel gp-panel-advice">
      <div class="gp-cap-head">
        <div class="gp-cap-icon res"><Icon name="bulb" :size="18" /></div>
        <div class="gp-cap-titles">
          <div class="gp-cap-title">AI 建议</div>
          <div class="gp-cap-sub">AI 建议我看 · 扫描型入口统一收在这里 · 只读分析，勾选采纳才落库</div>
        </div>
        <button class="gp-cap-close" @click="closeAll">×</button>
      </div>
      <div class="gp-adv-body">
        <div class="gp-adv-card">
          <div class="gp-adv-icon"><Icon name="share" :size="17" /></div>
          <div class="gp-adv-main">
            <div class="gp-adv-name">跨台镜像发现</div>
            <div class="gp-adv-desc">扫描各台卡片，建议哪些值得镜像到策展台——在册资源卡与策展台已有内容不重复推荐</div>
          </div>
          <button class="gp-btn gp-btn-primary" :disabled="aiAdviceBusy" @click="aiAdviceRun('cross-deck')">扫描</button>
        </div>
        <div class="gp-adv-card">
          <div class="gp-adv-icon"><Icon name="radio" :size="17" /></div>
          <div class="gp-adv-main">
            <div class="gp-adv-name">主题漂移检测</div>
            <div class="gp-adv-desc">对照各策展台主题卡检查近期卡片是否跑题，给出漂移提醒</div>
          </div>
          <button class="gp-btn gp-btn-primary" :disabled="aiAdviceBusy" @click="aiAdviceRun('thesis-drift')">检测</button>
        </div>
        <div class="gp-adv-card">
          <div class="gp-adv-icon"><Icon name="bulb" :size="17" /></div>
          <div class="gp-adv-main">
            <div class="gp-adv-name">沉睡资源唤醒</div>
            <div class="gp-adv-desc">长期零打开的卡对照当前目标与任务判「唤醒 / 归档 / 保留」；置顶与星标卡自动豁免</div>
            <div class="gp-adv-days">
              <span>沉睡超过</span>
              <input class="gp-adv-days-input" type="number" min="14" max="365" v-model.number="aiAdviceDormantDays" />
              <span>天</span>
            </div>
          </div>
          <button class="gp-btn gp-btn-primary" :disabled="aiAdviceBusy" @click="aiAdviceRun('dormant-scan')">扫描</button>
        </div>
        <div class="gp-adv-foot">任务建议在任务详情抽屉内（与当前任务强相关，不在此列）；以上全部手动触发、无常驻轮询。</div>
      </div>
    </div>
  </div>

  <!-- R158：AI 评审抽屉（采集补全 + AI 建议面板共用同一懒组件实例） -->
  <AiDrawerGP v-if="gpAiJob" :job="gpAiJob" @close="gpAiJobClose" />
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import { wsNameById } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { useCuriosity } from '@/newtab/stores/curiosity'
import { showToast } from '@/shared/components/toast'
import { uid, normalizeUrl } from '@/shared/utils'
import { CURATION_WS_ID } from '@/shared/models'
import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { recordResourceOpen, recordCardOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, toOpenableRawLink, openExternalLink, linkPlaceholderFor } from '@/shared/utils/link'
import { useConfirm } from '@/shared/components/confirm'
import Icon from '@/shared/components/Icon.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { markRank } from '@/shared/utils/marksort'
import { saveUIPrefs } from '@/shared/storage/repository'
import { getRecentWebTab } from '@/shared/utils/recentWebTab'
import GlobalPopupsShortcuts from './GlobalPopupsShortcuts.vue'
import GlobalPopupsQuickAdd from './GlobalPopupsQuickAdd.vue'
import { AI_ENTRIES } from '@/shared/ai/jobs/registry'
import { useGlobalPopups, type PanelType, type SearchResult, type SearchResultSeed, type AiCand, type AiHit, type AiOut, type PaletteToggle, type AiPanelEntry, type BrowseTab, type DormantVerdictGP } from './useGlobalPopups'
const {
  router, store, convertToResource, convertToTask, d,
  activePanel, quickAddRef, panelPrefill, searchInput, capTitleInput,
  resultsEl, lastFocused, openPanel, closeAll, openSavedBoard,
  onSavedKeydown, prefillCapture, searchQueryRaw, searchQuery, qDebounce,
  setSearchQuery, SEARCH_HIST_MAX, searchHistory, topSearches, recordedQ,
  recordSearch, useHistory, searchActive, pinyinReady, currentType,
  selIndex, selectedId, syncIdFromIndex, syncIndexFromId, convertMenuId,
  typeLabel, filterLabel, counts, EMPTY_RESULTS, withMatchFields,
  resultTable, allResults, showDoneProjects, wsTree, wsNameOf,
  locateCat, normKey, blobOf, partsKey, partsNp,
  partsPy, normedParts, hitResult, filteredResults, hitRank,
  archivedMatchCount, isBrowseMode, aiSearch, aiBusy, aiSecs,
  aiChars, aiTook, aiScanned, aiTotal, aiFound,
  aiDur, aiAbortCtl, aiTick, aiCancelMsg, aiCache,
  aiStopTick, aiAbort, cardFieldText, aiCands, aiProgress,
  aiMoreBatches, aiSearchRun, aiHitById, aiTopRows, QUICK_ACTIONS,
  PALETTE_TOGGLES, aiPanelRows, aiProLen, browseTab, setBrowseTab,
  runAiEntry, recentResources, flatList, groupedResults, escapeHtmlTitle,
  hlTitle, runFlat, runFlatLocator, openLinkOrLocate, locateOnly,
  runSearch, setType, clearFilter, onSearchKeydown, scrollToSelected,
  pickRow, selectHover, lastOpenId, lastOpenTs, openItem,
  openResLink, editItem, isStarred, toggleStar, deleteItem,
  toggleConvertMenu, convertCurio, capForm, capSaved, savedResourceId,
  savedWsId, savedTimer, capLinkPlaceholder, resetCaptureForm, saveCapture,
  AiDrawerGP, aiEnrichJob, aiAdviceJob, gpAiJob, gpAiJobClose,
  capEnrichOn, capEnrichReady, lastEnrichCard, runCardEnrich, aiReopenEnrich,
  capEnrichSave, aiAdviceBusy, aiAdviceDormantDays, aiAdviceRun, linkShort,
  linkIconName, allProjects, isProjectDone,
} = useGlobalPopups()
defineExpose({ openPanel, closeAll, activePanel })
</script>

<style scoped src="./GlobalPopups.css"></style>
