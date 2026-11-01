/**
 * 宣传片演示数据（严格对齐 theme-audit.cjs 的审计夹具形状）
 *
 * 为什么照抄审计夹具而不自造：
 *   自造的数据被产品的 schema 校验拦截，报「数据加载异常，应用未启动以保护本地数据」，
 *   实测空白页。而 theme-audit 的夹具是**已被验证能渲染出真实截图**的形状
 *   （docs/视觉归档/2026-10-26/linear-curation-canvas.png 即由它产出）。
 *   同一套字段形状 ⇒ 同样的渲染结果，且能通过启动期校验。
 *
 * 在夹具基础上只做两处**为本片增补**的改动：
 *   1) 资源卡 callCount 提到 3~7 ⇒ 网页搜索浮层会渲染 🔥 复用计数（母本镜头 3 特写）；
 *   2) 策展台分类补到母本要的 4 层（主题→判断→论点→证据）。
 * 文案均为本片原创演示内容，不使用真实客户数据（底稿 §8.3）。
 */
const fs = require('fs')
const path = require('path')

const OUT = path.resolve(__dirname, 'demo_data.json')
const FREEZE_AT = Date.parse('2026-10-26T08:00:00+08:00')
const at = FREEZE_AT + 12 * 60 * 60 * 1000

// —— 基底：真实备份（与 theme-audit 默认数据源一致） ——
const BASE = '/Users/beantan/Downloads/zhiyuan_backup_20261017.json'
const raw = JSON.parse(fs.readFileSync(BASE, 'utf8'))
const data = raw.zy_data_v2 || raw

// ── 策展台：中心论点 + 四层金字塔论证树 ────────────────────────────────
const WS = 'zy-audit-curation'
if (!(data.workspaces || []).some(w => w.id === WS)) {
  data.workspaces = [
    ...(data.workspaces || []),
    {
      id: WS,
      name: '认知调度研究',
      icon: '🧭',
      color: '#3A6B4C',
      coverTheme: 'deep-sea',
      desc: '把零散信息组织成可被复用、被质疑、被分享的判断。',
      order: 90,
      archived: false,
      kind: 'curation',
      callCount: 0,
      lastCalledAt: at,
    },
  ]

  /* 四层：L1 主题 → L2 判断 → L3 论点 → L4 证据 */
  const cats = [
    ['audit-cat-thesis-gap', '知识工作者的真正瓶颈', '问题不在信息不足，而在判断没有被组织。', 0],
    ['audit-cat-signal', '信号识别', '先分清哪些信息值得进入认知系统。', 1, 'audit-cat-thesis-gap'],
    ['audit-cat-evidence', '证据组织', '让资源围绕判断形成可追溯的结构。', 1, 'audit-cat-thesis-gap'],
    ['audit-cat-reuse', '调用与复用', '在问题出现时把证据重新调回现场。', 2, 'audit-cat-evidence'],
    ['audit-cat-gap', '边界与反例', '主动保留会推翻当前判断的材料。', 3, 'audit-cat-evidence'],
    ['audit-cat-share', '成果表达', '把论证结构变成他人可阅读的方案。', 4, 'audit-cat-thesis-gap'],
    // L4 证据层（本片增补，母本镜头 4 要"主题—判断—论点—证据"四层）
    ['audit-cat-ev-min', '论证的最小结构', '主题—判断—论点—证据的最小充分形式。', 0, 'audit-cat-reuse'],
    ['audit-cat-ev-reuse', '跨工具调用频次', '被反复调用的资产，检索成本远低于一次性阅读。', 1, 'audit-cat-reuse'],
    ['audit-cat-ev-bound', '反例保留机制', '主动纳入反面材料，避免单向论证。', 0, 'audit-cat-gap'],
    ['audit-cat-ev-read', '方法论可读性', '面向他人表达时的结构要求。', 0, 'audit-cat-share'],
  ]
  data.categories = [
    ...(data.categories || []),
    ...cats.map(([id, name, description, order, parentId]) => ({
      id,
      workspaceId: WS,
      name,
      description,
      order,
      ...(parentId ? { parentId } : {}),
    })),
  ]

  /* lastCalledAt 决定该卡落在网页搜索浮层的哪个分组（overlay-search.ts:573-579）：
       · 近 7 天调出 → 「🕐 最近调出 · 近 7 天」
       · 更早调出但 callCount>0 → 「🔥 近期最常用 · 按调用次数」
     两组互斥（hot 排除 recentIdSet），所以本片要同时拍到两个分组，
     必须让资源卡分属两个时间窗。now 锚定"拍摄当天"，不写死系统时钟。 */
  const NOW = Date.now()
  const DAY_MS = 86400000
  const recentAt = NOW - 2 * DAY_MS      // 近 7 天 → 最近调出
  const olderAt = NOW - 20 * DAY_MS     // 更早 → 近期最常用（🔥 组）

  const card = (id, title, categoryId, sourceType, description, callCount, calledAt) => ({
    id,
    kind: 'resource',
    title,
    description,
    linkType: 'url',
    link: 'https://example.com/' + id,
    workspaceId: WS,
    categoryId,
    sourceType,
    tags: ['认知调度'],
    pinned: false,
    callCount,
    lastCalledAt: calledAt,
    customFields: {},
    assets: [],
    createdAt: at,
    updatedAt: at,
  })

  /* callCount ≥ 3 ⇒ 网页搜索浮层「近期最常用」分组渲染 🔥 复用计数 */
  data.resources = [
    ...(data.resources || []),
    {
      ...card('audit-thesis', '知识工作者的真正瓶颈，已经从内容生产转向认知调度。', '', 'own-work',
        '当生成变得廉价，稀缺的是在正确时刻把信息、判断与证据重新调回现场的能力。', 6, olderAt),
      isThesis: true,
    },
    card('audit-r1', '浏览器里的工作现场', 'audit-cat-signal', 'official', '工作发生在标签页之间，调度也必须发生在现场。', 4, olderAt),
    card('audit-r2', '证据链的最小结构', 'audit-cat-ev-min', 'academic', '结论、理由、证据与边界需要同时可见。', 5, olderAt),
    card('audit-r3', '复用发生在问题出现时', 'audit-cat-ev-reuse', 'media', '能被快速召回的知识，才会变成能力。', 7, recentAt),
    card('audit-r4', '把一次解决变成可交付方案', 'audit-cat-ev-read', 'own-work', '结构化成果让经验可以分享，也可以被检验。', 3, recentAt),
    card('audit-r5', '反例保留：主动纳入反面材料', 'audit-cat-ev-bound', 'academic', '保留会推翻当前判断的材料，避免单向论证。', 3, olderAt),
  ]
}

// ── 方向树夹具：调度台「今日三件事」要有挂在项目+指标下的任务 ──────────
const TREE_DIR = 'audit-tree-fold-dir'
const TREE_PROJ = 'audit-tree-fold-proj'
const treeAt = FREEZE_AT + 13 * 60 * 60 * 1000
data.compass = data.compass || { vision: { content: '', updatedAt: 0 }, mission: { content: '', updatedAt: 0 }, directions: [] }
if (!Array.isArray(data.compass.directions)) data.compass.directions = []
data.compass.directions = data.compass.directions.filter(d => d && d.id !== TREE_DIR)
data.compass.directions.push({
  id: TREE_DIR,
  name: '认知调度研究',
  status: 'active',
  term: 'mid',
  projects: [{
    id: TREE_PROJ,
    name: '完成一次专题分享',
    nextStep: '让方向树折叠判据在四主题实拍中真实可判。',
    isFocused: false,
    progress: 0,
    status: 'active',
    order: 0,
    metrics: [{
      id: 'audit-tree-fold-metric',
      title: '视觉验收覆盖完整',
      target: '四主题真判',
      acceptance: '四主题实拍不再跳过方向树折叠',
      taskIds: ['audit-tree-fold-task'],
    }],
  }],
})
data.tasks = (data.tasks || []).filter(t => t && t.id !== 'audit-tree-fold-task')
data.tasks.push({
  id: 'audit-tree-fold-task',
  kind: 'task',
  title: '补齐方向树实拍夹具',
  description: '让折叠判据在真实渲染上有数据可判。',
  projectId: TREE_PROJ,
  metricId: 'audit-tree-fold-metric',
  status: 'doing',
  priority: 'high',
  customFields: {},
  tags: ['视觉验收'],
  pinned: false,
  createdAt: treeAt,
  updatedAt: treeAt,
})

// ── 多指标项目夹具：调度台首屏三件事要挂在不同项目/指标上 ──────────────
const PANO_DIR = 'audit-pano-multi-dir'
const PANO_PROJ = 'audit-pano-multi-proj'
const panoAt = FREEZE_AT + 14 * 60 * 60 * 1000
data.compass.directions = data.compass.directions.filter(d => d && d.id !== PANO_DIR)
data.compass.directions.push({
  id: PANO_DIR,
  name: '认知调度产品化',
  status: 'active',
  term: 'mid',
  projects: [{
    id: PANO_PROJ,
    name: '多指标阅读节奏审计',
    nextStep: '验证四条指标泳道在长标题下仍能保持稳定阅读节奏。',
    isFocused: true,
    progress: 0,
    status: 'active',
    order: 0,
    metrics: [
      { id: 'audit-pano-metric-1', title: '把分散在浏览器标签页里的判断，整理成可复用的证据链', target: '证据链可被第三人复核', acceptance: '每个核心判断都能追到来源、反例与适用边界', taskIds: ['audit-pano-task-1', 'audit-pano-task-2'] },
      { id: 'audit-pano-metric-2', title: '建立面向真实业务问题的资源调用路径', target: '高频问题可在 30 秒内调回材料', acceptance: '检索结果能直接进入当前任务上下文', taskIds: ['audit-pano-task-3'] },
      { id: 'audit-pano-metric-3', title: '让一次解决过程沉淀为可分享的结构化方案', target: '形成可交付的策展成果', acceptance: '分享页保留层级关系与资源链接', taskIds: [] },
      { id: 'audit-pano-metric-4', title: '验证方向树与每日行动之间的闭环是否真正减少漂移', target: '连续四周主攻不偏移', acceptance: '今日三件事均可追溯到项目与成功指标', taskIds: ['audit-pano-task-4'] },
    ],
  }],
})
data.tasks = (data.tasks || []).filter(t => t && !String(t.id).startsWith('audit-pano-task-'))
data.tasks.push(
  { id: 'audit-pano-task-1', kind: 'task', title: '整理浏览器现场里的判断与证据', description: '覆盖长任务标题在窄泳道中的换行行为。', projectId: PANO_PROJ, metricId: 'audit-pano-metric-1', status: 'doing', priority: 'high', customFields: {}, tags: ['视觉验收'], pinned: false, createdAt: panoAt, updatedAt: panoAt },
  { id: 'audit-pano-task-2', kind: 'task', title: '为关键判断补齐反例与适用边界', description: '同一指标下的第二条任务。', projectId: PANO_PROJ, metricId: 'audit-pano-metric-1', status: 'todo', priority: 'medium', customFields: {}, tags: ['视觉验收'], pinned: false, createdAt: panoAt + 1, updatedAt: panoAt + 1 },
  { id: 'audit-pano-task-3', kind: 'task', title: '把高频问题与对应资源建立可召回索引', description: '第二指标任务。', projectId: PANO_PROJ, metricId: 'audit-pano-metric-2', status: 'todo', priority: 'high', customFields: {}, tags: ['视觉验收'], pinned: false, createdAt: panoAt + 2, updatedAt: panoAt + 2 },
  { id: 'audit-pano-task-4', kind: 'task', title: '复盘本周三件事与项目指标的对齐情况', description: '第四指标任务。', projectId: PANO_PROJ, metricId: 'audit-pano-metric-4', status: 'doing', priority: 'medium', customFields: {}, tags: ['视觉验收'], pinned: false, createdAt: panoAt + 3, updatedAt: panoAt + 3 },
  { id: 'audit-pano-task-5', kind: 'task', title: '尚未归入任何成功指标、需要重新判断归属的长标题任务', description: '未归档任务，用于展示调度台的未归档读数。', status: 'todo', priority: 'low', customFields: {}, tags: [], pinned: false, createdAt: panoAt + 4, updatedAt: panoAt + 4 },
)

fs.writeFileSync(OUT, JSON.stringify(data, null, 2))
console.log(`✅ 演示数据已生成：${OUT}`)
console.log(`   策展台 ${WS} · 分类 ${(data.categories || []).length} · 资源卡 ${(data.resources || []).length} · 任务 ${(data.tasks || []).length}`)
console.log(`   🔥 复用计数候选：${(data.resources || []).map(r => r.callCount).join(', ')}`)
