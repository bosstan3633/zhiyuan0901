# 交付说明 · B7-e · 手册三项 + 响应式（V3.8.40）

> 日期：2026-10-18 · 上一版 [V3.8.39](./交付说明_B7d_恢复撤销_V3.8.39.md)

## 一句话

**手册从"能打开"变成"能读"，快捷键三处终于对得上，窄窗不再把主角挤下去**——UI 规范 41 项至此全部收口。

---

## 零、本批的第一件事：回源码核机制，核出四处「规范写的不是现状」

规范是需求文档，作者写文案时未必核过实现；**文案一旦落地就成了对用户的正式承诺**。本批四处都撞上：

| 规范原文 | 核源码的结果 | 处置 |
|---|---|---|
| H1「正文 14px / 1.8」 | 全站字阶（R155 重定过 9 档）在 14px 这一档**没有对应令牌**，最近两档是 13（`--fs-body`）与 15（`--fs-title`）；1.8 也不在 `--lh-*` 阶里 | 走 **13px 正文 + 1.8 行高**（行高因长文需要比 `--lh-body` 松，单独声明并备案），**不新造 14px 这个会立刻变成下个散点的字面量** |
| H1「H1 22 / H2 17 / H3 15」 | 手册只有两级标题（节标题 + 段内 h4），且一屏有二十多个节标题 | 节标题取 `--fs-headline`(17) / 段内 h4 取 `--fs-title`(15)，**22px 那一档不硬造**——全用 22px 等于把品牌位做成正文标题 |
| H2「右缘 sticky 目录」 | 本页目录本来就在**左缘**，且**已经是** sticky + smooth ⇒ 方案已落地一半 | 真缺口另两件：① **滚动联动**（原来只在点目录时点亮，鼠标滚轮翻页目录不跟——"长文靠滚动定位"正是被这一点打破的）② **键盘可达**（目录项是 `<div @click>`，Tab 走不到、Enter 按不动）⇒ 补 IntersectionObserver + 改真 `<button>` |
| M6「底部三卡纵向堆叠」 | 底部三卡实为 **tab 切换**（同屏只渲染一张），**不存在"堆叠"**；且实测两档宽度横向溢出本就为 0px | **不给不存在的布局写判据**，改守真正成立的两条：指标条横向滚动 + 热区 ≥28px |

---

## 一、H3 · 快捷键单一真源（本批重心）

### 1.1 落地前核出的问题：三处手写清单**已经互相脱节**，不是"将来会脱节"

| 处 | 问题 | 后果 |
|---|---|---|
| 速查面板（`GlobalPopups`） | 把切台键**硬编码成 `Alt+1/2/3`**，而修饰键在设置页有五种可选（`wsSwitchMod`：alt / ctrl / ctrl-shift / alt-shift / none） | 用户改成 Ctrl 之后，面板仍在教他按一个**不存在的键位** |
| 设置页（`GlobalSettings`） | 应用内快捷键只有 5 条，且**混进根本不是快捷键的行**（「资源卡池控制行『批量』」那是个**按钮位置**） | 按键清单里混了一个按不出来的条目 |
| 三处措辞 | 同一条动作三处各写一份 | 改一处漂两处 |

另：手册 ref-1 把六条无默认键浏览器命令**手写成一句话**，与 manifest 的命令名各写一份。

### 1.2 落地：新建 `v2/src/shared/utils/shortcuts.ts`

不是"抽个常量"，而是**把四份清单合成一份可派生的结构**：

```ts
export const MOD_LABELS            // 五档，与 App.vue onGlobalKeydown 的五个分支一一对应
export function modLabelOf(mod?)   // 取修饰键展示文案，未设置回落 Alt
export function resolveKeys(keys, mod?)  // {MOD} 占位 → 真实修饰键文案
export const SHORTCUT_GROUPS        // 四组：全局 / 应用内 / 编辑与检索 / 鼠标（★全局组排首位，规范要求「⌘K / Esc / 方向键等全局键置顶」）
export const MANUAL_ASSIGN_COMMANDS // 六条无默认键命令
export function shortcutsOf(groupTitle, mod?)
export function shortcutTableHtml(mod?)
export function manualAssignSentence()
```

三处消费：

| 处 | 怎么消费 | 拿到什么 |
|---|---|---|
| 速查面板 | `SHORTCUT_GROUPS.map(... resolveKeys(it.keys, SC_MOD.value))` | 按当前偏好显示真实键位 |
| 设置页 | `shortcutsOf('应用内', mod)` + `shortcutsOf('编辑与检索', mod)` | 同源 |
| 手册正文 + 独立分享版 | `shortcutTableHtml('placeholder')` | 见下|

### 1.3 `placeholder` 模式：手册是静态产物，唯一不撒谎的写法是"不猜"

手册正文是**模块加载时算好的静态字符串**（`MANUAL` 数组），导出分享版时也一样——它拿不到"此刻这位用户选了什么修饰键"。此前传 `undefined` 会回落到 Alt，于是一位把修饰键改成 Ctrl 的用户，打开手册看到的是「Alt + 1」：**手册在教一个他按不出来的键**。

处置：手册走 `shortcutTableHtml('placeholder')`，切台键渲染成「修饰键 + N」，并在表下用 `.mn-src` 明说「速查面板与设置页会直接显示你当前那一个」。

★这是继 D3「30天」、D1「收藏/时间筛选」之后，**第三个「照抄就会给出不存在的承诺」的场景**——只不过这次不是照抄规范，是照抄实现默认值。

### 1.4 顺手修两处对不上的账

- **`wsMod` 回落值 `'ctrl'` → `'alt'`**：`repository` 启动迁移会把 `ctrl` 一律改写成 `alt`，但设置页 getter 回落 `'ctrl'` ⇒ `store.ui` 未就绪那一瞬，下拉显示「Ctrl + 数字键」而实际生效 Alt。
- **速查面板硬编码 Alt** → 经 `resolveKeys` 派生。

### 1.5 实拍验证

| 检查 | 结果 |
|---|---|
| 速查面板 | 4 组 20 行；把 `wsSwitchMod` 改成 `ctrl-shift` 并 reload 后，立刻变为 `Ctrl+Shift+1 / +2 / +3…9` |
| 设置页 | 16 行（Chrome 命令表 + 应用内 11 条），逐条与速查面板同源 |
| 手册 ref-1 | 21 行、含 rowspan、34 个 `<kbd>`、含 `.mn-src` 同源说明 |

---

## 二、H1 · 手册正文排版基线

| 项 | 落地 | 实拍量测 |
|---|---|---|
| 正文 | `--fs-body` + 行高 1.8（备案）+ `max-width: 68ch` | `13px / line-height 23.4px / max-width 556.816px` |
| 节标题 | `--fs-headline`（17px） | 17px |
| 段内 h4 | `--fs-title`（15px，从13px 升） | 15px |
| `code` / `kbd` | 统一 `--fs-caption` + `var(--font-mono)` | 均 11px + `ui-monospace…` 等宽栈 |
| 章节分隔 | **发丝线**（`border-top` + 上下留白）替代卡片盒 | —— |

**为什么 code 与 kbd 必须同档**：原状是 `code` 12px / `kbd` 11px 两档，而它们常在同一句里并排出现（「在 chrome://… 按 Ctrl+K」），字号不同会让并排的两个键看起来像**不同层级**。

**`--font-mono` 新令牌**：等宽栈原在三处各抄一份字面量，现收敛为令牌。

---

## 三、H2 · 页内目录锚点

### 3.1 滚动联动

```ts
const visibleSecs = new Set<string>()
io = new IntersectionObserver(entries => { /* 记可见集合 */ syncActiveFromScroll() },
  { rootMargin: '-76px 0px -55% 0px', threshold: 0 })
```

`syncActiveFromScroll()` 在可见集合里取**视口内最靠上者**——直接用 observer 回调给的 `isIntersecting` 会让快速滚动时高亮乱跳（多个 section 同时可见时回调顺序不等于视觉顺序）。

### 3.2 键盘可达

目录项由 `<div @click>` 改真 `<button type="button" class="mn-item">` + `aria-current` + `:focus-visible` 环。

实测：`tagName === 'BUTTON'`、`focus()` 成功、Tab 后落到下一条 `BUTTON.mn-item`。
**副产物**：a11y-tab-audit 键盘可达从 351 处 / 44 文件降到 **350 处 / 43 文件**。

实拍验证：滚到第 5 节 → 目录 active = 「界面全景（三大台面 + 一个隐藏池）」。

---

## 四、M6 · 响应式与最小宽度可达

### 4.1 新建实拍走查量具：`v2/scripts/m6-responsive-audit.cjs`

**为什么必须实拍**：横向溢出是**布局计算结果**——同一份CSS 在 1440 不溢出、1024 溢出，差别只在运行时算出的 min-content 宽度，源码里读不出来。

量三档（1440 基准 + 规范点名的 1024 / 800）× 四个台面，各量四件事：

1. `document.scrollingElement.scrollWidth - window.innerWidth`（1px 容差，避亚像素假溢出）
2. 越界元素定位（**跳过自身可横向滚动的祖先**——指标条横向滚动是 M6 的解法本身，不能把解法判成破版）
3. 首屏热区 < 28px 的真交互元素（量 `getBoundingClientRect` 实际盒子，含 padding 与 border）
4. 三件事模块顶缘是否在首屏内

> 种子必须带齐 5 个迁移戳（`hubMigratedAt` / `hubMergedAt` / `subtasksFoldedAt` / `hotStatsSplitAt` / `tagsVisibleMigratedAt`）——只写第一个时启动迁移会把卡洗掉，而**空页面恰好"没有横向溢出"**，量出来是一派绿。

### 4.2 实拍结果：改之前 / 改之后

| 指标 | 改前 | 改后 |
|---|---|---|
| 三档 × 四台面横向溢出 | 0px | **0px** |
| 三件事首屏可达 | 全可达 | **全可达** |
| 三件事顶缘（800px） | **y=186** | **y=126** |
| 首屏热区 < 28px | **27 处** | **0 处** |

根因：指标条在窄窗下**纵向换行**，38px 撑成 104px，而它就压在「今日三件事」正上方——**一行指标把今天要做的事往下挤了 66px**。改横向滚动（`flex-wrap: nowrap; overflow-x: auto` + `.mb-group { flex-shrink: 0 }`）后回到原位。

### 4.3 热区批量收口：用撑盒子，不加内边距

撑盒子（`min-height`）不改字号与横向 padding，不影响相邻元素排布；加 padding 会。

覆盖：`App.vue`（`.brand-chip` / `.nav-shortcut-tip`）· `CompassHome`（`.storage-chip` / `.sync-chip` / `.mb-act` / `.focus-why-ico`）· `DeckControls`（`.dk-btn`）· `TaskManagerPanel`（`.t-pin` / `.t-star` / `.t-del`）· `TaskAiMenu`（`.tam-btn`）· `FocusDetail`（`.sr-r button`）· `CompassTree`（`.vs-b`）· `CompassSpine`（`.dchip` / `.sr-btn`）· `pi-timeline.css`（`.act-link` / `.f3-bind` / `.f3-fill` / `.f3-ck`）· `workspace.css`（`.head-sort` / `.modal-close`）· `ProjectDiagnoseModal`（`.pd-x`）。

### 4.4 勾选框：唯一必须「视觉尺寸与热区解耦」的控件

`.f3-ck` 的**视觉大小就是它的语义**——17px 方块是「勾」这一动作的图形本体，放大视觉会毁掉整行对账的密度；而它 17px 实测又确实小于下限。

```
.f3-ck            { width: 28px; height: 28px; background: transparent; }  ← 本体撑热区
.f3-ck::before    { width: 17px; height: 17px; ... }                        ← 画视觉方块
.f3-ck.done::before{ background: var(--success); ... }                      ← 勾选态在伪元素上
.f3-ck > *        { z-index: 1; }
```

★勾选态必须迁到 `::before`：留在本体上会给 28px 的透明本体上色，视觉上凭空多出一个大方块。

---

## 五、顺手修掉的五处「承诺与实现不符」+ 三个既有崩溃

### 5.1 手册撤销窗口写 9 秒，实现早已是 6 秒

`undo.ts` 的 `UNDO_WINDOW_MS = 6000`（G5 / V3.8.27 从 9s 收到 6s），但手册**六处**仍写「9 秒」。写 9 秒会让用户以为第 7 秒还能撤。全部改为 6 秒，并把「R159 由 3 秒放宽」订正为「G5 起由 9 秒收到 6 秒，与 Toast 上『撤销』按钮同寿」。

### 5.2 步骤序号的选择器命中面过宽（实拍抓到的既有缺陷）

`.mc-step b:first-child` 的匹配面比看上去宽得多——

```html
<span>保存后<b>自动跑一次 AI 补全评审</b>…</span>
```

那个 `<b>` 也是首个子元素，同样命中，于是被塞进 22px 见方的紫色圆牌，表现为「自动跑」三个字**竖着断行**、后面跟一个空牌。

`git show HEAD` 验证确认是**改动前已存在**，非本批引入。修法：序号改用独立类 `.mc-n`（应用内页与分享版各一处选择器 + `manual-data` 8 处数据）。

### 5.3 ★ 四主题实拍在**真实老库**上抓到的三个崩溃（本批最贵的一节）

前两条是文案与实现的偏差；这三条不同——**它们是代码崩了，而所有静态门禁都是绿的**：

| # | 症状 | 根因 |
|---|---|---|
| ① | 打开任务详情抽屉即崩 `Cannot read properties of undefined (reading 'cls')` | `TaskDetailDrawer` 的 `STATUS_UI[selectedTask.status].cls`，老库任务卡**没有 `status` 字段** |
| ② | 好奇心卡详情崩 `Cannot read properties of undefined (reading 'cls')` | `CuriosityPanel` 的 `STATUS_MAP[c.status].cls`，同一个写法的第二处 |
| ③ | 好奇心卡列表整屏崩 `Cannot read properties of undefined (reading 'trim')` | `curioMaturity` 的 `c.question.trim()`，而老库好奇卡**根本没有 `question` 这个字段** |

③ 往下挖出的东西比崩溃本身更值得记：**老库的卡是另一套字段结构。**

```jsonc
// 本机唯一备份 zhiyuan_backup_20261017.json 里的真实好奇卡
{ "id": "seed-c1", "title": "「门禁绿」能不能证明判据覆盖外的地方没问题？",
  "desc": "", "done": false, "tags": [], "createdAt": …, "updatedAt": … }
// 当前模型要的
{ "question": …, "description": …, "status": "todo", "pinned": …, "customFields": {…} }
```

任务卡与资源卡同样带 `desc` 旧字段，任务卡还多一个 `dueAt`（现模型叫 `dueDate`）。

**为什么迁移层一直没人写这段映射**：字段改名发生在模型定型之前，**代码是在"库里已经都有 `question`"的前提下改的**——写代码的人看到自己的库没问题，就判定无需迁移；被改名的那些老库用户却永远走不到这里。这类缺口静态门禁结构上就抓不到：类型声明是新的，测试库里也是新结构。

**处置（三处，同 B35 `fixTags` 范式：加载期纯归一化、不写迁移戳）**

```
① fixTaskStatus   任务卡 status / priority 兜底
② fixCurioStatus  好奇卡 status 兜底（第四档 shelf）
③ fixCurioLegacyFields   title→question · desc→description · done:boolean→status
④ fixCardLegacyFields    三类卡统一：desc→description · dueAt→dueDate · customFields 兜底
```

★**为什么第③条不能只给 `c.question.trim()` 加 `|| ''` 兜底**：那样只是**不崩，内容全空**——用户打开自己的旧卡，看到一张没有问题的白卡，还以为内容丢了。**止血 ≠ 治本，字段映射才是。**（`maturity.ts` 里那两处兜底仍然加了，但定位是**第二道防线**：映射万一漏一层也不炸页面，而不是替代映射。）

★**④ 为什么三类卡走同一个函数而不是各写一份**：字段重命名是**跨卡型**的规则，按卡型各写一份必然漏掉其中一个——第一版就漏了资源卡，是回读代码时才发现的。

**验证**（`scripts/browser.cjs` + 真实备份 + 真实构建，实拍）：修复前三条全崩、卡面 0 张；修复后**卡面 2 张、抽屉打开、无渲染错误**，且旧卡内容真的显示出来了——`「门禁绿」能不能证明判据覆盖外的地方没问题？` + 状态由 `done:false` 映射为「待探索」+ 成熟度 45 分。**这一条是判"治本了"还是"只是不崩了"的唯一凭据。**

★**这一节的教训已并入项目纪律**：**「接口声明必填」不等于「运行时一定有」。** 凡是拿 `MAP[key].x` 的地方，都要问一句"这个 key 会不会不在 Map 里"——而**老库是最容易被跳过的输入源**，因为它不在任何测试夹具里。

### 5.4 ★ 同一次实拍牵出「判据指向已退役 / 已改名之物」的第三类欠账（28 条红 → 0）

三个崩溃修完后，画面正常了，但**四主题实拍的 28 条红一条没少**（`dz-*` 七场景 × 四主题）。逐个核源码，核出**三笔欠账**，形态与前两节的「承诺与实现不符」同源：**判据钉的东西，产品里已经不存在了**。

| # | 判据钉的 | 现实 | 处置 |
|---|---|---|---|
| ① | `dz-overview` 数 `.pi-hero-sum .pi-hchip` 五枚 | 该类**全库 `class=` 命中 0**，只剩 CSS 里两处字面量。PiHero 早已换成 `.hero-kpis-grid > .hero-kpi`，且是**四枚**（第五枚「活跃度」并进了其余四格的 `title` 口径） | 重指到现锚，行为一条不减（同排 / 每枚带口径 / 无错误徽章）；数量 5→4 并写明理由 |
| ② | `dz-heatmap` / `dz-day` 的场景 hash 指向调度台 | 热力图随 W2 迁调度台后**又迁到画像页 `PiYear.vue:122`**（全库唯一 `<Heatmap>` 挂载点）⇒ 判据一直在量调度台 | 去掉旧 hash，改声明 `host: '.pi-hmbox'`；并补一条**宿主到位守卫**（见下） |
| ③ | `dz-day` 的 act「点有记录的格子」打开日详情 | **点格子现在只改选中态**：`Heatmap` 的 click 只 `emit('update:selDay')`，一路到 `ProfileInsights:1016` 只写 `dashSelDay`；开弹窗的 `openDayBattle()` **全库零调用** | act 改走今天真实存在的入口：PiToday 的「打开战报」→`openTodayBattle()`（它自己会挑「今天有记录就今天、否则最近有记录的一天」，正是原注释想用选格绕过的那个问题）。弹层真实类名 `.pi-day-overlay` / `.pi-day-modal` |
| ④ | `dz-review` / `dz-report` / `dz-drill` / `dz-entry` 四条场景 | **产品侧已明文退役**：`ProfileInsights.vue:405` 写着「★W13-D5 退役 2026-10-16：ReviewPanel 挂载随『复盘能力四段常驻』拍板下线」。这四屏量的 `.pi-rev-modal` / `.dz-rev-grid` / `.dz-kpi` / `.dz-rpt` / `.dz-drill*` **只存在于 CSS 与三个零挂载的组件文件里**（`ReviewPanel` / `DrillCardList` / `ReviewReportModal` 全库无 import） | **整组下线**，`openReviewModal()` 一并删除，源码留 `RETIRED_DASH_SCENES` 作活锚 + 完整复活指引 |

★**第④条是本项目第一次「因为被测物退役而下线判据」**，与「判据随迁重指」必须分开记账：前三类是**承重锚换了**（判据守的行为仍在被验证），第四类是**被测物整个没了**（继续留着只会让每次走查稳定贡献 16 条红，把真红淹没）。而且这四屏**从来没绿过**——判据是 V3.8.12 随 W12 写的，W13-D5 两周后就把它退役了。

**★ 顺带抓到的第五处「承诺与实现不符」**：`PiYear.vue` 段头写「点格 › 该日战报」，而点格已不开弹窗。改为「点格选中那天 · 战报见『今日』段」——**指路要指到真正能去的地方**。

**★ 顺带补上的宿主到位守卫**（这是「四主题全 0 = 都没渲染」那类假绿的一个变体）：

```js
const HOST = sc.host || (sc.hash === '#/' ? '.metric-bar, .mb-row' : '.pi-hero')
if (!(await page.locator(HOST).first().isVisible().catch(() => false))) {
  await page.reload(...); /* 懒 chunk 必挂载 */
  if (宿主仍不在) { dashFail.push(...); continue }   // 如实记账，不静默跳过
}
```

为什么需要：`page.goto(base + '#/profile')` 改的**只是 hash**，同文档内 Playwright 不重载，而画像洞察页是**懒 chunk**；`settle()` 的稳定判据里虽然含 `location.hash`，但 hash 此刻已经是新值了、DOM 节点数还是**旧页面**的节点数 ⇒ 被判成"已沉降"立刻返回。后果是整段判据量的是**上一个镜头的页面**，四主题读数一模一样（`chip=0/5`、`格=0`、`日详情=false`）。**看着像主题问题，其实是根本没走到被测页。**

★修完 dz 三场景实测全绿：`chip=4/4 同排=是 带口径=4/4` · `格=365(应≥360) 图例七档名符 摘要卡=4/4 溢出=0px` · `日详情=true 四格统计=4 热力带=有 时间线=有`。

**判据侧**：`W12-13` 整体重指（守的还是"判据随迁只换承重锚不换所守行为"，但新增一条纪律：**锚必须落在代码而不是注释上**——判据跑在 `codeOnly()` 上，注释会被抹成等长空白，拿注释当锚是这一族第二次栽）。

---

## 六、判据

### 6.1 新建 `v2/scripts/regression/24-b7e-h123-m6.cjs`（16 条）

| 编号 | 守什么 |
|---|---|
| H3-1 | 单一真源：三处都从 `shortcuts.ts` 派生 |
| H3-2 | 切台键不得硬编码修饰键（真源 `{MOD}` 占位 + 面板/设置页按偏好解析 + 负锚） |
| H3-3 | 手册走 `placeholder` 模式 |
| H3-4 | `wsMod` 回落值必须与实际生效值一致（负锚 + `MOD_LABELS` 恰好 5 档） |
| H1-1 | 正文排版走令牌而非字面量 |
| H1-2 | `code` 与 `kbd` 同档等宽，等宽栈收敛为令牌 |
| H1-3 | 发丝线分隔章节（负锚：卡片盒不许回流） |
| H1-4 | 分享版 CSS 与应用内页同步 |
| H2-1 | 目录项必须是真 `<button>` |
| H2-2 | 滚动联动 |
| H2-3 | 分享版 scroll-spy |
| M6-1 | 指标条横向滚动 |
| M6-2 | 热区 28px（批量点名） |
| M6-3 | 勾选框视觉与热区解耦 |
| M6-4 | 两档窄窗回落（1024 单栏 / 800 再降一档，目录改非 sticky） |
| M6-5 | 实拍走查脚本必须在库 |
| X-1 | 撤销窗口秒数**从 `UNDO_WINDOW_MS` 现算**（不写死「6」） |
| X-2 | 步骤序号不得再用 `b:first-child` |
| X-3 | **加载期归一化：status/priority 兜底 + 旧字段改名三链**（负锚：`CuriosityCard` 上不许回 `done:boolean`；反向自证 `Subtask.done` 仍在，防负锚正则写太宽） |

★**X-3 自身也踩了两次坑**（第三次栽在切片锚上）：
① 切片终点用裸子串 `stripRetiredCardKeys` ⇒ 命中的���**文件头那句备案注释**（3424 行，远在调用点之前）⇒ `start > end` ⇒ 空串 ⇒ 什么都匹配不上（与 M6-3 的 `.f3-title` 同根因，R4-Dl 族第八次）；
② 负锚写 `/done\??:\s*boolean/` 全文件搜 ⇒ 被 **`Subtask.done: boolean`**（R166 定案 1 的子任务完成态，正当字段）咬住假红。⇒ 改成只看 `CuriosityCard` 块本身，**并补一条反向自证**（`Subtask.done` 必须仍在）——**负锚正则也必须证明它不是"搜不到东西"式的假绿**。

### 6.2 重指 8 条历史锚点：钉中文字面量 → 钉结构性保证

本批有 8 条历史判据因改动而失效。处置原则：**判据意图不变，锚点改守"永远该成立的那件事"**。

| 判据 | 原锚（已随本批退役） | 重指到 |
|---|---|---|
| R28 / R26-2 | 章节 `padding: 36px 44px` / `38px 46px` | 两处章节都必须走发丝线 + 上下呼吸；负锚：卡片盒不许回流 |
| R49-28 | 手册含「刷新动画」 | 手册含「刷新固定回调度台」+「冷启动的品牌动画」（等价真文案） |
| R69-4 / R69-5 | 面板里 `{ keys: 'Alt+1', desc: ... }` | 真源三档落位 + 面板经 `resolveKeys` 派生 + **负锚：面板不许再出现写死的 Alt+1** |
| R120-5 | 面板里 `desc: '定位到卡片所在处'` | 该动作名仍在真源 + 手册表必须派生 + 面板渲染派生量 |
| R4-Df | 手册正文「1 = 调度台 / 2 = 方向台 / 3 起才是各策展台」 | 手册那三条必须从真源派生（**不许再写第四份清单**）+ `{MOD}` 占位 + 旧错句负锚 |
| R4-Df2 ×2 | 设置页快捷键清单里「**在**」`资源卡池控制行「批量」`；手册含「窗口 9 秒」 | 那两行**根本不是快捷键**，负锚不许再出现 + 清单必须走 `shortcutsOf`；秒数从 `UNDO_WINDOW_MS` 现算 |
| R153-2 | 热区 26px | 热区下限提为 `HOT_MIN = 28` 常量（将来再调只改一个数字） |
| **W12-13** | `.pi-hchip` 五枚 / 日详情 act「点有记录的格子」/ `openReviewModal` 恰 3 处 / 场景 hash 指向调度台 | 概览带改钉 `.hero-kpis-grid > .hero-kpi` 四枚 + **负锚 `.pi-hchip` 进不许复活名单**；日详情 act 改走真实入口「打开战报」+ **负锚：不许把点格接回弹窗**；四条退役场景改钉 `RETIRED_DASH_SCENES` 活锚 + **反锚 `openReviewModal` 已随之删除**；热力图/日详情改声明 `host` 并补宿主到位守卫 |

★**这一轮最贵的教训**：8 条红里有 5 条是**判据自己写错**，不是实现有问题——
① 变量取错（拿手册页的 `codeOnly` 去问速查面板的模板）；
② 切片起止顺序反了（`.f3-title` 首现早于 `.f3-ck` ⇒ 空串 ⇒ 什么都匹配不上）；
③ 键名形态只认带引号那一种（漏掉 `alt/ctrl/none`）；
④ 判据钉了脚本里根本不存在的东西（`IntersectionObserver` 在走查脚本里没有，它用 `waitForSelector`）；
⑤ 负向前瞻豁免备案句——前瞻是"从这个位置往后看"，而违规的「9 秒」前面隔着的是「G5 起由 」，前瞻够不着那几个字，于是**备案句自己把判据打红**（改成先 `replace` 剥离备案句）。

**共同病根**：判据自建的提取器与断言形态**没有先回源码/脚本验证**。一个会静默认错取值的判据，等于给一段空白上了锁。

---

## 七、门禁读数（全部实跑）

| 门禁 | 读数 |
|---|---|
| 回归 | **1,938 通过 / 0 失败**（35 分片） |
| `vue-tsc --noEmit` | **0 错误** |
| 死 CSS | 判死 **0** / 祖先断 **0**（3,847 条规则，四票全零） |
| 主题对比度 | 全绿（4 主题 × 14 项 + accent/heat-5 唯一性 + W12-G 组件级可读性） |
| 键盘可达 | **350 处 / 43 文件**（棘轮 352，只许降） |
| 代码索引 | 202 文件 / 52,145 行（`gen-code-index.cjs` 已重跑） |
| SCC | **0** |
| **四主题实拍** | **100 图 · 零红**（`theme-audit.cjs --tag=B7e-h123-m6`）；方向树折叠 8 项因备份数据无项目舱**显式跳过**（≠通过） |
| 出包 ZIP | **691KB**（预算 900KB） |

### 一个必须记的坑：`ManualPage.vue` 头部注释里写了字面量 `<style>`

死 CSS 扫描报「`.mn-back-ico` 死规则 + 祖先断」，根因很隐蔽：该文件**头部 JS 块注释里写了「详见 `<style>` 内逐条备案」**——这个伪 `<style>` 让 `dead-css-scan.cjs` 的非贪婪正则 `<style[^>]*>([\s\S]*?)<\/style>` 从第 8 行一路吞到第 207 行的真 `</style>`，把整个 `<template>` 当成 CSS 解析，于是模板行被当成选择器判成「祖先断」，而真样式的静态票因模板被吞而失效。

修法：把注释里的 `<style>` 字面量改成「样式块」。⇒ **注释里不要写 HTML 标签字面量**（与「注释里复述被禁字面量会让自建断言假红」是同族坑）。

---

## 八、版本同步（七处）

`manifest.ts` · `package.json` · `package-lock.json`（2 行）· `ManualPage.vue` · `regression/helpers.cjs` 版本锚 · `v2/README.md` 版本行 · 根 `README.md` 当前版本行 · `changelog-data.ts` 新增 3.8.40 条目（9 条要点）· 评审交接包透视卡 §2.1 与头部实测读数。

---

## 九、UI 规范收口状态

| 状态 | 数量 | 项 |
|---|---|---|
| 已落地 | **41** | P0 十项 · A1–A4 · C1–C6 · D1–D3 · G1–G6 · M1–M6 · P1–P4 · S1–S5 · W1–W13 · **H1 / H2 / H3** |
| 部分 | 0 | —— |
| 未开工 | **0** | —— |

★41 项全部收口。剩余可做的不是"补功能"，而是继续按批推进后续轮次。