/**
 * V4.6.0 · 产品文档与断言事实回填（文档侧门禁）。
 *
 * 为什么要有这一片：B8-6 只守**架构总览**、B8-7 只守**产品认知基线**，
 * 而对外表达的最高事实源「00_产品事实与表达母版」与「00_术语对照表」**一条判据都没有**。
 * 实测后果：母版正文停在 V4.2.5、术语表停在 V3.8.8，中间约 20 个小版本里
 * 产品结构发生了一次收敛（Inbox / 移动 PWA / 周期 AI / 任务评分与优先级退役）
 * 和一次扩张（新增选题卡、三卡池 → 四卡池），而这两份文档仍在把退役能力当现役讲。
 *
 * 判定纪律（照抄 B8-6a 的教训）：
 *   · **不写死当期数字**——版本号从 manifest 锚派生，主题名从 App.vue 实读，
 *     复制文案从 focusCopy.ts 实读，附件限额从 ASSET_KIND_MB 实读；
 *   · **负锚只查现行段落**——变更记录与退役术语表里复述旧词是正确行为，必须豁免；
 *   · 文档说的那件事，代码里必须真的还在（正锚），且已退役的那件事不许再被当现役讲（负锚）。
 */
const { check, read, CUR_VTAG } = require('./helpers.cjs')

console.log('【V4.6.0 · 产品文档与断言事实回填】')

const MOTHER = read('/../../文档中心/00_产品事实与表达母版.md')
const GLOSSARY = read('/../../文档中心/00_术语对照表.md')
const ARCH = read('/../../文档中心/00_架构总览.md')
const MANIFEST = read('/manifest.ts')
const APP = read('/newtab/App.vue')
const MODELS = read('/shared/models/index.ts')
const FOCUS_COPY = read('/shared/utils/focusCopy.ts')
const ASSET_KIND = read('/shared/utils/assetKind.ts')
const ROUTER = read('/newtab/router.ts')
const DEFAULTS = read('/shared/storage/defaults.ts')
const TASK_DRAWER = read('/newtab/components/compass/TaskDetailDrawer.vue')
const COMPASS_TREE = read('/newtab/views/CompassTree.vue')
const COMPASS_SPINE = read('/newtab/components/compass/CompassSpine.vue')
const COMPASS_HOME = read('/newtab/views/CompassHome.vue')
const MANUAL = read('/newtab/manual-data.ts')
const DOC_INDEX = read('/../../文档中心/INDEX.md')
const DOC_README = read('/../../文档中心/README.md')
const RELEASE_CHECKLIST = read('/../../文档中心/06_测试与发布/06-2_发布验收清单.md')
const ATLAS = read('/../../文档中心/09_模板与素材/知源调度台_架构图集.html')

/** 母版现行段落 = 变更记录之前（变更记录里复述历史旧词是正确的，不能当失真） */
function motherCurrent() {
  const i = MOTHER.indexOf('## 变更记录')
  return i > 0 ? MOTHER.slice(0, i) : ''
}

/** 术语表现行段落 = §十一 退役术语之前（退役表本身就是旧词的正确归宿） */
function glossaryCurrent() {
  const i = GLOSSARY.indexOf('## 十一、退役术语')
  return i > 0 ? GLOSSARY.slice(0, i) : ''
}

check('DOC460-1 ★三份核心文档的版本行必须等于 manifest 现行版本 —— 版本行是唯一会被人记得改的地方，正因如此它最容易掩盖正文的腐烂；本条把它变成「正文也必须跟上」的入口', () => {
  if (!MOTHER || !GLOSSARY || !ARCH) return false
  const mv = MANIFEST.match(/version: '([\d.]+)'/)
  if (!mv || `V${mv[1]}` !== CUR_VTAG) return false
  return MOTHER.includes(`版本：${CUR_VTAG}`)
    && GLOSSARY.includes(`**版本**：${CUR_VTAG}`)
    && ARCH.includes(`> **版本**：${CUR_VTAG}`)
})

check('DOC460-2 ★母版现行段落不得把 Inbox / 移动 PWA 当现役采集路径 —— V4.3.0 已物理退役（src/mobile 不存在、旧深链回调度台）。允许出现在「已退役」句里，不允许作为功能清单条目', () => {
  const cur = motherCurrent()
  if (!cur) return false
  // 负锚：整段功能条目标题不许再出现
  if (cur.includes('- **Inbox 移动采集与待处理收件箱**')) return false
  if (cur.includes('手机 PWA 提交的文本')) return false
  // 正锚：必须明写退役，并给出唯一采集主线
  return cur.includes('浏览器内直达采集（唯一采集主线）')
    && cur.includes('移动采集 PWA 与 PC Inbox 已于 V4.3.0 物理退役')
    && cur.includes('### 9.1 已退役能力')
})

check('DOC460-3 ★母版与术语表必须收录选题卡为第五类卡片对象，且模型侧字段确实齐备 —— 文档讲了代码没有＝空头承诺，代码有了文档没讲＝对外漏掉核心能力，两个方向都要堵', () => {
  const cur = motherCurrent()
  if (!cur) return false
  return cur.includes('**五类卡片对象**')
    && cur.includes('选题卡（面向外界的成果）')
    && cur.includes('四个卡片池（V4.5.0 起')
    && GLOSSARY.includes('**选题卡（TopicCard）**')
    && GLOSSARY.includes('**选题状态定义（TopicStatusDef）**')
    && GLOSSARY.includes('**选题资源关系（TopicResourceLink）**')
    && MODELS.includes('export interface TopicCard extends CardBase')
    && MODELS.includes('export interface TopicStatusDef')
    && MODELS.includes('export interface TopicResourceLink')
    && MODELS.includes('topicResourceLinks?: TopicResourceLink[]')
})

check('DOC460-4 ★四卡池口径三份文档一致：四页签都在调度台一级，旧 /deck 四档只作兼容重定向，方向树策展模式二级页在视图表里 —— 旧文档写「三类卡池」「资源卡池没有自己的路由」均已过时', () => {
  const cur = motherCurrent()
  if (!cur) return false
  return ROUTER.includes("path: '/deck/:kind(task|topic|curiosity|resource)'")
    && ROUTER.includes("path: '/compass/curation'")
    && cur.includes('/deck/task')
    && cur.includes('/deck/topic')
    && cur.includes('/deck/curiosity')
    && cur.includes('/deck/resource')
    && ARCH.includes('/deck/:kind(task｜topic｜curiosity｜resource)')
    && ARCH.includes('CompassCurationPage.vue')
    && ARCH.includes('resourceLocateRoute()')
    && GLOSSARY.includes('任务 / 选题 / 好奇心 / 资源都在调度台一级')
})

check('DOC460-5 ★今日三件事复制文案逐字取自 focusCopy.ts，且母版不得残留 MOC- 前缀口径 —— V4.3.4 起项目名逐字原样输出；文档里留着旧模板会让用户按不存在的格式写日志', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const tpl = FOCUS_COPY.match(/return `(推进\[\[\$\{project\}\]\]项目[^`]*)`/)
  if (!tpl) return false
  // 文档侧用占位符形态表达同一句式（真源是模板串，文档是给人读的）
  return cur.includes('推进[[项目名]]项目，任务内容，助力【指标名】指标落实到位')
    && cur.includes('不自动加 MOC- 前缀')
    && !cur.includes('推进[[MOC-项目名]]项目')
    && tpl[1].includes('助力【${metric}】指标落实到位')
})

check('DOC460-6 ★今日三件事恒三槽、任务与选题共用、与今日日历严格同源 —— 三条口径必须同时出现在母版现行段落，且代码侧上限与移出清日期仍在', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const slots = read('/shared/utils/focusSlots.ts')
  return cur.includes('今日三件事（任务与选题共用）')
    && cur.includes('恒 3 槽')
    && cur.includes('今日三件事与今日日历严格同源、双向联动')
    && cur.includes('移出三件事同时清空该卡的今日计划日期')
    && cur.includes('全部 / 任务卡 / 选题卡')
    && slots.includes('FOCUS_LIMIT = 3')
    && slots.includes('export function detachFocusTopicFromDate')
})

check('DOC460-7 ★四套正式主题名以 App.vue 的 themes 数组为真源，母版与术语表逐名对齐；默认主题与密度档数不许再写旧值', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const names = [...APP.matchAll(/\{ id: '([a-z]+)', name: '([^']+)'/g)].map(m => ({ id: m[1], name: m[2] }))
  if (names.length !== 4) return false
  const repo = read('/shared/storage/repository.ts')
  return names.every(n => cur.includes(n.name) && GLOSSARY.includes(n.name) && GLOSSARY.includes(`\`${n.id}\``))
    && repo.includes("theme: 'raycast'")
    /* ★V4.7.6 重指备案：用户拍板主行动统一为知源 Logo 蓝，光速黑不再使用暗红强调；
       主题 ID 仍保留 raycast / oppo，oppo 的界面名改为「知源蓝」。判据守的仍是
       「默认主题与强调色口径必须与现行产品一致」，不删除任何断言。 */
    && cur.includes('光速黑（默认，知源蓝强调）')
    && cur.includes('密度为紧凑 / 舒适两档开关')
    && !cur.includes('四套主题（深空薰衣草默认）')
    && !cur.includes('三档密度')
    && ARCH.includes('**两档**（紧凑 / 舒适')
    && MODELS.includes("density?: 'compact' | 'cozy'")
})

check('DOC460-8 ★附件限额按类型分档，真源是 ASSET_KIND_MB —— 母版旧写「统一单文件 ≤20MB」与代码不符（图片 10 / PDF 50）；对外讲错限额会让用户以为能挂更大的图', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const img = ASSET_KIND.match(/image:\s*(\d+)/)
  const html = ASSET_KIND.match(/html:\s*(\d+)/)
  const pdf = ASSET_KIND.match(/pdf:\s*(\d+)/)
  if (!img || !html || !pdf) return false
  const line = `图片 ≤${img[1]}MB、HTML ≤${html[1]}MB、PDF ≤${pdf[1]}MB`
  return cur.includes(line)
    && cur.includes('ASSET_KIND_MB')
    && !cur.includes('IndexedDB 本地存储，单文件 ≤20MB')
    && ARCH.includes('图片 10MB、HTML 20MB、PDF 50MB')
})

check('DOC460-9 ★镜像白名单四条（含选题卡 → 资源卡独立关系表）在三份文档口径一致；策展节点 linkedTopicIds 的引用例外必须明文备案，不许被当成红线破口删掉', () => {
  const cur = motherCurrent()
  if (!cur) return false
  return cur.includes('卡间与镜像关系（白名单）')
    && cur.includes('选题卡关联资源卡')
    && cur.includes('topicResourceLinks')
    && ARCH.includes('V4.5.0 扩为四条')
    && ARCH.includes('resourceFolderMirrors')
    && ARCH.includes('Category.linkedTopicIds')
    && MODELS.includes('linkedTopicIds?: ID[]')
    && GLOSSARY.includes('SupportLink / TopicResourceLink')
})

check('DOC460-10 ★任务详情退役六项必须在母版明写，且详情组件确实不再提供它们 —— 导出 / 子任务 / AI 拆解 / 预计用时 / 优先级 / 任务评分', () => {
  const cur = motherCurrent()
  if (!cur) return false
  return cur.includes('导出、子任务、AI 拆解、预计用时、优先级与任务评分已全部退出任务详情')
    && cur.includes('看懂任务、找到资源、安排时间')
    && TASK_DRAWER.includes('AI 拆解、子任务、优先级、估时与导出退出任务详情')
    && !TASK_DRAWER.includes('SubtaskList')
    && GLOSSARY.includes('**任务评分 / C·缺件 50 / taskGrade**')
    && GLOSSARY.includes('**优先级（高优/中优/低优）**')
})

check('DOC460-11 ★退役术语章节必须存在且覆盖本轮收敛的全部路线，含用户明确废弃的「全局采集」与「原型演示」；同时保留 gradeOf 的合法用途说明防后人误删战略目标成熟度', () => {
  if (!GLOSSARY.includes('## 十一、退役术语')) return false
  const retired = GLOSSARY.slice(GLOSSARY.indexOf('## 十一、退役术语'))
  const must = [
    '**Inbox / 待处理收件箱**',
    '**移动采集 PWA / 手机采集**',
    'PiAiReview',
    '**子任务清单 / SubtaskList / FocusDetail**',
    '**顶栏同步呼吸灯 / LED_CLASSES**',
    '**Airtable 单向同步',
    '**全局采集（方案 / 需求分析）**',
    '**原型演示（V1–V5 / 创作台）**',
    '**「30 天内可找回」**',
  ]
  return must.every(s => retired.includes(s))
    && retired.includes('shared/utils/maturity.ts')
    && retired.includes('战略目标成熟度')
    && motherCurrent().includes('「全局采集」与「原型演示」两条产品路线')
})

check('DOC460-12 ★术语表存储键一节只能是导读：指向 keys.ts 常量、不复述任何 zy_* 字面量 —— R159 在源码侧禁裸键名，文档侧每多一份副本就多一处会漂移的假真源（旧表还虚构过一个备份键）', () => {
  const i = GLOSSARY.indexOf('## 七、存储键')
  const j = GLOSSARY.indexOf('## 八、快捷键')
  if (i < 0 || j <= i) return false
  const seg = GLOSSARY.slice(i, j)
  const literals = [...seg.matchAll(/`(zy_[a-z0-9_]+)`/g)].map(m => m[1])
  if (literals.length) { console.log('     术语表存储段复述了键名：' + literals.join(', ')); return false }
  return seg.includes('shared/storage/keys.ts')
    && seg.includes('`K.DATA`')
    && seg.includes('`IDB_NAMES.ASSETS`')
    && seg.includes('R159')
    && seg.includes('那个键从不存在')
})

check('DOC460-13 ★术语表快捷键必须覆盖选题两条新命令，且与 manifest 的无默认键约定一致 —— 用户要在 chrome://extensions/shortcuts 里自己绑，文档漏了就等于功能不存在', () => {
  const i = GLOSSARY.indexOf('## 八、快捷键')
  const j = GLOSSARY.indexOf('## 九、易混淆概念')
  if (i < 0 || j <= i) return false
  const seg = GLOSSARY.slice(i, j)
  return MANIFEST.includes("'goto-topic'")
    && MANIFEST.includes("'open-topic'")
    && MANIFEST.includes("description: '直达选题卡池'")
    && MANIFEST.includes("description: '快速采集选题卡'")
    && seg.includes('`goto-topic`')
    && seg.includes('`open-topic`')
    && seg.includes('chrome://extensions/shortcuts')
    && seg.includes('最多 4 个')
})

check('DOC460-14 ★选题默认四状态与「有且只有一个完成态」在文档与 defaults.ts 一致；成果不计入任务完成率这条产品语义必须写进母版 —— 它是选题卡与任务卡的根本分工', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const names = ['构思中', '制作中', '待发布', '已发布']
  return names.every(n => DEFAULTS.includes(`name: '${n}'`) && cur.includes(n))
    && DEFAULTS.includes("id: 'topic-published'")
    && cur.includes('仅「已发布」为完成态')
    && cur.includes('不计入任务完成率')
    && GLOSSARY.includes('不计入任务完成率')
})

check('DOC460-15 ★母版 §15 质量基线必须与代码生成物同源（索引规模 / census 场景数 / 分片数），且不写死会随版本变的数字 —— 照抄 B8-6a 的纪律：从生成物实读当期值来对照', () => {
  const cur = motherCurrent()
  if (!cur) return false
  const fs = require('fs')
  const path = require('path')
  const IDX = read('/../../评审交接包/02_代码索引.md')
  const m = (IDX || '').match(/规模：\*\*(\d+)\s*个源文件\s*\/\s*([\d,]+)\s*行/)
  if (!m || !m[2]) return false
  const REG = fs.readFileSync(path.resolve(__dirname, '..', 'regression.cjs'), 'utf8')
  const sm = REG.match(/const SHARDS = \[([\s\S]*?)\]/)
  if (!sm) return false
  const shards = [...sm[1].matchAll(/'([^']+)'/g)].length
  const censusPath = path.resolve(__dirname, '..', '..', '..', 'docs', '视觉归档', '_census', 'class-census.json')
  if (!fs.existsSync(censusPath)) return false
  let census = null
  try { census = JSON.parse(fs.readFileSync(censusPath, 'utf8')) } catch { return false }
  if (!census || !Number.isFinite(census.场景数)) return false
  return cur.includes(`${m[1]} 文件 / ${m[2]} 行`)
    && cur.includes(`${census.场景数} 图`)
    && cur.includes(`${shards} 分片`)
    && cur.includes('权威工程读数以 `评审交接包/01_项目透视卡.md`')
})

check('DOC460-16 ★架构总览目录规模必须是 maxdepth 1 口径的实测值，且写明 components 的 33 是直属文件不是组件总数 —— 旧表把递归总数 113 混进 maxdepth 1 口径，两个口径混用比数字过时更难发现', () => {
  const fs = require('fs')
  const path = require('path')
  const srcRoot = path.resolve(__dirname, '..', '..', 'src')
  const countOf = (rel) => {
    const dir = path.join(srcRoot, rel)
    if (!fs.existsSync(dir)) return -1
    return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).length
  }
  const pairs = [
    ['newtab/views', 'views/'],
    ['newtab/components', 'components/'],
    ['newtab/composables', 'composables/'],
    ['shared/utils', 'utils/'],
    ['shared/ai', 'ai/'],
  ]
  for (const [rel, label] of pairs) {
    const n = countOf(rel)
    if (n < 0) return false
    // 架构图里形如 `│  views/     36 文件`
    const re = new RegExp(`${label.replace('/', '\\/')}\\s+${n} 文件`)
    if (!re.test(ARCH)) { console.log(`     架构总览 ${label} 应为 ${n} 文件`); return false }
  }
  return ARCH.includes('maxdepth 1')
    && ARCH.includes('33 是「直属文件」不是组件总数')
    && ARCH.includes('src/mobile/` 已于 V4.3.0 删除')
})

check('DOC460-17 ★母版必须留有本轮跨版本回填的登记行，并点名新增分片 —— 与 B8-6c / B8-7b 同一口径：文档失去「哪一批补记」的痕迹后，下次腐烂就无从核对', () => {
  const log = MOTHER.slice(MOTHER.indexOf('## 变更记录'))
  if (!log) return false
  return log.includes('V4.6.0（跨版本事实回填）')
    && log.includes('143-v460-doc-truth-sync.cjs')
    && log.includes('V4.5.0')
    && log.includes('V4.4.0')
    && log.includes('V4.3.0')
    && GLOSSARY.includes('跨版本回填 V3.8.8 → V4.6.0')
    && ARCH.includes('二次回填（2026-11-19 · 文档与断言事实盘点）')
})

check('DOC460-18 ★文档中心两份导航（INDEX / README）的版本行与回归口径必须跟上 manifest 与分片表 —— 它们是新人接手的第一入口：母版讲对了但导航还写「三卡池 / 1012 项断言」，读者会在第一步就走错方向。★同时钉住"分层免责"：01–09 层材料确实还没回填，导航必须明写这件事而不是假装全库同步', () => {
  if (!DOC_INDEX || !DOC_README) return false
  const fs = require('fs')
  const path = require('path')
  const REG = fs.readFileSync(path.resolve(__dirname, '..', 'regression.cjs'), 'utf8')
  const sm = REG.match(/const SHARDS = \[([\s\S]*?)\]/)
  if (!sm) return false
  const shards = [...sm[1].matchAll(/'([^']+)'/g)].length
  return DOC_INDEX.includes(`**版本**：${CUR_VTAG}`)
    && DOC_README.includes(`当前事实基线：**${CUR_VTAG}**`)
    && DOC_INDEX.includes(`${shards} 个分片`)
    && DOC_README.includes(`${shards} 分片`)
    // 分层免责：不许把未回填的角色材料说成已同步
    && DOC_README.includes('01–09 各层材料仍停在')
    && DOC_INDEX.includes('已被 V4.5.0 四卡池与选题卡覆盖')
})

check('DOC460-19 ★文档中心导航不得再把退役能力当现役指路：INDEX 必须带 V4.3→V4.6 结构变更提醒并指向母版 §9.1 / 术语表 §十一；README 的台面术语纪律必须把「资源台」写成已退役 —— 旧 README 第 5 条曾要求"对外一律使用调度台/方向台/资源台/策展台四个现名"，那是把退役名当规范推行，比数字过时更有害', () => {
  if (!DOC_INDEX || !DOC_README) return false
  if (DOC_README.includes('四个现名')) return false
  return DOC_INDEX.includes('V4.3.0 → V4.6.0 结构变更提醒')
    && DOC_INDEX.includes('母版 §9.1 与术语表 §十一')
    && DOC_INDEX.includes('「全局采集」「原型演示」两条产品路线**需求废弃**')
    && DOC_README.includes('**「资源台」已于 V3.7.0–V3.8.0 退役**')
    && DOC_README.includes('退役能力纪律（V4.6.0 立）')
    && DOC_README.includes('选题卡表达纪律')
})

check('DOC460-20 ★文档中心两份导航的相对链接零死链 —— 与 R36-23 同一口径扩到文档中心：导航的唯一职责是指路，指到不存在的文件比不指更糟。本轮实测挖出 5 处（销售 FAQ 已移入 02-8_渠道文案集/、四份交付说明误写 ./docs/ 而非 ../docs/）', () => {
  const fs = require('fs')
  const path = require('path')
  const root = path.resolve(__dirname, '..', '..', '..')
  let total = 0
  for (const rel of ['INDEX.md', 'README.md']) {
    const dir = path.join(root, '文档中心')
    const src = fs.readFileSync(path.join(dir, rel), 'utf8')
    for (const m of src.matchAll(/\]\((\.{1,2}\/[^()\s]+?)\)/g)) {
      total++
      if (!fs.existsSync(path.resolve(dir, m[1]))) {
        console.log(`     死链：文档中心/${rel} → ${m[1]}`)
        return false
      }
    }
  }
  return total >= 20
})

check('DOC460-21 ★发布验收清单必须有「§0 当期读数速查」且回归口径与分片表同源 —— 06-2 是每轮发版真正照着勾的那份清单，它的正文是逐轮校准点的历史层积（还写着 1518 条 / 68 图 / 六处版本）。历史教训要留，但"这轮该达到什么"必须有一处当期真值，否则发版人会照着三年前的数字验收', () => {
  if (!RELEASE_CHECKLIST) return false
  const fs = require('fs')
  const path = require('path')
  const REG = fs.readFileSync(path.resolve(__dirname, '..', 'regression.cjs'), 'utf8')
  const sm = REG.match(/const SHARDS = \[([\s\S]*?)\]/)
  if (!sm) return false
  const shards = [...sm[1].matchAll(/'([^']+)'/g)].length
  const head = RELEASE_CHECKLIST.slice(0, RELEASE_CHECKLIST.indexOf('## A 构建'))
  if (!head) return false
  return head.includes(`**当期基线：${CUR_VTAG}`)
    && head.includes('## 0 当期读数速查')
    && head.includes(`${shards} 分片`)
    // 四条口径变更必须明写，否则旧正文会继续误导
    && head.includes('版本同步是七处不是六处')
    && head.includes('卡片对象是五类、卡片池是四池')
    && head.includes('不得把告警写成"通过"')
    && head.includes('143-v460-doc-truth-sync.cjs')
})

/* ---------------------------------------------------------------------------
 * 根 README：GitHub 首页 = 外部读者与接手智能体的第一入口。
 * R36-18/21/23、R37-11/12 只守它的骨架与死链，**没人守它讲的功能是不是现役**——
 * 于是它在四卡池上线后仍写「核心抽象是三卡」「11 个命令项」「三套正式主题」。
 * 下面三条把它的产品口径也钉在代码上。
 * ------------------------------------------------------------------------- */
const ROOT_README = read('/../../README.md')

check('DOC460-22 ★根 README 的核心抽象必须是四卡且点名选题卡 —— GitHub 首页写「三卡」，等于对外的第一印象就漏掉了本轮最大的产品扩张；同时不得再把 V3.9 需求基准称作「产品最高需求真源」（它的三卡口径已被覆盖）', () => {
  if (!ROOT_README) return false
  if (ROOT_README.includes('**它的核心抽象是三卡**')) return false
  if (ROOT_README.includes('统一收纳为可被你自己指挥的三类卡片')) return false
  if (ROOT_README.includes('**产品最高需求真源**')) return false
  return ROOT_README.includes('**它的核心抽象是四卡**')
    && ROOT_README.includes('选题卡（面向外界的成果）')
    && ROOT_README.includes('00_产品事实与表达母版.md')
    && ROOT_README.includes('§9.1')
})

check('DOC460-23 ★根 README 的快捷键条数必须从 manifest commands 实算（总数 / 有默认键 / 无默认键三个数都要对）—— 旧文写「11 个命令项（4 + 7）」，选题两条命令上线后就成了假数字；用户照着它去 chrome://extensions/shortcuts 会找不到入口', () => {
  if (!ROOT_README || !MANIFEST) return false
  const block = MANIFEST.slice(MANIFEST.indexOf('commands: {'), MANIFEST.indexOf('content_scripts:'))
  if (!block) return false
  const total = [...block.matchAll(/^\s{4}'?([a-z-]+)'?:\s*\{/gm)].length
  const withKey = [...block.matchAll(/suggested_key:/g)].length
  if (total < 4 || withKey !== 4) return false
  const noKey = total - withKey
  return ROOT_README.includes(`共 **${total} 个命令项**`)
    && ROOT_README.includes(`${withKey} 个自带默认键位`)
    && ROOT_README.includes(`**${noKey} 个由你按需分配**`)
})

check('DOC460-24 ★根 README 的硬性规则必须与当期红线一致：镜像白名单四条（含 topicResourceLinks）、四套正式主题、回收站内嵌设置页 —— 这三条是接手开发者会照着执行的规则，写错就会直接产出违规代码', () => {
  if (!ROOT_README) return false
  if (ROOT_README.includes('三套正式主题')) return false
  if (ROOT_README.includes('回收站 `/recycle` 可恢复')) return false
  const themes = [...APP.matchAll(/\{ id: '([a-z]+)', name: '([^']+)'/g)].map(m => m[2])
  if (themes.length !== 4) return false
  return ROOT_README.includes('topicResourceLinks')
    && ROOT_README.includes('linkedTopicIds')
    && ROOT_README.includes('**四套正式主题**')
    && themes.every(t => ROOT_README.includes(t))
    && ROOT_README.includes('/settings?page=recycle')
})

check('DOC460-25 ★方向读数只认现役三读数：方向台页头「方向健康度 / 主攻 / 停滞」+ 战略骨架六层计数；调度台不得重新挂回 MetricBar，母版与内置手册也不得再把旧四指标条当现役', () => {
  const cur = motherCurrent()
  if (!cur) return false
  return cur.includes('**方向读数（现役）**')
    && cur.includes('方向健康度')
    && cur.includes('主攻数')
    && cur.includes('停滞项目数')
    && cur.includes('**历史注记 · 方向状态五格指标条**')
    && cur.includes('V3.9.19')
    && !cur.includes('- **方向状态四指标**')
    && COMPASS_TREE.includes('方向健康度')
    && COMPASS_TREE.includes('主攻 {{ treeStats.focused }}')
    && COMPASS_TREE.includes('停滞 {{ treeStats.stalled }}')
    && COMPASS_SPINE.includes('战略骨架')
    && !COMPASS_HOME.includes('MetricBar')
    && MANUAL.includes('方向健康度 / 主攻 / 停滞')
    && !MANUAL.includes('方向状态四指标')
    && !MANUAL.includes('方向状态指标条')
})

check('DOC460-26 ★架构图集必须是现役一级四卡池口径：资源台只可作为退役说明出现，不得再作为产品层 / 路由 / 存储源头；四页签、五类对象、资源卡真身与 Supabase 现役边界必须同时在场，旧 /deck 深链只能作兼容重定向', () => {
  if (!ATLAS) return false
  if (ATLAS.includes('资源台 · 资源卡唯一存储与镜像源头')) return false
  if (ATLAS.includes('CurationCenter 资源台')) return false
  if (ATLAS.includes('可选 Airtable 单向')) return false
  if (ATLAS.includes('三卡</h4>')) return false
  if (ATLAS.includes('二级全量页')) return false
  if (ATLAS.includes('CompassDeckView · 四卡池')) return false
  return ATLAS.includes(CUR_VTAG)
    && ATLAS.includes('调度台四卡池')
    && ATLAS.includes('调度台一级四卡池')
    && ATLAS.includes('四池深链兼容')
    && ATLAS.includes('任务卡 ↔ 任务卡池')
    && ATLAS.includes('选题卡 ↔ 选题卡池')
    && ATLAS.includes('好奇心卡 ↔ 好奇心卡池')
    && ATLAS.includes('资源卡 ↔ 资源卡池')
    && ATLAS.includes('论证卡 · 仅策展台')
    && ATLAS.includes('`/deck/task`')
    && ATLAS.includes('`/deck/topic`')
    && ATLAS.includes('`/deck/curiosity`')
    && ATLAS.includes('`/deck/resource`')
    && ATLAS.includes('`/?tab=task`')
    && ATLAS.includes('`/?tab=resource`')
    && ATLAS.includes('资源卡的真身住调度台「资源卡池」')
    && ATLAS.includes('邀请制 Supabase')
    && ATLAS.includes('原「全局采集」与「原型演示」产品路线 → 已废弃')
})
