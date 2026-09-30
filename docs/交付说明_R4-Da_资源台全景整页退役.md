# 交付说明 · R4-Da —— 「🗺 资源台全景」整页退役（未升版）

轮次 D（旧世界清账）第一刀：把 V3.7.0「资源台退役」后残留的最后一个旧世界整页从设置页里删掉。
这一刀真正难的不是删 409 行，是**删完之后怎么知道没删错**——三条教训全部落在下面第二节。

## 一、做了什么

- **删除面**（`GlobalSettings.vue` 3555 → 3206 行，净 -349）：
  - 模板 94 行（`activePage === 'panorama'` 整块：左栏三级计数树 + 右栏卡片列表 + 批量条 + 拖拽动线脚注）；
  - 脚本约 225 行（`interface PanCatNode` / `interface PanWsNode` + 47 个 `pan*` 标识符：`panTree` / `panCards` / `panHubWss` / `panVisibleCards` / `panCollapsed` / `togglePanCard` / `onPanDrop` / `movePanCards` / `movePanSelection` / `flattenPanCats` / `panCrumb` …，以及 `watch(activePage)` 里的 panorama 分支）；
  - 导航格 `{ key: 'panorama', icon: '🗺', label: '资源台全景' }`；
  - CSS 段 57 行（**这一刀切坏了，见 §二.2**）。
- **能力去向点名**（不悄悄丢能力，逐条写进断言并实测在位）：
  - 「按台/按分类计数的树」→ 设置页标签管理树（`gs-tagtree` + 每节点 `tagUsage` 卡数 + `ttCollapsed` 默认空集即全展开）与策展台分类树（`sidebarCats` 递归 + `cat-count` 取 `directCount`）；
  - 「卡数合计」→ 调度台资源卡池面板 `poolTotal`；
  - 「拖拽批量移动」→ 标签管理（右列卡片 draggable → 左树 drop → `ttMoveCards` 替换语义）+ 策展台（`onCatDrop` 走 `useResourceDragDrop`）；
  - 「按钮批量移动」→ 策展台 `confirmBatchMove` + 池面板批量栏 `DeckBatchBar`。

## 二、三条踩出来写进代码的教训

### 1. 随迁规模我报错了：说 6 条，实际 22 条

开工前报的是「6 条断言重指」。真实数是 **22**。差在判据口径：我只数了「文案里提到全景的断言」，漏掉了更多**拿全景代码当证据**的断言——`R33-16` 用 `const panTree = computed` 证明「承接方在场」、`R44-10/11` 整页判据、`R65-9` 收窄语义、`R66-4` 递归四件事、`R110-LC-4` 拿全景格当导航界点、`R126-7` / `R127-3` / `R130-2` / `R130-3` 等。
**口径修正**：删一整页的随迁面要按「以这一页的代码为证据的断言」数，不是按「提到这一页的断言」数。下次先跑一遍 `grep -l` 出全部引用者再报数。

### 2. ★连带损失：删 CSS 时把三段存活页面的规则一起带走了

我按「全景样式段 = 3458–3514」取范围，但那段里混着**三组不属于全景、只是物理挨着**的规则：

| 丢失规则 | 还在用它的存活页面 |
| --- | --- |
| `.lc-set-global/-list/-row/-name`（R126 阈值弹窗） | 设置页「资源生命周期」 |
| `.tt-wrap` / `.tt-tools` / `.tt-picked` / `.tt-list` / `.gs-tt-row.active` / `.gs-tt-row.drop`（R127 标签管理双栏） | 设置页「标签管理」 |
| `.gs-pd-title/-row/-k/-v/-actions`（详情抽屉字段行） | 标签管理详情抽屉 |

更糟的是标签管理右列卡片**直接借用了全景类名**（`gs-pan-card` / `gs-pan-check` / `gs-pan-card-main` / `-title` / `-sub` / `gs-pan-allcheck`），全景样式一删，右列整块裸奔。

**这条损失对全套静态门禁隐形**：typecheck 0、build ✓、回归绿、页面「能打开」——只有量 computed 样式才会红。处置：
- **类名跟着居所走**：六枚借来的类名改成标签管理本地 `tt-*`（`tt-allcheck` / `tt-card` / `tt-check` / `tt-card-main` / `tt-card-title` / `tt-card-sub`），下一个读代码的人不会以为它们属于已删的那一页；
- 存活规则按新名补回 GS 本地一段，段头写明「全景自身的双栏树样式（左树 / ws 行 / 分类行 / 计数徽标 / 批量条 / 卡片日期）一律没补」，退役类名继续按 `R44-10/11` 零命中；
- **E2E-3 与 theme-audit 各加一条"量出来的版式"判据**（见 §三），让下一次同类误删当场红。

### 3. ★断言证据空转两处：判据还在，证据已经没了

- `R130-2` 原判据写 `g.slice(g.indexOf("activePage === 'panorama'"), …)` —— 那串已不存在，`indexOf` 返回 **-1**，`slice(-1, n)` 得**空串**，于是 `!panSeg.includes('!!ttDetail')` **恒真**。这条断言从此什么都拦不住。
  改成可失败的真凭据：① 全景面板在 `codeOnly` 后零命中；② 抽屉锚点的**下标**必须落在 tags 面板起点与下一面板（ai）起点之间（下标比较取代切片取反）。
- `R130-3` 第七、八条在上一版被临时改认别处的同类视觉语言（`.cat-item.drop-child` / `.cz-card.dragging`）——那是**证据降级**不是收敛。本轮把判据指回 GS 自己补回的 `.gs-tt-row.drop` / `.tt-card.dragging` / `.tt-card.selected` / `.tt-wrap`，跨宿主那两条留作并存证据（判据只增不减）。

## 三、断言与实测

- **断言 1551 条 / 0 失败，计数不变**：22 条重指 + 2 条改靶（`R130-2` 反空转、`R130-3` 证据回归）不增不减；重指一律带「★R4-Da 退役重指带备案」写明原判据守什么、能力搬去哪、为什么新判据不更松。
- **E2E 31 条 / 0 失败**，其中 `E2E-3` 整条改靶（原先只核「全景那一屏能否切出」）：
  不写「页面没了所以恒过」，改测两件本轮真实交付面 —— ① 全景版面与导航格在 DOM 里归零；② `.tt-wrap` 实测必须是**两列 grid**（样式一掉就退化成单列流）。
  实测 `panNodes=0 navPan=0 cols=2 treeRows=5`。
- **theme-audit 80 → 84 图**：新增 `st-tags`「标签双栏版式」台面场，四主题各一张，判据是量出来的：`列=2 标签行=62 选中=true 底色变=true 右列卡=圆角4px/内边距9px`。
  ★两个时序/选择器坑当场踩到并记进注释：① 第一版点 `.gs-tt-row` 的 first，命中的是**就地新建输入行**（带 `editing`、无 `data-depth`），选中态永远不出现 → 改点 `.gs-tt-row[data-depth]`；② 第二版拿「首行」当底色基准，而首行正是被点中的那行 → `bg !== base` 恒假，**自己跟自己比**。基准必须取「非 active 的另一枚」。

## 四、门禁

typecheck 0 · 回归 **1551/0** · E2E **31/0** · 导入兼容 7/0 · 循环 **0** · build ✓ · 入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **84 图**（视觉归档/2026-09-30）· 索引一致 **177 文件 / 42,657 行**。ZIP 未重打包（未升版先例）。

## 五、边界如实（本轮明确未做）

只删了「🗺 资源台全景」这一整页。设置页其余 20 屏、手册里 31 处「资源台」旧称、书签导入单路线、数据体检与 `useWsAssetHygiene` 合流、Airtable 标签列映射都没动。
新记一笔清账账：`.gs-panel` 在**全站任何样式表里都没有定义**（`git show HEAD` 已核，不是本轮删的），设置页 18 个面板根节点挂着这个死类名——属既存死符号，留给 D 轮清账，不在本轮顺手改。

轮次 D 后续：D-b 书签导入单路线 → D-c 数据体检合流 → D-d Airtable 标签列映射 → D-e 手册重写（`manual-data.ts` 31 处旧称，其中一章被 `R63-15` 逐字钉住，改文案要连判据一起随迁）；孤儿 CSS 清账（`.pcp-btn.sm/.primary`、curio `.cz-add-*`）。
