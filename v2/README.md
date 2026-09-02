---
created: 2026-08-28 21:52:09
updated: 2026-09-02 11:10:00
---
# 知源工作台（Zhiyuan Workbench）

> **知源 · AI 时代的个人资源调度台与认知增强系统 —— 收得进、看得见、找得到、信得过、带得走。**
>
> AI 让"产出"变得前所未有的廉价，于是个人认知的真正瓶颈不再是"能不能创造"，而是"能不能把散落各处的产出，在正确的时刻重新调度回来"。

知源工作台是一套以人的认知主权为边界、以好奇心为探索起点、以源头资源为事实底盘、以六层思维链贯通方向与行动、并通过「项目」承接战略与日常的**个人增强系统**。它是一个 Chrome 浏览器扩展（MV3），接管新标签页，100% 本地运行。

**对外面向受众**：AI 重度使用的"独立深度研究者 / 咨询顾问"（也覆盖创作者、终身学习者）。**不面向**：已有完整 Notion/Obsidian 工作流且满意的人、换电脑无所谓反正有云同步的人。

**核心定位（April Dunford 视角）**：自造货架「AI 时代的个人资源调度台与认知增强系统」——不是书签插件、不是 PKM 笔记、不是新标签页美化。它不生产内容，而是横在所有 AI 工具、笔记、文件之上的**调度层**：经营你的认知周转率，让每一个被见过的信息都具备在正确时刻被召回的能力。

- **产品版本**：V2.14.2（第卅七轮迭代；版本号唯一来源 = `src/manifest.ts`，与 `package.json` 同步）
- **技术栈**：Vue 3.5 + TypeScript(strict) + Vite 5 + Pinia + @crxjs（MV3）+ UnoCSS
- **运行环境**：Chromium 内核浏览器（Chrome / Edge / Brave 等）
- **数据存储**：100% 本地（chrome.storage.local 单根 JSON，已申请 unlimitedStorage 权限，无 10MB 上限），无 IndexedDB、无云端、无账号
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
2. 读 `../docs/技术架构与数据模型.md` 获取数据层全貌；
3. 读 `../docs/开发指南与回归验证.md` 获取历史踩坑记录；
4. 读 `../docs/项目盘点报告_2026-08-31.md` 了解现存技术债；
5. 最新一轮做了什么，见 `../docs/交付说明_第卅七轮_V2.14.2.md`。

**必须遵守的硬性规则：**

| # | 规则 | 说明 |
|---|------|------|
| 1 | 版本号唯一来源 = `src/manifest.ts` | 改版本必须同步 `package.json`、设置页关于、手册页、`regression.cjs` 版本断言共 5 处 |
| 2 | 单向挂载红线 | 仅 TaskCard 持有 `mountedResourceIds/mountedCuriosityIds`；Resource/Curiosity/TagNode Schema **禁止出现 taskId** |
| 3 | 删除一律软删 | 任何删除只写 `deletedAt`，可进回收站恢复；`stats.lastVisits` 只经 `recordResourceOpen` 更新 |
| 4 | 排序 computed 禁止 `.sort()` | 支持拖拽排序的列表，其渲染 computed 不得原地 sort，否则拖拽错乱 |
| 5 | 样式只用 tokens.css 令牌 | 禁止硬编码色值；新增 UI 须在六主题下逐一走查 |
| 6 | 定位不走 tabs.query 的 hash | chrome.tabs.query 返回不含 hash，页面内定位走 zy-where 询问链路 |
| 7 | 新增功能同步追加回归 | 每轮新功能必须在 `scripts/regression.cjs` 追加断言项，交付前全绿 |
| 8 | 构建前清空 dist | vite 配置 `emptyOutDir:false`，不清理会累积多轮构建残留 |
| 9 | 迭代按轮次记录 | 每完成一轮（如第卅五轮=V2.14.0）在 `../docs/` 落一份交付说明，并在 regression.cjs 轮次注释更新 |

---

## 一、产品理念

### 1.1 核心定位

知源工作台不是书签管理器，不是待办清单，也不是笔记软件。它是 **AI 时代的资源调度层与认知控制塔**：AI 是被调度的工具，人才是判断与行动的主体。

**核心主张**：从好奇出发，向源头求证
**功能价值**：收得进、看得见、找得到、信得过、带得走

### 1.2 三张核心卡片

| 卡片类型 | 用途 | 关键字段 |
|---------|------|---------|
| **资源卡** | 收藏的网页、本地文件、Obsidian 笔记 | 标题、链接（URL/本地路径/obsidian://）、分类（2 级树）、标签、描述、注解、自定义字段、调用计数 |
| **任务卡** | 可执行的行动项，挂载在项目→成功指标下 | 标题、所属项目+指标（双挂）、优先级、状态、链接、备注、标签、关联资源/好奇心（单向挂载） |
| **好奇心卡** | 一闪而过的疑问和灵感 | 问题内容、状态（待探索/探索中/已求证/已搁置）、来源链接+来源标题、标签 |

两类卡片均可 **置顶（pinned）** 或 **星标（starred）**，排序权重：置顶 > 星标 > 命中度。

### 1.3 六层思维链

```
愿景（Why）→ 使命（How）→ 战略目标 → 攻坚项目 → 成功指标 → 任务
```

知源引擎·方向树的核心结构，每一层都可原位编辑、可增删。任务卡挂载于成功指标（未挂指标即「未归档任务」，北极星下钻可级联归档）。愿景/使命/战略目标/项目四层均有 📡「投射至灯塔」开关，控制知源罗盘展示（**仅项目层参与灯塔投射**）。

### 1.4 设计铁律

> **美是知源工作台的核心生产力。**

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
| 存储 | chrome.storage.local 单根 JSON | 300ms 防抖合并写；无 IndexedDB |
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
│   ├── content/search-overlay.ts      # 网页浮层（搜索/采集/好奇），Vanilla JS
│   ├── popup/                         # 降级独立弹窗（chrome:// 页场景）
│   ├── shared/
│   │   ├── models/index.ts            # 全部 TS 类型（唯一数据规范来源）
│   │   ├── storage/                   # repository（防抖持久化）/ defaults / V1→V2 迁移 / stats
│   │   ├── utils/                     # uid/dateKey/normalizeUrl/fields/pinyin/link
│   │   │                              # marksort（置顶>星标>命中度）/ taHeight（文本框高度记忆）
│   │   ├── components/                # Toast/Drawer/ConfirmDialog/ContextMenu/TagPicker/Icon/EmptyState…
│   │   └── styles/tokens.css          # 六主题语义令牌 + 三档密度 + 全局排版
│   └── newtab/
│       ├── main.ts                    # 引导：并行加载→store.init→挂载→固定回首页（应用 data-density）
│       ├── router.ts                  # / 、/compass(actions|projects|tree)、/workspace/:id
│       │                              # /settings、/manual、/recycle
│       ├── App.vue                    # 顶栏导航/主题/全局快捷键/错误边界/zy-*消息监听
│       ├── manual-data.ts letter-data.ts  # 手册与一封信内容（外置数据源）
│       ├── stores/                    # app / compass / curiosity
│       ├── components/                # GlobalPopups（三浮层）/ ProjectDetailDrawer
│       │                              # TaskAddDrawer（新建/关联双 Tab）/ compass 面板
│       └── views/                     # CompassHome / CompassShell / CompassActions / ProjectCuration
│                                      # CompassTree / Workspace / GlobalSettings / FieldEditor
│                                      # ManualPage / RecycleBin（回收站）
├── scripts/regression.cjs             # 静态回归断言矩阵（256 项，交付前必须全绿）
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
node scripts/regression.cjs   # 静态回归：必须 256/256 全绿
```

### 4.3 加载到浏览器

1. 打开 `chrome://extensions/`，右上角开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `v2/dist/` 目录
3. 打开新标签页即可看到知源工作台
4. **改代码后必须在扩展详情页点「重新加载」+ 刷新新标签页**
5. 双击打开本地文件需在扩展详情页开启「允许访问文件网址」

### 4.4 构建注意

- `vite.config.ts` 使用 `emptyOutDir:false`，**交付前必须先清空 `v2/dist/` 再构建**，否则累积历史残留文件
- 构建产物与源码同名图标均按真实尺寸生成（16~512px），勿用单张大图复制占位

---

## 五、页面架构

| 页面 | 路由 | 说明 |
|------|------|------|
| 知源罗盘（方向驾驶舱） | `/` | 灯塔（纯展示，投射控制）+ 北极星（六指标 2×3，全部可下钻）+ 我的好奇心专区（三视图/四态看板/转化）。刷新固定回此 |
| 知源引擎·今日行动 | `/compass/actions` | 主攻速览条 + 今日三件事（≤3 槽、日期切换、范围导出 CSV）+ 全域任务管理（列表/看板、按项目分组、批量、键盘导航） |
| 罗盘·项目策展 | `/compass/projects` | 全景墙（投射置顶+拖拽）→ 单项目全屏展板（指标→任务树、直创项目） |
| 罗盘·方向树 | `/compass/tree` | 六层思维链全展开、全节点原位编辑、关联卡片、停滞检测 |
| 工作台 ×N | `/workspace/:id` | 2 级分类树（三语义拖拽/聚合/置顶/安全级联删除）、三视图拖拽、批量操作、书签导入、🔥 调用计数 |
| 设置中心 | `/settings` | 字段设计编辑器、标签管理（3 级树）、回收站入口、导入导出、快捷键中心、密度控制、手册入口、重置回滚；支持 `?page=<key>` 深链 |
| 回收站 | `/recycle` | 资源/任务/好奇心三类卡软删集中管理：列表、恢复、永久删除、分区清空 |
| 使用手册 | `/manual` | 五篇富文本独立页，可下载分享版 HTML |

全局调度层横切所有页面：搜索/采集/好奇三浮层（网页端 Shadow DOM + 应用内组件双实现，行为一致）。

---

## 六、核心数据模型

完整定义见 `src/shared/models/index.ts`（唯一数据规范来源）。

- **存储键**：`zy_data_v2`（AppData 单根 JSON）/ `zy_ui_v2`（UI 偏好）/ `zy_capture_pref`（采集偏好）；V1 旧数据 `lm_data_v5` 检测到自动迁移并备份
- **AppData**：compass（vision/mission + directions→projects→metrics）/ workspaces / categories（parentId 2 级树）/ resources / tasks / curiosities / dailyFocus / tagTree（3 级）/ fieldConfig / stats / activityLogs
- **UIPrefs**：主题、密度（compact/comfortable/cozy）、sortPrefs（三视图排序）、快捷键自定义等，存 `zy_ui_v2`
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
| `Ctrl+K` | 全局搜索（分组/高亮/拼音首字母/快捷操作） | 系统级 |
| `（可分配）` | 打开全局设置（第卅五轮新增命令项，默认未绑定键，在 `chrome://extensions/shortcuts` 手动分配） | 系统级（chrome.commands） |
| 修饰键+1 | 知源引擎（修饰键五选：Alt 默认/Ctrl/Ctrl+Shift/Alt+Shift/纯数字） | 新标签页内 |
| 修饰键+2..9 | 各工作台（设置→快捷键设置逐个自定义，冲突自动清除） | 新标签页内 |
| `Ctrl+Enter` | 保存并关闭（所有编辑弹窗/抽屉，document 级监听） | 新标签页内 |
| `Esc` | 逐层关闭（浮层→抽屉→展板） | 全局 |
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
| 导入 | 工作台 JSON | 并集合并（同 ID 更新，不同 ID 新增） |
| 导入 | 书签 HTML | 浏览器导出的书签文件，顶层文件夹归组为标签 |
| 导入 | 本地文件 | 取文件名建卡，提示补全完整路径 |
| 导出 | JSON 全量 / 指定工作台 JSON / Markdown / 按工作台 CSV | CSV 含 UTF-8 BOM 适配表格软件 |
| 迁移 | V1 → V2 | 检测到 `lm_data_v5` 自动迁移并备份为 `lm_data_v5_backup`；已迁移用户跳过检测 |
| 重置 | 一键回滚 | 输入「回滚」确认后恢复初始状态 |

---

## 十、开发规范与回归基线

- **交付前置**：`npm run build` 全绿（vue-tsc 0 错误）+ `node scripts/regression.cjs` **256/256**，缺一不可（回归是字符串断言，代替不了编译检查）
- **数据红线**：Resource/Curiosity/TagNode 禁止 taskId；删除一律软删；stats.lastVisits 只走 recordResourceOpen
- **标记排序**：一律走 `utils/marksort.ts`（置顶 > 星标 > 命中度），拖拽排序列表的渲染 computed 禁止 `.sort()`
- **样式**：只用 tokens.css 语义令牌；scoped 样式无法作用到子组件内部（子组件自带样式）；v-html 内容的样式必须非 scoped
- **已知地雷**：chrome.tabs.query 不含 hash（定位走 zy-where 询问）、chrome.commands 上限 4、content script 纯 Vanilla 就地复制工具函数、工作台 name 含 icon 前缀、构建前须清空 dist
- **新增功能时在 `v2/scripts/regression.cjs` 同步追加检查项**，并更新轮次注释

---

## 十一、版本历史

| 版本 | 轮次 | 要点 |
|------|------|------|
| V2.14.0 | 第卅五轮（当前） | 任务去重根治（TaskAddDrawer 双重 keydown）、好奇心拖拽排序持久化（sortOrder）、未细分区块置顶、任务状态筛选器（4 枚举持久化）、北极星视觉重构、新增「打开设置」全局快捷键命令；回归 242→256 项 |
| V2.13.0 | 第卅四轮 | 分组分区视图（可折叠）、分区内置顶、拖拽分区边界、罗盘按需引导、删除撤销修复、Toast 四套收敛、性能调优 8 项（检索 Map 化/采集 O(1)/定位并行/保存跳过自身写入）；回归 218→242 项 |
| V2.12.0 | 第卅三轮 | 需求盘点 5 批次交付（REQ-015~026）：任务添加抽屉、回收站、双标记体系、密度控制、分类同名标红、子分类入口、工具下沉等；修复 4 个真 Bug；回归 190→218 项；图标瘦身（1.4M→0.3M） |
| V2.11.0 | 第卅一轮 | 上一稳定版，数据模型与视图体系定型 |

> 更早 V2.1~V2.4 为演进早期（PRD→架构→交互→白皮书），历史过程文档已从仓库移除，仅保留核心文档于 `../docs/`。

---

## 十二、文档导航

核心文档统一存放于仓库 `docs/` 目录：

| 文档 | 内容 |
|------|------|
| `docs/技术架构与数据模型.md` | 数据层全貌、存储设计、类型规范 |
| `docs/开发指南与回归验证.md` | 历史踩坑、开发约定、回归流程 |
| `docs/项目盘点报告_2026-08-31.md` | 现存技术债清单（巨型 SFC、静默 catch 等） |
| `docs/交付说明_第卅七轮_V2.14.2.md` | 最新一轮交付明细 |
| `docs/需求盘点与开发清单_第卅七轮.md` | 本轮需求清单与决策记录 |
| `docs/产品白皮书_V2.4.md` | 产品定位与价值主张 |
| `docs/设计规范_Linear.md` | 视觉设计令牌（Linear 风格） |

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
