/**
 * 分片 · 09-w15-drill-focus：V3.8.23 批「战报下钻澄清 + 资源卡分组与镜像 + 首屏焦点契约」的新增判据
 * （W15-1 ~ W15-6）。为什么独立成分片：05/06/07/08 已开，本轮另开 —— 门禁原意是「上限靠加分片而不是放宽」。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const TODAY = read('/newtab/components/profile/PiToday.vue');
const PI = read('/newtab/views/ProfileInsights.vue');
const RR = read('/shared/utils/reviewReport.ts');
const POOL = read('/newtab/components/compass/PoolCardsPanel.vue');
const POOL_C = codeOnly(POOL);
const RDD = read('/newtab/components/ResourceDetailDrawer.vue');
const HOME = read('/newtab/views/CompassHome.vue');
const HOME_C = codeOnly(HOME);

console.log('【W15 · 战报下钻澄清（两类明细不许混 + 四格无死格）】');

check('W15-1 ★两类明细不许混：卡片清单型与事件流水型各有其位。今日战报里"承诺哪几张卡"的入口一律落 statDrawer（卡片清单），事件流水只保留页头「全部记录」一处 —— 原先「调出 N 张支撑卡」点开的是今日调出**事件流水**，而今日调出恰为 0 时点开就是空的（用户 2026-10-16 真机报）。四新分支的取数口径逐条点名', () => {
  return PI.includes("| 'ammo' | 'cooling' | 'today-in' | 'today-call'")
    && PI.includes("case 'ammo': return ammoCards.value")
    && PI.includes("case 'cooling': return coolingCards.value")
    && PI.includes("case 'today-in': return todayInCards.value")
    && PI.includes("case 'today-call': return todayCalledCards.value")
    /* 取数口径：弹药 = 三件事任务的 SupportLink 去重资源卡（只算存活卡）；冷却 = 逐卡 lifecycleState（不另造阈值） */
    && PI.includes('const ammoSplit = computed') && PI.includes('taskIds.has(l.taskId)')
    && PI.includes('const coolingCards = computed') && PI.includes("lifecycleState(c) === 'cooling'")
    && PI.includes('coolingMsOf(c)')
    /* 今日入台/调出（★W16-T2 再修正：原实现把「创建 ∪ 调出」并成一个集合，导致"今日调出"
       会把今天只新建没打开的卡也列进去；现拆成 createdIds / calledIds 两路，入台统一按 createdAt） */
    && PI.includes('const todayCalledIds = computed') && PI.includes('const todayCreatedEventIds = computed')
    && PI.includes('const todayInCards = computed') && PI.includes('const todayCalledCards = computed')
    && PI.includes('x.createdAt >= gStartOfToday')
    && !PI.includes('const todayCardIds = computed')
    /* ★W16-T3 校正：口径说明从抽屉标题移到对账条脚注（标题只留"这是什么清单"，
       "这是卡还是流水"由对账条 note 统一说明，六个分支一处真源） */
    && PI.includes('const statReconcileNote = computed')
    && PI.includes('本清单是卡片维度；想看"谁在什么时候做了什么"，去页头「全部记录」。')
    /* 引擎侧 CTA 键改指：callSupport → ammo；「可调出的旧卡」→ cooling（不再落 openLog） */
    && RR.includes("ctaAction: 'ammo'")
    && codeOnly(RR).includes("ctaAction: 'cooling'")
    && PI.includes("action === 'ammo'") && PI.includes("action === 'cooling'")
    && !codeOnly(PI).includes("action === 'callSupport') { onTodayDrill")
    /* 事件流水能力未减：全量抽屉仍在，移出与写入记录两枚入口仍在 */
    && PI.includes("openLog('log')") && PI.includes("openLog('out')")
    && PI.includes('<DashboardLogDrawer :open="logOpen"');
});

check('W15-2 ★四格不许有死格：今日战报 strip 四格（入台/调出/焦点/弹药）全部可点，弹药格由 span 改 button —— 原先它是四格里唯一点不动的一格，而「调出 N 张支撑卡」的承诺正落在它身上（"看着像按钮"不算能点）', () => {
  const t = codeOnly(TODAY);
  const flat = TODAY.replace(/\s+/g, ' ');
  return ['d-in', 'd-call', 'd-ammo'].every(k => t.includes(`emit('drill', '${k}')`))
    && TODAY.includes("(e: 'drill', k: 'd-in' | 'd-call' | 'd-ammo'): void")
    && PI.includes("function onTodayDrill(k: 'd-in' | 'd-call' | 'd-ammo')")
    && PI.includes("openStatDrawer('today-in')") && PI.includes("openStatDrawer('ammo')")
    && PI.includes("openStatDrawer('today-call')")
    && /<button class="pi-chip ok"[^>]*@click="emit\('drill', 'd-ammo'\)"/.test(flat)
    && !/<span class="pi-chip ok"/.test(flat)
    /* 焦点格跳调度台的出口保留 */
    && TODAY.includes("emit('open-focus')");
});

console.log('【W15 · 资源卡：默认列表 · 三类分组 · 常驻动作 · 镜像入口】');

check('W15-3 ★资源卡默认必须是列表（用户拍板 2026-10-16）：池卡 261 张，网格一屏放不下十几张且标签折行；网格保留为**可选**视图（不许把两档删成一档）', () => {
  return POOL.includes("const viewMode = ref<'card' | 'list'>('list')")
    && POOL.includes("id: 'card'") && POOL.includes("id: 'list'")
    && POOL.includes('v-else-if="viewMode === \'list\'"') && POOL.includes('v-else class="pcp-grid"');
});

check('W15-4 ★三类链接分组口径与组序（用户澄清定案 2026-10-16）：按**当前槽**归唯一组 ⇒ 各组张数相加 = 池内总数，账对得上（若"命中即入多组"，同一张卡会在列表里出现多次，头部「261 张」与分组计数对不上账）；组序固定 本地文件 → URL → Obsidian → 无链接（垫底）；四条边界逐条钉：① 只存文件名打不开的卡归本地文件 ② 无链接单开一组且垫底 ③ URL 组只收 http/https（obsidian:// 在协议层也是 URL，不许重复计入）④ 负锚：必须先判 link 为空再判 linkType', () => {
  const idxs = ["{ id: 'file'", "{ id: 'url'", "{ id: 'obsidian'", "{ id: 'none'"].map(o => POOL.indexOf(o));
  return POOL.includes('function groupOf(r: ResourceCard): PoolGroup')
    && POOL.includes("if (!(r.link || '').trim()) return 'none'")
    && POOL.includes("if (r.linkType === 'file') return 'file'")
    && POOL.includes("if (r.linkType === 'obsidian') return 'obsidian'")
    && idxs.every(x => x >= 0) && idxs.every((x, i) => i === 0 || x > idxs[i - 1])   /* 组序固定 */
    && POOL.includes('const groupBy = ref') && POOL.includes('const groupSections = computed')
    && POOL.includes('class="pcp-group-h"')
    /* ★W17-C08（2026-10-20 用户拍板）重指：一排分组按钮退役，改 DeckControls 下拉（与任务卡同构）。
       所守意图不变：分组只在列表视图出现、网格不做分组、组序与计数口径不动。 */
    && POOL.includes(':groups="viewMode === \'list\' ? POOL_GROUP_OPTIONS : []"')
    /* 已镜像标记（防重复镜像 + 状态可读） */
    && POOL.includes('function isMirrored(r: ResourceCard)') && POOL.includes('curationProjections')
    && POOL.includes('class="pcp-mirror-badge"');
});

check('W15-5 ★行末动作常驻 + 镜像入口两侧同口径：① 列表行末的删除与镜像**常驻可见**（原先 opacity:0 只在 hover 出现 ⇒ "不进详情就能删"这件事事实上没有出口）② 镜像入口两宿主同口径（★W17-C06 改判：行内下拉 → 中央多选弹窗，勾选=镜像/取消=移出）③ 镜像与详情抽屉走**同一个** projectCardToBoard ④ 详情抽屉侧镜像控件提到链接工具行常驻（N8⑤ 的意图是不许进 #footer，仍守）⑤ 负锚：镜像是引用投射，绝不许把 workspaceId 直接赋值物理搬走', () => {
  /* ★W17-C06 重指：footer 切片原先取「起点 + 400 字符」，改为切到 footer 自己的 </template> ——
     固定窗口会把模板末尾挂的弹窗误算进 footer（诊断器读的是片段边界，不是语义）。 */
  const rddFootStart = RDD.indexOf('<template #footer>');
  const rddFootEnd = rddFootStart >= 0 ? RDD.indexOf('</template>', rddFootStart) : -1;
  const rddFoot = rddFootStart >= 0 && rddFootEnd > rddFootStart ? RDD.slice(rddFootStart, rddFootEnd) : '';
  /* ★W17-C06（2026-10-20 用户拍板）重指带备案：行内小下拉 + doMirror 随「镜像改中央多选弹窗」退役
     ——原拍板「不为一个下拉再加一层弹窗」被本批新反馈推翻（用户要求弹窗多选、可镜像到多个台）。
     所守意图不变：镜像入口常驻行末、走引用投射而非物理搬卡、两宿主同一实现。
     承重锚改为「行末常驻镜像按钮 + 共享弹窗（含写入与移出）」。 */
  return POOL.includes('class="pcp-r-acts"')
    && POOL.includes('@click.stop="openMirror(r)"')
    && POOL.includes('<ResourceMirrorModal')
    && POOL.includes('mirrorNamesOf(r)')
    /* 删除键不再 opacity:0（常驻） */
    && !/opacity:\s*0/.test(POOL_C.match(/\.pcp-del \{[^}]*\}/)?.[0] || '')
    /* 网格视图的删除键同样常驻（原来是 .pcp-card:hover 才显形） */
    && POOL_C.includes('.pcp-act:hover')
    /* 详情抽屉侧：镜像入口仍在 #link-actions 内（常驻），且不进 #footer */
    && RDD.indexOf('mirrorOpen = true') > RDD.indexOf('<template #link-actions>')
    && RDD.includes('<ResourceMirrorModal')
    && !/mirror|镜像/i.test(rddFoot)
    && !/r\.workspaceId\s*=\s*(?!=)/.test(POOL_C);
});

check('W15-6 ★V3.9.24 随迁备案：首屏焦点仍收在一张工作单里。三件事与子任务信息不再各自开模块，而是同一计划行 + 右侧共享详情；工作单与手边卡的独立留白由共享行间距承担，旧「全貌子任务区」不得作为第二个强模块回流', () => {
  return HOME.includes('class="focus-list"')
    && HOME.includes('class="focus-row"')
    && HOME.includes('子任务 {{ c.task.subtasks.filter(s => s.done).length }}/{{ c.task.subtasks.length }}')
    && HOME.includes('drawerRef.value?.open(c.task)')
    && HOME_C.includes('.work-board { border-color: var(--border-strong); box-shadow: var(--shadow-lg); }')
    && HOME_C.includes('gap: 18px 22px;')
    && HOME_C.includes('.hand-board { margin-top: 0; }')
    && !HOME.includes('class="focus-sub-zone"')
    && !/<section class="module">\s*<FocusDetail/.test(HOME.replace(/\n\s*/g, ' '));
});
