# 交付说明 · R4-De —— 池卡定位落点收进唯一算式（修死链，未升版）

轮次 D 第五刀。**这一刀不在原计划里**，是 D-e 手册重写开工前拉现场时撞出来的：
手册 basic-2 有一句「采集保存后按 Enter 直接打开看板并高亮新卡」，我打算照实写进手册，
结果去核这条链路时发现——**它今天是死的**。手册不能写一句假话，所以先修链路，再谈手册。

## 一、死链是什么

R2-④ 那轮把 `/workspace/zy-curation` 这条死路由的**四处深链**逐个改了靶
（⌘K `locateOnly` / 网页浮层 `resLocateRoute` / AI 面板 / 仪表盘归因），
并留下一条断言：「代码内该路由字面量零残留」。

★**但四处深链共用的那个算式本身没改。** `shared/utils/locate.ts` 的 `locateTargetOf`
资源卡分支一直是：

```ts
return { path: `/workspace/${r.workspaceId}`, query }   // 无条件拼
```

V3.7.0（R179）之后 `r.workspaceId` 对池卡恒等于 `zy-curation`，而池**不是一枚 workspace 实体**
（`stores/app.ts` 的 workspaces getter 显式过滤掉它，`defaults.ts` 新建库也不含它），
所以凡走这个算式的调用点，对池卡一律跳「策展台不存在」死页。

**为什么 R2-④ 的断言没抓到它**：那条断言查的是**字面量** `/workspace/zy-curation`，
而这里是模板串 `/workspace/${r.workspaceId}`——字面量零残留为真，死链照样活着。
这是"负判据查字面量、真凶是拼接"的典型漏网。

## 二、受影响的四个活消费点

| 调用点 | 用户动作 | 修前结果 |
| --- | --- | --- |
| `GlobalPopups.openSavedBoard` | **采集保存后按 Enter** | 死页（最高频入口） |
| `GlobalSettings.openStatCard` / `DrillCardList` | 知源仪表盘「全部卡片明细」点一张池卡 | 死页 |
| `CompassHome.locateRec` | 今日入台/移出明细点一张池卡 | 死页 |
| `useWsAssetHygiene.onDrillLocateAsset` | 策展台钻取抽屉点附件行定位来源卡（兜底分支） | 死页 |

## 三、修在哪里

落点收进一个算式，四个消费点与 background 全部改走它：

```ts
export function resourceLocateRoute(workspaceId: string, categoryId = ''): LocateTarget {
  // 池卡 → 调度台资源卡池 tab（/?hl&hk=res）；策展台卡 → /workspace/<id>
}
```

- `locate.ts` 的 `locateTargetOf` 资源分支改用它（一处修完四个消费点）；
- `App.vue` 的 `zy-locate` 消费端不再手拼路径；
- `background/index.ts` 的 `handleLocate` 不再 `const target = '/workspace/' + wsId`，
  三处 URL 拼接改由算式给；
- `useWsAssetHygiene` 的兜底分支同样走算式。

★页面侧与后台侧原先**各拼一次**同一个路径——那正是这条死链能同时活在两条路上的形状。
现在两边消费同一个函数，判据也钉这一对调用。

## 四、断言：1 重指 + 3 新增（1560 → 1563）

- `R110-B2-2` 原逐字钉 `query: { hl: cardId }` 并默认"跨台一定走 `/workspace/<id>`"——
  后者正是本轮要废的口径。锚点跟实现搬到 `resourceLocateRoute(r.workspaceId)` 的调用上，
  并加一条负判据：不许再出现 `path: \`/workspace/${r.workspaceId}\`` 手拼。
- 新增三条：落点算式在 `locate.ts` 一处（含池→`/` + `hk=res`，且资源分支不再无条件拼工作区路径）/
  三个消费端不再各自拼（App 与 background 同用一个算式）/ 采集后 Enter 那条链路不许指向死页。
- ★**自己写的新负判据又被注释自匹配咬了一次（本仓库第五次）**：`!gp.includes('/workspace/zy-curation')`
  用裸 `read()`，而 `GlobalPopups.vue:1271` 那段解释 R2-④ 改靶缘由的注释里正好有这个字面量 ⇒ 判据恒假。
  改走 `codeOnly`。

## 五、E2E 34 → 35（这条链路第一次有活体证据）

`E2E-35`：种一张池卡，真发一次 background 的单例定位消息（采集后按 Enter 走的就是这条），
核 ① 没落在工作区路由上 ② 没有「策展台不存在」文案 ③ 目标卡在池面板里渲染出来并被高亮过。
实测 `落点=#/ 非工作区死链=true 死页=false 卡上屏=true 高亮=true`。
★两条时序事实记进注释：① **落点 query 核不了也不该核**——`PoolCardsPanel` 的 `hl` watcher 是
`immediate` 的，消费完同一拍就 `router.replace` 抹掉 `hl/hk`（防重复定位），400ms 时读到的已是干净 `#/`；
② 高亮 `flash` 类只活 2s，必须轮询抓"曾经亮过"，睡完再查必然假红。
（首轮就是这两条各红一次，而链路本身是好的。）

## 六、门禁

typecheck 0 · 回归 **1563/0**（R4-Dd 基线 1560 + 3）· E2E **35/0** · 导入兼容 7/0 · 循环 **0** · build ✓ ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **88 图**（本轮无新增场景）·
索引一致 **178 文件 / 42,726 行**。ZIP 未重打包（未升版先例）。

## 七、边界如实

- 本轮只修**定位落点**。R2-④ 那四处深链的落点本来就是对的，没动。
- 盘点时另见一处**设计选择而非缺陷**：搜索面板里「好奇卡 → 转资源卡」把新卡放进
  `d.value.workspaces[0]`（原始数组第一枚，不是过滤后的 getter），回执文案还写着「存入待分类」。
  它今天不产生死链（新建库 workspaces[0] 是真策展台），但"第一枚"这个选法与池语义不一致。
  **没顺手改**——转卡落点是产品口径（入池 or 落某台），要用户定，已记账。
- 手册那句「Enter 直接打开看板并高亮新卡」现在才**第一次可以照实写**；D-e 手册重写按此口径落笔。
