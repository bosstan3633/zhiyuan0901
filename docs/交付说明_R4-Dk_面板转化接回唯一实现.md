# 交付说明 · R4-Dk · ⌘K 面板的「转化为资源卡」接回唯一实现

**日期**：2026-10-01 · 基线 V3.7.1（`48603e8` R4-Pa）· **未升版**
**为什么这一轮**：用户问「还有哪些任务未开发」，我去仓库里核而不是凭记忆答，核出三件事，其中这件是**唯一一笔承诺过要收但没收**的开发项之外的真缺陷：⌘K 面板里「好奇心 → 转化为资源卡」这个入口，是全站唯一没走唯一实现的转化路径。

---

## 一、这个入口一共有四处偏差，全在同一个函数里

`GlobalPopups.vue` 的 `convertCurio()` 自己手搓了一张卡，而 `useCuriosity().convertToResource/convertToTask`（`stores/curiosity.ts`，`CuriosityPanel.vue:375` 一直在用）才是那条唯一实现。手搓那份的偏差：

| # | 偏差 | 实测（`/tmp/zy_dk_probe.cjs`，两种库形状各真点一次） |
|---|---|---|
| ① | **落点写 `d.value.workspaces[0]?.id`** | 默认库（`defaults.ts` 第一枚是「事业策展台」）⇒ 落 `ws-biz-000`；存量库（`curationMigration.ts` 建的 hub 实体排在第一）⇒ 落 `zy-curation`。**同一个动作在两种库形状下落进不同的台**，而回执 toast 一律写「存入待分类」——用户被告知进了待分类，实际进了一台策展台 |
| ② | **公共字段整片丢** | 改后 tags/描述/附件/自定义字段/星标/置顶全部带过来；改前实测 `tags=[]`、描述/附件/自定义字段/星标 全 `false`。任务分支还不按好奇心状态映射（一律 `status:'todo'`，唯一实现走 `CURIOSITY_TO_TASK_STATUS`） |
| ③ | **不写 convertedAt/convertedTo** | 改前 `出路记账 = undefined / 无 convertedAt` ⇒ 池头部「已转化」计数与 CuriosityPanel 那条路对不上同一个动作 |
| ④ | **「查看」拼 `/workspace/${r.workspaceId}`** | 见下一节，这是 R2-④ 那族死链的**漏网出口** |

## 二、★R2-④ 的清账判据是「路由字面量扫描」，变量拼法它天生看不见

R2-④ 断言写的是「代码内 `/workspace/zy-curation` 该路由字面量零残留」——**这一行拼的是变量**，所以那条断言一路绿着，而这个入口活到今天。三种形状实测：

- **没有 hub 实体的库**：点「查看」→ `#/workspace/zy-curation` → 页面文案「策展台不存在」。**死页。**
- **存量库（hub 实体还在 `d.workspaces` 里）**：点「查看」→ 渲染出一枚 **0 个分类、空金字塔的退役「资源台」台面**——刚转出的卡其实在池里，这个台面上看不见它。★比死页更隐蔽：页面有内容、不报错，用户以为自己转错了。
- **默认库**：直接进「事业策展台」（错的台），并且实测控制台报 `TypeError: Cannot read properties of undefined (reading 'resource')`。

手册里 R4-De 那句「点过去是『策展台不存在』死页」只描述了第一种形状。这轮把三种都量了。

## 三、顺带撞出来的一条脆弱点（改前面就有，不是我引入的）

把面板接进唯一实现后，探针库（没有 `fieldConfig` 块）直接抛
`TypeError: Cannot read properties of undefined (reading 'curiosity')` ——
出处是 `curiosity.ts:69` 的 `cfg.curiosity`，而 `const cfg = store.data!.fieldConfig` 没有任何守卫。

关键在于**抛错点位于 `convertToResource()` 里 `store.persist()` 之前**：卡进了内存、**没落盘**、回执 toast 也不弹——界面看上去转化成功了，刷新就没了。
查了一圈：`repository.ts` 的归一化全都写成 `if (data.fieldConfig && …)` / `data.fieldConfig?.[key]`，**没有任何一处负责在缺块时把它补出来**；`fieldConfig` 只在 `defaults.ts` 里生下来就有。所以老库/手改过的导入 JSON 走到这条转化路径就会静默半成功。
修法是在 `ensureCustomDefs` 里对 `cfg` 与 `cfg[targetKind]` 各补一道守卫（缺定义只是没得搬，自定义字段值本身随卡带走，不该让整次转化失败）。

## 三b、同族的第五个活口：指标下钻抽屉也自己拼了一遍路由

顺着「谁还在拼 `/workspace/${}`」查下去，除了面板那一处，`compass/MetricDrillDrawer.vue` 的 `locateRes()`（WRR 资源复用明细行点击）也在拼，而且它拿到的 `r.workspaceId` **今天默认就是池 id**：

```js
const wsId = r?.workspaceId || store.workspaces[0]?.id      // 改前
if (wsId) router.push({ path: `/workspace/${wsId}`, query: { hl: id } })
```

`shared/utils/locate.ts` 里那段注释早就写着：**R2-④ 当年把四处深链逐个改靶，但漏了这个共享算式本身，
所以「凡是走这里的调用点」对池卡仍然跳死页——修在算式里，一次修完所有调用点。** R4-E 照那句把算式修了，
可是这个组件当时**没接进算式**，于是它成了"所有调用点"里漏掉的第五个。现在它走 `resourceLocateRoute(r.workspaceId, r.categoryId)`，
兜底 `store.workspaces[0]` 一并删掉（卡不在库里不该跳去别人的台，与 `locateTargetOf` 的 null 语义对齐——
`!v.deletedAt` 我没有加进去，因为 `locateTargetOf` 也只看"整张卡是否还在库"，软删卡仍在库、只是住回收站）。

## 四、判据 +6（1,593→1,599）与运行时覆盖 +1（E2E 37→38）

- 面板必须走唯一实现：`convertCurio` 体内必须有 `convertToResource(c, CURATION_WS_ID` 与 `convertToTask(c)`，且 `d.value.resources.unshift` / `d.value.tasks.unshift` / `store.persist()` 一律不许再出现在这个函数里（负判据点名改前那两行手搓字面量 `id: uid('res'), kind: 'resource', title: c.question`）。
- 落点显式归池：不许再出现 `workspaces[0]`；回执文案「存入待分类」不许回流（改口「存入资源卡池」，与 R4-Df3 报告卡同一口径）。
- 「查看」不许再拼 `/workspace/${r.workspaceId}`，必须走 `locateOnly` 同一改靶口径 `/?hl=&hk=res`（任务分支同给 `hk=task`，改前它只是 `router.push('/')`，不带定位）。
- `ensureCustomDefs` 的 `if (!cfg) return` 与 `cfg[targetKind] || (…= [])` 两道守卫必须在位，`const srcDefs = cfg.curiosity`（无 `|| []`）那种裸取值不许回流。
- `MetricDrillDrawer.locateRes` 必须走 `resourceLocateRoute`：`/workspace/${wsId}` 变量拼法与 `store.workspaces[0]` 兜底都不许回流，取不到卡走 `showToast('这张卡已不在库里')`（与 `locateTargetOf` 的 null 语义同口径）。
- **E2E-38**（新增）：真点一次转化——搜出探针好奇卡 → `🔄▾` → 「转化为资源卡」→ 读库核落点/六项字段/`convertedTo` → 点 toast 的「查看」→ 核**没去任何策展台**、**不是死页也不是退役空台面**、池面板里看得见这张卡且带高亮。

## 五、方法账（这一轮的三条，都是测试自己的期望值写错，不是被测码错）

1. **拿 `hash` 里还有 `?hl=` 当"定位成功"的证据 ⇒ 假红。** E2E-38 第一次跑，明细里每一项都是 `true`，只有整条判据红——因为消费端（CompassHome/PoolCardsPanel）定位成功后**会主动清掉 query**（R2-④ 那条"定位不清过滤即落空"），1.3 秒后读到的 hash 就是 `#/`。改判"没落进任何 `/workspace/…`" + 「池面看得见这张卡」+「高亮 ≥1」。教训与手册那条同源：**定位的证据是"用户看见那张卡"，不是"url 长什么样"。**
2. **面板转化菜单被 tab 条挡住命中**（`.gp-ri-actions` 真机靠 hover 露出），Playwright 普通 click 会一直重试到超时。探针与 E2E 都改成点 handler 而不是点坐标，并在注释里写明"判的是 convertCurio 这条数据路径，不是 hover CSS"——**这不是绕过失败，是换了要证明的东西**；hover 可见性这件事仍是盲区，记在边界里。
3. **`ensureCustomDefs` 那条抛错一开始被我以为是自己的改动引入的。** 分辨方法不是读代码猜，是拿 HEAD 构建跑同一条探针：HEAD 也报（报的是 `reading 'resource'`，出现在渲染层而不是转化层）。两边都报 ⇒ 脆弱点本来就在，只是我的新调用方把它从"渲染层报错"提前到了"persist 之前报错"——**后者更糟（数据直接不落盘），所以必须一起修**。这条与 R4-Pa 那条"同一个 dist 重跑差 1.4×"是同一课：先确认测的是哪个构建、报的是哪一层。

## 六、门禁

活性变异五条（G1–G5，各还原复跑回绿）：落点退回 `workspaces[0]`→判据②红（顺带把①一起抓红，因为它同时拆掉了 `convertToResource(c, CURATION_WS_ID` 这个锚点）；把任务分支改回手搓 unshift→判据①红；「查看」退回拼变量路径→判据③红；摘掉 `ensureCustomDefs` 守卫→判据④红；下钻抽屉退回自己拼路由→判据⑤红。

门禁：typecheck 0 · 回归 **1599/0**（R4-Pa 基线 1593+6）· **E2E 38/0（37→38）** · 导入兼容 7/0 · 循环 0 · build ✓ · 入口字面量双向 15 项全 0（面板静态挂在入口 chunk 上，新增的 `stores/curiosity` import 经它自己的 import 面核查不带 `shared/ai/**`）· contrast 全绿 4×14 · theme-audit 92 图（本轮无新增场景）· 索引一致 178 文件 / **42,846 行**（+22）。ZIP 未重打包、未 push。

## 七、边界如实

- **只动了 ⌘K 面板这一个入口**。`CuriosityPanel.vue` 那条一直在用唯一实现，本轮没改它的行为，只是让它多了一条 `fieldConfig` 缺失也不再抛错的守卫。
- **`convertedTo`/`convertedAt` 的撤销语义没碰**：转化即软删好奇卡，恢复后这两个戳怎么处理是 R159 撤销栈那一族的事，本轮不扩。
- **没给面板加"选台"这一步**。`CuriosityPanel` 转化时可以选落到哪台/哪分类（`convertWsId/convertCatId`），面板里是快路径、没这个选择器，所以它落到池（新卡默认居所，与 R2-⑧ 池控制行新建同一口径）。若产品要面板也能选台，那是新交互，另行拍板。
- **族级扫描只做到"点"**：本轮把 `grep '\`/workspace/\${'`」列出的 9 处逐一看了——除面板与下钻抽屉这两处（已修），其余（`locate.ts:45` 本身就是唯一算式、`App.vue:182/254/468` 走已过滤的 workspaces getter 或新建台后跳转、`GlobalPopups.vue:864/1345/1436` 在 `CURATION_WS_ID` 分支之后或只处理 `type==='ws'`）都不产生活死的池链接。但这是**人读一遍的结论**，不是一条会自动复跑的族判据：字面量扫描对"变量拼出来的路由"天然失明（这正是 R2-④ 漏掉第五个活口的原因），要做成门禁得换形态（比如枚举所有 `router.push` 的 path 实参来源），另立一轮。
- **下钻抽屉那一处没有运行时覆盖**：E2E 里没有能开到 `MetricDrillDrawer` 的 WRR 明细行的夹具路径，本轮只有源码判据钉住它（它调的算式 `resourceLocateRoute` 本身有别的 E2E 覆盖）。theme-audit 的 `dz-drill` 场景是方向台下钻列表，不是这个抽屉。
- **hover 才露出的操作区是盲区**：`.gp-ri-actions`（⭐/🗑/↗/🔄▾）在 headless 里被 tab 条挡住命中，E2E-38 点的是 handler。真机上"鼠标移上去才看得见这排按钮"这件事仍然没有门禁——归到 #114 那件"⌘K 面板进视觉门禁"一起补。
- 探针那次 `fieldConfig` 缺失的库形状是**我造的**，真实用户库带该块；所以第三节那条是"脆弱点被新调用方暴露"，不是"用户今天正在踩的 bug"。
