# 交付说明 · R101 Workspace 纯拆分第二批（下钻抽屉 → useCurationDrill）

> 轮次 **R101** ｜ 版本 **V2.70.0** ｜ 2026-09-12 ｜ 纯重构轮（零行为变更、零模板改动、零数据模型改动）
> 任务书：04-50 ｜ 落点：新增 `v2/src/newtab/composables/useCurationDrill.ts` · Workspace.vue（3370 → 3349 行）· regression.cjs（+1 断言、2 处重指）

## 一、拆分明细

- **下沉**：drillOpen / drillMode / openDrill + drillCatRows / drillNative / drillMirror / drillRecent（R71 惰性求值逐字随迁）→ `useCurationDrill`；
- **留宿主**：onDrillJumpCat / onDrillOpenCard / onDrillLocate（落点导航回调——写 activeCategory/viewMode/catFlashId、调 openResource/locateMirrorSource，是视图接线；拆走需注入 5 个额外视图态依赖，收益负，04-50 §一 登记）；
- ctx = `{ allResources, resBucket, catIdx, isUncat }`；isMirrorView 直接 import 共享实现；
- **勘验修正**：composable 调用点必须在 `catIdx`/`resBucket` 声明之后（const 无提升；R100 的 newCardCatId 是函数声明可提升，本批不适用）——TS2454 实测拦下，已后移调用点。

## 二、断言归位

| 断言 | 处置 |
|---|---|
| `R71-13`（惰性求值） | 重指 composable（`if (!drillOpen.value) return []` 随迁）+ 宿主绑定检查 |
| `R76-1`（isUncat 唯一实现） | `isUncat(` 计数改**跨宿主+composable 合计 ≥6**——下钻的一处调用随迁，唯一实现不变量保持 |
| `R101-1` ★ 新增 | 拆分不变量（状态数据在 composable + 宿主绑定 + onDrill* 留宿主 + 宿主零重复实现） |

其余 drill 断言（R62-6/R75-3/R75-5/R76 系模板串/R98-2）经勘验全部自然存活（模板零改动 + 解构绑定）。

## 三、验收

| 项 | 结果 |
|---|---|
| 回归 | **987 通过 / 0 失败**（986 → 987；2 处重指） |
| 活性验证 | 2 探针变红（惰性守卫破坏 → R71-13+R101-1 红；宿主绑定破坏 → R101-1 红）→ 还原回绿 |
| `vue-tsc` | 0 错误 |
| 构建 | 清 dist 后重建通过 |
| 行为/模板/数据模型 | 三零 |
| 文件 | Workspace.vue **3370 → 3349 行**（−21） |
| 版本 | 六处同步 → **V2.70.0** |

## 四、遗留

拆分第三批（批量管理）→ 第四批（镜像域）→ 第五批（分类树与拖拽），模式同 04-49；P2 剩 6 项待拍板。
