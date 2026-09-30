# 交付说明 · R4-Dc —— 附件卫生 keepIds 单源 + 破坏性入口补门（未升版）

轮次 D 第三刀。计划里写的是「数据体检与 `useWsAssetHygiene` 合流」，开工前先把现场拉出来，
发现**要合的不是"体检卡与卫生 composable"，而是孤儿附件清理那两份逐字重复的 keepIds 算式**——
「🩺 数据体检」卡（`DataCheckupCard.vue`）守的是另一条不变量（同板多 `isThesis`），与它零重叠。

## 一、做了什么

| 落点 | 变化 |
| --- | --- |
| `shared/storage/assets.ts` | 新增 `collectReferencedAssetIds(d)`（keepIds 唯一算式）+ `cleanupOrphanAssetsOf(d)`（两条入口共用的一句）+ `listOrphanAssetIds(keep)`（**只读盘点**，确认门才报得出具体数字） |
| `composables/useWsAssetHygiene.ts` | 手写 `collect` 撤下改共用；`onDrillCleanupOrphans` 去掉一句无用的 `store.persist()` |
| `views/GlobalSettings.vue` | 「清理」钮补确认门；手写 `forEach(r => collect(r.assets))` 三份撤下 |
| `components/CurationDrillDrawer.vue` | `cleanup-asset` 载荷从 `{cardId, assetId}` 收成 `assetId` |
| `views/Workspace.vue` | 删掉 `deleteAsset, cleanupOrphanAssets` 那行 import——R115 拆分后本页零调用，是残留 |

## 二、★这一刀真正修的是三条 BUG，不是代码整洁

1. **设置页那枚「清理」钮此前单击即物理删除不可恢复的 IndexedDB 本体，没有任何确认门。**
   同一张卡上「导出附件包」被写成"完整可迁移备份"，两个相邻动作给出相反的风险信号——
   与 R146 当年给「清空回收站」补门是**同一条理由**。现在：先只读盘点 → 报出具体个数 → 确认 → 才删。
   ★这条此前**没有任何断言在管**（`R39-12` 只钉了那枚钮存在），所以它一路绿着上线。
2. **keepIds 两份手写、只差一个签名，可各自漂移**，而它们算的是「哪些二进制不许删」。
   漂移一次就是用户附件被静默删掉且不可恢复。现收进 `collectReferencedAssetIds` 一份。
3. ★**两份都漏了第四类卡 `argCards`。** `assets?: AssetMeta[]` 挂在 `CardBase` 上，论证卡本就继承
   （`R39-1` 断言「四张卡 extends CardBase」），两份 keep 只扫 resources/tasks/curiosities。
   今天没出事是因为**还没人往论证卡上挂附件**——那是侥幸不是判据。已补进去。

另两处顺带：钻取抽屉的批量清理原先 `store.persist()` 一遍主 JSON（几百 KB 起）而 AppData 一个字节没变，
撤掉；`onDrillCleanupAsset(row)` 收了 `cardId` 却从不读它，而它**故意**是全树摘除（转卡共享同一 assetId
时三张卡都要摘，R128-A3）——留个 `cardId` 会让人以为清理按卡作用域，进而不敢点，故载荷收敛。

## 三、断言：2 重指 + 3 新增（1554 → 1557）

- `R110-B2-4`（清理口径含回收站软删卡）判据搬到真源 `assets.ts`，并**点名 argCards**；
  同时加负判据：两个宿主都不许再手写 `const collect =` / `.forEach(r => collect(`。
- `R110-B2-3`（清理双入口均二次确认）两条锚点跟实现搬落点，「两个入口都要有门」一句一字未松，
  且本轮把同一句话补到了第三枚钮上。
- 新增三条：`keepIds 只有一个算式` / `不可恢复的物理删除必须先数清再确认`（切片核
  `listOrphanAssetIds` 在 `cleanupOrphanAssetsOf` **之前**、`await useConfirm` 在中间、`if (!ok) return` 在位）/
  `只删本体的那条动作不许多写一遍主 JSON`。
- ★踩到并当场修掉自己写的一条：判据里误用 `gs.index(...)`（Python 习惯，JS 字符串没这方法），
  它**响亮地报错**而不是静默通过——这条差异值得记：切片判据若用 `indexOf` 返回 -1 会得空串，
  本条因为要求切片内**必须含若干正锚点**所以不会假绿。

## 四、E2E：32 → 33（这条性质此前零行为覆盖）

新增 `E2E-33`：种四个本体（活卡引用 / 回收站软删卡引用 / 论证卡引用 / 谁都不引用的孤儿），
真点设置页那枚钮，核 ① 弹窗先出、**没确认之前一个字节都不动** ② 三种引用一律留 ③ 只有孤儿被删。
实测 `弹窗=true 未确认前不动=true(5) 留活=true 留软删=true 留论证卡=true 孤儿已删=true`。
★首轮红在"库里正好 4 个键"这个绝对数——同一轮里 E2E-5 也往 `zy_assets` 留了东西；
要验的性质是**相对的**（我种的四个键在弹窗还开着时都还在），改成按键名核对。

## 五、门禁

typecheck 0 · 回归 **1557/0**（R4-Db 基线 1554 + 3）· E2E **33/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **84 图**（本轮无新增场景）·
索引一致 **178 文件 / 42,632 行**。ZIP 未重打包（未升版先例）。

## 六、边界如实（本轮明确未做，已记账）

盘点时另外量出三条既存问题，都**不在本轮动**，因为各自要改的是判据口径而不是重复实现：

1. `setThesis`（`hub.ts:238`）清 `isThesis` 时没查 `!r.deletedAt`，而同文件的 `countThesisDuplicates`
   与 `sanitizeThesisDuplicates` 两个函数都查——**同一文件三套口径**，后果是在回收站里的卡会被静默
   摘掉中心论点标记（恢复出来后论点丢了）。
2. 「🩺 数据体检」卡只实现了一条不变量（同板多 `isThesis`），手册却写成「扫一遍常见结构性问题」；
   `sanitizeCategoryTree`（分类环/孤儿/超深）只在**导入路径**跑、`pruneDanglingProjections` 与
   `scrubHubMirrorMarkers` 只在**启动时**跑，三者既没有 UI 入口也不在体检卡的读数里——
   体检卡想名副其实，缺的是把这几条已有算式接成读数，不是再写一份。
3. `poolMigration.ts:21` 头注释仍写「`readMigrateBackup` / `restoreMigrateBackup` 尚无 UI 调用方」，
   实际 R4-a 那轮的 `MigrateReportCard` 早已接上——注释过期，D-e 手册轮一并清。

> ★订正一条：我最初还记了「体检卡修完不刷新读数」，写文档时回查 `DataCheckupCard.vue:32` 发现
> `fixThesisDuplicates` 末尾确实调了 `refreshThesisScan()`，且该卡是 `v-if="activePage === 'export'"`
> 每次进面板重挂载 → 不存在这个 BUG。**没核就不写进交付说明**。

轮次 D 余账：D-d Airtable 标签列映射、D-e 手册重写（`manual-data.ts` 31 处「资源台」旧称）；
孤儿 CSS 清账（`.pcp-btn.sm/.primary`、curio `.cz-add-*`）；既存死类名 `.gs-panel`（全站无定义、18 处挂着）。
