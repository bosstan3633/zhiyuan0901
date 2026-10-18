/**
 * 15-settings.cjs —— B4「设置与破坏性」（V3.8.29）常驻判据。
 *
 * 五项：
 *   S1 导航当前态（形状信号，不只靠底色深浅）
 *   S2 表单五件（输入框/开关/主行动/组标题/字段级错误）
 *   S3 Airtable 三态（未连接/已连接/推送异常 + 凭据不回显 + 回执）
 *   S4 主题选择器（三色样例卡 + 当前态双信号）
 *   D2 破坏性确认（无原生确认、必经弹层、计数可读）
 *
 * 纪律：锁结构事实，不锁像素；色值归 theme-contrast，观感归四主题截图。
 * ★注释里不写被禁的字面量本身 —— 判据用 includes 扫源码，写进注释等于自己把判据喂绿（R71）。
 */
const fs = require('fs');
const path = require('path');
const { check, read } = require('./helpers.cjs');

const GS = read('/newtab/views/GlobalSettings.vue');
const APP = read('/newtab/App.vue');
const RB = read('/newtab/views/RecycleBin.vue');

console.log('【B4 · V3.8.29：设置与破坏性（S1 / S2 / S3 / S4 / D2）】');

/* ============ S1 · 导航当前态 ============ */
check('S1-1 当前态是形状信号不是深浅差：gs-nav-item.active 带 2px 左侧竖条（悬停只有浅底，两者不能再长一样）', () => {
  const act = (GS.match(/^\.gs-nav-item\.active \{[^}]*\}/m) || [''])[0];
  const bar = (GS.match(/^\.gs-nav-item\.active::before \{[^}]*\}/m) || [''])[0];
  if (!act || !bar) { console.log('     规则缺失'); return false; }
  return bar.includes('width: 2px')
    && bar.includes('background: var(--accent)')
    && bar.includes('position: absolute');
});

check('S1-2 竖条是基类定位的绝对子元素：.gs-nav-item 本体必须 position:relative，否则竖条会飞到设置页左上角', () => {
  const base = (GS.match(/^\.gs-nav-item \{[^}]*\}/m) || [''])[0];
  return base.includes('position: relative') && base.includes('padding: 7px 10px');
});

check('S1-3 当前态底色与文字仍是 accent 系（不退回整块中性填充）：active 用 accent-light 底 + accent-ink 字', () => {
  const act = (GS.match(/^\.gs-nav-item\.active \{[^}]*\}/m) || [''])[0];
  return act.includes('background: var(--accent-light)') && act.includes('color: var(--accent-ink)');
});

/* ============ S2 · 表单五件 ============ */
check('S2-1 输入框与下拉同一圆角档：gs-input / gs-select 都取 --radius-md（原先各自写 6px，与按钮/卡片的 8/14 三层打架）', () => {
  const inp = (GS.match(/^\.gs-input \{[^}]*\}/m) || [''])[0];
  const sel = (GS.match(/^\.gs-select \{[^}]*\}/m) || [''])[0];
  if (!inp || !sel) { console.log('     规则缺失'); return false; }
  return inp.includes('border-radius: var(--radius-md)')
    && sel.includes('border-radius: var(--radius-md)')
    && !inp.includes('border-radius: 6px')
    && !sel.includes('border-radius: 6px');
});

check('S2-2 错误字段级内联：有 is-invalid 与 gs-field-err 两条规则，且都用 --danger（原先错误只出现在卡片底部那一行，输入框本身无声）', () => {
  const inv = (GS.match(/^\.gs-input\.is-invalid \{[^}]*\}/m) || [''])[0];
  const err = (GS.match(/^\.gs-field-err \{[^}]*\}/m) || [''])[0];
  if (!inv || !err) { console.log('     规则缺失'); return false; }
  return inv.includes('border-color: var(--danger)')
    && err.includes('color: var(--danger)')
    && err.includes('font-size: var(--fs-caption)')
    && GS.includes('gs-field-err');
});

check('S2-3 字段级校验有真规则：PAT 以 pat / Base 以 app / Table 以 tbl 三条前缀判据都在脚本里（且只在「填了但格式错」时触发）', () => {
  return GS.includes("!pat.startsWith('pat')")
    && GS.includes("!base.startsWith('app')")
    && GS.includes("!tbl.startsWith('tbl')")
    && GS.includes('if (pat && !pat.startsWith');
});

check('S2-4 主行动唯一 accent：八区的主按钮一律 gs-btn-primary（危险区走 gs-btn-danger），不存在第二种主行动样式', () => {
  const primary = (GS.match(/^\.gs-btn-primary \{[^}]*\}/m) || [''])[0];
  const danger = (GS.match(/^\.gs-btn-danger \{[^}]*\}/m) || [''])[0];
  return primary.includes('background: var(--accent)')
    && danger.includes('color: var(--danger)')
    && (GS.match(/class="gs-btn gs-btn-primary/g) || []).length >= 4;
});

check('S2-5 开关是 accent 不是绿：gs-switch 开启态走 --accent；绿只留给「已连接/已启用」这类状态徽章', () => {
  const on = (GS.match(/\.gs-switch input:checked \+ \.gs-switch-slider \{[^}]*\}/) || [''])[0];
  const badge = (GS.match(/^\.gs-status-badge\.connected \{[^}]*\}/m) || [''])[0];
  return on.includes('background: var(--accent)')
    && badge.includes('var(--success)')
    && !on.includes('var(--success)');
});

/* ============ S3 · Airtable 三态 ============ */
check('S3-1 三态徽章齐全：atBadge 三支（error / connected / idle）都在，且优先级是「异常 > 已连接 > 未连接」', () => {
  const i = GS.indexOf('const atBadge = computed');
  const seg = i >= 0 ? GS.slice(i, i + 420) : '';
  if (!seg) { console.log('     atBadge 缺失'); return false; }
  const iErr = seg.indexOf("cls: 'error'");
  const iOk = seg.indexOf("cls: 'connected'");
  const iIdle = seg.indexOf("cls: 'idle'");
  return iErr > 0 && iOk > iErr && iIdle > iOk;
});

check('S3-2 三态各有配色且不越权：idle 中性 surface-3 / connected 绿 / error 才用琥珀', () => {
  const idle = (GS.match(/^\.gs-status-badge\.idle \{[^}]*\}/m) || [''])[0];
  const ok = (GS.match(/^\.gs-status-badge\.connected \{[^}]*\}/m) || [''])[0];
  const err = (GS.match(/^\.gs-status-badge\.error \{[^}]*\}/m) || [''])[0];
  if (!idle || !ok || !err) { console.log('     规则缺失'); return false; }
  return idle.includes('var(--surface-3)')
    && !/tag-warn|--warning|--danger/.test(idle)
    && ok.includes('var(--success)')
    && err.includes('var(--tag-warn-text)');
});

check('S3-3 凭据不回显：不再把 storage 里的 PAT 灌回输入框（type=password 只遮字，value 仍是明文），改置「已保存」标记 + 空值不覆盖旧密钥', () => {
  const bad = [];
  if (GS.includes('atPat.value = s.pat')) bad.push('回填明文');
  if (!GS.includes('if (s.pat) atPatSaved.value = true')) bad.push('缺已保存标记');
  if (!GS.includes('if (typedPat) s.pat = typedPat')) bad.push('空值会覆盖旧密钥');
  if (bad.length) console.log('     ' + bad.join(' / '));
  return bad.length === 0;
});

check('S3-4 已保存要说得出来：输入框 placeholder 在已存过凭据时改为「不回显 · 替换请重填」，并有一行说明为什么', () => {
  return GS.includes('已保存（不回显）· 替换请直接重填')
    && GS.includes('已保存，替换需重填（原值不回显，避免凭据被复制）')
    && GS.includes('type="password"');
});

check('S3-5 按钮可用性跟着凭据走：测试与同步在「已存过 PAT」时也可点（不能要求每次重填才能测），未填且未存才禁用', () => {
  const n = (GS.match(/!atCredReady/g) || []).length;
  if (n < 3) console.log('     当前 ' + n + ' 处引用（期望 ≥3：两个 disabled + 一处前置检查）');
  return n >= 3 && GS.includes('const atCredReady = computed');
});

/* ============ S4 · 主题选择器 ============ */
check('S4-1 五项都是样例卡：themes 每项都有三色 palette（auto 也在内，不能因为它是「跟随系统」就退回单色圆点）', () => {
  const n = (APP.match(/palette: \[/g) || []).length;
  const items = (APP.match(/\{ id: '(auto|linear|raycast|apple|notion)'/g) || []).length;
  if (n < 5 || items < 5) console.log('     palette ' + n + ' / 主题 ' + items);
  return n >= 5 && items >= 5;
});

check('S4-2 色板取自真实令牌值不是臆造：linear 与 apple 两组与 tokens.css 的 bg/surface/accent 逐值对上', () => {
  const tokens = read('/shared/styles/tokens.css');
  return tokens.includes('--bg: #0D0E11;') && tokens.includes('--bg: #F5F5F7;')
    && APP.includes("palette: ['#0D0E11', '#14161B', '#5E6AD2']")
    && APP.includes("palette: ['#F5F5F7', '#FFFFFF', '#8452E0']");
});

check('S4-3 当前态双信号 + 原生可聚焦：选中行 accent 描边且带 ✓ 图标；选项是 button 不是 div（Tab 能到）', () => {
  const act = (APP.match(/^\.theme-option\.active \{[^}]*\}/m) || [''])[0];
  return act.includes('border-color: var(--accent)')
    && APP.includes('class="theme-option"')
    && /<button[\s\S]{0,220}class="theme-option"/.test(APP)
    && APP.includes('class="theme-check"');
});

/* ============ D2 · 破坏性确认 ============ */
check('D2-1 全站零原生确认：src 下无 window.confirm / alert 调用（原生弹窗既不可样式化，也会被浏览器拦截）', () => {
  const root = path.resolve(__dirname, '../../src');
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(vue|ts)$/.test(e.name)) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
          if (/(^|[^.\w])(window\.)?(confirm|alert)\s*\(/.test(l) && !/useConfirm|confirmText|\.confirm\b/.test(l)) {
            hits.push(p.replace(root + '/', '') + ':' + (i + 1));
          }
        });
      }
    }
  };
  walk(root);
  if (hits.length) console.log('     ' + hits.join(' | '));
  return hits.length === 0;
});

check('D2-2 破坏性动作必经弹层且带计数：清空走 useConfirm，文案里有「N 项」且说明不可恢复', () => {
  return RB.includes('useConfirm(')
    && RB.includes('清空回收站分区')
    && RB.includes('全部 ${list.length} 项')
    && GS.includes('async function emptyRecycleBin')
    && GS.includes('永久删除 ${n} 项')
    && GS.includes('不可恢复');
});

check('D2-3 「双层」口径落地：一层=点危险按钮（需显式动作），二层=弹层内再点红色确认；最重的整库回滚额外加「输入回滚二字」第三关', () => {
  const rbBtn = RB.includes('class="rb-btn danger" @click="purgeAll"');
  const gsBtn = GS.includes('class="gs-btn gs-btn-danger" @click="emptyRecycleBin"');
  const modalGate = GS.includes('showResetModal = true') && GS.includes("resetConfirmText !== '回滚'");
  return rbBtn && gsBtn && modalGate;
});
