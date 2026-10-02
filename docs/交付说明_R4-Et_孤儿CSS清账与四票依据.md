# 交付说明 · R4-Et · 孤儿 CSS 清账：150 条死规则与量它的四票（#112 兑现）

**日期**：2026-10-02 · 基线 V3.7.1（`0a787c9` R4-Es）· **未升版**
**来源**：#112（R4-Dj 当年因"走查覆盖不足"停在门口）→ R4-En 装上 DOM 类名普查 → 这一轮才真删。

---

## 一、删了什么（账）

10 个组件的 `<style scoped>` 里 **150 条规则 / 191 行 / 18,063 字节**（含行尾换行）。
构建产物 CSS 从 **369,653 B → 353,352 B（−16,301 B）**，分布在 7 个 chunk：

| 文件 | 删掉规则 | 删掉字节 | dist chunk 省下 |
|---|---|---|---|
| `newtab/views/CompassTree.vue` | 71 | 9,157 | −9,022 |
| `newtab/views/GlobalSettings.vue` | 35 | 3,727 | −3,951 |
| `newtab/components/compass/TaskDetailDrawer.vue` | 17 | 2,096 | −2,144 |
| `newtab/components/compass/NorthStarPanel.vue` | 13 | 1,536 | （并入 CompassHome chunk）−689 |
| `newtab/views/CompassHome.vue` | 5 | 449 | −689（含上行） |
| `newtab/components/compass/TaskManagerPanel.vue` | 4 | 560 | （并入他块） |
| `newtab/views/GlobalPopups.vue` | 2 | 304 | −310 |
| `App.vue` / `FieldEditor.vue` / `ProjectCuration.vue` | 各 1 | 234 | −102 / −83 |

删的都是**整族退役**留下的尾巴，四类来源：

1. **主航线时代**（方向树改了 `tc-` / `tp-` / `tm-` 三套前缀之后）：`.node` `.goal-node` `.goals-row` `.goal-col` `.project-node` `.project-branch` `.vision-node` `.mission-node` `.metric-item` `.metric-name` `.metric-status` `.metrics-wrap` `.tasks-wrap` `.tasks-header` `.sub-tree` `.tree-connector` `.guide-line` `.branch-connector` `.progress-bar` `.focus-btn` `.add-btn-inline` `.linked-chips`；
2. **旧世界外壳**（顶部导航与侧栏退役）：`.sidebar` `.sidebar-logo` `.sidebar-item` `.sidebar-divider` `.sidebar-bottom` `.main-area` `.breadcrumb` `.home-logo` `.back-row`；
3. **手册内嵌时代**（第廿一轮手册独立成页，设置页只剩一个按钮）：`.gs-manual` `.gs-manual-nav` `.gs-manual-body` `.gs-mc-section` `.gs-mc-content` `.gs-mc-title` `.gs-mn-part` `.gs-mn-item`；
4. **详情重设计时代**（R167 把三张卡换成 `ds-*` / `ta-resize`）：`.ts-note` `.ts-field` `.ts-select` `.ts-input` `.ts-label` `.ts-rel-up` `.ts-status-chip` `.ts-time-text` `.nd-*` 十枚 `.nr-*` 四枚 `.gp-ai-row` `.gp-curio-src` `.batch-tagin`（两处重复定义）`.cf-go` `.pager` `.pg-num` `.cur-tree-caret` `.gs-fr-actions` `.ai-days` `.gs-dash-*` `.gs-dd-*`。

---

## 二、凭什么说能删（四票，一条规则要四票全零才动）

| 票 | 口径 | 为什么必须有它 |
|---|---|---|
| ① 同文件精确 class token | 该 scoped 样式块所在文件的 `class="…"` / `:class` / 任意字符串字面量里，作为**完整 token** 出现过 ⇒ 活 | scoped 规则只可能命中本组件的 DOM；跨文件同名不算（`.sort-dir-btn` 就是这一票救回来的：它在 Workspace.vue 的按钮上，但规则抄在 TaskManagerPanel 里，那份抄件确实死） |
| ② 全站 class 属性 token（pass-through） | 任何文件的 `class="…"` 里有这个精确 token ⇒ 活 | Vue 会把父组件写在 `<Child class="x">` 上的类透传到子组件根元素，根元素同时带子的 scope id ⇒ 子的 scoped 规则照样命中 |
| ③ 全站字符串 / classList | 任何 `.vue`/`.ts` 的引号串或 `classList.add('x')` 里出现 ⇒ 活 | 动态加类不走 `class="…"`。实测 114 个被删 token 在这一票上**全零** |
| ④ 104 场景 DOM 普查 | `docs/视觉归档/2026-10-02/class-census.json`（831 token）里出现过 ⇒ 活 | 前三票都是静态的；普查是"真在屏上出现过吗"的唯一读数，也是 R4-Dj 当年缺的那把尺子 |

外加两条**结构性豁免**：`<Transition name="x">` 真生成的 `x` 与 `x-enter-from/active/to`、`x-leave-from/active/to` 六件套永不进死桶；样式说明里的点号（`.lc-*`、`workspace.css`）先按等长空白抹掉再解析，免得注释里的点被当成选择器。

**最后一道是像素**：改前改后各出一次 104 图（见第五节）。

---

## 三、扫描器 v2：四处口径是被现场逼出来的，不是设计出来的

`scripts/dead-css-scan.cjs` 这轮重写（旧版只在 /tmp 里，R4-Dj 那份已失）。每处修正都对应一次实测打脸：

1. **没有 census 就拒绝出结论**（`--census` 指不到文件 ⇒ `exit 2` 并说明先跑 theme-audit）。R4-Dj 停在门口的原因就是没有它；没有它这份清单等于纯猜。
2. **样式块不参与"引用"语料**。旧版把整份 `.vue` 拿去找引号，而 CSS 里 `content: ''` 这类单引号会让字符串正则**从样式块一路吞到下一处引号**，把整段选择器当成"用过的字符串"——实测死桶从 150+ 塌到 **21 条**，谁都被判活。
3. **过渡件只认精确生成的那七个 token**。旧版用 `t.startsWith(name + '-')` 豁免，于是 CuriosityPanel 的 `<Transition name="expand">` 顺手豁免了 CompassTree 里毫不相干的 `.goal-node .expand-icon`，Workspace 的 `name="batch"` 放过了 `.batch-tagin`。
4. **拼接票只认真拼接**（字面量以 `-`/`_` 结尾，如 `'gp-' + kind`）。旧口径"token 是任一字符串的子串/前缀"把 `.nd-edit`（因 `nd-edit-hint`）、`.node`（因 `node-title`）、`.stagnant`（因 `stagnant-tag`）判活——那是命名法不是拼接，实测让本轮删的 150 条里 **19 条在扫描器面前"活着"**，工具结论与动手依据就此分家。
5. 最后一处是**收尾时自己撞出来的**：`:class="{ 'ai-clickable': canEdit(r) }"` 里的 token 带着撇（`'ai-clickable'`），静态票漏判，把这条**真在用**的规则列进了死桶。补了"剥引号再切一次"的口径。

### A/B 复算（可重跑）

把删除前的 10 个文件还原成一份副本，用 v2 扫描它：

```
node scripts/dead-css-scan.cjs --src /tmp/zy_et_ab_src --json
→ 规则 3,210 条 · 判死 138 条
```

本轮删的 150 条里 **130 条**在这份名册内；另 **20 条**（`.metric-item` 族 8 条、`.node` 族 8 条、`.dir-tag` `.proj-tag` `.metric-*` 4 条）被 `'metric-' + id` 这类**拼接前缀**救活——那是 `data-edit` 键的拼接，不是类名拼接，扫描器分不出来，所以宁可留在名册外。这 20 条的删除依据是第二节四票 + 第五节像素 A/B，不是扫描器。

**残留**：现状扫描仍报 **死 8 条 + 祖先断 19 条**（`.sidebar-item .tip` `.breadcrumb .root/.sep` `.toggle` `.progress` 等）。**本轮故意不删**——理由写在第八节。

---

## 四、六条判据随迁 + 一条通用刹车

被删的规则里有六条**正锚**，它们一直在钉这些死样式（这就是"文本断言表现为什么都没变"的反面：**断言把死代码当成了活口径**）。逐条改锚，一条未减：

| 判据 | 原锚 | 现状 |
|---|---|---|
| Bug1 目标卡按钮/箭头不重叠 | `margin-right: 52px`（挂在 `.goal-node .expand-icon`） | 换钉今天的形状：卡头 flex `space-between` + 三组动作钮 `margin-left: auto` 流内占位 + 标题 `min-width: 0`，并负锚两条旧魔数预留不许回流 |
| R28 手册排版留白（三处同步） | `GlobalSettings` 的 `padding: 34px 40px`（`.gs-mc-section`） | 三处收敛成两处活锚（阅读页 + 手册数据），第三处换成"设置页不许再内嵌手册正文"的负锚 |
| V13-2 任务抽屉链接+备注 | `.ts-note {` | 换钉真在渲染的三件：`ds-desc` textarea 绑 `selectedTask.description` + 记忆高度 `:style` + `ta-resize` 把手 |
| V13-4 文本框可拖拽调高 | `max-height: 320px`（`.ts-note` 的属性） | 换钉 `useTaHeight('task-note')` hook 本体（与另两卡同口径） |
| R57-9/R121 战略目标 3 列网格 | `.goal-node { border-top: 3px solid var(--accent); }` | 三条活腿（`repeat(3,1fr)` + `align-items: start` + 两档降列）一字未动，只摘掉死腿并补 `.goal-node` 负锚。**这是 R3-B1 改靶时只换了注释没换证据留下的尾巴** |
| R94-7 B3 安静 | 切片终点 `.cur-tree-caret` | 终点换成活边界 `.today-cards { display: grid`（见下） |

**通用刹车（这条是本轮的真正收获）**：`fnBody`/`segOf` 这类"取中段再判"的工具，标记漂了不报错——**终点没了 ⇒ 切片吃到文件尾 ⇒ 负判据误红；起点没了 ⇒ 切片变空串 ⇒ 正判据恒假、负判据永远绿**。本轮删掉 `.cur-tree-caret` 让 R94-7 当场红，才顺着查出**两条早就漂了的标记**：

- `CAP_FN92` 的终点 `document.getElementById('__zy_cap_save__')` 只出现在 `saveCapture` **之前**那一行 ⇒ 切片一路到文件尾，R92-6 的三条正锚（`const filed` + 两种回执文案）从此在整份文件里找，文案挪出函数也不会红；
- `TODAY94` 的终点 `<!-- 下 · 项目调度` 早在 R117 就被改写成 `<!-- 底部 · 任务调度` ⇒ 切片把整个 `<style>` 块都算进"今日三件事"。

现在 `fnBody` 两处失败都记进 `SLICE_MISS`，判据 R4-Et② 要求账本为空——**现场任何一条 fnBody 标记漂了，会红在这一条上并点名是哪个标记，而不是红在别的判据上查不出原因**。`segOf` 的 69 处同题**没上闸**（一次只改一把尺子，R4-Es 的教训）。

---

## 五、像素 A/B，以及这把尺子自己会抖

改前归档留在 `/tmp/zy_et_before_shots/`，改后重跑 104 图（四主题全量，0 个 ✗，census 831 token 与改前**同样 831**——删的类一个都没在屏上出现过）：

- **86/104 逐字节相同**；18 张不同，其中 **12 张逐像素 0 差异**（PNG 编码抖动）；
- `apple-st-manual`（7.56% 差异）→ 整页**垂直错 1px**：把 B 上移 1 行后平均色差从 4.17 塌到 0.20，是滚动取整，不是版式；
- `*-ov-capture`（349 px）→ 采集面板 URL 框里印的是本地宿主服务地址，**端口每次跑都换**（同构建两次跑也差 304 px）；
- `notion-ai-modal-narrow`（890 px，逐通道 ≤4）→ 我一度按"只回退 GlobalPopups 的构建与改前归档逐字节相同"判成删样式导致的，**这个归因是错的**：同一份构建重跑一次，它自己就在两个哈希之间跳（`f22f3f0182c9` ↔ `460e048d51da`，后者恰与改前相同）。`notion-dz-report` 更明显：**同构建两次跑差 16,002 px**。

⇒ 记一条方法账：**像素 A/B 的归因必须先做一次"同构建对照跑"**，否则场景抖动会被读成回归。theme-audit 里至少 `ai-modal-narrow` / `dz-report` / `ov-capture` 三族场景不可复现，已挂账（#120）。

结论：**本轮 150 条删除没有可归因的视觉变化**。

---

## 六、两次自伤，都被机制当场抓住

1. **判据 R4-Et④ 的标题里嵌了一个单引号**（想写"族名 + `' {'` 的组合"），把 98 分片写成 SyntaxError。抓相很别扭：分片崩了，回归却只报"1 红"，红的是别的分片里那条被连带打红的 R57-9——**分片崩溃的表征不是"全红"而是"红得对不上"**。修完复跑 1627/0。
2. **按 basename 还原备份，打脏了 `src/popup/App.vue`**：`newtab/App.vue` 与 `popup/App.vue` 同名，还原循环把前者抄进了后者。当场被 `git diff --stat` 抓住（它显示 11 文件 / 629 插入，而本轮账应该是 10 文件 / 191 删除），用 `git show HEAD:v2/src/popup/App.vue > 该路径` 还原并复验。**教训：还原必须按精确路径，同名文件是必然踩的坑。**

另外三条**自家判据被打回**的记录（同一族失效的第四次成形）：变异 T1（拆掉 census 硬闸）与 T3（把 census 写出那行整行注释掉）**第一轮都绿着过去**——因为锚点锚的是"字符串还在不在"，而字符串还留在注释里/死分支里。改成 ① **实跑扫描器两次**（无 census ⇒ 必须 `status===2` 且给出补救指令；有 census ⇒ 必须真跑出 JSON），③ 锚点全部改成**行首可执行语句**形态并核盘上产物的自洽关系（场景数=同目录 png 张数、token 数=计数表长度、活类名在册而退役类名不在册）。

---

## 七、活性变异（每条都还原到逐字节一致并复跑回绿）

| 变异 | 应红 | 实测 |
|---|---|---|
| T2a 摘掉 `fnBody` 终点缺失的记账 | ② | ✅ 只 ② 红（1626/1） |
| T2b 把 R94-7 的终点标记改回死掉的 `.cur-tree-caret` | ② | ✅ 只 ② 红——**现场漂标记会被账本抓到** |
| T1 拆掉扫描器的 census 硬闸 | ① | 第一轮**绿**（见第六节），改锚后 ✅ ① 红 |
| T3 不再产出 census | ③ | 第一轮**绿**，改成行首语句锚后 ✅ ③ 红 |
| T4a 把 `.goal-node` 放回方向树 | ④ + R57-9 | ✅ 两条同时红（登记表与随迁判据各抓一次） |
| T4b 把 `.ts-note` 放回任务抽屉 | ④ + V13-2 | ✅ 两条同时红；④ 覆盖的其余 9 个文件不受这两条影响 |

判据 **+4（1623 → 1627）**，六条随迁一条未减。

---

## 八、门禁与边界

**门禁**：typecheck 0（内联在 build）· 回归 **1627/0**（既有 1,623 条零减免、零翻转）· build ✓ · E2E **39/0** · theme-audit **104 图 0 个 ✗** + census 831 token · contrast 全绿 4×14 · 入口字面量双向 15 项全 0 · 循环 0 · 导入兼容 7/0 · 索引一致 **178 文件 / 42,696 行**（−191 行，与删除行数吻合）· perf 在新 dist 上重跑：M5c 48.5 最小 / 54.4 中位 / 阻塞 99ms、M5d 15.9ms（散布 1.1×）、M3f 99ms、M15 面板关着仍驻留 7,164KB / 每卡 2,839B —— 与 R4-Er 的 49.1/55.8/99 与 7,165KB 同带宽，**只报无回退不报提速**。ZIP 未重打包、未 push。

**边界如实**：

1. **残留 8 条死规则 + 19 条"祖先断"没删**。不是省事，是两件事：① 它们里有真在用的邻居（`.ai-clickable` 就是被扫描器误报的那条），再删一轮要重跑 build + e2e + 104 图 + perf 才能给同一份证据，为 ~600B 混进本轮账里不值；② 19 条"祖先断"（`.node .node-title`、`.metric-item.expanded`、`.focus-btn.on` 这类）是**旧口径"任一 token 活就留"留下的孤儿兄弟**，静态可证匹配不到，但它们的祖先类名（`node`、`metric-item`）在别处仍是活词，删它们需要"祖先段整段判死"这条口径先被独立验证。已立 **#120**：segOf 的 69 处上同一把闸 + 这批残留 + 三族不可复现场象的处置。
2. **四票仍看不见一件事**：别的组件用 `classList.add('x')` / `el.className = 'x'` 给**本组件的元素**加类。这一票普查能兜住（真渲染过就有记录），但"只在某个未拍到的状态下才加"的类，四票全零也可能活着——所以像素 A/B 是最后一道，不是装饰。
3. **census 只覆盖 104 个场景**。本轮删的类在 104 场景里一个都没出现，但回收站、批量选择态、错误态这类没进场景表的界面，理论上仍有盲区；这也是第 2 条残留不敢顺手删的原因。
4. 注释里的退役名（#118 边界①）一条没清；`stripComments()` 与 `codeOnly()` 仍是两把尺子（#119 边界①）；#117 popup 白屏仍等拍板。
