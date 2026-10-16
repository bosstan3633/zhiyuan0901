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

/* ============ R109（F11）：AI 整理规则常量（与《03-7_AI整理规则》同源，供导入弹窗展示/复制） ============ */

export const GOAL_RULE = `你是一位项目管理助手。请把用户提供的原始文本，整理成符合以下规则的 Markdown 文档。整理结果将被导入到「知源调度台」的方向树中，自动生成项目、成功指标与任务。

【输出格式规则】
# 项目名称
## 成功指标名称
### 任务名称
任务详情正文（可多行，也可以省略）

【层级含义】
1. 一级标题（#）：项目。一份文档可以只包含一个项目，也可以包含多个项目。
2. 二级标题（##）：该项目的成功指标。指标是"可衡量的结果"（例：每周产出 3 篇教程），不是动作本身。
3. 三级标题（###）：该指标下的任务。任务是"具体的执行动作"（例：写第一篇教程大纲）。
4. 三级标题下面的正文：该任务的详情（执行要点、验收标准、背景上下文），可多行；没有详情就省略。

【整理要求】
1. 忠实于用户原文的意思，不要发明用户没有提到的内容；归类拿不准时放到最贴近的上级。
2. 每个任务必须归属于某个成功指标；确实无法归属的动作，归入最贴近的指标。
3. 同一层级的条目保持用户原文的先后顺序。
4. 结构配比建议：每个项目 1-4 个成功指标，每个指标 1-8 个任务；超出时优先合并同类项。
5. 命名长度：项目 ≤ 20 字、指标 ≤ 25 字、任务 ≤ 30 字。
6. 任务详情保留原文的关键信息（数字、日期、验收标准），可轻度润色使语句通顺。
7. 直接输出 Markdown 正文；不要用代码块包裹，不要输出任何解释或前言。`

export const PYRAMID_RULE = `你是一位结构化论证助手。请把用户提供的原始文本，整理成符合以下规则的 Markdown 文档。整理结果将被导入到「知源调度台」的策展台金字塔视图中，自动生成中心论点、多级节点与节点卡片。

【输出格式规则】
# 中心论点
中心论点的补充说明（可选）
## 二级节点名称
该节点的卡片描述（可选）
### 三级节点名称
该节点的卡片描述（可选）
#### 四级节点名称
该节点的卡片描述（可选）

【层级含义】
1. 一级标题（#）：中心论点。整份文档有且只有一个，是一句完整、可论证的主张（不是话题名）。
2. 二级标题（##）：支撑中心论点的第二层节点（主分类 / 分论点），通常 2-4 个。
3. 三级标题（###）：隶属上一个二级节点的第三层节点（论据 / 案例 / 子论点）。
4. 四级标题（####）：隶属上一个三级节点的第四层节点。
5. 每个标题下面的正文：该节点卡片的描述内容——说清"这个节点是什么、为什么支撑上级"，1-3 句。

【金字塔整理原则】
1. 中心论点必须是完整的主张句；如果用户的文本只有话题没有主张，先向用户确认主张，或按文本主旨归纳一句主张并标注"（建议）"。
2. 二级节点是中心论点的支撑维度，各维度互不重叠（符合 MECE 原则则更佳）。
3. 三级 / 四级节点是对上级的展开：论据、案例、子论点；严格保持嵌套——三级节点必须紧跟在它所属的二级节点之后。
4. 同级节点按论证强弱或逻辑顺序排列。
5. 忠实用户原文，不要虚构论据；用户没有给出的节点描述留空。
6. 直接输出 Markdown 正文；不要用代码块包裹，不要输出任何解释或前言。`

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

/* ============ 场景 A' · 项目层模板导入（F2 · 2026-10-15） ============ */

/**
 * 项目层导入 = goal 场景**下移一级**：入口在项目卡上，Markdown 里不再出现项目名——
 * `# = 成功指标`、`## = 该指标下的任务`、任务标题下正文 = 任务详情。
 * 项目名恒等于被导入的那个项目（现名），解析结果不含项目维度。
 * 容错沿 goal 同一套：H2 先于 H1 → 自动建指标「通用执行」承接；H3+ → 并入任务详情。
 */
export const PROJECT_RULE = `你是一位项目管理助手。请把用户提供的原始文本，整理成符合以下规则的 Markdown 文档。整理结果将被导入到「知源调度台」的指定攻坚项目中，自动生成成功指标与任务（不需要写项目名，项目已选好）。

【输出格式规则】
# 成功指标名称
## 任务名称
任务详情正文（可多行，也可以省略）

【层级含义】
1. 一级标题（#）：成功指标。指标是"可衡量的结果"（例：每周产出 3 篇教程），不是动作本身。
2. 二级标题（##）：该指标下的任务。任务是"具体的执行动作"（例：写第一篇教程大纲）。
3. 二级标题下面的正文：该任务的详情（执行要点、验收标准、背景上下文），可多行；没有详情就省略。

【整理要求】
1. 忠实于用户原文的意思，不要发明用户没有提到的内容；归类拿不准时放到最贴近的指标。
2. 每个任务必须归属于某个成功指标。
3. 同一层级的条目保持用户原文的先后顺序。
4. 结构配比建议：每个项目 1-4 个成功指标，每个指标 1-8 个任务；超出时优先合并同类项。
5. 命名长度：指标 ≤ 25 字、任务 ≤ 30 字。
6. 任务详情保留原文的关键信息（数字、日期、验收标准），可轻度润色使语句通顺。
7. 直接输出 Markdown 正文；不要用代码块包裹，不要输出任何解释或前言。`

export interface ProjImportResult { metrics: GoalMetric[]; warns: string[] }

export function parseProjectTemplate(src: string): ProjImportResult {
  const metrics: GoalMetric[] = []
  const warns: string[] = []
  let curM: GoalMetric | null = null
  let curT: GoalTask | null = null
  let body: string[] = []
  const flush = () => {
    const text = body.join('\n').trim()
    body = []
    if (!text) return
    if (curT) curT.detail = curT.detail ? curT.detail + '\n\n' + text : text
    else warns.push('检测到不属于任何任务的正文（将忽略）——任务详情请写在 ## 二级标题之下')
  }
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    const m = line.match(/^(#{1,6})\s+(.+)$/)
    if (m) {
      flush()
      const lv = m[1].length
      const name = m[2].trim()
      if (lv === 1) {
        curM = { name, tasks: [], auto: false }
        metrics.push(curM)
        curT = null
      } else if (lv === 2 || lv === 3) {
        // 容错：H2 先于 H1 → 自动建指标「通用执行」承接（与 goal 场景同语言）
        if (!curM) {
          warns.push(`检测到 H${lv} 先于 H1——已自动创建指标「通用执行」承接`)
          curM = { name: '通用执行', tasks: [], auto: true }
          metrics.push(curM)
        }
        curT = { name, detail: '' }
        curM.tasks.push(curT)
      } else {
        body.push(line) // H4+：并入当前任务详情
      }
    } else if (line.trim()) {
      body.push(line)
    }
  }
  flush()
  return { metrics, warns }
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
