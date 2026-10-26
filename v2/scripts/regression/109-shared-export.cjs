/**
 * V3.9.22 · shared card export guardrails.
 *
 * These assertions execute the real TypeScript module. Shape-only checks would
 * not catch a protocol regression or an accidental BLOB read added to the
 * renderer, so the contract is exercised with representative documents.
 */
const { check, read, codeOnly, path, SCRIPTS_DIR, base } = require('./helpers.cjs');

console.log('【V3.9.22 · 共享卡片导出】');

let esbuild = null;
try { esbuild = require('esbuild'); } catch { /* shape fallback below */ }
const fs = require('fs');

function loadRealCardExport() {
  if (!esbuild) return null;
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'cardExport.ts');
  const out = path.resolve(SCRIPTS_DIR, '..', '.shared-export.tmp.cjs');
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    });
    return require(out);
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(out); } catch { /* no artifact on compile failure */ }
  }
}

const cardExport = loadRealCardExport();

const sampleDoc = {
  kicker: '任务卡',
  title: '导出边界 *任务* [A]',
  subtitle: '说明 <b>不应成为标签</b>',
  stats: [{ label: '完成度', value: '2 / 3', note: '含 #与 |' }],
  sections: [
    {
      title: '资源支持',
      paragraphs: ['第一行\n第二行 <script>alert(1)</script>'],
      rows: [
        { text: '资源 Alpha', link: 'https://example.com/a?q=1&x=2', linkType: 'url', label: '任务级' },
        { text: '危险卡', link: 'javascript:alert(1)', linkType: 'url', label: '手动关联' },
      ],
    },
    {
      title: '附件清单',
      attachments: [
        { name: 'brief.pdf', kind: 'pdf', mime: 'application/pdf', size: 1536, blob: 'MUST_NOT_RENDER' },
        { name: 'cover.png', kind: 'image', size: 512 },
      ],
    },
  ],
  footer: '普通导出不读取附件本体',
  generatedAt: Date.UTC(2026, 9, 26, 8, 0, 0),
};

check('SEX-01 ★共享导出模块对附件存储零依赖：不 import assets / getAllAssets / IndexedDB，不在渲染期读取 Blob', () => {
  const raw = read('/shared/utils/cardExport.ts');
  const src = codeOnly(raw);
  return !/from\s+['"][^'"]*(?:storage\/assets|\/assets|idb|indexeddb)[^'"]*['"]/i.test(src)
    && !/from\s+['"]/.test(raw.slice(0, raw.indexOf('*/') + 2))
    && !/\bgetAllAssets\b|\bindexedDB\b|\bIDB(?:KeyRange|Database|Transaction|ObjectStore|Request)?\b/.test(src)
    && !/\.get\s*\([^)]*\)\s*(?:\.then|await)?[\s\S]{0,40}\bBlob\b/.test(src)
    && src.includes('ExportAttachmentMeta')
    && src.includes('formatAttachmentMeta');
});

check('SEX-02 ★安全链接只放行 http/https/obsidian/file；javascript/data/vbscript/blob 全部降级为不可点击', () => {
  if (cardExport) {
    const allowed = [
      ['https://example.com/x', 'https'],
      ['http://example.com/x', 'http'],
      ['obsidian://open?vault=notes&file=a', 'obsidian'],
      ['file:///tmp/report.pdf', 'file'],
      ['C:\\Users\\me\\report.pdf', 'file'],
    ];
    const bad = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'blob:https://example.com/abc',
      'chrome-extension://abc/page.html',
    ];
    return allowed.every(([url, kind]) => {
      const link = cardExport.safeExportLink(url);
      return link.clickable && link.kind === kind && link.href;
    }) && bad.every(url => {
      const link = cardExport.safeExportLink(url);
      return !link.clickable && !link.href;
    });
  }
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes("protocol !== 'http'")
    && src.includes("protocol !== 'https'")
    && src.includes("protocol !== 'obsidian'")
    && src.includes("protocol !== 'file'")
    && src.includes("blocked('unsupported-protocol')");
});

check('SEX-03 ★附件只输出名称/类型/大小元数据：附带 blob 字段不进入 Markdown 或 HTML', () => {
  if (cardExport) {
    const md = cardExport.renderExportMarkdown(sampleDoc);
    const html = cardExport.renderExportHtml(sampleDoc);
    return md.includes('brief.pdf')
      && md.includes('PDF')
      && md.includes('1.5 KB')
      && md.includes('cover.png')
      && !md.includes('MUST_NOT_RENDER')
      && !md.includes('data:application/pdf')
      && !html.includes('MUST_NOT_RENDER')
      && !html.includes('data:application/pdf')
      && !/<img\b/i.test(html);
  }
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('formatAttachmentMeta')
    && !src.includes('readAsDataURL')
    && !src.includes('createObjectURL')
    && !src.includes('base64');
});

check('SEX-04 ★HTML 自包含且无脚本/外链：无 <script>、无外部 link/img/font，样式全部内联', () => {
  if (cardExport) {
    const html = cardExport.renderExportHtml(sampleDoc);
    return /^<!doctype html>/i.test(html.trim())
      && html.includes('<style>')
      && !/<script\b/i.test(html)
      && !/<(?:link|img|iframe|object|embed)\b/i.test(html)
      && !/\bsrc\s*=/i.test(html)
      && !/@import\b/i.test(html)
      && !/https?:\/\/[^"' ]+\.(?:css|js|woff2?|ttf|otf|png|jpe?g|svg)/i.test(html)
      && /target="_blank"[^>]*rel="noopener noreferrer"/i.test(html);
  }
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('htmlDocumentShell')
    && !/<script\b/.test(src)
    && !src.includes('@import');
});

check('SEX-05 ★Markdown 特殊字符转义：标题与正文中的语法字符不破坏层级；链接仍可用', () => {
  if (cardExport) {
    const md = cardExport.renderExportMarkdown(sampleDoc);
    return md.includes('导出边界 \\*任务\\* \\[A\\]')
      && md.includes('说明 \\<b\\>')
      && md.includes('第一行\n第二行')
      && md.includes('\\<script\\>alert\\(1\\)\\</script\\>')
      && md.includes('[资源 Alpha](https://example.com/a?q=1&x=2)')
      && md.includes('危险卡')
      && !md.includes('[危险卡](javascript:')
      && md.includes('\\#与 \\|');
  }
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('escapeMarkdown') && src.includes('renderMarkdownLink');
});

check('SEX-06 ★文件名安全化：路径分隔符与 Windows 非法字符清理，保留扩展名并截断过长标题', () => {
  if (cardExport) {
    const a = cardExport.safeExportFileName('任务/卡: A*B? "C" <D> | E', 'md');
    const b = cardExport.safeExportFileName('  结论.  ', '.html');
    const c = cardExport.safeExportFileName('x'.repeat(120), 'html');
    return a === '任务_卡_ A_B_ _C_ _D_ _ E.md'
      && b === '结论.html'
      && c.endsWith('.html')
      && c.length === 85;
  }
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('safeExportFileName')
    && src.includes('[\\\\/:*?"<>|')
    && src.includes('.slice(0, 80)');
});

check('SEX-07 ★共享入口可被真实业务代码直接复用：导出 Markdown / HTML 文档渲染器，并支持 DOM 主题令牌读取', () => {
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('export function renderExportMarkdown')
    && src.includes('export function renderExportHtml')
    && src.includes('export function readExportTheme')
    && src.includes('getComputedStyle')
    && src.includes("pick('--surface'")
    && src.includes("pick('--accent'")
    && src.includes('export function sectionsToMd')
    && src.includes('export const sectionsToMarkdown');
});

check('SEX-08 ★共享导出没有把附件 BLOB 带入 DOM：HTML 只接受元数据并输出纯文本列表，不产生 media URL', () => {
  const src = codeOnly(read('/shared/utils/cardExport.ts'));
  return src.includes('section.attachments')
    && src.includes('formatAttachmentMeta(a)')
    && !src.includes('URL.createObjectURL')
    && !src.includes('readAsArrayBuffer')
    && !src.includes('FileReader')
    && !src.includes('data:image/');
});

check('SEX-09 ★战报 HTML 摘要与行文本全部转义，资源链接是唯一可点击通道', () => {
  const raw = read('/shared/utils/exportView.ts');
  const i = raw.indexOf('export function dailyReportShareHtml(')
  const fn = i >= 0 ? raw.slice(i) : ''
  return i >= 0 && fn.includes('<p class="summary">${escHtml(spec.summary)}</p>')
    /* codeOnly 会把 HTML/CSS 模板里的双引号当字符串边界，命中与否改由原始片段核——
       这条守的是“资源链接是唯一点击通道，其余标题都走 HTML 转义”。 */
    && fn.includes('target="_blank" rel="noopener noreferrer"')
    && fn.includes('${escHtml(r.href)}')
    && fn.includes('${escHtml(r.title)}')
    && fn.includes('escHtml(r.title)')
    && fn.includes('rowHtml');
});

/* Keep the source root in ownership: every supported link kind is declared in one union. */
if (!cardExport) {
  check('SEX-10 ★行为断言环境：cardExport.ts 可被 esbuild 独立加载', () => false);
}
