# 交付说明 · R63 设置改造 + Airtable 单向同步轮

> 日期：2026-09-08 · 基于 V2.32.0（R59），与 R61/R62 同批待发版（发版升 V2.33.0）
> 门禁：vue-tsc 0 错误 · regression **669 通过 / 0 失败**（新增 R63-1~16 共 16 条，改写 2 条旧口径断言）· vite build 成功（dist 47 文件 / 1.4M）

---

## 一、本轮交付总览

| # | 任务 | 状态 |
|---|---|---|
| 63-1 | 工作台全景两级改造（资源台/策展台徽标、镜像计数、📡 跳真身） | ✅ |
| 63-2 | 导入导出适配（CSV 尾随分类路径/层级/中心论点/镜像标记列、按台导出带投射、airtableMap 并集、isThesis 随 mergeById 天然搬运） | ✅ |
| 63-3 | 策展主题卡字段设计器页 | R62 已交付 |
| 63-4 | 设置「⇄ Airtable 同步」分区（连接/测试/范围/触发/日志/配额） | ✅ |
| 63-5 | 自动建字段（GET meta 比对 → POST 补缺，已存在列不动，计算列不碰） | ✅ |
| 63-6 | 单向增量推送（updatedAt 游标 + 批≤10 + 批间 200ms + 429 退避 30s + recordId 映射写回） | ✅ |
| 63-7 | 映射表 airtableMap（知源 id ↔ recordId）+ AirtableSyncState 状态模型 + 老数据归一化 | ✅ |
| 63-8 | manifest `sync-airtable` 命令（无默认键）+ background 转发 + 设置页 getAll 自动回显 | ✅ |
| 63-9 | 调度台首页右上角同步状态卡（未配置/待同步/出错三态 + ⚙ 进设置） | ✅ |
| 63-10 | 3 小时轮询（默认关）+ background alarms 对齐 + 无页跳过 | ✅ |
| 63-11 | 手册重写（术语全面切换 R61 口径 + 新增 Airtable 同步章节 + 快捷键表） | ✅ |

## 二、同步语义（按拍板固化）

- **方向**：单向 知源 → Airtable，绝不回写本地；PAT 明文仅存本机 chrome.storage.local
- **范围**：调度台好奇心卡 / 方向台任务卡 / 资源台资源卡 / 各策展台台内卡（含主题卡）；**镜像卡按真身单条记录**，「所属工作台」列标注 📡 镜像去向，避免一卡多记录
- **自动建字段**：15 列目标集（知源ID/标题/卡片类型/所属工作台/分类路径/层级/是否中心论点/链接/描述/标签/状态/优先级/截止日期/已删除/更新时间）；已存在列不改名不改类型，formula/rollup/lookup 一律跳过
- **删除**：软删同步为「已删除」checkbox，不物理删 Airtable 记录
- **触发**：手动为主——设置按钮 / 首页状态卡 / 浏览器快捷键；3 小时轮询默认关，开关变化即时对齐 chrome.alarms
- **架构红线**：background 不写主数据（整根 JSON 跨上下文覆盖风险）——命令/轮询一律转发给已开新标签页执行（App.vue runAirtableSync 单例防重入）；无新标签页时轮询跳过、命令则开带 `zy-autosync` 标记的新页自启

## 三、改动清单

**新增（1）**
- `shared/storage/airtable.ts`：collectSyncRows / catPathOf / testConnection / ensureColumns / buildRemoteIndex / runSync / pendingRows / quotaHint（约 380 行，同步全逻辑）

**修改（8）**
- `shared/models/index.ts`：AppData.airtableSync/airtableMap + AirtableSyncState/AirtableLogEntry/AirtableMapEntry
- `shared/storage/repository.ts`：启动期归一化（默认值/log 截断 40/map 兜底）
- `manifest.ts`：+`sync-airtable` 命令（无默认键）、+`alarms` 权限
- `background/index.ts`：sync-airtable 命令转发 + AT_POLL_ALARM 对齐（180min）+ storage.onChanged 即时对齐
- `newtab/App.vue`：zy-airtable-sync 消息执行器 + zy-autosync 自启
- `newtab/views/CompassHome.vue`：右上角 sync-chip 状态卡（点击立即同步 / ⚙ 进设置）
- `newtab/views/GlobalSettings.vue`：Airtable 分区（导航/模板/脚本）+ 全景两级（panCountByWs/panCountByCat/镜像守卫/真身跳转）+ 导入导出适配
- `newtab/manual-data.ts`：命名口径全面切换（资源台/策展台），basic-1 策展两节重写、basic-3 4 级树、ref-1 快捷键表、新增 mid-6 Airtable 章节

## 四、顺手修复的活雷（63-1 附带）

- **全景镜像搬真身**：原 movePanCards 会把策展台镜像卡的真身直接搬出资源台（R61 点名同类活雷）——现镜像卡移动=改投射落点（targetWsId/targetCatId），资源台真身搬入策展台被拦截并提示走「📡 镜像到策展台」。

## 五、回归断言（669/0）

- 新增 R63-1~16（数据层/自动建字段/增量推送/同步范围/软删语义/设置分区/manifest 命令/轮询/执行器/状态卡/全景两级/移动守卫/导出适配/导入兼容/手册重写/手册口径更新）
- 改写 2 条旧口径断言：R50-14（资源台由"旧词禁用"转正为现行术语）、R54-14（策展段随 R61 结构反转重写）

## 六、真机验收路径（7 步）

1. `chrome://extensions` 加载 `v2/dist` → 打开新标签页：首页右上角出现「⇄ 未配置同步」灰态 chip
2. 点击 chip → 直达 设置 → ⇄ Airtable 同步；填 PAT / Base ID / Table ID → 「测试连接」回显表名
3. 「立即同步」→ Airtable 表自动补出 15 列并写入数据；日志/配额/耗时上屏
4. 回首页：chip 变绿显示「X 分钟前同步」；改一张卡后 chip 出现「待推 1」；点击即增量同步
5. `chrome://extensions/shortcuts` 给「同步到 Airtable」配键 → 任意网页按键触发同步
6. 设置 → 工作台全景：台名带「资源台/策展台」徽标；策展台计数含镜像；镜像卡 📡 详情可「前往资源台真身」；勾选真身拖向策展台被拦截提示
7. 按工作台导出 CSV：策展台含镜像行 + 尾随「分类路径/层级/是否中心论点/镜像标记」列

## 七、遗留与提醒

- **Free 版配额**：1000 次/月约 8 次全量级同步即耗尽——设置页已有累计计数与 80% 预警文案，建议 Team 及以上再开轮询
- **R60/R61/R62/R63 均未 commit**，等你真机验收后一起走 V2.33.0 发版（版本五处同步 + E2E + commit/tag/push）
- 已知限制：镜像卡同步按真身单条记录（多台镜像去向合并标注于「所属工作台」列），若未来需要「一镜像一行」需引入 projection 级独立键
