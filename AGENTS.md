# AGENTS.md · 知源调度台（Ownway）

> 本文件是仓库根目录的自动执行契约。产品介绍看 `README.md`；这里只写每次动工都必须遵守的约束。
> 当前版本、回归项数、包体积等会变化的数字不在本文件写死：版本以 `v2/src/manifest.ts` 为准，工程读数以 `评审交接包/01_项目透视卡.md` 为准。

## 一、接手顺序

按任务需要读，不要一次吞完：

1. `README.md`：产品定位、边界、仓库地图、硬性规则。
2. `v2/README.md`：工程架构、数据模型、快捷键、主题、FAQ。
3. `docs/技术架构与数据模型.md`：数据层、存储、同步与迁移。
4. `docs/开发指南与回归验证.md`：环境、构建、已知地雷。
5. `评审交接包/01_项目透视卡.md`：当前事实数字、技术债、历史决策。
6. 最近一轮 `docs/交付说明_*.md`：当前交付口径与验证方式。

本仓库的设计目标之一是“换一个环境，由任意智能体接手后仅凭仓库继续迭代”。文档与代码冲突时，先回代码核实；**书面口径与代码实装不一致本身就是坏账**。

## 二、硬性规则（违反即返工）

1. **版本号唯一来源是 `v2/src/manifest.ts`。** 改版本必须同步 7 处：`manifest.ts`、`v2/package.json`、`v2/package-lock.json`（2 行）、`v2/src/newtab/views/ManualPage.vue`、`v2/scripts/regression/helpers.cjs` 的版本锚、`v2/README.md` 版本行、根 `README.md` 版本行。设置页“关于”动态读取 manifest，不手改。
2. **卡间零挂载。** `ResourceCard` / `TaskCard` / `CuriosityCard` / `TopicCard` 本体互不持有对方 id。明文豁免只包括独立记录表：`SupportLink`、`CurationProjection`、资源常用夹成员镜像、`topicResourceLinks`。六层归属（`projectId` / `metricId`）不受限。
3. **删除一律软删。** 任何删除只写 `deletedAt`，回收站依赖它；`stats.lastVisits` 只经 `recordResourceOpen` 更新，不要直接 `++`。
4. **支持拖拽排序的列表，渲染 computed 禁止原地 `.sort()`。** 排序必须回写源数组的排序字段，标记排序统一走 `v2/src/shared/utils/marksort.ts`。
5. **样式只用 `tokens.css` 语义令牌，禁止硬编码色值。** 新增 UI 必须在四套正式主题（光速黑 / 极简白 / 纸墨白 / OPPO 绿）下逐一走查。父组件 scoped 样式作用不到子组件内部；`v-html` 内容的样式必须非 scoped。
6. **定位不走 `chrome.tabs.query` 的 hash。** 该 API 返回不含 hash；页面内定位走 `zy-where` 询问链路。
7. **新增功能同步追加回归，只增不减。** 在 `v2/scripts/regression/` 新建对应分片，并在 `v2/scripts/regression.cjs` 的 `SHARDS` 注册；被新拍板覆盖的旧断言重指而非删除，重指要备案。
8. **构建前清空 `v2/dist`。** `vite.config.ts` 使用 `emptyOutDir:false`，不清理会累积历史残留，包体积读数也会失真。
9. **迭代按轮次记录。** 每完成一轮在 `docs/` 落一份交付说明，并更新回归分片注释。
10. **动工前先勘验。** 上一轮留下的“已完成 / 剩余项 / 进度”结论，动工前先回代码证伪一遍；不要把文档里的旧状态当成现状。

## 三、交付前必须跑

在 `v2/` 下执行：

```bash
npm run build                 # vue-tsc --noEmit + vite build
node scripts/regression.cjs   # 静态回归必须 0 失败
```

- `npm run build` 全绿不等于功能可用；回归是字符串/结构断言，也代替不了编译检查，两者缺一不可。
- 当前回归基线以 `v2/README.md` §十和 `评审交接包/01_项目透视卡.md` 为准。**不允许为了变绿删断言或放宽负锚。**
- 如果只改了文档，可以不跑 E2E，但仍要跑与文档事实相关的回归分片（如版本锚、文案锚）。

## 四、按改动范围追加验证

**改 UI / 样式 / 主题**

```bash
npm run gate:theme                              # tokens 对比度门禁
npm run gate:a11y                               # 键盘可达审计
node scripts/theme-audit.cjs --tag=R<轮次>-after # 四主题实拍，输出到 docs/视觉归档/<tag>/
```

- `theme-audit` 需要先有 `v2/dist` 和本机 Playwright Chromium；没有浏览器链时明确写“视觉未验证”，不要用源码阅读冒充截图证据。
- UI 交付必须在最终回复展示本轮实际截图；有确认参考时展示参考与实现，没有参考也展示最终界面。只给路径或文字不算展示。

**改交互 / 路由 / 弹窗 / 存储 / 云同步**

```bash
node scripts/e2e.cjs            # MV3 真机 E2E；需要 v2/dist 和 Chromium
```

- E2E 依赖 `scripts/browser.cjs` 的四级浏览器回落；失败时先看是浏览器解析、service worker 未就绪，还是业务断言真红。
- 不用固定 `wait(ms)` 掩盖竞态；沿用现有 `pollUntil` / `waitForLocator` / `waitForStorage`。

**改 AI 入口 / AI 文案 / 内容侧浮层**

```bash
node scripts/entry-literals.cjs # 入口 chunk 与源码闭包的 AI 字面量双向扫描
```

- AI 密钥只活在 `chrome.storage` 的 `zy_ai_v1`；内容侧浮层永不持钥，所有 AI 调用发生在 newtab 侧。
- 新增 AI 入口不得把模型名、密钥、供应商字面量带进入口 chunk。

**改性能敏感路径**

```bash
node scripts/perf-slo.cjs       # 按分路径 SLO 表验收
```

- 性能、响应速度、稳定性是第一生命线。首屏不要新增同步重活；优先复用现有懒加载、增量渲染与缓存。
- 不引入虚拟滚动、UI 框架或新运行时依赖，除非用户明确拍板。

**重构 / 拆文件 / 改入口**

```bash
node scripts/check-cycles.cjs   # 循环依赖
node scripts/orphan-check.cjs   # 孤儿文件
node scripts/dead-css-scan.cjs  # 死样式
node scripts/gen-code-index.cjs --check
```

**发版 / 打包**

```bash
npm run pack
```

- 默认输出到桌面；只在用户明确要求发版时执行。
- 预算：生产包 ≤ 2.25MB、ZIP ≤ 900KB、单文件 ≤ 400KB；禁止把 `*.map` 打进发布包。

## 五、架构与数据边界

- 工程源码只在 `v2/`。`v2/src/manifest.ts` 是 MV3 清单与版本唯一来源。
- 运行入口：`v2/src/background/`（Service Worker）、`v2/src/content/`（纯 Vanilla 浮层）、`v2/src/newtab/`（Vue 主应用）、`v2/src/shared/`（模型 / 存储 / 工具 / 组件 / 令牌）。
- 主数据是 `chrome.storage.local` 单根 JSON（`K.DATA`）；附件二进制在 IndexedDB（`IDB_NAMES.ASSETS`），**主 JSON 绝不存 base64**。
- 所有 `chrome.storage` 键必须经 `v2/src/shared/storage/keys.ts` 的 `K` 引用；`src/**` 内不得出现裸 `zy_*` / `lm_*` 键名。IndexedDB 库名与导出包标识分别走 `IDB_NAMES` / `EXPORT_MARKERS`。
- 新字段必须可选（`?`）并在读取处兜底；老数据在载入、导入、云恢复边界统一走 `normalizeAppData()`，不要在组件里各补一套。
- 云同步是三方安全合并：不同记录/字段自动取并集，同字段或删除/修改冲突必须人工逐项确认，**绝不静默整端覆盖**。主题、布局、筛选、抽屉宽度只留本机；普通卡片附件与 AI 凭据不上云。
- 产品边界是本地优先、无使用追踪、无用户画像。不要新增埋点、遥测、外部上传或“顺手接通”的第三方服务。
- 四张卡是 Resource / Task / Curiosity / Topic；策展节点是服务叙事的独立对象，不属于卡池。六层方向链是 愿景 → 使命 → 战略目标 → 项目 → 成功指标 → 任务/成果。

## 六、工程地雷（改前必读）

- `chrome.commands` 最多只能声明 4 个默认键位；新增无默认键命令可以，但不要再加第 5 个默认键位。
- content script 是纯 Vanilla JS，不能 import Vue 或共享模块；`normalizeUrl` 等工具函数就地复制。
- 本地文件拿不到真实完整路径，只能存文件名让用户补全；本地文件双击打开需用户开启“允许访问文件网址”。
- 工作台 `name` 字段含 icon 前缀（如 `💼 事业工作台`），展示时剥离前缀。
- `chrome.tabs.query` 不返回 hash；跨页面定位走 `zy-where`。
- 构建前必须清空 `v2/dist`；`dist` 不入库，不要把构建产物、截图归档、备份包或临时探针提交进仓库。
- 原生 `prompt()` / `confirm()` 全面禁用；用现有 Modal / Toast / 行内编辑。删除必须可撤销，路由切换零动画。
- 新增依赖先问。运行时依赖当前只有 `vue` / `vue-router` / `pinia`，不要为了一个小功能引入 UI 框架或状态库。

## 七、在当前工作树上改代码

- 本仓库经常带着未提交改动。动工前先 `git status --short`，用 `git diff -- <file>` 区分“用户已有改动”和“本轮改动”。
- 禁止 `git reset --hard`、`git checkout -- <file>`、`git clean -fd` 或任何会回滚用户改动的操作。
- 不要提交、推送、开分支或建 PR，除非用户明确要求。
- 编辑用 `apply_patch`，改动保持最小、聚焦；不要顺手重排无关代码、改文件名或清理历史文档。
- 发现与本任务无关的失败（旧断言、缺浏览器、环境问题）时，如实报告，不要为了“全绿”去改无关代码。

## 八、完成时怎么说

用中文给出简短交付说明，至少包含：

- 改了什么、为什么这样改。
- 改了哪些关键文件（用仓库相对路径）。
- 实际跑了哪些命令，结果如何；没跑的说清原因。
- UI 改动展示实际截图；没取到图就明确写“视觉未验证”。
- 仍未验证、仍有风险或需要用户拍板的点。

不要把“构建通过”说成“功能已验证”，也不要把“源码看起来对”说成“界面已验收”。
