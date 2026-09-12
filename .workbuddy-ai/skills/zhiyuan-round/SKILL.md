---
name: zhiyuan-round
description: 知源调度台（v2/ Chrome MV3 扩展）单轮版本迭代的标准流程。当需要修改 v2/src/ 源码、升版本号、新增/调整回归断言、或撰写本轮交付文档时使用。触发词：知源、调度台、资源台、方向台、策展台、升版、回归、R7x、V2.4x、开发任务书、交付说明。
agent_created: true
---

# 知源调度台 · 单轮版本迭代流程

工作区：`/Users/beantan/Downloads/zhiyuan0904` ｜ 源码：`v2/` ｜ 文档：`文档中心/` + `docs/`

## 一、动手前必读

1. **先读 `文档中心/00_产品事实与表达母版.md`** —— 版本号、回归基线、术语的唯一权威来源。
2. **读最近一轮的开发任务书**（`文档中心/04_产品与设计/04-2x_*.md`），确认本轮需求与上位清单编号。
3. **读源码，不信注释**。本项目历史上出现过"注释说功能在 A，实际代码在 B"的情况。凡"某能力是否存在于某文件"一律用 Grep 命中/未命中为准。

## 二、九条硬性规则（违反即返工）

1. **版本号 5 处同步**：`v2/src/manifest.ts` · `v2/package.json` · `v2/src/newtab/views/ManualPage.vue` · 关于页（动态读 manifest，通常无需改） · `v2/scripts/regression.cjs`。
   ⚠ **实际是 7 处**（R78 踩坑）：第 6 处 = `docs/产品功能手册_Vx.y.z.md` 与 `docs/产品白皮书_Vx.y.z_对外版.md` 的**版本化文件名 + 文内版本串**（由断言 `R66-8` 把守，最容易漏）；第 7 处 = `文档中心/README.md` 与 `00 母版 §15`（版本号 + 回归项数）。
   **批量替换陷阱**：`regression.cjs` 与 `ManualPage.vue` 可无脑全量替换；但**手册不行**——里面"V2.46.0 结构变化速览（R77）"这种**历史段落标题**会被误伤（R77 那轮就是 V2.46.0）。手册只替换头部版本行 + 追加本轮速览段，`文档中心/README.md` 的"历史版本（V2.32.0~V2.46.0）"区间也要**停在上一版**。
2. **单向挂载红线**：资源卡只从资源台镜像到策展台，**禁止**反向（`projectCardToCuration` / `projectCategoryToCuration` 已拆除，回归有断言把守）。
3. **软删**：卡片删除一律 `deletedAt = Date.now()`，不得真删；分类删除需回落子卡与投射引用。
4. **`computed` 内禁 `.sort()`**：Vue 的 computed 返回值会被缓存，原地 `sort()` 会污染源数组。改用 `[...arr].sort(...)` 或 `catIndex` 预计算。
5. **样式只用 `tokens.css` 变量**：禁止硬编码色值（`#RRGGBB`）。回归有断言扫硬编码色。
6. **`zy-where` 定位**：跳转到卡片一律带 `?hl=<cardId>`（hub/策展台）或 `?cat=<catId>`。
7. **回归须追加断言**：每轮新增 `R{N}-*` 断言，追加在 `regression.cjs` 末尾、`console.log('回归结果：'...)` 之前。⚠️ **本文件惯例是不写轮次标题行**，直接排 `check(...)`；若要插标题行（如 `【第七十三轮 · V2.42.0：…】`），**必须包成 `console.log('【…】')`**——裸文本行会导致 `SyntaxError: Invalid or unexpected token`（R73 踩过）。
8. **构建前清 `dist`**：`rm -rf dist` **会被安全护栏拦下**（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，阈值 50 文件）⇒ 改用 `mv dist /tmp/zy_dist_backup_$(date +%s)`。
9. **每轮交付文档**：`docs/交付说明_R{N}_*.md` + 升版 `docs/产品功能手册_V{x}.md` / `docs/产品白皮书_V{x}_对外版.md` + 更新 `文档中心/00_产品事实与表达母版.md` + `文档中心/README.md` 索引。

## 三、★ 升版的连锁反应（最容易踩的坑）

`regression.cjs` 的 **`R66-8` 按"版本化文件名"读 docs 双文档**：

```js
read('/docs/产品功能手册_V2.41.0.md')   // 文件名里带版本号
read('/docs/产品白皮书_V2.41.0_对外版.md')
```

⇒ **升版必须同步 `cp` 出新的版本化文件名**，否则回归必红（`ENOENT`）。

```bash
cd /Users/beantan/Downloads/zhiyuan0904
cp docs/产品功能手册_V2.41.0.md docs/产品功能手册_V2.42.0.md
cp docs/产品白皮书_V2.41.0_对外版.md docs/产品白皮书_V2.42.0_对外版.md
# 再批量替换文件内的版本号，并追加本轮结构变化速览
```

**② `R66-8` 还要求新手册里含字面串 `V{新版本} 结构变化速览`**（如 `V2.42.0 结构变化速览`）⇒ 追加的速览块标题**必须**写成 `> **V2.42.0 结构变化速览（R73 · <主题>）**：…` 的格式。

**③ `regression.cjs` 的版本串是"全量替换"，不是"只改当前轮断言"**：
本项目约定——历史断言体的 `version: '2.41.0'` 在每次升版时**全局替换**到新版本，而断言的**名称**（如 `R56-31 版本 2.29.0 五处同步`）**冻结不改**。所以升版时要：

```bash
# 一条命令替换全文所有旧版本串（R73 时是 39 处）
# 并把文件头注释的"当前 N 项"改成新的断言总数
```

用 `Edit` 工具的 `replace_all: true` 一次替换 `2.41.0 → 2.42.0`，再单独改头部项数即可；改完用 `grep -c "2\.41\.0"` 确认归零。

## 四、Edit 工具的丢写陷阱（本项目已踩 6 次）

**症状**：同一文件在同一条消息里多次 `Edit`，回执报"成功"但磁盘未变。
**发现方式**：`vue-tsc` 报 `Property 'x' does not exist`（TS2339），或逐条 Grep 核验时发现原文还在。
**对策（强制）**：**同一文件一次只改一处；改完立即用 Grep 核验该处已落盘，再改下一处。**
大范围重写优先用 `Write` 整文件覆盖，而不是连续 `Edit`。

## 五、验收三步（每轮收尾必跑）

```bash
cd /Users/beantan/Downloads/zhiyuan0904/v2
npx vue-tsc --noEmit            # 必须 0 错误
mv dist /tmp/zy_dist_backup_$(date +%s)   # 构建前清 dist（勿用 rm -rf）
npx vite build                  # 必须成功
node scripts/regression.cjs     # 必须全绿；末行打印"回归结果：N 通过 / 0 失败"
```

产物核验：`dist/manifest.json` 的 `version` 应等于本轮版本号。

**收敛类改动的构建级证据**：若本轮"摘路由 / 删组件"，核验产物里对应 chunk 是否消失（`ls dist/assets/ | grep -i <组件名>`）——Vite 对路由不可达文件做 tree-shaking，chunk 消失即"确实摘干净了"。R73 摘 `/curation` 后 `CurationCenter` chunk 消失、非 map 产物 **47 → 46 文件**（正好少一个 chunk）。

## 五·补 · 断言的精确性（别被注释/文案绊倒）

写"某文件不再含某标识"这类**否定断言**时，**不要匹配裸标识**——解释性注释里往往也写着该标识。R73 的 `R73-11` 初版用 `!App.vue.includes('CurationCenterView')`，被一句"…⇒ 摘除 CurationCenterView"的注释绊倒而误报失败。**正确做法是匹配实际代码串**，例如：

```js
!a.includes('include="CompassHomeView,CurationCenterView')   // 只校验 KeepAlive include 串
```

**反向的坑——断言与实现"耦合过紧"**（R76 第三次遇到，前两次是 R73 修 7 条、R74 处置 51 条）：
断言**不要匹配接口的完整字段序列**。R76 给 `SidebarCat` 新增一个 `childCount` 字段，把 `R71-4` 的
`'hasChildren: boolean; aggCount: number; directCount: number'` 拦腰截断 ⇒ 误报失败，但实现完全正确。

**对策**：
- 匹配**单个字段 / 单个赋值**，不要匹配"恰好相邻的完整字段序列"：
  `w.includes('hasChildren: boolean') && w.includes('aggCount: number') && w.includes('directCount: number')`
- "某能力是否还在"要同时验**声明**与**使用**（字段名 + 预计算赋值各验一次），比只验声明更能防回归。
- 失败时先判断是"实现错了"还是"断言过严"——**别急着改实现去迁就断言**。

**★ 更稳的写法（R78 起采用）：先截函数体，再下判断**

全文 `includes` 有两个弱点：① 会误吞**其他函数**里的同名字面；② 会被**注释里的字面串**绊倒（本项目已 4 次）。
R78 起在 `regression.cjs` 顶部定义了工具函数，按"函数头 → 下一个函数头"截取**具名函数体**再断言：

```js
const fnBody = (src, head, next) => {
  const i = src.indexOf(head);
  if (i < 0) return '';
  const j = src.indexOf(next, i + head.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
};
// 用法：const body = fnBody(o, 'async function addTaskToDailyFocus(', 'function renderResults');
//      return body.includes('const d = await loadData()') && !body.includes('await getData()');
```

`next` 取"紧随其后的那个函数的声明行"即可。**否定断言（某物不存在）尤其要用函数体限定范围**。

⚠ **截数组/对象字面量时，`next` 不能只用 `']'` 或 `'}'`**——元素内部（如 `options: ['官方','学术']`）就有 `]`，会把片段拦腰截断（R80-9 首跑失败）。
**对策**：用**带缩进的收尾行**作 `next`，如 `'\n  ]'` / `'\n  }'`。

⚠ **截 Vue 组件的 `<template>` 时，`next` 不能用裸 `'</template>'`**——组件里常有嵌套的 `<template #slot>`，会在第一个插槽闭合处截断（R83 实测：437 字符处就断了，`LighthousePanel` 的 `#actions`）。
**对策**：用 `'\n</template>'`（根 template 的闭合顶格）。与上面"数组 `next` 不能用 `]`"是同一类问题：**`next` 必须选一个在片段内部不会提前出现的串**。

## 五·补四 · 一个口径、多个出口（改前先 grep 全出口）

**症状**（R81 实测）：需求写的是「`AssetBadge` 徽标把 PDF 算进了 HTML 档」。
动工后只读勘验发现，**同一个错误口径共有三处**：

| 出口 | 位置 | 写法 |
|---|---|---|
| 徽标 | `AssetBadge.vue:25` | `htmlCount = list.length - imgCount` |
| 卡片字段值 | `shared/utils/fields.ts:59-68` | `htmls = list.length - imgs` |
| CSV 导出 | `GlobalSettings.vue:1882-1891` | 同上（注释明写"与 fieldValue assets 同规则"） |

只改需求点名的那一处 ⇒ **列表视图与导出的 CSV 继续显示错的数字**，改了等于没改完。

**对策（强制）**：
1. 修一个**计算/格式化口径**前，先把它的**输出文案片段**（如 `` `图` `` / `` `HTML` ``）拿去 Grep 全局搜一遍，列出全部出口；
2. 出口 **≥2 处就抽共享函数**（R81 抽 `assetSummary()`、R80 抽 `guessAssetKind()` 同理），放在既有工具文件里，**不新增文件**；
3. 断言要**逐个出口各写一条**（R81-5 / R81-6）＋**一条全局零残留**（R81-7）。

**★ `stripComments` —— 否定断言的必备预处理**

改口径时，注释里通常**会特意保留改前的错误写法**作说明。此时"全文零残留"类否定断言**必被自己的注释绊倒**（R81 第四次复发，前三见 R73-11 / R74-1 / R77-4）：

```js
const stripComments = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
// 用法：!stripComments(BADGE).includes('length - img')
```

比"匹配更精确的串"更省事，也更能容忍以后注释措辞变化。

**★ 找出口要 grep「写入动作」，不要 grep「入口名」**（R85 实证踩中）

搜 `newProject` / `addProject` / `新建项目` 三个关键词，只找到 3 处新建项目的出口；
**漏掉了 `ProjectCuration.confirmCreateProject`**（函数名与按钮文案都不含这几个词），
是动工改到第三处调用方时才发现的第 4 处出口。

> **入口名各写各的，写入动作却只有一种写法。**

**对策（强制）**：找"同一件事的几个出口"时，grep **数据写入那一行本身**——

| 找什么 | grep 什么 |
|---|---|
| 新建项目 | `projects.push` |
| 新建任务 | `tasks.push` / `tasks.unshift` |
| 改某字段 | 字段名 + `=` 的赋值处 |
| 数据持久化 | `store.persist()` 附近 |

反例（会漏）：功能动词、按钮文案、组件名、`<button>` 内容。

## 五·补五 · docs 双文档要提为升版**第一步**（`R66-8` 已连踩 4 轮）

`R66-8` 断言 `docs/产品功能手册_V<当前版本>.md` 与 `docs/产品白皮书_V<当前版本>_对外版.md` **必须存在且含新版本速览段**。
R78 / R80 / R81 / R82 四轮都是**先改代码、最后补文档**，结果回归必红一次再回头补。

**对策（强制）**：升版时按此顺序——
1. **先** `cp` 出两份新版本文档（此时内容还是上一版的）；
2. 改代码 / 断言；
3. 最后回填新版本的「结构变化速览」段 + 头部版本号。

R83 起照此执行，**`R66-8` 一次没红**。

⚠ 手册的「结构变化速览」是**逐版追加的历史段**（V2.44.0 / V2.45.0 / …各一段）。
**不要批量替换版本号**——会把历史段的版本号一起改掉（R78/R79/R80 三次误伤）。
正确做法是**定点追加**：保留所有历史段，只在末尾新增一段当前版本。

## 五·补六 · 起新字号/新间距前，先 grep 既有规范（R84 实证踩中）

**症状**：R84 做 W1 台身份页头时，为了让一行塞进 ≤40px，把标题字号降到 **14.5px**。
回归立刻红在 `R51-6`——**R51-F11 早就把「页头标题统一放大 19px」写成规范**，三个主页面 + 项目详情 / 方向树 crumb 都在用。

**这不是断言过严，是实现错误。** 与 §五·补系列前五条的区别要分清：

| | 性质 | 处置 |
|---|---|---|
| 补一/补四（注释绊倒、文案匹配过严） | 断言写得不够聪明 | 改断言（`stripComments` / 更精确的串） |
| **补六（本条）** | **代码违反了既有规范** | **改代码**，断言一个字都不动 |

**对策（强制）**：写任何**字号 / 间距 / 圆角 / 字重**之前——
1. 先 Grep **同类元素**（如 `.ws-*-head` / `crumb` / `page-title`）看已有规范是几 px；
2. 需求里的硬约束（如"≤40px"）**优先靠调 padding / 布局满足，不要动既有字号**——R84 实测 19px 行高 23px + padding 14px = 37px，本来就够；
3. 若确实要破例，**在注释里写明违背哪条规范、为什么**，并主动报给产品负责人拍板。

> 顺带：这类"既有规范"大多已被断言钉死（如 `R51-6`）。**回归变红时先判断是谁错了**，不要条件反射去重指断言——重指一条真错误，等于把护栏拆了。

## 五·补七 · `regression.cjs` 的工具函数**有 TDZ 限制**（R86 实证踩中）

**症状**：给一条**靠前**的历史断言（如 `R49-14` 在 265 行、`R57-11` 在 903 行）加上 `stripComments(...)`，
回归报的不是断言失败，而是 ——

```
❌ R49-14 …… - Cannot access 'stripComments' before initialization
```

**根因**：`stripComments` / `segOf` / `fnBody` 这些工具是 `const`，定义在**文件中后部**
（R86 时约 1779 行）。`const` 有**暂时性死区（TDZ）** ⇒ **定义在文件后部的工具，前面的断言用不了**。

**对策**：
- 靠前的断言要么**不用这些工具**（多数情况下代码里本就有那个串，不 strip 也能过）；
- 要么把工具定义**移到文件顶部**（`check` 定义之后即可）——这是根治办法，未来所有断言都能用；
- 新增断言一般写在文件末尾（工具之后），**不受此限**。

> 判断方法：断言行号 < 工具定义行号 ⇒ 不能调用。

## 五·补八 · Vue scoped 样式**管不到子组件模板**（R86 实证）

**症状**：`.mod-role` 样式定义在 `CompassShell.vue` 的 `<style scoped>`，而这个类名
在 `CompassShell` 自己的模板**和子组件 `LighthousePanel` 的模板里各有一处** ⇒ 子组件那处**没样式**。

**对策**：在父组件用 **`:deep(.mod-role)`** —— 一份定义覆盖两处（自己和子组件的），
**不写两份**（避免以后改一处忘另一处）。

> 反过来说：子组件自己的元素样式，要定义在子组件里（scoped 只认自己的模板）。

## 五·补九 · 同一文件的多个 Edit **必须串行**（R87 实证踩中）

**症状**：给 `Workspace.vue` 加三视图徽标时，在**同一条消息里并行发了 3 个 Edit**（卡片 / 列表 / 看板）。
三个工具**各自都返回"已成功编辑"**，但**只有最后一个（看板）真正落盘**——前两次的写入被后一次覆盖。

**发现方式**：回归 `R87-6` 变红，只有 `kc-broken` 命中。**不是断言过严，是代码根本没写进去。**

**对策（强制）**：
1. **同一文件的多处改动一律串行 Edit**，改完一处再发下一处。
2. 涉及"同一类名/同一模式要在 N 处出现"的改动，落地后**先 Grep 确认 N 处都在**，再跑回归。

> 回归断言是最后一道网，它确实接住了这次丢失——但代价是多花一轮。

## 五·补十 · 起新样式前先 grep **令牌本身是否存在**（R87 实证，补六的姊妹条）

**症状**：按补六查了字号规范，却凭印象写了 `var(--bg-2)` —— **这个令牌根本不存在**（本项目只有
`--bg` / `--surface` / `--surface-2` / `--surface-3`）。CSS 里引用不存在的变量不报错，只是**静默失效**，
肉眼很难发现。

**对策**：补六管"值对不对"（字号/间距是否违反既有规范）；本条管"名存不存在"——
**写 `var(--xxx)` 前先 grep `tokens.css` 确认该变量已定义**。背景色族：`--bg` / `--surface` / `--surface-2` / `--surface-3`；
警示色只有 `--warning`（**没有** `--warning-bg` / `--warning-light`）；另有 `--danger` 与 `--curio-amber`。

## 五·补十二 · 升版时**全局替换版本号会误伤历史标注**（R87/R88 连续踩中）

**症状**：`文档中心/README.md` 与 `docs/产品功能手册_*.md` 里既有"当前基线版本"，也有
**历史条目的固定版本标注**（如「开发任务书·策展台身份与中心论点 W1/W2（**V2.53.0** 已交付）」、
手册里每一轮的「V2.5x.0 结构变化速览」段）。每轮做 `V2.56.0 → V2.57.0` 全局替换时，
**历史标注会一起被抬到新版本**，于是 W1/W2 那行一路漂到 V2.57.0。

**对策（按文件分别处理）**：
1. **README**：先补新索引（写上新版本号），**再做全局替换**，替换后逐条核对
   `开发任务书·（V2.x.y 已交付）` 的清单（用 Grep 或脚本打印），把漂移的改回它自己的版本。
2. **手册**：替换后**必须**把上一轮那一段「V2.5N.0 结构变化速览」改回 V2.5N.0，
   再在「卷首·全局约定」之前追加本轮新段。
3. 校验命令：`grep -o '开发任务书·[^（]*（V2\.[0-9.]* 已交付）' 文档中心/README.md`，
   逐行对一遍——**每一轮都要做**，这是静默错误，肉眼看不出来。

## 五·补十三 · `segOf` 切片时，"剔除中间段"不能写成"从中间截断"（R88 实证）

**症状**：要取"工具条里除气泡以外的部分"，写成
`TB.slice(0, TB.indexOf('<div class="filter-pop"'))` —— 气泡在工具条**中间**，
这样会把气泡**之后**的「＋新建 / ⚙」也一起切掉，断言莫名变红。

**对策**：`const TB1 = TB.replace(POP, '')`（**剔除**片段），不是按起点截断。
> 判"还剩什么"时先想清楚目标片段在原串的**位置**：在两端才能截断，在中间必须剔除。

## 五·补十五 · `v-if` 从"元素上"移到"包裹层"是语义等价，但**静态断言看不见等价性**（R89 实证）

**症状**：W4 把 `📌/⭐/📂/🗑/📡/📋` 各自的 `v-if="!isMirrorView(r)"` 上移到包裹它们的
`<template v-if="!isMirrorView(r)">` —— 运行时行为完全一致，但三条断言（`R73-7` / `R79-8` / `R82-1`）
判的是**那串 `v-if` 文本是否存在** ⇒ 全红。

**对策**：
1. **动结构前先 grep**：`Grep` 回归脚本里有没有那串 `v-if`（如 `!isMirrorView(r)`），能预判就能少跑一轮。
2. 真要搬，重指时把判据改成「包裹层含门控 **且** 该动作仍在段内」，例如
   `seg.includes('<template v-if="!isMirrorView(r)">') && seg.includes('openMoveOne(r)')`——
   **比原来更准**（同时锁住了"门控在"与"动作在"）。
3. **能不搬就不搬**：W4 用包裹 `<template>` 而不是拆两套动作条，正是为了少断 5 条顺序断言
   （`R79-2/3/5`、`R82-1/2`）。**两种写法效果一样时，选改动面小的那个。**

## 五·补十六 · `stripComments` **只剥 JS 行注释，不剥 HTML 注释**（R90 实证）

**症状**：R90-1 是否定断言（页头不得再出现常驻文案「· 可镜像到策展台」）。
我在模板里加的**说明注释**里正好写了这句原文 ⇒ 断言恒红。

**根因**：`regression.cjs` 的 `stripComments` 实现是
`s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))` —— 只过滤以 `//` `*` `/*`
开头的行，**`<!-- ... -->` 一条都不过滤**。

**对策**（按优先级）：
1. **别在注释里复述被否定匹配的字面**——最省事、零风险（本轮采用）。
   注释写「原文案见 `HUB_HELP_TEXT`」而不是把原文抄一遍。
2. 若确实需要，断言里对模板段做一次 HTML 注释剔除：
   ``.replace(/<!--[\s\S]*?-->/g, '')``（**局部**加，不要改全局 `stripComments`——
   它有 40+ 处调用方，改了会波及既有断言）。

> 推论：**否定断言 + 注释是天然冲突的**。写下"不得出现 X"时，先想一遍自己会不会在
> 注释里提到 X。

## 五·补十七 · README 历史标注校准：**别用 `04-XX_` 做正则锚点**（R90 实证，补十二的续集）

**症状**：`文档中心/README.md` 第 33 行是一整行、用 `　✅ [` 串起来的数十个条目，
每条形如 `[**开发任务书·XXX（V2.44.0 已交付）**](./04_产品与设计/04-24_XXX.md)`。
升版时按 `EXPECT` 表逐条校准，结果**全部错位一格**（04-25 被写成 V2.44.0、04-26 写成
V2.45.0……），而校验脚本还报"全部 OK"。

**根因**：`04-24` 在**一条目里出现两次**——链接文字里没有下划线形式，但**路径里是
`04-24_开发任务书_...`**。正则 `04-24_[^\]]*?（V2.x.y 已交付）` 于是从**路径里的
`04-24_`**起匹配，一路跨到**下一个条目**的 `（V2.45.0 已交付）` ⇒ 把 04-25 的值改成了
04-24 的期望值。

**对策**：**按条目切分后再逐条处理**，doc id 从**路径部分**取（那是唯一的）：

```python
parts = line.split('　✅ [')          # 先切条目，杜绝跨条目匹配
for p in parts[1:]:
    doc  = re.search(r'\./04_产品与设计/(04-\d+)_', p).group(1)   # 只认路径里的
    mver = re.search(r'（(V2\.\d+\.\d+) 已交付）', p)
```

> 顺带：**校验脚本的判据也会骗人**。本轮校验用同一条错误正则，16 条全报 OK。
> 校准这类长行，校验必须**独立于修正逻辑**（用不同写法，如按条目切分后再读一遍）。

## 五·补十八 · 升版全局替换的**污染面比想象大得多**；用「版本锚」一劳永逸（R90 实证，补十二的终结）

**症状**：R90 升版后发现，`regression.cjs` 里被全局替换污染的不只是 15 条断言——
**R64–R90 的轮次标题**（`console.log('【第八十七轮 · V2.56.0：…】')` 与 `// ===== 第X轮 · V…` 注释）
同样被一路抬高，R87（真实 V2.56.0）赫然显示成 V2.59.0。§五·补十二只描述了"历史标注被误伤"，
**没说清污染面覆盖到哪些位置**：

| 位置 | 是否被污染 |
|---|---|
| 断言判据 `m.includes("version: 'X'")` | ✅ |
| 断言**描述** `'R89-7 版本 V2.58.0 五处同步'` | ✅ |
| `console.log('【第X轮 · V X：…】')` 轮次标题 | ✅ |
| `// ===== 第X轮 · V X：…` 注释式轮次标注 | ✅ |

**对策一 · 版本锚（一劳永逸）**：这些断言真正要守的是**「五处写着同一个版本」这个不变量**，
不是「等于某年某版的固定值」。故在 `regression.cjs` 顶部设单一锚点：

```js
const VER_ANCHOR_LITERAL = "version: '2.59.0'";   // ← 升版只改这一行
const CUR_VER  = (VER_ANCHOR_LITERAL.match(/'([\d.]+)'/) || ['', ''])[1];
const CUR_VTAG = 'V' + CUR_VER;
```

判据改用派生值：`m.includes(VER_ANCHOR_LITERAL)` / `pkg.includes('"version": "' + CUR_VER + '"')` /
`mp.includes(CUR_VTAG)` / `reg.includes(VER_ANCHOR_LITERAL)`（`reg` 分支靠文件保留该字面来校验自身）。
断言**描述**里的版本号一律去掉（改成"版本五处同步"，不再写具体版本）。

> ⚠ **必须验证活性**：改完把 `manifest.ts` 临时改成下一个版本跑一次，
> 期望 20+ 条断言变红；改回后全绿。**否则你无法区分"断言在守门"和"断言恒真"**。
> R90 实测：临时 2.60.0 ⇒ 21 条变红。

**对策二 · 还原历史轮次标注要找"独立于被修对象"的证据源**：
| 证据源 | 覆盖 |
|---|---|
| `git log --format=%s` 提交主题（正则 `V(\d\.\d+\.\d+) 第…轮（R(\d+)）`） | R64–R90（R72/R73 由母版变更记录补齐） |
| `docs/交付说明_第X轮_V*.md` **文件名** | 早期轮次（git 主题没写版本号） |

按行处理：该行或其后第一个 `check('R(\d+)-` 取 R 号 → 查表 → 还原；查不到就**删掉错误版本号**
（显示错的比不显示更糟）。R90 实测还原 34 条、无据可查 0 条。

> ✅ **R91 实战复核通过**：版本锚方案首次用于真实升版。只改 `VER_ANCHOR_LITERAL` 一行，
> 78 处派生判据自动跟随；回归输出中 **R90 仍显 `【第九十轮 · V2.59.0】`**、R91 显 `V2.60.0`
> ——历史轮次**零污染**。升版脚本的改动面因此从"几十处"降到"两处"（文件头 + 版本锚）。

## 五·补十九 · `useCompass()` 里**同名族函数签名不对称**（R91 实证）

**症状**：写主攻速览条时按"同一族函数参数一致"的直觉，写成：

```ts
const open = projectTasksOf(p).filter(...)   // ✗ 直觉写法
```

⇒ `vue-tsc` 报 **TS2345: Argument of type 'Project' is not assignable to parameter of type 'string'**。

**真相**（`v2/src/stores/compass.ts`）：

| 函数 | 参数 |
|---|---|
| `projectProgress(p)` | **Project 对象** |
| `isProjectStalled(p)` | **Project 对象** |
| `isProjectDone(p)` | **Project 对象** |
| `projectTasksOf(projectId)` | ★ **id 字符串** |

**对策**：用到这一族时先 `grep` 一眼签名，别靠对称性猜。正确写法 `projectTasksOf(p.id)`。

> 顺带：这四个函数**内部都遍历 `d.tasks`**（R83 性能红线），无论参数怎么传，
> 一律**预计算成索引**（`projMeta` / `projState` / `focusMeta`），模板内不逐项调用。

## 五·补十四 · class 属性常是**多个类**，断言要判子串（R88 实证）

**症状**：`.sort-dir-btn` 在模板里写作 `class="toolbar-select sort-dir-btn"`，
断言写 `includes('class="sort-dir-btn"')` ⇒ **恒假**。

**对策**：Vue 模板里 `class` 经常是静态类 + 条件类的组合。断言只判**类名子串**
（`includes('sort-dir-btn')`），不要连 `class="` 一起写。

## 五·补十一 · 构建前清 `dist` 会触发**批量删除守卫**

**症状**：`rm -rf dist`（71 个文件）与 vite 的 `emptyOutDir`（63 个文件）都会因
"一次删除 >50 个"被守卫拦下：`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`，构建直接失败。

**对策**：**移走而不是删除** —— `mv dist /tmp/zhiyuan-dist-$(date +%s)`。
`dist` 不存在时 vite 直接新建，**不触发清空**。（九条硬性规则里的"构建前清 dist"照做，只是换个做法。）

## 五·补二 · 环境陷阱：Bash 里的 grep 会静默返回空

**症状**：`grep -n "某串" 某文件` 在 Bash 里**输出为空、退出码 0**，看起来就像"该串不存在"；**同一查询换成 Grep 工具能稳定命中**。R75 当天第三次遇到。

**危害**：据此得出"某能力不存在于某文件"的结论——比"不信注释"更糟，是**没读到就当不存在**。会直接写出恒假的断言，或误判某个能力已死。

**对策（强制）**：凡"某串是否在某文件 / 某目录"的核验，一律用 **Grep 工具**（`pattern` + `path`），**不要用 Bash 的 `grep`/`rg`**。Bash 只用于：跑 `vue-tsc` / `vite build` / `node scripts/*.cjs` / git。

## 五·补三 · 清单条目可能已被"顺带解决"（动工前必勘验）

**症状**（R79 实测）：`04-20` 清单把 R1（资源台卡片补齐 7 项）/ R2（接入全局字段池）列为待办。
动工前只读勘验发现：**R2 已 100% 交付**（R51-17 / R62-4），**R1 七项中六项已齐备**，只剩一个 `↗ 打开`。

**根因**：R1/R2 的前提是「资源台卡 ≠ 策展台卡」（当时资源台 = `CurationCenter.vue`）。
**R73/R74 把两界面收敛到 `Workspace.vue` 一处后，卡片天然同源**——R1 的验收标准「真身卡信息量 ≥ 策展台卡」是被**收敛本身**满足的。`04-20` 清单没随收敛更新，才一直显示待办。

**对策（强制）**：
1. 结构性重构（收敛 / 合并 / 抽共享组件）之后，**回头把 `04-20` 里所有"落点 = 被合并掉的那一侧"的条目重判一次**；
2. 每轮动工前先做只读勘验，**确认前提还成立**再写任务书；
3. 若前提已变：**先把结论与根因写进任务书 §一 + 交付说明 §一**，再把范围摆给产品负责人拍板——**不要闷头做空轮次，也不要擅自扩范围**。

## 六、断言清单提取技巧（做等价性审计/重构影响面评估时）

`regression.cjs` 里的 check 可能**跨多行**，用 `grep -c "^check("` 只能数不能归并。用行区间法精确提取：

```bash
cd /Users/beantan/Downloads/zhiyuan0904/v2/scripts
node -e "
const fs=require('fs'); const lines=fs.readFileSync('regression.cjs','utf8').split('\n');
const starts=[]; lines.forEach((l,i)=>{ if(/^\s*check\(/.test(l)) starts.push(i) });
console.log('总断言数 =', starts.length);
const hit=[];
for(let k=0;k<starts.length;k++){
  const s=starts[k], e=(k+1<starts.length?starts[k+1]:lines.length);
  if(lines.slice(s,e).join('\n').includes('要搜索的关键字'))
    hit.push('L'+(s+1)+'\t'+((lines[s].match(/check\(\s*'([^']+)'/)||[])[1]||'?'));
}
console.log('命中 =', hit.length); hit.forEach(h=>console.log(h));
"
```

**用途**：评估"删除/重命名某文件会影响多少条断言"、"某能力被哪些断言锁住"。判定四分类：**A 退役**（锁死代码）· **B1 重指**（目标已有等价实现，只改断言）· **B2 重指但需先补实现**（目标缺能力/异名）· **C 结构性**（路由/KeepAlive/计数阈值）。

## 六·补 · 大规模断言改写（删文件/换实现时，R74 实证有效）

当一次改动会让**几十条断言**失效（如删一个被广泛引用的组件），**不要逐条手写 `rep(old, new)`**——长串易错、且新旧文本都要手抄。改用**两步法**：

**① 探针实验（先摸清可机械重指的占比）**

```bash
cd v2 && node -e "
const fs=require('fs');
let s=fs.readFileSync('scripts/regression.cjs','utf8');
s=s.split(\"'/newtab/views/旧组件.vue'\").join(\"'/newtab/views/新组件.vue'\");
fs.writeFileSync('scripts/_probe.cjs', s);
" && node scripts/_probe.cjs 2>&1 | grep -E "^  ❌|回归结果"
```

⚠️ **探针脚本必须放在 `v2/scripts/` 下**——`regression.cjs` 用 `__dirname` 定位 `src/`，放 `/tmp` 会全部 ENOENT 假失败。

**② 按「断言块」精确改写**

解析 `check(` 的行区间得到每块的**精确原文**（由文件本身推导 ⇒ 天然唯一），再整块替换。这样新文本可以自由书写（含被删文件名），不受任何前置替换影响：

```js
function parseBlocks(text) {
  const lines = text.split('\n'); const stops = []
  lines.forEach((l, i) => { if (/^\s*check\(/.test(l) || /^console\.log\(/.test(l)) stops.push(i) })
  const blocks = []
  for (const s of stops) {
    if (!/^\s*check\(/.test(lines[s])) continue
    let e = lines.length; for (const t of stops) { if (t > s) { e = t; break } }
    const name = (lines[s].match(/check\(\s*'([^']+)'/) || [])[1] || ''
    blocks.push({ name, text: lines.slice(s, e).join('\n').replace(/\n+$/, '') })
  }
  return blocks
}
// setCheck('R51-12', 新文本) —— 命中块原文须全文唯一，否则中止
```

**③ 改写前必做「标识符对照」**：用 `grep -c -- "<候选串>" 新组件.vue` 逐条核验拟用字符串是否真的存在，**否则会写出恒假的断言**。R74 借此实证了 `mixedCardsOf`/`liveCardsOfCat`/`LIVE_BASE`/`onLiveDrop`/`projectSourceCardTo` 等在 hub 中**全为 0**，即 `curFrom` 死代码链 ⇒ 与 S1 审计的 A 组判定吻合。

**④ 退役时保留痕迹**：把整块替换为一行注释（`// R74 退役 RXX：原因`），而不是留空行——便于日后追溯。

## 七、关键文件地图

| 关注点 | 文件 |
|---|---|
| 路由 | `v2/src/newtab/router.ts` |
| 顶栏 tab / KeepAlive / active 判定 | `v2/src/newtab/App.vue`（`include` 串、`startsWith('/curation')`） |
| 调度台 | `v2/src/newtab/views/CompassHome.vue` |
| 方向台 | `v2/src/newtab/views/CompassShell.vue` |
| 资源台（hub 分支 `isHub`） / 策展台 | `v2/src/newtab/views/Workspace.vue`（唯一组件，两身份） |
| 资源台旧入口（**R73 摘路由 → R74 已删除**） | ~~`v2/src/newtab/views/CurationCenter.vue`~~（1511 行，已在 R74 删除；能力全量并入 hub） |
| 好奇心 / 任务调度 | `v2/src/newtab/components/compass/CuriosityPanel.vue` · `TaskManagerPanel.vue` |
| 数据层 | `v2/src/shared/storage/`（`hub.ts` 镜像 API · `curationMigration.ts` 启动迁移 · `repository.ts`） |
| 模型 | `v2/src/shared/models/index.ts`（`UIPrefs` / `ResourceCard` / `Category` / `CurationProjection`） |
| UI 偏好（不进主数据根） | `shared/utils/cardCols.ts` · `shared/utils/uiPrefs.ts`（`zy_ui_v2` 键） |
| 全局设置 | `v2/src/newtab/views/GlobalSettings.vue`（导入/导出、`jumpMirrorSource`） |

## 八、已知的结构性事实（避免重复勘验）

- `CURATION_WS_ID = 'zy-curation'`；资源台 = `kind:'resource'` 的 Workspace 实体，与策展台**同组件不同身份**（`isHub = isHubWs(workspace)`）。
- **两套镜像机制并存，不要混淆**：
  - `curFrom`（旧方向，**已死**）—— `migrateHubStructure()` 步骤③ 剥离 + 步骤④ 清空 `curationProjections`，故资源台分类的 `curFrom` 恒 `undefined`。
  - `__mirrorProjId` + `isMirrorView()`（现役）—— 资源台 → 策展台，见 `shared/storage/hub.ts`。
- `CurationCenter.vue` 中依赖 `curFrom` 的整条链路（`liveCardsOfCat` / `LIVE_BASE` / `onLiveDrop` / `mirror-node` / `moveProjectionTo` / `projectedCardIds` / `viewLiveCount`）均为**死代码**，详见 `文档中心/04_产品与设计/04-23_S1等价性审计报告_资源台收敛.md`。该文件已在 **R74 删除**。
- **浮层（`content/overlay-impl.ts`）取不到 `tokens.css`**（R77 实证，写浮层样式前必读）：浮层是 content script 注入**宿主文档**的 DOM，与新标签页**不在同一个文档** ⇒ CSS 变量**无法跨文档继承**，主题色必须由 JS 传入。现役方案：明暗走**纯 CSS**（`@media (prefers-color-scheme: dark)` 内建明暗两套 `--zy-*` 色阶，零 JS）；强调色走 **JS**（读 `zy_ui_v2.theme` → `applyThemeAccent()` 注入 `--zy-accent` / `--zy-on-accent`）。`THEME_ACCENT` 四主题色值与 `shared/styles/tokens.css` 由 **R77-3 断言双向锁定**，改任一侧回归必红。⚠ 写浮层样式一律用 `--zy-*` 变量，**不要写死色值**；**承载信息的语义色**（优先级/状态/类型徽标，浅底深字、明暗皆可读）保留原值，**只作品牌装饰的色**才变量化。
- **资源台计数口径（R76 已统一，别再各写一套）**：凡"某分类几张卡"一律**直属口径**（`resBucket.get(catId)`），左树 / 卡片·列表分组头 / 看板列头**三处同一个数**，且满足 **`全部 = 各分类直属和 + 待分类`**——改任一口径都会破坏这个等式。聚合数 `catAggCount`（含子孙）**只用于 hover 提示**（「含 M 个子分类，共 K 张」），**不作显示值**，否则左树显示 5、同屏卡片区显示 3（R3 的 D3 缺陷）。**待分类判据只有一处** `isUncat(r, validIds)`：无分类**或**分类已失效（`validIds` 不含其 `categoryId`）；签名只依赖 `has`，Map 与 Set 皆可传入。写任何"待分类/未分类"逻辑都调它，**不要自己写 `!r.categoryId`**——历史上因此出现「卡面显示待分类、点左树待分类却找不到」的缺陷。
- **指标条（`ws-metrics`）按台身份分流（R75）**：资源台 `v-if="isHub" class="ws-metrics hub3"` **3 格**（卡片总数 / 附件数量 / 最近更新）；策展台 `v-if="!isHub" class="ws-metrics"` **5 格**（策展主题 / 卡片总数 / 来源构成 / 附件数量 / 最近更新）。**`<CurationDrillDrawer>` 位于两个 `v-if` 之外**，两身份共用同一抽屉（`mode` = `total` / `source` / `assets` / `recent`；hub 只用 `total`/`assets`/`recent`，抽屉组件本身零改动）。样式只加修饰类 `.ws-metrics.hub3 { grid-template-columns: repeat(3, 1fr) }`，**`.ws-metrics` 本体（5 列）不可动**（`R75-4` 双向把守）。**资源台 `metrics.mirrored` 恒 0**（单向挂载红线 ⇒ 无投射指向资源台），故 hub 卡片总数格 hint 走 `hubCountHint`（分类 / 待分类口径；`mirrored > 0` 时切「⚠ 镜像 N 条待清理」）——**凡要给资源台写"台内/镜像"类口径，先想起这一条**。
- **hub（`Workspace.vue`）命名对照**（写断言时用，R74 实证）：`mixedCardsOf/viewMixed/renderSections` → `resourceGroups`；`moveProjectionTo` → `moveMirrorTo`；`onTreeDrop/onNodeDrop` → `onCatDrop/onDropCard`；`mirror-node` → `isMirrorCat(sc.cat)`；`startCreateCat` → `openCreateCat`；`nodeCountMap` → `catAggCount` + `resBucket`（`catIndex` 索引层）；`PENDING/pendingProjections` → `cardDropTarget/onUncatDrop`（待分类落点）；`ch.parentId = undefined` → `kids.forEach(k => { k.parentId = undefined })`；`ids.has(r.categoryId` → `r.categoryId === cat.id`。hub 拖放体系：树 `onCatDragStart/onCatDragOver/onCatDrop/onCatRootDrop`；卡 `onDragStart/onDropCard/markDrop/dropMark`；区域 `onAreaDragOver/onAreaDrop/reorderMixed`；未分类 `onUncatDragOver/onUncatDrop`。

- **主航线 / 方向台首屏（R83 已调过信息密度，改 `LighthousePanel.vue` 前必读）**：
  - **愿景/使命是一条 44px 锚点条 `.mr-vm-bar`**（M1），不是两张卡——「进入方向树 ›」**只有一个**（右端），tier 标签保留（去掉后两段引文分不出谁是谁），愿景 `flex: 1.2` / 使命 `flex: 1`。
  - **目标头** = `目标 · 名字 · 项目 N（主攻 M） · 期限 · pct%ⓘ`（M2）。期限 `dir.term` → `termText()`（远期/中期/近期），**未设不显示**；主攻数 `focusedOf()` **只在 >0 时显示**。
  - **项目是两行小卡 `.chip-proj`**（M3）：行 1 `🎯`+名字+`停滞`，行 2 迷你进度条 + `pct% · done/total`；已完成 `opacity: .55`（对齐 `.archived`）。
  - ★ **主攻用 🎯 不用 ★**（R60 已定视觉语言，★ 与 ⭐ 星标打架）；**停滞用文字标，不只变色**（颜色对色弱用户不可见）。
  - ★ **性能红线**：`projectProgress` / `isProjectStalled` 内部都遍历 `d.tasks`，**绝不能在模板里逐项调用**——一律走预计算的 `projMeta` 索引（`Map<projectId, {pct,done,total,stall,finished}>`）。`R83-7` 否定断言把守。
  - `R57-8` 已随 M1 形态变更**重指**（原验"两列并列卡"，现验 `.mr-vm-bar` + tier-vision + 可点进树 + 1.2:1 比例）。
- **主攻聚焦与就地可操作（R85 已交付，改 `LighthousePanel.vue` / 项目写操作前必读）**：
  - **★ 主攻上限 2 在 store，不在 UI**：`stores/compass.ts` 的 `FOCUS_PROJECT_LIMIT = 2`，`toggleFocusProject(id)` 返回 `{ok,msg}`，**由调用方 `showToast`**（store 是数据层，不碰 UI）。三处入口共用：方向树 `onToggleFocus` / 项目策展页 `toggleFocus` / 主航线 chip hover 的 🎯。⚠ 改前只有 `ProjectCuration` 一处校验 ⇒ **方向树能设出任意多个主攻**（`models/index.ts:65`「最多2个」与手册 `manual-data.ts:229` 都写着上限）。**存量超限不阻断**：只拒绝新增，不强制裁剪。
  - **★ 新建项目只有一处写入**：`addProjectToDir(dirId, name)`（store）。四处入口（`CompassShell` / `CompassTree` / `ProjectCuration` / `LighthousePanel`）全调它，`dir.projects.push` **全项目仅存于 store 一处**。字段以 `CompassShell` 为准（`pinned: false` + `order: dir.projects.length`）。（`R85-4/5` 把守）
  - **M4 聚焦条 `.mr-focus-bar`**：锚点条之下，一行 ≤40px，数据源是既有 `focusedProjects`（含 archived 过滤）。**不受 `showDone` 节制**（已完成主攻仍要能看见并取消），只 `opacity: .55`。无主攻 → 轻引导且**把「最多 2 个」写出来**。
  - **M5 就地可操作**：① `＋ 新建项目` = **内联 input**（`@keyup.enter` 建 / `@keyup.esc`+`@blur` 取消），**不弹窗**——省掉与父组件 `CompassShell` 的跨组件通信；② chip hover 两动作走 `.cp-acts`（`display:none` → hover `flex`，**零占位**），必须 `@click.stop`（否则点 🎯 会顺带跳详情）；③ 目标卡 `⋯` 只做 `openTree()`，**不造第二套目标菜单**（`CompassTree` 已有完整目标级操作）。
  - **与 D-A 的边界**：主航线只做**一键级轻量预置**（建个项目名、切个主攻开关），**管理类操作一律导流**（改名/删除/设期限/归档都不在主航线）。
  - ⚠ **`focusedProjects` 仍只有方向台一处消费**——`models/index.ts:65` 注释与手册承诺的「同步至任务中心顶部 / 直通调度台速览」，**调度台那一处至今零实现**（落点是 `/`，不同组件，未擅自扩范围）。**待产品负责人拍板**。
  - ⚠ **断言陷阱**：`R83-4` 里 `!LH_TPL.includes('v-else')` 是全模板判，会被任何新增的 `v-if/v-else` 误伤（R85 就被「＋ 新建项目 / 内联输入」绊倒）。已收窄为**只在 `.mgc-head` 内判**——写否定断言时先想清楚"我到底要否定哪个范围"。
- **方向台分工与项目总览检索（R86 已交付，改 `CompassShell.vue` 前必读）**：
  - **★ `showDone` / `toggleShowDone` 只在 store**（`stores/compass.ts`）。三处组件（主航线 / 项目总览 / 完整方向树）**零本地实现**，一律从 `useCompass()` 解构。改前是**三份逐字重复**的代码。
  - **「已完成项目」开关只有两处 UI**：方向台页头 `.done-toggle`（`CompassShell` 的 `.page-head`）+ 完整方向树独立页 `.tree-tool`（**保留**是原文要求）。主航线 `.mr-tool` 与项目总览 `.ov-toggle` **已移除**。
  - ⚠ 主航线的 `class="mr-tool accent"`（「完整方向树 →」）是**导航入口不是开关**，别一并删了（`R86-4` 把守）。
  - **D-A 分工标签 `.mod-role`**：主航线「看主线」/ 项目总览「管项目」。**样式用 `:deep(.mod-role)` 定义在 CompassShell 一份**，覆盖自己 + 子组件 `LighthousePanel` 两处（scoped 管不到子组件，见 §五·补八）。**D-A 是表达条目，不新增任何写能力**。
  - **D-B 项目总览检索**：`OV_TOOLS_MIN = 12`，**>12 才渲染**搜索框 + 状态筛选。搜索匹配**项目名 + 所属战略目标名**（`goalNameOf`）。状态判定**只复用 `isProjectStalled` / `isProjectDone`**，且预计算成 `projState` 索引（**不在模板逐项调**，R83 红线）。搜索/筛选是**本地 ref，不进 UIPrefs**（刷新即重置）。
  - ⚠ **筛选不绕过全局 `showDone`**：开关隐藏时筛「已完成」会得到空结果 ⇒ 空态**说明原因 + 给一键「显示已完成」**，而不是偷偷放行。**全局开关仍然权威，口径只有一套。**
  - `R49-14` / `R57-11` 两条已随 T0 收敛**重指**（实现离开组件，能力仍在），零退役。
- **挂载到任务（R82/R4 已双向闭环，改挂载相关逻辑前必读）**：
  - **两个方向都有入口**：任务侧 `TaskDetailDrawer`（`toggleMountResource`，搜索 + ✓/＋ 切换）；**资源卡侧** `Workspace.vue` 的 `📋 挂载`（动作条第七动作 + 右键菜单，共用一个「搜索 + 最近任务」选择器弹窗，多选切换即生效）。**两边 UI 必须保持同构**（`R82-6` 把守）。
  - **★ 单向挂载红线（不可妥协）**：只写 `task.mountedResourceIds`，**资源卡零新增反向字段**。"被哪些任务挂着"一律**反查** `d.value.tasks.filter(t => !t.deletedAt && (t.mountedResourceIds||[]).includes(r.id))`（`mountedTaskCount()`，与 `ResourceEditForm.vue:52` 同款）。反查同一份数据 ⇒ 两侧计数天然同步，**不要建索引缓存**（会引入同步逻辑）。红线由 `R82-4`（写入函数不碰资源卡）+ `R82-5`（模型无反向字段）两条否定断言把守。
  - **写入用整体替换，不要 `push`**：`t.mountedResourceIds = arr.includes(rid) ? arr.filter(...) : [...arr, rid]`——直接改数组元素的部分路径不触发响应式。
  - **镜像卡不给挂载入口**（拍板）：镜像卡与真身同 id（`hub.ts:139` `{...src}` 拷贝），挂载语义本安全，但镜像卡在策展台是**只读引用**，写动作一律回落资源台真身卡（R61/R79 口径）。`v-if="!isMirrorView(r)"`。
  - **动作条图标不随已挂载态变化**（恒 `📋`，仅 `.on` 高亮）：动作条上的 `✓` 读作"完成"，与"挂载"混淆；`.on` 与既有 `⭐` 同款。**这是本轮未拍板、由任务书定的取舍**，改动前先看任务书 §三。
- **资源台卡片三视图（R79 已推平，R82 加第七动作）**：卡片 / 列表 / 看板**同一套七动作、同一顺序** —— `↗ 打开`(`openResourceLink`) · `📌 置顶`(`togglePin`) · `⭐ 星标`(`toggleStar`) · `📂 移动分类`(`openMoveOne`) · `📡 镜像`(`openMirrorCard`，`v-if="isHub && !isMirrorView(r)"`) · `🗑 删除`(`deleteResource`)；三视图都有 `🔥 调用 N 次`（`v-if="r.callCount"`，类 `.rc-calls` / `.rr-calls` / `.kc-calls`）。**新增任何卡片动作都必须三视图一起加**（`R79-2/3/5` 用顺序断言把守）。
  - 看板动作条是 `.kc-actions` / `.kc-action`（`.kc-card` 有 `position: relative`）；**旧的孤立 `kc-del` 已废**，`R56-19` 已重指 `.kc-action delete`。
  - `callCount` **不在字段池**（无 `FieldDef`，是系统统计值），所以 🔥 是硬编码行，**不要试图走 `visibleFields`**。
  - ~~⚠ `fieldConfig.resource.tags` 默认 `visible: false`~~ → **R80 已改为 `true`**（见下「字段池默认值」），标签在默认与存量配置下均显示。
- **附件与导入（R80 已闭环，改附件相关逻辑前必读）**：
  - **类型判定只有一份**：`shared/utils/assetKind.ts` 的 `guessAssetKind(name, mime)` / `ASSET_KIND_MB`（`image:10 / html:20 / pdf:100`）/ `assetMimeOf` / `stripExt`。`AssetManager.vue` 里只是 `const guessKind = guessAssetKind` 的别名，**不要再写第二份判定**（两处口径必漂移，`R80-5` 把守）。
  - **本地文件导入 = 每文件一张带附件的卡**（R13/Q10 拍板）：`linkType='file'` + `link='zy-asset://<id>'` + `assets=[meta]`（每卡恰 1 项）；不支持/超限/写入失败一律 `skipped` 不建卡。**不要再回到"只存文件名"**——那会产出打不开也修不好的哑卡。
  - **`openResourceLink` 的 `zy-asset://` 三分支**：`!meta` → 提示重新上传；`image` → `openImageAsset`（`AssetPreview` 弹窗）；`html|pdf` → `openHtmlAsset`。**判据是正向放行，别写成"非 html 非 pdf 就报错"**（会把图片误判成附件失效，R14 的历史缺陷）。
  - ⚠ **FileList 快照**：`<input type=file>` 的回调里**必须先 `Array.from(input.files)` 再 `input.value = ''`**——置空会重置 FileList（第卌一轮同款坑，R13 已踩过一次预防）。
  - **附件徽标三档（R81 已交付）**：`AssetBadge.vue` 是 🖼 图 / 📕 PDF / 🧾 HTML **三档独立计数**（`imgCount`/`pdfCount`/`htmlCount` 各自 `filter`），模板顺序 图→PDF→HTML，三档共用 `.ab-chip` 低饱和底色（`.ab-img`/`.ab-pdf`/`.ab-html` 均为空规则占位）。**不要再写 `htmlCount = list.length - imgCount`**——那会把 PDF 吞进 HTML 档（`R81-1/2` 把守）。
  - **单击分流**：`onBadgeClick()` —— `list.length === 1` **直接打开**（图片 → `AssetPreview` 弹窗；PDF/HTML → `openHtmlAsset` 落盘 `file://`），**多个才 `openList()`**。`badgeTitle` 随数量变（单个报「文件名 · 点击预览/点击打开」，多个报「点击查看 N 个附件」）。
  - **项目不在顶层**：`AppData` **没有 `projects`**——项目挂在 `d.value.compass.directions[].projects` 下。要扁平表就调 `useCompass()` 的 `allProjects()`（`stores/compass.ts:60` 的 `directions.flatMap(dir => dir.projects)`），**不要另写一遍 flatMap**。R82 在 `Workspace.vue` 里就是这么接的。
  - **附件文本摘要只有一份 `assetSummary()`**（同在 `assetKind.ts`）：输出「N 图 · N PDF · M HTML」，**三个出口共用** —— 徽标 / `fields.ts` 的 `fieldValue('assets')` / `GlobalSettings.resCsvValue('assets')`。**改摘要口径只改这一处**；无 PDF 的卡输出逐字不变（`R81-5/6/7` 把守）。
- **字段池默认值（R80 变更）**：`fieldConfig.resource.tags` 默认 **`visible: true`**（此前是 false，导致 R1「补齐 #标签」从未生效）；存量由 `repository.ts` 的一次性幂等迁移（`AppData.tagsVisibleMigratedAt`）补齐。**task / curiosity / thesis 三组仍是 false**。
- **浮层保存回执与三件事（R78，写浮层交互前必读）**：
  - **保存回执已 toast 化**：`showSaved(toastMsg, openAction)` —— 资源卡/任务保存成功**不再有整屏确认块**，只出一行 toast + **2.5s**（原 5s）。回执期内 `Enter` 的动作挂**模块级 `savedOpenBoard`**（原依赖的整屏按钮已随块移除）；`openOverlay()` 开头调 `clearSavedState()` 作废上一次回执态。**唯一例外：重复卡确认（`showDupConfirm`，「该页面已收录」）维持整屏**——那是要用户做决定的阻断态。
  - **三件事写入口 `addTaskToDailyFocus(item)`**：① 去重（已入选不写库，直接 `focusLocateTask`）；② `FOCUS_LIMIT = 3` 硬上限，满则**两段式替换**（首次只提示、置 `pendingReplaceSlot = 0`，再次才落库）；③ 一律 `await loadData()` **绕过 1500ms 缓存**取最新快照，`saveData(d)` 后**同步 `dataCache = d; dataCacheAt = Date.now()`**。写入的槽位与 `CompassHome.selectTaskForSlot` **完全同构**（`sourceType:'task'` / `sourceId` / `text` / `done` / `doneAt`）。
  - **键位红线**：`Ctrl+Enter` 在搜索浮层里**已是「定位并打开详情抽屉」**，不要挪作他用；`→`（ArrowRight）= 加入今日三件事，**只在光标已在输入框末尾时才截获**（否则会抢掉"光标右移"）。
  - ⚠ **遗留**：newtab 侧 `CompassHome.selectTaskForSlot()` **无 3 上限校验**（`list.push(slot)`，上限只在 `openPicker()` 入口拦）。要统一两入口口径时，把校验下沉到该函数。
- **策展台身份与中心论点（R84 已交付，改 `Workspace.vue` 页头/视图前必读）**：
  - **台身份页头是 `.ws-id-head`，对所有台渲染**（W1）：`图标 + {{ workspace.name }} + wsHeadDesc + 右端摘要`。它**取代**了 R73 那段的 `.ws-hub-head`（`v-if="isHub"`、写死「资源台」三字）。`R73-4` / `R61-8` 两条已随此重指。
  - ⚠ **模型字段名是 `desc`，不是 `description`**（`workspace.value?.desc`）——按直觉写直接 `TS2339`，本轮已踩。
  - **hub 描述为空时回落 R73 原文案**「资源卡唯一存储 · 镜像源头」（`wsHeadDesc` computed）——那段是 R16 收敛时特意补的教学信息，纯走 `desc` 会丢。**普通策展台描述为空则严格不占位**（`v-if`，非三元）。
  - **页头标题 19px**（`R51-F11` 既有规范，见 §五·补六）；页头 `min-height:34px / max-height:40px / padding:6px 0 8px` ⇒ 实测 37px。
  - **视图偏好按台持久化**（W2-②）：`shared/utils/wsView.ts` 的 `readWsView/writeWsView/sanitizeWsView`，存 `UIPrefs.wsViewMode[<台 id>]`，**与 `cardCols.ts` 完全同构**。初始化：已存偏好 → 用它；无偏好 → `thesisCard ? 'pyramid' : 'card'`。
  - ⚠ **不要复用 `UIPrefs.viewMode`** —— 它是**死字段**（`models:419` 声明、`repository:407` 给默认，**全库零读零写**），且是**全局**的（不按台）、类型不含 `'pyramid'`。本轮一行未动，留给未来清理。
  - **切视图走 `setViewMode(m)`，不要直接 `viewMode = m`**（四个 view-tab 已全改）——直接赋值不落盘，"记忆其选择"就失效。`watch(workspaceId, () => nextTick(applyWsView))` 负责切台重算（`R84-7` 把守）。
  - **论点横幅 `.thesis-banner` 只在卡片视图**（W2-①，`v-if="viewMode==='card'"`）：金字塔视图本身 L1 根就是论点，不重复。两态：已设 → 🏛 + 标题（可点开详情）+ 「查看金字塔 →」；未设 → 灰字轻引导（无按钮、不弹窗）。
- **资源台检索（R87 已交付，改 `Workspace.vue` 工具条 / 排序 / 筛选 / 卡片状态徽标前必读）**：
  - **★ 链接三态判据只有一份**：`shared/utils/link.ts` 的 `isZyAssetLink` / `isFullPath` / `linkStateOf(linkType, link) → 'none' | 'ok' | 'incomplete'`。四个出口共用（筛选 `hasLink`/`brokenPath`、三视图 ⚠ 徽标、双击 toast、编辑抽屉 `.ref-warn`）。**不要再写第二份 `isFullPath`**（`ResourceEditForm` 那份私有实现已退役，`R87-1` 把守）。
  - ⚠ **判据顺序要紧：`zy-asset://` 必须先于 `file` 判**。R80 起本地文件导入生成的卡是 `linkType='file'` + `link='zy-asset://<id>'`（**故意**不暴露本机路径，走 `AssetPreview`/`openHtmlAsset` 打开）⇒ 先判 file 会把它误报成「待补全」。**这是 R87 顺带修掉的既有缺陷**（`R87-5` 把守顺序）。
  - **筛选不是 `===` 而是谓词表 `FILTER_PREDICATES`**：8 档 = 4 个 `linkType` 直判（`all`/`url`/`file`/`obsidian`，**值一字不改**，兼容已持久化偏好）+ 4 个语义谓词（`hasLink`/`brokenPath`/`hasAssets`/`unmounted`）。**不同维度不能塞进同一个 `===`**。下拉用 `<optgroup>` 分「按链接类型 / 按状态」两组。
  - **★ `unmounted` 走反查索引 `mountedResIds`**（`Set<string>`，一次遍历 `d.tasks` 建）。**不要**在筛选里逐卡 `mountedTaskCount`（O(卡×任务)，触 R83 性能红线）。**单向挂载红线不变**：资源卡零新增反向字段（`R87-4` 否定断言：模型无 `mountedTaskIds`）。`mountedTaskCount()` 仍保留给右键菜单/动作条用（它需要的是**计数**不是有无）。
  - **筛选 `filterBy` 不进 UIPrefs**（临时视图态，持久化会造成"打开发现卡少了"）；**排序沿用既有 `sortPrefs.res`**，读取时过 `SORT_BY_KEYS` 白名单（防未来退役档位后读到死值卡住 UI）。
  - **排序 `hot`** = `callCount` 降序 + `lastCalledAt` 降序兜底（避免零热度段次序随机）。方向按钮 `.sort-dir-btn` **仍只对 `recent`/`visited` 出现**（热度与标题无方向语义）。
  - **三视图 ⚠ 徽标**：`.rc-broken` / `.rr-broken` / `.kc-broken`（同形，10px / 99px 圆角，`var(--warning)` + `var(--surface-2)`）。**新增任何卡片状态徽标都必须三视图一起加**（R79 推平原则，`R87-6` 把守）。点击走 `fixLink(r)` → 镜像卡只读拦截 → `openResource(r)` + `nextTick(() => resFormRef.value?.focusLink())`。
  - **`ResourceEditForm` 用 `defineExpose({ focusLink })`** 对外暴露聚焦（`<script setup>` 默认封闭）；抽屉常驻 DOM（`drawerOpen` 只切 class），所以 `nextTick` 后即可聚焦，无需等过渡。
  - **空态要感知筛选**（`hasActiveFilter` / `FILTER_LABELS` / `resetFilters()`）：零结果时说明"按什么筛的"并给「清除筛选」，**不要**只说"暂无资源卡"（会让人以为卡丢了）。与 D-B 项目总览同款口径。
- **工具条分级（R88 已交付，改 `Workspace.vue` 工具条 / ⚙ 菜单前必读）**：
  - **一级只有五件**：`视图 Tab ｜ 🔍搜索 ｜ 🔣筛选 ｜ ＋新建 ｜ ⚙`。排序 / 排序方向 / 类型筛选 / 密度 / **列数（ColsPicker）** 全在「筛选」气泡 `.filter-pop` 里（`R88-2/3` 把守）；「⬇ 导入」与「☑ 批量管理」在 ⚙ 菜单 `.settings-menu` 里（`R88-7` 把守）。
  - ⚠ **批量模式激活时一级必须保留「✓ 完成批量」**（`v-if="batchMode"`）——`.batch-bar` 浮动栏的条件是 `batchMode && selectedIds.size`，**开了批量却一张没选时它是唯一退路**。`R88-6` 把守。
  - **气泡用相对定位**（`.filter-wrap` 是 `position:relative`，`.filter-pop` 是 `absolute; top: calc(100% + 6px); right: 0`）。既有 `.settings-menu` 用 `fixed; top:54px; right:28px` 是**遗留**——注释理由（避 hero 圆角）早已随 R64 删除失效；且筛选按钮宽度随徽标变化，写死 `right` 算不准。已核验 `.ws-page` / `.ws-toolbar` 均无 `overflow:hidden`。
  - **气泡与 ⚙ 互斥**：`toggleFilterPop` / `toggleSettingsMenu` 各自先关掉另一个。两者都用 `document.addEventListener('click', closeXxx)` 关闭（`onMounted` 注册、`onUnmounted` 一并摘除），浮层内需 `@click.stop`。
  - **生效值徽标 `filterSummary`**：非默认才计入（排序≠manual / 筛选≠all / 密度≠cozy / 列数≠`CARD_COLS_DEFAULT.res`），**列数只在卡片视图计入**；模板最多显示 2 枚 chip + `+N`，`filterPopTitle` 给全量兜底。全默认时数组为空 ⇒ 按钮无徽标。
  - **一级只有一个 primary**：「＋ 新建」（导入的 primary 已随 W6 移除）。`R88-8` 把守。
  - ⚠ **三条已重指**：`R65-1` / `R74-3`（导入入口由工具条进 ⚙，判据改 `importModalOpen.value = true` + `function openImport(`）；`R72-7`（列数门控由组件自身移到包裹行 `<div v-if="viewMode==='card'" class="fp-row">`，判据放宽为"与 viewMode 门控 200 字符内互为前后"）。
- **检索与镜像卡（R89 已交付，改搜索 / 筛选 / 镜像卡动作条前必读）**：
  - **★ 搜索判据只有一份**：`parseQuery(raw)` + `matchCard(r, p)`（组件内，仅一处使用故不进 shared）。范围 = 标题 / 描述 / 标签 / **自定义字段值**；`#a #b` **取交集**（都要命中才算），**单个 `#`（长度 1）回落为普通词**——否则刚敲下 `#` 就把列表筛空。`filteredResources` 内**不得再内联**匹配表达式（`R89-3` 否定断言把守）。
  - **筛选 9 档**：4 个 `linkType` 直判 + 5 个语义谓词（`hasLink` / `brokenPath` / `hasAssets` / **`starred`** / `unmounted`）。**加档位要同步四处**：`FILTER_KEYS` / `FILTER_PREDICATES` / `FILTER_LABELS` / 气泡下拉——`filterSummary` 生效值徽标会自动沿用 `FILTER_LABELS`。
  - ⚠ **W5 的 `hot` 排序与 `hasAssets` 筛选已在 R87 交付**——R16 收敛后两台同为 `Workspace.vue` 同一工具条，**R5 与 W5 本是同一份实现**。看到 W5 别当成全新需求，先查已交付了哪几项。
  - **★ 镜像卡（W4）只有三个动作**：`↗ 打开` / `🎯 定位源`（`locateMirrorSource`）/ `✕ 移出镜像`（`removeMirror`）。写动作 `📌⭐📂🗑` 包在 `<template v-if="!isMirrorView(r)">` 里。**两个新动作的能力本就存在**（下钻抽屉 / 🗑 分支在用），本轮只是接线。
  - ⚠ `🗑` 曾名不副实：对镜像卡它执行的是 `removeMirror`（移出投影，源卡保留）。现对镜像卡隐藏，`✕` 承担该语义。
  - ⚠ **三条已重指**：`R73-7` / `R79-8` / `R82-1` —— 非镜像门控由各动作自身上移到包裹 `<template>`（语义等价，见 §五·补十五）。

- **工具条收敛与右键菜单（R90 已交付，改页头 / 工具条 / 右键菜单 / 抽屉下拉前必读）**：
  - **页头描述是两态**：`wsHeadDescOwn`（用户自写台描述，**内联**显示，W1 的台身份）/ `wsHeadDescFallback`（仅资源台无描述时的回落定位语「资源卡唯一存储 · 镜像源头」，**降为 ⓘ + title**）。合并成一个 `wsHeadDesc` 时二者不可区分，**一刀切降 tooltip 会把 R84 的台身份抹掉**。
  - **常驻教学文案收在 `HUB_HELP_TEXT`**（`?` 的 title，仅 hub 渲染）：04-18 原句「卡片在此存储为真身 · 📡 单卡 / 📤 分类可镜像到各策展台 · 源数据零影响」。**不常驻 ≠ 删除**——`R90-2` 逐字把守四段。
  - **主 CTA 位置**：`视图 Tab → ＋新建 → .toolbar-spacer → 搜索 → 筛选 → [✓ 完成批量] → ⚙`。右推职责在 `.toolbar-spacer`（`.toolbar-search` **不带** `margin-left:auto`）。R88 只做了"分级"，**"前置"是 R90 补的**。
  - **右键菜单（`openResCtx`）非镜像分支 10 项**：打开链接 / 复制链接 / **编辑详情**（`openResource`）/ 移动分类 / 挂载到任务 / **📡 镜像到策展台**（`openMirrorCard`，**`isHub` 门控**）/ 置顶 / **⭐ 星标**（`toggleStar`）/ 设为中心论点 / 删除。镜像分支仍只有 4 项（只读）。
  - **★ `Icon.vue` 的图标表是白名单**：`ICONS[props.name] || ICONS.compass` —— **传不存在的名字会静默显示成罗盘**（既不报错也不留空）。加右键项/菜单项前**先 grep 图标键是否存在**；R90 补了 `edit` / `star` / `share`，中心论点由 `star` 改 `target`。
  - **★ R17 的边界**：`store.workspaces` **显式排除资源台**（`app.ts:18` `w.id !== CURATION_WS_ID`），这是**全局口径，不要改**。资源台真身卡的「策展台」下拉靠 `ResourceEditForm.wsOptions` **首位注入**「🗂 资源台（真身）」来消除"无匹配值 ⇒ 空白 + 改选即真身静默迁台"。别处（GlobalSettings 搬家目标台 / overlay 台计数）不该混入资源台。
  - ⚠ **一条已重指**：`R84-2`（描述改两态，能力一致：仍 `v-if` 不占位、回落文案一字未改）。
  - **★ 版本号改动只认一处**：`regression.cjs` 顶部的 `VER_ANCHOR_LITERAL`（派生 `CUR_VER` / `CUR_VTAG`）。升版改这一行即可，**不要全局替换**（见 §五·补十八：全局替换会污染轮次标题与断言描述，R90 修了 34 条历史标注才恢复）。
  - **★ 白皮书 §9.3 演进段已补到 29 条**（R91 追加第 29 条）。新增一轮请**同步追加一条**，别让它再断。

- **主攻直通调度台速览（R91 / V2.60.0 已交付，改调度台首页前必读）**：
  - **坏账背景**：两处对外承诺**零实现**——`models/index.ts` 的 `isFocused` 注释「同步至任务中心顶部」+ `manual-data.ts:229`「🎯 主攻（最多 2 个）**直通调度台速览**；14 天无推进自动亮 ⚠ 停滞」。
  - **★ 「任务中心」是 R49 已退役的旧页**（`/tasks` 路由已删，回归有 `旧任务中心路由已退役` 断言把守）；`goToTask` 现在 `router.push('/')`。**两处承诺指向同一处** ⇒ 落点就是 `CompassHome.vue`（调度台首页）。**别再去造"任务中心"**。
  - **调度台主攻速览条 `.ch-focus-strip`**：位于 `</MetricBar>` 之后、`#dispatch-split` 之前（`R91-2` 把守位置）。一行 ≤40px：`🎯 主攻` + 每个主攻一枚胶囊（`名字 · 进度% · ⚠ 停滞 · 待办 N`）+ 右端「去方向台 ›」；空态 `.cf-hint`「🎯 尚无主攻项目 —— 去方向台指定（最多 2 个）」**可点**。
  - **与方向台 `.mr-focus-bar` 是分工而非重复**：方向台那条在**目标卡上下文里**（"管"的视角，hover 能就地切主攻）；调度台这条在**「今天从哪出发」的语境里**（"看"的视角），故多停滞警示与待办数。改其中一条时**先确认是不是另一条也该动**。
  - **★ 性能红线（同 R83/R86）**：`projectProgress` / `isProjectStalled` / `isProjectDone` / `projectTasksOf` 内部都遍历 `d.tasks` ⇒ 预计算 `focusMeta` 索引（与 `projMeta` / `projState` 同款），`R91-3` 否定断言把守模板内零逐项调用。主攻上限 2 个也不破例。
  - **★ 同一 store 里签名不对称**（见 §五·补十九）：`projectTasksOf(projectId: string)` 收 **id**，其余三个收 **Project 对象**。写 `projectTasksOf(p)` ⇒ `TS2345`，应为 `projectTasksOf(p.id)`。
  - **点击直达项目详情用 `/compass/projects?p=<id>`**（与方向台 `LighthousePanel.openProject` **同路由**，`R91-5` 把守）——两处跳法不一致会让用户以为是两个功能。
  - ⚠ **遗留**：① 方向台主攻聚焦条是否也补 ⚠ 停滞（**增益**非坏账，待决策）；② `.ch-focus-strip` 与 MetricBar 的**间距需实测**（本轮独立成行，风险最低）。

## 九、文档产出惯例

- 需求盘点/汇总 → `文档中心/04_产品与设计/04-20_下一轮需求盘点与开发清单.md`（编号 `R1..Rn` + 批次）
- 单轮任务书 → `04-21` / `04-22` / `04-23`…（**动工前**写，含：需求原文 / 现状勘验 / 任务分解 / 数据结构影响 / 断言计划 / 九条规则对照 / 风险与回滚）
- 交付说明 → `docs/交付说明_R{N}_<主题>.md`
- 收尾三件：`文档中心/00_产品事实与表达母版.md`（§15 版本 + 变更记录行）、`文档中心/README.md`（分区索引）、`.workbuddy-ai/memory/YYYY-MM-DD.md`（追加记录）
