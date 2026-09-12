/**
 * R108（T1）：Markdown 模板导入解析器（纯函数，无副作用）。
 *
 * 两个场景（04-55 设计方案，交互原型 docs/原型_Markdown模板导入_方向树与金字塔.html，
 * 解析逻辑与原型 v2 逐字同源并经 Node 冒烟验证）：
 *
 * - parseGoalTemplate：方向树 · 战略目标下的批量导入。
 *   H1=项目名（可多个）｜H2=该项目的成功指标｜H3=该指标下的任务名｜H3 之下的正文=任务详情
 *   （多段合并；H4 及以下标题并入任务详情）。容错：H3 直属 H1 时自动创建指标「通用执行」；
 *   H2/H3 先于 H1 时自动创建项目承接。
 *
 * - parsePyramidTemplate：策展台 · 金字塔批量导入。
 *   H1=中心论点（仅一个，多余忽略并记入 extraH1）｜H2=L2｜H3=L3（隶属上一个 H2）｜H4=L4
 *   （隶属上一个 H3）｜标题下的正文=该节点卡片的描述。容错：跳级提升至最近合法父级（标 promoted）。
 *
 * 同名跳过/复用不在解析器内（需要宿主的既有数据上下文），由写入层执行。
 * 纯文本解析，无 HTML 注入面；解析失败（无有效标题）返回空结构，由调用方拒绝写入。
 */

/* ============ 场景 A · 方向树 ============ */

export interface GoalTask { name: string; detail: string }
export interface GoalMetric { name: string; tasks: GoalTask[]; /** H3 跳级自动创建 */ auto: boolean }
export interface GoalProject { name: string; metrics: GoalMetric[] }
export interface GoalParseResult { projects: GoalProject[]; warns: string[] }

export function parseGoalTemplate(src: string): GoalParseResult {
  const projects: GoalProject[] = []
  const warns: string[] = []
  let curP: GoalProject | null = null
  let curM: GoalMetric | null = null
  let curT: GoalTask | null = null
  let body: string[] = []
  const flush = () => {
    const text = body.join('\n').trim()
    body = []
    if (!text) return
    if (curT) curT.detail = curT.detail ? curT.detail + '\n\n' + text : text
    else warns.push('检测到不属于任何任务的正文（将忽略）——任务详情请写在 ### 三级标题之下')
  }
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    const m = line.match(/^(#{1,6})\s+(.+)$/)
    if (m) {
      flush()
      const lv = m[1].length
      const name = m[2].trim()
      if (lv === 1) {
        curP = { name, metrics: [] }
        projects.push(curP)
        curM = null
        curT = null
      } else if (lv === 2 || lv === 3) {
        // 容错：H2/H3 先于 H1 → 自动创建项目承接；H3 直属 H1 → 自动创建指标「通用执行」承接
        let P: GoalProject | null = curP
        if (!P) {
          warns.push(`检测到 H${lv} 先于 H1——已自动创建项目承接`)
          P = { name: '未命名项目（自动创建）', metrics: [] }
          projects.push(P)
          curP = P
          curM = null
        }
        let M: GoalMetric | null = curM
        if (lv === 3 && !M) {
          warns.push(`「${name}」前无二级标题——已自动创建指标「通用执行」承接`)
          M = { name: '通用执行', tasks: [], auto: true }
          P.metrics.push(M)
          curM = M
        }
        if (lv === 2) {
          M = { name, tasks: [], auto: false }
          P.metrics.push(M)
          curM = M
          curT = null
        } else {
          curT = { name, detail: '' }
          M!.tasks.push(curT) // lv===3 时上方已确保 M 非空（通用执行承接）
        }
      } else {
        body.push(line) // H4+：并入当前任务详情
      }
    } else if (line.trim()) {
      body.push(line)
    }
  }
  flush()
  return { projects, warns }
}

/* ============ 场景 B · 策展台金字塔 ============ */

export interface PyramidNode {
  name: string
  desc: string
  children: PyramidNode[]
  level: 1 | 2 | 3 | 4
  /** 跳级容错：提升至最近合法父级 */
  promoted?: boolean
  /** 虚拟论点（H2 先于 H1 时自动创建） */
  virtual?: boolean
}
export interface PyramidParseResult {
  thesis: PyramidNode | null
  /** 多余的 H1（一期只支持单论点） */
  extraH1: string[]
  warns: string[]
}

export function parsePyramidTemplate(src: string): PyramidParseResult {
  const warns: string[] = []
  const extraH1: string[] = []
  let thesis: PyramidNode | null = null
  let cur2: PyramidNode | null = null
  let cur3: PyramidNode | null = null
  let curNode: PyramidNode | null = null
  let body: string[] = []
  const flush = () => {
    const text = body.join('\n').trim()
    body = []
    if (!text) return
    if (curNode) curNode.desc = curNode.desc ? curNode.desc + '\n\n' + text : text
    else warns.push('检测到不属于任何节点的正文（将忽略）——节点描述请写在对应标题之下')
  }
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    const m = line.match(/^(#{1,6})\s+(.+)$/)
    if (m) {
      flush()
      const lv = m[1].length
      const name = m[2].trim()
      if (lv === 1) {
        if (!thesis) {
          thesis = { name, desc: '', children: [], level: 1 }
          curNode = thesis
          cur2 = null
          cur3 = null
        } else {
          extraH1.push(name)
          curNode = null
        }
      } else if (lv === 2) {
        if (!thesis) {
          thesis = { name: '（未命名论点）', desc: '', children: [], level: 1, virtual: true }
          warns.push('H2 出现在 H1 之前——已挂入虚拟论点（实装时将提示补 H1）')
        }
        const T = thesis
        cur2 = { name, desc: '', children: [], level: 2 }
        T.children.push(cur2)
        cur3 = null
        curNode = cur2
      } else if (lv === 3) {
        if (!thesis) { warns.push('H3 出现在 H1 之前——已自动创建虚拟论点承接'); thesis = { name: '（未命名论点）', desc: '', children: [], level: 1, virtual: true } }
        const T = thesis
        if (!cur2) {
          warns.push(`「${name}」为 H3 但之前无 H2——已提升为 L2 承接（跳级容错）`)
          cur2 = { name, desc: '', children: [], level: 2, promoted: true }
          T.children.push(cur2)
          curNode = cur2
        } else {
          cur3 = { name, desc: '', children: [], level: 3 }
          cur2.children.push(cur3)
          curNode = cur3
        }
      } else if (lv === 4) {
        if (!thesis) { warns.push('H4 出现在 H1 之前——已自动创建虚拟论点承接'); thesis = { name: '（未命名论点）', desc: '', children: [], level: 1, virtual: true } }
        const T = thesis
        if (!cur2) { warns.push(`「${name}」为 H4 但之前无 H2——已提升为 L2 承接（跳级容错）`); cur2 = { name, desc: '', children: [], level: 2, promoted: true }; T.children.push(cur2); curNode = cur2 }
        else if (!cur3) { warns.push(`「${name}」为 H4 但之前无 H3——已提升为 L3 承接（跳级容错）`); cur3 = { name, desc: '', children: [], level: 3, promoted: true }; cur2.children.push(cur3); curNode = cur3 }
        else { const n: PyramidNode = { name, desc: '', children: [], level: 4 }; cur3.children.push(n); curNode = n }
      } else {
        body.push(line) // H5+：并入当前节点描述
      }
    } else if (line.trim()) {
      body.push(line)
    }
  }
  flush()
  return { thesis, extraH1, warns }
}
