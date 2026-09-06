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
          <input ref="searchInput" type="text" class="gp-search-input" v-model="searchQuery"
            placeholder="搜索全部卡片…" autocomplete="off" spellcheck="false"
            @keydown="onSearchKeydown">
        </div>
        <button class="gp-search-esc" @click="closeAll">Esc</button>
      </div>
      <div class="gp-type-tabs">
        <div class="gp-type-tab" :class="{active: currentType==='all'}" @click="setType('all')">🔍 搜全部 <span class="gp-tt-count">{{ counts.all }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='res'}" @click="setType('res')">📄 资源卡 <span class="gp-tt-count">{{ counts.res }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='task'}" @click="setType('task')">✅ 任务卡 <span class="gp-tt-count">{{ counts.task }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='curio'}" @click="setType('curio')">💡 好奇心 <span class="gp-tt-count">{{ counts.curio }}</span></div>
        <!-- R49-G：工作台（分类树定位）/ 项目（直达项目详情）双类型 -->
        <div class="gp-type-tab" :class="{active: currentType==='ws'}" @click="setType('ws')">🗂 工作台 <span class="gp-tt-count">{{ counts.ws }}</span></div>
        <div class="gp-type-tab" :class="{active: currentType==='proj'}" @click="setType('proj')">📦 项目 <span class="gp-tt-count">{{ counts.proj }}</span></div>
      </div>
      <div class="gp-results" ref="resultsEl">
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
              @click="runFlat(QUICK_ACTIONS.length+j)" @dblclick="runFlat(QUICK_ACTIONS.length+j)" @mouseenter="selIndex=QUICK_ACTIONS.length+j"
              :title="'单击 → 打开链接（无链接则定位） · Ctrl+Enter → 定位并打开详情'">
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
        <!-- R49-G2：工作台类型 → 工作台→分类树（点击分类定位：有卡=高亮第一张，无卡=高亮分类行） -->
        <template v-if="currentType==='ws'">
          <div v-if="!wsTree.length" class="gp-search-empty">
            <div class="gp-se-icon">🗂</div>
            <div class="gp-se-text">没有匹配的工作台</div>
          </div>
          <template v-for="wsn in wsTree" :key="wsn.id">
            <div class="gp-group-title">🗂 {{ wsNameOf(wsn.id) }} <span class="gp-group-cnt">{{ wsn.cards }} 张卡</span></div>
            <div v-for="cn in wsn.cats" :key="wsn.id + '-' + cn.id"
              class="gp-result-item" @click="locateCat(wsn.id, cn)" @dblclick="locateCat(wsn.id, cn)"
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
            <div v-if="!wsn.cats.length" class="gp-group-more">该工作台暂无分类</div>
          </template>
        </template>
        <template v-else>
        <div v-if="!filteredResults.length" class="gp-search-empty">
          <div class="gp-se-icon">🪹</div>
          <div class="gp-se-text">没有匹配的卡片<br><span style="font-size:11px">试试更短的关键词</span></div>
        </div>
        <template v-for="grp in groupedResults" :key="grp.label">
          <div class="gp-group-title">{{ grp.label }} <span class="gp-group-cnt">{{ grp.total }}</span></div>
          <div v-for="(item, j) in grp.items" :key="item.id"
            class="gp-result-item" :class="{selected: grp.offset+j===selIndex}"
            @click="selectResult(grp.offset+j, true)" @dblclick="selectResult(grp.offset+j, true)" @mouseenter="selIndex=grp.offset+j"
            :title="'单击 → 打开链接（无链接则定位） · Ctrl+Enter → 定位并打开详情'">
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
              <button class="gp-ri-act go" title="打开链接" @click.stop="openItem(item)">↗</button>
            </template>
            <template v-else-if="item.type==='task'">
              <button class="gp-ri-act" :class="{on: isStarred(item)}" :title="isStarred(item)?'取消星标':'星标（搜索优先）'" @click.stop="toggleStar(item)">⭐</button>
              <button class="gp-ri-act del" title="删除" @click.stop="deleteItem(item)">🗑</button>
              <button class="gp-ri-act go" title="跳转任务中心" @click.stop="openItem(item)">↗</button>
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
              <button class="gp-ri-act go" title="跳转方向台" @click.stop="openItem(item)">↗</button>
            </template>
          </div>
          </div><!-- /gp-result-item -->
        </template>
        </template>
        </template><!-- /R49-G ws 树分支 v-else -->
      </div>
      <div class="gp-panel-foot">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>⏎</kbd> 打开</span>
        <span><kbd>Tab</kbd> 过滤类型</span>
        <span><kbd>Esc</kbd> 关闭</span>
        <span class="gp-foot-brand">知源调度台 · 你不缺信息，你缺一座控制中心</span>
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
              <label class="gp-field-label">存入工作台</label>
              <select class="gp-status-select" v-model="capForm.workspaceId">
                <option v-for="ws in userWorkspaces" :key="ws.id" :value="ws.id">{{ ws.icon }} {{ ws.name }}</option>
                <option disabled>🧭 方向台（系统）</option>
                <option disabled>✅ 任务中心（系统）</option>
              </select>
            </div>
            <div class="gp-field">
              <label class="gp-field-label">分类</label>
              <select class="gp-status-select" v-model="capForm.categoryId">
                <option value="">📥 待分类</option>
                <option v-for="cat in capCategories" :key="cat.id" :value="cat.id">📂 {{ cat.name }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="gp-cap-foot">
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
            <button class="gp-btn gp-btn-primary" @click="openSavedBoard">打开看板（Enter）</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- R55-C：快速采集任务（四字段全非必填，直存全域任务） -->
  <div class="gp-overlay corner" :class="{open: activePanel==='taskcapture'}" @click.self="closeAll">
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
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { showToast } from '@/shared/components/toast'
import { uid, normalizeUrl } from '@/shared/utils'
// V2.21：拼音字典改为按需加载（约 296KB），未就绪时降级为纯文本匹配
import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { recordResourceOpen, recordCardOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { useConfirm } from '@/shared/components/confirm'
import { emitOpenDrawer } from '@/shared/utils/bus'
import Icon from '@/shared/components/Icon.vue'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import { markRank } from '@/shared/utils/marksort'

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
  if (p === 'capture') { capSaved.value = false }
  // V2.21：字典按需加载——仅在搜索面板被打开时才拉取，不进新标签页首屏同步路径
  // R47-A4：每次唤起清空上次查询词，恢复浏览态（无输入=近期热度排序）
  if (p === 'search') { currentType.value = 'all'; searchQuery.value = ''; void ensurePinyin() }
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
const searchQuery = ref('')
/**
 * V2.21：拼音字典就绪状态（响应式）。
 * filteredResults 通过读取它建立依赖——字典异步加载完成后，
 * computed 自动重算一次，把拼音/首字母命中补进结果，无需用户重新输入。
 */
const pinyinReady = ref(isPinyinReady())
onPinyinReady(() => { pinyinReady.value = true })
/** B29：类型过滤单一状态源——搜索框 chip 与类型 Tab 行共用，Tab 切换两者同步
 *  R49-G：新增 'ws' 工作台（分类树定位）/ 'proj' 项目（直达项目详情）两类型 */
const currentType = ref<'all'|'res'|'task'|'curio'|'ws'|'proj'>('all')
const selIndex = ref(0)
const convertMenuId = ref<string | null>(null)

function typeLabel(t: 'all'|'res'|'task'|'curio'|'ws'|'proj'): string {
  return t === 'res' ? '📄 资源卡' : t === 'task' ? '✅ 任务卡' : t === 'curio' ? '💡 好奇心' : t === 'ws' ? '🗂 工作台' : t === 'proj' ? '📦 项目' : '🔍 搜全部'
}
const filterLabel = computed(() => typeLabel(currentType.value))

const counts = computed(() => {
  const all = d.value
  return {
    all: all.resources.filter(r=>!r.deletedAt).length + all.tasks.filter(t=>!t.deletedAt).length + all.curiosities.filter(c=>!c.deletedAt).length + all.workspaces.filter(w=>!w.archived).length,
    res: all.resources.filter(r=>!r.deletedAt).length,
    task: all.tasks.filter(t=>!t.deletedAt).length,
    curio: all.curiosities.filter(c=>!c.deletedAt).length,
    ws: all.workspaces.filter(w=>!w.archived).length,
    proj: allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).length
  }
})

interface SearchResult {
  id: string
  // 第卅二轮 REQ-008：新增 'ws' 工作台实体命中；R49-G：新增 'proj' 项目实体命中
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
  raw: ResourceCard | TaskCard | CuriosityCard | Workspace
}

const allResults = computed<SearchResult[]>(() => {
  const results: SearchResult[] = []
  const all = d.value

  // 资源卡
  all.resources.filter(r=>!r.deletedAt).forEach(r => {
    const ws = all.workspaces.find(w=>w.id===r.workspaceId)
    const cat = all.categories.find(c=>c.id===r.categoryId)
    const rlink = r.link
    results.push({
      id: r.id, type: 'res', iconClass: 'res', iconText: '📄',
      title: r.title, ws: ws?.name || '未知', cat: cat?.name || '待分类',
      badges: [],
      link: rlink ? { type: r.linkType, icon: r.linkType==='url'?'🔗':r.linkType==='file'?'📁':'📝', text: linkShort(rlink as string) } : undefined,
      summary: r.description,
      raw: r
    })
  })

  // 任务卡
  all.tasks.filter(t=>!t.deletedAt).forEach(t => {
    const proj = findProject(t.projectId || '')
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
      raw: c
    })
  })

  // 第卅二轮 REQ-008：检索范围扩展至工作台实体（模糊匹配工作台名称，专属图标区分类别）
  d.value.workspaces.filter(w => !w.archived).forEach(w => {
    const cardCount = d.value.resources.filter(r => !r.deletedAt && r.workspaceId === w.id).length
    results.push({
      id: w.id, type: 'ws', iconClass: 'ws', iconText: '🗂',
      title: w.name, ws: '工作台', cat: `${cardCount} 张资源卡`,
      badges: [{ type: 'ws-badge', text: '工作台' }],
      summary: '',
      raw: w
    })
  })

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=；受已完成显隐开关约束）
  allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).forEach(p => {
    const dir = d.value.compass.directions.find(dr => dr.projects.some(x => x.id === p.id))
    const badges: {type:string,text:string}[] = []
    if (p.isFocused) badges.push({ type: 'prio-high', text: '🎯 主攻' })
    if (p.pinnedToLighthouse) badges.push({ type: 'ws-badge', text: '📡 已投射' })
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

/** R49-G2：工作台类型 → 工作台→分类树（含分类卡片数；关键字过滤工作台名/分类名） */
const wsTree = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return d.value.workspaces.filter(w => !w.archived)
    .filter(w => !q || w.name.toLowerCase().includes(q))
    .map(w => {
      const cats = d.value.categories.filter(c => c.workspaceId === w.id)
        .filter(c => !q || c.name.toLowerCase().includes(q))
        .map(c => {
          const fam = new Set([c.id, ...d.value.categories.filter(x => x.parentId === c.id).map(x => x.id)])
          return { id: c.id, name: c.name, count: d.value.resources.filter(r => !r.deletedAt && r.workspaceId === w.id && fam.has(r.categoryId || '')).length }
        })
      return { id: w.id, name: w.name, cards: d.value.resources.filter(r => !r.deletedAt && r.workspaceId === w.id).length, cats }
    })
})
function wsNameOf(id: string): string {
  return (d.value.workspaces.find(w => w.id === id)?.name || '').replace(/^[^\s]+\s/, '')
}
/** R49-G3：点击分类 → 定位工作台该分类（有卡=高亮第一张；无卡=高亮分类行） */
function locateCat(wsId: string, cat: { id: string; name: string }) {
  recordWorkspaceOpen(d.value, d.value.workspaces.find(w => w.id === wsId))
  store.persist()
  closeAll()
  router.push({ path: `/workspace/${wsId}`, query: { cat: cat.id } })
  showToast(`↗ 定位到「${cat.name}」`)
}

const filteredResults = computed<SearchResult[]>(() => {
  let list = allResults.value
  if (currentType.value !== 'all') list = list.filter(r => r.type === currentType.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    const parts = q.split(/\s+/)
    list = list.filter(r => {
      const blob = (r.title + ' ' + r.ws + ' ' + r.cat + ' ' + (r.summary||'') + ' ' + (r.link?.text||'')).toLowerCase()
      // 第十九轮：支持拼音/首字母命中中文标题（如 sj → 设计…）
      // V2.21：先读 pinyinReady 建立响应式依赖——字典未就绪时短路，纯文本匹配照常；
      //        字典到位后 pinyinReady 翻转，本 computed 自动重算，拼音命中无缝补入。
      const pinyinOn = pinyinReady.value
      return parts.every(p => blob.includes(p) || (pinyinOn && matchPinyin(r.title, p)))
    })
  }
  // 第卅三轮 REQ-020：全局检索加权排序 —— 置顶 > 星标 > 普通命中度（稳定排序，同权重保持原顺序）
  list = [...list].sort((a, b) =>
    markRank(b.raw as AnyCard) - markRank(a.raw as AnyCard))
  return list
})

watch(filteredResults, () => { selIndex.value = flatList.value.length ? 0 : -1 })

// ---- B1：命令面板升级（分组 / 高亮 / 快捷操作 / 最近打开） ----
const isBrowseMode = computed(() => !searchQuery.value.trim() && currentType.value === 'all')

const QUICK_ACTIONS = [
  { label: '打开方向台', icon: 'compass', run: () => { closeAll(); router.push('/compass') } },
  { label: '打开项目详情', icon: 'layout', run: () => { closeAll(); router.push('/compass/projects') } },
  { label: '打开方向树', icon: 'branch', run: () => { closeAll(); router.push('/compass/tree') } },
  { label: '打开设置', icon: 'settings', run: () => { closeAll(); router.push('/settings') } },
  { label: '采集资源卡（Ctrl+Shift+J）', icon: 'download', run: () => openPanel('capture') },
  { label: '采集好奇心（Ctrl+Shift+I）', icon: 'bulb', run: () => openPanel('curio') },
]
// R47-B4：浏览模式热度列表——全类型（资源/任务/好奇/工作台）按调用次数降序，次数并列按最近打开时间
const recentResources = computed<SearchResult[]>(() => {
  const heat = allResults.value.filter(x => (x.raw as AnyCard | Workspace).callCount)
  heat.sort((a, b) => {
    const dc = ((b.raw as any).callCount || 0) - ((a.raw as any).callCount || 0)
    return dc !== 0 ? dc : ((b.raw as any).lastCalledAt || 0) - ((a.raw as any).lastCalledAt || 0)
  })
  return heat.slice(0, 8)
})
/** 浏览模式的扁平列表（快捷操作 + 最近打开） */
type FlatItem = { kind: 'qa'; qa: typeof QUICK_ACTIONS[number] } | { kind: 'res'; item: SearchResult } | { kind: 'result'; item: SearchResult }
const flatList = computed<FlatItem[]>(() => {
  if (!isBrowseMode.value) return filteredResults.value.map(item => ({ kind: 'result' as const, item }))
  const out: FlatItem[] = []
  QUICK_ACTIONS.forEach(qa => out.push({ kind: 'qa', qa }))
  recentResources.value.forEach(item => out.push({ kind: 'res', item }))
  return out
})
const groupedResults = computed(() => {
  const defs: { type: 'res'|'task'|'curio'|'ws'|'proj'; label: string }[] = [
    { type: 'res', label: '📄 资源卡' }, { type: 'task', label: '✅ 任务卡' }, { type: 'curio', label: '💡 好奇心' },
    { type: 'ws', label: '🗂 工作台' }, { type: 'proj', label: '📦 项目' }
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
  const esc = escapeHtmlTitle(title)
  const q = searchQuery.value.trim()
  if (!q) return esc
  const i = esc.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return esc
  return esc.slice(0, i) + '<mark class="gp-hl">' + esc.slice(i, i + q.length) + '</mark>' + esc.slice(i + q.length)
}
function runFlat(index: number) {
  // 第卅六轮 REQ-039：双击 / Enter 键行为 —— 直开链接 / 跳路由（保留原 openItem 直开逻辑）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'qa') { it.qa.run(); return }
  openItem(it.item)
}

function runFlatLocator(index: number) {
  // 第卅六轮 REQ-039：单击搜索结果 → 跳转到对应视图 + 携带 drawer 打开详情（与 content script 一致）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'qa') { it.qa.run(); return }
  const item = it.item
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: item.id } })
    closeAll()
    emitOpenDrawer({ kind: 'res', id: item.id })
    return
  }
  if (item.type === 'task') {
    router.push({ path: '/', query: { hl: item.id } })
    closeAll()
    emitOpenDrawer({ kind: 'task', id: item.id })
    return
  }
  if (item.type === 'curio') {
    router.push({ path: '/', query: { hl: item.id } })
    closeAll()
    emitOpenDrawer({ kind: 'curio', id: item.id })
    return
  }
  if (item.type === 'ws') {
    router.push({ path: `/workspace/${item.id}` })
    closeAll()
    emitOpenDrawer({ kind: 'ws', id: item.id })
    return
  }
  closeAll()
}

function runSearch() { /* reactive, no-op */ }
function setType(t: 'all'|'res'|'task'|'curio'|'ws'|'proj') { currentType.value = t }
function clearFilter() { currentType.value = 'all' }

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); selIndex.value = Math.min(selIndex.value+1, flatList.value.length-1); scrollToSelected() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selIndex.value = Math.max(selIndex.value-1, 0); scrollToSelected() }
  else if (e.key === 'Enter') {
    e.preventDefault()
    if (selIndex.value < 0 || selIndex.value >= flatList.value.length) return
    // 第卅七轮 REQ-045：Enter=开链接（无链接定位）；Ctrl+Enter=定位并打开详情抽屉
    if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)
    else runFlat(selIndex.value)
  }
  else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；chip 与类型 Tab 行高亮同步更新
    e.preventDefault()
    const q = searchQuery.value.trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
    if (kw) { currentType.value = kw[1]; searchQuery.value = '' }
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

function selectResult(i: number, fromClick: boolean) {
  selIndex.value = i
  if (fromClick) openItem(filteredResults.value[i])
}

// 第卅七轮 REQ-045：300ms 同项去重——单击/双击都走 openItem，避免双击双开
let lastOpenId = ''
let lastOpenTs = 0
function openItem(item: SearchResult) {
  const now = Date.now()
  if (item?.id && item.id === lastOpenId && now - lastOpenTs < 300) return
  if (item?.id) { lastOpenId = item.id; lastOpenTs = now }
  if (item.type === 'ws') {
    // 第卅二轮 REQ-008：工作台条目 → 直接打开对应工作台
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
    // 第卅二轮 REQ-009 统一打开规则：有链接（URL/本地文件/Obsidian）→ 直接打开；无链接 → 定位到所在工作台并高亮
    const url = toOpenableUrl(r.linkType, r.link)
    if (url) {
      recordResourceOpen(d.value, r)
      store.persist()
      openExternalLink(url)
    } else if (r.link) {
      // 有链接值但不可打开（本地文件仅文件名）→ 跳工作台定位，提示补全
      showToast('⚠ 本地文件缺少完整路径，请到工作台补全')
      router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: r.id } })
    } else {
      router.push({ path: `/workspace/${r.workspaceId}`, query: { hl: r.id } })
      showToast('↗ 已定位到卡片所在工作台')
    }
  } else if (item.type === 'task') {
    recordCardOpen(d.value, d.value.tasks.find(t => t.id === item.id))
    store.persist()
    router.push({ path: '/', query: { hl: item.id } })
    showToast('↗ 已定位到调度台的任务')
  } else {
    recordCardOpen(d.value, d.value.curiosities.find(c => c.id === item.id))
    store.persist()
    router.push({ path: '/', query: { hl: item.id } })
    showToast('↗ 已定位到调度台好奇心')
  }
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
  // R55-H1：检索结果删除免二次确认——直接软删（allResults 过滤 !deletedAt，卡片即时从结果列表消失，可回收站恢复）
  if (item.type === 'res') { (item.raw as ResourceCard).deletedAt = Date.now() }
  else if (item.type === 'task') { (item.raw as TaskCard).deletedAt = Date.now() }
  else { (item.raw as CuriosityCard).deletedAt = Date.now() }
  store.persist()
  showToast('已删除，可在回收站恢复')
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
    { keys: 'Ctrl+Shift+K', desc: '打开工作台' },
  ]},
  { title: '应用内', items: [
    { keys: 'Alt+1', desc: '方向台（修饰键可自定义）' },
    { keys: 'Alt+2…9', desc: '各工作台' },
    { keys: '?', desc: '呼出本速查' },
  ]},
  { title: '编辑与导航', items: [
    { keys: 'Ctrl+Enter', desc: '保存并关闭（所有弹窗/抽屉）' },
    { keys: 'Esc', desc: '逐层关闭（浮层→抽屉→展板）' },
    { keys: 'Tab', desc: '搜索内循环切换类型' },
    { keys: '↑↓ / Enter', desc: '搜索结果选择与打开' },
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
const capCategories = computed(() => d.value.categories.filter(c => c.workspaceId === capForm.workspaceId))

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
  router.push({ path: '/compass', query: { zone: 'task' } })
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
    workspaceId: capForm.workspaceId || userWorkspaces.value[0]?.id || '',
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

function findProject(projId: string) {
  for (const dir of d.value.compass.directions) {
    for (const p of dir.projects) {
      if (p.id === projId) return p
    }
  }
  return null
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
  transform: translateY(-12px) scale(.98); opacity: 0; transition: all .15s cubic-bezier(.16,1,.3,1); overflow: hidden; }
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
  cursor: pointer; opacity: .6; transition: all .12s; font-size: 11px; }
.gp-chip-x:hover { opacity: 1; background: color-mix(in srgb, var(--accent) 15%, transparent); }
@keyframes gp-chipIn { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
.gp-search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 17px; font-weight: 500;
  color: var(--text); font-family: inherit; min-width: 0; line-height: 1.4; }
.gp-search-input::placeholder { color: var(--text-4); font-weight: 400; }
.gp-search-esc { font-size: 11px; color: var(--text-4); background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; padding: 3px 8px; flex-shrink: 0; cursor: pointer; transition: all .12s; font-family: inherit; }
.gp-search-esc:hover { color: var(--text-2); border-color: var(--border-strong); }

/* 类型Tab */
.gp-type-tabs { display: flex; gap: 2px; padding: 12px 22px 8px; }
.gp-type-tab { padding: 5px 12px; border-radius: 8px; font-size: 12.5px; color: var(--text-3); cursor: pointer;
  transition: all .12s; display: flex; align-items: center; gap: 5px; font-weight: 500; }
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
  animation: gp-itemIn .25s cubic-bezier(.16,1,.3,1) backwards; }
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
.gp-ri-link.url { color: var(--info-blue); }
.gp-ri-link.file { color: var(--curio-amber); }
.gp-ri-link.obsidian { color: var(--violet); }
.gp-ri-due { font-size: 10.5px; color: var(--text-3); }
.gp-ri-due.overdue { color: var(--tag-danger-text); font-weight: 600; }
.gp-ri-summary { font-size: 11.5px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 操作按钮 */
.gp-ri-actions { display: flex; gap: 3px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.gp-result-item:hover .gp-ri-actions, .gp-result-item.selected .gp-ri-actions { opacity: 1; }
.gp-ri-act { width: 28px; height: 28px; border-radius: 8px; border: 1px solid transparent; background: transparent;
  display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; color: var(--text-3);
  transition: all .12s; font-family: inherit; padding: 0; position: relative; }
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
  cursor: pointer; color: var(--text-3); font-size: 18px; transition: all .12s; flex-shrink: 0; background: transparent;
  border: none; font-family: inherit; }
.gp-cap-close:hover { background: var(--surface-3); color: var(--text); }

.gp-cap-body { padding: 18px 24px 20px; }
.gp-field { margin-bottom: 14px; }
.gp-field:last-child { margin-bottom: 0; }
.gp-field-label { display: block; font-size: 11.5px; font-weight: 600; color: var(--text-3); margin-bottom: 6px; letter-spacing: .2px; }
.gp-field-input { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 13.5px;
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; transition: all .15s; line-height: 1.5; }
.gp-field-input::placeholder { color: var(--text-4); }
.gp-field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }
textarea.gp-field-input { resize: vertical; min-height: 90px; font-size: 14px; line-height: 1.65; }
.gp-curio-text { min-height: 120px; }
.gp-curio-src { margin-top: 6px; font-size: 11px; color: var(--text-3); background: var(--surface-2); border: 1px dashed var(--border); border-radius: 6px; padding: 5px 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 链接类型 segmented */
.gp-seg-control { display: flex; gap: 3px; background: var(--surface-2); border-radius: var(--radius-sm); padding: 3px; margin-bottom: 8px; }
.gp-seg-btn { flex: 1; padding: 7px 8px; border-radius: 8px; border: none; background: transparent; font-size: 12px;
  color: var(--text-3); cursor: pointer; transition: all .15s; font-family: inherit; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 4px; }
.gp-seg-btn:hover { color: var(--text-2); }
.gp-seg-btn.active { background: var(--surface); color: var(--accent); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent); }

/* 双字段行 */
.gp-field-row { display: flex; gap: 10px; }
.gp-field-row .gp-field { flex: 1; }

/* 状态选择 */
.gp-status-select { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 13px;
  color: var(--text); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; transition: all .15s;
  appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA0A6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 13px center; }
.gp-status-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 14%, transparent); }

/* 底部按钮 */
.gp-cap-foot { display: flex; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--border); background: var(--surface-2); }
.gp-btn { padding: 9px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all .15s; border: 1px solid transparent; display: inline-flex; align-items: center; gap: 6px; }
.gp-btn-ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); }
.gp-btn-ghost:hover { border-color: var(--border-strong); color: var(--text); }
.gp-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); margin-left: auto;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--accent) 20%, transparent), 0 4px 12px color-mix(in srgb, var(--accent) 15%, transparent); }
.gp-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px);
  box-shadow: 0 2px 4px color-mix(in srgb, var(--accent) 25%, transparent), 0 8px 20px color-mix(in srgb, var(--accent) 20%, transparent); }
.gp-btn-primary:active { transform: translateY(0); }
</style>
