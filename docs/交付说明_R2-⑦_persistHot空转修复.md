# 交付说明 · R2-⑦ —— `persistHot()` 空转的两层病根（未升版 V3.7.0）

日期：2026-09-30 · 基线：`5773da8`（R2 第二批 池语义收尾）· 触发：上一轮把这条缺陷记为「另轮专修」（任务 #98），本轮开工到闭合。

## 一、症状与影响面

`shared/storage/hotStats.ts` 是 R148-P0b「热度统计拆键」的小载荷落盘通道：改一张卡的 `callCount/lastCalledAt` 不该重写整库。但**全站每一次 `store.persistHot()` 都在空转**——写盘函数从来没成功过，只是没人知道，因为两条失败路径都被静默 catch 吞了。连带失效的有三处：

- R148-P0b 热度拆键快通道：热度实际只在整库保存时顺带写出（`repository.saveData` 那条路径自己绑得好好的，所以表面看不出来）；
- R173-T2 的 `immediate=true` 页隐藏补写：注释写「赶在页面冻结前发出」，实为对着空气补写；
- R172-T1 的「调出」事件：`enqueue` 只置 dirty，靠下一次整库保存的 `takeEventLogPatch()` 带出——用户「只看不改」（打开一张卡就走）时事件留在内存里，关页即丢。

## 二、两层病根（第二层被第一层掩盖）

1. **丢接收者**：`store()` 把 `chrome.storage.local.set` 摘成裸引用返回，调用时没有 `StorageArea` 这个接收者 ⇒ Chrome 抛 `TypeError: Illegal invocation: Function must be called on an object of type StorageArea`。修法：`set.call(area, o)`。
2. **载荷里混进 Vue Proxy**：`extractHot(d)` 把 `stats: d.stats` 从 **reactive 主树按引用**摘下来，`chrome.storage` 的结构化克隆吃不下 Proxy ⇒ `DataCloneError`。这条只在①修好后才暴露——正是 V2.17.1 那条老教训（入存储前必须 JSON 净化）在热度键上重演了一遍。修法：`extractHot` 出口整体 round-trip 一次。

顺带把 `writeHot` 的 set 载荷并入 `takeEventLogPatch()`（无待写事件时返回 null，零额外开销），与 `repository.saveData` 同一条「一次用户动作 = 一次 IPC」口径，调出事件不再等整库保存。

## 三、上一轮为什么撤回它（以及我错判了什么）

上一轮把①绑回去之后 `E2E-5 双击卡片打开本地 PDF 的 file:// 通道`转红（同构建只回退这一处即复绿），当时我判断是「单击开抽屉多出的那次真实存储写插在双击与 `window.open` 之间，吃掉了弹窗时序/用户激活」，并据此把修复推给下一轮、还把 E2E-26 的取证改成强制整库保存以绕开「headless 后台页定时器被节流」。

**两个判断都错了。** 本轮给 `window.open` / `chrome.downloads.download` / `chrome.storage.local.set` 套上时间戳探针，在真实 e2e 序列里量到的是：

```
44ms click / click / dblclick
55ms dl.start → 58ms dl.cb → 91ms storage.set zy_file_paths → 297ms storage.set zy_stats_v1,zy_event_log   ← 修好后
21ms storage.set zy_stats_v1,zy_event_log → 26ms storage.set zy_error_log                                    ← 修坏时：没有 dl.start
```

不是弹窗被拦，是**写失败把 dblclick 链路整个打断**（克隆异常沿调用栈抛出，`downloads.download` 根本没被调用，错误被留痕机制记进 `zy_error_log`）。修完②之后 E2E-5 复绿，且 E2E-6 从「1 条，最新=resource/call」恢复成「2 条，最新=resource/delete」——delete 事件此前也被同一次失败挤掉过。E2E-26 也已改回**自然 250ms 防抖路径**并通过，不再依赖测试侧强制保存。

教训写在这里：**「修复让另一条门禁变红」不等于「修复有副作用」，也可能是修复把一个被掩盖的第二个缺陷暴露成显式失败**——先量到失败点再决定撤不撤。

## 四、断言与门禁

- 新增 2 条：R2-⑦ 两层病根判据（`set.call(area, o)` 在位且裸返回形态绝迹 + `extractHot` 出口净化并点名 DataCloneError）、R2-⑦ 调出事件随热度写并入同一次 set。
- 门禁：**typecheck 0 · 回归 1524/0（R2 第二批 1522 +2）· E2E 26/0（E2E-5 复绿、E2E-26 走自然落盘路径）· 导入兼容 7/0 · 循环依赖 0 · build ✓ · 入口字面量双向 15 项全 0 · theme-contrast 全绿（4×14）· theme-audit 64 图（`docs/视觉归档/2026-09-30`）· 代码索引一致（175 文件 / 42,761 行）**。
- 探针脚本 `/tmp/zy_detached_set.cjs`、`/tmp/zy_dbl_open_probe.cjs` 不入库。

## 五、销账与后续

- 任务 #98 闭合。上一轮交付说明 §二 的「另轮修」记账到此结清；该轮 E2E-26 的取证方式（强制整库保存）已回退为自然路径。
- 真实用户侧的可见变化：打开卡片详情 / 切换策展台等热度动作会在 250ms 内落盘，不再等下一次改库；关页不再丢「调出」流水。**建议真机复核两件事**：① 双击本地 PDF/HTML 附件卡仍能开新标签；② 仪表盘热力图的「调出」列在只浏览不编辑的一天里不再空。
- 下一轮候选不变：R2 第三批（`PoolCardsPanel` 三视图 / 批量 / 新建 / 本地文件导入入口重落 / 池卡渲染上限）、仪表盘 R3 收尾（F38 高亮开关）、发版轮账（ZIP 超预算 2,758B、文档追平、旧称 286 处）。
