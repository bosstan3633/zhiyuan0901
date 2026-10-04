# 交付说明 · R4-Fb · 撤掉那个从未进过构建的"降级弹窗"，出口改成「进应用开对应面板」（#117 已拍板）

**日期**：2026-10-04 · 基线 V3.7.1（`61392f4` R4-Ez）· **未升版**
**用户拍板**：#117 修法选 **B 撤降级路径**（不补构建入口、不占 ZIP 预算）。
**改了什么**：`src/background/index.ts`（降级出口整段换实现）、`src/newtab/App.vue`（两种入口都认）、`src/manifest.ts`（web_accessible_resources + action 标题）、**删除 `src/popup/` 三个文件**、`src/shared/storage/keys.ts`（`QC_PREFILL` 随消费方一起退役）、手册一处文案；判据 **新增 2 条 + 重指/随迁 6 条**；`e2e.cjs` **+1 条真跑用例**。

---

## 一、这条链原来是什么样（为什么必须撤）

`src/popup/index.html` 被三条命令（`quick-capture` / `open-tasks` / `inspire`）和扩展图标点击当作"内容脚本注不进去的页面（`chrome://`、扩展页、Web Store）的降级弹窗"打开。
但它**从未进过构建**：

- `dist/manifest.json` 的 `action` 里**没有 `default_popup`**；
- dist 里**没有 popup chunk**，`dist/src/popup/index.html` 只是被原样拷进去的，里面还写着 `<script type="module" src="./main.ts">`——那个 `.ts` 在产物里根本不存在；
- 结果：用户在那类页面按快捷键，得到的是一个**空白窗口**（`#app` 空）。

也就是说"降级"从来不存在，它只是让失败看起来像成功。

## 二、新出口：进应用打开同一块面板

`background` 里 `openPopupWindow()` + `anchorPosition()` 整段换成一个函数：

```ts
async function openQuickPanel(panel: 'capture' | 'curio' | 'taskcapture') {
  // 有已开的新标签页 → 聚焦 + 复用（发 zy-quick-panel 消息）
  // 一个都没有    → 新建 src/newtab/index.html?zy-panel=<panel>#/
}
```

`newtab/App.vue` 两种入口都认：消息 `zy-quick-panel` 与查询参数 `?zy-panel=`，都落到既有的 `gpOpen(panel)`（GP 是懒挂载的，`pendingPanel` 那条队列原样复用，不新写一套）。

**为什么不需要 prefill 通道**：应用内的采集/好奇面板本来就会从"最近的网页标签"取标题与链接（`GlobalPopups` 的 `getRecentWebTab()`），所以 background 里那份 `QC_PREFILL` 会话预填失去消费方，连同 `keys.ts` 的键一起删——**留着它就是一枚没人读的死键**。
`chrome.storage.session` 是浏览器重启即清的，删键不动用户任何持久数据。

**四条出口的落点**：`quick-capture` → 采集面板 · `open-tasks` → 任务面板 · `inspire` → 好奇面板 · 扩展图标点击 → 采集面板。`action.default_title` 从"点击打开采集小窗"改成"点击打开采集面板"（"小窗"这个词以前指的是那个空窗口）。

## 三、随迁清单：六条判据重指 / 一处登记表 / 手册与卡

删掉一个运行入口，会有一批"以此为证据"的断言当场变红——本轮全部**重指或升级**，一条没删：

| 判据 | 原锚 | 现在钉什么 |
|---|---|---|
| 四端 `zy-locate-workspace` 单例定位 | 含 `popup/App.vue` | 三端锚保留 + **新负锚**：全 src 的**代码**里再出现 `src/popup` 路径即红（吃 `codeOnly`，注释里讲历史不算）——防"半拉子入口"静默回流 |
| R23-4 好奇心来源 prefill | `popup/App.vue` 的 `curioSource` | 重指到应用内好奇面板：开面板先清空来源，有选中文本才从最近网页标签补 title/url |
| R54-9 `open-tasks` 分发 | `background` 里 session 的 `mode: 'task'` | 换成 `openQuickPanel('taskcapture')` |
| R55-10 三端分发 | 第四端是 popup 的 `mode.value = 'task'` | 换成降级出口本身：`openQuickPanel('taskcapture')` + App.vue 认 `zy-quick-panel` + background 带 `?zy-panel=` |
| R70-13 主数据写口 | 钉的是 popup 改走 repository | **升级成现扫负锚**：除 `repository.ts` 自己，全 src 代码里出现裸写 `zy_data_v2` 即红（比原来锚某个文件的字符串更硬） |
| R169-5 三槽口径单源 | 第三处表单是 popup | 换成 `ResourceEditForm.vue`（详情抽屉那处表单） |
| R69-1 术语统一 | 文件清单含 `/popup/App.vue` | 清单随真源缩短（否则 ENOENT 直接红） |
| R4-Ep 宽形态登记表 | `'popup/App.vue': 2` | 该行删除——**表随真源变**，不是把判据调松 |

另外：`gen-code-index.cjs` 的职责表删掉 `popup/App.vue`、`popup/main.ts` 两条；手册里"chrome:// 等会自动改用独立小窗"改成"会自动带你进知源并打开同一块面板，键位与浮层一致"。

★**顺手补的一条基建**：判据里现在有了共用的 `walkSrcFiles()` / `srcFileEntries()`（在 `helpers.cjs`），R4-Ez① 那段内联 walker 与本轮三条新负锚都用它——"现扫全 src"这类判据不该每处各写一份递归。

## 四、新增判据 2 条 + 运行时用例 1 条

- **R4-Fb①**：`openQuickPanel` 在位（复用已开页发消息 / 没有才新建带 `?zy-panel=`）、**四个出口都走它**（数 `await openQuickPanel(` 恰为 4 次）、App.vue 两种入口都认、manifest 的 WAR 不再声明 `src/popup`，并负锚 `openPopupWindow` 与 `src/popup` 不回流。
- **R4-Fb②**：钉 E2E-43 算 ok 的那个表达式（不钉用例标题）。
- **E2E-43**：两条入口都真跑——`?zy-panel=curio` 要真开出好奇面板（等不够补等一次再判死，不放宽判据）；从 SW 向已开新标签页发 `zy-quick-panel` 要真开出采集面板并按标题文本认。
  ★为什么两条都要测：只测一条会放过"另一条其实接不上"的半拉子实现——那正是这次要修的病的形状。

**变异自证 6 条**（每条注入后跑全量回归 → 还原 → 逐字节 sha 自证 → 复跑回绿 1640/0）：

| 探针 | 注入 | 红的是谁 |
|---|---|---|
| F1 | 四个出口少接一个：`await openQuickPanel('capture')` → `void 0` | R4-Fb① 红（`(bg.match(/await openQuickPanel\('/g)||[]).length === 4` 数到 3） |
| F2 | 应用侧不认降级消息：`'zy-quick-panel'` → `'zy-quick-panel-X'` | R4-Fb① 红 **且 R55-10 也红**——本轮重指的 R55-10 与它共享 App.vue 的消息锚，两条各管一件事 |
| F3 | manifest 把 `src/popup/index.html` 声明回 WAR | R4-Fb① 红 **且「四端 `zy-locate-workspace` 单例定位」也红**（新负锚不是只有一条在守） |
| F4 | 摘掉 ① 里 background 那处 `codeOnly` | R4-Fb① 红。★这条证的是 `background/index.ts:61` 那条**注释**里写着 `src/popup/index.html`：不吃 codeOnly，历史说明就被当成违规。**注释会被判据当证据**本轮第二次遇到（第一次是 R4-Ez 的 Z1） |
| F5 | 摘掉 E2E-43 的「补等一次」那段 | R4-Fb② 红（②锚的是算式片段，不是用例标题） |
| F6 | 代码里回流一枚 `src/popup` 路径（半拉子入口回来的形状） | R4-Fb① 红 + 四端负锚红 + **R163-1 也红**（插一行改了 background 行数，索引反漂闸顺手抓住——它连"注释级改动"都不放过） |

---

## 五、门禁（★下面每一行都出自**最后那份 dist**）

先记一条 dist 事实，因为它决定了这一节要不要重跑：主体改完之后我又订正了 6 处注释——这条链的注释被我误标成了上一轮的轮次名（`R4-Fa`，实际是 `R4-Fb`）。其中两处在 `App.vue` ⇒ **改 .vue 的注释会换 scoped `data-v` 作用域 id，构建产物字节跟着变**（R4-Ez 第一次量到这个机制，本轮第二次实证）。dist 聚合哈希 `0b907a78f40bb5a4` → `64fbbb912964085b`，所以 e2e / theme-audit / 像素 A/B / perf **整套在新产物上重跑**，没有一行读数沿用旧 dist。

- **回归 `1640 通过 / 0 失败`**（既有 1,638 条零减免零翻转，判据 +2）· 分片最大 730 行 ≤900（R164-2）
- **E2E `43 / 0`**（+E2E-43 两条入口都真跑，跑在 `64fbbb91…` 上）
- `npm run build` ✓（`vue-tsc --noEmit` 内联，**0 错误**）
- **theme-audit `104 图 / 0 ✗`** + 类名普查 **831 token**（★新 dist 重跑；token 与 R4-Ez 同为 831——popup 从未进构建，DOM 类名集合本来不会变，这条读数是"确实没变"的证据而不是推测）
- **像素 A/B 两对**（`img-diff --batch`，同日子同种子）：
  - 撤降级前后（R4-Ez 那份归档 vs 本轮 `0b907a78…`）：**0 差 99 / 抖动 4 / 变化 1**。唯一那张 `raycast-st-manual.png`＝变化像素 93,912、差异带高 842 行、单通道最大差 228、包围盒 `0,58,1439,899`——与 R4-Ex 记下的 #127 **数字逐位吻合**，不是本轮引入 ⇒ 撤降级出口无可归因视觉变化。
  - 注释订正前后（`0b907a78…` vs `64fbbb91…`）：**0 差 102 / 抖动 2 / 变化 0**。★副产品一条：上一对里那张 `raycast-st-manual` 在这一对落回 0 差 ⇒ #127 那族确实**偶发**，与"连采三对里出现过一次"的描述一致。
- **perf 串行独占共五跑**（R173 口径：报最小值、并列散布，只报无回退）：
  - 新 dist `64fbbb91…`（两跑）：M1 **557–559ms** · M3 **262ms**（两跑同值）· M5c 唤起 **22ms** · M5d 键入 16–17ms · M14 **962 节点 / 首屏 32 卡** · M15 关着仍驻留 **7,158–7,165KB / 每卡 2,839B**
  - 旧 dist `0b907a78…`（三跑）：M1 534–549ms · M3 145–150ms / 2 次（最大单任务 90–93ms；另有一跑 1,978ms / 32 次离群，未归因）· M5c 30ms（中位 39.5、阻塞 109ms）· M5d 14.6ms（命中 801 行·渲染 30 行）· M14 962 · M15 7,164KB / 2,839B
  - ⇒ **不报提速**。M3 从 150 → 262ms 落在项目自己记的"M3 类四次可差近 5 倍"散布内，本轮不据此说任何事。
- 代码索引 **176 文件 / 42,268 行** · 债务候选 10 个 · 循环依赖 **0** · 导入兼容 **7 / 0** · 入口字面量源码闭包与入口 chunk **双向 15 项全 0**
- **ZIP 未重打包、未 push**（撤一个从未进构建的入口不改变产物结构；真机复核在 R5 收口前）

★**两条自伤先记账**（都关于"产物 vs 注释"和"独占"）：
1. 门禁链跑到 perf 那一步时，我为了点名"变化 1"是哪张图，**并行**重跑了一次 `img-diff --batch`（脚本里用 `tail -8` 把逐张 `✗` 行截掉了——本该一开始就写在链里而不是事后补跑）。perf 要求独占机器 ⇒ 链里那一跑作废，改成上面的串行采样。补一条纪律：**链在跑时不并行任何吃浏览器的命令；要补的证据写进链里。**
2. 6 处注释订正发生在整套门禁跑完之后。按"只改注释不动产物"的老直觉本可以不重跑，但 R4-Ez 已经量到 `.vue` 注释会换 `data-v` ⇒ 本轮按"产物变了"处理、全套重跑。**教训不是"别改注释"，是改完 `.vue` 的任何一字节（注释也算）之前先假定 dist 会变。**

---

## 六、边界如实

1. **没证的是真机动线**。E2E-43 证的是两种程序入口（`?zy-panel=` 与 `zy-quick-panel` 消息）各自能真开出面板；「用户在 `chrome://` 页按快捷键 → 被带进应用并开面板」这条完整动线要在真 Chrome 里点一次才算数，属 R5 收口前那批真机复核。
2. **`setTimeout(…, 700)` 没有单独时序证明**。新建标签页那条走查询参数，等 700ms 是沿用 `zy-anchor` 的既有节奏（等 store 载入），本轮没为这个数做测量；E2E-43 里"3s + 补等 2.5s 才判可见"是测试的等待，不是产品延迟。
3. **M3 的第一跑离群**（1,978ms / 32 次，同产物后两跑 145–150ms / 2 次，差一个数量级）——本轮没归因，只报散布。产品侧改动只有降级出口，不在 M3 的合成压力链路上。
4. **负锚只认 `src/popup` 这个字符串**。若将来有人把那个空窗口复活成别的路径（`src/fallback/` 之类），R4-Fb① 不会红，「四端单例定位」的 WAR 锚也不会红。真正兜住它的是 manifest 里 WAR 只剩 `assets/*` 这一处事实 + 真机复核。
5. **`action.default_title` 改了文案**（"小窗"→"面板"），这是用户可见文案，但不在 theme-audit 的取景面里（浏览器工具栏提示），本轮没留视觉证据。
6. 撤降级带来的**行为变化**是取舍本身：以前在 `chrome://` 按快捷键得到一个空白窗口，现在会被切到一个已开的新标签页（有则聚焦复用，无则新建）。**多标签页用户会被"选中某一个"新标签页**——这是"进应用"路线的固有语义，不是 bug；真机复核若觉得选错了页，回到拍板层重议。
7. 轮次名订正（`R4-Fa`→`R4-Fb`）只改了注释文字，**没有**加一条"轮次名不许写错"的棘轮——这类错要靠人读 diff，机器分不清哪个轮次名是故意的历史引用。
