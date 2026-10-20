/**
 * 分片 · 10-w16-metrics：V3.8.24 批「指标区方案A + 下钻明细准确性修正」的新增判据（W16-1 ~ W16-3）。
 * 为什么独立成分片：05~09 已开，本轮新代判据另开 —— 门禁原意是「上限靠加分片而不是放宽」。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const HERO = read('/newtab/components/profile/PiHero.vue');
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue');
const PI = read('/newtab/views/ProfileInsights.vue');
const CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'));

console.log('【W16 · 指标区方案A（纯文本读数行）与下钻明细准确性（V3.8.24 批）】');

check('W16-1 ★V3.9.3 四格读数归位概览后的指标形态：四格用竖线分隔、数字与说明分层；每格带分子分母口径 tooltip，点击可下钻；第四格保留中性进度条；主攻胶囊名截断。Hero 本身不再渲染指标，避免首屏同组读数出现两次。', () => {
  const grid = CSS.match(/\.pi-ov-kpis \{[^}]*\}/)?.[0] || '';
  const kpi = CSS.match(/\.pi-ov-kpi \{[^}]*\}/)?.[0] || '';
  const v = CSS.match(/\.pi-ov-kpi \.v \{[^}]*\}/)?.[0] || '';
  const l = CSS.match(/\.pi-ov-kpi \.l \{[^}]*\}/)?.[0] || '';
  const d = CSS.match(/\.pi-ov-kpi \.d \{[^}]*\}/)?.[0] || '';
  const pill = CSS.match(/\.hcb-pill \{[^}]*\}/)?.[0] || '';
  return /background:\s*transparent/.test(kpi)
    && !/border-radius/.test(kpi) && !/box-shadow/.test(kpi)
    && kpi.includes('border-right: 1px solid var(--border)')
    && grid.includes('repeat(4, minmax(0, 1fr))')
    && v.includes('font-size: var(--fs-title)')
    && l.includes('font-size: var(--fs-caption)')
    && d.includes('font-size: var(--fs-caption)')
    && pill.includes('max-width: 24ch') && pill.includes('text-overflow: ellipsis')
    && (OVERVIEW.match(/点击看明细/g) || []).length === 4
    && (OVERVIEW.match(/emit\('kpi-drill', '/g) || []).length === 4
    && !codeOnly(HERO).includes('hero-kpi')
    && !/transform:\s*translateY/.test(kpi);
});

check('W16-2 ★"数字"与"清单"必须对得上账（用户 2026-10-16 真机核对后报的五处）：①「今日调出」清单只取 call 事件那批（原实现把创建 ∪ 调出并成一个集合，会把今天只新建没打开的卡也列进去）②「今日入台」统一按卡字段 createdAt（与计数同源，事件只作来源标记）③「已备弹药」数字与清单同源（都只算存活资源卡）④「可调出的旧卡」逐卡走 lifecycleState 且说明列对**所有**卡类显示（原先 v-if="kind===\'task\'" ⇒ 冷却/弹药都是资源卡，说明整列不显示）⑤ 旧实现 todayCardIds 零残留。这四条是本轮真正修掉的账目错位，每条一个锚点', () => {
  const row = PI.match(/<span v-if="c\.owner" class="gs-ev-owner">\{\{ c\.owner \}\}<\/span>/)?.[0] || '';
  return PI.includes('const todayCalledIds = computed') && PI.includes("if (e.action === 'call') ids.add(e.cardId)")
    && PI.includes('const todayCreatedEventIds = computed') && PI.includes("if (e.action === 'create') ids.add(e.cardId)")
    && !PI.includes('const todayCardIds = computed')
    && PI.includes('const todayInCards = computed') && PI.includes('x.createdAt >= gStartOfToday')
    && PI.includes('const ammoSplit = computed') && PI.includes('const todayAmmo = computed(() => ammoSplit.value.live.length)')
    && PI.includes('const coolingCards = computed') && PI.includes("lifecycleState(c) === 'cooling')")
    && row.length > 0 && !PI.includes(`v-if="c.kind === 'task'" class="gs-ev-owner"`)
    /* 来源标记：入台清单区分采集/导入/本地新建（事件只用于标注，不再决定"有没有这张卡"） */
    && PI.includes('本地导入') && PI.includes('采集入池');
});

check('W16-3 ★抽屉必须自带对账条（用户拍板 2026-10-16「要」）：把"次数"与"张数"两套口径**并排摆出来** + 一句脚注说清两者差在哪。★病根：今日调出按事件次数计、去重后才是卡数，标题只写一个数时用户点开一看对不上，以为是 bug。断言钉：① 对账条结构（k/n/u/warn）与渲染节点 ② 六个分支各有自己的对账内容（今日调出 = 动作次数 vs 涉及卡片 vs 重复打开）③ 脚注把"这个抽屉是什么维度"写在明面上 ④ 事件流水仍只有页头一处入口', () => {
  return PI.includes('interface ReconCell') && PI.includes('const statReconcile = computed')
    && PI.includes('const statReconcileNote = computed')
    && PI.includes('class="pi-recon"') && PI.includes('class="pi-recon-cell"') && PI.includes('class="pi-recon-note"')
    /* 今日调出：次数与张数并排 —— 这正是"数字对不上账"的那一处 */
    && PI.includes("cell('调出动作'") && PI.includes("cell('涉及卡片'") && PI.includes("cell('其中重复打开'")
    && PI.includes("cell('存活弹药卡'") && PI.includes("cell('已进回收站'")
    && PI.includes('「次数」= 打开动作总数（含同一张卡多次打开）；「张数」= 去重后的卡片数。两者不同不是 bug，是两件事。')
    /* 六个分支全覆盖 */
    && ["case 'today-call'", "case 'today-in'", "case 'ammo'", "case 'cooling'", "case 'support'", "case 'all'"]
      .every(k => PI.includes(k))
    && PI.includes('本清单是卡片维度；想看')
    && PI.includes("openLog('log')") && PI.includes('<DashboardLogDrawer :open="logOpen"')
    /* 抽屉加宽到 520px（对账条四格一行放得下） */
    && PI.includes('width="520px"');
});
