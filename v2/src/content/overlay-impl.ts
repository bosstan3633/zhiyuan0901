/**
 * Content Script · 全局浮层（搜索 / 快速采集资源卡 / 采集好奇心）
 *
 * 注入到所有 http/https 网页，纯 Vanilla JS，不引入 Vue 运行时。
 * - 全局搜索：居中 Raycast 式浮层
 * - 快速采集 / 好奇心采集：右上角小窗（对标 Obsidian Web Clipper，400×600）
 * - 采集流程：Enter 保存 →「已保存」状态 → Enter 打开看板（单例定位+高亮）→ Esc 关闭 → 5 秒自动消失
 * - 选中文本自动预填（资源卡描述 / 好奇心内容）
 * 保存后自动退出，不影响用户对当前页的操作。
 */

import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { getSelCache, clearSelCache, getSelectionText, resolveSelection } from './selection'

const ROOT_ID = '__zy_global_overlay__'
const DATA_KEY = 'zy_data_v2'

// ============ 数据读写 ============
async function loadData(): Promise<any> {
  const r = await chrome.storage.local.get(DATA_KEY)
  return r[DATA_KEY] || null
}
async function saveData(d: any) {
  await chrome.storage.local.set({ [DATA_KEY]: d })
}
function uid(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
}

// ============ 数据缓存（B36：搜索/采集每次按键不再重复读 storage） ============
let dataCache: any = null
let dataCacheAt = 0
async function getData(): Promise<any> {
  if (dataCache && Date.now() - dataCacheAt < 1500) return dataCache
  const d = await loadData()
  dataCache = d
  dataCacheAt = Date.now()
  ;(window as any).__zyDataCache = d
  return d
}
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[DATA_KEY]) {
      dataCache = changes[DATA_KEY].newValue
      dataCacheAt = Date.now()
      ;(window as any).__zyDataCache = dataCache
      // REQ-031 P-031-3：数据变更后计数缓存失效，下次查询重算
      invalidateCountCache()
    }
  })
}

// ============ 样式注入 ============
function injectStyles() {
  if (document.getElementById('__zy_styles__')) return
  const s = document.createElement('style')
  s.id = '__zy_styles__'
  s.textContent = `
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;}
    #${ROOT_ID}.open{display:block;}
    #${ROOT_ID} .zy-scrim{position:absolute;inset:0;background:rgba(15,17,20,.18);}
    #${ROOT_ID}.center{display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(245,243,238,.72);backdrop-filter:blur(20px) saturate(1.4);}
    #${ROOT_ID}.corner{display:flex;align-items:flex-start;justify-content:flex-end;padding:10px 10px 14px;}

    .zy-panel{position:relative;background:#FDFDFC;border-radius:16px;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 0 0 1px rgba(0,0,0,.05),0 12px 32px rgba(0,0,0,.10),0 32px 72px rgba(0,0,0,.14);overflow:hidden;font-size:14px;color:#1A1D23;animation:zyPanelIn .22s cubic-bezier(.16,1,.3,1);}
    @keyframes zyPanelIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    /* 居中搜索面板 */
    #${ROOT_ID}.center .zy-panel{width:640px;max-width:92vw;}
    /* 好奇心采集：居中 640px（D6） */
    #${ROOT_ID}.center .zy-panel.curio{width:640px;}
    /* 右上角采集小窗（对标 Obsidian Web Clipper：400×600） */
    #${ROOT_ID}.corner .zy-panel{width:400px;max-width:calc(100vw - 28px);max-height:min(600px,calc(100vh - 72px));overflow-y:auto;}
    .zy-panel::before{content:'';position:absolute;top:0;left:15%;right:15%;height:2px;background:linear-gradient(90deg,transparent,#0E7A4E 25%,#159258 50%,#0E7A4E 75%,transparent);border-radius:0 0 2px 2px;opacity:.9;}

    /* ===== 搜索 ===== */
    .zy-search-head{display:flex;align-items:center;gap:12px;padding:18px 22px 0;}
    .zy-search-icon{width:22px;height:22px;color:#9AA0A6;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
    .zy-search-input{flex:1;border:none;outline:none;background:transparent;font-size:17px;font-weight:500;color:#1A1D23;font-family:inherit;min-width:0;line-height:1.4;}
    .zy-search-input::placeholder{color:#BFC3C9;font-weight:400;}
    .zy-esc-btn{font-size:11px;color:#9AA0A6;background:#F7F5F0;border:1px solid #E8E5DE;border-radius:6px;padding:3px 8px;flex-shrink:0;cursor:pointer;font-family:inherit;}
    .zy-esc-btn:hover{color:#5C6370;border-color:#D4D0C8;}
    /* B29：搜索框内类型过滤 chip（与 Tab 切换同步，与新版应用内搜索一致） */
    .zy-search-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;background:#E7F3EC;color:#0E7A4E;font-size:12.5px;font-weight:600;flex-shrink:0;animation:zyChipIn .2s ease;}
    .zy-search-chip .zy-chip-x{width:15px;height:15px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.6;font-size:11px;}
    .zy-search-chip .zy-chip-x:hover{opacity:1;background:rgba(14,122,78,.15);}
    @keyframes zyChipIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
    .zy-type-tabs{display:flex;gap:2px;padding:12px 22px 8px;}
    .zy-type-tab{padding:5px 12px;border-radius:8px;font-size:12.5px;color:#9AA0A6;cursor:pointer;transition:all .12s;display:flex;align-items:center;gap:5px;font-weight:500;}
    .zy-type-tab:hover{color:#5C6370;background:#F7F5F0;}
    .zy-type-tab.active{color:#0E7A4E;background:#E7F3EC;font-weight:600;}
    .zy-type-tab .cnt{font-size:10.5px;color:#BFC3C9;font-weight:500;}
    .zy-type-tab.active .cnt{color:#0E7A4E;opacity:.7;}
    .zy-results{max-height:48vh;overflow-y:auto;padding:4px 12px 8px;}
    .zy-results::-webkit-scrollbar{width:6px;}
    .zy-results::-webkit-scrollbar-thumb{background:#D4D0C8;border-radius:3px;}
    .zy-result-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;cursor:pointer;border-left:3px solid transparent;transition:background .1s,border-color .1s;position:relative;margin-bottom:2px;}
    .zy-result-item:hover,.zy-result-item.sel{background:linear-gradient(90deg,#E7F3EC,rgba(231,243,236,.3) 60%,transparent);border-left-color:#0E7A4E;}
    .zy-ri-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
    .zy-ri-icon.res{background:#E9F1FA;}
    .zy-ri-icon.task-done{background:#E4F2E8;}
    .zy-ri-icon.task-doing{background:#FBF1DE;}
    .zy-ri-icon.task-todo{background:#EFEFEA;}
    .zy-ri-icon.curio{background:#F9F3E4;}
    .zy-ri-icon.ws{background:#E9EAF6;}
    .zy-badge.ws-badge{background:#E9EAF6;color:#3D439B;}
    .zy-ri-main{flex:1;min-width:0;}
    .zy-ri-title{font-size:14px;font-weight:600;color:#1A1D23;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;}
    .zy-ri-meta{display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;align-items:center;}
    .zy-badge{font-size:10.5px;padding:1.5px 8px;border-radius:99px;font-weight:500;line-height:1.5;}
    .zy-badge.ws{background:#E7F3EC;color:#0E7A4E;}
    .zy-badge.cat{background:#EFEDE7;color:#5C6370;}
    .zy-badge.prio-high{background:#FBEAEA;color:#C03B3B;}
    .zy-badge.prio-mid{background:#FBF1DE;color:#8A5A00;}
    .zy-badge.status-todo{background:#EFEFEA;color:#6E6E66;}
    .zy-badge.status-doing{background:#FBF1DE;color:#8A5A00;}
    .zy-badge.status-done{background:#E4F2E8;color:#2E7D42;}
    .zy-badge.curio-status{background:#EFEDE7;color:#5C6370;}
    .zy-ri-link{font-size:11px;color:#9AA0A6;display:flex;align-items:center;gap:3px;white-space:nowrap;}
    .zy-ri-link.url{color:#3573B9;}
    .zy-ri-link.file{color:#A87B2A;}
    .zy-ri-link.obsidian{color:#7C3AED;}
    .zy-ri-summary{font-size:11.5px;color:#9AA0A6;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zy-ri-del{font-size:12px;color:#9AA0A6;cursor:pointer;padding:3px 6px;border-radius:6px;flex-shrink:0;opacity:0;transition:all .12s;}
    .zy-result-item:hover .zy-ri-del{opacity:1;}
    .zy-ri-del:hover{color:#E5484D;background:rgba(229,72,77,.12);}
    .zy-group-title{font-size:10.5px;font-weight:700;color:#8A8F98;letter-spacing:.08em;padding:10px 12px 4px;}
    .zy-group-more{font-size:11px;color:#9AA0A6;padding:6px 12px;border-top:1px dashed rgba(138,143,152,.25);}
    .zy-empty{padding:40px 20px;text-align:center;color:#9AA0A6;}
    .zy-empty .icon{font-size:32px;margin-bottom:8px;opacity:.4;}
    .zy-empty .text{font-size:13px;line-height:1.7;}
    .zy-empty .text b{color:#5C6370;font-weight:600;}
    .zy-foot{display:flex;align-items:center;gap:16px;padding:10px 22px;border-top:1px solid #E8E5DE;background:#F7F5F0;font-size:11px;color:#BFC3C9;}
    .zy-foot kbd{background:#FDFDFC;border:1px solid #E8E5DE;border-radius:5px;padding:1px 6px;font-family:inherit;font-size:10.5px;color:#5C6370;margin:0 2px;box-shadow:0 1px 0 #E8E5DE;}
    .zy-foot .brand{margin-left:auto;font-size:10.5px;color:#BFC3C9;opacity:.7;letter-spacing:.3px;}

    /* ===== 采集小窗通用 ===== */
    .zy-cap-head{padding:18px 20px 0;display:flex;align-items:flex-start;gap:12px;}
    .zy-cap-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
    .zy-cap-icon.res{background:#E7F3EC;}
    .zy-cap-icon.curio{background:#F9F3E4;}
    .zy-cap-titles{flex:1;min-width:0;}
    .zy-cap-title{font-size:15.5px;font-weight:700;color:#1A1D23;letter-spacing:-.2px;}
    .zy-cap-sub{font-size:11px;color:#9AA0A6;margin-top:2px;}
    .zy-cap-close{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9AA0A6;font-size:17px;transition:all .12s;flex-shrink:0;background:transparent;border:none;font-family:inherit;}
    .zy-cap-close:hover{background:#EFEDE7;color:#1A1D23;}
    .zy-cap-body{padding:14px 20px 16px;}
    .zy-field{margin-bottom:12px;}
    .zy-field:last-child{margin-bottom:0;}
    .zy-field-label{display:block;font-size:11px;font-weight:600;color:#9AA0A6;margin-bottom:5px;letter-spacing:.2px;}
    .zy-field-input{width:100%;border:1px solid #E8E5DE;border-radius:10px;padding:9px 12px;font-size:13px;color:#1A1D23;background:#FDFDFC;outline:none;font-family:inherit;transition:all .15s;line-height:1.5;box-sizing:border-box;}
    .zy-field-input::placeholder{color:#BFC3C9;}
    .zy-field-input:focus{border-color:#0E7A4E;box-shadow:0 0 0 3px rgba(14,122,78,.14);}
    textarea.zy-field-input{resize:vertical;min-height:60px;font-size:13px;line-height:1.6;}
    .zy-seg-control{display:flex;gap:3px;background:#F7F5F0;border-radius:9px;padding:3px;margin-bottom:8px;}
    .zy-seg-btn{flex:1;padding:6px 6px;border-radius:7px;border:none;background:transparent;font-size:11.5px;color:#9AA0A6;cursor:pointer;transition:all .15s;font-family:inherit;font-weight:500;display:flex;align-items:center;justify-content:center;gap:3px;}
    .zy-seg-btn:hover{color:#5C6370;}
    .zy-seg-btn.active{background:#FDFDFC;color:#0E7A4E;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 1px rgba(14,122,78,.08);}
    .zy-field-row{display:flex;gap:10px;}
    .zy-field-row .zy-field{flex:1;}
    .zy-field-select{width:100%;border:1px solid #E8E5DE;border-radius:10px;padding:9px 12px;font-size:12.5px;color:#1A1D23;background:#FDFDFC;outline:none;font-family:inherit;cursor:pointer;transition:all .15s;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA0A6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;box-sizing:border-box;}
    .zy-field-select:focus{border-color:#0E7A4E;box-shadow:0 0 0 3px rgba(14,122,78,.14);}
    .zy-cur-src{margin-top:6px;font-size:11px;color:#5C6370;background:#F7F5F0;border:1px dashed #E8E5DE;border-radius:7px;padding:5px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zy-cap-foot{display:flex;gap:10px;padding:12px 20px;border-top:1px solid #E8E5DE;background:#F7F5F0;}
    .zy-btn{padding:8px 16px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;border:1px solid transparent;display:inline-flex;align-items:center;gap:6px;}
    .zy-btn-ghost{background:#FDFDFC;border-color:#E8E5DE;color:#5C6370;}
    .zy-btn-ghost:hover{border-color:#D4D0C8;color:#1A1D23;}
    .zy-btn-primary{background:#0E7A4E;color:#fff;border-color:#0E7A4E;margin-left:auto;box-shadow:0 1px 2px rgba(14,122,78,.2),0 4px 12px rgba(14,122,78,.15);}
    .zy-btn-primary:hover{background:#0B6440;transform:translateY(-1px);}
    .zy-btn-primary:active{transform:translateY(0);}

    /* 已保存状态条 */
    .zy-saved{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px 48px;text-align:center;}
    .zy-saved-icon{width:52px;height:52px;border-radius:50%;background:#E4F2E8;color:#2E7D42;font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:14px;animation:zyPop .35s cubic-bezier(.34,1.56,.64,1);}
    @keyframes zyPop{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
    .zy-saved-title{font-size:16px;font-weight:700;color:#1A1D23;margin-bottom:6px;}
    .zy-saved-hint{font-size:13px;color:#0E7A4E;font-weight:600;}
    .zy-saved-hint kbd,.zy-saved-sub kbd{background:#F7F5F0;border:1px solid #E8E5DE;border-radius:5px;padding:1px 7px;font-family:inherit;font-size:11px;color:#5C6370;}
    .zy-saved-sub{font-size:11.5px;color:#9AA0A6;margin-top:4px;}
    .zy-saved-actions{display:flex;gap:10px;margin-top:20px;}

    /* 保存成功提示 */
    .zy-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(12px);background:#1A1D23;color:#fff;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:500;z-index:2147483647;opacity:0;transition:all .25s cubic-bezier(.16,1,.3,1);pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.2);display:flex;align-items:center;gap:8px;max-width:90vw;}
    .zy-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
  `
  document.documentElement.appendChild(s)
}

// ============ 根容器 ============
function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    document.documentElement.appendChild(root)
  }
  return root
}

/** 打开浮层：center=居中搜索；corner=右上角采集小窗 */
function openOverlay(mode: 'center' | 'corner', onScrimClick?: () => void) {
  injectStyles() // V2.21：样式注入收敛到真正渲染浮层时（幂等），页面加载期不再触碰 DOM
  const root = ensureRoot()
  root.className = mode === 'center' ? 'center open' : 'corner open'
  root.innerHTML = ''
  if (onScrimClick) {
    const scrim = document.createElement('div')
    scrim.className = 'zy-scrim'
    scrim.addEventListener('click', onScrimClick)
    root.appendChild(scrim)
  }
}
function closeOverlay() {
  const root = document.getElementById(ROOT_ID)
  if (root) {
    root.classList.remove('open', 'center', 'corner')
    root.innerHTML = ''
    document.removeEventListener('keydown', onSavedKeydown, true)
  }
}

// ============ Toast ============
function showToast(msg: string, duration = 2000) {
  let t = document.getElementById('__zy_toast__')
  if (!t) {
    t = document.createElement('div')
    t.id = '__zy_toast__'
    t.className = 'zy-toast'
    document.documentElement.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), duration)
}

// ============ 选区捕获 ============
// 第廿二轮加固体系已抽到 ./selection：信号层负责注册监听（含子帧转发），
// 浮层实现层只读缓存。这样子帧无需加载本文件即可完成选区捕获。
// ============ 全局搜索浮层（居中 Raycast 式） ============
let searchType: 'all' | 'res' | 'task' | 'curio' | 'ws' | 'proj' = 'all'
let searchSelIndex = 0
let searchResults: any[] = []
let lastQuery = ''

async function openSearch() {
  // V2.21：唤起即用——浮层与纯文本搜索立即生效，拼音字典并行后台加载，不阻塞首帧
  void ensurePinyin()
  searchType = 'all'
  searchSelIndex = 0
  openOverlay('center', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-search-head">
      <div class="zy-search-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </div>
      <span id="__zy_chip__" class="zy-search-chip" style="display:none"><span id="__zy_chip_label__"></span><span class="zy-chip-x" id="__zy_chip_x__">×</span></span>
      <input id="__zy_si__" type="text" class="zy-search-input" placeholder="搜索全部卡片…" autocomplete="off" spellcheck="false">
      <button class="zy-esc-btn" id="__zy_esc__">Esc</button>
    </div>
    <div class="zy-type-tabs" id="__zy_tabs__"></div>
    <div class="zy-results" id="__zy_results__"></div>
    <div class="zy-foot">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>⏎</kbd> 打开</span>
      <span><kbd>Tab</kbd> 切换类型</span>
      <span><kbd>Esc</kbd> 关闭</span>
      <span class="zy-foot-brand">知源调度台 · 你不缺信息，你缺一座控制中心</span>
    </div>
  `
  root.appendChild(panel)
  const input = document.getElementById('__zy_si__') as HTMLInputElement
  setTimeout(() => input?.focus(), 50)
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  input.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => runSearch(input.value), 60) // REQ-046：输入防抖 90→60ms（速度第一）
  })
  input.addEventListener('keydown', onSearchKeydown)
  document.getElementById('__zy_esc__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_chip_x__')?.addEventListener('click', () => {
    searchType = 'all'
    searchSelIndex = 0
    renderTypeTabs()
    runSearch(input?.value || '')
  })
  renderTypeTabs()
  runSearch('')
}

function typeLabel(t: 'all'|'res'|'task'|'curio'|'ws'|'proj'): string {
  return t === 'res' ? '📄 资源卡' : t === 'task' ? '✅ 任务卡' : t === 'curio' ? '💡 好奇心' : t === 'ws' ? '🗂 工作台' : t === 'proj' ? '📦 项目' : '🔍 搜全部'
}

/** B29：搜索框前过滤 chip（searchType 非 all 时出现，与 Tab / Tab 行同步） */
function updateChip() {
  const chip = document.getElementById('__zy_chip__')
  if (!chip) return
  const label = document.getElementById('__zy_chip_label__')
  chip.style.display = searchType === 'all' ? 'none' : 'inline-flex'
  if (label) label.textContent = typeLabel(searchType)
}

// REQ-031 P-031-3：类型计数缓存——仅数据变更时重算（onChanged 失效），避免每键全量 filter ×5
let countCache: Record<string, number> | null = null
function invalidateCountCache() { countCache = null }
function computeCounts(): Record<string, number> {
  const d = dataCache || (window as any).__zyDataCache
  const c: Record<string, number> = { all: 0, res: 0, task: 0, curio: 0, ws: 0, proj: 0 }
  if (d) {
    for (const r of d.resources || []) if (!r.deletedAt) c.res++
    for (const t of d.tasks || []) if (!t.deletedAt) c.task++
    for (const x of d.curiosities || []) if (!x.deletedAt) c.curio++
    for (const w of d.workspaces || []) if (!w.archived) c.ws++
    for (const dir of (d.compass && d.compass.directions) || []) for (const p of dir.projects || []) if (!p.archived && p.status !== 'archived') c.proj++
    c.all = c.res + c.task + c.curio
  }
  countCache = c
  return c
}
function countByType(type: string): number {
  return (countCache || computeCounts())[type] || 0
}

function renderTypeTabs() {
  const tabs = document.getElementById('__zy_tabs__')
  if (!tabs) return
  // REQ-031 P-031-3：仅 searchType 变化才重建 tab DOM；纯输入只更新计数
  const current = tabs.getAttribute('data-search-type')
  if (current === searchType && tabs.children.length) {
    tabs.querySelectorAll('.zy-type-tab').forEach(el => {
      const cnt = el.querySelector('.cnt')
      if (cnt) cnt.textContent = String(countByType((el as HTMLElement).dataset.type as string))
    })
    updateChip()
    return
  }
  const types = [
    { key: 'all', label: '🔍 搜全部' },
    { key: 'res', label: '📄 资源卡' },
    { key: 'task', label: '✅ 任务卡' },
    { key: 'curio', label: '💡 好奇心' },
    { key: 'ws', label: '🗂 工作台' },
    { key: 'proj', label: '📦 项目' }
  ]
  tabs.setAttribute('data-search-type', searchType)
  tabs.innerHTML = types.map(t => {
    const count = countByType(t.key as any)
    return `<div class="zy-type-tab${searchType === t.key ? ' active' : ''}" data-type="${t.key}">${t.label} <span class="cnt">${count}</span></div>`
  }).join('')
  tabs.querySelectorAll('.zy-type-tab').forEach(el => {
    el.addEventListener('click', () => {
      searchType = (el as HTMLElement).dataset.type as any
      searchSelIndex = 0
      renderTypeTabs()
      renderResults()
    })
  })
  updateChip()
}

async function runSearch(q: string, opts?: { mergeAppend?: boolean }) {
  lastQuery = (q || '').trim()
  let d: any = null
  try {
    d = await getData()
  } catch (e) { console.error('[知源] 搜索数据读取失败', e) }
  renderTypeTabs()
  const results: any[] = []
  if (!d) { searchResults = []; renderResults(); return }
  try {
    // REQ-031 P-031-1：一次构建关联 Map（ws/cat/project 名称 + 卡数累加），collectResults 内 O(1) 查找
    const maps = buildSearchMaps(d)
    collectResults(d, query0(q), results, maps)
  } catch (e) {
    // B35/B36：任何数据形态异常都不允许搜索区空白
    console.error('[知源] 搜索执行异常', e)
  }
  // R48-A2：拼音补跑走「冻结顺序、仅追加」——已有结果保持原位不重排（用户正在浏览/点击时列表不得跳动），
  // 仅把拼音新命中的条目追加到末尾；普通检索（用户主动输入/切类型）仍全量重算 + 重排。
  if (opts?.mergeAppend && searchResults.length && lastQuery) {
    const keyOf = (x: any) => (x?.type || '') + ':' + String(x?.id || x?.title || '')
    const seen = new Set(searchResults.map(keyOf))
    for (const r of results) {
      if (!seen.has(keyOf(r))) { searchResults.push(r); seen.add(keyOf(r)) }
    }
  } else {
    searchResults = results
    // 第卅三轮 REQ-020：全局检索加权排序（与应用内搜索同口径）—— 置顶 > 星标 > 命中度，稳定排序
    searchResults.sort((a: any, b: any) => {
      const rank = (x: any) => x?.raw ? (x.raw.pinned ? 2 : x.raw.starred ? 1 : 0) : 0
      return rank(b) - rank(a)
    })
  }
  searchSelIndex = Math.min(searchSelIndex < 0 ? 0 : searchSelIndex, Math.max(searchResults.length - 1, -1))
  renderResults()  // V2.21：拼音字典异步加载，未就绪时 matchPinyin 降级为 false（纯文本匹配照常生效）。
  // 字典到位后自动用同一查询词补跑一次，把拼音/首字母命中补进结果——用户无需任何感知。
  armPinyinRefresh()
}

/**
 * 拼音字典就绪后刷新结果（一次性、有守卫）。
 * 仅在「有查询词 + 字典未就绪 + 浮层仍打开」时补跑，避免无谓重算。
 */
let pinyinRefreshArmed = false
function armPinyinRefresh(): void {
  if (pinyinRefreshArmed) return
  if (!lastQuery || isPinyinReady()) return
  pinyinRefreshArmed = true
  onPinyinReady(() => {
    pinyinRefreshArmed = false
    const root = document.getElementById(ROOT_ID)
    if (!root || !root.classList.contains('open')) return
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    if (!input) return
    // R48-A2：mergeAppend —— 补跑只追加拼音新命中，冻结既有顺序，杜绝点击瞬间行序错位
    void runSearch(input.value, { mergeAppend: true })
  })
}

function query0(q: string): string { return (q || '').trim().toLowerCase() }
function hl(title: string): string {
  const esc = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const q = lastQuery
  if (!q) return esc
  const i = esc.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return esc
  return esc.slice(0, i) + '<mark class="zy-hl" style="background:rgba(94,106,210,.32);color:#1A1D23;border-radius:3px;">' + esc.slice(i, i + q.length) + '</mark>' + esc.slice(i + q.length)
}

// REQ-031 P-031-1：搜索关联 Map 化——一次遍历构建 ws/cat/project 名称 Map + 工作台卡数累加，查找 O(1)
interface SearchMaps {
  wsName: Map<string, string>
  catName: Map<string, string>
  projName: Map<string, string>
  wsCount: Map<string, number>
}
function buildSearchMaps(d: any): SearchMaps {
  const wsName = new Map<string, string>()
  const catName = new Map<string, string>()
  const projName = new Map<string, string>()
  const wsCount = new Map<string, number>()
  for (const w of d.workspaces || []) wsName.set(w.id, w.name || '未知')
  for (const c of d.categories || []) catName.set(c.id, c.name || '')
  for (const dir of d.compass?.directions || [])
    for (const p of dir.projects || []) projName.set(p.id, p.name)
  for (const r of d.resources || []) {
    if (r.deletedAt) continue
    wsCount.set(r.workspaceId, (wsCount.get(r.workspaceId) || 0) + 1)
  }
  return { wsName, catName, projName, wsCount }
}

function collectResults(d: any, query: string, results: any[], maps: SearchMaps) {
  const match = (text: string) => !query || text.toLowerCase().includes(query)
  // 第十九轮：拼音/首字母命中（按标题）

  // 资源卡
  if (searchType === 'all' || searchType === 'res') {
    d.resources?.filter((r: any) => !r.deletedAt).forEach((r: any) => {
      const ws = maps.wsName.get(r.workspaceId)
      const cat = maps.catName.get(r.categoryId)
      const blob = r.title + ' ' + (r.description || '') + ' ' + (Array.isArray(r.tags) ? r.tags : []).join(',') + ' ' + (r.link || '')
      if (match(blob) || matchPinyin(r.title || '', query)) {
        results.push({
          type: 'res', iconClass: 'res', iconText: '📄', id: r.id,
          title: r.title, ws: ws || '未知', cat: cat || '待分类',
          badges: [], link: r.link ? { type: r.linkType, text: linkShort(r.link) } : null,
          summary: r.description, raw: r
        })
      }
    })
  }
  // 任务卡
  if (searchType === 'all' || searchType === 'task') {
    d.tasks?.filter((t: any) => !t.deletedAt).forEach((t: any) => {
      const projName = maps.projName.get(t.projectId) || '未归属'
      const badges: any[] = []
      if (t.priority === 'high') badges.push({ type: 'prio-high', text: '🔴 高' })
      else if (t.priority === 'medium') badges.push({ type: 'prio-mid', text: '🟡 中' })
      badges.push({ type: `status-${t.status}`, text: t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始' })
      // R58-B4：命中字段两端同构——任务补标签 + 项目名（与应用内一致）
      const tTags = Array.isArray(t.tags) ? t.tags.join(' ') : ''
      const blob = t.title + ' ' + (t.description || '') + ' ' + tTags + ' ' + projName
      if (match(blob) || matchPinyin(t.title || '', query)) {
        const statusIcon = t.status === 'done' ? '✓' : t.status === 'doing' ? '◐' : '○'
        results.push({
          type: 'task', iconClass: `task-${t.status}`, iconText: statusIcon, id: t.id,
          title: t.title, ws: '任务中心', cat: projName, badges, summary: t.description, raw: t
        })
      }
    })
  }
  // 好奇心
  if (searchType === 'all' || searchType === 'curio') {
    d.curiosities?.filter((c: any) => !c.deletedAt).forEach((c: any) => {
      const statusText = c.status === 'todo' ? '🔵 待探索' : c.status === 'doing' ? '🟡 探索中' : c.status === 'done' ? '🟢 已求证' : '⚪ 已搁置'
      const cTags = Array.isArray(c.tags) ? c.tags.join(' ') : ''
      if (match(c.question + ' ' + cTags) || matchPinyin(c.question || '', query)) {
        results.push({
          type: 'curio', iconClass: 'curio', iconText: '💡', id: c.id,
          title: c.question, ws: '调度台', cat: '好奇心',
          badges: [{ type: 'curio-status', text: statusText }], raw: c
        })
      }
    })
  }

  // 第卅二轮 REQ-008：检索范围扩展至工作台实体（模糊匹配工作台名称，专属图标）
  if (searchType === 'all' || searchType === 'ws') {
    d.workspaces?.filter((w: any) => !w.archived).forEach((w: any) => {
      if (match(w.name || '') || matchPinyin(w.name || '', query)) {
        const cardCount = maps.wsCount.get(w.id) || 0
        results.push({
          type: 'ws', iconClass: 'ws', iconText: '🗂', id: w.id,
          title: w.name, ws: '工作台', cat: cardCount + ' 张资源卡',
          badges: [{ type: 'ws-badge', text: '工作台' }], raw: w
        })
      }
    })
  }

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=）
  // 说明：content 端无 UIPrefs 缓存，已完成项目默认呈现（newtab 端按 showDoneProjects 开关过滤）
  if (searchType === 'all' || searchType === 'proj') {
    ;((d.compass && d.compass.directions) || []).forEach((dir: any) => {
      ;(dir.projects || []).forEach((p: any) => {
        const badges: any[] = []
        if (p.isFocused) badges.push({ type: 'prio-high', text: '🎯 主攻' })
        if (p.pinnedToLighthouse) badges.push({ type: 'ws-badge', text: '📡 已投射' })
        if (p.status === 'archived') badges.push({ type: 'curio-status', text: '已完成' })
        if (match(p.name || '') || matchPinyin(p.name || '', query)) {
          results.push({
            type: 'proj', iconClass: 'ws', iconText: '📦', id: p.id,
            title: p.name, ws: '方向台', cat: dir.name || '—',
            badges, raw: p
          })
        }
      })
    })
  }

}

const QUICK_ACTIONS_ZY = [
  { label: '打开方向台', icon: 'compass', route: '/compass' },
  { label: '打开项目详情', icon: 'layout', route: '/compass/projects' },
  { label: '打开方向树', icon: 'branch', route: '/compass/tree' },
  { label: '打开设置', icon: 'settings', route: '/settings' }
]

function bindResultEvents(el: HTMLElement) {
  // R48-A2：点击以目标 id 为准——不再依赖行序号。拼音补跑/重渲染期间 searchResults 可能被
  // 替换或重排，按 idx 取值会「点 A 开 B」；按 id 在最新结果集中解析，错位窗口内点到的永远是那张卡。
  const resolveResult = (elm: HTMLElement): any => {
    const id = elm.dataset.id
    if (id) {
      const hit = searchResults.find(r => String(r?.id || '') === id)
      if (hit) return hit
    }
    const idx = parseInt(elm.dataset.idx || '-1')
    return idx >= 0 ? searchResults[idx] : undefined
  }
  el.querySelectorAll('.zy-result-item').forEach(elm => {
    const e = elm as HTMLElement
    // 第卅七轮 REQ-045：交互固化——单击/Enter=开链接（无链接则定位）；Ctrl+Enter=定位+详情抽屉；双击=开链接（去重防双开）
    e.title = '单击 → 打开链接（无链接则定位） · Ctrl+Enter → 定位并打开详情'
    // R55-H2：🗑 直接删除（无二次确认，软删进回收站）——先于行点击，阻断打开链接
    const delBtn = e.querySelector('.zy-ri-del') as HTMLElement | null
    if (delBtn) {
      delBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation()
        const id = delBtn.dataset.delId || ''
        const d2 = await getData()
        if (!d2) return
        const hit = (d2.resources || []).find((r: any) => r.id === id) ||
          (d2.tasks || []).find((r: any) => r.id === id) ||
          (d2.curiosities || []).find((r: any) => r.id === id)
        if (!hit || hit.deletedAt) return
        hit.deletedAt = Date.now()
        await saveData(d2)
        searchResults = searchResults.filter(r => String(r?.id || '') !== id)
        renderResults()
        showToast('已删除，可在回收站恢复')
      })
    }
    e.addEventListener('click', () => {
      const item = resolveResult(e)
      if (item) openSearchResult(item)
    })
    e.addEventListener('dblclick', () => {
      // 双击 = 开链接；click 已处理，此处仅作兜底（300ms 去重保证只开一次）
      const item = resolveResult(e)
      if (item) openSearchResult(item)
    })
    e.addEventListener('mouseenter', () => {
      searchSelIndex = parseInt(e.dataset.idx || '0')
      document.querySelectorAll('.zy-result-item').forEach((e2, j) => e2.classList.toggle('sel', j === searchSelIndex))
    })
  })
}

function renderResults() {
  const el = document.getElementById('__zy_results__')
  if (!el) return
  // B1：浏览模式（空查询 + 全部）= 快捷操作 + 近期最常用（R47-B4：全类型按调用次数降序）
  if (!lastQuery && searchType === 'all') {
    const dc = dataCache
    const heat: any[] = []
    const pushHeat = function (x: any, type: string, iconText: string, title: string) {
      if (x && !x.deletedAt && (x.callCount || 0) > 0) heat.push({ type: type, iconClass: type === 'ws' ? 'ws' : type, iconText: iconText, id: x.id, title: title, ws: '', cat: '', badges: [], raw: x })
    }
    ;(dc && dc.resources ? dc.resources : []).forEach(function (r: any) { pushHeat(r, 'res', '📄', r.title) })
    ;(dc && dc.tasks ? dc.tasks : []).forEach(function (t: any) { pushHeat(t, 'task', '✅', t.title) })
    ;(dc && dc.curiosities ? dc.curiosities : []).forEach(function (c: any) { pushHeat(c, 'curio', '💡', c.question) })
    ;(dc && dc.workspaces ? dc.workspaces : []).forEach(function (w: any) { pushHeat(w, 'ws', '🗂', w.name) })
    heat.sort(function (a: any, b: any) {
      const dc2 = (b.raw.callCount || 0) - (a.raw.callCount || 0)
      return dc2 !== 0 ? dc2 : (b.raw.lastCalledAt || 0) - (a.raw.lastCalledAt || 0)
    })
    const recent = heat.slice(0, 8)
    searchResults = [
      ...QUICK_ACTIONS_ZY.map(function (qa) { return { type: 'qa', qa: qa } }),
      ...recent.map(function (r: any) { return { type: 'res', iconClass: 'res', iconText: '📄', id: r.id, title: r.title, ws: '', cat: '', badges: [], raw: r } })
    ]
    searchSelIndex = searchResults.length ? 0 : -1
    const qaHtml = QUICK_ACTIONS_ZY.map(function (qa, i) {
      return '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '">' +
        '<div class="zy-ri-icon res">↵</div>' +
        '<div class="zy-ri-main"><div class="zy-ri-title">' + qa.label + '</div></div></div>'
    }).join('')
    const recentHtml = recent.length
      ? '<div class="zy-group-title">🔥 近期最常用 · 按调用次数</div>' + recent.map(function (r: any, j: number) {
        return '<div class="zy-result-item' + (QUICK_ACTIONS_ZY.length + j === searchSelIndex ? ' sel' : '') + '" data-idx="' + (QUICK_ACTIONS_ZY.length + j) + '" data-id="' + escapeHtml(String(r.id || '')) + '">' +
          '<div class="zy-ri-icon ' + r.iconClass + '">' + r.iconText + '</div>' +
          '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(r.title) + '</div></div>' +
          '<span class="zy-ri-link url">🔥' + (r.raw.callCount || 0) + '</span></div>'
      }).join('')
      : ''
    el.innerHTML = '<div class="zy-group-title">快捷操作</div>' + qaHtml + recentHtml
    bindResultEvents(el)
    return
  }
  // R49-G2：工作台类型 → 工作台→分类树（点击分类定位：有卡高亮第一张，无卡高亮分类行）
  if (searchType === 'ws') {
    const d2: any = dataCache || (window as any).__zyDataCache
    const q = lastQuery.toLowerCase()
    const wss = (d2?.workspaces || []).filter((w: any) => !w.archived && (!q || (w.name || '').toLowerCase().includes(q)))
    let treeHtml = ''
    for (const w of wss) {
      const cats = (d2?.categories || []).filter((c: any) => c.workspaceId === w.id && (!q || (c.name || '').toLowerCase().includes(q)))
      const wsCards = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id).length
      treeHtml += '<div class="zy-group-title">🗂 ' + escapeHtml((w.name || '').replace(/^[^\s]+\s/, '')) + ' <span style="color:#BFC3C9;font-weight:400">' + wsCards + ' 张卡</span></div>'
      for (const c of cats) {
        const fam = new Set<string>([c.id, ...(d2?.categories || []).filter((x: any) => x.parentId === c.id).map((x: any) => x.id)])
        const cnt = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id && fam.has(r.categoryId || '')).length
        treeHtml += '<div class="zy-result-item" data-wscat="' + escapeHtml(w.id) + '" data-catid="' + escapeHtml(c.id) + '">' +
          '<div class="zy-ri-icon ws">📁</div>' +
          '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(c.name || '') + '</div>' +
          '<div class="zy-ri-meta"><span class="zy-badge cat">' + cnt + ' 张卡</span>' + (cnt ? '' : '<span class="zy-badge">空分类 · 定位到分类</span>') + '</div></div>' +
          '<span class="zy-ri-link url">定位 ↗</span></div>'
      }
      if (!cats.length) treeHtml += '<div class="zy-group-more">该工作台暂无分类</div>'
    }
    el.innerHTML = treeHtml || '<div class="zy-empty"><div class="icon">🗂</div><div class="text">没有匹配的工作台</div></div>'
    el.querySelectorAll<HTMLElement>('.zy-result-item[data-wscat]').forEach(n => {
      n.addEventListener('click', () => {
        const wsId = n.dataset.wscat || ''
        const catId = n.dataset.catid || ''
        try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/workspace/' + wsId + '?cat=' + catId }) } catch {}
        showToast('↗ 已定位到分类')
        closeOverlay()
      })
    })
    return
  }
  if (!searchResults.length) {
    el.innerHTML = '<div class="zy-empty"><div class="icon">🪹</div><div class="text">没有匹配的卡片<br><span style="font-size:11px">试试更短的关键词</span></div></div>'
    return
  }
  const groups = [
    { label: '📄 资源卡', type: 'res' },
    { label: '✅ 任务卡', type: 'task' },
    { label: '💡 好奇心', type: 'curio' },
    { label: '🗂 工作台', type: 'ws' },
    { label: '📦 项目', type: 'proj' }
  ]
  // REQ-031 P-031-2：单次 for 按 type 归桶（去掉 filter + indexOf 嵌套，O(n)）
  const buckets: Record<string, any[]> = { res: [], task: [], curio: [], ws: [], proj: [] }
  for (const r of searchResults) if (buckets[r.type]) buckets[r.type].push(r)
  // REQ-046 速度优化：每组最多渲染 30 条，防 DOM 爆炸（超大结果集首屏秒出）
  const MAX_PER_GROUP = 30
  let html = ''
  let offset = 0
  for (const g of groups) {
    const items = buckets[g.type]
    if (!items.length) continue
    const shown = items.slice(0, MAX_PER_GROUP)
    const rest = items.length - shown.length
    html += '<div class="zy-group-title">' + g.label + ' <span style="color:#BFC3C9;font-weight:400">' + items.length + '</span></div>'
    shown.forEach(function (item: any, j: number) {
      const i = offset + j
      const badgesHtml = item.badges.map(function (b: any) { return '<span class="zy-badge ' + b.type + '">' + b.text + '</span>' }).join('')
      const linkHtml = item.link ? '<span class="zy-ri-link ' + item.link.type + '">' + (item.link.type === 'url' ? '🔗' : item.link.type === 'file' ? '📁' : '📝') + ' ' + item.link.text + '</span>' : ''
      const summaryHtml = item.summary ? '<div class="zy-ri-summary">' + hl(item.summary) + '</div>' : ''
      // R55-H2：三卡结果行提供直接删除（无二次确认，软删进回收站）
      const delHtml = (g.type === 'res' || g.type === 'task' || g.type === 'curio')
        ? '<span class="zy-ri-del" data-del-id="' + escapeHtml(String(item.id || '')) + '" title="直接删除（可回收站恢复）">🗑</span>'
        : ''
      html += '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '" data-id="' + escapeHtml(String(item.id || '')) + '">' +
        '<div class="zy-ri-icon ' + item.iconClass + '">' + item.iconText + '</div>' +
        '<div class="zy-ri-main">' +
        '<div class="zy-ri-title">' + hl(item.title) + '</div>' +
        '<div class="zy-ri-meta"><span class="zy-badge ws">' + escapeHtml(item.ws) + '</span><span class="zy-badge cat">' + escapeHtml(item.cat) + '</span>' + badgesHtml + linkHtml + '</div>' +
        summaryHtml + '</div>' + delHtml + '</div>'
    })
    if (rest > 0) html += '<div class="zy-group-more">… 还有 ' + rest + ' 条，输入更精确的关键词</div>'
    offset += items.length
  }
  el.innerHTML = html
  bindResultEvents(el)
}

void 0;

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchSelIndex = Math.min(searchSelIndex + 1, searchResults.length - 1)
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchSelIndex = Math.max(searchSelIndex - 1, 0)
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!searchSelIndex && searchSelIndex !== 0) return
    if (searchResults[searchSelIndex]) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter：定位到卡片所在处并打开详情抽屉
        openSearchLocator(searchResults[searchSelIndex])
      } else {
        // Enter：直接打开链接（无链接则定位）
        openSearchResult(searchResults[searchSelIndex])
      }
    }
  } else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；搜索框 chip 与类型 Tab 行同步更新
    e.preventDefault()
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    const q = (input?.value || '').trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
    if (kw) {
      searchType = kw[1]
      if (input) input.value = ''
    } else {
      const cycle: Array<'all'|'res'|'task'|'curio'|'ws'|'proj'> = ['all', 'res', 'task', 'curio', 'ws', 'proj']
      searchType = cycle[(cycle.indexOf(searchType) + 1) % cycle.length]
    }
    searchSelIndex = 0
    renderTypeTabs()
    runSearch(input?.value || '')
    showToast('🔍 ' + typeLabel(searchType))
  } else if (e.key === 'Escape') {
    closeOverlay()
  }
}

function openSearchLocator(item: any) {
  // 第卅七轮 REQ-045：Ctrl+Enter / 定位专用 —— 跳转到对应视图 + 打开详情抽屉
  // 走 zy-open-route（background 有处理）+ 透传 drawer 参数（background 转发给宿主 newtab）
  const send = (route: string, drawer: { kind: string; id: string }) => {
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route, drawer }) } catch {}
  }
  if (item.type === 'qa') {
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: item.qa.route }) } catch {}
    closeOverlay()
    return
  }
  if (item.type === 'ws') {
    send('/workspace/' + item.id, { kind: 'ws', id: item.id })
    closeOverlay()
    return
  }
  if (item.type === 'proj') {
    send('/compass/projects?p=' + item.id, { kind: 'project', id: item.id })
    closeOverlay()
    return
  }
  if (item.type === 'res') {
    send('/workspace/' + item.raw.workspaceId, { kind: 'res', id: item.id })
  } else if (item.type === 'task') {
    send('/', { kind: 'task', id: item.id })
  } else {
    // 好奇心/项目：跳调度台抽屉由 CuriosityPanel 处理；项目走 CompassTree
    send('/', { kind: item.type === 'curio' ? 'curio' : 'project', id: item.id })
  }
  closeOverlay()
}

// 300ms 同项去重：单击/双击都走 openSearchResult，避免双击双开
let lastOpenId = ''
let lastOpenTs = 0
/** R47-B4：content 端通用热度计数（task/curio/ws），与 newtab 端 recordCardOpen 口径一致 */
function bumpHeat(kind: 'task' | 'curio' | 'ws', id: string) {
  loadData().then((d2: any) => {
    if (!d2) return
    const pool = kind === 'ws' ? d2.workspaces : kind === 'task' ? d2.tasks : d2.curiosities
    const hit = pool?.find((x: any) => x.id === id)
    if (hit) { hit.callCount = (hit.callCount || 0) + 1; hit.lastCalledAt = Date.now(); saveData(d2) }
  })
}
function openSearchResult(item: any) {
  const now = Date.now()
  if (item?.id && item.id === lastOpenId && now - lastOpenTs < 300) return
  if (item?.id) { lastOpenId = item.id; lastOpenTs = now }
  // 第卅七轮 REQ-045：单击/Enter/双击 —— 直接打开链接；无链接则定位到卡片所在处
  if (item.type === 'qa') {
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: item.qa.route }) } catch {}
    closeOverlay()
    return
  }
  if (item.type === 'ws') {
    bumpHeat('ws', item.id)
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/workspace/' + item.id }) } catch {}
    closeOverlay()
    return
  }
  if (item.type === 'proj') {
    // R49-G：项目条目 → 直达项目详情（二级页）
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/compass/projects?p=' + item.id }) } catch {}
    showToast('↗ 已打开项目详情')
    closeOverlay()
    return
  }
  if (item.type === 'res') {
    const r = item.raw
    if (r.link) {
      // 打开即计数（WRR 口径：搜索打开也算被打开）
      r.callCount = (r.callCount || 0) + 1
      r.lastCalledAt = Date.now()
      loadData().then(d2 => {
        if (d2) {
          const hit = d2.resources?.find((x: any) => x.id === r.id)
          if (hit) { hit.callCount = r.callCount; hit.lastCalledAt = r.lastCalledAt }
          saveData(d2)
        }
      })
      if (r.linkType === 'url') window.open(r.link, '_blank')
      else if (r.linkType === 'obsidian') window.open(r.link, '_blank')
      else {
        const fileUrl = toFileUrl(r.link)
        if (fileUrl) window.open(fileUrl, '_blank')
        else {
          showToast('⚠ 本地文件缺少完整路径，请到工作台补全')
          try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/workspace/' + r.workspaceId + '?hl=' + r.id }) } catch {}
        }
      }
    } else {
      try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/workspace/' + r.workspaceId + '?hl=' + r.id }) } catch {}
      showToast('↗ 已定位到卡片所在工作台')
    }
  } else if (item.type === 'task') {
    bumpHeat('task', item.id)
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/?hl=' + item.id }) } catch {}
    showToast('↗ 已定位到调度台的任务')
  } else {
    bumpHeat('curio', item.id)
    try { chrome.runtime.sendMessage({ type: 'zy-open-route', route: '/?hl=' + item.id }) } catch {}
    showToast('↗ 已定位到调度台好奇心')
  }
  closeOverlay()
}

/** 本地路径 → 可打开的 file:/// URL（支持 D:\... 与 file:/// 两种输入） */
function toFileUrl(link: string): string {
  if (!link) return ''
  if (/^file:\/\//i.test(link)) return link
  if (/^[a-zA-Z]:[\\/]/.test(link)) {
    const normalized = link.replace(/\\/g, '/')
    return 'file:///' + encodeURI(normalized).replace(/#/g, '%23')
  }
  return ''
}

// ============ 快速采集资源卡（右上角小窗） ============
let savedState = false
let savedTimer: ReturnType<typeof setTimeout> | null = null
// REQ-031 P-031-8：采集去重 Map——打开小窗时构建一次 url→resource，保存时 O(1) 查重（千卡下不再全量扫描）
let capUrlMap: Map<string, any> | null = null

async function openCapture() {
  savedState = false
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  const d = await getData()
  capUrlMap = new Map()
  for (const r of d?.resources || []) {
    if (r.deletedAt || r.linkType !== 'url' || !r.link) continue
    const fp = normalizeUrl(r.link)
    if (!capUrlMap.has(fp)) capUrlMap.set(fp, r)
  }
  const workspaces = d?.workspaces?.filter((w: any) => !w.archived) || []
  const defaultWs = workspaces[0]
  const categories = treeCatLabels(d?.categories?.filter((c: any) => c.workspaceId === defaultWs?.id) || [])
  const selection = getSelectionText()

  openOverlay('corner', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon res">📥</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">快速采集资源卡</div>
        <div class="zy-cap-sub">把当前页面收进你的来源网络</div>
      </div>
      <button class="zy-cap-close" id="__zy_cap_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field">
        <label class="zy-field-label">标题</label>
        <input type="text" class="zy-field-input" id="__zy_cap_title__" placeholder="资源卡标题">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">链接类型</label>
        <div class="zy-seg-control" id="__zy_seg__">
          <button class="zy-seg-btn active" data-ltype="url">🔗 URL</button>
          <button class="zy-seg-btn" data-ltype="file">📁 本地文件</button>
          <button class="zy-seg-btn" data-ltype="obsidian">📝 Obsidian</button>
        </div>
        <input type="text" class="zy-field-input" id="__zy_cap_link__" placeholder="https://…">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">描述（选中文本自动填入，可编辑）</label>
        <textarea class="zy-field-input" id="__zy_cap_desc__" placeholder="对该资源的注解、摘录、引用…">${escapeHtml(selection)}</textarea>
      </div>
      <div class="zy-field-row">
        <div class="zy-field">
          <label class="zy-field-label">存入工作台</label>
          <select class="zy-field-select" id="__zy_cap_ws__">
            ${workspaces.map((w: any) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('')}
          </select>
        </div>
        <div class="zy-field">
          <label class="zy-field-label">分类</label>
          <select class="zy-field-select" id="__zy_cap_cat__">
            <option value="">📥 待分类</option>
            ${categories.map((c: any) => `<option value="${c.id}">📂 ${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cap_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cap_save__">💾 保存（Enter）</button>
    </div>
  `
  root.appendChild(panel)

  let linkType = 'url'
  const titleInput = document.getElementById('__zy_cap_title__') as HTMLInputElement
  const linkInput = document.getElementById('__zy_cap_link__') as HTMLInputElement
  const wsSelect = document.getElementById('__zy_cap_ws__') as HTMLSelectElement

  // 通过 DOM 属性设置值，避免模板字面量注入问题
  titleInput.value = document.title || ''
  linkInput.value = location.href || ''

  setTimeout(() => { titleInput.focus(); titleInput.select() }, 50)

  document.getElementById('__zy_cap_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_cap_cancel__')?.addEventListener('click', closeOverlay)

  document.querySelectorAll('#__zy_seg__ .zy-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#__zy_seg__ .zy-seg-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      linkType = (btn as HTMLElement).dataset.ltype || 'url'
      linkInput.placeholder = linkType === 'url' ? 'https://…' : linkType === 'file' ? 'D:\\folder\\file.pdf' : 'obsidian://open?vault=…'
    })
  })

  wsSelect.addEventListener('change', async () => {
    const d2 = await getData()
    const cats = treeCatLabels(d2?.categories?.filter((c: any) => c.workspaceId === wsSelect.value) || [])
    const catSelect = document.getElementById('__zy_cap_cat__') as HTMLSelectElement
    catSelect.innerHTML = '<option value="">📥 待分类</option>' + cats.map((c: any) => `<option value="${c.id}">📂 ${escapeHtml(c.label)}</option>`).join('')
  })

  const onCapEnter = (e: KeyboardEvent) => {
    if (!document.getElementById('__zy_cap_title__')) return
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA') return // 描述框内 Enter 换行
      e.preventDefault()
      e.stopPropagation()
      saveCapture()
    }
  }
  panel.addEventListener('keydown', onCapEnter)
  document.getElementById('__zy_cap_save__')?.addEventListener('click', saveCapture)

  async function saveCapture() {
    const title = titleInput.value.trim()
    if (!title) { showToast('请输入标题'); return }
    const d2 = await getData()
    if (!d2) { showToast('数据加载失败'); return }
    // B5 去重：相同归一化链接 → 只能跳转（REQ-031 P-031-8：Map O(1) 查重）
    if (linkType === 'url' && linkInput.value.trim()) {
      const fp = normalizeUrl(linkInput.value.trim())
      const dup = capUrlMap?.get(fp)
      if (dup) {
        // B28：面板内自定义确认（替代原生 confirm）
        showDupConfirm(String(dup.title).slice(0, 40), () => {
          try { chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id }) } catch {}
          closeOverlay()
          showToast('↗ 已定位到已收录的卡片')
        })
        return
      }
    }
    const catSelect = document.getElementById('__zy_cap_cat__') as HTMLSelectElement
    const descInput = document.getElementById('__zy_cap_desc__') as HTMLTextAreaElement
    const cat = d2.categories?.find((c: any) => c.workspaceId === wsSelect.value && c.name === '待分类')
    const resource = {
      id: uid('rc'), kind: 'resource', title,
      linkType, link: linkInput.value.trim(),
      workspaceId: wsSelect.value,
      categoryId: catSelect.value || cat?.id || '',
      description: (descInput?.value || '').trim(),
      tags: [], customFields: {}, pinned: false, callCount: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    d2.resources?.unshift(resource)
    // REQ-031 P-031-8：新增卡片增量写入去重 Map（保持 O(1) 查重）
    if (capUrlMap && resource.linkType === 'url' && resource.link) {
      const nfp = normalizeUrl(resource.link)
      if (!capUrlMap.has(nfp)) capUrlMap.set(nfp, resource)
    }
    await saveData(d2)
    // 进入「已保存」状态：Enter 打开看板，Esc 关闭，5 秒自动消失
    showSaved(resource.workspaceId, resource.id)
  }
}

/** 采集去重确认视图（B28：替代原生 confirm，复用已保存态的视觉结构） */
function showDupConfirm(dupTitle: string, onJump: () => void) {
  const root = ensureRoot()
  const panel = root.querySelector('.zy-panel') as HTMLElement | null
  if (!panel) return
  panel.innerHTML = `
    <div class="zy-saved">
      <div class="zy-saved-icon" style="background:#FBF1DE;color:#8A5A00;">⚠️</div>
      <div class="zy-saved-title">该页面已收录</div>
      <div class="zy-saved-sub">「${escapeHtml(dupTitle)}」已存在于工作台，只能定位不能重复收录</div>
      <div class="zy-saved-actions">
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_cancel__">取消</button>
        <button class="zy-btn zy-btn-primary" id="__zy_dup_jump__">定位到卡片</button>
      </div>
    </div>
  `
  document.getElementById('__zy_dup_cancel__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_dup_jump__')?.addEventListener('click', onJump)
}

/** 已保存状态条（Enter=打开看板单例定位，Esc=关闭，5 秒自动消失） */
function showSaved(wsId: string, hl: string) {
  savedState = true
  const root = ensureRoot()
  const panel = root.querySelector('.zy-panel') as HTMLElement | null
  if (!panel) return
  panel.innerHTML = `
    <div class="zy-saved">
      <div class="zy-saved-icon">✓</div>
      <div class="zy-saved-title">资源卡已保存</div>
      <div class="zy-saved-hint">按 <kbd>Enter</kbd> 打开看板 · 定位新卡片</div>
      <div class="zy-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
      <div class="zy-saved-actions">
        <button class="zy-btn zy-btn-ghost" id="__zy_saved_close__">关闭</button>
        <button class="zy-btn zy-btn-primary" id="__zy_saved_open__">打开看板（Enter）</button>
      </div>
    </div>
  `
  document.getElementById('__zy_saved_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_saved_open__')?.addEventListener('click', openBoard)
  // B9：挂载 Enter / Esc 监听（保存后按 Enter 打开看板定位新卡）
  document.addEventListener('keydown', onSavedKeydown, true)

  function openBoard() {
    // 通知 background：单例定位到已打开的工作台标签页，或新建
    try { chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId, hl }) } catch { /* ignore */ }
    closeOverlay()
  }

  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedState = false; closeOverlay() }, 5000)
}

function onSavedKeydown(e: KeyboardEvent) {
  if (!savedState) return
  if (e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation()
    document.getElementById('__zy_saved_open__')?.click()
  } else if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation()
    savedState = false
    closeOverlay()
  }
}

// ============ 采集好奇心（居中，选中文本预填 + O24 自动附带页面来源） ============
/** R55-C：快速采集任务（任意网页快捷键触发；四字段全非必填，直存全域任务） */
async function openTaskCapture() {
  const d = await getData()
  const projects: any[] = []
  for (const dir of d?.compass?.directions || []) for (const p of dir.projects || []) projects.push({ id: p.id, name: p.name, metrics: p.metrics || [] })
  openOverlay('corner', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon res">⚡</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">快速采集任务</div>
        <div class="zy-cap-sub">四项皆可留空 · 存入全域任务统一管理</div>
      </div>
      <button class="zy-cap-close" id="__zy_tc_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field"><label class="zy-field-label">任务名称</label>
        <input type="text" class="zy-field-input" id="__zy_tc_title__" placeholder="要做什么（可留空）"></div>
      <div class="zy-field"><label class="zy-field-label">任务内容</label>
        <textarea class="zy-field-input" id="__zy_tc_desc__" placeholder="补充说明、上下文、验收标准（可留空）"></textarea></div>
      <div class="zy-field-row">
        <div class="zy-field"><label class="zy-field-label">所属项目（可留空）</label>
          <select class="zy-field-select" id="__zy_tc_proj__"><option value="">未关联项目</option>
          ${projects.map((p: any) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
        <div class="zy-field"><label class="zy-field-label">所属指标（可留空）</label>
          <select class="zy-field-select" id="__zy_tc_met__" disabled><option value="">暂不归属</option></select></div>
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_tc_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_tc_save__">⚡ 保存任务（Ctrl+Enter）</button>
    </div>
  `
  root.appendChild(panel)
  const titleInput = document.getElementById('__zy_tc_title__') as HTMLInputElement
  const projSel = document.getElementById('__zy_tc_proj__') as HTMLSelectElement
  const metSel = document.getElementById('__zy_tc_met__') as HTMLSelectElement
  setTimeout(() => { titleInput.focus() }, 50)
  projSel.addEventListener('change', () => {
    const prj = projects.find(x => x.id === projSel.value)
    metSel.disabled = !prj
    metSel.innerHTML = '<option value="">暂不归属</option>' + (prj ? prj.metrics.map((m: any) => `<option value="${m.id}">${escapeHtml(m.title)}</option>`).join('') : '')
  })
  document.getElementById('__zy_tc_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_tc_cancel__')?.addEventListener('click', closeOverlay)
  const saveTc = async () => {
    const d2 = await getData()
    if (!d2) { showToast('数据加载失败'); return }
    const desc = (document.getElementById('__zy_tc_desc__') as HTMLTextAreaElement)?.value.trim() || ''
    const task: any = {
      id: uid('tk'), kind: 'task', title: titleInput.value.trim() || '快速任务',
      description: desc, status: 'todo', priority: 'medium',
      projectId: projSel.value || undefined, metricId: metSel.value || undefined,
      mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [], pinned: false,
      createdAt: Date.now(), updatedAt: Date.now()
    }
    d2.tasks?.unshift(task)
    if (task.metricId) {
      for (const dir of d2.compass?.directions || []) for (const prj of dir.projects || []) for (const m of prj.metrics || [])
        if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
    }
    await saveData(d2)
    panel.innerHTML = `
      <div class="zy-saved">
        <div class="zy-saved-icon" style="background:#E8F5EE;color:#0E7A4E;">⚡</div>
        <div class="zy-saved-title">任务已保存</div>
        <div class="zy-saved-sub">${task.projectId ? '已挂项目/指标 · 全域任务统一管理' : '暂为未归档任务 · 可随时在方向台归档'}</div>
        <div class="zy-saved-sub">按 <kbd>Esc</kbd> 关闭 · 5 秒后自动关闭</div>
      </div>`
    savedState = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { closeOverlay(); savedState = false; savedTimer = null }, 5000)
  }
  document.getElementById('__zy_tc_save__')?.addEventListener('click', saveTc)
  const onTcKey = (e: KeyboardEvent) => {
    if (!document.getElementById('__zy_tc_save__')) return
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); saveTc() }
  }
  document.addEventListener('keydown', onTcKey, true)
}

async function openCuriosity() {
  // 第廿四轮：实时选区优先 → 预取缓存兜底（缓存是选中当下捕获的，不受后续清选影响）
  // V2.21：先取缓存快照再清空——原实现只清 text、保留 url/title，此处语义保持一致
  const cached = getSelCache()
  const selection = resolveSelection()
  const hasSel = !!selection
  const pageTitle = hasSel ? ((cached.url === location.href && cached.title) || (document.title || '').trim()) : ''
  const pageUrl = hasSel ? ((cached.url === location.href && cached.url) || location.href) : ''
  clearSelCache()
  // D6：好奇心采集居中呈现，宽度与全局搜索一致
  openOverlay('center', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel curio'
  panel.innerHTML = `
    <div class="zy-cap-head">
      <div class="zy-cap-icon curio">💡</div>
      <div class="zy-cap-titles">
        <div class="zy-cap-title">采集好奇心</div>
        <div class="zy-cap-sub">从好奇出发，向源头求证</div>
      </div>
      <button class="zy-cap-close" id="__zy_cur_close__">×</button>
    </div>
    <div class="zy-cap-body">
      <div class="zy-field">
        <label class="zy-field-label">你的问题或想法${selection ? '（已填入选中文本，可编辑）' : ''}</label>
        <textarea class="zy-field-input" id="__zy_cur_text__" style="min-height:110px" placeholder="看到什么、想到什么、想探索什么？&#10;按 Enter 换行，Ctrl+Enter 保存">${escapeHtml(selection)}</textarea>
      </div>
      <div class="zy-field">
        <label class="zy-field-label">🔗 来源链接${hasSel ? '（已自动捕获当前页，可编辑）' : '（可选，留空即无来源）'}</label>
        <input type="text" class="zy-field-input" id="__zy_cur_url__" placeholder="https://…" value="${escapeHtml(hasSel ? pageUrl : '')}">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">📝 来源标题</label>
        <input type="text" class="zy-field-input" id="__zy_cur_srctitle__" placeholder="来源页面标题（可选）" value="${escapeHtml(hasSel ? pageTitle : '')}">
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cur_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cur_save__">💾 保存（Ctrl+Enter）</button>
    </div>
  `
  root.appendChild(panel)
  const textarea = document.getElementById('__zy_cur_text__') as HTMLTextAreaElement
  setTimeout(() => { textarea?.focus(); if (!selection) textarea.setSelectionRange(textarea.value.length, textarea.value.length) }, 50)

  document.getElementById('__zy_cur_close__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_cur_cancel__')?.addEventListener('click', closeOverlay)

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      saveCuriosity()
    }
  })

  async function saveCuriosity() {
    const text = textarea.value.trim()
    if (!text) { showToast('请输入内容'); return }
    const d = await getData()
    if (!d) { showToast('数据加载失败'); return }
    const srcUrlInput = (document.getElementById('__zy_cur_url__') as HTMLInputElement | null)?.value.trim() || ''
    const srcTitleInput = (document.getElementById('__zy_cur_srctitle__') as HTMLInputElement | null)?.value.trim() || ''
    d.curiosities?.unshift({
      id: uid('cz'), kind: 'curiosity', question: text,
      sourceUrl: srcUrlInput || undefined, sourceTitle: srcTitleInput || undefined,
      status: 'todo', pinned: false,
      relatedResourceIds: [], customFields: {},
      createdAt: Date.now(), updatedAt: Date.now()
    })
    await saveData(d)
    closeOverlay()
    showToast('💗好奇心+1')
  }

  document.getElementById('__zy_cur_save__')?.addEventListener('click', saveCuriosity)
}

// ============ 工具函数 ============
/** 第八轮：分类按层级平铺（子分类显示为「父 / 子」），供下拉选项使用 */
function treeCatLabels(cats: any[]): any[] {
  const list = cats || []
  const roots = list
    .filter((c: any) => !c.parentId || !list.some((p: any) => p.id === c.parentId))
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  const out: any[] = []
  for (const r0 of roots) {
    out.push({ id: r0.id, label: r0.name })
    for (const ch of list.filter((c: any) => c.parentId === r0.id).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))) {
      out.push({ id: ch.id, label: r0.name + ' / ' + ch.name })
    }
  }
  return out
}
function linkShort(link: string) {
  if (link.startsWith('http')) return link.replace(/^https?:\/\//, '').substring(0, 30)
  if (link.startsWith('obsidian')) return 'Obsidian笔记'
  const parts = link.split(/[\\/]/)
  return parts[parts.length - 1].substring(0, 25)
}
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hostname = u.hostname.toLowerCase()
    u.hash = ''
    const utm = ['utm_', 'spm', 'from', 'gclid', 'fbclid']
    u.searchParams.forEach((_, key) => { if (utm.some(p => key.startsWith(p))) u.searchParams.delete(key) })
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    u.pathname = path
    return u.toString()
  } catch { return raw.trim() }
}

function escapeHtml(s: string) {
  // REQ-031 P-031-4：createElement → 正则白名单替换（高频路径提速 ~10 倍）
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============ 对外入口 ============
// V2.21：本文件由信号层 search-overlay.ts 在首次唤起时动态 import，
// 不再于页面加载期随 content script 同步执行。子帧（iframe）永不加载本文件。
export { openSearch, openCapture, openCuriosity, openTaskCapture }
