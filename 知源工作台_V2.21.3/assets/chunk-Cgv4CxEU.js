import{e as ae,m as j,i as re,o as le}from"./chunk-B5LsIB8d.js";import{g as ce,r as de,c as pe,a as ue}from"./chunk-CxsnJ3lm.js";import"./chunk-CLcXU_4U.js";const m="__zy_global_overlay__",L="zy_data_v2";async function Y(){return(await chrome.storage.local.get(L))[L]||null}async function H(e){await chrome.storage.local.set({[L]:e})}function ne(e){return e+"_"+Date.now().toString(36)+Math.random().toString(36).substring(2,6)}let C=null,O=0;async function I(){if(C&&Date.now()-O<1500)return C;const e=await Y();return C=e,O=Date.now(),window.__zyDataCache=e,e}typeof chrome<"u"&&chrome.storage?.onChanged&&chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&e[L]&&(C=e[L].newValue,O=Date.now(),window.__zyDataCache=C,fe())});function ye(){if(document.getElementById("__zy_styles__"))return;const e=document.createElement("style");e.id="__zy_styles__",e.textContent=`
    #${m}{position:fixed;inset:0;z-index:2147483647;display:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;}
    #${m}.open{display:block;}
    #${m} .zy-scrim{position:absolute;inset:0;background:rgba(15,17,20,.18);}
    #${m}.center{display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(245,243,238,.72);backdrop-filter:blur(20px) saturate(1.4);}
    #${m}.corner{display:flex;align-items:flex-start;justify-content:flex-end;padding:10px 10px 14px;}

    .zy-panel{position:relative;background:#FDFDFC;border-radius:16px;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 0 0 1px rgba(0,0,0,.05),0 12px 32px rgba(0,0,0,.10),0 32px 72px rgba(0,0,0,.14);overflow:hidden;font-size:14px;color:#1A1D23;animation:zyPanelIn .22s cubic-bezier(.16,1,.3,1);}
    @keyframes zyPanelIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    /* 居中搜索面板 */
    #${m}.center .zy-panel{width:640px;max-width:92vw;}
    /* 好奇心采集：居中 640px（D6） */
    #${m}.center .zy-panel.curio{width:640px;}
    /* 右上角采集小窗（对标 Obsidian Web Clipper：400×600） */
    #${m}.corner .zy-panel{width:400px;max-width:calc(100vw - 28px);max-height:min(600px,calc(100vh - 72px));overflow-y:auto;}
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
  `,document.documentElement.appendChild(e)}function D(){let e=document.getElementById(m);return e||(e=document.createElement("div"),e.id=m,document.documentElement.appendChild(e)),e}function W(e,t){ye();const i=D();if(i.className=e==="center"?"center open":"corner open",i.innerHTML="",t){const o=document.createElement("div");o.className="zy-scrim",o.addEventListener("click",t),i.appendChild(o)}}function y(){const e=document.getElementById(m);e&&(e.classList.remove("open","center","corner"),e.innerHTML="",document.removeEventListener("keydown",oe,!0))}function b(e,t=2e3){let i=document.getElementById("__zy_toast__");i||(i=document.createElement("div"),i.id="__zy_toast__",i.className="zy-toast",document.documentElement.appendChild(i)),i.textContent=e,i.classList.add("show"),setTimeout(()=>i.classList.remove("show"),t)}let f="all",p=0,h=[],T="";async function De(){ae(),f="all",p=0,W("center",y);const e=D(),t=document.createElement("div");t.className="zy-panel",t.innerHTML=`
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
      <span class="zy-foot-brand">知源工作台 · 从好奇出发，向源头求证</span>
    </div>
  `,e.appendChild(t);const i=document.getElementById("__zy_si__");setTimeout(()=>i?.focus(),50);let o=null;i.addEventListener("input",()=>{o&&clearTimeout(o),o=setTimeout(()=>B(i.value),60)}),i.addEventListener("keydown",be),document.getElementById("__zy_esc__")?.addEventListener("click",y),document.getElementById("__zy_chip_x__")?.addEventListener("click",()=>{f="all",p=0,S(),B(i?.value||"")}),S(),B("")}function ie(e){return e==="res"?"📄 资源卡":e==="task"?"✅ 任务卡":e==="curio"?"💡 好奇心":e==="ws"?"🗂 工作台":"🔍 搜全部"}function V(){const e=document.getElementById("__zy_chip__");if(!e)return;const t=document.getElementById("__zy_chip_label__");e.style.display=f==="all"?"none":"inline-flex",t&&(t.textContent=ie(f))}let X=null;function fe(){X=null}function ge(){const e=C||window.__zyDataCache,t={all:0,res:0,task:0,curio:0,ws:0};if(e){for(const i of e.resources||[])i.deletedAt||t.res++;for(const i of e.tasks||[])i.deletedAt||t.task++;for(const i of e.curiosities||[])i.deletedAt||t.curio++;for(const i of e.workspaces||[])i.archived||t.ws++;t.all=t.res+t.task+t.curio}return X=t,t}function Q(e){return(X||ge())[e]||0}function S(){const e=document.getElementById("__zy_tabs__");if(!e)return;if(e.getAttribute("data-search-type")===f&&e.children.length){e.querySelectorAll(".zy-type-tab").forEach(o=>{const s=o.querySelector(".cnt");s&&(s.textContent=String(Q(o.dataset.type)))}),V();return}const i=[{key:"all",label:"🔍 搜全部"},{key:"res",label:"📄 资源卡"},{key:"task",label:"✅ 任务卡"},{key:"curio",label:"💡 好奇心"},{key:"ws",label:"🗂 工作台"}];e.setAttribute("data-search-type",f),e.innerHTML=i.map(o=>{const s=Q(o.key);return`<div class="zy-type-tab${f===o.key?" active":""}" data-type="${o.key}">${o.label} <span class="cnt">${s}</span></div>`}).join(""),e.querySelectorAll(".zy-type-tab").forEach(o=>{o.addEventListener("click",()=>{f=o.dataset.type,p=0,S(),U()})}),V()}async function B(e,t){T=(e||"").trim();let i=null;try{i=await I()}catch(s){console.error("[知源] 搜索数据读取失败",s)}S();const o=[];if(!i){h=[],U();return}try{const s=ze(i);me(i,he(e),o,s)}catch(s){console.error("[知源] 搜索执行异常",s)}if(t?.mergeAppend&&h.length&&T){const s=a=>(a?.type||"")+":"+String(a?.id||a?.title||""),n=new Set(h.map(s));for(const a of o)n.has(s(a))||(h.push(a),n.add(s(a)))}else h=o,h.sort((s,n)=>{const a=c=>c?.raw?c.raw.pinned?2:c.raw.starred?1:0:0;return a(n)-a(s)});p=Math.min(p<0?0:p,Math.max(h.length-1,-1)),U(),_e()}let R=!1;function _e(){R||!T||re()||(R=!0,le(()=>{R=!1;const e=document.getElementById(m);if(!e||!e.classList.contains("open"))return;const t=document.getElementById("__zy_si__");t&&B(t.value,{mergeAppend:!0})}))}function he(e){return(e||"").trim().toLowerCase()}function Z(e){const t=String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),i=T;if(!i)return t;const o=t.toLowerCase().indexOf(i.toLowerCase());return o<0?t:t.slice(0,o)+'<mark class="zy-hl" style="background:rgba(94,106,210,.32);color:#1A1D23;border-radius:3px;">'+t.slice(o,o+i.length)+"</mark>"+t.slice(o+i.length)}function ze(e){const t=new Map,i=new Map,o=new Map,s=new Map;for(const n of e.workspaces||[])t.set(n.id,n.name||"未知");for(const n of e.categories||[])i.set(n.id,n.name||"");for(const n of e.compass?.directions||[])for(const a of n.projects||[])o.set(a.id,a.name);for(const n of e.resources||[])n.deletedAt||s.set(n.workspaceId,(s.get(n.workspaceId)||0)+1);return{wsName:t,catName:i,projName:o,wsCount:s}}function me(e,t,i,o){const s=n=>!t||n.toLowerCase().includes(t);(f==="all"||f==="res")&&e.resources?.filter(n=>!n.deletedAt).forEach(n=>{const a=o.wsName.get(n.workspaceId),c=o.catName.get(n.categoryId),g=n.title+" "+(n.description||"")+" "+(Array.isArray(n.tags)?n.tags:[]).join(",")+" "+(n.link||"");(s(g)||j(n.title||"",t))&&i.push({type:"res",iconClass:"res",iconText:"📄",id:n.id,title:n.title,ws:a||"未知",cat:c||"待分类",badges:[],link:n.link?{type:n.linkType,text:Ee(n.link)}:null,summary:n.description,raw:n})}),(f==="all"||f==="task")&&e.tasks?.filter(n=>!n.deletedAt).forEach(n=>{const a=o.projName.get(n.projectId)||"未归属",c=[];n.priority==="high"?c.push({type:"prio-high",text:"🔴 高"}):n.priority==="medium"&&c.push({type:"prio-mid",text:"🟡 中"}),c.push({type:`status-${n.status}`,text:n.status==="done"?"已完成":n.status==="doing"?"进行中":"待开始"});const g=n.title+" "+(n.description||"");if(s(g)||j(n.title||"",t)){const u=n.status==="done"?"✓":n.status==="doing"?"◐":"○";i.push({type:"task",iconClass:`task-${n.status}`,iconText:u,id:n.id,title:n.title,ws:"任务中心",cat:a,badges:c,summary:n.description,raw:n})}}),(f==="all"||f==="curio")&&e.curiosities?.filter(n=>!n.deletedAt).forEach(n=>{const a=n.status==="todo"?"🔵 待探索":n.status==="doing"?"🟡 探索中":n.status==="done"?"🟢 已求证":"⚪ 已搁置";(s(n.question)||j(n.question||"",t))&&i.push({type:"curio",iconClass:"curio",iconText:"💡",id:n.id,title:n.question,ws:"知源罗盘",cat:"好奇心",badges:[{type:"curio-status",text:a}],raw:n})}),(f==="all"||f==="ws")&&e.workspaces?.filter(n=>!n.archived).forEach(n=>{if(s(n.name||"")||j(n.name||"",t)){const a=o.wsCount.get(n.id)||0;i.push({type:"ws",iconClass:"ws",iconText:"🗂",id:n.id,title:n.name,ws:"工作台",cat:a+" 张资源卡",badges:[{type:"ws-badge",text:"工作台"}],raw:n})}})}const q=[{label:"打开今日行动",icon:"flame",route:"/compass/actions"},{label:"打开项目策展",icon:"layout",route:"/compass/projects"},{label:"打开方向树",icon:"branch",route:"/compass/tree"},{label:"打开设置",icon:"settings",route:"/settings"}];function G(e){const t=i=>{const o=i.dataset.id;if(o){const n=h.find(a=>String(a?.id||"")===o);if(n)return n}const s=parseInt(i.dataset.idx||"-1");return s>=0?h[s]:void 0};e.querySelectorAll(".zy-result-item").forEach(i=>{const o=i;o.title="单击 → 打开链接（无链接则定位） · Ctrl+Enter → 定位并打开详情",o.addEventListener("click",()=>{const s=t(o);s&&K(s)}),o.addEventListener("dblclick",()=>{const s=t(o);s&&K(s)}),o.addEventListener("mouseenter",()=>{p=parseInt(o.dataset.idx||"0"),document.querySelectorAll(".zy-result-item").forEach((s,n)=>s.classList.toggle("sel",n===p))})})}function U(){const e=document.getElementById("__zy_results__");if(!e)return;if(!T&&f==="all"){const a=C,c=[],g=function(l,r,_,w){l&&!l.deletedAt&&(l.callCount||0)>0&&c.push({type:r,iconClass:r==="ws"?"ws":r,iconText:_,id:l.id,title:w,ws:"",cat:"",badges:[],raw:l})};(a&&a.resources?a.resources:[]).forEach(function(l){g(l,"res","📄",l.title)}),(a&&a.tasks?a.tasks:[]).forEach(function(l){g(l,"task","✅",l.title)}),(a&&a.curiosities?a.curiosities:[]).forEach(function(l){g(l,"curio","💡",l.question)}),(a&&a.workspaces?a.workspaces:[]).forEach(function(l){g(l,"ws","🗂",l.name)}),c.sort(function(l,r){const _=(r.raw.callCount||0)-(l.raw.callCount||0);return _!==0?_:(r.raw.lastCalledAt||0)-(l.raw.lastCalledAt||0)});const u=c.slice(0,8);h=[...q.map(function(l){return{type:"qa",qa:l}}),...u.map(function(l){return{type:"res",iconClass:"res",iconText:"📄",id:l.id,title:l.title,ws:"",cat:"",badges:[],raw:l}})],p=h.length?0:-1;const d=q.map(function(l,r){return'<div class="zy-result-item'+(r===p?" sel":"")+'" data-idx="'+r+'"><div class="zy-ri-icon res">↵</div><div class="zy-ri-main"><div class="zy-ri-title">'+l.label+"</div></div></div>"}).join(""),v=u.length?'<div class="zy-group-title">🔥 近期最常用 · 按调用次数</div>'+u.map(function(l,r){return'<div class="zy-result-item'+(q.length+r===p?" sel":"")+'" data-idx="'+(q.length+r)+'" data-id="'+z(String(l.id||""))+'"><div class="zy-ri-icon '+l.iconClass+'">'+l.iconText+'</div><div class="zy-ri-main"><div class="zy-ri-title">'+z(l.title)+'</div></div><span class="zy-ri-link url">🔥'+(l.raw.callCount||0)+"</span></div>"}).join(""):"";e.innerHTML='<div class="zy-group-title">快捷操作</div>'+d+v,G(e);return}if(!h.length){e.innerHTML='<div class="zy-empty"><div class="icon">🪹</div><div class="text">没有匹配的卡片<br><span style="font-size:11px">试试更短的关键词</span></div></div>';return}const t=[{label:"📄 资源卡",type:"res"},{label:"✅ 任务卡",type:"task"},{label:"💡 好奇心",type:"curio"},{label:"🗂 工作台",type:"ws"}],i={res:[],task:[],curio:[],ws:[]};for(const a of h)i[a.type]&&i[a.type].push(a);const o=30;let s="",n=0;for(const a of t){const c=i[a.type];if(!c.length)continue;const g=c.slice(0,o),u=c.length-g.length;s+='<div class="zy-group-title">'+a.label+' <span style="color:#BFC3C9;font-weight:400">'+c.length+"</span></div>",g.forEach(function(d,v){const l=n+v,r=d.badges.map(function(x){return'<span class="zy-badge '+x.type+'">'+x.text+"</span>"}).join(""),_=d.link?'<span class="zy-ri-link '+d.link.type+'">'+(d.link.type==="url"?"🔗":d.link.type==="file"?"📁":"📝")+" "+d.link.text+"</span>":"",w=d.summary?'<div class="zy-ri-summary">'+Z(d.summary)+"</div>":"";s+='<div class="zy-result-item'+(l===p?" sel":"")+'" data-idx="'+l+'" data-id="'+z(String(d.id||""))+'"><div class="zy-ri-icon '+d.iconClass+'">'+d.iconText+'</div><div class="zy-ri-main"><div class="zy-ri-title">'+Z(d.title)+'</div><div class="zy-ri-meta"><span class="zy-badge ws">'+z(d.ws)+'</span><span class="zy-badge cat">'+z(d.cat)+"</span>"+r+_+"</div>"+w+"</div></div>"}),u>0&&(s+='<div class="zy-group-more">… 还有 '+u+" 条，输入更精确的关键词</div>"),n+=c.length}e.innerHTML=s,G(e)}function be(e){if(e.key==="ArrowDown")e.preventDefault(),p=Math.min(p+1,h.length-1),document.querySelectorAll(".zy-result-item").forEach((t,i)=>t.classList.toggle("sel",i===p)),document.querySelector(".zy-result-item.sel")?.scrollIntoView({block:"nearest"});else if(e.key==="ArrowUp")e.preventDefault(),p=Math.max(p-1,0),document.querySelectorAll(".zy-result-item").forEach((t,i)=>t.classList.toggle("sel",i===p)),document.querySelector(".zy-result-item.sel")?.scrollIntoView({block:"nearest"});else if(e.key==="Enter"){if(e.preventDefault(),!p&&p!==0)return;h[p]&&(e.ctrlKey||e.metaKey?xe(h[p]):K(h[p]))}else if(e.key==="Tab"){e.preventDefault();const t=document.getElementById("__zy_si__"),i=(t?.value||"").trim(),o=[["任务","task"],["资源","res"],["好奇心","curio"],["好奇","curio"],["工作台","ws"],["全部","all"]].find(([s])=>s===i);if(o)f=o[1],t&&(t.value="");else{const s=["all","res","task","curio","ws"];f=s[(s.indexOf(f)+1)%s.length]}p=0,S(),B(t?.value||""),b("🔍 "+ie(f))}else e.key==="Escape"&&y()}function xe(e){const t=(i,o)=>{try{chrome.runtime.sendMessage({type:"zy-open-route",route:i,drawer:o})}catch{}};if(e.type==="qa"){try{chrome.runtime.sendMessage({type:"zy-open-route",route:e.qa.route})}catch{}y();return}if(e.type==="ws"){t("/workspace/"+e.id,{kind:"ws",id:e.id}),y();return}e.type==="res"?t("/workspace/"+e.raw.workspaceId,{kind:"res",id:e.id}):e.type==="task"?t("/compass/actions",{kind:"task",id:e.id}):t("/",{kind:e.type==="curio"?"curio":"project",id:e.id}),y()}let J="",ee=0;function P(e,t){Y().then(i=>{if(!i)return;const s=(e==="ws"?i.workspaces:e==="task"?i.tasks:i.curiosities)?.find(n=>n.id===t);s&&(s.callCount=(s.callCount||0)+1,s.lastCalledAt=Date.now(),H(i))})}function K(e){const t=Date.now();if(!(e?.id&&e.id===J&&t-ee<300)){if(e?.id&&(J=e.id,ee=t),e.type==="qa"){try{chrome.runtime.sendMessage({type:"zy-open-route",route:e.qa.route})}catch{}y();return}if(e.type==="ws"){P("ws",e.id);try{chrome.runtime.sendMessage({type:"zy-open-route",route:"/workspace/"+e.id})}catch{}y();return}if(e.type==="res"){const i=e.raw;if(i.link)if(i.callCount=(i.callCount||0)+1,i.lastCalledAt=Date.now(),Y().then(o=>{if(o){const s=o.resources?.find(n=>n.id===i.id);s&&(s.callCount=i.callCount,s.lastCalledAt=i.lastCalledAt),H(o)}}),i.linkType==="url")window.open(i.link,"_blank");else if(i.linkType==="obsidian")window.open(i.link,"_blank");else{const o=ve(i.link);if(o)window.open(o,"_blank");else{b("⚠ 本地文件缺少完整路径，请到工作台补全");try{chrome.runtime.sendMessage({type:"zy-open-route",route:"/workspace/"+i.workspaceId+"?hl="+i.id})}catch{}}}else{try{chrome.runtime.sendMessage({type:"zy-open-route",route:"/workspace/"+i.workspaceId+"?hl="+i.id})}catch{}b("↗ 已定位到卡片所在工作台")}}else if(e.type==="task"){P("task",e.id);try{chrome.runtime.sendMessage({type:"zy-open-route",route:"/compass/actions?hl="+e.id})}catch{}b("↗ 已定位到今日行动的任务")}else{P("curio",e.id);try{chrome.runtime.sendMessage({type:"zy-open-route",route:"/?hl="+e.id})}catch{}b("↗ 已定位到知源罗盘好奇心")}y()}}function ve(e){if(!e)return"";if(/^file:\/\//i.test(e))return e;if(/^[a-zA-Z]:[\\/]/.test(e)){const t=e.replace(/\\/g,"/");return"file:///"+encodeURI(t).replace(/#/g,"%23")}return""}let M=!1,F=null,A=null;async function Ie(){M=!1,F&&(clearTimeout(F),F=null);const e=await I();A=new Map;for(const r of e?.resources||[]){if(r.deletedAt||r.linkType!=="url"||!r.link)continue;const _=N(r.link);A.has(_)||A.set(_,r)}const t=e?.workspaces?.filter(r=>!r.archived)||[],i=t[0],o=te(e?.categories?.filter(r=>r.workspaceId===i?.id)||[]),s=ce();W("corner",y);const n=D(),a=document.createElement("div");a.className="zy-panel",a.innerHTML=`
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
        <textarea class="zy-field-input" id="__zy_cap_desc__" placeholder="对该资源的注解、摘录、引用…">${z(s)}</textarea>
      </div>
      <div class="zy-field-row">
        <div class="zy-field">
          <label class="zy-field-label">存入工作台</label>
          <select class="zy-field-select" id="__zy_cap_ws__">
            ${t.map(r=>`<option value="${r.id}">${z(r.name)}</option>`).join("")}
          </select>
        </div>
        <div class="zy-field">
          <label class="zy-field-label">分类</label>
          <select class="zy-field-select" id="__zy_cap_cat__">
            <option value="">📥 待分类</option>
            ${o.map(r=>`<option value="${r.id}">📂 ${z(r.label)}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cap_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cap_save__">💾 保存（Enter）</button>
    </div>
  `,n.appendChild(a);let c="url";const g=document.getElementById("__zy_cap_title__"),u=document.getElementById("__zy_cap_link__"),d=document.getElementById("__zy_cap_ws__");g.value=document.title||"",u.value=location.href||"",setTimeout(()=>{g.focus(),g.select()},50),document.getElementById("__zy_cap_close__")?.addEventListener("click",y),document.getElementById("__zy_cap_cancel__")?.addEventListener("click",y),document.querySelectorAll("#__zy_seg__ .zy-seg-btn").forEach(r=>{r.addEventListener("click",()=>{document.querySelectorAll("#__zy_seg__ .zy-seg-btn").forEach(_=>_.classList.remove("active")),r.classList.add("active"),c=r.dataset.ltype||"url",u.placeholder=c==="url"?"https://…":c==="file"?"D:\\folder\\file.pdf":"obsidian://open?vault=…"})}),d.addEventListener("change",async()=>{const r=await I(),_=te(r?.categories?.filter(x=>x.workspaceId===d.value)||[]),w=document.getElementById("__zy_cap_cat__");w.innerHTML='<option value="">📥 待分类</option>'+_.map(x=>`<option value="${x.id}">📂 ${z(x.label)}</option>`).join("")});const v=r=>{if(document.getElementById("__zy_cap_title__")&&r.key==="Enter"&&!r.ctrlKey&&!r.metaKey&&!r.shiftKey&&!r.altKey){if(r.target.tagName==="TEXTAREA")return;r.preventDefault(),r.stopPropagation(),l()}};a.addEventListener("keydown",v),document.getElementById("__zy_cap_save__")?.addEventListener("click",l);async function l(){const r=g.value.trim();if(!r){b("请输入标题");return}const _=await I();if(!_){b("数据加载失败");return}if(c==="url"&&u.value.trim()){const E=N(u.value.trim()),$=A?.get(E);if($){we(String($.title).slice(0,40),()=>{try{chrome.runtime.sendMessage({type:"zy-locate-workspace",wsId:$.workspaceId,hl:$.id})}catch{}y(),b("↗ 已定位到已收录的卡片")});return}}const w=document.getElementById("__zy_cap_cat__"),x=document.getElementById("__zy_cap_desc__"),se=_.categories?.find(E=>E.workspaceId===d.value&&E.name==="待分类"),k={id:ne("rc"),kind:"resource",title:r,linkType:c,link:u.value.trim(),workspaceId:d.value,categoryId:w.value||se?.id||"",description:(x?.value||"").trim(),tags:[],customFields:{},pinned:!1,callCount:0,createdAt:Date.now(),updatedAt:Date.now()};if(_.resources?.unshift(k),A&&k.linkType==="url"&&k.link){const E=N(k.link);A.has(E)||A.set(E,k)}await H(_),ke(k.workspaceId,k.id)}}function we(e,t){const o=D().querySelector(".zy-panel");o&&(o.innerHTML=`
    <div class="zy-saved">
      <div class="zy-saved-icon" style="background:#FBF1DE;color:#8A5A00;">⚠️</div>
      <div class="zy-saved-title">该页面已收录</div>
      <div class="zy-saved-sub">「${z(e)}」已存在于工作台，只能定位不能重复收录</div>
      <div class="zy-saved-actions">
        <button class="zy-btn zy-btn-ghost" id="__zy_dup_cancel__">取消</button>
        <button class="zy-btn zy-btn-primary" id="__zy_dup_jump__">定位到卡片</button>
      </div>
    </div>
  `,document.getElementById("__zy_dup_cancel__")?.addEventListener("click",y),document.getElementById("__zy_dup_jump__")?.addEventListener("click",t))}function ke(e,t){M=!0;const o=D().querySelector(".zy-panel");if(!o)return;o.innerHTML=`
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
  `,document.getElementById("__zy_saved_close__")?.addEventListener("click",y),document.getElementById("__zy_saved_open__")?.addEventListener("click",s),document.addEventListener("keydown",oe,!0);function s(){try{chrome.runtime.sendMessage({type:"zy-locate-workspace",wsId:e,hl:t})}catch{}y()}F&&clearTimeout(F),F=setTimeout(()=>{M=!1,y()},5e3)}function oe(e){M&&(e.key==="Enter"?(e.preventDefault(),e.stopPropagation(),document.getElementById("__zy_saved_open__")?.click()):e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),M=!1,y()))}async function Be(){const e=ue(),t=de(),i=!!t,o=i?e.url===location.href&&e.title||(document.title||"").trim():"",s=i?e.url===location.href&&e.url||location.href:"";pe(),W("center",y);const n=D(),a=document.createElement("div");a.className="zy-panel curio",a.innerHTML=`
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
        <label class="zy-field-label">你的问题或想法${t?"（已填入选中文本，可编辑）":""}</label>
        <textarea class="zy-field-input" id="__zy_cur_text__" style="min-height:110px" placeholder="看到什么、想到什么、想探索什么？&#10;按 Enter 换行，Ctrl+Enter 保存">${z(t)}</textarea>
      </div>
      <div class="zy-field">
        <label class="zy-field-label">🔗 来源链接${i?"（已自动捕获当前页，可编辑）":"（可选，留空即无来源）"}</label>
        <input type="text" class="zy-field-input" id="__zy_cur_url__" placeholder="https://…" value="${z(i?s:"")}">
      </div>
      <div class="zy-field">
        <label class="zy-field-label">📝 来源标题</label>
        <input type="text" class="zy-field-input" id="__zy_cur_srctitle__" placeholder="来源页面标题（可选）" value="${z(i?o:"")}">
      </div>
    </div>
    <div class="zy-cap-foot">
      <button class="zy-btn zy-btn-ghost" id="__zy_cur_cancel__">取消</button>
      <button class="zy-btn zy-btn-primary" id="__zy_cur_save__">💾 保存（Ctrl+Enter）</button>
    </div>
  `,n.appendChild(a);const c=document.getElementById("__zy_cur_text__");setTimeout(()=>{c?.focus(),t||c.setSelectionRange(c.value.length,c.value.length)},50),document.getElementById("__zy_cur_close__")?.addEventListener("click",y),document.getElementById("__zy_cur_cancel__")?.addEventListener("click",y),c.addEventListener("keydown",u=>{(u.ctrlKey||u.metaKey)&&u.key==="Enter"&&(u.preventDefault(),g())});async function g(){const u=c.value.trim();if(!u){b("请输入内容");return}const d=await I();if(!d){b("数据加载失败");return}const v=document.getElementById("__zy_cur_url__")?.value.trim()||"",l=document.getElementById("__zy_cur_srctitle__")?.value.trim()||"";d.curiosities?.unshift({id:ne("cz"),kind:"curiosity",question:u,sourceUrl:v||void 0,sourceTitle:l||void 0,status:"todo",pinned:!1,relatedResourceIds:[],customFields:{},createdAt:Date.now(),updatedAt:Date.now()}),await H(d),y(),b("💗好奇心+1")}document.getElementById("__zy_cur_save__")?.addEventListener("click",g)}function te(e){const t=e||[],i=t.filter(s=>!s.parentId||!t.some(n=>n.id===s.parentId)).sort((s,n)=>(s.order||0)-(n.order||0)),o=[];for(const s of i){o.push({id:s.id,label:s.name});for(const n of t.filter(a=>a.parentId===s.id).sort((a,c)=>(a.order||0)-(c.order||0)))o.push({id:n.id,label:s.name+" / "+n.name})}return o}function Ee(e){if(e.startsWith("http"))return e.replace(/^https?:\/\//,"").substring(0,30);if(e.startsWith("obsidian"))return"Obsidian笔记";const t=e.split(/[\\/]/);return t[t.length-1].substring(0,25)}function N(e){try{const t=new URL(e);t.hostname=t.hostname.toLowerCase(),t.hash="";const i=["utm_","spm","from","gclid","fbclid"];t.searchParams.forEach((s,n)=>{i.some(a=>n.startsWith(a))&&t.searchParams.delete(n)});let o=t.pathname;return o.length>1&&o.endsWith("/")&&(o=o.slice(0,-1)),t.pathname=o,t.toString()}catch{return e.trim()}}function z(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}export{Ie as openCapture,Be as openCuriosity,De as openSearch};
