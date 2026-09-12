# 04-51 · 开发任务书 · Workspace 纯拆分第三批（卡片整理动作 → useWorkspaceBatch · R102）

> 版本目标 **V2.71.0** ｜ 纯重构轮 ｜ 模式沿用 R100/R101（04-49）

## 一、刀口

四子域合一迁出（原散布三处，~130 行）：批量选择核心（batchMode/selectedIds/全选/批量打开/批量删除含撤销）· 批量移动（跨台+级联分类）· 单卡移动 · **挂载到任务（R82，单向挂载红线随迁）**。

## 二、边界与勘验要点

- ctx = { d, persist, workspaceId, wsCats, **allResources**（批量选择数据源是含镜像卡的视图模型——勘验纠正：首稿误用 d.resources 会漏镜像卡，逐字原则拦截）, allProjects, sortedResources, openResourceLink, treeCatOptions（宿主保留，镜像域 hubCatOptions 也在用） }；
- **模板还引用两个非响应式 let**（mountTarget/moveOneTarget 的弹窗标题）⇒ composable 内以 ref 持有并返回（可观察行为等价：同一 tick 内渲染）；对应断言 R82-4/6 的表达式串重指；
- R82-4/5/6/7（MOUNT_FN/MOUNT_PICKER 切片）、W7（moveWorkspaces）、R33-14（danger: false）、R61-5（批量删除拆 natives+mirrors）按域归位。

## 三、验收

回归全绿（含 R102-1 拆分不变量 + 活性验证）；vue-tsc 0；清 dist 构建；行为/模板/数据模型三零；单向挂载红线断言在 composable 上继续成立。
