# 知源工作台 · 项目长期备忘

## 项目概况
- 知源工作台 V3.x：Chrome MV3 扩展，接管新标签页，100% 本地（chrome.storage.local 单根 JSON `zy_data_v2`）。
- 技术栈：Vue 3.5 + TS(strict) + Pinia + Vite5 + @crxjs；搜索 pinyin-pro；代码位于 v2/。
- 质量门禁：`v2/scripts/regression.cjs`（静态断言，轮次递增，当前218项），交付前必须全绿 + vue-tsc 0 错误。

## 关键约定（务必遵守）
- 唯一版本号 = `v2/src/manifest.ts`，历史文档版本号忽略。
- 单向挂载红线：仅 TaskCard 持有 mounted*Ids；Resource/Curiosity/TagNode 禁止 taskId。
- 删除一律软删 deletedAt（回收站 `/recycle` 可恢复，任务恢复回填 taskIds）；stats.lastVisits 只经 recordResourceOpen。
- 拖拽排序列表的 computed 禁止 `.sort()`；样式只用 tokens.css 令牌（含 `--card-pad-*`/`--card-gap`/`--card-min-w` 密度令牌，`[data-density=compact]` 覆盖）；chrome.tabs.query 不含 hash（定位走 zy-where）。
- 新增功能须同步在 regression.cjs 追加检查项。
- 迭代按"轮次"记录（如第卅三轮=V3.1.0），regression.cjs 内有逐轮断言注释。
- 指标添加任务双模式走共享组件 `TaskAddDrawer.vue`（新建/关联），关联即转移归属（写 metricId + taskIds）。

## 当前状态（2026-09-01 第卅三轮交付）
- V3.1.0 已交付：REQ-015~026 全部落地（双标记体系、双模式任务添加、回收站、分类去重合并、模块分组平铺、密度档位），4 个真 Bug（BUG-A~D）修复。回归 218/218 全绿，vue-tsc 0 错误，dist 已重建。
- 提交链：`f6012f1`(批次1) → `abd99c5`(批次2) → `cf56b6c`(批次3) → `1ad10f7`(批次4) → `0b03c01`(批次5+收尾)。
- 交付说明：仓库根目录《知源工作台_V3.1_第卅三轮交付说明.md》。
- 主要技术债：巨型 SFC（Workspace 1700+行等8个）、静默 catch、防抖保存无异常处理、dist 残留双份 CSS、scripts/ 临时脚本过期。
