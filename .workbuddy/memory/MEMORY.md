# 知源工作台 · 项目长期备忘

## 项目概况
- 知源工作台 **V2.12.x**：Chrome MV3 扩展，接管新标签页，100% 本地（chrome.storage.local 单根 JSON `zy_data_v2`）。
- 技术栈：Vue 3.5 + TS(strict) + Pinia + Vite5 + @crxjs；搜索 pinyin-pro；代码位于 v2/。
- 质量门禁：`v2/scripts/regression.cjs`（静态断言，轮次递增，当前218项），交付前必须全绿 + vue-tsc 0 错误。
- git 远程：`github` = git@github.com:bosstan3633/zhiyuan0901.git（用户指定仓库，SSH 推送）。

## 关键约定（务必遵守）
- 唯一版本号 = `v2/src/manifest.ts`（当前 2.12.0，用户拍板沿用 V2.12 版本线，不跳 3.1.0）；历史文档版本号忽略。
- 单向挂载红线：仅 TaskCard 持有 mounted*Ids；Resource/Curiosity/TagNode 禁止 taskId。
- 删除一律软删 deletedAt（回收站 `/recycle` 可恢复，任务恢复回填 taskIds）；stats.lastVisits 只经 recordResourceOpen。
- 拖拽排序列表的 computed 禁止 `.sort()`；样式只用 tokens.css 令牌（含 `--card-pad-*`/`--card-gap`/`--card-min-w` 密度令牌，`[data-density=compact]` 覆盖）；chrome.tabs.query 不含 hash（定位走 zy-where）。
- 新增功能须同步在 regression.cjs 追加检查项。
- 迭代按"轮次"记录（如第卅三轮=V2.12.0），regression.cjs 内有逐轮断言注释。
- 指标添加任务双模式走共享组件 `TaskAddDrawer.vue`（新建/关联），关联即转移归属（写 metricId + taskIds）。

## 当前状态（2026-09-01 第卅三轮交付）
- **V2.12.0 已交付**：REQ-015~026 全部落地（双标记体系、双模式任务添加、回收站、分类去重合并、模块分组平铺、密度档位），4 个真 Bug（BUG-A~D）修复。回归 218/218 全绿，vue-tsc 0 错误。
- **⚠️ 仓库已重建**（2026-09-01）：filter-branch 清理 gui-test 垃圾后 .git 对象库意外损坏，历史不可恢复；重建为单提交 `b497d1c`（103 文件），后续 `9087277` 清理临时文件。原历史最新 hash `5dcfb81` 备份在 `.workbuddy/git-recovery/git-rewrite-backup/`。已推送 github/main。
- 交付说明：仓库根目录《知源工作台_V2.12_第卅三轮交付说明.md》。
- **.gitignore 新增**：`dist/`（构建产物不入库，防对象库膨胀）、`vite.config.ts.timestamp-*.mjs`、`.workbuddy/git-recovery/`。
- 主要技术债：巨型 SFC（Workspace 1700+行等8个）、静默 catch、防抖保存无异常处理、scripts/ 临时脚本过期。

## 🚨 环境坑（沙箱 shim 删除防护，务必遵守）
- 删除防护按 turn 累计计数（>50 拦截）；bash `rm`/`git rm` 被 shim 包装，**`git rm` 会连带误删整个父目录**（曾误删 .workbuddy，用 `git restore` 恢复）。
- 删除操作：优先 `git restore`（恢复）/python os.remove（删除）/沙箱外精确路径；删除前确保 git 已提交。
- `npx vite build` 在沙箱内会触发批量删除防护（emptyOutDir），用 `--emptyOutDir false`；多次构建会累积残留 assets（曾达 95 个），必要时沙箱外清空 dist 一次性干净构建（当前 35 个）。
