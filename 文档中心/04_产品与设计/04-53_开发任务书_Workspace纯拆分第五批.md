# 04-53 · 开发任务书 · Workspace 纯拆分第五批·收缩版（分类 CRUD → useCategoryCrud · R104）

> 版本目标 **V2.73.0** ｜ 纯重构轮 ｜ 模式沿用 R100（04-49）｜ **拆分五批收官**

## 一、收缩决策（勘验后，边界诚实）

原第五批计划「分类树与拖拽」整域拆出。勘验结论：拖拽（onCatDrag*）与侧栏折叠/选择是**视图交互接线**，且与金字塔深度工具（pyDepthOf/pyHeightOf）、卡片拖拽状态（draggedItem）**双向咬合**——硬拆需先立「共享拖拽状态层」（另立项，登记 04-53 §四）。本批收缩为拆**分类 CRUD**：新建/重命名（同名即时校验 + 4 级上限校验）/删除（子分类提根 + 卡片回落 + 镜像记录与镜像分类级联清理）/置顶/存量重复合并（~116 行）。

## 二、边界

ctx = { d, persist, workspaceId, wsCats, activeCategory, allResources, **pyDepthOf, childCatsOf, catAggCount（宿主唯一实现注入，不复制）** }；MAX_CAT_LEVEL 自 catTree 工具 import（勘验修正：非 models 导出）。normalizeCatOrders 供宿主拖拽链路继续使用（解构绑定）。

## 三、验收

回归全绿（W3/R33-15/R33-15b/R53-10/R53-17/R74-11 六处重指 + R104-1 新增 + 活性验证）；vue-tsc 0；清 dist 构建；三零。
