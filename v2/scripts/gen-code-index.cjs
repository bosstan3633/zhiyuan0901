#!/usr/bin/env node
/**
 * gen-code-index.cjs —— 生成《代码索引》（给外部评审模型的 L4 层）
 *
 * 为什么需要这个脚本（而不是手写一份索引文档）：
 * 本仓库已被反复证明「引用型数字会在下一轮失真」（见 04-59 §1.3 纪律提示）。
 * 手写的代码索引**必然腐化**，而腐化的索引比没有索引更坏 —— 它会让评审模型基于错位的行号下判断。
 * 因此索引必须**可一键重建**：改完代码跑一次，索引即与代码同步。
 *
 * 用法：
 *   node scripts/gen-code-index.cjs                  # 输出到 仓库根/评审交接包/02_代码索引.md
 *   node scripts/gen-code-index.cjs <输出路径>
 *   node scripts/gen-code-index.cjs --check          # 只比对不写；漂移即退出码 1（回归断言 R163-1 就调它）
 *
 * 输出：按目录分组的 markdown 表（文件 | 行数 | 职责 | 导出符号）
 */
const fs = require('node:fs')
const path = require('node:path')

const V2_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(V2_ROOT, '..')
const SRC = path.join(V2_ROOT, 'src')
// 位置参数才是输出路径；--xxx 一律当开关（否则 `--check` 会被当成文件名）
const OUT = process.argv.slice(2).find((x) => !x.startsWith('--')) || path.join(REPO_ROOT, '评审交接包', '02_代码索引.md')

/** 递归收集源文件 */
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|vue)$/.test(e.name)) acc.push(p)
  }
  return acc
}

/** 取 .vue 的 <script> 段，其余原样 */
function scriptPart(src, isVue) {
  if (!isVue) return src
  const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return m ? m[1] : ''
}

/** 噪音行：轮次/编号前缀、版本沿革、路径清单 —— 索引要的是"干什么"，不是"改过几次" */
const NOISE = [
  /^第[一二三四五六七八九十百卅]+轮/,
  /^R\d+/,
  /^[A-Z]{2,}-\d+/,
  /^V\d+\.\d+/,
  /^[-—·*]+$/
]

/**
 * 从注释块提取「职责」。
 * 优先文件头注释；无则退到文件内**第一个**块注释（很多核心文件把说明写在第一段代码旁）。
 */
function headNote(src, isVue) {
  const text = scriptPart(src, isVue)
  const blocks = [...text.matchAll(/\/\*\*?([\s\S]*?)\*\//g)]
  if (!blocks.length) return ''
  // 头注释优先（位于前 600 字符内即视为头注释），否则取第一个块注释
  const head = text.slice(0, 600).match(/^\s*\/\*\*?([\s\S]*?)\*\//)
  const raw = (head ? head[1] : blocks[0][1]) || ''

  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l && !/^[@#]/.test(l))
    .filter((l) => !NOISE.some((re) => re.test(l)))

  if (!lines.length) return ''
  const joined = lines.join(' ').replace(/\s+/g, ' ').trim()
  const first = joined.split(/[。；;]/)[0] || joined
  return first.trim().slice(0, 120)
}

/**
 * 手工表：**优先于**自动提取。
 *
 * 为什么需要它：本仓库的注释风格是「记录决策理由」（R 号 + 为什么这么做），
 * 于是自动提取常拿到的是**理由**而不是**职责**（例：`CardAiEntry.vue` 的头注释讲的是"为什么抽出来"，
 * 不是"它是什么"）。而索引里的「职责」是评审模型决定"要不要打开这个文件"的唯一依据 —— 它必须准。
 *
 * 手工表写在**脚本内**（而非产物里）⇒ 索引仍然可一键重建，不存在"产物被手改"的腐化路径。
 * 覆盖原则：>300 行的文件 + 所有自动提取为空或明显跑偏的文件。
 */
const MANUAL_NOTES = {
  // ---- 入口与外壳 ----
  'manifest.ts': 'MV3 清单（**版本号唯一来源** / 权限 / 命令 / content_scripts）',
  'vite-env.d.ts': 'Vite 客户端类型声明',
  'newtab/App.vue': '应用外壳：顶栏 / 导航 / 路由容器 / 全局弹层挂载 / 落盘状态点 / 快捷键总入口',
  'newtab/main.ts': '启动链：错误留痕最早注册 → V1 迁移检测 → 单次批量读 → 骨架屏 → 挂载',
  'newtab/router.ts': '路由表（hash 模式）',
  'newtab/manual-data.ts': '内置使用手册的章节数据（另可导出独立 HTML）',
  // ---- 视图（路由级）----
  'newtab/views/GlobalSettings.vue': '全局设置页（全仓最大文件）：手册 / 导入导出 / Airtable 同步 / AI 配置 / 标签管理 / 字段设计 / 仪表盘 / 快捷键',
  'newtab/views/Workspace.vue': '策展台单一画布（论点卡 + 金字塔/树状思维导图 + 资源证据 + 指标下钻 + 分享）',
  'newtab/views/CompassHome.vue': '调度台首页：方向状态四指标 + 今日三件事 + 底部三张卡（任务卡 / 好奇心卡 / 资源卡）',
  'newtab/views/CompassTree.vue': '完整方向树（战略目标 → 项目 → 指标 → 任务）',
  'newtab/views/ProjectCuration.vue': '项目详情页（内嵌方向台，`?p=` 定位；含金字塔/看板）',
  'newtab/views/CompassShell.vue': '方向台一级工作区（主航线「看」+ 项目总览「管」）',
  'newtab/views/RecycleBin.vue': '回收站（恢复 / 永久删除 / 清空）',
  'newtab/views/FieldEditor.vue': '字段设计编辑器（显隐 / 排序 / 重命名 / 新增）',
  'newtab/views/ManualPage.vue': '使用手册独立页（`/manual`，左目录锚点 + 右内容）',
  // ---- 应用内组件 ----
  'newtab/components/GlobalPopups.vue': '全局浮层宿主：搜索 / 命令面板 / 快捷键速查 / 采集 / 好奇（首次呼出才挂载）',
  'newtab/components/AiSuggestionDrawer.vue': 'AI 评审面板（R161 起为中央弹窗）：指令条 + 左右对照 + 差异汇总 + 采纳',
  'newtab/components/TaskAddDrawer.vue': '任务新建 / 关联抽屉（三处入口复用）',
  'newtab/components/CurationDrillDrawer.vue': '下钻抽屉（分类 / 卡片 / 附件三类明细）',
  'newtab/components/ResourceEditForm.vue': '资源卡编辑表单（共享单份，抽屉与详情页同源）',
  'newtab/components/ResourceDetailDrawer.vue': '资源卡详情抽屉（可编辑）',
  'newtab/components/ProjectDetailDrawer.vue': '项目详情抽屉（可编辑）',
  // ---- 知源仪表盘组件（R172-T5~T8；调度画像周报浮层按 04-67 Q7 于 T9 退役）----
  'newtab/components/dashboard/DashboardOverview.vue': '概览带：5 存量卡 + 时间绑定 + 人话总结 + 参照系行 + 分数口径表',
  'newtab/components/dashboard/Heatmap.vue': '年度热力图：12 月 × 366 格 + 六档语义图例 + 摘要卡 + 切年',
  'newtab/components/dashboard/DayDetail.vue': '日详情（今日战报）：摘要 + 四格统计 + 热力带 + 降序叙事时间线 + 导出三件套（按原型，W6）',
  'newtab/components/dashboard/ReviewPanel.vue': '复盘段：紧凑两栏（画像摘要 + 节奏曲线 ｜ 目标对账 + 偏离预警），KPI/条形/规则三类下钻',
  'newtab/components/dashboard/DrillCardList.vue': '共用下钻卡片列表（同卡多次聚合 ×N；单击定位 / 双击开链）',
  'newtab/components/dashboard/DashboardLogDrawer.vue': '全量记录抽屉：三维筛选 + CSV + 容量提示（承接调度台旧四格记录能力）',
  'newtab/components/dashboard/useDashboardStats.ts': '仪表盘数据桥：聚合与选中态收口（含库容基线反推校准）',
  'newtab/components/dashboard/dashboard.css': '仪表盘三段样式（仅 tokens 令牌，`dz-` 前缀）',
  'newtab/components/LifecyclePanel.vue': '三卡生命周期面板（内嵌于设置页）',
  'newtab/components/ImportTemplateModal.vue': 'Markdown 模板导入弹窗（方向树 goal / 策展台 pyramid）',
  'newtab/components/LinkCardsModal.vue': '策展台节点「关联资源卡（镜像）」弹窗',
  'newtab/components/TaskAiMenu.vue': '任务级 AI 菜单（拆子任务 / 推荐资源卡 / 打开详情）——列表/看板/项目页',
  'newtab/components/TaskAiCorner.vue': '任务卡右上角 AI 角标（点击直跑补全 enrich，W6）',
  'newtab/components/ThesisBlock.vue': '论点骨架的结构化只读预览',
  'newtab/components/EvidenceMenuItem.vue': '节点菜单里的「🔍 找佐证」项',
  'newtab/components/ThesisAiBtn.vue': '策展台头部的「提炼论点骨架」AI 入口',
  'newtab/components/CardAiEntry.vue': '资源卡动作条的「✦ 全方位优化」入口',
  'newtab/components/CatNodeName.vue': '分类树 / 金字塔共用的「双击就地改名」单元',
  'newtab/components/MountCountBadge.vue': '任务「弹药」计数徽标（挂载资源卡 / 好奇心）',
  // ---- 方向台组件 ----
  'newtab/components/compass/TaskManagerPanel.vue': '任务卡面板（调度台第三 tab W1.1 前旧称任务调度；含批量与 AI 入口）',
  'newtab/components/compass/CuriosityPanel.vue': '好奇心卡面板（调度台；W1.1 前旧称好奇心培育）',
  'newtab/components/compass/TaskDetailDrawer.vue': '任务详情抽屉',
  'newtab/components/compass/NorthStarPanel.vue': '北极星面板（方向台底部）',
  'newtab/components/compass/MetricBar.vue': '方向状态四指标条（日 / 周 / 累计三档，可下钻）',
  'newtab/components/compass/LighthousePanel.vue': '主航线面板（目标卡 + 主攻聚焦条）',
  // ---- Pinia ----
  'newtab/stores/app.ts': '主数据仓：loadData / persist / 工作台 CRUD / UI 偏好 / 主题',
  'newtab/stores/compass.ts': '方向与项目状态 + 派生指标（projectProgress / isProjectStalled 等）+ 资源调用计数',
  'newtab/stores/curiosity.ts': '好奇心状态 → 展示元信息',
  // ---- AI 层 ----
  'shared/ai/job.ts': 'AI 任务契约（AiJob / AiRow / AiPaneLine）——`.ts` 侧与 `.vue` 侧共用的类型边界',
  'shared/ai/select.ts': '检索 / 推荐类 AI 入口工厂（语义检索、任务推荐）',
  'shared/ai/govern.ts': '治理类 AI 入口工厂（标签治理 / 回收站救援 / 跨台去重 / 论点）',
  'shared/ai/project.ts': '项目域 AI 入口工厂（项目卡、休眠、链路、标签体系）',
  'shared/ai/batchG.ts': '批量生成类 AI 入口工厂（论点 / 好奇分诊 / 佐证 / 交付）',
  'shared/ai/scenarios.ts': '提示词与输出契约（JSON 模式，绝不让模型自由散文）',
  'shared/ai/chain.ts': '链式任务（创建类采纳，带同层名称查重）',
  'shared/ai/runner.ts': 'AI 任务运行器（jobKey 幂等注册表：关抽屉不杀任务，只有「停止」才中止）',
  'shared/ai/llm.ts': 'LLM 调用层（chat / stream / 模型列表 / token 估算）',
  'shared/ai/directive.ts': '一次性指令（作用域 + 历史 + 优先级行）',
  'shared/ai/reports.ts': '报告型自动落卡（边界：只新增一张，不碰别的卡与结构）',
  'shared/ai/config.ts': 'AI 配置持久层（独立键 `zy_ai_v1`，密钥不随备份包外发）',
  'shared/ai/linkFetch.ts': '链接正文抓取（http(s) 白名单，会话级缓存，失败降级）',
  'shared/ai/pair.ts': '左右栏对照配对（哪一行对应哪一行；配不上 = AI 新增）',
  // ---- 共享组件 ----
  'shared/components/Drawer.vue': '通用右侧抽屉壳（**全站 30+ 宿主，改动需全量回归**）',
  'shared/components/Modal.vue': '通用中央弹窗壳（R161 新建；Esc / 焦点管理 / 真全屏宿主）',
  'shared/components/toast.ts': '全局 Toast 单例（队列合并 ×N + 撤销入口自动入栈）',
  'shared/components/AiMark.vue': '全站 AI 徽标**真源**（R155 起 emoji → 单色 SVG，随主题 accent）',
  'shared/components/MaturityBadge.vue': '成熟度徽标',
  'shared/components/AiEntryButton.vue': '统一 AI 入口按钮（icon / inline / footer 三态）',
  // ---- 存储层 ----
  'shared/storage/repository.ts': '数据存储层（chrome.storage.local 唯一读写口；订阅 / 合并 / 落盘状态）',
  'shared/storage/keys.ts': '存储键字典（**全站唯一字面量出处**；R159 门禁：裸键名即红）',
  'shared/storage/hotStats.ts': '热度统计独立键（单击看详情不再重写整库）',
  // ---- 工具 ----
  'shared/utils/undo.ts': '全局撤销栈（Toast 撤销动作自动入栈 + `Cmd/Ctrl+Z`）',
  'shared/utils/eventLog.ts': '卡片操作事件日志（保存链路快照 diff 产出）',
  'shared/utils/pinyin.ts': '拼音 / 首字母搜索（R160 起为自生成两层表，pinyin-pro 已退役）',
  'shared/utils/pinyinTable.ts': '拼音两层表（**生成物**，勿手改；生成器 `scripts/gen-pinyin-table.cjs`）',
  'shared/utils/catIndex.ts': '分类树索引层（一次建表，替代 37 处 O(n) 全表扫描）',
  'shared/utils/maturity.ts': '三卡成熟度纯计算（记忆化）',
  'shared/utils/lifecycle.ts': '三卡生命周期三态模型（纯计算）',
  'shared/utils/reviewReport.ts': '复盘计算引擎（四范围窗口 / 等长环比 / 分位 / 8 条偏离规则 / 6 KPI / 目标对账接线；纯读取零写入）· R172-T9 起承接原 weeklyReport.ts 的 weekWindow',
  'shared/utils/dailyStats.ts': 'zy_daily_stats 按日聚合引擎（事件折叠 + 前缀和库容 + 分值表单一真源 + 防刷分）',
  'shared/utils/drillRows.ts': '事件 → 下钻行的单一分组实现（同卡多次聚合 ×N，日详情与复盘段共用）',
  'shared/utils/mdImport.ts': 'Markdown 模板解析（方向树 goal / 策展台 pyramid 两个纯函数）',
  'shared/utils/zip.ts': '零依赖 ZIP 读写（STORE 模式，附件包导出 / 导入）',
  'shared/utils/cards.ts': '转卡统一引擎（单向唯一：好奇心 → 任务 / 资源）',
  'shared/utils/taskLinks.ts': '任务与指标的挂载 / 解绑（解绑不删本体）',
  'shared/utils/fields.ts': '字段配置 → 视图渲染助手（排序 / 显隐 / 取值）',
  'shared/utils/locate.ts': '定位能力统一出口（三处生产端共用一个口径）',
  'shared/utils/bus.ts': '抽屉打开事件总线（含按需挂载的暂存回放）',
  // ---- content / background ----
  'content/overlay-impl.ts': '网页浮层实现层（搜索 / 采集资源卡 / 采集好奇心 / 采集任务），纯 Vanilla',
  'content/search-overlay.ts': 'Content Script 信号层（约 2.9KB 常驻；重型浮层实现按需拉取）',
  'content/selection.ts': '网页选区捕获',
  'background/index.ts': 'Background SW：命令监听 / 浮层注入 / 单例定位 / 路由中转'
}

/** 提取导出符号（函数/常量/类/接口/类型 + export{} 列表） */
function exportsOf(src, isVue) {
  const text = scriptPart(src, isVue)
  const out = new Set()
  const re1 = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re1.exec(text))) out.add(m[1])
  const re2 = /export\s*\{([^}]+)\}/g
  while ((m = re2.exec(text))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) out.add(name)
    }
  }
  return [...out]
}

/** 目录顺序：按重要性排（评审模型先看这里） */
const DIR_ORDER = ['newtab', 'shared', 'content', 'background', 'popup', 'options', 'assets']
const SUBDIR_LABEL = {
  'newtab/views': '页面视图（路由级）',
  'newtab/components': '应用内组件',
  'newtab/components/dashboard': '知源仪表盘组件（概览带 / 热力图 / 日详情 / 复盘段 / 记录抽屉）',
  'newtab/components/compass': '方向台组件',
  'newtab/composables': '组合式函数（从巨型视图拆出的域）',
  'newtab/stores': 'Pinia 状态仓',
  'shared/ai': 'AI 能力层（入口工厂 / 执行器 / 对照）',
  'shared/ai/jobs': 'AI 入口声明表',
  'shared/components': '跨视图共享组件',
  'shared/models': '领域模型与类型',
  'shared/storage': '存储层（仓库 / 迁移 / 索引）',
  'shared/utils': '纯工具',
  'shared/styles': '设计令牌'
}

const files = walk(SRC)
const rows = []
let totalLines = 0
const bigFiles = []

for (const abs of files) {
  const src = fs.readFileSync(abs, 'utf8')
  const rel = path.relative(SRC, abs).split(path.sep).join('/')
  const isVue = abs.endsWith('.vue')
  const lines = src.split('\n').length
  totalLines += lines
  if (lines >= 800) bigFiles.push({ rel, lines })
  // 手工表优先（见 MANUAL_NOTES 注释：自动提取拿到的是"理由"而非"职责"）
  const note = MANUAL_NOTES[rel] || headNote(src, isVue) || '（无文件说明）'
  rows.push({ rel, lines, note, exps: exportsOf(src, isVue) })
}

// 按目录分组
const groups = new Map()
for (const r of rows) {
  const dir = path.dirname(r.rel)
  if (!groups.has(dir)) groups.set(dir, [])
  groups.get(dir).push(r)
}

const dirKeys = [...groups.keys()].sort((a, b) => {
  const ia = DIR_ORDER.findIndex((d) => a === d || a.startsWith(d + '/'))
  const ib = DIR_ORDER.findIndex((d) => b === d || b.startsWith(d + '/'))
  const sa = ia < 0 ? 99 : ia
  const sb = ib < 0 ? 99 : ib
  return sa - sb || a.localeCompare(b)
})

const out = []
out.push('# 代码索引（L4 · 自动生成）')
out.push('')
out.push('> ⚠ **本文件由 `v2/scripts/gen-code-index.cjs` 生成，不要手改**——改代码后重跑一次即可同步。')
out.push('> 生成时间：' + new Date().toISOString().slice(0, 19).replace('T', ' '))
out.push('>')
out.push(`> 规模：**${rows.length} 个源文件 / ${totalLines.toLocaleString('en-US')} 行**（\`.ts\` + \`.vue\`，不含 \`scripts/\` 与文档）`)
out.push('>')
out.push('> **怎么用**：这是「目录」，不是「内容」。评审时先用它定位到文件，再按需索取具体文件全文——')
out.push(`> 不要试图一次读完 ${Math.round(totalLines / 1000)}K 行。标 ⚠ 的文件是**结构性债务候选**（≥800 行，单文件承担职责过多）。`)
out.push('')
out.push('## 一、结构性债务候选（≥800 行）')
out.push('')
if (bigFiles.length) {
  out.push('| 文件 | 行数 |')
  out.push('|---|---:|')
  for (const b of bigFiles.sort((a, b) => b.lines - a.lines)) out.push(`| \`${b.rel}\` | ${b.lines} |`)
} else {
  out.push('（无）')
}
out.push('')
out.push('> 参考：04-59 立的验收线是「拆分后单文件 ≤1500 行」。上表是**当前**实测，非历史引用。')
out.push('')
out.push('## 二、按目录分组')
out.push('')

for (const dir of dirKeys) {
  const list = groups.get(dir).sort((a, b) => b.lines - a.lines)
  const label = SUBDIR_LABEL[dir]
  const shown = dir === '.' ? 'src/' : `src/${dir}`
  out.push(`### \`${shown}\`${label ? ` —— ${label}` : ''}（${list.length} 文件 / ${list.reduce((s, r) => s + r.lines, 0).toLocaleString('en-US')} 行）`)
  out.push('')
  out.push('| 文件 | 行 | 职责 | 导出 |')
  out.push('|---|---:|---|---|')
  for (const r of list) {
    const name = path.basename(r.rel)
    const flag = r.lines >= 800 ? ' ⚠' : ''
    const exps = r.exps.length ? r.exps.slice(0, 8).join(', ') + (r.exps.length > 8 ? ` …+${r.exps.length - 8}` : '') : '—'
    out.push(`| \`${name}\`${flag} | ${r.lines} | ${r.note || '—'} | ${exps} |`)
  }
  out.push('')
}

out.push('---')
out.push('')
out.push('## 三、脚本与门禁（`v2/scripts/`）')
out.push('')
out.push('| 脚本 | 用途 |')
out.push('|---|---|')
const scriptNotes = {
  'regression.cjs': '静态回归断言（R174-1 分片编排入口；断言体在 scripts/regression/，基建在 regression/helpers.cjs）',
  'e2e.cjs': '端到端（Playwright）',
  'perf.cjs': '性能基准（medium/large 档，支持 --dist= 同机 A/B）',
  'pack.cjs': '出包（剥 map / 校验体积预算）',
  'entry-matrix.cjs': 'AI 入口能力矩阵双向对账',
  'entry-literals.cjs': '入口字面量门禁',
  'theme-audit.cjs': '四主题 × 台面截图走查',
  'theme-contrast.cjs': '四主题 WCAG 对比度门禁',
  'check-cycles.cjs': '循环依赖检查',
  'test-import-compat.cjs': '导入兼容性',
  'test-purge.cjs': '硬删副作用',
  'img-diff.cjs': '逐像素差异（md5 会骗人）',
  'gen-pinyin-table.cjs': '生成拼音两层表',
  'gen-code-index.cjs': '生成本索引',
  'probe-f.cjs': '真实交付包 7 项复测',
  'perf-longtask.cjs': '长任务打点',
  'perf-live.cjs': '浏览器实测',
  'perf-probe.cjs': '性能探针',
  'probe-f.cjs': '分发复测',
  'repro-tdz.cjs': 'TDZ 崩溃复现',
  'repro-tour.cjs': '引导复现',
  'repro-tdz2.cjs': 'TDZ 复现（二）',
  'test-perf.cjs': '性能冒烟',
  'fix-dedupe.cjs': '去重修复（一次性）'
}
const scriptFiles = fs.readdirSync(path.join(V2_ROOT, 'scripts')).filter((f) => f.endsWith('.cjs')).sort()
for (const f of scriptFiles) {
  // R164：体积按 LF 归一化计算——Windows checkout（CRLF）会把每个脚本撑大 ~1 字节/行，
  // 与 Mac（LF）生成值必然不一致（索引漂移误报的第二处来源）。
  const kb = (Buffer.byteLength(fs.readFileSync(path.join(V2_ROOT, 'scripts', f), 'utf8').replace(/\r\n/g, '\n')) / 1024).toFixed(0)
  out.push(`| \`${f}\` (${kb}KB) | ${scriptNotes[f] || '—'} |`)
}
out.push('')

const md = out.join('\n')

/* ── --check：只比不写。索引是生成物，一旦与源码漂移，评审模型会照着错行号下判断——
      所以"改代码不改索引"必须当场红，而不是靠人记得重跑。 ── */
if (process.argv.includes('--check')) {
  // 行内容按「文件路径」建表比对（整体逐行 diff 会被插入行的位移污染，看不出真差异）
  const toMap = (text) => {
    const m = new Map()
    for (const line of text.split('\n')) {
      const mm = /^\| `([^`]+)`/.exec(line)
      if (mm) m.set(mm[1], line)
    }
    return m
  }
  let disk = ''
  try {
    // R164：读取时 CRLF 归一化——Windows checkout（autocrlf）会把索引 .md 转成 CRLF，
    // 逐行比对会把 171 项全部误判为「漂移」（Mac/LF 正常）。生成侧恒 LF，比对侧必须同口径。
    disk = fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n')
  } catch (e) {
    console.error('❌ 索引文件不存在：' + OUT + '（跑 node v2/scripts/gen-code-index.cjs 生成）')
    process.exit(1)
  }
  const a = toMap(disk)
  const b = toMap(md)
  const missing = [...b.keys()].filter((k) => !a.has(k))
  const stale = [...a.keys()].filter((k) => !b.has(k))
  const changed = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k))
  if (!missing.length && !stale.length && !changed.length) {
    console.log('✓ 代码索引与源码一致（' + b.size + ' 行索引项）')
    process.exit(0)
  }
  console.error('❌ 代码索引已漂移，必须重跑：node v2/scripts/gen-code-index.cjs')
  if (missing.length) console.error('   索引缺这些项：' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' …共 ' + missing.length + ' 项' : ''))
  if (stale.length) console.error('   索引里是死引用（源码已无此项）：' + stale.slice(0, 8).join(', ') + (stale.length > 8 ? ' …共 ' + stale.length + ' 项' : ''))
  if (changed.length) console.error('   行数/职责/导出符号变了：' + changed.slice(0, 8).join(', ') + (changed.length > 8 ? ' …共 ' + changed.length + ' 项' : ''))
  process.exit(1)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md)
console.log(`✓ 代码索引已生成：${OUT}`)
console.log(`  ${rows.length} 文件 / ${totalLines.toLocaleString('en-US')} 行 · 债务候选 ${bigFiles.length} 个`)
