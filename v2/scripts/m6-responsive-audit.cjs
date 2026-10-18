#!/usr/bin/env node
/**
 * M6 响应式与最小宽度可达 · 实拍走查（V3.8.40 新建）。
 *
 * 规范 M6 原文：「三件事三栏横排在窄窗可能拥挤 → ≤1024px 单栏重排（三件事仍首屏可见）、
 * 指标条横向滚动、底部三卡纵向堆叠；热区保持 ≥28px。验收：1024/800 两档宽度无横向溢出；主角始终首屏可达。」
 *
 * ★为什么不用静态扫描：横向溢出是**布局计算结果**，不是源码里能读出来的字面量。
 *   同一份 CSS 在 1440 不溢出、在 1024 溢出，差别只在运行时算出的 min-content 宽度。
 *   而且"热区 ≥28px"要量的是 getBoundingClientRect 的实际盒子，含 padding 与边框——
 *   只看 CSS 里的 height 声明会把 `height: 0` + padding 的写法整族漏掉。
 *
 * ★三档而不是两档：规范只点了 1024 / 800，但 1440 是基准（必须证明"改窄窗没有把宽窗也弄坏"），
 *   少一档就只剩"新写的窄屏规则在起作用"的证据，没有"未回退"的证据。
 *
 * 用法：
 *   node scripts/m6-responsive-audit.cjs
 *   node scripts/m6-responsive-audit.cjs --widths=1024,800 --views=/,/compass
 *   node scripts/m6-responsive-audit.cjs --shots        # 另存截图到 docs/视觉归档/m6/
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { CHROME } = require('./browser.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const EXT_INDEX = 'src/newtab/index.html';

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

/** 三档宽度（规范点名的两档 + 基准档） */
const WIDTHS = String(argv.widths || '1440,1024,800')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

/** 走查台面：调度台是 M6 的主责面（三件事 / 指标条 / 底部三卡都在这一页）；
 *  手册页同样列入——H1/H2 落地后它自带 1024/800 两档回落，必须有人常态复核而不是只在传参时看一眼。 */
const VIEWS = String(argv.views || '/,/compass,/profile,/manual')
  .split(',').map(s => s.trim()).filter(Boolean);

const VIEW_NAMES = { '/': '调度台', '/compass': '方向台', '/profile': '画像洞察', '/manual': '使用手册', '/settings': '设置页' };

/** 热区下限（规范原文 ≥28px）。取所有"可点且没有更大祖先"的按钮/链接实测高度。 */
const MIN_HOT = 28;

function latestBackup() {
  const dir = path.join(ROOT, '..');
  const files = fs.readdirSync(dir)
    .filter(f => /^zhiyuan_backup_.*\.json$/.test(f))
    .sort().reverse();
  if (!files.length) throw new Error('找不到备份数据（zhiyuan_backup_*.json）');
  return path.join(dir, files[0]);
}

(async () => {
  const pkg = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(pkg, 'manifest.json'))) throw new Error('先构建：npx vite build');
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME);

  const dataFile = latestBackup();
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const data = raw.zy_data_v2 || raw;
  console.log(`数据源：${path.basename(dataFile)}（资源 ${(data.resources || []).length} · 分类 ${(data.categories || []).length} · 策展台 ${(data.workspaces || []).length}）`);

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`],
  });

  let [worker] = ctx.serviceWorkers();
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const extId = new URL(worker.url()).host;
  const base = `chrome-extension://${extId}/${EXT_INDEX}`;

  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  /* ★种子必须带齐迁移戳（V3.8.37 实拍教训）：只写 hubMigratedAt 时启动迁移会把卡洗掉，
     页面直接空 —— 而空页面恰好"没有横向溢出"，量出来是一派绿。 */
  const now = Date.now();
  data.hubMigratedAt = data.hubMigratedAt || now;
  data.hubMergedAt = data.hubMergedAt || now;
  data.subtasksFoldedAt = data.subtasksFoldedAt || now;
  data.hotStatsSplitAt = data.hotStatsSplitAt || now;
  data.tagsVisibleMigratedAt = data.tagsVisibleMigratedAt || now;
  const ui = { ...(data.uiPrefs || {}) };

  await page.evaluate(async ({ d, u }) => {
    await chrome.storage.local.set({ zy_data_v2: d, zy_ui_v2: u });
  }, { d: data, u: ui });
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const shotDir = path.join(ROOT, 'docs', '视觉归档', 'm6');
  if (argv.shots) fs.mkdirSync(shotDir, { recursive: true });

  const rows = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const v of VIEWS) {
      await page.goto(base + '#' + v, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1600);
      /* 等选择器真的出现，不等固定时长（V3.8.37 纪律） */
      await page.waitForSelector('.page, .mn-page', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);

      const r = await page.evaluate((minHot) => {
        const de = document.scrollingElement || document.documentElement;
        /* 横向溢出：文档滚动宽超过视口。取 1px 容差——亚像素布局会给出 0.3px 的假溢出 */
        const overflowX = Math.max(0, Math.round(de.scrollWidth - window.innerWidth));
        /* 溢出元素定位：谁的右缘越过了视口右沿 */
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > window.innerWidth + 1) {
            const cs = getComputedStyle(el);
            /* 自身可横向滚动的容器（overflow-x auto/scroll）不算溢出源——
               它的子元素越界是"该滚就滚"，不是破版 */
            let scrollable = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const pcs = getComputedStyle(p);
              if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { scrollable = true; break }
            }
            if (scrollable) continue;
            offenders.push({
              cls: (el.getAttribute('class') || el.tagName).slice(0, 48),
              right: Math.round(r.right), w: Math.round(r.width),
              pos: cs.position,
            });
          }
        }
        /* 热区：量实际盒子（含 padding/border），只看叶子可点元素 */
        const small = [];
        for (const el of document.querySelectorAll('button, a[href], [role="button"], [tabindex="0"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.top < 0 || r.top > window.innerHeight) continue; // 只量首屏
          if (r.height < minHot) {
            small.push({
              cls: (el.getAttribute('class') || el.tagName).slice(0, 48),
              h: +r.height.toFixed(1),
              txt: (el.textContent || '').trim().slice(0, 16),
            });
          }
        }
        /* 主角首屏可达：三件事模块顶缘是否在首屏内 */
        const focus = document.querySelector('.card.focus, .today-cards');
        return {
          overflowX,
          offenders: offenders.slice(0, 6),
          small: small.slice(0, 8),
          smallTotal: small.length,
          focusTop: focus ? Math.round(focus.getBoundingClientRect().top) : null,
          focusVisible: focus ? focus.getBoundingClientRect().top < window.innerHeight : null,
        };
      }, MIN_HOT);

      rows.push({ w, v, name: VIEW_NAMES[v] || v, ...r });
      if (argv.shots) {
        await page.screenshot({ path: path.join(shotDir, `m6-${w}-${v.replace(/\//g, '_') || 'home'}.png`) });
      }
    }
  }

  await ctx.close();

  let bad = 0;
  console.log('\n══ M6 响应式实拍 ══');
  for (const r of rows) {
    const ov = r.overflowX > 1;
    const focusBad = r.focusVisible === false;
    const mark = ov || focusBad ? '❌' : '✅';
    if (ov || focusBad) bad++;
    console.log(`${mark} ${String(r.w).padStart(4)}px ${(r.name || r.v).padEnd(6)} 横向溢出 ${r.overflowX}px · 三件事首屏 ${r.focusTop === null ? '本页无' : (r.focusVisible ? `可见(top ${r.focusTop})` : `不可见(top ${r.focusTop})`)} · 首屏热区 <${MIN_HOT}px ${r.smallTotal} 处`);
    for (const o of r.offenders) console.log(`      ↳ 越界 ${o.cls} right=${o.right} w=${o.w} pos=${o.pos}`);
    for (const s of r.small.slice(0, 4)) console.log(`      · 小热区 ${s.cls} h=${s.h} 「${s.txt}」`);
  }
  console.log(bad ? `\n❌ ${bad} 处破版` : '\n✅ 全部档位无横向溢出、主角首屏可达');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('M6 走查失败：', e.message); process.exit(2); });
