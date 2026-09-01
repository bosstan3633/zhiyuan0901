# 知源工作台（Zhiyuan Workbench）

> **从好奇出发，向源头求证。** · AI 时代的个人资源调度层与认知控制塔

Chrome MV3 扩展，接管新标签页，100% 本地运行（chrome.storage.local 单根 JSON，无云端、无账号）。

- **当前版本**：V2.12.0（第卅三轮迭代）· 产品包见 [Releases](https://github.com/bosstan3633/zhiyuan0901/releases)
- **技术栈**：Vue 3.5 + TypeScript(strict) + Pinia + Vite 5 + @crxjs（MV3）+ UnoCSS + pinyin-pro
- **质量门禁**：`vue-tsc` 0 错误 + `v2/scripts/regression.cjs` 静态断言 **218/218** 全绿

---

## 🤖 给 AI 智能体 / 新开发者的交接须知

本仓库的唯一目的是：**换一个环境、由任意智能体接手后，仅凭本仓库即可继续迭代**。接手顺序：

1. 读本文件（尤其下节「硬性规则」）；
2. 读 `v2/README.md` 获取工程全貌（架构/数据模型/快捷键/主题/FAQ）；
3. 读 `docs/技术架构与数据模型.md` 与 `docs/开发指南与回归验证.md`；
4. 读 `docs/项目盘点报告_2026-08-31.md` 了解现存技术债；
5. 最新一轮做了什么 → `docs/交付说明_第卅三轮_V2.12.0.md`。

### 硬性规则（违反即返工）

| # | 规则 | 说明 |
|---|------|------|
| 1 | **版本号唯一来源 = `v2/src/manifest.ts`** | 改版本必须同步 `package.json`、设置页关于、手册页、`regression.cjs` 版本断言共 5 处 |
| 2 | **单向挂载红线** | 仅 TaskCard 持有 `mountedResourceIds/mountedCuriosityIds`；Resource/Curiosity/TagNode Schema 禁止出现 taskId |
| 3 | **删除一律软删** | 任何删除只写 `deletedAt`（回收站 `/recycle` 可恢复）；`stats.lastVisits` 只经 `recordResourceOpen` 更新 |
| 4 | **排序 computed 禁止 `.sort()`** | 支持拖拽排序的列表，渲染 computed 不得原地 sort |
| 5 | **样式只用 `tokens.css` 令牌** | 禁止硬编码色值；新增 UI 须在六主题下逐一走查 |
| 6 | **定位不走 tabs.query 的 hash** | chrome.tabs.query 返回不含 hash，页面内定位走 zy-where 询问链路 |
| 7 | **新增功能同步追加回归** | 每轮新功能必须在 `v2/scripts/regression.cjs` 追加断言项 |
| 8 | **构建前清空 dist** | vite 配置 `emptyOutDir:false`，不清理会累积多轮构建残留 |
| 9 | **迭代按轮次记录** | 每完成一轮在 `docs/` 落一份交付说明，并更新 regression.cjs 轮次注释 |

---

## 📁 仓库地图

```
├── v2/                          # 全部源码（唯一工程目录）
│   ├── src/manifest.ts          # MV3 清单 ★版本号唯一来源
│   ├── src/background/          # Service Worker
│   ├── src/content/             # 网页浮层（搜索/采集/好奇）
│   ├── src/newtab/              # 主应用（首页/罗盘/工作台/设置/回收站）
│   ├── src/shared/              # models / storage / utils / components / tokens.css
│   └── scripts/regression.cjs   # 静态回归断言（218 项）
├── docs/                        # 核心文档（7 份，见下表）
└── README.md                    # 本文件（GitHub 首页入口）
```

### 文档导航

| 文档 | 内容 |
|------|------|
| `v2/README.md` | 工程全貌速览：产品理念、架构、数据模型、快捷键、主题、FAQ |
| `docs/技术架构与数据模型.md` | 数据层全貌、存储设计、类型规范 |
| `docs/开发指南与回归验证.md` | 历史踩坑、开发约定、回归流程 |
| `docs/项目盘点报告_2026-08-31.md` | 现存技术债清单 |
| `docs/交付说明_第卅三轮_V2.12.0.md` | 最新一轮交付明细 |
| `docs/需求盘点与开发清单_V2.12.md` | 需求清单与决策记录 |
| `docs/产品白皮书_V2.4.md` | 产品定位与价值主张 |
| `docs/设计规范_Linear.md` | 视觉设计令牌（Linear 风格） |

---

## 🚀 快速开始

```bash
git clone git@github.com:bosstan3633/zhiyuan0901.git
cd zhiyuan0901/v2
npm install          # 还原依赖（node_modules 不入库）
npm run build        # vue-tsc 0 错误 + vite build
node scripts/regression.cjs   # 218/218 全绿
```

加载到浏览器：`chrome://extensions/` → 开发者模式 → 加载已解压 → 选 `v2/dist/`。

> 完整构建/开发说明见 `v2/README.md` 第四节。

---

## 🆕 版本历史

| 版本 | 轮次 | 要点 |
|------|------|------|
| V2.12.0 | 第卅三轮（当前） | REQ-015~026：任务添加抽屉、回收站、双标记体系、密度控制、分类同名标红、子分类入口等；修复 4 真 Bug；回归 218 项；图标瘦身 1.4M→0.3M |
| V2.11.0 | 第卅一轮 | 上一稳定版，数据模型与视图体系定型 |

---

**产品哲学：写每行代码时自问——这个功能让用户更自由地思考，还是让用户更像机器的奴隶？如果是后者，删除它。**
