/**
 * V3.8.42 · P0-4：content 浮层的样式表（自 overlay-impl.ts 原样搬出）。
 * 搬它的理由：overlay-impl.ts 只导出 4 个函数却 1,769 行，其中 174 行是**一段纯 CSS 文本**，
 * 唯一的外部依赖只有 `ROOT_ID` 一个常量 —— 它把它算成了「逻辑」，于是源码索引里这个文件的
 * 职责行读起来比实际重、评审模型也读不出哪一段才是真逻辑。搬出后样式可被单独维护与 diff。
 * ★内容逐字未改：包括 `#${ROOT_ID}` 的插值、注释里的 R77/R124/R155/R156 备案在内全部原样保留 ——
 * 这些注释是判据与后续轮的锚（回归 R77-3 锁定强调色与 tokens.css 一致），照抄优于重写。
 * ★ROOT_ID 由调用方注入而非本模块自持：它全库只有这一处样式与一处 ensureRoot 用到，
 * 单开一个常量文件属于把一行搬成一个文件，得不偿失。
 */

/** 浮层样式全文（含 `${ROOT_ID}` 插值）。注入逻辑留在 overlay-impl.ts，样式本体在此。 */
export function overlayStyleText(ROOT_ID: string): string {
  return `    /* R77（A1）：浮层变量体系——底色/文字跟随宿主 prefers-color-scheme，强调色由 JS 按知源主题注入。
       浮层运行在宿主文档，取不到新标签页的 tokens.css，故在此自建 --zy-* 变量；
       色值取自 shared/styles/tokens.css（linear 主题的明暗两套），回归断言 R77-3 锁定主题色不漂移。 */
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:none;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;
      --zy-bg:#FFFFFF;--zy-bg-2:#F7F7F8;--zy-bg-3:#EFEFF1;
      --zy-border:#E3E4E8;--zy-border-strong:#D5D6DB;
      --zy-text:#17181C;--zy-text-2:#3C3F45;--zy-text-3:#8A8F98;--zy-text-4:#B4B8BF;
      --zy-link:#5E6AD2;--zy-link-file:#A87B2A;--zy-link-obs:#7C3AED;
      --zy-accent:#5E6AD2;--zy-on-accent:#FFFFFF;
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
    /* W4（V3.8.4）：采集「存入」行改静态池提示（台面/分类两下拉退役）——与应用内 gp-status-select 同形态：不可点、随主题、说清去向 */
    .zy-cap-pool{display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid var(--zy-border);border-radius:10px;font-size:var(--zy-fs-sm);color:var(--zy-text);background:var(--zy-bg-2);}
    .zy-cap-pool-sub{font-size:var(--zy-fs-xs);color:var(--zy-text-3);}
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
    .zy-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}`
}
