# 交付说明 · R4-Fa —— 微缺陷清账：待推角标口径、syncedAt 时钟、论点软删、过期注释（未升版）

用户批准的顺序里第一件（第 3 组"已核实存在、未修的小缺陷"一次做完）。四件都不大，
但每一件都是**代码与它自己的口径打架**，所以每件都带运行时对照。

## 一、四件缺陷与实测

### ① 「待推 N」角标系统性高估（`airtable.ts`）
`pendingRows`（首页与同步 chip 用它）只按游标筛：
```ts
all.filter(r => !cursor || r.updatedAt > cursor || r.deleted)
```
而真正执行推送的 `runSync` 在其之上**多过一层** `!map[r.key] || map[r.key].syncedAt < r.updatedAt`。
⇒ 只要 `cursorAt` 落后，"游标之后动过但早已同步完"的行全被算进待推。
**修法**：抽出唯一算式 `todoRows(d)`，`pendingRows` 与 `runSync` 都走它。
**实测**（四张池卡、其中三张已同步、一张同步后又编辑过，`/tmp/zy_fa_probe.cjs`）：改前角标 **4**，改后 **1**，真正待推的键 `["c4"]`。

### ② `syncedAt` 两套时钟会吞掉编辑（`airtable.ts`）
`models/index.ts:568` 的注释早就写明语义是「该卡上次同步成功时**本地 updatedAt**」，
但三处写入里只有一处照做，另外两处写 `Date.now()`：
墙钟必然 ≥ 任何本地编辑时间 ⇒ 比较式 `syncedAt < r.updatedAt` 永远不成立 ⇒
**"发起同步之后紧接着改卡"会被下一轮判成已同步，永久漏推**。
**修法**：三处统一写"该行推送时的 `updatedAt`"（`creates` / `updates` 数组各带上这个字段）。
**实测**：同一场景（同步确认于 T+500s，卡片在 T+400s 被改）——旧口径待推 **0**（被吞），
新口径待推 **1**（会再推）；版本确实追平时新口径为 **0**（不误推）。

### ③ `setThesis` 会静默摘掉回收站里旧论点的标记（`hub.ts`）
同文件的 `countThesisDuplicates` / `sanitizeThesisDuplicates` 都把口径写死为
「**软删卡不计入，回收站恢复后语义不变**」，唯独 `setThesis` 的清除循环漏判 `deletedAt`。
⇒ 用户从回收站恢复一张旧的中心论点卡，回来的是没有论头衔的普通卡，且没有任何提示。
**修法**：清除循环补 `|| r.deletedAt`（活卡仍照旧只留一枚论点；重复论点由 sanitize 那两条按既有口径处理）。
**实测**：新行为下软删旧论点 `isThesis` 保留；复现旧算式确认它确实被置 `undefined`。

### ④ 过期注释（`poolMigration.ts:21`）
仍写「`readMigrateBackup / restoreMigrateBackup` 数据层原语已备，**尚无 UI 调用方**」——
R4-a 的 `MigrateReportCard.vue:67` 就是调用方。注释订正为点名现役出口。
★**过期注释也是账**：它是下一个读代码的人判断"这条能力有没有落地"的依据，写错会让人重复造出口。

## 二、判据 +4（1581 → 1585）

- **①「待推」只允许一个算式**：`todoRows` 必须导出；`pendingRows` 体必须走它且**不许再出现 `.filter(`**；
  `runSync` 段必须 `const todo = todoRows(d)`，且旧的两层 filter 与 `const all = collectSyncRows(d)` 不许回流
  （★只判"两边都走它"不够——下次谁在 `pendingRows` 里加个 filter，口径就又分叉了）。
- **②`syncedAt` 只能是版本戳**：`codeOnly` 里 `syncedAt: Date.now()` 零命中，三处写入分别是
  `row.updatedAt` / `creates[idx].updatedAt` / `u.updatedAt`，`creates`/`updates` 的类型带 `updatedAt: number`，
  `models` 里那句语义注释仍在（钉住"口径写在哪"这件事本身）。
- **③`setThesis` 判软删**：取函数体，正判据是补了 `|| r.deletedAt` 的那一行，负判据是旧那行（不判软删）不许回流。
- **④注释不许再写「尚无 UI 调用方」**，且必须点名 `MigrateReportCard.vue`，同时核该组件真的调用 `restoreMigrateBackup()`。

**活性**：FA1 让 `pendingRows` 退回自己筛 → 判据①红；FA2 把 POST 那处改回 `Date.now()` → 判据②红；
FA3 摘掉 `|| r.deletedAt` → 判据③红；FA4 注释退回旧话 → 判据④红（各 1583/2，另一条红是 R163-1 报索引漂移，重跑生成器后一致）。
探针与备份都在 `/tmp`，跑完原样还原。

## 三、门禁

typecheck 0 · 回归 **1585/0**（R4-Dj 基线 1581 + 4）· E2E **36/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **92 图**（本轮无新增场景；
归档目录已翻到 `视觉归档/2026-10-01`——目录名取 UTC 日，本机过零点了）· 索引一致 **178 文件 / 42,762 行**（+18 行）。
ZIP 未重打包。

## 四、边界如实

1. **没动 `pendingRows` 的调用方**（首页 chip、设置页），它们读的是 `.unsynced` 数字，口径一合就自动变准；
   本轮没重新设计"待推"的展示（比如区分"从未推过 / 推过又有新版本"），那是产品口径，要另说。
2. **`syncedAt` 语义变了但没有迁移**：老映射表里那些写错成墙钟的值仍偏大，
   后果是"那些行在下一次改动前不会被误推"——即旧数据只会少推不会多推，且任何一次真实编辑都会立刻把它拉回正轨；
   所以不做迁移（跑一次全量重推的代价远大于收益）。要清干净只需在设置页把游标/映射重置一次，那是既有能力。
3. **`setThesis` 的另一半没动**：`d.argCards` 仍被显式拒绝做中心论点（R1.5 拍板），
   论点语义是否随论证卡迁移仍在"待用户拍板"清单上。
4. 第 3 组里剩下的两件**不在本轮**：theme-audit 的时间冻结/鼠标归零（门禁基建，单独一件）、
   以及待你拍板的 Airtable 列值图标前缀。
