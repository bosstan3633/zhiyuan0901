# 交付说明 · R102 Workspace 纯拆分第三批（卡片整理动作 → useWorkspaceBatch）

> 轮次 **R102** ｜ 版本 **V2.71.0** ｜ 2026-09-12 ｜ 纯重构轮（零行为变更、零模板改动、零数据模型改动）
> 任务书：04-51 ｜ 落点：新增 `v2/src/newtab/composables/useWorkspaceBatch.ts` · Workspace.vue（3349 → 3197 行）· regression.cjs（+1 断言、9 处重指）

## 一、拆分明细

批量选择核心 / 批量移动（跨台+级联分类+自动建「待分类」）/ 单卡移动 / 挂载到任务（R82）四子域整体迁入 `useWorkspaceBatch`，29 个标识符经解构保留宿主绑定（三视图勾选框、batch-bar、两个移动弹窗、挂载弹窗模板零改动）。

**勘验拦截的两处转写偏差（逐字原则的价值）**：
1. `selectedCards` 数据源是 `allResources`（含镜像卡的视图模型）而非 `d.resources`——首稿误写会**漏掉镜像卡的批量操作**，写 composable 时对照原实现拦下；
2. 模板引用 `mountTarget`/`moveOneTarget`（弹窗标题）——原为非响应式 let，composable 内转 ref 返回（可观察行为等价），R82-4/6 断言表达式串随之重指（`.value`/`persist()`）。

## 二、断言归位（9 处）

W7（moveWorkspaces）· R33-14（danger: false 随 batchOpen 迁出）· R61-5（批量删除拆 natives+mirrors）· R82-4/5/6/7（MOUNT_FN/MOUNT_PICKER 切片源 + mountedTaskCount）——实现细节重指 composable；入口/模板串留宿主。新增 `R102-1`★ 拆分不变量（活性验证：破坏宿主绑定 ⇒ 红）。

## 三、验收

| 项 | 结果 |
|---|---|
| 回归 | **988 通过 / 0 失败**（987 → 988；9 处重指） |
| `vue-tsc` | 0 错误 ｜ 构建：清 dist 重建通过 |
| 行为/模板/数据模型 | 三零（单向挂载红线在 composable 上继续成立：R82-4/5/6/7 全绿） |
| 文件 | Workspace.vue **3349 → 3197 行**（−152） |
| 版本 | 六处同步 → **V2.71.0** |

## 四、遗留

拆分第四批（镜像域，32 行断言纠缠）→ 第五批（分类树与拖拽）；P2 剩 6 项待拍板。
