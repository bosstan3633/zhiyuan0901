---
created: 2026-08-28 21:52:09
updated: 2026-09-13 09:10:00
---
# 知源调度台（Zhiyuan Control Center）

> **知源 · 信息洪流中的控制中心——以好奇过滤信息，以调度致用于己，成就独一无二的自己。**
>
> AI 让"产出"变得前所未有的廉价，于是个人认知的真正瓶颈不再是"能不能创造"，而是"能不能把散落各处的产出，在正确的时刻重新调度回来"。

知源调度台是一套以人的认知主权为边界、以好奇心为探索起点、以源头资源为事实底盘、以六层思维链贯通方向与行动、并通过「项目」承接战略与日常的**个人增强系统**。它是一个 Chrome 浏览器扩展（MV3），接管新标签页，100% 本地运行。

**对外面向受众**：AI 重度使用的"独立深度研究者 / 咨询顾问"（也覆盖创作者、终身学习者）。**不面向**：已有完整 Notion/Obsidian 工作流且满意的人、换电脑无所谓反正有云同步的人。

**核心定位（April Dunford 视角）**：自造货架「信息洪流中的控制中心——AI 时代知识工作者的个人资源调度台」——不是书签插件、不是 PKM 笔记、不是新标签页美化。它不生产内容，而是横在所有 AI 工具、笔记、文件之上的**调度层**：经营你的认知周转率，让每一个被见过的信息都具备在正确时刻被召回的能力。

- **产品版本**：V2.81.0（第 113 轮迭代；版本号唯一来源 = `src/manifest.ts`，与 `package.json`、设置页关于（动态）、手册页、`regression.cjs` 版本锚、本文件版本行共 **6 处**同步——本行自 R96 起纳入回归断言把守）
- **技术栈**：Vue 3.5 + TypeScript(strict) + Vite 5 + Pinia + @crxjs（MV3）+ UnoCSS（仅引入）
- **运行环境**：Chromium 内核浏览器（Chrome / Edge / Brave 等）
- **数据存储**：100% 本地——主数据 `chrome.storage.local` 单根 JSON（unlimitedStorage，无 10MB 上限）+ **附件二进制 IndexedDB 库 `zy_assets`**（单文件 ≤20MB，主 JSON 绝不存 base64）；无云端、无账号
- **质量门禁**：`vue-tsc` 0 错误 + `scripts/regression.cjs` 静态断言 **当前轮全绿**（交付前缺一不可）

> **品牌隔离提醒**：本产品的目标用户是知识工作者，与作者个人的"高考志愿规划师"IP 是两个独立受众体系——前者用本账号运营，后者用独立账号/笔名，否则互相污染定位。

---

## 目录

- [〇、AI 智能体交接须知（新开发者必读）](#〇ai-智能体交接须知新开发者必读)
- [一、产品理念](#一产品理念)
- [二、技术栈与架构](#二技术栈与架构)
- [三、目录结构](#三目录结构)
- [四、快速开始](#四快速开始)
- [五、页面架构](#五页面架构)
- [六、核心数据模型](#六核心数据模型)
- [七、快捷键一览](#七快捷键一览)
- [八、主题系统](#八主题系统)
- [九、导入导出与数据迁移](#九导入导出与数据迁移)
- [十、开发规范与回归基线](#十开发规范与回归基线)
- [十一、版本历史](#十一版本历史)
- [十二、文档导航](#十二文档导航)
- [十三、常见问题](#十三常见问题)

---

## 〇、AI 智能体交接须知（新开发者必读）

本仓库的定位是：**换一个环境、由任意智能体接手后，仅凭本仓库即可继续迭代**。请按以下顺序建立上下文：

1. 通读本 README（尤其本节约与第十节）；
2. 读 `../docs/技术架构与数据模型.md` 获取数据层全貌（R96 已全量勘验回正）；
3. 读 `../docs/开发指南与回归验证.md` 获取历史踩坑记录；
4. 读 `../docs/项目盘点报告_2026-08-31.md` 与根目录《知源调度台_产品认知基线》了解技术债与产品现状；
5. 最新一轮做了什么，见 `../docs/` 下编号最大的 `交付说明_R*.md`。

**必须遵守的硬性规则：**

| # | 规则 | 说明 |
|---|------|------|
| 1 | 版本号唯一来源 = `src/manifest.ts` | 改版本必须同步 `package.json`、设置页关于（动态）、手册页、`regression.cjs` 版本锚、本文件版本行共 **6 处**（R96 起本文件纳入门禁） |
| 2 | 单向挂载红线 | 仅 TaskCard 持有 `mountedResourceIds/mountedCuriosityIds`；Resource/Curiosity/TagNode Schema **禁止出现 taskId** |
| 3 | 删除一律软删 | 任何删除只写 `deletedAt`，可进回收站恢复；`stats.lastVisits` 只经 `recordResourceOpen` 更新 |
| 4 | 排序 computed 禁止 `.sort()` | 支持拖拽排序的列表，其渲染 computed 不得原地 sort，否则拖拽错乱 |
| 5 | 样式只用 tokens.css 令牌 | 禁止硬编码色值；新增 UI 须在六主题下逐一走查 |
| 6 | 定位不走 tabs.query 的 hash | chrome.tabs.query 返回不含 hash，页面内定位走 zy-where 询问链路 |
| 7 | 新增功能同步追加回归 | 每轮新功能必须在 `scripts/regression.cjs` 追加断言项，交付前全绿 |
| 8 | 构建前清空 dist | vite 配置 `emptyOutDir:false`，不清理会累积多轮构建残留 |
| 9 | 迭代按轮次记录 | 每完成一轮在 `../docs/` 落一份交付说明，并在 regression.cjs 轮次注释更新 |
| 10 | 动工前先勘验 | 收尾给出的「剩余项/进度」结论，下一轮动工前必须先证伪一遍（R95 教训：G7 坏账；书面口径与代码实装不一致=坏账） |

---

## 一、产品理念

### 1.1 核心定位

知源调度台不是书签管理器，不是待办清单，也不是笔记软件。它是 **AI 时代的资源调度层与认知控制塔**：AI 是被调度的工具，人才是判断与行动的主体。

**核心主张**：从好奇出发，向源头求证
**功能价值**：收得进、看得见、找得到、信得过、带得走

### 1.2 三张核心卡片

| 卡片类型 | 用途 | 关键字段 |
|---------|------|---------|
| **资源卡** | 收藏的网页、本地文件、Obsidian 笔记 | 标题、链接（URL/本地路径/obsidian://）、分类（≤4 级树）、标签、描述、注解、自定义字段、附件、调用计数 |
| **任务卡** | 可执行的行动项，挂载在项目→成功指标下 | 标题、所属项目+指标（双挂）、优先级、状态、链接、备注、标签、关联资源/好奇心（单向挂载） |
| **好奇心卡** | 一闪而过的疑问和灵感 | 问题内容、状态（待探索/探索中/已求证/已搁置）、来源链接+来源标题、标签 |

两类卡片均可 **置顶（pinned）** 或 **星标（starred）**，排序权重：置顶 > 星标 > 命中度。

### 1.3 六层思维链

```
愿景（Why）→ 使命（How）→ 战略目标 → 攻坚项目 → 成功指标 → 任务
```

知源引擎·方向树的核心结构，每一层都可原位编辑、可增删。任务卡挂载于成功指标（未挂指标即「未归档任务」，北极星下钻可级联归档）。愿景/使命/战略目标/项目四层均有 📡「投射至灯塔」开关，控制知源罗盘展示（**仅项目层参与灯塔投射**）。

### 1.4 设计铁律

> **美是知源调度台的核心生产力。**

- 视觉基准为 **Linear 结构语言**（近黑画布、发丝线、克制装饰、键盘优先），规范见 `../docs/设计规范_Linear.md`
- 所有组件只用 tokens.css 语义令牌，禁止硬编码色值
- 六套主题下均需保证文本可读、色彩搭配合理（新界面逐一走查）
- **交互三戒**：原生 prompt/confirm 全面禁用；路由切换零动画；删除可撤销

---

## 二、技术栈与架构

### 2.1 技术选型

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3.5 (Composition API, `<script setup>`) | 响应式 UI |
| 语言 | TypeScript (strict) | 类型安全，交付前 `vue-tsc` 0 错误 |
| 构建 | Vite 5 + @crxjs/vite-plugin | HMR + MV3 打包 |
| 状态管理 | Pinia | `useAppStore` 单一数据仓 + `useCompass`/`useCuriosity` |
| 路由 | Vue Router (hash mode) | 新标签页内路由 |
| 样式 | 原生 CSS Variables（tokens.css）+ scoped CSS | 六主题语义令牌；`data-density` 三档密度 |
| 存储 | chrome.storage.local 单根 JSON（主数据）+ IndexedDB `zy_assets`（附件二进制，单文件 ≤20MB） | 300ms 防抖合并写；主 JSON 绝不存 base64 |
| 搜索 | pinyin-pro | 全拼/首字母命中中文标题 |
| 扩展规范 | Manifest V3 | Service Worker + Content Script（纯 Vanilla JS，不引入 Vue 运行时） |

### 2.2 扩展架构

```
┌──────────────────────────────────────────────────────────┐
│                       Chrome Browser                      │
├───────────┬──────────────┬──────────────┬────────────────┤
│ New Tab   │ Content      │ Service      │ Popup          │
│ Page      │ Script       │ Worker       │ （chrome:// 等 │
│ （主应用： │ （任意网页注入 │ （命令监听、  │  不可注入页的   │
│  知源罗盘/ │  搜索/采集/   │  浮层注入、   │  降级弹窗）     │
│  工作台/   │  好奇浮层，  │  单例定位、   │                │
│  设置/     │  Shadow DOM） │  消息中转）   │                │
│  回收站）  │              │              │                │
├───────────┴──────────────┴──────────────┴────────────────┤
│        chrome.storage.local（zy_data_v2 / zy_ui_v2 等）    │
│                  100% 本地，无云端、无账号                   │
└──────────────────────────────────────────────────────────┘
```

- **Content Script** 纯 Vanilla JS：搜索/采集/好奇三浮层，1.5s 内存数据缓存 + storage.onChanged 失效同步
- **Service Worker**：快捷键命令、浮层注入决策（zy-ping 探测）、工作台单例定位（zy-where 询问链路，绕过 tabs.query 不含 hash 的限制）、通用路由跳转
- **新标签页**：Vue 主应用；每次打开/刷新固定回知源罗盘（`/settings`、`/manual`、`/recycle` 深链保留）

---

## 三、目录结构

```
v2/
├── src/
│   ├── manifest.ts                    # MV3 清单（命令/权限/新标签页接管）★版本号唯一来源
│   ├── background/index.ts            # SW：命令监听/浮层注入/单例定位/路由中转
│   ├── content/                       # 网页浮层（Shadow DOM，Vanilla JS）
│   │   ├── search-overlay.ts          #   入口装载（动态 import 实现层）
│   │   ├── overlay-impl.ts            #   搜索/快速采集/好奇/任务采集 四浮层实现
│   │   └── selection.ts               #   选区预填
│   ├── popup/                         # 降级独立弹窗（chrome:// 页场景）
│   ├── shared/
│   │   ├── models/index.ts            # 全部 TS 类型（唯一数据规范来源）
│   │   ├── storage/                   # repository（防抖持久化）/ defaults / migration / assets
│   │   │                              # stats（recordResourceOpen 统一入口）/ hub / airtable（单向同步）
│   │   ├── utils/                     # uid/dateKey/normalizeUrl/fields/pinyin/link/marksort
│   │   │                              # assetKind（附件三档）/cardCols（列数）/wsView（台视图）/bus（zy-open-drawer）
│   │   ├── components/                # Toast/Drawer/ConfirmDialog/ContextMenu/TagPicker/AssetBadge/ColsPicker…
│   │   └── styles/tokens.css          # 六主题语义令牌 + 三档密度 + 全局排版
│   └── newtab/
│       ├── main.ts                    # 引导：并行加载→store.init→挂载→固定回调度台（应用 data-density）
│       ├── router.ts                  # / 、/compass(projects|tree)、/workspace/:id、/curation(redirect)
│       │                              # /settings、/manual、/recycle
│       ├── App.vue                    # 顶栏导航/主题/全局快捷键/错误边界/zy-*消息监听
│       ├── manual-data.ts letter-data.ts  # 手册与一封信内容（外置数据源）
│       ├── composables/               # 五个域级组合式（R100-R104 拆分）：useWorkspaceImport / useCurationDrill /
│       │                              # useWorkspaceBatch / useWorkspaceMirror / useCategoryCrud
│       ├── stores/                    # app / compass / curiosity
│       ├── components/                # GlobalPopups（应用内浮层）/ ResourceDetailDrawer / TaskDetailDrawer
│       │                              # TaskAddDrawer / compass 面板（LighthousePanel/NorthStarPanel/
│       │                              # CuriosityPanel/TaskManagerPanel/MetricBar/MetricDrillDrawer）
│       └── views/                     # CompassHome（调度台）/ CompassShell（方向台）/ CompassTree
│                                      # ProjectCuration / Workspace（资源台+策展台合一，isHub 分支）
│                                      # GlobalSettings / FieldEditor / ManualPage / RecycleBin
├── scripts/                           # regression.cjs 静态断言矩阵（当前轮全绿）+ e2e.cjs + perf.cjs A/B 基准
│                                      # perf-longtask / check-cycles / test-import-compat 等
├── public/ dist/                      # 静态资源 / 构建产物（可直接加载，dist 不入库）
└── vite.config.ts tsconfig*.json uno.config.ts package.json
```

---

## 四、快速开始

### 4.1 环境要求

- Node.js ≥ 18（建议 20+）
- 首次接手：`cd v2 && npm install`（node_modules 不入库，必须自行还原）

### 4.2 安装与开发

```bash
cd v2
npm install          # 按 package-lock.json 还原依赖
npm run dev          # 开发模式（HMR 输出到 dist/）
npm run build        # vue-tsc --noEmit 类型检查 + vite build（交付必须两者通过）
npm run typecheck    # 仅类型检查
node scripts/regression.cjs   # 静态回归：必须全绿（当前 974 项，只增不减）
```

### 4.3 加载到浏览器

1. 打开 `chrome://extensions/`，右上角开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `v2/dist/` 目录
3. 打开新标签页即可看到知源调度台
4. **改代码后必须在扩展详情页点「重新加载」+ 刷新新标签页**
5. 双击打开本地文件需在扩展详情页开启「允许访问文件网址」

### 4.4 构建注意

- `vite.config.ts` 使用 `emptyOutDir:false`，**交付前必须先清空 `v2/dist/` 再构建**，否则累积历史残留文件
- 构建产物与源码同名图标均按真实尺寸生成（16~512px），勿用单张大图复制占位

---

## 五、页面架构

| 页面 | 路由 | 说明 |
|------|------|------|
| 调度台（默认首页） | `/` | 方向状态四指标（战略目标·推进项目 / WCE / WRR / 未归档，日·周·累计三档可下钻）+ 今日三件事（≤3 槽）+ 项目调度（任务树默认折叠，R94）+ 好奇心培育 + 今日记录。刷新固定回此 |
| 方向台 | `/compass` | 主航线（LighthousePanel：愿景/使命锚点条+目标卡+主攻聚焦条，看主线）+ 项目总览（管项目，>12 项目启用搜索/状态筛选）+ 任务调度（全域任务管理三视图） |
| 项目详情 | `/compass/projects` | 单项目全屏展板（指标→任务树、目录树双列、指标下钻抽屉） |
| 完整方向树 | `/compass/tree` | 六层思维链全展开、全节点原位编辑、关联卡片、停滞检测 |
| 资源台 | `/workspace/zy-curation`（`/curation` redirect 而来） | 资源卡**唯一真身居所与镜像源头**：分类树（≤4 级）+ 卡片/列表/看板三视图 + 排序/筛选/搜索（`#标签` 直筛）+ 批量管理 + 📥 导入资源（书签 HTML / 本地文件一文件一卡）+ 指标条 3 格 |
| 策展台 ×N | `/workspace/:id` | 金字塔居中树（层级折叠 仅 L2/到 L3/全部，R98）+ 节点双入口 + 镜像引用（只读三件套）+ 中心论点（已设论点默认金字塔视图）+ 混排 + 指标条 3 格（更新时间在页头摘要，R98） |
| 设置中心 | `/settings` | 字段设计编辑器、标签管理（3 级树）、导入导出（全量/工作台/Markdown/CSV）、Airtable 单向同步、快捷键中心、密度、主题、手册入口、重置回滚；支持 `?page=<key>` 深链 |
| 回收站 | `/recycle` | 资源/任务/好奇心三类卡软删集中管理：列表、恢复、永久删除（清附件）、分区清空 |
| 使用手册 | `/manual` | 五篇富文本独立页，可下载分享版 HTML |

全局调度层横切所有页面：搜索/采集/好奇/任务采集浮层（网页端 Shadow DOM + 应用内组件双实现，行为一致）；`Ctrl+K` 任意网页三秒召回。

---

## 六、核心数据模型

完整定义见 `src/shared/models/index.ts`（唯一数据规范来源）。

- **存储键**：`zy_data_v2`（AppData 单根 JSON）/ `zy_ui_v2`（UI 偏好）/ `zy_capture_pref`（采集偏好）/ `zy_event_log`（事件日志）/ IndexedDB `zy_assets`（附件 Blob）；V1 旧数据 `lm_data_v5` 检测到自动迁移并备份
- **AppData**：compass（vision/mission + directions→projects→metrics）/ workspaces（含资源台真身 hub，对外 getter 排除）/ categories（parentId ≤4 级树）/ resources / tasks / curiosities / **curationProjections**（策展台镜像记录）/ dailyFocus / tagTree（3 级）/ fieldConfig / stats / activityLogs / **airtableSync**（单向同步配置，导出/备份时剥离）
- **UIPrefs**：主题、密度（compact/cozy）、sortPrefs（三视图排序）、**cardCols**（R72 列数偏好）、**wsViewMode**（R84 台视图记忆）、快捷键自定义、抽屉宽度/文本框高度记忆等，存 `zy_ui_v2`
- **双标记体系**：`pinned`（置顶）+ `starred`（星标），排序统一走 `utils/marksort.ts`，权重 置顶 > 星标 > 命中度
- **单向挂载红线**：只有 TaskCard 持有 `mountedResourceIds/mountedCuriosityIds`；Resource/Curiosity/TagNode Schema **禁止出现 taskId**；愿景/使命 `linked*` 为持有方引用
- **软删除体系**：删除一律 `deletedAt`，回收站单条恢复，可清空
- **数据自愈**：loadData 对非数组 tags 等脏数据统一归一化；渲染层过滤残缺节点 + 全局错误边界双防线

---

## 七、快捷键一览

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `Ctrl+Shift+K` | 打开工作台（已有标签页聚焦回归，不重复开） | 系统级（chrome.commands，可自定义） |
| `Ctrl+Shift+J` | 快速采集资源卡（自动预填标题+URL+选中文本） | 系统级 |
| `Ctrl+Shift+I` | 好奇心采集（选中文本自动填入并附带来源） | 系统级 |
| `Ctrl+K` | 全局搜索（分组/高亮/拼音首字母/快捷操作；`#标签` 交集直筛、`@项目` 收窄——与应用内同口径，R97） | 系统级 |
| `（可分配）` | 打开全局设置（第卅五轮新增命令项，默认未绑定键，在 `chrome://extensions/shortcuts` 手动分配） | 系统级（chrome.commands） |
| 修饰键+1 | 方向台（修饰键五选：Alt 默认/Ctrl/Ctrl+Shift/Alt+Shift/纯数字；R68 改造后 1=方向台 / 2=资源台 / 3…=各策展台） | 新标签页内 |
| 修饰键+4 / 可分配 | 任务调度模块直达等（设置→快捷键设置逐个自定义，冲突自动清除） | 新标签页内 |
| `Ctrl+Enter` | 保存并关闭（所有编辑弹窗/抽屉，document 级监听） | 新标签页内 |
| `Esc` | 逐层关闭（浮层→抽屉→展板）；浮层内两段式：有内容先清空，空再关闭；**document 级兜底——焦点任意处 Esc 生效（R97），采集/好奇/任务采集表单浮层同样响应** | 全局 |
| `?` | 快捷键速查面板 | 新标签页内 |
| `↑↓/Enter/空格` | 任务列表键盘导航（选中/开抽屉/批量勾选） | 任务列表 |
| `Ctrl+←/→` | 切换今日三件事日期 | 今日行动 |

> 系统级快捷键中带默认键的 4 个已占满（Chrome suggested_key 上限 4），但命令**数量不限**——第卅五轮新增第 6 个命令「打开全局设置」（无默认键），在 `chrome://extensions/shortcuts` 找到「打开全局设置（未设置）」点击分配即可。

---

## 八、主题系统

六套主题经 `data-theme` 属性切换（tokens.css 全量语义令牌），默认 **深空薰衣草**（Linear 近黑画布）；另有 `data-density` 三档密度（紧凑/舒适/宽敞）：

| id | 名称 | 说明 |
|---|---|---|
| linear | 深空薰衣草 | 默认；近黑画布 #010102 + 表面阶梯 + 薰衣草蓝 #5E6AD2 |
| green | 原野绿 | Linear 结构绿调变体 |
| night | 暗夜红 | 深色高对比 |
| apple | 极简白 | 浅色反相阶梯 |
| raycast | 光速黑 | 深色 |
| notion | 纸墨白 | 暖白纸面 |

- 新增 UI 必须只用令牌（`--bg/--surface*/--border/--text*/--accent*/--radius*/--shadow*` 等），禁止硬编码色值
- 每个新界面必须在六主题下逐一走查（重点：深色下禁止白底白字、浅色块突兀）
- 圆角体系 12/8/6；阴影弱化为「1px 边框 + 深投影」；Inter + 系统中文字体；tabular-nums 全局

---

## 九、导入导出与数据迁移

| 方向 | 方式 | 说明 |
|------|------|------|
| 导入 | 数据包 JSON | 并集合并（同 ID 更新，不同 ID 新增）；导入前自动备份（剥离 `airtableSync`） |
| 导入 | 书签 HTML | 浏览器导出的书签文件（资源台「📥 导入资源」） |
| 导入 | 本地文件 | **一文件一张附件卡**（图片/HTML/PDF 同规则，R80；附件进 IndexedDB，不支持类型跳过并汇总提示） |
| 导出 | JSON 全量 / 指定工作台 JSON / Markdown / 按工作台 CSV | 全量导出并入 `uiPrefs` 界面偏好包（含 cardCols/wsViewMode）；**剥离 `airtableSync` 令牌**（R70，令牌不出包）；CSV 含 UTF-8 BOM |
| 同步 | Airtable 单向推送 | 设置→Airtable 同步，用户自备 Token 手动触发；知源→用户自己的 Base，**绝不回写本地** |
| 迁移 | V1 → V2 | 检测到 `lm_data_v5` 自动迁移并备份为 `lm_data_v5_backup`；已迁移用户跳过检测 |
| 重置 | 一键回滚 | 输入「回滚」确认后恢复初始状态 |

---

## 十、开发规范与回归基线

- **交付前置**：`npm run build` 全绿（vue-tsc 0 错误）+ `node scripts/regression.cjs` **全绿**（当前 974 项，每轮只增不减），缺一不可（回归是字符串断言，代替不了编译检查）
- **性能门禁**：`scripts/perf.cjs` A/B 基准台——视图切换 <40ms 红线（R71 起）；新功能默认须过性能走查
- **数据红线**：Resource/Curiosity/TagNode 禁止 taskId；删除一律软删；stats.lastVisits 只走 recordResourceOpen
- **标记排序**：一律走 `utils/marksort.ts`（置顶 > 星标 > 命中度），拖拽排序列表的渲染 computed 禁止 `.sort()`
- **样式**：只用 tokens.css 语义令牌；scoped 样式无法作用到子组件内部（子组件自带样式）；v-html 内容的样式必须非 scoped
- **已知地雷**：chrome.tabs.query 不含 hash（定位走 zy-where 询问）、chrome.commands 上限 4、content script 纯 Vanilla 就地复制工具函数、工作台 name 含 icon 前缀、构建前须清空 dist
- **新增功能时在 `v2/scripts/regression.cjs` 同步追加检查项**，并更新轮次注释

---

## 十一、版本历史

| 版本 | 轮次 | 要点 |
|------|------|------|
| V2.81.0 | 第 113 轮（当前） | **生产反馈第三批 · 六项需求**（04-60）：① N3 周报点击无反应 P0 修复（根因=模板引用未 import，Vue 静默渲染空节点）+ **孤儿组件全量护栏**入回归；② N4 导入金字塔模板提到一级工具条；③ N6 任务选取弹框按项目筛选（CompassHome picker + TaskAddDrawer 双处）；④ N1 分类树 hover 图标 5→2 收敛（⋯ 溢出菜单）+ 树宽拖拽（160~420px，UIPrefs.wsSideW 持久化）；⑤ N2 生命周期入口收敛到 设置→总览（三宿主移除）+ 面板内嵌化（实体切换+三态下钻+跨台定位）+ **T9 snooze 改独立 snoozedUntil 字段**（不再污染 lastCalledAt/热度统计）；⑥ N5 金字塔真全屏：宿主上移 .ws-page + overlayHost 动态浮层宿主（8 处 Teleport 改造）+ :fullscreen 保留工具条。回归 1048→**1057**，E2E 20→**22**（含真全屏交互） |
| V2.80.0 | 第 112 轮 | **结构性技术债专项 · 第一批性能治理**（04-59 立项，Q1 拍板「立即开」）。归因先行：CDP CPU profile 定位到热点不是算法而是 **「渲染规模 × 响应式读取次数」**——Vue `track()` 占搜索窗口 20.7%、切台 10.1%，叠加模板内逐卡调用 `mountedTaskCount(r)`（O(任务数) 反向全表扫描，每卡 2 次）。① **增量渲染**：资源台/策展台按 `RENDER_STEP=80` 分批挂载 + 底部「显示更多」（滚到底自动续），把一次性 400 卡 DOM 降到 80，换台/换视图/换分类/改检索/改排序时回落；② **反查缓存**：`mountedTaskCount` 改为按任务集惰性构建 `Map<resId, count>`，O(1) 命中；③ **日期格式化记忆化**：`fieldValue` 的 `createdAt` 分支走 `fmtDateCN` 缓存（原本逐卡构造 `Intl`/`toLocaleDateString`）；④ **家族过滤改 Set.has**：`O(卡数×家族)` → `O(卡数)`；⑤ **切台零重算**：`workspaceId` 在离开 `/workspace` 时保持上一个台 id，避免 KeepAlive 缓存组件在隐藏期间被根依赖触发全量重算（切回再算一遍）；⑥ **切台热度落盘节流**：4s 合并 + 页面隐藏/卸载补写（原实现每次切台立即 `persist()` 整树 JSON 序列化）；⑦ **冷启动单次读取**：`ensureBootData` 会话内幂等 + 首次 raw 快照复用给 `loadData`（原 STORAGE_KEY 被串行读 3 次）+ **perf 门禁漂移修复**（`tab-overflow` 溢出指示误命中致策展台切台打满 15s 超时被误读为「慢」）。**实测 medium 档（4 次采样中位）**：切资源台 1865→**196ms**、搜索键入 2842→**151ms**、左树重渲染 1708→**114ms**、冷启动 1831→**1275ms**、长任务 95s/243 次→**20.0s/152 次**；回归 1035→**1048**，vue-tsc 0，E2E 20/0 |
| V2.79.0 | 第 110+111 轮（合并交付） | **R110 作废并入 R111**：① **资源生命周期 LC**——`lifecycle.ts` 三态引擎（活跃/冷却/归档，阈值固定 30/90 天 + 新卡 14 天宽限，三卡泛化，策展台镜像跟随源卡）+ `LifecyclePanel.vue`（甜甜圈三态可点击下钻 + 归档/忽略30d/恢复 + 点击条目定位）+ 三宿主入口（资源台工具条 ⏳ / 好奇心 / 任务调度的「⏳」）+ T3 归档集成（默认视图排除归档卡 + 三处降级提示 + **全局搜索排除归档并按同口径报数**）；② **BUG-1** 资源台「⚠ 镜像 N 条待清理」脏数据——`scrubHubMirrorMarkers` 启动期幂等净化（剥离误持久化的 `__mirrorProjId`/`__mirrorCat` + 清 targetWsId 指向资源台的投射）+ `curationMetrics` 对 hub 台镜像恒 0 兜底 + 提示格回退结构口径；③ **BUG-2** 附件明细**点击行 = 定位来源卡**（本台高亮 / 跨台 `?hl`）——修「点击不跳卡」主诉；行三态（ok/missing/orphan）+ 孤儿附件单条 🗑 与顶部「🧹 清理全部孤儿」批量入口（复用 REQ-048 `cleanupOrphanAssets` 语义，**保留回收站软删卡的附件**）；④ **FS 金字塔全屏**（路线 A 元素级 `requestFullscreen` + 浏览器原生 ESC；路线 B fixed 覆盖层自动降级 + 显式退出按钮）；⑤ **WR 调度画像周报**收尾（四段式引擎纯读取零写入 + 全屏浮层 + 页头入口 + 全数字下钻）。**关键设计修正**：生命周期面板改为「面板只发意图、宿主对真实卡对象落库」（传映射副本会致归档写空）。`CardBase.lifecycleArchived` 为可选字段——**零迁移**；回归 1012→**1035**（R111×8 + R110×15），vue-tsc 0，E2E 9/0 |
| V2.65.0 | 第 96 轮 | P2 首轮勘验对账与坏账清偿（资源台组 R9/R11/R12 全部为坏账：R9 随 R89、R11 随 R70/stats.ts 统一入口、R12 自第卅三轮即交付）+ 文档失真修复（本 README 版本行与页面架构回正 + 架构文档「无 IndexedDB」等 V2.1 时代表述全量勘验回正；两处均纳入回归断言把守）+ 版本同步点 5→6 处（本 README 纳入门禁）+ 04-20 P2 面 17 项真待开发对账；**零业务代码改动、零数据模型改动、零迁移**；回归 971→974 |
| V2.20.0 | 第卌五轮 | 任务管理整体迁移「资源罗盘→我的好奇心」专区 Tab（CompassHome 双 Tab 带数量徽标、我的好奇心默认；新建 TaskManagerPanel **卡片视图默认**+批量/分组/排序/拖拽/键盘/右键全量能力保留 + 共享 TaskDetailDrawer 抽屉双宿主）+ 今日行动「项目策展」面板（左列项目名+愿景/使命只读小卡+战略目标放大+四数值；右列按成功指标分组+新建/关联；三件事单击联动/双击详情/删除重选/呼吸灯）+ 北极星周期改「日/周/累计」三档联动（下排改名「新增卡片/删除卡片」）+ 工作台页头今日新增/今日删除 + 资源引擎角标彻底移除；回归 381→395 项 + E2E 8/0 |
| V2.20.1 | 第卌六轮 | BUG-1 好奇心专区 Tab 同屏修复（CuriosityPanel 多根组件 v-show 失效 → ContextMenu 移入 ModuleCard 单根化；E2E 互斥验证）+ 改名「好奇心卡库｜任务卡库」+ BUG-2 关联任务漏写 projectId 断链修复（TaskAddDrawer linkTasks 补写 + app.ts init 存量幂等回填 + AppData.projBackfillFixed 记录 + 设置页数据组展示）+ BUG-3 仪表盘下钻修复（statDrawerTitle 补 .value 撤 [object Object]；明细撤 300 硬截断改 200 分批加载更多 + 分类型图标徽标 + 单击行路由 hl 定位）+ OPT-1 三件事卡复选框并入标题行/移除 × 移至编号左侧 + 呼吸灯 18% 光晕边框脉动（选中/完成态常亮）；回归 395→405 项 + E2E 9/0 |
| V2.19.0 | 第卌四轮 | 北极星 2×3 重构（下排=今日新增/今日删除卡实时派生 + 未归档双校验 projectById/taskArchiveIssue，撤模块分组/链接卡片及 wsPopup 死样式）+ 知源仪表盘默认首屏（核心指标 5 卡下钻 + 动态条三段点击抽屉 + 操作记录时间线三维筛选 + CSV 按筛选导出 UTF-8 BOM）+ 工作台全景双栏 Master-Detail（三级计数树默认全展开 + 拖拽/按钮移动双通道）+ 事件日志 zy_event_log（repository 快照 diff 全覆盖 + 5000 滚动）+ PDF 附件（kind=pdf/100MB/单卡唯一替换/file:// Chrome viewer/四宿主泛化）+ 设置页导航五组（总览/整理/卡片与字段/数据/系统，标签管理上移）；回归 367→381 项 + E2E 6/0 |
| V2.18.1 | 第卌三轮 | 补丁版 6 项：BUG-1 新建任务 Ctrl+Enter 保存列表不刷新（openTaskSidebar 持原始对象绕 reactive Proxy set trap，修复=find 取 store Proxy 引用，真机 E2E 复现→修复闭环 3/3）+ BUG-2 批量模式双复选框（.mgr-body.batch 隐藏 check-sm）+ R-1 任务行 hover 🗑 删除 + R-2 工具栏「N 条/全部 M」总数双值 + R-3 今日三件事卡片紧凑化（去 min-height）+ R-4/R-5 北极星未归档 N/M（3/128）与周/月/累计严格周期联动（DHI 在轨窗口=14/30/全量、WCE 补累计数字、WRR 周/累计口径；月档独立统计待 V2.19 数据模型扩展）；回归 358→367 项 |
| V2.18.0 | 第卌二轮 | REQ-058 HTML 附件 file:// 完整打开通道（openHtmlAsset 三态：落盘「下载目录/知源附件/」确定性路径 + 路径记忆 zy_html_paths + fetch 探测复用 + blob 降级；**修复 manifest 漏加 downloads 权限**——代码用了 API 但权限没给，真机 file:// 链路静默降级）+ REQ-059 附件导出/导入闭环（零依赖 zip STORE+CRC32 + getAllAssets/putAssets + 同 ID 覆盖）+ REQ-060 高频操作性能实测（五项基线全绿：启动 200ms/搜索 325ms 含防抖/切台 595ms/Drawer 104ms/persist 9ms@107KB——无红线；「搜索 2.5~6 秒」定性测量假象）+ REQ-061 附件上传规范（9 图/10MB/HTML 唯一替换 + html-added 三处宿主联动 + 双击 zy-asset 打开 + AssetPreview 多图切换）；回归 339→358 项 |
| V2.17.1 | 第卌一轮 | 真实上传链路双重根因热修：① AssetManager.onFilesChange 中 `input.value=''` 先于 FileList 快照致上传 100% 静默失败（FileList 被重置）；② persist 直传 reactive 树，编辑表单展开的 Proxy 数组被 chrome.storage 序列化为类数组对象 `{"0":…}` 致卡片正面附件徽章永不渲染——saveData/saveDataNow 统一 JSON 纯净清洗。新增 DataTransfer 驱动真实 change 事件的端到端验证脚本（6 项 ALL PASS）；回归 337→339 项 |
| V2.17.0 | 第卌一轮 | REQ-054 详情面板附件呈现（Drawer #title-extra 插槽 + 三处详情标题旁/section 头双徽章）+ REQ-055 资源卡 CSV 动态列对齐字段目录（系统字段全导 + 自定义按可见性 + 管理尾列）+ REQ-056 AssetPreview 公共 viewer 抽取（AssetManager/AssetBadge 双份合一）+ REQ-057 业务静默 catch 收敛（2 处补 Toast）；回归 325→337 项 |
| V2.16.0 | 第卌轮 | 统一卡片模型首刀：字段目录 FIELD_CATALOG 单一来源 + CardBase 公共基底（三卡 extends，FieldEditor 手写常量清空）；转卡无损化单向引擎 convertCard（好奇→任务/资源，公共字段全搬 + 状态显式映射 + 缺自定义 def 自动注入）；附件卡片正面展示 AssetBadge（🖼 n/🧾 n 徽章 + 弹层预览，资源/任务/好奇三视图接入）；好奇面板按 fieldConfig.curiosity 目录消费；fieldViewCfg 死代码清理；回归 314→325 项 |
| V2.15.0 | 第卅九轮 | REQ-048 卡片附件（三类卡 · IndexedDB Blob 存储 · 单文件 20MB · 图片弹窗/HTML 新标签 · 回收站硬删清附件 · 设置页占用+孤儿清理）+ #61 共享资源编辑表单 ResourceEditForm 抽取（双份合一）；回归 301→314 项 |
| V2.14.0 | 第卅五轮 | 任务去重根治（TaskAddDrawer 双重 keydown）、好奇心拖拽排序持久化（sortOrder）、未细分区块置顶、任务状态筛选器（4 枚举持久化）、北极星视觉重构、新增「打开设置」全局快捷键命令；回归 242→256 项 |
| V2.13.0 | 第卅四轮 | 分组分区视图（可折叠）、分区内置顶、拖拽分区边界、罗盘按需引导、删除撤销修复、Toast 四套收敛、性能调优 8 项（检索 Map 化/采集 O(1)/定位并行/保存跳过自身写入）；回归 218→242 项 |
| V2.12.0 | 第卅三轮 | 需求盘点 5 批次交付（REQ-015~026）：任务添加抽屉、回收站、双标记体系、密度控制、分类同名标红、子分类入口、工具下沉等；修复 4 个真 Bug；回归 190→218 项；图标瘦身（1.4M→0.3M） |
| V2.11.0 | 第卅一轮 | 上一稳定版，数据模型与视图体系定型 |

> 更早 V2.1~V2.4 为演进早期（PRD→架构→交互→白皮书），历史过程文档已从仓库移除，仅保留核心文档于 `../docs/`。

> 中间版本（V2.21~V2.64，第 47~95 轮）逐轮要点见 `../docs/交付说明_R*.md` 与《产品功能手册》对应版本册；本表仅保留接手锚点。

---

## 十二、文档导航

| 文档 | 内容 |
|------|------|
| `../文档中心/00_产品事实与表达母版.md` | **事实源**（母版）：品牌/定位/事实口径，改事实先改母版 |
| `../文档中心/04_产品与设计/04-20_下一轮需求盘点与开发清单.md` | P0/P1/P2 总清单（R96 勘验对账后为真待开发 17 项） |
| `../docs/技术架构与数据模型.md` | 数据层全貌、存储设计、类型规范（R96 回正） |
| `../docs/开发指南与回归验证.md` | 历史踩坑、开发约定、回归流程 |
| `../docs/交付说明_R*.md` | 逐轮交付明细（编号最大者为最新一轮） |
| `../docs/产品功能手册_V*.md` / `../docs/产品白皮书_V*_对外版.md` | 与产品版本同步升版的对外手册/白皮书 |
| `../知源调度台_产品认知基线_V2.40.0.md` | 接手认知入口（基线快照，细节以母版与最新交付说明为准） |
| `../docs/设计规范_Linear.md` | 视觉设计令牌（Linear 风格） |

---

## 十三、常见问题

### Q: 快捷键不生效？
A: 系统级四键在 `chrome://extensions/shortcuts` 确认绑定；网页浮层不出现时重载扩展并刷新已开标签页（旧内容脚本需刷新一次）。

### Q: 本地文件链接打不开？
A: 需在扩展详情页开启「允许访问文件网址」；本地文件卡片需补全完整路径。

### Q: 数据存在哪里？会上传吗？
A: 所有数据 100% 存储在浏览器本地（chrome.storage.local），不会上传到任何服务器；代码内无任何 http 数据上传。

### Q: 如何备份数据？
A: 设置 → 导出数据 → JSON 全量，建议定期备份；换机通过导出→导入并集完成。

### Q: 资源卡的链接支持哪些类型？
A: 三种：`http(s)://` 网页、本地路径（如 `D:\docs\file.pdf`，自动转 `file:///` 含中文编码）、`obsidian://` 协议。

### Q: 好奇心卡和资源卡有什么区别？
A: 好奇心卡是念头（可选来源，无分类/优先级/截止日），可转化为资源卡或任务卡；资源卡是带链接的高信度资产。

### Q: 任务卡为什么挂在成功指标下？
A: 六层思维链的设计——每个任务服务于可衡量的指标；未挂指标的任务即「未归档任务」，在知源罗盘北极星下钻中可见并可级联归档。

### Q: 删除的数据还能找回吗？
A: 能。所有删除均为软删，进入「设置 → 回收站」或 `/recycle` 页面，可单条恢复或永久删除。

---

**产品哲学一句话：写每行代码时自问——这个功能让用户更自由地思考，还是让用户更像机器的奴隶？如果是后者，删除它。**
