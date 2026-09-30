# 交付说明 · R4-Dg —— 池的显示名单源 + 导出 Markdown 整批漏卡（未升版）

轮次 D 第九刀。D-f3 的边界里记了"同款旧地名还有四处用户可见/AI 可见"，这一刀把它们收完——
但**收的过程里撞出来的第二个问题比命名严重得多**，先说那个。

## 一、★真缺陷：设置页「导出 Markdown」会把用户的全部资源卡静默漏掉

改前的写法是两层枚举：

```ts
for (const ws of d.workspaces) {                                   // ① 按 workspace 实体
  const cards = d.resources.filter(r => r.workspaceId === ws.id && !r.deletedAt)
  for (const cat of d.categories.filter(c => c.workspaceId === ws.id)) {  // ② 再按"该台的分类"
    const catCards = cards.filter(r => r.categoryId === cat.id)
```

在 V3.7.0 的池模型下这两层都接不住卡：

- **① 第一层依赖一枚"被 getter 过滤掉的历史实体"**。`id=zy-curation` 的 workspace 实体是 R61 `migrateHubStructure()`
  补出来的（`defaults.ts` 不建它，`stores/app.ts` 的 `workspaces` getter 又把它过滤掉），
  所以"池卡能不能进导出"取决于这枚实体在不在——★实测新 profile 首启后它确实在（`hubMigratedAt=有`、
  `workspaces=[zy-curation·资源台·resource]`），但这只是把正确性押在迁移器永远补得上，而不是押在数据形状上。
- **② 第二层把无分类的卡整批丢掉**。池卡 `categoryId` 恒空（R179 起标签独任组织，`poolMigration` 把分类拍平成标签），
  而这一层只走"该台名下有哪些分类"——**这条才是实测起作用的死因，且连策展台里的无分类卡一起漏**。

实测（`/tmp/zy_dg_export_probe.cjs`，7 张卡 = 6 张池卡 + 1 张台内无分类卡）：

| 库形状 | 改前导出 | 改后导出 |
| --- | --- | --- |
| 有池实体·池分类还在 | 6 行（漏 1 张台内无分类卡，标题印「资源台」） | **7 行**，标题「资源卡池」 |
| 有池实体·跑过数据体检迁移后（池卡 `categoryId` 清空） | **0 行** | **7 行** |
| 无池实体（迁移器不补/被清） | **0 行**（连标题都不出现） | **7 行** |

★注意中间那一行：用户只要跑过一次「分类→标签」迁移，导出 Markdown 就会从"能用"变成**空文件**，
而界面只弹一句 `✓ 资源卡已导出为Markdown`。这条此前**只有源码文本可见**——typecheck、build、1,571 条断言全绿。
改法：按**卡自己的** `workspaceId / categoryId` 分组（`byWs` / `byCat`），无分类落 `### 待分类`。


## 二、命名：`workspaceId → 展示名` 收进 `wsName.ts` 一处

新增 `POOL_DISPLAY_NAME = '资源卡池'` 与 `wsNameById(workspaces, id)`：**先按 id 判池，再落实体名**，
剥图标仍走原来的 `wsDisplayNameOf`（口径一字未动）。顺序为什么重要：照实体取名，拿到的是 R61 留下的历史名
「资源台」（★实测新 profile 首启后 `workspaces[0]` 就是 `zy-curation·资源台·resource`，所以对真实用户而言
到处印「资源台」是**常态**而不是边角）；实体不在的库则显示「未知」。两种都不对，正确名字只有一个。


收编的 11 个消费点：

| 消费点 | 改前 | 改后 |
| --- | --- | --- |
| `GlobalPopups.vue:721,823` ⌘K 搜索行来源 / 分组标题 | `ws?.name \|\| '未知'` | `wsNameById(all.workspaces, r.workspaceId)` |
| `RecycleBin.vue:65` 回收站行 | 直接 `find(...)?.name` | `wsNameById(...)`（兜底「未知策展台」不动） |
| `NorthStarPanel.vue:84` 热点卡台名 | `find(...)?.name \|\| '未知'` | `wsNameById(...)` |
| `overlay-impl.ts:666` 网页浮层来源 | `w.name \|\| '未知'`（★还带着图标前缀，与本页 1019 行的分组标题不一致） | `wsDisplayNameOf(w)` + 池单独 `set(CURATION_WS_ID, POOL_DISPLAY_NAME)` |
| `project.ts:293,429` AI 投料（跨台相似卡 / 深度洞察按台聚合） | `w.name` / `wsDisplayNameOf(w)` | `wsNameById(...)` |
| `govern.ts:218,253` 治理扫描包行标签 | `w.name` | `wsNameById(...)` |
| `Workspace.vue:1079` 台内列表/字段渲染的台名表 | `m.set(w.id, w.name)` | `wsNameById(...)`（局部 computed 随之改名 `wsNameMap`，避免与函数同名） |
| `GlobalSettings.vue:1407,1935` 标签管理右列 sub / 导出映射 | `find(...)?.name` | `wsNameById(...)` |
| `usePyramid.ts:316,319` 关联资源卡 toast 与来源标签 | 「资源台可镜像的卡太少，换个大点的分类再来」/ `ws: '资源台'` | 「资源卡池里可镜像的卡太少（不足 2 张），先去池里多攒几张再来」（★旧那句还教用户"换个分类"，池卡已无分类）/ `POOL_DISPLAY_NAME` |
| `CompassTree.vue:568,839` 方向树 peek「来源」 | 硬写 `'资源台'` | 显示该卡真实台名（池卡＝「资源卡池」） |
| `taskSupport.ts:104` 找佐证投料的类别名 | `? '资源台' : '策展台'` | `? POOL_DISPLAY_NAME : '策展台'`（★模型会照抄投料里的地名进回答） |

## 三、判据 +3（1571 → 1574）+ 1 条随迁

- **★`wsName.ts` 是唯一口径**：`wsNameById` 里"判池"那一行的下标必须**早于**"查实体"的下标（顺序反了就拿到历史名），
  `POOL_DISPLAY_NAME` 全站只定义一次（`count(...) === 1`），剥图标函数仍在原位，且不许出现 `|| '资源台'` 这种兜底。
- **★11 个消费点不许各自翻译台名**：逐个 `codeOnly` 必须出现 `wsNameById` / `POOL_DISPLAY_NAME`；
  ad-hoc 取法（`ws?.name ||`、`find(w => w.id === id)?.name`、`w.name || '未知'`、把池写成 `'资源台'` 字面量）转负判据。
- **★导出必须按卡分组**：取 `function exportMarkdown` 到 `function dateStr` 之间的**下标段**（不是切片取反），
  正判据点名 `byWs.get(r.workspaceId)` / `for (const [wsId, cards] of byWs)` / `catMap.get(catId) || '待分类'` / `wsNameById(...)`，
  负判据点名 `for (const ws of d.workspaces)` 与 `r.workspaceId === ws.id`。
  ★下标段判据是 R4-Da 那条"切片遇已删串恒真"教训的直接应用——旧的两层 for 已被删除，拿它当切片锚点会得到空串。
- **R129-13 随迁（收紧不是放宽）**：原判据只要求五个文件出现 `wsDisplayNameOf` 字面量，
  取法上收到共用入口后字面量搬走了，原判据会**误红**；改成三条腿（导入口径 + 无 ad-hoc 取法 + 池名来自 `POOL_DISPLAY_NAME`）。

### 活性

| 变异 | 结果 |
| --- | --- |
| W1 把判池那行的常量换成不可能命中的 id | R4-Dg 判据①红（1573/1） |
| W2 让 `CompassTree` 一处退回硬写 `'资源台'` | 判据②红（1573/1） |
| W3 导出退回 `for (const ws of d.workspaces)` | 判据③红（1573/1） |

**E2E +1（35 → 36）**：E2E-36 种两张池卡（`workspaceId=zy-curation`、`categoryId=''`）→ 真点一次「导出MD」→
读导出物本体。★不抓下载文件而抓 Blob：`downloadFile` 走 `createObjectURL + a.click()`，headless 里落盘路径不可控，
而"导出物里有没有这些卡"这件事只看内容——所以在页面里换掉 `URL.createObjectURL` 把 Blob 截下来再 `.text()`。
实测 点击=true 导出物长度=450 资源卡池段=true 池卡入列=2/2 待分类段=true 旧名残留=false。
★e2e 每轮都是全新 profile，但首启会跑 R61 迁移、池实体是**有**的（上面实测 `hubMigratedAt=有`），
所以这条 E2E 命中的是第二层漏——池卡没有分类 ⇒ 改前那张表里的**中间一行**（导出 0 行）。


## 四、门禁

typecheck 0 · 回归 **1574/0**（R4-Df3 基线 1571 + 3）· E2E **36/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **92 图**（本轮无新增场景）·
索引一致 **178 文件 / 42,763 行**（★+38 行：`wsName.ts` 单源 + 导出分组重写 + 11 处随迁）。ZIP 未重打包。

## 五、边界如实

1. **`airtable.ts:88` 没改，等用户拍板**。它把「所属工作台」列值推成 `zy-curation` 实体的名字（存量库＝「资源台」，
   新库走 `|| '资源台'` 兜底）。★改列值不是改文案：用户 Base 里按该列筛选/分组/自动着色的视图会当场失效，
   那是往**外部共享系统**里改数据口径。界面（设置页同步范围那句 D-f2 已写「资源卡池资源卡」）与推出去的值现在不一致，
   这一条不一致是明知故留，等用户点头再一起改（改法已经备好：`wsNameById(d.workspaces, CURATION_WS_ID)`）。
2. **没有删掉存量库里那枚 `zy-curation` workspace 实体**（D-f3 边界同样记过）。本轮的做法是"显示层不依赖它"，
   而不是"把它清掉"——删除属数据迁移级动作（镜像引用、按台导出、回收站分区都按 id 找它），另立轮次。
3. `overlay-impl.ts` 文件头注释仍写着「Enter 打开看板」，与 R4-De 之后的真实落点（定位到资源卡池）不符；
   注释不面向用户，与代码里其余「资源台」旧称一并留给注释清理轮（D-f2 已记过同一类账）。
4. 池卡在 ⌘K、回收站、北极星里的**新标签**没有被 e2e 逐个截图验证——它们的显示都走同一个 `wsNameById`，
   运行时凭据集中在导出那一条（那里同时验了台名与漏卡）。
5. ★**给 D-f3 已发布的说法补一刀精度**（撞见自己写得不准就当场改，不悄悄留）：那条写的是
   「`defaults.ts` 新建库不建这枚实体 ⇒ 新库第一张报告卡落进事业策展台」。本轮实测补正：新 profile **首启 newtab**
   会跑 R61 `migrateHubStructure`，把 `zy-curation·资源台·resource` 补出来（实测 `hubMigratedAt=有`、
   `workspaces=[zy-curation·资源台·resource]`），所以"实体缺席"不是默认新装形状，而是一支**可达**形状——
   库由 popup / content 侧先写时走 `repository.ts:139,162` 的 `createDefaultData()`，那里没有这枚实体，
   newtab 尚未启动过就是它。结论不变（不能把正确性押在一枚被 getter 过滤、要靠迁移器补的历史实体上），
   但成因比 D-f3 当时写的窄，这里照实更正，并把它作为本轮第一节 ① 的注脚。

