# Git 提交说明 · V2.21.3（第卌八轮）

> 生成时间 2026-09-04 ｜ 原因：`D:\zhiyuan0904\v2\v2` 无 `.git` 元数据、本机无 gh CLI、无 git 身份/凭据，无法就地提交。以下为**建议的提交内容与命令**，在已 clone `zhiyuan0901` 仓库、且 v2/v2 位于其工作树内的环境执行即可。

## 建议 commit message

```
V2.21.3 第卌八轮：详情页重设计 + 任务删除入口补全 + 工作台树折叠

Bug 修复：
- A-1 TDZ 诊断增强：runtimeError.ts 全局捕获，错误+stack 全文写 zy_event_log，设置页错误日志可导出（崩溃免 F12 现场）
- A-2 全局检索点A开B竞态修复：结果行按卡 id 寻址 + pinyin 就绪补跑冻结顺序仅追加

功能迭代：
- B-1 明细抽屉：滚动加载改每页 20 条左右翻页 + 搜索框过滤（stat/dyn 双抽屉）
- B-2 今日/本周增删双口径：importedAt 戳 + 「导Y」角标 + 明细「⇪ 导入」徽标（口径已拍板）
- B-3 任务删除入口全视图：看板卡 hover 🗑 + 详情 Footer ghost 降级删除（主操作唯一化）
- B-4 工作台目录树 Linear 化：节点 chevron 折叠 + 工具条收起/展开 + 默认全局展开
- B-5 三卡详情页重设计：detail-sheet.css 基建，CuriosityPanel/TaskDetailDrawer/ResourceEditForm 重构
  （Hero 唯一焦点 / 属性 chip 化 / 附属折叠 / 删除收进 ⋯；好奇心"保存链接"取消改失焦即存）

质量门禁：vue-tsc 0 ｜ regression 413/6（6=预知 v2/README.md ENOENT）｜ E2E 9/9 ｜ 循环 0
版本五处同步 V2.21.3；手册 4 处同步（树折叠/删除入口/详情新结构/双口径）
```

## 建议命令序列

```bash
# 1. 确认源码目录 = 仓库工作树（若 v2/v2 不在仓库内，先把改动复制进工作树对应路径）
cd <仓库根> && git status --short

# 2. 添加（只加源码与文档，勿加 dist / 交付包 / node_modules）
git add v2/v2/src v2/v2/scripts v2/v2/package.json docs 交付说明_第卌八轮_V2.21.3.md 需求盘点与开发清单_第卌八轮.md 2>/dev/null
# 若工作树结构不同，按实际路径调整上面 add 参数

# 3. 提交
git commit -m "V2.21.3 第卌八轮：详情页重设计 + 任务删除入口补全 + 工作台树折叠（详见交付说明）"

# 4. 打 tag 并推送
git tag v2.21.3
git push origin main
git push origin v2.21.3
```

## 备注

- **本机已有 git 凭据时**也可：`git init`（在 v2/v2）+ `git remote add origin <repo-url>` + 拉取远端历史后再提交——但本地无历史、无身份配置，直接 init 会丢远端历史，**不推荐**，优先在既有 clone 里执行。
- 交付说明全文：`交付说明_第卌八轮_V2.21.3.md`（仓库根与 docs/docs 各一份）；需求盘点：`docs/docs/需求盘点与开发清单_第卌八轮.md`。
