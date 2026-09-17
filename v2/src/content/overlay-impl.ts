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
import { CURATION_WS_ID } from '@/shared/models'
import { buildCatOptions } from '@/shared/utils/catTree'
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
/**
 * R114-59：fire-and-forget 路由消息收敛点（替换 11 处空 catch——R114-59 清零护栏）。
 * 双通道吞错：try/catch 兜「Extension context invalidated」同步抛（SW 更新/休眠中）；
 * .catch 兜 MV3 Promise 拒绝（接收端不存在）。跳转类消息丢失可安全忽略——用户重试即可。
 */
function safeSend(msg: Record<string, unknown>): void {
  try {
    const p = chrome.runtime.sendMessage(msg) as unknown as Promise<void> | undefined
    if (p && typeof p.catch === 'function') p.catch(() => { /* 接收端不存在，丢弃 */ })
  } catch { /* 扩展上下文失效（SW 更新中），同步抛出同样可安全丢弃 */ }
}

function uid(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
}

// ============ 数据缓存（B36：搜索/采集每次按键不再重复读 storage） ============
let dataCache: any = null
let dataCacheAt = 0
// R68-F1：已完成项目显隐口径（与方向台 showDoneProjects 同源，读 zy_ui_v2；缺省=显示）
let showDoneProjectsCache = true
async function loadShowDonePref() {
  try {
    const r = await chrome.storage.local.get('zy_ui_v2')
    showDoneProjectsCache = (r['zy_ui_v2'] as any)?.showDoneProjects !== false
  } catch { showDoneProjectsCache = true }
}
/** R68-F1：项目完成口径（对齐 newtab isProjectDone：手动 done/archived 或全部任务完成派生） */
function isProjDone(p: any, d: any): boolean {
  if (p.status === 'done' || p.status === 'archived') return true
  const ts = (d.tasks || []).filter((t: any) => !t.deletedAt && t.projectId === p.id)
  return ts.length > 0 && ts.every((t: any) => t.status === 'done')
}
async function getData(force = false): Promise<any> {
  // R106（F5）：TTL 1.5s → 300s——storage.onChanged 已实时兜底新鲜度（上方监听），
  // 过短的 TTL 只会让每次打开浮层都全量重读 + JSON.parse 整库（生产反馈：采集卡顿的正源之一）。
  // loadShowDonePref 同受此守卫（不再每次 getData 都读 zy_ui_v2）。
  // R117（04-61 A）：force = 采集浮层专用——分类会随时增删改，打开浮层必须用「当前分类」；
  // 但保留 5s 短窗，连开两次不重复读整库。
  if (dataCache && Date.now() - dataCacheAt < (force ? 5000 : 300000)) return dataCache
  const d = await loadData()
  dataCache = d
  dataCacheAt = Date.now()
  void loadShowDonePref()
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
    // R68-F1：界面偏好变化（已完成项目显隐）实时生效
    if (area === 'local' && changes['zy_ui_v2']) void loadShowDonePref()
  })
}

// ============ 样式注入 ============
function injectStyles() {
  if (document.getElementById('__zy_styles__')) return
  const s = document.createElement('style')
  s.id = '__zy_styles__'
  s.textContent = `
    /* R77（A1）：浮层变量体系——底色/文字跟随宿主 prefers-color-scheme，强调色由 JS 按知源主题注入。
       浮层运行在宿主文档，取不到新标签页的 tokens.css，故在此自建 --zy-* 变量；
       色值取自 shared/styles/tokens.css（linear 主题的明暗两套），回归断言 R77-3 锁定主题色不漂移。 */
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;
      --zy-bg:#FFFFFF;--zy-bg-2:#F7F7F8;--zy-bg-3:#EFEFF1;
      --zy-border:#E3E4E8;--zy-border-strong:#D5D6DB;
      --zy-text:#17181C;--zy-text-2:#3C3F45;--zy-text-3:#8A8F98;--zy-text-4:#B4B8BF;
      --zy-link:#3573B9;--zy-link-file:#A87B2A;--zy-link-obs:#7C3AED;
      --zy-accent:#0071E3;--zy-on-accent:#FFFFFF;
      /* R93（A6）：语义档令牌——取自 tokens.css 的 apple（明）/ linear（暗）两套，不臆造色值。
         状态徽标由改前的 8 种配色收敛为「中性 / 强调 / 警示」三档，这两条是后两档的落点。 */
      --zy-warn:#A66A00;--zy-ok:#1E7A34;
      --zy-accent-ring:color-mix(in srgb, var(--zy-accent) 34%, transparent);
      /* R105（C3）：字号阶梯——对齐主应用文本档（2xs 微标 10.5 / xs 标签 11 / sm 正文小 12 /
         md 正文 13 / lg 强调 14）；搜索/采集输入态保留 16-17px（提案许可）。展示级尺寸
         （15px 以上标题/图标）不入阶梯。 */
      --zy-fs-2xs:10.5px;--zy-fs-xs:11px;--zy-fs-sm:12px;--zy-fs-md:13px;--zy-fs-lg:14px;}
    @media (prefers-color-scheme: dark){
      #${ROOT_ID}{--zy-bg:#0F1011;--zy-bg-2:#141516;--zy-bg-3:#191A1B;
        --zy-border:#23252A;--zy-border-strong:#34343A;
        --zy-text:#F7F8F8;--zy-text-2:#D0D6E0;--zy-text-3:#8A8F98;--zy-text-4:#62666D;
        --zy-link:#6BA6E8;--zy-link-file:#D9A94A;--zy-link-obs:#A78BFA;
        /* R93（A6）：暗色档——warn 用 linear --warning(#D9A03C)，ok 用 linear --tag-ok-text(#6FCE8B) */
        --zy-warn:#D9A03C;--zy-ok:#6FCE8B;}
    }
    #${ROOT_ID}.open{display:block;}
    /* R77（A2）：轻 scrim——rgba(0,0,0,.18) + blur 6px，页面内容仍可辨 */
    #${ROOT_ID} .zy-scrim{position:absolute;inset:0;background:rgba(0,0,0,.18);}
    #${ROOT_ID}.center{display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(0,0,0,.18);backdrop-filter:blur(6px);}
    #${ROOT_ID}.corner{display:flex;align-items:flex-start;justify-content:flex-end;padding:10px 10px 14px;}

    /* R77（A2）：加强浮层自身阴影 + 1px 边框（scrim 变轻后靠自身边界撑住层级） */
    .zy-panel{position:relative;background:var(--zy-bg);border:1px solid var(--zy-border);border-radius:16px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 12px 32px rgba(0,0,0,.14),0 32px 72px rgba(0,0,0,.22);overflow:hidden;font-size:var(--zy-fs-lg);color:var(--zy-text);animation:zyPanelIn .22s cubic-bezier(.16,1,.3,1);}
    @keyframes zyPanelIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    /* 居中搜索面板 */
    #${ROOT_ID}.center .zy-panel{width:640px;max-width:92vw;}
    /* 好奇心采集：居中 640px（D6） */
    #${ROOT_ID}.center .zy-panel.curio{width:640px;}
    /* 右上角采集小窗（对标 Obsidian Web Clipper：400×600） */
    #${ROOT_ID}.corner .zy-panel{width:400px;max-width:calc(100vw - 28px);max-height:min(600px,calc(100vh - 72px));overflow-y:auto;}
    /* R77（A1）：原顶部的绿色渐变装饰条已移除 */

    /* ===== 搜索 ===== */
    .zy-search-head{display:flex;align-items:center;gap:12px;padding:18px 22px 0;}
    .zy-search-icon{width:22px;height:22px;color:var(--zy-text-3);flex-shrink:0;display:flex;align-items:center;justify-content:center;}
    .zy-search-input{flex:1;border:none;outline:none;background:transparent;font-size:17px;font-weight:500;color:var(--zy-text);font-family:inherit;min-width:0;line-height:1.4;}
    .zy-search-input::placeholder{color:var(--zy-text-4);font-weight:400;}
    .zy-esc-btn{font-size:var(--zy-fs-xs);color:var(--zy-text-3);background:var(--zy-bg-2);border:1px solid var(--zy-border);border-radius:6px;padding:3px 8px;flex-shrink:0;cursor:pointer;font-family:inherit;}
    .zy-esc-btn:hover{color:var(--zy-text-2);border-color:var(--zy-border-strong);}
    /* B29：搜索框内类型过滤 chip（与 Tab 切换同步，与新版应用内搜索一致）· R77（C2）改中性 */
    .zy-search-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;background:var(--zy-bg-3);color:var(--zy-text-2);font-size:var(--zy-fs-sm);font-weight:600;flex-shrink:0;animation:zyChipIn .2s ease;}
    .zy-search-chip .zy-chip-x{width:15px;height:15px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.6;font-size:var(--zy-fs-xs);}
    .zy-search-chip .zy-chip-x:hover{opacity:1;background:var(--zy-border);}
    @keyframes zyChipIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
    /* R93（A5）：Tab 行**轻量化**——去掉每个 tab 的背景块与 hover 底色，改为一行纯文字 + 计数；
       当前项用**文字色 + 字重 + 底部 2px 下划线**标出。
       ⚠ 不引入强调色：R77（C2）已把此处定为中性（强调色只留主按钮 / 焦点环 / 当前选中行），本轮不推翻。 */
    .zy-type-tabs{display:flex;gap:14px;padding:10px 22px 6px;}
    .zy-type-tab{padding:0 0 5px;font-size:var(--zy-fs-sm);color:var(--zy-text-3);cursor:pointer;transition:color .12s,border-color .12s;display:flex;align-items:center;gap:4px;font-weight:500;border-bottom:2px solid transparent;}
    .zy-type-tab:hover{color:var(--zy-text-2);}
    .zy-type-tab.active{color:var(--zy-text);font-weight:600;border-bottom-color:var(--zy-text-3);}
    .zy-type-tab .cnt{font-size:var(--zy-fs-2xs);color:var(--zy-text-4);font-weight:500;}
    .zy-type-tab.active .cnt{color:var(--zy-text-2);opacity:.7;}
    .zy-results{max-height:48vh;overflow-y:auto;padding:4px 12px 8px;}
    .zy-results::-webkit-scrollbar{width:6px;}
    .zy-results::-webkit-scrollbar-thumb{background:var(--zy-border-strong);border-radius:3px;}
    .zy-result-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;cursor:pointer;border-left:3px solid transparent;transition:background .1s,border-color .1s;position:relative;margin-bottom:2px;}
    /* R77（C2）：hover 改中性底，仅 .sel（当前选中行）保留强调色左边框 */
    .zy-result-item:hover{background:var(--zy-bg-2);}
    .zy-result-item.sel{background:var(--zy-bg-3);border-left-color:var(--zy-accent);}
    /* R93（A6）：类型与状态一律靠 iconText 的**形状**区分（📄 ✓ ◐ ○ 💡 📁 🗂 📦）——底色统一中性。
       改前六种硬编码浅底色（资源蓝/完成绿/进行黄/待办灰/好奇黄/策展台紫）**且全无暗色覆盖**，
       宿主是暗色时这些浅块会直接突出来——是真缺陷，不只是"颜色多"。
       加 1px 边框：中性底在明暗两套下都需要一条边界才立得住。 */
    .zy-ri-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;background:var(--zy-bg-3);border:1px solid var(--zy-border);}
    .zy-ri-main{flex:1;min-width:0;}
    .zy-ri-title{font-size:var(--zy-fs-lg);font-weight:600;color:var(--zy-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;}
    .zy-ri-meta{display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;align-items:center;}
    /* R93（A6）：状态徽标由 8 种配色收敛为「中性 / 强调 / 警示」三档。
       中性档即 .zy-badge 默认值（无待办含义）；强调档 = 正在推进；警示档 = 需要优先处理。 */
    .zy-badge{font-size:var(--zy-fs-2xs);padding:1.5px 8px;border-radius:99px;font-weight:500;line-height:1.5;background:var(--zy-bg-3);color:var(--zy-text-2);}
    /* —— 中性档：台 / 分类 / 策展台 / 好奇状态 / 中优先级 / 待开始 —— */
    .zy-badge.ws,.zy-badge.cat,.zy-badge.ws-badge,.zy-badge.curio-status,.zy-badge.prio-mid,.zy-badge.status-todo{background:var(--zy-bg-3);color:var(--zy-text-2);}
    /* —— 强调档：进行中（正在推进）—— */
    .zy-badge.status-doing{background:color-mix(in srgb, var(--zy-accent) 14%, transparent);color:var(--zy-accent);}
    /* —— 警示档：高优先级 —— */
    .zy-badge.prio-high{background:color-mix(in srgb, var(--zy-warn) 16%, transparent);color:var(--zy-warn);}
    /* 已完成是终结态：中性 + 去饱和（对齐 .archived / .cf-item.done 既有口径） */
    .zy-badge.status-done{background:var(--zy-bg-3);color:var(--zy-text-2);opacity:.6;}
    .zy-ri-link{font-size:var(--zy-fs-xs);color:var(--zy-text-3);display:flex;align-items:center;gap:3px;white-space:nowrap;}
    .zy-ri-link.url{color:var(--zy-link);}
    .zy-ri-link.file{color:var(--zy-link-file);}
    .zy-ri-link.obsidian{color:var(--zy-link-obs);}
    .zy-ri-summary{font-size:var(--zy-fs-xs);color:var(--zy-text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zy-ri-del{font-size:var(--zy-fs-sm);color:var(--zy-text-3);cursor:pointer;padding:3px 6px;border-radius:6px;flex-shrink:0;opacity:0;transition:all .12s;}
    .zy-result-item:hover .zy-ri-del{opacity:1;}
    .zy-ri-del:hover{color:#E5484D;background:rgba(229,72,77,.12);}
    /* R78（A7）：「→ 三件事」按钮——仅任务卡有；默认隐藏，hover 或当前选中行才显形（与删除按钮同一节奏） */
    .zy-ri-focus{font-size:var(--zy-fs-xs);color:var(--zy-text-3);cursor:pointer;padding:3px 8px;border-radius:7px;flex-shrink:0;white-space:nowrap;
      border:1px solid var(--zy-border-strong);background:var(--zy-bg-2);opacity:0;transition:all .12s;}
    .zy-result-item:hover .zy-ri-focus,.zy-result-item.sel .zy-ri-focus{opacity:1;}
    .zy-ri-focus:hover{color:var(--zy-accent);border-color:var(--zy-accent);background:color-mix(in srgb, var(--zy-accent) 10%, transparent);}
    .zy-ri-focus.on{opacity:1;color:var(--zy-text-4);border-color:var(--zy-border);background:transparent;cursor:default;}
    .zy-group-title{font-size:var(--zy-fs-2xs);font-weight:700;color:var(--zy-text-3);letter-spacing:.08em;padding:10px 12px 4px;}
    .zy-group-more{font-size:var(--zy-fs-xs);color:var(--zy-text-3);padding:6px 12px;border-top:1px dashed var(--zy-border);}
    .zy-empty{padding:40px 20px;text-align:center;color:var(--zy-text-3);}
    .zy-empty .icon{font-size:32px;margin-bottom:8px;opacity:.4;}
    .zy-empty .text{font-size:var(--zy-fs-md);line-height:1.7;}
    .zy-empty .text b{color:var(--zy-text-2);font-weight:600;}
    .zy-foot{display:flex;align-items:center;gap:16px;padding:10px 22px;border-top:1px solid var(--zy-border);background:var(--zy-bg-2);font-size:var(--zy-fs-xs);color:var(--zy-text-4);}
    .zy-foot kbd{background:var(--zy-bg);border:1px solid var(--zy-border);border-radius:5px;padding:1px 6px;font-family:inherit;font-size:var(--zy-fs-2xs);color:var(--zy-text-2);margin:0 2px;}
    .zy-foot .brand{margin-left:auto;font-size:var(--zy-fs-2xs);color:var(--zy-text-4);opacity:.7;letter-spacing:.3px;}

    /* ===== 采集小窗通用 ===== */
    .zy-cap-head{padding:18px 20px 0;display:flex;align-items:flex-start;gap:12px;}
    /* R93（A6）：与结果行 .zy-ri-icon 同款处理——底色统一中性 + 1px 边框，
       类型靠 emoji 区分。改前 .res 资源蓝 / .curio 好奇黄是写死浅底**且无暗色覆盖**。 */
    .zy-cap-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:var(--zy-bg-3);border:1px solid var(--zy-border);}
    .zy-cap-titles{flex:1;min-width:0;}
    .zy-cap-title{font-size:15.5px;font-weight:700;color:var(--zy-text);letter-spacing:-.2px;}
    .zy-cap-sub{font-size:var(--zy-fs-xs);color:var(--zy-text-3);margin-top:2px;}
    .zy-cap-close{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--zy-text-3);font-size:17px;transition:all .12s;flex-shrink:0;background:transparent;border:none;font-family:inherit;}
    .zy-cap-close:hover{background:var(--zy-bg-3);color:var(--zy-text);}
    .zy-cap-body{padding:14px 20px 16px;}
    .zy-field{margin-bottom:12px;}
    .zy-field:last-child{margin-bottom:0;}
    .zy-field-label{display:block;font-size:var(--zy-fs-xs);font-weight:600;color:var(--zy-text-3);margin-bottom:5px;letter-spacing:.2px;}
    .zy-field-input{width:100%;border:1px solid var(--zy-border);border-radius:10px;padding:9px 12px;font-size:var(--zy-fs-md);color:var(--zy-text);background:var(--zy-bg);outline:none;font-family:inherit;transition:all .15s;line-height:1.5;box-sizing:border-box;}
    .zy-field-input::placeholder{color:var(--zy-text-4);}
    /* R77（C2）：焦点环保留强调色 */
    .zy-field-input:focus{border-color:var(--zy-accent);box-shadow:0 0 0 3px var(--zy-accent-ring);}
    textarea.zy-field-input{resize:vertical;min-height:60px;font-size:var(--zy-fs-md);line-height:1.6;}
    .zy-seg-control{display:flex;gap:3px;background:var(--zy-bg-2);border-radius:9px;padding:3px;margin-bottom:8px;}
    .zy-seg-btn{flex:1;padding:6px 6px;border-radius:7px;border:none;background:transparent;font-size:var(--zy-fs-xs);color:var(--zy-text-3);cursor:pointer;transition:all .15s;font-family:inherit;font-weight:500;display:flex;align-items:center;justify-content:center;gap:3px;}
    .zy-seg-btn:hover{color:var(--zy-text-2);}
    /* R77（C2）：分段选中态改中性 */
    .zy-seg-btn.active{background:var(--zy-bg);color:var(--zy-text);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 1px var(--zy-border);}
    .zy-field-row{display:flex;gap:10px;}
    .zy-field-row .zy-field{flex:1;}
    .zy-field-select{width:100%;border:1px solid var(--zy-border);border-radius:10px;padding:9px 12px;font-size:var(--zy-fs-sm);color:var(--zy-text);background:var(--zy-bg);outline:none;font-family:inherit;cursor:pointer;transition:all .15s;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA0A6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;box-sizing:border-box;}
    .zy-field-select:focus{border-color:var(--zy-accent);box-shadow:0 0 0 3px var(--zy-accent-ring);}
    .zy-cur-src{margin-top:6px;font-size:var(--zy-fs-xs);color:var(--zy-text-2);background:var(--zy-bg-2);border:1px dashed var(--zy-border);border-radius:7px;padding:5px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zy-cap-foot{display:flex;gap:10px;padding:12px 20px;border-top:1px solid var(--zy-border);background:var(--zy-bg-2);}
    .zy-cap-boundary{font-size:var(--zy-fs-xs);line-height:1.5;color:var(--zy-text-3);padding:8px 20px 0;}
    .zy-btn{padding:8px 16px;border-radius:9px;font-size:var(--zy-fs-sm);font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;border:1px solid transparent;display:inline-flex;align-items:center;gap:6px;}
    .zy-btn-ghost{background:var(--zy-bg);border-color:var(--zy-border);color:var(--zy-text-2);}
    .zy-btn-ghost:hover{border-color:var(--zy-border-strong);color:var(--zy-text);}
    /* R77（C2）：主按钮是强调色的三处合法用法之一 */
    .zy-btn-primary{background:var(--zy-accent);color:var(--zy-on-accent);border-color:var(--zy-accent);margin-left:auto;box-shadow:0 1px 2px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.10);}
    .zy-btn-primary:hover{filter:brightness(1.08);}
    .zy-btn-primary:active{transform:translateY(0);}

    /* 已保存状态条 */
    .zy-saved{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px 48px;text-align:center;}
    /* R93（A6）：保存成功图标改走 --zy-ok 令牌（明/暗两套）。改前是写死的浅绿底 #E4F2E8，暗色下会突出来。 */
    .zy-saved-icon{width:52px;height:52px;border-radius:50%;background:color-mix(in srgb, var(--zy-ok) 14%, transparent);color:var(--zy-ok);font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:14px;animation:zyPop .35s cubic-bezier(.34,1.56,.64,1);}
    /* R93（A6）：重复卡确认是**需要用户做决定**的阻断态 ⇒ 用警示档（改前内联写死 #FBF1DE/#8A5A00） */
    .zy-saved-icon.warn{background:color-mix(in srgb, var(--zy-warn) 16%, transparent);color:var(--zy-warn);}
    @keyframes zyPop{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
    .zy-saved-title{font-size:16px;font-weight:700;color:var(--zy-text);margin-bottom:6px;}
    /* R77（C2）：保存提示改中性（A3 将把它收窄为一行 toast） */
    .zy-saved-hint{font-size:var(--zy-fs-md);color:var(--zy-text-2);font-weight:600;}
    .zy-saved-hint kbd,.zy-saved-sub kbd{background:var(--zy-bg-2);border:1px solid var(--zy-border);border-radius:5px;padding:1px 7px;font-family:inherit;font-size:var(--zy-fs-xs);color:var(--zy-text-2);}
    .zy-saved-sub{font-size:var(--zy-fs-xs);color:var(--zy-text-3);margin-top:4px;}
    .zy-saved-actions{display:flex;gap:10px;margin-top:20px;}

    /* 保存成功提示 */
    .zy-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(12px);background:var(--zy-text);color:var(--zy-bg);padding:10px 20px;border-radius:99px;font-size:var(--zy-fs-md);font-weight:500;z-index:2147483647;opacity:0;transition:all .25s cubic-bezier(.16,1,.3,1);pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.2);display:flex;align-items:center;gap:8px;max-width:90vw;}
    .zy-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
  `
  document.documentElement.appendChild(s)
}

// ============ R77（A1）：主题强调色注入 ============
/**
 * R77（A1）：四套主题的强调色——与 `shared/styles/tokens.css` 的 `[data-theme='*'] --accent` 一一对应。
 * 浮层运行在宿主文档，取不到新标签页的 tokens.css，故在此维护映射并由 JS 注入 CSS 变量。
 * ⚠ 回归断言 R77-3 锁定本表与 tokens.css 一致，改任一侧都必须同步另一侧。
 * `on` = 主按钮文字色：珊瑚红（raycast）配白字对比度仅 2.9:1，改用深字达 4.8:1。
 */
const THEME_ACCENT: Record<string, { accent: string; on: string }> = {
  linear: { accent: '#5E6AD2', on: '#FFFFFF' },
  apple: { accent: '#0071E3', on: '#FFFFFF' },
  raycast: { accent: '#FF6363', on: '#17181C' },
  notion: { accent: '#2383E2', on: '#FFFFFF' }
}
/** 读取知源当前主题并注入强调色；宿主环境不可读 storage 时回落默认主题 linear */
async function applyThemeAccent() {
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  let theme = 'linear'
  try {
    const r = await chrome.storage.local.get('zy_ui_v2')
    const t = (r?.zy_ui_v2 as { theme?: string } | undefined)?.theme
    if (t && THEME_ACCENT[t]) theme = t
  } catch { /* 无 storage 权限或尚未初始化：回落默认主题 */ }
  const c = THEME_ACCENT[theme] || THEME_ACCENT.linear!
  root.style.setProperty('--zy-accent', c.accent)
  root.style.setProperty('--zy-on-accent', c.on)
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

/**
 * R92（D1）：浮层唤起后的聚焦 —— **统一入口，不再 setTimeout(…, 50)**。
 *
 * 原实现四处各写一遍 `setTimeout(() => el.focus(), 50)`，本意是等面板入场动画，
 * 代价是"唤起后立刻打字"的前几个字符会丢（焦点还没落到输入框，按键被宿主页面吃掉）。
 * 面板此时已在 DOM 中（`root.appendChild(panel)` 先于本调用，且 `.open` 已置），
 * 同步 `focus()` 即可生效。
 *
 * 仍留一帧兜底：宿主页面若在同步阶段抢回焦点，下一帧再争一次（rAF ≈16ms，远小于原 50ms）。
 * 正常情况下兜底不触发（判 `document.activeElement !== el`，不是无条件重复 focus）。
 *
 * @param select 聚焦后全选（资源卡采集：标题预填了 document.title，全选便于直接改写）
 * @param toEnd  聚焦后把光标移到末尾（好奇心采集：无选区时文本已预填，接着写更顺手）
 */
function focusWhenReady(el: HTMLElement | null, opts?: { select?: boolean; toEnd?: boolean }) {
  if (!el) return
  const doFocus = () => {
    el.focus()
    if (opts?.select && typeof (el as HTMLInputElement).select === 'function') (el as HTMLInputElement).select()
    if (opts?.toEnd && typeof (el as HTMLTextAreaElement).setSelectionRange === 'function') {
      const n = (el as HTMLTextAreaElement).value.length
      ;(el as HTMLTextAreaElement).setSelectionRange(n, n)
    }
  }
  doFocus()
  requestAnimationFrame(() => { if (document.activeElement !== el) doFocus() })
}

/** 打开浮层：center=居中搜索；corner=右上角采集小窗 */
function openOverlay(mode: 'center' | 'corner', onScrimClick?: () => void) {
  injectStyles() // V2.21：样式注入收敛到真正渲染浮层时（幂等），页面加载期不再触碰 DOM
  clearSavedState() // R78（A3）：新浮层一开，上一次的保存回执态（含 Enter 打开看板）即作废
  const root = ensureRoot()
  void applyThemeAccent() // R77（A1）：强调色取知源当前主题（异步读 storage，不阻塞渲染）
  root.className = mode === 'center' ? 'center open' : 'corner open'
  root.innerHTML = ''
  // R97（D5）：document 级 Esc 兜底（capture）——同名引用重复注册被 addEventListener 去重，重复 open 安全
  document.addEventListener('keydown', onDocEsc, true)
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
    savedOpenBoard = null      // R78（A3）：浮层已销毁 → 回执期内的「打开看板」动作同步失效
    pendingReplaceSlot = null  // R78（A7）：两段式替换的中间态随浮层关闭作废
    document.removeEventListener('keydown', onSavedKeydown, true)
    document.removeEventListener('keydown', onDocEsc, true) // R97（D5）
    activeTcSave = null  // R70：面板已销毁 → 保存回调失效（onTcKeydown 为模块级常驻，无需反复解绑）
  }
}

/**
 * R97（D5）：document 级 Esc 兜底——此前全浮层只有两处 Esc：搜索输入框（R92 D2 两段式，挂在
 * 输入框元素上）与已保存回执（onSavedKeydown）。⇒ 焦点一离开输入框（点过结果区/表单背景）Esc 即失效；
 * corner 表单（资源/好奇/任务采集）则从来没有 Esc。统一收口到 document capture：
 * - 已保存回执态：让位 onSavedKeydown（它自带两段语义）；
 * - 搜索面板且焦点在输入框：让位输入框自己的两段式（target 阶段处理）；
 * - 搜索面板且焦点不在输入框：**镜像两段式**（有内容先清空，空再关闭）——语义与框内 Esc 完全一致；
 * - corner/center 表单浮层（资源/好奇/任务采集）：无自有 Esc，直接关闭。
 */
function onDocEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (savedState) return // 回执态有自己的 document 级监听，让位
  const input = document.getElementById('__zy_si__') as HTMLInputElement | null
  if (input) { // 搜索浮层开着
    if (e.target === input) return // 输入框自己的两段式 handler 管（target 阶段），避免双重处理
    e.preventDefault(); e.stopPropagation()
    if (input.value) {
      input.value = ''
      searchSelIndex = 0
      searchSelId = ''
      renderTypeTabs()
      void runSearch('')
    } else {
      closeOverlay()
    }
    return
  }
  // 表单浮层（资源采集/好奇/任务采集）：无自有 Esc，文档级兜底直接关闭
  e.preventDefault(); e.stopPropagation()
  closeOverlay()
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
/** R60-3：选中项锚点 = 卡片 id。下标会随补跑/重排漂移，id 不会——与 R48-A2 的点击修复统一口径 */
let searchSelId = ''
let searchResults: any[] = []
let lastQuery = ''
/** R97（A9）：高亮词 = 去掉 `#`/`@` 指令后的 kw（runSearch 每次刷新；hl 只吃它） */
let hlKw = ''

async function openSearch() {
  // V2.21：唤起即用——浮层与纯文本搜索立即生效，拼音字典并行后台加载，不阻塞首帧
  void ensurePinyin()
  searchType = 'all'
  searchSelIndex = 0
  searchSelId = ''
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
      <!-- R92（D2）：按钮**保持直接关闭**（显式点击 = 明确要关），只有键盘 Esc 走两段式 -->
      <button class="zy-esc-btn" id="__zy_esc__" title="关闭浮层（键盘 Esc 会先清空搜索框，空了才关闭）">Esc</button>
    </div>
    <div class="zy-type-tabs" id="__zy_tabs__"></div>
    <div class="zy-results" id="__zy_results__"></div>
    <div class="zy-foot">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>⏎</kbd> 打开</span>
      <span><kbd>→</kbd> 三件事</span>
      <span><kbd>Tab</kbd> 切换类型</span>
      <span><kbd>Esc</kbd> 关闭</span>
      <span class="zy-foot-brand">知源调度台 · 万千可调用，自有我方向</span>
    </div>
  `
  root.appendChild(panel)
  const input = document.getElementById('__zy_si__') as HTMLInputElement
  // R92（D1）：改走 focusWhenReady —— 原 50ms 延迟会让"唤起后立刻打字"的前几个字符丢失
  focusWhenReady(input)
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
  return t === 'res' ? '📄 资源卡' : t === 'task' ? '✅ 任务卡' : t === 'curio' ? '💡 好奇心' : t === 'ws' ? '🗂 策展台' : t === 'proj' ? '📦 项目' : '🔍 搜全部'
}

/**
 * B29：搜索框前过滤 chip —— 显示当前类型，点 × 复位为「搜全部」。
 *
 * R93（A5）：**chip 只在有输入时出现**。
 * 改前 chip 与下方类型 Tab 行**同时**表达同一个 searchType，屏幕上有两份；
 * 无输入时 Tab 行就在眼前、其 active 态已经说清当前类型，chip 是纯冗余 ⇒ 此时不显示。
 * 有输入时相反：输入框内容长、注意力在框内，chip 紧邻输入框最能说明「当前只看 X」。
 *
 * ⚠ 提案原文是"Tab 行只在有输入时出现、chip 常驻"；本实现**反过来**，
 * 因为无输入时隐藏 Tab 行会砍掉"打开浮层直接点『任务卡』浏览全部任务"这条真实路径
 * （空态只有四个「打开 X 页面」快捷操作 + 近期最常用，没有类型入口）。详见任务书 §2.1。
 */
function updateChip() {
  const chip = document.getElementById('__zy_chip__')
  if (!chip) return
  const label = document.getElementById('__zy_chip_label__')
  chip.style.display = (searchType === 'all' || !lastQuery) ? 'none' : 'inline-flex'
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
    for (const w of d.workspaces || []) if (!w.archived && w.id !== CURATION_WS_ID) c.ws++
    for (const dir of (d.compass && d.compass.directions) || []) for (const p of dir.projects || []) { if (!p.archived && (showDoneProjectsCache || !isProjDone(p, d))) c.proj++ }
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
    { key: 'ws', label: '🗂 策展台' },
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
  hlKw = parseOverlayQuery(lastQuery).kw // R97（A9）：高亮与 ws 树过滤共用去指令后的 kw
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
  // R60-3：按 id 恢复选中项——补跑/重排后不再把用户当前选中弹回第一条
  if (searchSelId) {
    const k = searchResults.findIndex((r: any) => String(r?.id || '') === searchSelId)
    if (k >= 0) searchSelIndex = k
  }
  { const cur: any = searchResults[searchSelIndex]; searchSelId = cur ? String(cur.id || '') : '' }
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
  // R97（A9）：高亮只吃 kw——`#标签` / `@项目` 是指令，不该在标题里找 "#x" 高亮
  const q = hlKw
  if (!q) return esc
  const i = esc.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return esc
  // R77（A1）：高亮底改用当前主题强调色、文字用主题文字色（原先写死成 linear 主题的那两个色值）
  return esc.slice(0, i) + '<mark class="zy-hl" style="background:color-mix(in srgb, var(--zy-accent) 32%, transparent);color:var(--zy-text);border-radius:3px;">' + esc.slice(i, i + q.length) + '</mark>' + esc.slice(i + q.length)
}

// REQ-031 P-031-1：搜索关联 Map 化——一次遍历构建 ws/cat/project 名称 Map + 策展台卡数累加，查找 O(1)
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

/**
 * R97（A9）：浮层搜索前缀直筛——`#标签` / `@项目`。
 * - `#x` 计入 tags：**全部命中才算**（交集，「直筛是收窄不是扩大」，对齐主应用 R89 matchCard 口径）；
 * - `@x` 计入 proj：收窄到「任务（项目名命中）+ 项目实体（名称命中）」——资源/好奇/策展台不属于任何项目，排除；
 * - 其余词 = kw：全文 blob / 拼音 / 高亮共用；
 * - **单个 `#` / `@`（后缀为空）回落为普通词**——避免边输入边筛把结果打空（R89 同款惯例）。
 * content script 纯 Vanilla，就地实现（不引主应用模块，见 v2/README 已知地雷）。
 */
function parseOverlayQuery(q: string): { tags: string[]; proj: string; kw: string } {
  const tags: string[] = []
  let proj = ''
  const words: string[] = []
  for (const tok of (q || '').trim().split(/\s+/)) {
    if (!tok) continue
    if (tok.length > 1 && tok[0] === '#') tags.push(tok.slice(1).toLowerCase())
    else if (tok.length > 1 && tok[0] === '@') proj = tok.slice(1).toLowerCase()
    else words.push(tok.toLowerCase())
  }
  return { tags, proj, kw: words.join(' ') }
}

function collectResults(d: any, query: string, results: any[], maps: SearchMaps) {
  const pq = parseOverlayQuery(query)
  const kw = pq.kw
  const match = (text: string) => !kw || text.toLowerCase().includes(kw)
  // R97（A9）：`#标签` 交集判据——卡的 tags 必须包含查询里的每一个标签（小写精确比对，与主应用 matchCard 一致）
  const hasAllTags = (tags: any) => pq.tags.every(t => (Array.isArray(tags) ? tags : []).map((x: any) => String(x).toLowerCase()).includes(t))
  // R97（A9）：`@项目` 收窄判据——按项目名子串命中
  const projHit = (name: any) => !pq.proj || String(name || '').toLowerCase().includes(pq.proj)
  // 第十九轮：拼音/首字母命中（按标题）

  // 资源卡
  if (searchType === 'all' || searchType === 'res') {
    d.resources?.filter((r: any) => !r.deletedAt).forEach((r: any) => {
      if (pq.proj) return // R97（A9）：`@项目` 下资源卡不隶属项目，排除
      const ws = maps.wsName.get(r.workspaceId)
      const cat = maps.catName.get(r.categoryId)
      const blob = r.title + ' ' + (r.description || '') + ' ' + (Array.isArray(r.tags) ? r.tags : []).join(',') + ' ' + (r.link || '')
      if (hasAllTags(r.tags) && (match(blob) || matchPinyin(r.title || '', kw))) {
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
      if (hasAllTags(t.tags) && projHit(projName) && (match(blob) || matchPinyin(t.title || '', kw))) {
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
      if (pq.proj) return // R97（A9）：好奇心不隶属项目，排除
      const statusText = c.status === 'todo' ? '🔵 待探索' : c.status === 'doing' ? '🟡 探索中' : c.status === 'done' ? '🟢 已求证' : '⚪ 已搁置'
      const cTags = Array.isArray(c.tags) ? c.tags.join(' ') : ''
      if (hasAllTags(c.tags) && (match(c.question + ' ' + cTags) || matchPinyin(c.question || '', kw))) {
        results.push({
          type: 'curio', iconClass: 'curio', iconText: '💡', id: c.id,
          title: c.question, ws: '调度台', cat: '好奇心',
          badges: [{ type: 'curio-status', text: statusText }], raw: c
        })
      }
    })
  }

  // 第卅二轮 REQ-008：检索范围扩展至策展台实体（模糊匹配策展台名称，专属图标）
  // R68-F1：口径对齐台签栏（app store workspaces getter）——排除资源台本体实体（固定 Tab，非台签策展台）+ 已归档，历史遗留实体不再混入
  if (searchType === 'all' || searchType === 'ws') {
    d.workspaces?.filter((w: any) => !w.archived && w.id !== CURATION_WS_ID).forEach((w: any) => {
      // R97（A9）：`#标签` / `@项目` 是卡片级收窄，策展台实体两不沾，指令在场时排除
      if (pq.tags.length || pq.proj) return
      if (match(w.name || '') || matchPinyin(w.name || '', kw)) {
        const cardCount = maps.wsCount.get(w.id) || 0
        results.push({
          type: 'ws', iconClass: 'ws', iconText: '🗂', id: w.id,
          title: w.name, ws: '策展台', cat: cardCount + ' 张资源卡',
          badges: [{ type: 'ws-badge', text: '策展台' }], raw: w
        })
      }
    })
  }

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=）
  // R68-F1：口径对齐方向台——尊重 showDoneProjects 开关（zy_ui_v2，默认显示），已完成/归档项目不再混入「历史版本项目」
  if (searchType === 'all' || searchType === 'proj') {
    ;((d.compass && d.compass.directions) || []).forEach((dir: any) => {
      ;(dir.projects || []).forEach((p: any) => {
        if (!showDoneProjectsCache && isProjDone(p, d)) return
        const badges: any[] = []
        if (p.isFocused) badges.push({ type: 'prio-high', text: '🎯 主攻' })
        if (p.status === 'archived') badges.push({ type: 'curio-status', text: '已完成' })
        // R97（A9）：项目实体本身即 `@项目` 的命中对象；`#标签` 是卡片级收窄，排除实体
        if (!pq.tags.length && projHit(p.name) && (match(p.name || '') || matchPinyin(p.name || '', kw))) {
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
    const focusElm = e.querySelector('.zy-ri-focus')
    e.title = '单击 → 打开链接（无链接则定位） · Ctrl+Enter → 定位并打开详情' + (focusElm ? ' · → 加入今日三件事' : '')
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
    // R78（A7）：「→ 三件事」按钮——先于行点击，阻断打开链接/定位
    const focusBtn = e.querySelector('.zy-ri-focus') as HTMLElement | null
    if (focusBtn) {
      focusBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const fid = focusBtn.dataset.focusId || ''
        const hit = searchResults.find(r => String(r?.id || '') === fid)
        if (hit) void addTaskToDailyFocus(hit)
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
      // R60-3：同步 id 锚点——hover 之后即便结果集因拼音补跑而重排，Enter 打开的仍是这一张
      searchSelId = e.dataset.id || ''
      document.querySelectorAll('.zy-result-item').forEach((e2, j) => e2.classList.toggle('sel', j === searchSelIndex))
    })
  })
}

// ============ R78（A7）：浮层内「加入今日三件事」（仅任务卡） ============
/** 今日键：本地时区 YYYY-MM-DD，与 CompassHome.dateStr 口径一致 */
function todayKeyStr(): string {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate())
}
/** A7-a：刷新「已入选今日三件事」的任务 id 集合（结果项置灰去重用）。
 *  渲染前调用一次即可——每次写入后会同步 dataCache 并再次调用，保证集合不陈旧。 */
function refreshTodayFocus() {
  const list: any[] = dataCache?.dailyFocus?.[todayKeyStr()] || []
  todayFocusSourceIds = new Set(list.map((s: any) => String(s?.sourceId || '')).filter(Boolean))
}
/** A7-b：就地刷新所有「→ 三件事」按钮的置灰与文案（不整表重渲染，避免打断输入焦点与选中行） */
function refreshFocusButtons() {
  document.querySelectorAll<HTMLElement>('.zy-ri-focus').forEach(b => {
    const on = todayFocusSourceIds.has(b.dataset.focusId || '')
    b.classList.toggle('on', on)
    b.textContent = on ? '✓ 已入选' : '→ 三件事'
    b.title = on ? '已在今日三件事中（点击定位）' : '加入今日三件事（→）'
  })
}
/** A7-e：任务定位分流——挂了项目/指标 → 项目详情；否则 → 调度台任务调度模块高亮 */
function focusLocateTask(item: any) {
  const t = item?.raw || item
  const id = String(t?.id || item?.id || '')
  const route = t?.projectId ? '/compass/projects?p=' + t.projectId : '/?hl=' + id
  try { chrome.runtime.sendMessage({ type: 'zy-open-route', route }) } catch { /* ignore */ }
  showToast(t?.projectId ? '↗ 已定位到项目详情' : '↗ 已定位到调度台的任务')
  closeOverlay()
}
/** A7-d：把任务卡加入今日三件事
 *  ① 去重：已入选则不再写库，直接定位；
 *  ② ≤3 硬上限：满则两段式替换（首次只提示，再按一次才落库，防误替换）；
 *  ③ 跨上下文合并：读写一律绕过 1500ms 缓存——loadData 取最新快照 → 改 → saveData → 同步 dataCache，
 *     把「读—改—写」压在一次往返内，避免与新标签页的整体覆盖写互相吃掉（lost update）。 */
async function addTaskToDailyFocus(item: any) {
  const t = item?.raw || item
  const taskId = String(t?.id || '')
  if (!taskId) return
  if (todayFocusSourceIds.has(taskId)) { showToast('该任务已在今日三件事中'); focusLocateTask(item); return }
  const key = todayKeyStr()
  const d = await loadData() // 绕过缓存，取 storage 最新快照
  if (!d) { showToast('数据加载失败'); return }
  d.dailyFocus = d.dailyFocus || {}
  const list: any[] = d.dailyFocus[key] || []
  // 与 CompassHome.selectTaskForSlot 完全同构，保证调度台三件事卡片能直接识别
  const slot = {
    id: uid('focus'), sourceType: 'task', sourceId: taskId,
    text: String(t?.title || '快速任务'), done: t?.status === 'done', doneAt: t?.completedAt
  }
  let replaced = -1
  if (list.length >= FOCUS_LIMIT) {
    if (pendingReplaceSlot === null) {
      pendingReplaceSlot = 0
      showToast('今日三件事已满 3/3 · 再按一次替换第 1 件')
      return
    }
    replaced = Math.min(Math.max(pendingReplaceSlot, 0), FOCUS_LIMIT - 1)
    list[replaced] = slot
    pendingReplaceSlot = null
  } else {
    list.push(slot)
  }
  d.dailyFocus[key] = list
  await saveData(d)
  dataCache = d; dataCacheAt = Date.now() // 同步缓存，后续读不再取到旧快照
  refreshTodayFocus()
  showToast(replaced >= 0 ? '✓ 已替换今日第 ' + (replaced + 1) + ' 件事' : '✓ 已加入今日三件事（' + list.length + '/' + FOCUS_LIMIT + '）')
  refreshFocusButtons()
}

function renderResults() {
  const el = document.getElementById('__zy_results__')
  if (!el) return
  refreshTodayFocus() // R78（A7-a）：每次渲染前对齐一次已入选集合
  // B1：浏览模式（空查询 + 全部）= 快捷操作 + 最近调出（近 7 天，R97-A8）+ 近期最常用（R47-B4：全类型按调用次数降序）
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
    // R97（A8）：「最近调出」= 近 7 天有调出记录的卡（lastCalledAt 降序，≤8 条）——
    // 「用过多久」和「用得多频」是两个问题：上周刚翻过的资料不该被三个月没用 20 次的工具压下去。
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const nowTs = Date.now()
    const recentCalled = heat
      .filter(function (x: any) { return (x.raw.lastCalledAt || 0) >= nowTs - WEEK_MS })
      .sort(function (a: any, b: any) { return (b.raw.lastCalledAt || 0) - (a.raw.lastCalledAt || 0) })
      .slice(0, 8)
    const recentIdSet = new Set(recentCalled.map(function (x: any) { return String(x.id || '') }))
    // 「近期最常用」沿用 callCount 口径，排除上一段已出现的卡（同卡不在空态出现两次）
    const hot = heat.filter(function (x: any) { return !recentIdSet.has(String(x.id || '')) }).slice(0, 8)
    // R97 顺带修正：热词行此前一律标 type:'res'/📄——Enter/点击对任务/好奇/策展台行会
    // 误按资源逻辑分发（策展台行定位 /workspace/undefined；任务/好奇不写 bumpHeat 计数）。
    // 现按 pushHeat 时的真实 type 分发（行仍带 data-id，bindResultEvents 按 id 解析不受影响）。
    const toRow = function (r: any) {
      return { type: r.type, iconClass: r.iconClass, iconText: r.iconText, id: r.id, title: r.title, ws: '', cat: '', badges: [], raw: r.raw }
    }
    searchResults = [
      ...QUICK_ACTIONS_ZY.map(function (qa) { return { type: 'qa', qa: qa } }),
      ...recentCalled.map(toRow),
      ...hot.map(toRow)
    ]
    searchSelIndex = searchResults.length ? 0 : -1
    { const cur: any = searchResults[searchSelIndex]; searchSelId = cur ? String(cur.id || '') : '' }
    const qaHtml = QUICK_ACTIONS_ZY.map(function (qa, i) {
      return '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '">' +
        '<div class="zy-ri-icon res">↵</div>' +
        '<div class="zy-ri-main"><div class="zy-ri-title">' + qa.label + '</div></div></div>'
    }).join('')
    const heatRowHtml = function (r: any, j: number, base: number) {
      return '<div class="zy-result-item' + (base + j === searchSelIndex ? ' sel' : '') + '" data-idx="' + (base + j) + '" data-id="' + escapeHtml(String(r.id || '')) + '">' +
        '<div class="zy-ri-icon ' + r.iconClass + '">' + r.iconText + '</div>' +
        '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(r.title) + '</div></div>' +
        '<span class="zy-ri-link url">🔥' + (r.raw.callCount || 0) + '</span></div>'
    }
    const recentHtml = recentCalled.length
      ? '<div class="zy-group-title">🕐 最近调出 · 近 7 天</div>' + recentCalled.map(function (r: any, j: number) { return heatRowHtml(r, j, QUICK_ACTIONS_ZY.length) }).join('')
      : ''
    const hotHtml = hot.length
      ? '<div class="zy-group-title">🔥 近期最常用 · 按调用次数</div>' + hot.map(function (r: any, j: number) { return heatRowHtml(r, j, QUICK_ACTIONS_ZY.length + recentCalled.length) }).join('')
      : ''
    el.innerHTML = '<div class="zy-group-title">快捷操作</div>' + qaHtml + recentHtml + hotHtml
    bindResultEvents(el)
    return
  }
  // R49-G2：策展台类型 → 策展台→分类树（点击分类定位：有卡高亮第一张，无卡高亮分类行）
  if (searchType === 'ws') {
    const d2: any = dataCache || (window as any).__zyDataCache
    const q = hlKw // R97（A9）：树名过滤吃去指令后的 kw，`#`/`@` 不该拿来匹配台名
    const wss = (d2?.workspaces || []).filter((w: any) => !w.archived && (!q || (w.name || '').toLowerCase().includes(q)))
    let treeHtml = ''
    for (const w of wss) {
      const cats = (d2?.categories || []).filter((c: any) => c.workspaceId === w.id && (!q || (c.name || '').toLowerCase().includes(q)))
      const wsCards = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id).length
      treeHtml += '<div class="zy-group-title">🗂 ' + escapeHtml((w.name || '').replace(/^[^\s]+\s/, '')) + ' <span style="color:var(--zy-text-4);font-weight:400">' + wsCards + ' 张卡</span></div>'
      for (const c of cats) {
        const fam = new Set<string>([c.id, ...(d2?.categories || []).filter((x: any) => x.parentId === c.id).map((x: any) => x.id)])
        const cnt = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id && fam.has(r.categoryId || '')).length
        treeHtml += '<div class="zy-result-item" data-wscat="' + escapeHtml(w.id) + '" data-catid="' + escapeHtml(c.id) + '">' +
          '<div class="zy-ri-icon ws">📁</div>' +
          '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(c.name || '') + '</div>' +
          '<div class="zy-ri-meta"><span class="zy-badge cat">' + cnt + ' 张卡</span>' + (cnt ? '' : '<span class="zy-badge">空分类 · 定位到分类</span>') + '</div></div>' +
          '<span class="zy-ri-link url">定位 ↗</span></div>'
      }
      if (!cats.length) treeHtml += '<div class="zy-group-more">该策展台暂无分类</div>'
    }
    el.innerHTML = treeHtml || '<div class="zy-empty"><div class="icon">🗂</div><div class="text">没有匹配的策展台</div></div>'
    el.querySelectorAll<HTMLElement>('.zy-result-item[data-wscat]').forEach(n => {
      n.addEventListener('click', () => {
        const wsId = n.dataset.wscat || ''
        const catId = n.dataset.catid || ''
        safeSend({ type: 'zy-open-route', route: '/workspace/' + wsId + '?cat=' + catId })
        showToast('↗ 已定位到分类')
        closeOverlay()
      })
    })
    return
  }
  if (!searchResults.length) {
    el.innerHTML = '<div class="zy-empty"><div class="icon">🪹</div><div class="text">没有匹配的卡片<br><span style="font-size:var(--zy-fs-xs)">试试更短的关键词</span></div></div>'
    return
  }
  const groups = [
    { label: '📄 资源卡', type: 'res' },
    { label: '✅ 任务卡', type: 'task' },
    { label: '💡 好奇心', type: 'curio' },
    { label: '🗂 策展台', type: 'ws' },
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
    html += '<div class="zy-group-title">' + g.label + ' <span style="color:var(--zy-text-4);font-weight:400">' + items.length + '</span></div>'
    shown.forEach(function (item: any, j: number) {
      const i = offset + j
      const badgesHtml = item.badges.map(function (b: any) { return '<span class="zy-badge ' + b.type + '">' + b.text + '</span>' }).join('')
      const linkHtml = item.link ? '<span class="zy-ri-link ' + item.link.type + '">' + (item.link.type === 'url' ? '🔗' : item.link.type === 'file' ? '📁' : '📝') + ' ' + item.link.text + '</span>' : ''
      const summaryHtml = item.summary ? '<div class="zy-ri-summary">' + hl(item.summary) + '</div>' : ''
      // R55-H2：三卡结果行提供直接删除（无二次确认，软删进回收站）
      const delHtml = (g.type === 'res' || g.type === 'task' || g.type === 'curio')
        ? '<span class="zy-ri-del" data-del-id="' + escapeHtml(String(item.id || '')) + '" title="直接删除（可回收站恢复）">🗑</span>'
        : ''
      // R78（A7-b）：仅任务卡提供「加入今日三件事」；已入选的置灰并改文案
      const inFocus = todayFocusSourceIds.has(String(item.id || ''))
      const focusHtml = g.type === 'task'
        ? '<span class="zy-ri-focus' + (inFocus ? ' on' : '') + '" data-focus-id="' + escapeHtml(String(item.id || '')) + '" title="' +
          (inFocus ? '已在今日三件事中（点击定位）' : '加入今日三件事（→）') + '">' + (inFocus ? '✓ 已入选' : '→ 三件事') + '</span>'
        : ''
      html += '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '" data-id="' + escapeHtml(String(item.id || '')) + '">' +
        '<div class="zy-ri-icon ' + item.iconClass + '">' + item.iconText + '</div>' +
        '<div class="zy-ri-main">' +
        '<div class="zy-ri-title">' + hl(item.title) + '</div>' +
        '<div class="zy-ri-meta"><span class="zy-badge ws">' + escapeHtml(item.ws) + '</span><span class="zy-badge cat">' + escapeHtml(item.cat) + '</span>' + badgesHtml + linkHtml + '</div>' +
        summaryHtml + '</div>' + focusHtml + delHtml + '</div>'
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
    searchSelId = String((searchResults[searchSelIndex] || {}).id || '')
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchSelIndex = Math.max(searchSelIndex - 1, 0)
    searchSelId = String((searchResults[searchSelIndex] || {}).id || '')
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!searchSelIndex && searchSelIndex !== 0) return
    // R60-3：优先按 id 解析——补跑/重排后下标会漂移，id 永远指向用户选中的那一张
    const selItem =
      (searchSelId ? searchResults.find((r: any) => String(r?.id || '') === searchSelId) : undefined) ||
      searchResults[searchSelIndex]
    if (selItem) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter：定位到卡片所在处并打开详情抽屉
        openSearchLocator(selItem)
      } else {
        // Enter：直接打开链接（无链接则定位）
        openSearchResult(selItem)
      }
    }
  } else if (e.key === 'ArrowRight') {
    // R78（A7-c）：→ 加入今日三件事（仅任务卡）。两处克制：
    // ① 不动 Ctrl+Enter——它已是「定位并打开详情抽屉」；
    // ② → 在搜索框里本就是「光标右移」，故仅当光标已在末尾（右移本就无意义）时才截获，不抢编辑键位。
    const inp = document.getElementById('__zy_si__') as HTMLInputElement | null
    const atEnd = !inp || (inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length)
    if (!atEnd) return
    const selItem =
      (searchSelId ? searchResults.find((r: any) => String(r?.id || '') === searchSelId) : undefined) ||
      searchResults[searchSelIndex]
    if (!selItem || selItem.type !== 'task') return
    e.preventDefault(); e.stopPropagation()
    void addTaskToDailyFocus(selItem)
  } else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；搜索框 chip 与类型 Tab 行同步更新
    e.preventDefault()
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    const q = (input?.value || '').trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['策展台', 'ws'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
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
    // R92（D2）：两段式——**有内容先清空，空再关闭**。
    // 原实现直接 closeOverlay()，反射性按一下 Esc 就把整段查询丢掉（再唤起要重打）。
    // ⚠ 键位与右端「Esc」按钮（#__zy_esc__）刻意不同：按钮是**显式点击意图**，保持直接关闭。
    // 二者语义不同是有意的，别当成 bug 统一掉。
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    if (input && input.value) {
      e.preventDefault(); e.stopPropagation()
      input.value = ''
      searchSelIndex = 0
      searchSelId = ''
      renderTypeTabs()
      runSearch('')
    } else {
      closeOverlay()
    }
  }
}

function openSearchLocator(item: any) {
  // 第卅七轮 REQ-045：Ctrl+Enter / 定位专用 —— 跳转到对应视图 + 打开详情抽屉
  // 走 zy-open-route（background 有处理）+ 透传 drawer 参数（background 转发给宿主 newtab）
  const send = (route: string, drawer: { kind: string; id: string }) => {
    safeSend({ type: 'zy-open-route', route, drawer })
  }
  if (item.type === 'qa') {
    safeSend({ type: 'zy-open-route', route: item.qa.route })
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
    safeSend({ type: 'zy-open-route', route: item.qa.route })
    closeOverlay()
    return
  }
  if (item.type === 'ws') {
    bumpHeat('ws', item.id)
    safeSend({ type: 'zy-open-route', route: '/workspace/' + item.id })
    closeOverlay()
    return
  }
  if (item.type === 'proj') {
    // R49-G：项目条目 → 直达项目详情（二级页）
    safeSend({ type: 'zy-open-route', route: '/compass/projects?p=' + item.id })
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
          showToast('⚠ 本地文件缺少完整路径，请到资源台补全')
          safeSend({ type: 'zy-open-route', route: '/workspace/' + r.workspaceId + '?hl=' + r.id })
        }
      }
    } else {
      safeSend({ type: 'zy-open-route', route: '/workspace/' + r.workspaceId + '?hl=' + r.id })
      showToast('↗ 已定位到卡片所在资源台')
    }
  } else if (item.type === 'task') {
    bumpHeat('task', item.id)
    safeSend({ type: 'zy-open-route', route: '/?hl=' + item.id })
    showToast('↗ 已定位到调度台的任务')
  } else {
    bumpHeat('curio', item.id)
    safeSend({ type: 'zy-open-route', route: '/?hl=' + item.id })
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
/** R70：任务采集浮层「保存」回调（模块级单例）。
 *  此前 onTcKey 是 openTaskCapture 内部的局部闭包，每次唤起都往 document 上挂一个新的 keydown
 *  监听，而全文没有对应的解绑（closeOverlay 只 innerHTML=''）——同一页面第 N 次唤起任务采集后，
 *  按 Ctrl+Enter 会同时触发 N 个监听器（每层的 getElementById 守卫都命中新浮层）→ 一次保存写 N 条重复任务。
 *  改为模块级具名函数：浏览器对「同函数引用 + 同 capture」的重复 addEventListener 自动去重，天然不累积。 */
let activeTcSave: (() => void) | null = null
function onTcKeydown(e: KeyboardEvent) {
  if (!activeTcSave || !document.getElementById('__zy_tc_save__')) return
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); activeTcSave() }
}
// overlay-impl 为动态 import：模块只求值一次，此处注册一次即可
document.addEventListener('keydown', onTcKeydown, true)

let savedState = false
let savedTimer: ReturnType<typeof setTimeout> | null = null
/** R78（A3）：保存回执 toast 化后，整屏确认块消失，但「Enter 打开看板」仍要在回执期内可用
 *  ⇒ 把动作挂到模块级，供 onSavedKeydown 调用（原实现依赖已被移除的 __zy_saved_open__ 按钮） */
let savedOpenBoard: (() => void) | null = null
/** R78（A7）：今日三件事——已入选任务的 sourceId 集合（浮层打开时读取，供结果项置灰去重） */
let todayFocusSourceIds = new Set<string>()
/** R78（A7）：三件事已满时的两段式替换——记录待替换槽位（0..2），关闭浮层即清空 */
let pendingReplaceSlot: number | null = null
/** R78（A7）：三件事槽位硬上限（与 shared/models 的「每天最多 3 个」及 CompassHome.FOCUS_LIMIT 一致） */
const FOCUS_LIMIT = 3
// REQ-031 P-031-8：采集去重 Map——打开小窗时构建一次 url→resource，保存时 O(1) 查重（千卡下不再全量扫描）
let capUrlMap: Map<string, any> | null = null

async function openCapture() {
  savedState = false
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  // R117（04-61 A）：force=true——分类随时增删改，打开采集浮层必须吃「当前分类」而非旧快照
  const d = await getData(true)
  capUrlMap = new Map()
  for (const r of d?.resources || []) {
    if (r.deletedAt || r.linkType !== 'url' || !r.link) continue
    const fp = normalizeUrl(r.link)
    if (!capUrlMap.has(fp)) capUrlMap.set(fp, r)
  }
  const workspaces = d?.workspaces?.filter((w: any) => !w.archived) || []
  const defaultWs = workspaces[0]
  // R117（04-61 A）：分类口径统一——过滤软删（原实现漏了 deletedAt，软删分类会以「幽灵项」留存在下拉里）
  const categories = buildCatOptions(d?.categories?.filter((c: any) => c.workspaceId === defaultWs?.id) || [], { sep: ' / ' })
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
          <label class="zy-field-label">存入台面</label>
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
      <!-- R97（D4）：资源采集不设「关联项目」——ResourceCard 模型无 projectId（单向挂载红线：
           资源由台面/分类组织，任务才是持挂载方）。按提案「或明确边界并说明」分支，把边界写在表单里。 -->
      <div class="zy-cap-boundary">资源卡不挂项目——需要与行动同行时，先入台，再到任务详情里「挂载到任务」</div>
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

  // R92（D1）：同上；标题预填了 document.title，聚焦后全选便于直接改写
  focusWhenReady(titleInput, { select: true })

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
    // R117（04-61 A）：切台面重算分类——同口径（过滤软删 + 防环 + 路径 label）
    const d2 = await getData(true)
    const cats = buildCatOptions(d2?.categories?.filter((c: any) => c.workspaceId === wsSelect.value) || [], { sep: ' / ' })
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
  document.getElementById('__zy_cap_save__')?.addEventListener('click', () => { void saveCapture() })

  async function saveCapture(forceNew = false) {
    const title = titleInput.value.trim()
    if (!title) { showToast('请输入标题'); return }
    const d2 = await getData()
    if (!d2) { showToast('数据加载失败'); return }
    // B5 去重：相同归一化链接 → 确认视图（定位原卡 / 仍然新建一张，R105-D3）；forceNew 跳过查重
    if (!forceNew && linkType === 'url' && linkInput.value.trim()) {
      const fp = normalizeUrl(linkInput.value.trim())
      const dup = capUrlMap?.get(fp)
      if (dup) {
        // B28：面板内自定义确认（替代原生 confirm）
        showDupConfirm(String(dup.title).slice(0, 40), () => {
          safeSend({ type: 'zy-locate-workspace', wsId: dup.workspaceId, hl: dup.id })
          closeOverlay()
          showToast('↗ 已定位到已收录的卡片')
        }, () => { void saveCapture(true) })
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
    // R92（E1）：未归档轻引导——分类下拉的「📥 待分类」是**默认项且 value 为空**，
    // 故 catSelect.value 为空 = 这张卡落在待分类 = 还没归位。动线断点正是"采集后不归位"，
    // 回执里点一句，而不是等用户自己想起来。**动作不变**，只说明为什么要去那儿。
    const filed = !!catSelect.value
    // R78（A3）：回执 toast 化——不再整屏确认；回执期内 Enter 仍可打开看板并定位到这张卡
    showSaved(filed ? '✓ 已入台 · Enter 打开看板' : '✓ 已入台 · 未归档 · Enter 去归位', () => {
      // 通知 background：单例定位到已打开的策展台标签页，或新建
      chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: resource.workspaceId, hl: resource.id })
    })
  }
}

/** 采集去重确认视图（B28：替代原生 confirm，复用已保存态的视觉结构） */
function showDupConfirm(dupTitle: string, onJump: () => void, onForceNew: () => void) {
  const root = ensureRoot()
  const panel = root.querySelector('.zy-panel') as HTMLElement | null
  if (!panel) return
  panel.innerHTML = `
    <div class="zy-saved">
      <div class="zy-saved-icon warn">⚠️</div>
      <div class="zy-saved-title">该页面已收录</div>
      <div class="zy-saved-sub">「${escapeHtml(dupTitle)}」已存在于资源台——可定位到原卡，或仍然新建一张（例如要存不同上下文的两份笔记）</div>
      <div class="zy-saved-actions">
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_cancel__">取消</button>
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_force__">仍然新建一张</button>
        <button class="zy-btn zy-btn-primary" id="__zy_dup_jump__">定位到卡片</button>
      </div>
    </div>
  `
  document.getElementById('__zy_dup_cancel__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_dup_force__')?.addEventListener('click', onForceNew)
  document.getElementById('__zy_dup_jump__')?.addEventListener('click', onJump)
}

/** R78（A3）：保存回执轻量化——整屏确认块收窄为一行 toast，2.5 秒自动消失。
 *  「Enter 打开看板」在回执期内仍然可用：动作挂到模块级 savedOpenBoard（原实现依赖的整屏按钮已随
 *  确认块一起移除）。openAction 传空时只提示、不挂 Enter。
 *  注意：重复卡确认视图（showDupConfirm）是「只能定位不能重复收录」的阻断态，按需求维持整屏，不走这里。 */
function showSaved(toastMsg: string, openAction: (() => void) | null) {
  savedState = true
  closeOverlay() // 先销毁采集面板并清掉遗留监听，再挂本次回执动作
  savedOpenBoard = openAction
    ? () => {
        try { openAction() } catch { /* ignore */ }
        clearSavedState()
      }
    : null
  showToast(toastMsg, 2500)
  document.addEventListener('keydown', onSavedKeydown, true)
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(clearSavedState, 2500)
}
/** R78（A3）：回执态复位——状态位、待执行动作、定时器、键盘监听一并清理 */
function clearSavedState() {
  savedState = false
  savedOpenBoard = null
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  document.removeEventListener('keydown', onSavedKeydown, true)
}

function onSavedKeydown(e: KeyboardEvent) {
  if (!savedState) return
  if (e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation()
    savedOpenBoard?.()
  } else if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation()
    savedState = false
    closeOverlay()
  }
}

// ============ 采集好奇心（居中，选中文本预填 + O24 自动附带页面来源） ============
/** R55-C：快速采集任务（任意网页快捷键触发；四字段全非必填，直存全域任务）
 *  R66-F1：对齐好奇心速记——选中文本→任务内容、网页标题→任务名称、页面URL→链接（均可编辑） */
async function openTaskCapture() {
  // R66-F1：实时选区优先 → 预取缓存兜底（与 openCuriosity 同一链路）
  const cached = getSelCache()
  const selection = resolveSelection()
  const hasSel = !!selection
  const pageTitle = hasSel ? ((cached.url === location.href && cached.title) || (document.title || '').trim()) : ''
  const pageUrl = hasSel ? ((cached.url === location.href && cached.url) || location.href) : ''
  clearSelCache()
  const d = await getData()
  const projects: any[] = []
  for (const dir of d?.compass?.directions || []) for (const p of dir.projects || []) projects.push({ id: p.id, name: p.name, metrics: p.metrics || [] })
  // R67-F2：任务采集弹窗改页面正中弹出（与好奇心速记一致；原先 corner 在插件图标附近）
  openOverlay('center', closeOverlay)
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
      <div class="zy-field"><label class="zy-field-label">任务名称${hasSel ? '（已填入网页标题，可编辑）' : ''}</label>
        <input type="text" class="zy-field-input" id="__zy_tc_title__" placeholder="要做什么（可留空）" value="${escapeHtml(hasSel ? pageTitle : '')}"></div>
      <div class="zy-field"><label class="zy-field-label">任务内容${hasSel ? '（已填入选中文本，可编辑）' : ''}</label>
        <textarea class="zy-field-input" id="__zy_tc_desc__" placeholder="补充说明、上下文、验收标准（可留空）">${escapeHtml(selection)}</textarea></div>
      <div class="zy-field"><label class="zy-field-label">🔗 链接${hasSel ? '（已自动捕获当前页，可编辑）' : '（可选，留空即无链接）'}</label>
        <input type="text" class="zy-field-input" id="__zy_tc_link__" placeholder="https://…" value="${escapeHtml(hasSel ? pageUrl : '')}"></div>
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
  const descInput = document.getElementById('__zy_tc_desc__') as HTMLTextAreaElement
  const linkInput = document.getElementById('__zy_tc_link__') as HTMLInputElement
  const projSel = document.getElementById('__zy_tc_proj__') as HTMLSelectElement
  const metSel = document.getElementById('__zy_tc_met__') as HTMLSelectElement
  // R92（D1）：同上；有选区时焦点落在描述（内容已预填），否则落在标题
  focusWhenReady(hasSel ? descInput : titleInput)
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
    const desc = descInput?.value.trim() || ''
    const link = linkInput?.value.trim() || ''
    const task: any = {
      id: uid('tk'), kind: 'task', title: titleInput.value.trim() || '快速任务',
      description: desc, link: link || undefined, status: 'todo', priority: 'medium',
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
    // R78（A3）：回执 toast 化——原整屏确认块与「5 秒后自动关闭」一并移除。
    // 回执期内 Enter 打开落点：挂了项目/指标 → 项目详情；否则 → 调度台高亮这张任务卡。
    const tcRoute = task.projectId ? '/compass/projects?p=' + task.projectId : '/?hl=' + task.id
    // R92（E1）：任务卡的"归位" = 挂到项目（指标依附于项目，项目为空时指标必然为空，只判项目即可）。
    // R92（T4）★ 顺带修既有缺陷：无项目时路由是 `/`（**调度台**），回执却写「打开**方向台**」——
    // 与 R91 清偿的「任务中心顶部」是同一类坏账：**文案指向的页面与实际落点不一致**。
    const filed = !!task.projectId
    showSaved('✓ 任务已保存 · ' + (filed ? 'Enter 打开项目' : '未归档 · Enter 去归位'), () => {
      chrome.runtime.sendMessage({ type: 'zy-open-route', route: tcRoute })
    })
  }
  document.getElementById('__zy_tc_save__')?.addEventListener('click', saveTc)
  // R70：注册到模块级单例（见 onTcKeydown）——不再在此处新建 keydown 闭包
  activeTcSave = saveTc
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
  // R92（D1）：同上。⚠ toEnd 条件**必须保留** —— 有选区时文本已预填，光标应停在开头供检查，不能无脑推到末尾
  focusWhenReady(textarea, { toEnd: !selection })

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
