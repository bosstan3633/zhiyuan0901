# 交付说明 · R4-Dd —— Airtable 标签列映射（未升版）

轮次 D 第四刀。计划写的是「Airtable 标签列映射」，开工前拉现场，**前提又需要修正**：
标签**已经在推**了——被 `;` 拼成一串写进一个硬编码的 `singleLineText` 列「标签」；
而这一侧**根本没有回写路径**（`airtable.ts:5` 写明「单向推送，绝不回写知源」）。
所以这一刀不是"补一个没同步的字段"，是**把那一列变成真能用的列**，并顺手拆掉一个会因标签列而触发的脏数据生成器。

## 一、做了什么

| 落点 | 变化 |
| --- | --- |
| `shared/storage/airtable.ts` | `SyncRow.tags` 由 `string` 改回 `string[]`；新增 `DEFAULT_TAG_COLUMN` / `tagColumnOf()`；`targetColumns(tagCol)` 参数化；`ensureColumns` 返回 `{ created, fields }`；`rowToFields` 按列类型落值；`isMissingRecord` 收紧 |
| `shared/models/index.ts` | `AirtableSyncState.tagColumn?: string`（★只存列名，不存类型） |
| `views/GlobalSettings.vue` | 连接配置卡新增「标签列名」一行 + 改完即写 + 说明文字 |
| `newtab/manual-data.ts` | `mid-6` 章两处口径随迁（标签列怎么落值 / 自愈识别收紧） |

## 二、三条判断，逐条都有代价说明

1. ★**数组必须流到写出处。** 原先五处采集点各自 `.join(';')`，等轮到真正写 cell 时，
   「这列是文本还是多选」这件事已经查不到了。现在采集只交数组，落值形态由**远端实际列类型**决定：
   `multipleSelects` 收字符串数组、文本列收分号串。
2. ★**只存列名，不存列类型。** 类型每次同步从远端读一次真值（`ensureColumns` 顺手把字段表交出来，
   不多跑一次 GET）。把类型存进配置必然与 Airtable 漂移，而漂移的代价不是"报错"，是**把一批 422 当成成功**。
3. ★**清空要能同步过去。** 标签 cell 两种类型都**无条件写（含空值）**——`rowToFields` 里
   `status/priority/dueDate/link` 都是条件写，那几条本来就有"远端留旧值"的毛病；
   标签不能照抄，否则用户在知源删空标签，Airtable 里还挂着旧的。

另外把**只读计算列**（formula/rollup/lookup）改成**当场报错中止并写明换个列**——
比闷头推一批注定失败的记录好诊断得多。

## 三、★顺手拆掉的脏数据生成器：422 不等于「记录被删」

`isMissingRecord` 原先是 `/does not exist|422|404/i`，批量 PATCH 一失败就逐条降级、再判定"不存在"就 **POST 重建**。
而 422 最常见的两种成因根本不是记录缺失：`INVALID_VALUE_FOR_COLUMN`（列类型不匹配，**正是标签列最容易撞的那个**）
与 `REQUIRED_FIELD_*`。也就是说：**一次写值类型错误会被读成"该重建"，代价是在用户表里凭空多出一批重复行。**
本轮既然正是来动标签列类型的，这个误读必须先堵上：现在只认「记录确实不在」的措辞，其余照旧抛出、进同步日志。

## 四、断言 +3（1557 → 1560），零重指

`R4-Dd ★标签列名可配且按远端实际类型落值` / `★只读计算列当场报错中止` / `★422 不等于记录被删`。
本轮**没有撞红任何既存断言**：`R63-1` 钉的 repository 初始化对象逐字未动（默认列名走 `tagColumnOf()` 的
`|| DEFAULT_TAG_COLUMN`，不往那个对象里塞字段），`R64-2` 钉的 `isMissingRecord` / `createOne` /
`逐条自愈重建` 四个锚点在收紧后全部还在。

## 五、E2E +1、theme-audit 84 → 88

- **E2E-34**：Airtable 全链路此前**零覆盖**（真推要用户 PAT，测试里绝不引入凭据），所以这条只跑配置链：
  改列名 → 失焦即写 → 回读 `zy_data_v2.airtableSync.tagColumn`；再清空，验回落；顺带核 PAT 输入框仍是 `password`。
  实测 `列名框=true 落库="Tags（知源同步）" 清空后="" PAT型=password`。
  ★**首轮抓到一个真 BUG**：清空列名后 storage 里仍是旧值。原因是 `watchEffect` 的回填写成
  `if (!atTagColumn.value && s.tagColumn)` ——用户清空那一刻它看见空值，就把 storage 里的旧列名**灌回输入框**，
  清空被静默撤销。加了「改完即写」之后回填必须带 touched 门。已修并由该场景钉住。
- **theme-audit `st-airtable` 台面场**（四主题各一张）：量三件事——标签列那一行渲染在场、
  PAT 输入框 `type=password`（凭据明文出现在输入框是这一屏最坏的失效，而它在源码文本断言里表现为"什么都没变"）、
  同类输入框计算底色一致。实测四主题全过 `标签列行=true PAT型=password 同步钮=true 输入框底色=1种/3枚`。

## 六、门禁

typecheck 0 · 回归 **1560/0**（R4-Dc 基线 1557 + 3）· E2E **34/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **88 图**（视觉归档/2026-09-30）·
索引一致 **178 文件 / 42,697 行**。ZIP 未重打包（未升版先例）。

## 七、边界如实

- **没有做回写（Airtable → 知源）。** 那是设计层面的方向变更（现口径「单向推送，绝不回写本地」被手册
  与 `airtable.ts` 头注释同时钉着），要做得先定"远端谁赢"的口径，不是一轮清账能顺手带的。
- 本轮只动标签列。`customFields` / `assets` / `pinned` / `createdAt` 仍不在同步字段里；
  `argCards` 仍被 `isSyncableCard` 排除。
- ★**新记一笔既存死账（与 `.gs-panel` 同族）**：`.gs-input` 这个类名**全站任何样式表都没有定义**，
  而设置页十几个输入框都挂着它——它们实际吃的是浏览器默认白底。四主题深色下这些框全是白色，
  本轮新加的那一行只是**如实继承了这个问题**（底色一致性判据量出来三枚同为 `rgb(255,255,255)` 即为证）。
  修它要动的是全站输入框观感，不属本轮，留给 D 轮清账或单独一轮。
- 另记两条同步引擎既存问题（不在本轮动）：`pendingRows` 与 `runSync` 的"待推"口径不一致（首页角标会高估）；
  `syncedAt` 在三条路径上分别写 `row.updatedAt` 与 `Date.now()` 两套时钟。

轮次 D 余账：D-e 手册重写（`manual-data.ts` 仍有 31 处「资源台」旧称，其中 `mid-6` 这章本轮只改了两处口径、
旧称留给 D-e 一起清）；孤儿 CSS 清账（`.pcp-btn.sm/.primary`、curio `.cz-add-*`）；既存死类名 `.gs-panel`、`.gs-input`。
