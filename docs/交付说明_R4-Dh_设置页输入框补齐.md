# 交付说明 · R4-Dh —— 设置页输入框补齐：`.gs-input` 是一条全站无定义的死类名（未升版）

轮次 D 第十刀。计划里这一件写的是"孤儿 CSS 清账"，**开工前拉现场，三条账里两条是错的**，
唯一那条真账也不是"删规则"而是"补一条从没写过的规则"——而且它是这十刀里唯一一个用户每天看得见的外观缺陷。

## 一、先把账本改对

| 记账时说的 | 实测 | 结论 |
| --- | --- | --- |
| `.pcp-btn.sm` / `.pcp-btn.primary` 是孤儿 | `PoolCardsPanel.vue:205,217` 在用（批量栏槽内按钮 + 新建弹窗「存入卡池」）；槽内容带父 scope id，scoped 样式照样命中 | **账错了**，规则是活的 |
| `.gs-panel` 全站无定义、18 处挂着＝死类名 | `scripts/theme-audit.cjs:232-233` 正拿它当面板根定位器（`.gs-panel.dz-hl`、`.gs-panel button`） | **不是死符号**，是无样式的门禁锚点，留着 |
| `.gs-input` 全站无定义、设置页十几个输入框挂着 | 17 处挂载；样式表里只有三条**复合**选择器（`.ai-field .gs-input{width}`、`.ai-pedit .gs-input{font-size}`、`.ai-pnew .gs-input{flex}`），**没有一条 `.gs-input` 本体规则** | **真账**，且后果看得见 ↓ |

## 二、★实测：深色主题里这排输入框是浏览器白块，其中一枚是 PAT 凭据框

改前（`/tmp/zy_gs_input_measure.cjs`，设置 → Airtable 同步屏，四主题各量一次计算样式）：

| 主题 | 页面底色 | 卡片底色 | 4 枚输入框的 底色/字色/边框 |
| --- | --- | --- | --- |
| linear | `rgb(13,14,17)` | `rgb(20,22,27)` | **`rgb(255,255,255)` / `rgb(0,0,0)` / 2px `rgb(118,118,118)`** |
| raycast | `rgb(8,8,10)` | `rgb(16,16,20)` | **同上（白块）** |
| apple | `rgb(245,245,247)` | `rgb(255,255,255)` | 同上（这一档白是对的，但边框/内边距仍是浏览器默认） |
| notion | `rgb(247,246,243)` | `rgb(255,255,255)` | 同上 |

四枚分别是 **Personal Access Token（凭据）**、Base ID、Table ID、标签列名——深色主题下两排刺眼的白框。
改后：`底色=卡片同 token`（linear `rgb(20,22,27)`、raycast `rgb(16,16,20)`）、
字色走 `var(--text)`（linear `rgba(255,255,255,.92)`）、边框 `1px var(--border)`、内边距与 `.gs-select` 同尺寸。
截图已复核（`docs/视觉归档/2026-09-30/{linear,raycast,apple,notion}-st-airtable.png`）。

## 三、落点

`GlobalSettings.vue` 样式段「输入框/下拉」里，紧挨 `.gs-select` 补三条：
`.gs-input`（本体，全取令牌 + `font-family: inherit`）、`.gs-input:focus`（`var(--accent)` + `var(--accent-glow)`）、
`.gs-input::placeholder`（`var(--text-4)`）。规则上方留一条 WHY：这个类名此前"挂着但没人定义"，
实际观感来自浏览器默认，而深色主题里浏览器默认就是错的。

## 四、门禁

- **theme-audit `st-airtable` 判据加强**：新增「输入框底色必须等于所在卡片底色（两者同取 `var(--surface)`）」，
  并把 `input[type="password"]` 纳入取样（原先只取 text/无类型，PAT 框不在样本里）。
  ★**为什么不写成"不许是白色"**：apple / notion 的令牌底色本来就是白，那样判要么浅主题恒红、要么写成主题白名单——
  比"与卡片同色"既弱又更易误判。改前先跑一次以证判据精确：linear ✗、raycast ✗、apple ✓、notion ✓；改后四主题全 ✓。
- **回归 +2（1574 → 1576）**：① `.gs-input` 本体规则必须在位且 `background/color/border/font-size` 全取令牌、
  focus 与 placeholder 都在、且排在 `.gs-select` 之前（同一语言段）；
  ② 视觉门禁自己也要被钉住——`st-airtable` 场景里必须留着 `cardBg` / `offToken.length === 0` /
  `input[type="password"]` / 「与卡同色」四枚锚点（★这类"防止门禁被悄悄删"的判据，是因为本轮改的正是门禁本身）。
- **活性**：X1 把 `.gs-input` 本体规则改名（回到死类名状态）→ 判据①红；
  X2 把视觉判据的「与卡同色」抹掉 → 判据②红；X3 规则在位但边框换成硬编码 `#777` → 判据①红。
  探针在 `/tmp`，变异后原样还原。
  ★X2 那一次还多红了一条 `R169-26`（scripts/ 根目录脚本白名单）——**不是 theme-audit 被多处盯防，是探针自己的 litter**：
  变异时把 `theme-audit.cjs.bak` 落在了 `scripts/` 根目录，被"根目录只允许 17 个登记脚本"当场抓住。
  记在这里是因为它正好演示了这条纪律的另一面：**门禁该红的地方要能红，包括我自己留下的垃圾**
  （前几轮探针都改 `src/` 下的文件，所以从没触发过它）。
- 全链：typecheck 0 · 回归 **1576/0** · E2E **36/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
  入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **92 图**（四主题 st-airtable 全过）·
  索引一致 **178 文件 / 42,769 行**（+6 行）。ZIP 未重打包。

## 五、没做的事（另立 R4-Di，不顺手删）

`workspace.css` 里还有一批**静态零用法**的规则（`.mt-*` 七条、`.rc-fields/.rc-summary/.rc-tags/.rc-tag/.rc-src/.rc-date/.rc-assets/.rc-custom/.rc-link(+3 个修饰)/.rc-calls/.rc-open-hint`、
`.metric-card/.mc-value/.mc-label/.mc-sep/.mc-hint`、`.dr-footer`、`.name-text`、`.cover-swatch`、`.toolbar-batch`、`.py-empty`、`.ws-icon-btn`）
加 Curio 的 `.cz-add-*` 三条。**本轮一条都没删**，理由是同一把尺子的假阳性已经当场现身：
它把 `.batch-enter-active/-from/-leave-*` 也判成孤儿，而那四条是 `<Transition name="batch">` 运行时生成的活类；
`.rc-link.file` 里的 `.file` 来自 `linkType` 数据值（同形的 `.kc-card-link.file` 明确是活的）。
★删 CSS 的连带损失在 R4-Da 已被证明"全套静态门禁全盲"（typecheck 0、build ✓、回归绿、页面能打开，
丢的却是三块存活页面的版式），所以这一件必须先做 **DOM 活体走查**（把每个页面/视图/弹窗/批量态渲染出来收集
class token），再按"整条选择器里没有一个类是活的"来判，删完跑 theme-audit 并肉眼比对截图。已记成任务 #112。
