# 04-52 · 开发任务书 · Workspace 纯拆分第四批（镜像域 → useWorkspaceMirror · R103）

> 版本目标 **V2.72.0** ｜ 纯重构轮 ｜ 模式沿用 R100（04-49）

## 一、刀口

镜像域三段合一迁出（~90 行）：引用侧（isMirrorCat/moveMirrorTo/removeMirror/locateMirrorSource）· 推送侧（mirrorPushModal：单卡 📡 / 分类 📤 → confirmMirrorPush）· 拉取侧（mirrorCatModal → confirmMirrorCat）。

## 二、边界

ctx = { d, persist, workspaceId, categories, router, treeCatOptions }；底层 API（curationBoards/projectCardToBoard/mirrorCategoryToBoard/removeProjection/isMirrorView）直接 import 共享实现。treeCatOptions 以 ctx 注入（宿主唯一实现，R102 已确立）。

## 三、断言

本批断言纠缠最大（32 行引用镜像标识符）——逐条勘验后 **26 行自然存活**（模板零改动 + 解构绑定存续），仅 6 处实现检查重指（R51-15/R52-15/R62-11/R73-7/R74-8/R89-6）。新增 R103-1 拆分不变量（活性验证）。

## 四、验收

回归全绿；vue-tsc 0；清 dist 构建；行为/模板/数据模型三零。
