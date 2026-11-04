/**
 * 15-settings.cjs —— B4「设置与破坏性」（V3.8.29）常驻判据。
 *
 * 五项：
 *   S1 导航当前态（形状信号，不只靠底色深浅）
 *   S2 表单五件（输入框/开关/主行动/组标题/字段级错误）
 *   S3 云同步三态（未连接/已连接/连接异常 + 凭据不回显 + 回执）
 *   S4 主题选择器（三色样例卡 + 当前态双信号）
 *   D2 破坏性确认（无原生确认、必经弹层、计数可读）
 *
 * 纪律：锁结构事实，不锁像素；色值归 theme-contrast，观感归四主题截图。
 * ★注释里不写被禁的字面量本身 —— 判据用 includes 扫源码，写进注释等于自己把判据喂绿（R71）。
 *
 * V3.8.30 追加 S2-6 / S2-7：组标题统一压小（分区名 / 导航组名 / 预览组名共用 caption+700+字距令牌），
 * 页标题归位 --fs-headline。这两条锁的是「三层一个写法」这件事本身，而不是某个像素值。
 */
const fs = require('fs');
const path = require('path');
const { check, read } = require('./helpers.cjs');

const GS = read('/newtab/views/GlobalSettings.vue');
const APP = read('/newtab/App.vue');
const RB = read('/newtab/views/RecycleBin.vue');
const DM = read('/newtab/views/settings/SettingsDataManagement.vue');

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

check('S2-3 云配置字段级校验有真规则：Supabase 项目根地址 + publishable key 前缀都逐字段提示', () => {
  const CLOUD = read('/newtab/views/settings/SettingsCloudSync.vue');
  return CLOUD.includes('/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/i.test(url)')
    && CLOUD.includes("anonKey.startsWith('sb_publishable_')")
    && CLOUD.includes('cfgUrlErr')
    && CLOUD.includes('cfgKeyErr')
    && CLOUD.includes('gs-field-err')
    && !DM.includes("!pat.startsWith('pat')")
    && !DM.includes("!base.startsWith('app')")
    && !DM.includes("!tbl.startsWith('tbl')");
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

check('S2-6 组标题统一压小（V3.8.30）：分区名 / 导航组名 / 预览组名三层共用同一套标签排印（caption + 700 + 正字距令牌），不再是三种写法', () => {
  const card = (GS.match(/^\.gs-card-title \{[^}]*\}/m) || [''])[0];
  const nav = (GS.match(/^\.gs-nav-group-title \{[^}]*\}/m) || [''])[0];
  const pv = (GS.match(/^\.gs-preview-title \{[^}]*\}/m) || [''])[0];
  if (!card || !nav || !pv) { console.log('     规则缺失'); return false; }
  const same = (r) => r.includes('font-size: var(--fs-caption)')
    && r.includes('font-weight: 700')
    && r.includes('letter-spacing: var(--tracking-sm)');
  if (!same(card) || !same(nav) || !same(pv)) {
    console.log('     分区名 ' + same(card) + ' / 导航组名 ' + same(nav) + ' / 预览组名 ' + same(pv));
    return false;
  }
  // 颜色不下调：分区名仍是 --text（守 AA 底线，压字号不等于压对比度）
  return card.includes('color: var(--text)') && !/color: var\(--text-[34]\)/.test(card);
});

check('S2-7 页标题归位令牌：gs-page-title 取 --fs-headline，字阶表外的孤立取值清零', () => {
  const rule = (GS.match(/^\.gs-page-title \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  return rule.includes('font-size: var(--fs-headline)') && !rule.includes('18px');
});

/* ============ S3 · 云同步三态 ============ */
check('S3-1 云状态徽章齐全：状态类覆盖异常 / 已连接 / 未配置 / 未登录，文案优先级仍是「异常 > 忙碌 > 已连接」', () => {
  const CLOUD = read('/newtab/views/settings/SettingsCloudSync.vue');
  const badge = CLOUD.slice(CLOUD.indexOf('const badgeState = computed'), CLOUD.indexOf('const relationTitle = computed'));
  const text = CLOUD.slice(CLOUD.indexOf('const badgeText = computed'), CLOUD.indexOf('const relationTitle = computed'));
  const iErr = text.indexOf("=== 'error'");
  const iBusy = text.indexOf("=== 'checking'");
  const iOk = text.indexOf("return '已连接'");
  return badge.includes("return 'error'")
    && badge.includes("return 'idle'")
    && badge.includes("return 'checking'")
    && badge.includes("return 'connected'")
    && text.includes("=== 'disabled'")
    && text.includes("=== 'signed_out'")
    && iErr > 0 && iBusy > iErr && iOk > iBusy
    && CLOUD.includes(':class="badgeState"')
    && CLOUD.includes('{{ badgeText }}');
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

check('S3-3 登录凭据不回显：密码框只用于本次登录，登录成功后立即清空；旧同步凭据字段零回流', () => {
  const CLOUD = read('/newtab/views/settings/SettingsCloudSync.vue');
  return CLOUD.includes('v-model="password"')
    && CLOUD.includes('type="password"')
    && CLOUD.includes('password.value = \'\'')
    && !CLOUD.includes('atPat.value')
    && !CLOUD.includes('s.pat')
    && !DM.includes('atPat.value');
});

check('S3-4 云配置错误就地说明：地址与 key 都有内联错误文案，不把格式问题只丢到卡片底部', () => {
  const CLOUD = read('/newtab/views/settings/SettingsCloudSync.vue');
  return CLOUD.includes('v-if="cfgUrlErr" class="gs-field-err"')
    && CLOUD.includes('v-if="cfgKeyErr" class="gs-field-err"')
    && CLOUD.includes('请填写项目根地址')
    && CLOUD.includes('请填写 Supabase publishable key')
    && CLOUD.includes(':aria-invalid="!!cfgUrlErr"')
    && CLOUD.includes(':aria-invalid="!!cfgKeyErr"');
});

check('S3-5 云操作共用忙碌锁：登录、检查、上传、恢复在请求期间统一禁用，避免重复提交', () => {
  const CLOUD = read('/newtab/views/settings/SettingsCloudSync.vue');
  const disabled = (CLOUD.match(/:disabled="busy"/g) || []).length;
  return disabled >= 4
    && CLOUD.includes('const busy = computed(() =>')
    && CLOUD.includes("sharedCloud.state.value === 'checking'")
    && CLOUD.includes("sharedCloud.state.value === 'syncing'")
    && !CLOUD.includes('atCredReady');
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
