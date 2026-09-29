# 交付说明 · R2-①②③ —— 调度台 DeckTabs 三张卡 + 项目调度卡退役（纯 UI/结构轮 · 版本字面仍 V3.7.0）

日期：2026-09-29 · 基线：`4b7ca14`（R1.5 遗留收尾，未升版）· 触发：用户「按照你的建议推进后续开发」= 把本机接手时**已在脏树的 R2 WIP** 收尾到全绿并提交，而不是新起一轮。

> 本轮无版本字面变更（manifest/package/lock/helpers/ManualPage/README 全部未动），按 R176/R178/R1.5 的「纯 UI/结构轮换版留到发版轮」口径执行。

## 一、逐项落地明细

1. **R2-③ DeckTabs 三张卡**（CompassHome 底部区）：`bottomTab` 由双 tab 升三张卡 —— **资源卡池（默认第 1 枚）/ 任务调度（第 2）/ 好奇心培育（第 3，懒挂载 `curioMounted` 不变）**。锚点与快捷键同步扩：`hk/b` 参数新增 `res→pool`，`name==='curiosity'` 与 `task` 的自动切 tab 契约原样。新增面板 `components/compass/PoolCardsPanel.vue`（100 行，**本轮唯一新文件**）：数据口径 `workspaceId==='zy-curation' && !deletedAt`（隐藏池 id，R179 定案），搜索 + 网格（标题/置顶/🔗/📎/标签/日期）+ 单击走 `emitOpenDrawer({kind:'res'})` 开 App 级详情抽屉 + 软删带撤销。
   - **最小可用骨架，不是完整资源台**：控制行组件化、三视图渲染器（卡/列表/看板）、批量打标、新建单卡、本地导入 = R2 第二批收编，组件头注释与模板注释各留一处记账。
2. **R2-② 项目调度卡退役**（CompassHome **+73 / −589**，1635 → 1119 行）：整支右栏撤销 —— `.cur-crumb` 一行归属、`.cur-stats-v2` 一行四格 + `openCurDrill` 下钻弹窗、`spot-dual` 下半部定高两栏（描述｜子任务）、`.cur-groups` 指标组网格 + `metricGroups`/`collapsedGroups`/`curTreeOpen` 任务树、`.cur-split` 与 `startCurSplitDrag` 分栏拖拽、`#dispatch-split` 上下联动、`进入项目详情 ›` 与 `展开关联任务树` 双入口。
   - **能力去向**（不是删除功能）：指标结构管理与四事实指标 → 方向台展板 `ProjectCuration`（`pb-stats` 统计条 + `metric-sec` 逐指标块 + `task-rows` 任务行，E2E-20/25 覆盖）；执行细节 → 见 R2-①；「指标组任务树是全站唯一指标结构管理面」的 R169-16 偏离备案随迁到方向台侧。
3. **R2-① 三件事槽内子任务视口**（承接退役的右栏）：`SUB_VISIBLE_ROWS = 5` 定高（`max-height: calc(5 * 24px + 4px)`）+ 底部渐隐（`mask-image` 用 `var(--text)`，R120-10 零硬编码色联动）+「还有 N 项 · 进详情查看」**随滚动收敛**（`onSubScroll` 触底才收，`subScrolled` 按槽位记），勾选中 `toggleSlotSub` 落 `doneAt`（热力图/复盘「推进」维度按日归集依据不变）。槽内**零输入控件**——只勾选与进详情。

## 二、本轮修的两处真缺陷 + 门禁侧随迁

1. **★E2E-17 接手时是运行时崩溃**：脏树版本引用了已删除的局部变量 `drawer`（`ReferenceError`，`node scripts/e2e.cjs` 在该步直接抛）。改写为退役改验：调度台 `.csv-cell`/`.cur-stat-strip`/`.ts-title` 三样计数全零才算过，能力去向在文案里点名。
2. **★断言随迁 38 条重指 · 净零变化**（只增不减成立，计数仍 **1518**）：分片 20 共 20 条（R45-4/R45-5·R49/R45-7·R66/R45-8/R45-9/R50-4/R51-5/R51-F10/R52-7/R52-8/R54-7/R54-8/R55-1/R55-2/R55-4/R56-1/R56-2/R56-32/R57-4/R57-5）· 30 片 R65-7、R67-2 · 50 片 R91-2、R94-1~4 · 60 片 R105-1 · 80 片 R120-8、R120-10、R124-7、R125-4、R141-2、R142-2 · 99 片 R169-13~16。退役条一律「改验零残留 + 点名承接面」，不删判据本体。
   - R56-32 首版重指写成 `!e.includes('.cur-stats-v2 .csv-cell').nth`（对布尔取 `.nth`，恒真）——当场剥注释复核判据时抓住，改为 `!e.includes("csv-cell').nth")`：四格选择器在 e2e 里仍作为「零残留」计数存在，只有「点第 4 格下钻」这条动作链必须绝迹。
3. **★theme-audit 判据改靶 + 两条探针坑（写进注释防复发）**：原 R169-T4 项目调度 spotlight 随卡退役，改核 DeckTabs（三张卡 + 池默认激活 + 池面板在位）与 R2-① 槽内视口（可见行 ≤6 + 零编辑控件），截图改名 `${theme}-deck.png`，图数判据恒 4×(台面+浮层+抽屉+1 deck+7 仪表盘场景) = **64**。
   - **坑一**：同 hash 的 `page.goto` 不触发 SPA 重载，上一阶段留下的 tab 态会污染「默认档」判定 ⇒ 用真实点击 `.bt-tab` 第一枚复位（曾误判 `poolOn=false`）。
   - **坑二**：不可用 `page.reload` 复位——`zy_daily_stats` 快照只在 `saveData` 后 **45s 时间闸**或页面卸载补写时重建，播种的备份数据靠早期某次整库保存被 `flushCardEvents` diff 成 create 事件、经时间闸落进快照；reload 会连同模块内 pending timer 一起死掉，下游 dz-report 断源退化成「本期没有任何动作记录」零态（2026-09-29 实测断过一次，A/B stash + `/tmp` 扩展探针归因）。dz-report 前的动作段恢复原写法。

## 三、门禁（本轮真实跑出）

typecheck **0 错** · 回归 **1518/0** · E2E **25/0** · 导入兼容 **7/0** · 循环依赖 0 · build ✓ · 入口字面量双向 15 项全 0 · theme-audit **64 图 EXIT=0**（`docs/视觉归档/2026-09-29`）· theme-contrast 全绿（4 主题 × 14 项）· 代码索引一致（`gen-code-index.cjs` 重生成：**175 文件 / 42,644 行**，CompassHome 1635→1119 退出债务候选首位，PoolCardsPanel 新入册）。

## 四、有意边界与记账（如实）

1. **`UIPrefs.curSplit` / `spotSplit` 现为零消费方字段**（R2-② 退役后仅剩 models 声明与 `useCatSidebar.ts:93` 历史注释）。**本轮不删**：删字段动 UIPrefs 形状 → 牵导入导出/合并/迁移面，与 defaultWsId（纯 GS 控件，零落库）性质不同；发版轮或 R2 第二批统一清理（R55-2 重指文案已明记「字段与模型保留」）。
2. **`PoolCardsPanel` 只开单击开抽屉，不记「调出」事件**：`emitOpenDrawer` 的 `openFromId` 路径不 `recordCardOpen`，池卡调出量目前仍只在真实链接打开（`openLink`）时计数——热力图「调出」维度对池卡的覆盖待第二批与三视图一起收编。
3. **★池卡默认档首屏渲染量已实测（不是猜的隐患，也还没成缺陷）**：真库 `zhiyuan_backup_2026-09-26.json`（381 资源 / 活 260）注入后走扩展页量得——导航→池面板可见 **449ms**、DOM **3,050** 节点（视口内仅 380）、260 张池卡全量渲染、**longtask 0 次**；切到「任务调度」tab 因 `v-show` 常驻，DOM 仍 3,050（池卡一张不卸）+ 一次 115ms 长任务。**结论**：当前库容下不触 3 秒红线，本轮不加虚拟滚动；但 260→500 张是线性上涨，**第二批收编三视图时同批处理「上限/增量渲染」**（对照 R148-P1c 的判停口径：先量再动）。探针脚本在 `/tmp/zy_pool_perf.cjs`，不入库。
4. **R2 剩余清单**（本轮未动，按 R1.5 交付说明的口径续）：DeckTabs 第二批收编（控制行组件化 / 三视图 / 批量 / 池卡渲染上限）· `argCards` 回收站族与软删接入 · ⌘K 深链改靶（GlobalPopups:1267 注释自记账，依赖 R2 三张卡落地＝本轮已落，可开工）· 本地文件导入入口重落（R179 原位 parking）· 论点语义随论证卡迁移。
5. **ZIP 未重打包**：未升版轮按 R1.5 先例不跑 pack；上版 617,158B 超 600KB 预算 2,758B 的旧账仍在，本轮 −589 行源码理论上利于回落，发版轮实测为准。
6. **工作区里六件非本轮产物未提交**：`.workbuddy-ai/memory/2026-09-24.md`、`.workbuddy-ai/memory/2026-09-27.md`、`.zcodeignore`、`docs/任务总账_2026-09-24.md`（基线仍写 V3.4.0，已过时）、`docs/原型_知源仪表盘重构_热力图与复盘.html` 与 `docs/原型_调度热力图与复盘.html`（两份 R3 原型无版本号，已提交文档不按这两个名字引用它们；带版本号的 `docs/原型_知源仪表盘重构_R3_热力图与复盘.html` 在库内）。留待用户定夺，不代删。
