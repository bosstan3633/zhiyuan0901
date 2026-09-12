# 04-50 · 开发任务书 · Workspace 纯拆分第二批（下钻抽屉 → useCurationDrill · R101）

> 版本目标 **V2.70.0** ｜ 纯重构轮：零行为变更、零模板改动 ｜ 模式沿用 R100（04-49）

## 一、边界约定（勘验后定）

- **下沉**：drillOpen / drillMode / openDrill + 四份下钻数据（drillCatRows/drillNative/drillMirror/drillRecent，惰性求值随迁，R71-13）；
- **留宿主**：onDrillJumpCat / onDrillOpenCard / onDrillLocate——它们写 activeCategory/viewMode/catFlashId 并调用 openResource/locateMirrorSource，是**视图接线不是实现**（拆走需注入 5 个额外视图态依赖，收益负）；
- **ctx**：{ allResources, resBucket, catIdx, isUncat }；isMirrorView 直接 import 共享实现；
- **调用点位置**：composable 调用必须在 catIdx/resBucket 声明**之后**（const 无提升——R100 的 newCardCatId 是函数声明可提升，本批不适用，已实测修正）。

## 二、断言计划

R71-13 / R76-1 按域重指（R76-1 的 isUncat( 计数改跨宿主+composable 合计 ≥6，实现仍唯一）；新增 R101-1 拆分不变量（状态数据在 composable + 宿主绑定 + onDrill* 留宿主 + 宿主零重复实现），活性验证 2 探针。

## 三、验收

回归全绿；vue-tsc 0；清 dist 构建；行为/模板/数据模型三零。
