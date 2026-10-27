/**
 * V3.9.21 · 方向台第二轮原型交互 + 热力图单行全年 + 更新日志跳转锁。
 *
 * 从 99-recent.cjs 尾部原样搬出（分片是搬运不是重写，断言零丢失）：
 * 99 已到 916 行，撞上 R164-2 的「每个分片 ≤900 行」刹车；按既有拍板处置是
 * 加分片而不是放宽上限。这一片继续锁用户截图中的四项交互与两项导出/跳转收口。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.21 · 方向台第二轮交互 + 热力图导出 + 更新日志跳转】');

check('R175-9 ★V3.9.21 任务 2：舱头整块点击=展开/折叠（emit fold），「全景」是独立显式按钮（emit openPano）——两动作不再混用同一个点击面，且折叠把手与全景入口可分别键盘触达', () => {
  const tower = codeOnly(read('/newtab/components/compass/CompassTower.vue'))
  return tower.includes('@click="emit(\'fold\', proj.id)"')
    && tower.includes('@click="emit(\'openPano\', proj.id)"')
    && tower.includes('>全景</button>')
    && tower.includes('class="tw-fold"')
    && tower.includes(':aria-expanded="open"')
    && tower.includes('点击展开/收起本项目内容');
});
check('R175-6 ★战略骨架默认折叠：CompassSpine 初始 expanded=false，折叠态仍保留六层摘要与展开入口；方向台首屏焦点回到项目塔', () => {
  const spine = codeOnly(read('/newtab/components/compass/CompassSpine.vue'))
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  return spine.includes('const expanded = ref(false)')
    && spine.includes('class="spine-toggle"')
    && tree.includes('<CompassSpine')
    && tree.includes('@locate=')
    && tree.includes('spine-bar');
});
check('R175-10 ★V3.9.23 热力图导出与屏上同坐标：gridCells 直接消费 12 月分组后的 yearCells col/row 并过滤 future，buildZyCard 用 yearLayout.cols × 7；不再保留 12 月块 bx/by 算法', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'))
  const grid = segOf(hm, 'function gridCells()', '\n}')
  const card = segOf(hm, 'function buildZyCard()', '\n}')
  return grid.includes('yearCells.value')
    && grid.includes(".filter(c => !c.cls.includes('future'))")
    && grid.includes('c: c.col, r: c.row, lv: c.lv')
    && !grid.includes('bi % 4')
    && !grid.includes('Math.floor(n / 7)')
    && card.includes('cols: yearLayout.value.cols, rows: 7')
    && hm.includes('const yearLayout = computed(() => {')
    && hm.includes('offset += cols + MONTH_GAP')
    && !card.includes('cols: 32, rows: 24');
});
check('R175-11 ★V3.9.21 HTML 热力卡片补齐格子图：zyCardHtml 渲染 spec.grid（grid-wrap / 行列坐标 / heat 令牌），不再只有 PNG 才有明细图', () => {
  const zy = codeOnly(read('/shared/utils/zyCard.ts'))
  const html = segOf(zy, 'export function zyCardHtml', '\n}')
  return html.includes('const grid = spec.grid')
    && html.includes('grid-template-columns:repeat(${spec.grid.cols}')
    && html.includes('grid-template-rows:repeat(${spec.grid.rows}')
    && html.includes('grid-column:${cell.c + 1};grid-row:${cell.r + 1}')
    && html.includes('background:${c.heat[')
    && html.includes('${grid}')
    && html.includes('.grid-wrap{')
    && html.includes('.grid i{');
});
check('R175-12 ★V3.9.21 更新日志跳转锁可收敛：scrollend 主信号 + 1800ms 超时兜底 + 卸载清理，避免长历史平滑滚动超过 900ms 后高亮回弹', () => {
  const cl = codeOnly(read('/newtab/views/settings/SettingsChangelogPanel.vue'))
  const jump = segOf(cl, 'function jumpTo', '\n}')
  const unmount = segOf(cl, 'onUnmounted(() =>', '\n})')
  return cl.includes('let jumpTimer: ReturnType<typeof setTimeout> | undefined')
    && cl.includes('function settleJump(): void')
    && cl.includes("addEventListener('scrollend', settleJump, { once: true })")
    && cl.includes('jumpTimer = setTimeout(settleJump, 1800)')
    && jump.includes("removeEventListener('scrollend', settleJump)")
    && unmount.includes('clearTimeout(jumpTimer)')
    && unmount.includes("removeEventListener('scrollend', settleJump)")
    /* ★V3.9.21 补：scrollend 到达时不能立刻同步位置——Chrome 还会再落一个 scroll，
       下一帧会把 active 抢回动画起点。释放锁与同步必须分两帧。 */
    /* ★V3.9.21 重指：落定帧现在先判 pendingJumpVersion 是否仍对齐，再决定保留点击
       目标或按位置同步；断言从字面「直接 sync」改指该分支的真实收敛形态。 */
    && cl.includes('requestAnimationFrame(() => {')
    && cl.includes('if (pendingJumpVersion && isPendingJumpAligned())')
    && cl.includes('jumpLock = Date.now() + 900')
    && cl.includes('if (Date.now() < jumpLock) return');
});
check('R175-13 ★V3.9.21 更新日志落定后保留点击目标：pendingJumpVersion / pendingJumpTop + jumpSettled 在目标仍对齐时直接保留 active，只有真实滚离才恢复正常位置同步', () => {
  const cl = codeOnly(read('/newtab/views/settings/SettingsChangelogPanel.vue'))
  const jump = segOf(cl, 'function jumpTo', '\n}')
  const settle = segOf(cl, 'function settleJump', '\n}')
  const sync = segOf(cl, 'function syncActiveFromScroll', '\n}')
  return cl.includes("let pendingJumpVersion = ''")
    && cl.includes('let pendingJumpTop = 0')
    && cl.includes('let jumpSettled = false')
    && cl.includes('function isPendingJumpAligned(): boolean')
    && cl.includes('Math.abs(root.scrollTop - pendingJumpTop) <= 3')
    && jump.includes('pendingJumpVersion = version')
    && settle.includes('activeVersion.value = pendingJumpVersion')
    && settle.includes("pendingJumpVersion = ''")
    && sync.includes('if (pendingJumpVersion && jumpSettled)')
    && sync.includes('isPendingJumpAligned()')
    && sync.includes('activeVersion.value = pendingJumpVersion')
    && sync.includes("pendingJumpVersion = ''")
    && cl.includes("if (pendingJumpVersion && !jumpSettled) return");
});
