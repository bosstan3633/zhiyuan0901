# 交付说明 · R4-Dj —— 孤儿 CSS 清账：79 条死规则删除，顺带暴露 7 条拿它当证据的断言（未升版）

轮次 D 第十二刀，也是最后一件挂账。上一轮（R4-Dh）我在动手前停手，理由是"静态零用法会误杀动态类名"——
这次把方法补齐了再做，结果**删 CSS 本身不难，难的是它揭开了七条一直在绿的假证据**。

## 一、方法：三层判据 + 两层验证

判"一条规则死"必须同时过三层（任何一层不过就保留）：

1. **静态零引用**：该规则被着色元素的主类名，在所有 `.vue`/`.ts` 的 `<style>` 之外**以任何形式**出现过一次就算活
   （含注释、含字符串、含 `classList.add('x')`）。
2. **动态来源排除**：`<Transition name="…">` 会运行时生成 `.x-enter-active/.x-leave-to` 等类
   （本机在用的名字：`batch / cdf / drawer / expand / fade / md-fade / md-pop / modal / overlay / pop / slide / toast`）——
   这些永不删；数据值当修饰类（`linkType` 的 `url/file/obsidian`、`st-*`、`lc-*`、`b-*`、`t-*`、`status-*`、`drop-line-*`）
   已按前缀枚举，与死清单无交集。
3. **DOM 活体走查**：真起扩展，在 **13 个面**上查这 46 枚被删主类有没有元素——
   调度台三个卡 tab × 批量态、策展台卡片/列表/看板三视图 + 详情抽屉、设置四屏（根/仪表盘/生命周期/标签管理）、
   回收站、方向树、手册页。结果：**全部 0 命中**（`/tmp/zy_dj_proof.cjs`）。

验证两层：

- **theme-audit 的语义判据**：92 图全过（它量的是列数/行数/圆角/底色/字号，不是像素）。
- **同构建 A/B 逐像素**：`_ab_before` vs `_ab_after` 92 张里 **66 张完全一致**。
  ★这里必须先纠正一个方法错误：我一开始拿"一小时前的归档截图"当基线，比出 31 张不同；
  于是做了一次**零改动对照实验**——同一份代码连采两次，仍有 **25–26/92 张逐像素不同**
  （`dashboard / deck / dz-entry / drawer-resource / st-tags` 这些面随时间、hover 残留、动画窗口变化）。
  ⇒ **"改前改后截图对比"必须同会话 A/B，跨时间比会淹死在噪声里**。这条已经值得单独记进纪律。

## 二、两遍判据各错一次，都记下来

| 遍 | 判据 | 错法 | 后果与处置 |
| --- | --- | --- | --- |
| 1 | 整条选择器里**有任何**活类就保留 | 过保守 | `.rc-link.file`（`file` 是 `linkType` 数据值，活着）、`.mc-value.thesis` 这类"主类已死、修饰类活着"的规则被留下——它们永远匹配不到元素 |
| 2 | 取**最后一段**复合选择器的主类判死 | 过激进 | 误删 `body .module-title .name/.en`（`class="name"`、`class="en"` 在 `ModuleCard.vue:24-25` 在用）与 `body .dash-value, body .ns-value, body .fds-value`（`NorthStarPanel.vue:225` 的 `ns-value` 在用）⇒ **两条已原样还原**，并新增判据钉住在位 |

★还有一处是删除脚本自己的缺陷：按字符区间删规则会把相邻规则粘到同一行，
`detail-sheet.css` 出现 `}.ds-tag .x { … }` 这种残留（花括号计数仍然平衡，所以"括号配平"这种自检是无效的）。
已手工修好并留注释。教训：**自动删 CSS 之后必须逐文件读 diff，不能只看括号**。

净结果：**净删 78 条规则**（第一遍 60 ＋ 第二遍 19 − 确认活着还原 3 ＋ 手工补删 2 条残留 `.ds-tag .x`）。
行数（实测 `git diff --numstat`）：四个文件合计 `+24 / −134`，净 **−110 行**
（三个 `.css` 净 −82；`CuriosityPanel.vue` 的 scoped 样式净 −28）。

## 三、★最值钱的发现：这些"孤儿 CSS"养着七条一直在绿的假证据

删完规则，回归当场红 7 条——**它们不是被删坏了，而是原本就拿这些没人用的 CSS 当判据**：

| 断言 | 原锚点（死） | 现役锚点（新） |
| --- | --- | --- |
| `O24 好奇心采集带来源` | Curio 里出现 `detail-src` 字样 | `class="cz-ext-src"` + 按 `fieldConfig` 的 `sourceUrl` 渲染 |
| `P2 封面扁平化` | `.metric-card { background…` | `.res-card { background…` + 负判据 `.metric-card` 不许回流 |
| `V13-4 文本框可拖拽调高` | Curio `max-height: 400px`（挂在死的 `.detail-textarea` 上） | `class="ds-hero-note"` + `height: detailH`（记忆高度） |
| `R40-7 AssetBadge 三视图` | `rc-assets`（卡片视图的徽标本就没有类名） | 模板那行 `<AssetBadge v-if="r.assets?.length"` |
| `R109-3 指标卡两行 + hover 抬升` | `.metric-card` 块内一行 + `.mc-value{font-size:20px}` | `.rc-head`（顶对齐+间距）+ `.res-card:hover`（`translateY(-1px)`，值也随 R133 令牌化变成 `border-strong`）；`.mc-value` 那半**改负判据**——数值字号在现役 UI 里没有对应物，硬找等价只会再养一条假证据 |
| `R65-1 / R74-3 工具条` | `toolbar-batch`（R88 把批量入口收进 ⚙ 后模板早就不用了） | `toggleBatchMode` + `☑ 批量管理` |

这正是 R4-Da 记下的"断言还在、证据已空"，只是这次发生在 CSS 侧：
**一条 CSS 死掉时，拿它当证据的断言不会红，只会永远真绿**——所以"删死代码"这套动作
顺带是给门禁做体检，价值比省下的 133 行大。

## 四、判据 +2（1579 → 1581）

- **死类名不许以样式规则回流**（46 枚点名，含 `metric-card / mc-* / mt-* / rc-fields / rc-link / dr-footer /
  name-text / cover-swatch / toolbar-batch / py-empty / ws-icon-btn / ds-quote / ds-tag / cz-add-* /
  detail-src / status-chip` 等）；想复活某个视觉，先把使用点写回模板。
- **被误判的两条活规则必须在位**：`body .module-title .name`、`body .dash-value, body .ns-value, body .fds-value`
  （连同"后代/多段逗号选择器不能只看最后一段"这句教训一起钉在断言标题里）。

## 五、门禁

typecheck 0 · 回归 **1581/0**（R4-Ea 基线 1579 + 2，另有 7 条随迁不计数）· E2E **36/0** · 导入兼容 7/0 ·
循环 **0** · build ✓ · 入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **92 图**（语义判据全过）·
索引一致 **178 文件 / 42,744 行**（★索引只统计 `.ts/.vue`：CuriosityPanel 净 −28、断言注释回加 ⇒ −25；三个 `.css` 的 −82 行不进索引）。ZIP 未重打包。

## 六、边界如实

1. **没删的**：`tokens.css` 里 `body .tag, body .rc-tag, body .gp-ri-badge, …` 这种分组规则——`rc-tag` 自己已死，
   但同组 `.tag` 活着，整条保留（删半条等于改组规则，收益是几十字节，风险是别的组名以后被复用）；
   `.dr-footer-btn` / `.dr-kbd` 活着，只删了 `.dr-footer`；`dashboard.css` 一条没删（它的候选都有活引用）。
2. **DOM 走查覆盖不到的状态**：右键菜单、部分弹窗（移动到/新建分类/输入弹层）、金字塔节点内控件、拖拽落点高亮态。
   这些面的类名若正好在死清单里，探针看不见。风险由第 2 层判据兜住：动态拼类名的前缀已穷举
   （`b- / t- / lc- / st- / status- / drop-line- / zy-` + `linkType` 值），与死清单无交集；
   而这些规则在源码里连字符串形式都不存在，只有"运行时凭空出现"一种可能，实际不可能。
3. **截图跨时间不可复现**这件事本轮只记录、未修（要修是给 theme-audit 加"时间冻结 + 鼠标归零 + 动画等待"，
   属门禁基建，另立一件更合适）。在此之前，视觉 A/B 一律同会话双构建。
