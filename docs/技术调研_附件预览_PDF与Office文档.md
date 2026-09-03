# 技术调研 · 常见附件（PDF / Word / Excel）新标签页打开可行性

> **轮次**：第卌四轮技术调研（不动工，决策后再排开发任务）  
> **日期**：2026-09-03  
> **核心问题**：PDF/Word/Excel 等附件能否在新标签页打开？  
> **结论先行**：✅ **PDF 完全可行**（真机实测 Chrome 内置 PDF viewer 在 file:// 下完美渲染）；✅ **Office 走 downloads.open 唤起系统应用可行**（需加 1 个权限）。

---

## 一、用户三问的精确回答

### Q1. 卡片挂图片/HTML 存浏览器插件生态，是不是基本没空间限制？
**准确回答**：受磁盘剩余空间约束，理论"基本无限制"（不是数学无限）。

| 存储位置 | 容量上限 | 来源 | 实测 |
|---------|---------|------|------|
| `chrome.storage.local`（主 JSON `zy_data_v2`） | `unlimitedStorage` 权限豁免后仅按配额，但实际从来不存大文件（性能红线）| `manifest.ts:9` 含 `'unlimitedStorage'` | — |
| `IndexedDB zy_assets`（附件 Blob 二进制） | **浏览器磁盘剩余空间的 60%**（Chrome 共享配额）| `shared/storage/assets.ts` | ✅ 实测 `navigator.storage.estimate()` → **47.85GB**（磁盘剩余约 80GB）|

- 风险：用户清理浏览器数据 / 磁盘写满 → 数据不可逆丢失（与历史 V2.18 落地盘 file:// 副本是冗余保险）
- 改进空间：设置页加"配额 + 占用"展示（V2.18 已落盘副本未纳入统计），见 §六 拍板

### Q2. 图片点击预览/左右切换、HTML 双击下载后新标签页打开且不重复下载，现状如何？

✅ **完全实现，且已回归测试**（V2.18 第卌二轮）：
- **图片**：`AssetBadge.openAsset` → 多图 blob 预加载 → `AssetPreview` 弹窗（posLabel n/N + ‹ › 箭头 + ←/→ 键盘），源码 `shared/components/AssetBadge.vue:65-89` + `AssetPreview.vue`
- **HTML**：`shared/utils/htmlAsset.ts`（144 行）已落盘完整链路 —— 落盘「下载目录/知源附件/」 → `chrome.tabs.create({url: file://})` → 路径记忆存独立键 `zy_html_paths`（V2.18.1 后也修了 `downloads` 权限漏加的 bug）

### Q3. PDF/Word/Excel 能否新标签页打开？技术路线？

**结论**：✅ **PDF 可行（实测验证）**，✅ **Office 可行（走系统应用）**，详见 §三。

---

## 二、实测验证 · PDF 新标签页打开

### 方法
1. Python 构造一份最小单页 PDF（663 字节，含 "ZHIYUAN PDF TEST 9527" 文本）→ `zy_e2e_v2_19/sample.pdf`
2. Playwright 启动 Chromium-1223 → 新建标签页 `goto('file:///.../sample.pdf')`
3. 检测渲染产物（DOM + 截图）
4. headless / headful 各跑一次

### 结果（来自 `probe_pdf4.mjs`）

| 项 | headless | headful |
|----|---------|---------|
| URL | `file:///C:/.../sample.pdf` ✓ 保持 | ✓ 保持 |
| DOM 接管 | `<link href="chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/pdf_embedder.css">` —— Chrome 内置 PDF viewer 扩展注入 ✓ | ✓ |
| 视觉渲染 | （截图略，肉眼可读）| ✅ **`ZHIYUAN PDF TEST 9527` 文字、左侧第 1 页缩略图、100% 工具栏、翻页/下载按钮** 全部正常 |

**判定**：✅ **实测可行。** file:// PDF 完全由 Chrome 内置 PDF viewer 接管渲染，**与 HTML 落盘打开走的是同一通道**（file:// 新标签页）。截图 `zy_e2e_v2_19/pdf_headful.png` 可视化。

### 实测附带的 API 探测（来自 `probe_pdf.mjs` / `probe_pdf3.mjs`）
- ✅ `chrome.downloads.open(downloadId)`：**存在**，能调用 —— 文档原话「Opens the downloaded file now if the DownloadItem is complete … **This method requires the `"downloads.open"` permission in addition to the `"downloads"` permission.** **This method can only be called in response to a user gesture.**」
- ✅ `chrome.downloads.show(downloadId)`：**存在**（同步无回调）—— 在文件夹中显示
- ⚠️ Office 文档（.docx/.xlsx/.pptx）走 `file:// tabs.create`：**会被 Chrome 当作无法渲染的 MIME → 触发二次下载（不是打开）**，所以 Office **必须走 `downloads.open` 唤起系统默认应用**（Word/WPS/Excel），不能复用 PDF 通道

---

## 三、技术路线（三档方案对比）

### 方案 A · PDF：复用 htmlAsset 通道（推荐 · 最小改动）

**核心思路**：把 `htmlAsset.ts` 泛化为 `fileAsset.ts`（已落盘 file:// 新标签页通道），支持 `pdf` 类型。

| 改造点 | 文件 | 改动 | 工作量 |
|--------|------|------|--------|
| 1. 扩展 AssetMeta.kind | `shared/models.ts` | `'image' \| 'html'` → 增 `'pdf' \| 'doc' \| 'xls' \| 'ppt'` | 5 分钟 |
| 2. AssetManager guessKind 增加 PDF/Office MIME 识别 | `shared/components/AssetManager.vue:43` | 增 `application/pdf` → 'pdf'、`wordprocessingml` → 'doc'、`spreadsheetml` → 'xls'、`presentationml` → 'ppt' | 15 分钟 |
| 3. AssetManager 上传上限：图片 10MB / HTML 20MB（现状），新增：PDF 50MB / Office 30MB（建议默认值，可后续配置） | `AssetManager.vue:33-34` 常量区 | 加 `PDF_MAX_MB / DOC_MAX_MB` 等常量 | 5 分钟 |
| 4. AssetManager 浮层图标/统计/单卡片多 PDF 暂不支持（与 HTML 唯一同构 —— PDF/Office 一卡一份） | `AssetManager.vue` 模板与 `replaceOld` 逻辑 | 类比 HTML 处理 | 20 分钟 |
| 5. htmlAsset.ts 改名/泛化为 `fileAsset.ts` | `shared/utils/htmlAsset.ts` → `fileAsset.ts` | 函数签名 `openFileAsset(meta: AssetMeta)` 按 kind 分发；kind==='html'/'pdf' 走落盘 file:// 通道；kind==='doc'/'xls'/'ppt' 走 downloads.open 通道（见方案 B）| 半天 |
| 6. 路径记忆键改名 `zy_html_paths` → `zy_file_paths`（数据迁移：旧键读取并并入） | 同上 | 一次迁移，V2.19 升级自动兼容 | 10 分钟 |
| 7. AssetBadge / ResourceEditForm / CuriosityPanel / CompassActions / Workspace 双击的 'kind===\'html\'' 分支 | `AssetBadge.vue:87` `Workspace.vue:642` 等 | 改 `kind === 'html' \|\| kind === 'pdf'`（file:// 都走 openFileAsset）| 30 分钟 |
| 8. regression.cjs 新增 R44 批次（识别 kind、泛化通道、MIME、kind 路由、双击正则分支、downloads.open 权限） | `v2/scripts/regression.cjs` | 8~10 项 | 30 分钟 |

**总工作量**：**1~1.5 天**（含 E2E 走 DataTransfer 上传 + 真机 file:// PDF 渲染验证）

**风险与前置条件（用户首次使用需确认）**：
1. ⚠️ **Chrome 设置 → `chrome://settings/content/pdfDocuments`**「下载 PDF 文件而不是在 Chrome 中自动打开它们」如果被用户开启 → file:// PDF 会被下载而非打开（罕见场景，Chrome 默认是打开的）。可在落盘后 tabs.create 失败时降级到 `downloads.open` 走系统 PDF 阅读器
2. ⚠️ 「允许访问文件网址」扩展权限需开启（与现有 HTML 同）
3. ⚠️ Chrome PDF viewer 在 `file://` + `chrome-extension` 跨域场景下稳定渲染（已实测），但 IE-only 字体/中文/特殊渲染未实测 → 建议先放小流量验证

### 方案 B · Office：downloads.open 唤起系统默认应用（叠加方案 A）

**核心思路**：PDF 走 file:// 通道；Office（.docx/.xlsx/.pptx）落盘后调用 `chrome.downloads.open(id)`，Chrome 调起已注册的系统应用（Word/WPS/Excel/PPT）。

| 改造点 | 文件 | 改动 | 工作量 |
|--------|------|------|--------|
| 1. manifest permissions 加 `'downloads.open'` | `manifest.ts:9` | 加 `'downloads.open'` | 1 行 |
| 2. openFileAsset 按 kind 路由 | `fileAsset.ts` | 'doc'/'xls'/'ppt' → 落盘后 `chrome.downloads.open(id)`（**必须在用户手势回调内调用**——onClick 直接调，不要 await/setTimeout 包太深）| 半天 |
| 3. UI 提示（Office 不在浏览器内打开而是调用系统应用） | `AssetBadge.vue` 浮层 + `openFileAsset` Toast | 加 "📁 将在系统应用打开" 引导文案 | 10 分钟 |
| 4. 兜底：`downloads.open` 失败（用户未装系统应用） → 走 `downloads.show` 在文件夹显示 | 同上 | 降级链 | 10 分钟 |
| 6. E2E 验证 downloads.open API 可调用（已实测） + 人工验证系统应用唤起（无头环境无法唤起） | `e2e_v2_19.mjs` | 4~5 项 | 1 天（含人工手测） |

**总工作量**：**1~2 天**（含 manifest 权限变更提示文档）

**风险与边界**：
- ⚠️ **`downloads.open` 必须用户手势内调用**（Chrome 严格手势判定）。如果代码路径是「双击 → openFileAsset → await downloads.download → await onChanged → chrome.downloads.open(id)」，**最后这个 open 调用会被拒**（手势已失效）。**必须把 open 调用与用户手势同步**（建议：先拿到 dlId 后立即 open，避开 onChanged 等待）。这一条需要走真实链路 E2E 验证
- ⚠️ **macOS**：用 `open` 调起；**Windows**：用 ShellExecute；Linux：用 xdg-open；Chrome 内部处理这些，开发者无需关心
- ⚠️ 用户未装系统应用 → 失败（Toast 引导下载 + 兜底 show() 打开文件夹）
- ⚠️ 用户装的是 WPS 而非 Office？WPS 默认关联 .docx，没问题。但移动端/远程桌面场景可能不一致

### 方案 C · 内嵌 pdf.js viewer（可选后续 · 工作量大）

**核心思路**：在扩展内自建 viewer 页面（`src/viewer/pdf.html`），用 PDF.js 渲染（不依赖 Chrome 内置 viewer / 系统应用 / 落盘），多页左右切换体验与现有图片预览器一致。

| 改造点 | 文件 | 改动 | 工作量 |
|--------|------|------|--------|
| 1. 安装 pdf.js（已 vendor PDF.js MV3 范例，开源 `pdfjs-dist`，约 1~2MB，可分包懒加载）| `v2/src/vendor/pdfjs/` | 引入 worker + 主包 | 半天 |
| 2. 新建 viewer 页（iframe 沙箱 + 自建工具栏 + 页码 + 缩放 + 左右切换） | `v2/src/newtab/views/PdfViewer.vue` 或独立 viewer.html | UI/工具栏/键盘 | 1~2 天 |
| 3. AssetBadge / AssetManager 路由：图片走 AssetPreview、PDF 走 PdfViewer（弹窗式或新标签式）、Office 走 downloads.open | `AssetBadge.vue` 等 | kind 路由 | 半天 |
| 4. CSP 兼容（pdf.js worker 需 `worker-src 'self'` + `script-src 'self' 'wasm-unsafe-eval'`，MV3 默认允许需声明） | `manifest.ts` 加 `content_security_policy.extension_pages` | CSP 调整 | 半天 |
| 5. 性能/内存：大 PDF 多页要虚拟滚动，否则几百页会卡 | PdfViewer | IntersectionObserver + render queue | 1 天 |
| 6. 文档迁移：原有"file:// 打开"用户习惯可能需要并行保留一段时间 | 全局 | 配置开关 | 半天 |

**总工作量**：**5~7 天**

**何时选 C**：
- 用户希望 PDF 体验与图片预览一致（弹窗/左右切换/缩放/搜索）
- Chrome 内置 viewer 不够用（如需批注/表单填写/签名）
- 不希望文件落到磁盘（隐私敏感场景）

**何时不选 C**：
- 简单预览 → A 方案足够（Chrome viewer 已提供页面/缩放/下载/打印/搜索全部功能）
- 工期紧

---

## 四、推荐实施路线（与拍板选择）

| 方案组合 | 工作量 | 体验 | 推荐 |
|---------|--------|------|------|
| **A 单独**（PDF） | 1~1.5 天 | PDF：浏览器内置 viewer（完整功能）| ✅ 立即做 |
| **A + B**（PDF + Office） | 2~3 天 | + Office：系统应用唤起 | ✅ 推荐做 |
| **A + B + C**（全做） | 7~10 天 | + PDF 自建 viewer（可选体验增强）| ❌ 暂缓，留 V2.20+ 视需求 |

---

## 五、对三个用户问题的直接答复

1. **空间限制**：IndexedDB 配额 = 磁盘剩余空间 ~60%（实测 47.85GB），理论"基本无限制"但受磁盘约束；Chrome storage local 有 `unlimitedStorage` 权限豁免，附件二进制从不进主 JSON。✅ 现状合理，可考虑设置页加配额/占用展示（V2.18 已落盘的副本未纳入统计）。

2. **图片预览 / HTML 打开现状**：✅ 完全实现（V2.18 第卌二轮交付），已 E2E 验证。

3. **PDF/Word/Excel 新标签页打开**：
   - **PDF**：✅ **能**，复用现有 htmlAsset 通道，1~1.5 天落地
   - **Office（.docx/.xlsx/.pptx）**：✅ **能**，但走「落盘 + 调系统默认应用」通道（不在浏览器内渲染），需加 `downloads.open` 权限 + 用户手势内调用，1~2 天落地
   - **终极体验**（pdf.js 内嵌 viewer）：可后续做，体验与图片预览同构，5~7 天

---

## 六、待用户拍板（按惯例先核实再动工）

| 拍板 | 选项 | 推荐 |
|------|------|------|
| **Q-1**: 是否做 PDF 新标签页打开？| A: 是，立即做 / B: 否，暂缓 | **A**（实测可行，成本低）|
| **Q-2**: 是否同时做 Office（.docx/.xlsx/.pptx）走系统应用？| A: 是，与 PDF 一起做 / B: 只做 PDF / C: 否，都不做 | **A 或 B** |
| **Q-3**: PDF 走哪种实现？| A: 方案 A（file:// + Chrome viewer，推荐）/ B: 方案 C（内嵌 pdf.js）| **A**（除非有强需求）|
| **Q-4**: Office 是否需要"先打开新标签页预览（走 PDF 通道）"还是直接调系统应用？| A: 直接调系统应用（推荐）/ B: 先落盘再让用户决定 | **A** |
| **Q-5**: 配额/占用是否纳入设置页？| A: 是，立即做 / B: 否，V2.18 已落盘副本尚未统计（建议 V2.19 一并加）| **A**（小改动）|
| **Q-6**: 上传规范（图片 9/10MB、HTML 唯一 20MB 已定）→ 新类型上限？| A: PDF 50MB / Office 30MB / 一卡一份 / B: 单一上限 20MB / C: 用户自定义 | **A**（建议默认）|
| **Q-7**: 本轮版本号？| A: V2.19.0 新特性版 / B: V2.18.2 补丁版 | **A**（有新增功能/权限）|

回 "**可以**" 或 "**确认**" + 拍板回复即开工。

---

## 七、附件清单（可供查阅）
- 实测截图：`C:\Users\win\Desktop\zy_e2e_v2_19\pdf_headful.png`（PDF 浏览器内置 viewer 渲染效果）
- 实测 PDF：`C:\Users\win\Desktop\zy_e2e_v2_19\sample.pdf`（最小测试样本，663 字节）
- 探测脚本：`C:\Users\win\Desktop\zy_e2e_v2_19\probe_pdf.mjs` / `probe_pdf2.mjs` / `probe_pdf3.mjs` / `probe_pdf4.mjs`（环境适配迭代记录）
- 关键源码：`v2\src\shared\utils\htmlAsset.ts`（143 行，可直接泛化为 `fileAsset.ts`） + `v2\src\shared\components\AssetManager.vue:43`（guessKind 扩展点） + `v2\src\manifest.ts:9`（permissions 扩展点） + `v2\src\newtab\views\Workspace.vue:639-643`（双击 zy-asset 路由扩展点）
- 现状盘点：图片/HTML 完整链路 `v2\src\shared\components\AssetBadge.vue:65-89`（按 kind 路由）