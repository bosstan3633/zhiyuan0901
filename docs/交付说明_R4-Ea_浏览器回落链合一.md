# 交付说明 · R4-Ea —— 浏览器回落链合一（挂账 #84），顺带救回 img-diff（未升版）

挂账小项第一件（用户 2026-10-01 拍板：先清挂账，再统一真机实测）。
标题写的是"逻辑合一"，**做下去发现它已经造成了一个真实的工具失效**。

## 一、起因：一条链抄了七份，抄坏了其中一份

四级回落（pinned → `ZY_CHROME` → 本机任一 `ms-playwright/chromium-*` → 系统 Chrome）此前在
`e2e / perf / perf-census / probe-f / theme-audit / test-import-compat / img-diff` 七个门禁脚本里各抄一份。
七份并不一样，最糟的那份是 `img-diff.cjs`：它**只写死了一条 `chromium-1234` 路径**，没有回落。

★实测它已经跑不起来（本机缓存只有 `chromium-1148`）：

```
img-diff 失败：browserType.launchPersistentContext: Failed to launch chromium because
executable doesn't exist at …/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/…
```

而 `img-diff` 是 R161 立来回答"这次到底改了像素没有"的工具（md5 会骗人：同包重采 md5 不同而逐像素 0 差异）。
**它坏掉没有任何门禁会红**——它是手动工具，不在回归链里；这类"防线自己烂了没人知道"正是合一要解决的。
另两处不一致：缓存目录扫描只写了 mac 分支（Windows 上等于没有第三级），`perf-census` 的回落顺序与其余几份不同。

## 二、落点

新增 **`scripts/browser.cjs`**（唯一实现，导出 `CHROME / resolveChromium / cacheRoot`）：

- pinned 支持 mac（`chrome-mac-arm64/Google Chrome for Testing` 与 `chrome-mac/Chromium` 两种布局）/
  win（`chrome-win64/chrome.exe`）/ linux（`chrome-linux/chrome`），mac 允许两个候选版本；
- `ZY_CHROME` 第二级（显式指定优先于自动猜）；
- 第三级扫本机任意 `chromium-*`（**优先于系统 Chrome**——系统 Chrome 的旧 headless 起不了 MV3
  service worker，E2E-1 会直接超时；这是 R128/R149 踩出来的口径，不该靠记不记得设环境变量）；
- 第四级系统 Chrome；全都没有才回 pinned，让报错里出现"本该存在的那个路径"，比报一个含糊的解析失败好诊断。

七个脚本各自那 3–23 行解析块全部换成 `const { CHROME } = require('./browser.cjs')`。
**实测规模**：七个脚本 `+50 / −129`（净 −79 行），新增 `browser.cjs` 78 行（其中 22 行是"为什么要有它"的注释），
所以总行数几乎持平——**这一刀买的不是行数，是"改一处就七个门禁一起生效"**：
上一条那句 img-diff 的坏路径，如果早有这份实现，就不会有七份里的一份烂掉而无人察觉。
`perf.cjs` / `perf-census.cjs` 本轮只改解析、不跑（perf 三采样必须串行独占，留到性能轮）。

## 三、判据 +2（1577 → 1579）+ 3 条随迁

- **R4-Ea① 四级顺序不许倒**：`pinnedCandidates` 的下标 < `ZY_CHROME` < `anyCachedChromium` < `systemChrome`
  （★用下标比较而不是切片取反——R4-Da 那条"锚点遇已删串恒真"的教训），
  且 mac/win/linux 三套路径都在、导出面在位、不许出现 `process.argv`（它是基建不是命令行工具）。
- **R4-Ea② 七个脚本都必须从 browser.cjs 取**，且 `codeOnly` 后不许再出现 `ms-playwright`
  （★走 `codeOnly`：`browser.cjs` 的缘由注释里就写着这些字面量，裸读会自匹配——这条纪律本仓库已咬过五次）。
- **随迁三条**（口径不放宽，只把锚点跟实现搬走，且每条都新增负判据）：
  - `R56-33`（脚本跨平台）原要求 e2e 与 import-compat **各自**含 `process.platform === 'darwin'`；
    现改为：mac/win/linux 三套在 `browser.cjs` 里 + 两个脚本都 `require('./browser.cjs')` + 两个脚本自己不许再拼路径。
  - `R155-11`（probe-f 常驻化）原逐字要求 probe-f 里出现 `ZY_CHROME`（那是回落链的字面证据）；
    链上收后改判"probe-f 从 browser.cjs 取" + `browser.cjs` 里确有 `ZY_CHROME`。
  - `R169-26`（scripts 根白名单）登记 `browser.cjs`，17 → 18，备案写明它是门禁基建不是探针。

### 活性（改坏必须能红）

| 变异 | 结果 |
| --- | --- |
| Z1 让 `e2e.cjs` 再拼一份 `ms-playwright` 路径 | R4-Ea② + R56-33 双红（1577/2） |
| Z2 把 `browser.cjs` 的回落顺序倒过来（环境变量压过 pinned） | R4-Ea① 红（1578/1） |
| Z3 让 `img-diff.cjs` 不走共用解析 | R4-Ea② 红（1578/1） |

★探针备份一律放 `/tmp`：上一轮把 `.bak` 落在 `scripts/` 根目录，被 `R169-26` 白名单当场判红——
那条红是探针自己的垃圾而不是被测改动，记在这里免得下次误读。

## 四、门禁

typecheck 0 · 回归 **1579/0**（R4-Di 基线 1577 + 2）· E2E **36/0** · 导入兼容 7/0 ·
**probe-f 7/0**（发版门禁，本轮实跑过：F-1b 版本比对、F-3c Alt+3 落策展台全过）· 循环 **0** ·
入口字面量双向 **15 项全 0** · contrast 全绿 **4×14** · theme-audit **92 图** · 索引一致 **178 文件 / 42,772 行**
（★src 未变，本轮只动 `scripts/`，所以索引总数不动；`browser.cjs` 不在 src 索引范围内）。
ZIP 未重打包。

**工具救回的凭据**：`node scripts/img-diff.cjs <A> <B>` 实测恢复可用——
拿 `linear-st-airtable.png` 与 `raycast-st-airtable.png` 对比，输出
`差异像素 1,260,015/1,296,000（97.2234%）最大通道差 94 包围盒 0,0,1439,899`（两主题本就整屏不同，数字合理）。

## 五、边界如实

1. **没跑 `perf.cjs` / `perf-census.cjs`**：本轮只把它们的解析块换成共用实现（`node --check` 过），
   perf 三采样必须串行独占、且本轮 src 未变，跑它没有信息量、还会污染读数；下次性能轮自然覆盖。
2. **"清一次性脚本"这半件已经不需要做**：`scripts/` 根目录 18 个文件全是登记过的门禁/量具/生成器，
   一次性探针 9 个早在 R164-E4 就归档进 `scripts/archive/`（R169-26 就是钉这件事的）。
   本轮没有删 archive 里的东西——它们是往轮探针的出处记录，删了只是让历史变短。
3. `pinned` 版本清单（`chromium-1234` / `chromium-1223`）是**猜的兼容集**，不是 Playwright 声明的期望版本；
   真正的兜底是第三级"本机任意 chromium-*"。若哪天 pinned 命中了与 `playwright-core` 不兼容的构建，
   现象会是启动报错而不是静默错判——那时改 `browser.cjs` 一处即可，这正是合一的意义。
