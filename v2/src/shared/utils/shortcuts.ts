/**
 * 快捷键单一真源（B7-e · H3 · V3.8.40）。
 *
 * 规范 H3 原文：「快捷键以文字/表格形态散在手册与设置页 → 统一快捷键表组件（kbd 样式 + 动作 + 场景三列），
 * 设置页与手册共用一份数据源（避免脱节）；⌘K / Esc / 方向键等全局键置顶。验收：两份快捷键内容同源一致。」
 *
 * ★为什么要收：落地前核过三处手写清单，**它们已经互相脱节**，不是"将来会脱节"：
 *   ① 应用内速查面板（GlobalPopups，? 呼出）把切台键**硬编码成 Alt+1/2/3**，
 *      而修饰键在设置页有五种可选（`wsSwitchMod`：alt / ctrl / ctrl-shift / alt-shift / none）。
 *      ⇒ 用户改成 Ctrl 之后，速查面板仍在教他按 Alt——面板在教一个不存在的键位。
 *   ② 设置页应用内快捷键只有 5 条，且**混进了根本不是快捷键的行**：
 *      「资源卡批量管理 · 资源卡池控制行『批量』」（那是个按钮位置，不是按键）。
 *   ③ 三处对同一条的措辞各不相同（速查「Tab 搜索内循环切换类型」/ 设置「输入「任务/资源/好奇心」+ Tab」/ 手册「Tab」）。
 *   ④ 手册 ref-1 把六条无默认键浏览器命令**手写成一句话**，与 manifest 的命令名各写一份，改一处漂两处。
 *
 * 所以本文件不是"抽个常量"，而是**把四份清单合成一份可派生的结构**：
 * 三处 UI（速查面板 / 设置页 / 手册正文含独立分享版）都从这里派生，不再各写一份。
 *
 * ★切台键用 `{MOD}` 占位而不是写死 Alt：速查面板与设置页都要按**用户当前偏好**渲染真实键位。
 *   （这是本批唯一一处"文案随偏好变"的地方，因此派生函数一律显式收 mod 参数，不在模块里读 store。）
 */

/** 修饰键偏好 → 展示文案（与 App.vue onGlobalKeydown 的五种分支一一对应，改一处必须改两处） */
export const MOD_LABELS: Record<string, string> = {
  alt: 'Alt',
  ctrl: 'Ctrl',
  'ctrl-shift': 'Ctrl+Shift',
  'alt-shift': 'Alt+Shift',
  none: '无修饰键',
}

/** 取修饰键展示文案；未设置时回落 Alt（repository 迁移后的库内默认值同为 alt） */
export function modLabelOf(mod?: string): string {
  return MOD_LABELS[mod || 'alt'] || MOD_LABELS.alt
}

/**
 * 把 `{MOD}` 占位换成真实修饰键文案；其余键位原样返回。
 *
 * ★`none`（纯数字键、无修饰）单独处理：直接拼成「无修饰键+1」是句读不通的废话，
 * 而这一档是**真实存在的用户选择**（设置页下拉第五项），不能当作边角情况糊过去——
 * 键位文案必须写成用户真能按的那个：就是「1」。
 */
export function resolveKeys(keys: string, mod?: string): string {
  if ((mod || 'alt') === 'none') return keys.replace(/\{MOD\}\+/g, '')
  return keys.replace(/\{MOD\}/g, modLabelOf(mod))
}

/** 一条快捷键：keys = 按键（可含 {MOD}），action = 动作，where = 生效场景 */
export interface ShortcutItem {
  keys: string
  action: string
  /** 场景分组标题——手册表格按它并成 rowspan 列，故与 groups 的 title 同源 */
  where: string
}

export interface ShortcutGroup {
  /** 分组标题；规范要求「⌘K / Esc / 方向键等全局键置顶」，故 global 组排在数组首位 */
  title: string
  items: ShortcutItem[]
}

/**
 * 全量快捷键清单。**分组顺序即展示顺序**，第一组必须是全局键。
 * 键位一律取自 manifest.ts 的 suggested_key 与 App.vue 的实际处理分支——
 * 这里只做"人读得懂的一行字"，不新增任何实际不存在的键位。
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '全局（任意网页）',
    items: [
      { keys: 'Ctrl+Shift+K', action: '打开知源调度台（新标签页）', where: '全局（任意网页）' },
      { keys: 'Ctrl+Shift+J', action: '快速采集当前网页为资源卡', where: '全局（任意网页）' },
      { keys: 'Ctrl+Shift+I', action: '采集好奇心（选中文字自动附带标题与链接）', where: '全局（任意网页）' },
      { keys: 'Ctrl+K', action: '全局搜索（穿透三卡 / 各策展台 / 项目）', where: '全局（任意网页）' },
    ],
  },
  {
    title: '应用内',
    items: [
      { keys: '{MOD}+1', action: '切到调度台', where: '应用内' },
      { keys: '{MOD}+2', action: '切到方向台', where: '应用内' },
      { keys: '{MOD}+3…9', action: '按台签顺序切各策展台', where: '应用内' },
      { keys: '?', action: '呼出快捷键速查面板', where: '应用内' },
      { keys: 'Esc', action: '逐层关闭（浮层 → 抽屉 → 展板）', where: '应用内' },
      { keys: 'Ctrl+← / →', action: '今日三件事切换日期', where: '应用内' },
    ],
  },
  {
    title: '编辑与检索',
    items: [
      { keys: 'Ctrl+Enter', action: '保存并关闭（所有弹窗 / 抽屉）', where: '编辑与检索' },
      { keys: '↑ / ↓', action: '在搜索结果 / 任务列表中移动选中', where: '编辑与检索' },
      { keys: 'Enter', action: '搜索结果打开链接；任务列表打开详情抽屉', where: '编辑与检索' },
      { keys: '空格', action: '任务列表批量勾选（仅列表视图）', where: '编辑与检索' },
      { keys: 'Ctrl+Enter（搜索内）', action: '仅定位到卡片所在处，不打开链接', where: '编辑与检索' },
      { keys: 'Tab', action: '搜索面板内循环切换过滤类型（或输入「任务/资源/好奇」直达）', where: '编辑与检索' },
      { keys: 'Ctrl/Cmd+Z', action: '撤销最近一次可撤销操作（窗口内）', where: '编辑与检索' },
    ],
  },
  {
    title: '鼠标（三张卡一致）',
    items: [
      { keys: '单击 / 双击', action: '单击开详情，双击打开链接', where: '鼠标（三张卡一致）' },
      { keys: '右键', action: '卡片操作菜单（打开 / 置顶 / 复制链接 / 删除）', where: '鼠标（三张卡一致）' },
      { keys: '拖拽', action: '同组排序 / 跨列改状态 / 跨组改归属', where: '鼠标（三张卡一致）' },
    ],
  },
]

/**
 * 无默认键的浏览器命令（需到 chrome://extensions/shortcuts 手动分配）。
 *
 * ★为什么单列一份而不是塞进 groups：这些命令**在代码里没有按键可写**——
 * 键位由用户在浏览器里自己分配，写死任何一串键都是撒谎。
 * 手册旧文案把六条手写在一句话里，与 manifest.ts 各写一份；这里改为从清单派生，改命令名只改一处。
 * 口径须与 manifest.ts 的 commands 一致：四条带 suggested_key 的不在此列。
 */
export const MANUAL_ASSIGN_COMMANDS: string[] = [
  '全局设置',
  '打开完整方向树',
  '快速采集任务',
  '同步到 Airtable',
  '直达好奇心培养模块',
  '直达任务调度模块',
]

/** 扁平化全量清单（设置页「应用内快捷键」等场景按组过滤用） */
export function shortcutsOf(groupTitle: string, mod?: string): { keys: string; action: string }[] {
  const g = SHORTCUT_GROUPS.find(x => x.title === groupTitle)
  if (!g) return []
  return g.items.map(it => ({ keys: resolveKeys(it.keys, mod), action: it.action }))
}

/**
 * 渲染成手册用的 HTML 表格（三列：场景 / 按键 / 作用，场景列按组并格）。
 * 手册正文与独立分享版共用这一份产物，两边不可能再分叉。
 *
 * ★`mod` 传 'placeholder' 时把切台键渲染成「修饰键 + N」而不是具体某个修饰键。
 *   原因：手册正文是**静态数据**（MANUAL 数组在模块加载时算好，导出分享版时也一样），
 *   它拿不到"此刻这位用户选了什么修饰键"。此前传 undefined 会回落到 Alt ——
 *   于是一位把修饰键改成 Ctrl 的用户，打开手册看到的是「Alt + 1」，手册在教一个他按不出来的键。
 *   静态产物唯一不撒谎的写法就是写「修饰键」，并在表下注明去哪改（见 manual-data ref-1）。
 *   需要真值的两处（速查面板 / 设置页）都持有 store，直接传真实 mod。
 */
export function shortcutTableHtml(mod?: string): string {
  const rows: string[] = []
  for (const g of SHORTCUT_GROUPS) {
    g.items.forEach((it, i) => {
      const scene = i === 0
        ? `<td rowspan="${g.items.length}"><b>${g.title}</b></td>`
        : ''
      const kbd = (mod === 'placeholder' ? it.keys.replace(/\{MOD\}/g, '修饰键') : resolveKeys(it.keys, mod))
        .split('+')
        .map(k => `<kbd>${escHtml(k)}</kbd>`)
        .join('+')
      rows.push(`<tr>${scene}<td>${kbd}</td><td>${escHtml(it.action)}</td></tr>`)
    })
  }
  return `<table class="mc-table">
          <tr><th>场景</th><th>按键</th><th>作用</th></tr>
          ${rows.join('\n          ')}
        </table>`
}

/** 无默认键命令的一句话清单（供手册与设置页共用文案） */
export function manualAssignSentence(): string {
  return MANUAL_ASSIGN_COMMANDS.map(escHtml).join(' · ')
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
