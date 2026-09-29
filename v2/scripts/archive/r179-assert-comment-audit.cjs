/* R179 补漏审计（一次性）：找出「正断言只靠注释命中」的假绿 —— R166 纪律的批量体检。
 * 做法：抽分片里所有 includes('字面量') 正断言（排除 ! 前缀的负向），对 R179 关心的高危字面量
 *       （含 资源台/镜像/资源卡），比对 裸读 vs codeOnly（剥注释）两版在主读取目标上的命中差。
 * ★R179 结论存档（2026-09-29）：复跑仅余 1 条候选 90-R144-R160.cjs:278【workspace】"镜像卡不给入口"，
 *   经人工定性为**本探针假阳性**——该断言读 manual-data.ts（不在 TARGETS 内），字面量剥注释后仍命中
 *   （真手册内容）；探针不解析 includes 接收方，仅因 Workspace.vue:590 注释含同句而误报。
 */
const fs = require('fs')
const path = require('path')
const base = path.resolve(__dirname, '..', '..', 'src')
const H = require(path.join(__dirname, '..', 'regression', 'helpers.cjs'))
const { codeOnly } = H
const readFile = (p) => fs.readFileSync(path.join(base, p), 'utf8')

const WS_FILES = ['/newtab/views/Workspace.vue', '/newtab/composables/useResourceView.ts', '/newtab/composables/useCatSidebar.ts', '/newtab/composables/useResourceOpen.ts', '/newtab/composables/useResourceDrawer.ts', '/newtab/composables/useResourceDragDrop.ts', '/newtab/composables/usePyramid.ts', '/newtab/composables/useWsMeta.ts', '/newtab/composables/useWsAssetHygiene.ts', '/newtab/composables/useWsLocate.ts', '/newtab/views/workspace.css']
const TARGETS = {
  workspace: WS_FILES.map(readFile).join('\n'),
  gs: readFile('/newtab/views/GlobalSettings.vue'),
  app: readFile('/newtab/App.vue'),
  popups: readFile('/newtab/components/GlobalPopups.vue'),
  mirror: readFile('/newtab/composables/useWorkspaceMirror.ts'),
  batch: readFile('/newtab/composables/useWorkspaceBatch.ts'),
  drawer: readFile('/newtab/composables/useResourceDrawer.ts') + readFile('/newtab/components/ResourceDetailDrawer.vue'),
}
const stripped = Object.fromEntries(Object.entries(TARGETS).map(([k, v]) => [k, codeOnly(v)]))

const dir = path.join(__dirname, '..', 'regression')
const shards = fs.readdirSync(dir).filter(f => f.endsWith('.cjs') && f !== 'helpers.cjs')
const KEY = /资源台|镜像|资源卡/
const re = /(!?)\s*[\w.]*\.?includes\(\s*(['"])((?:\\.|(?!\2).)*?)\2\s*\)/g
const hits = []
for (const f of shards) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8')
  let m
  while ((m = re.exec(src))) {
    const [, neg, , lit] = m
    if (neg === '!') continue
    if (!KEY.test(lit)) continue
    const line = src.slice(0, m.index).split('\n').length
    const rawHits = Object.entries(TARGETS).filter(([, v]) => v.includes(lit)).map(([k]) => k)
    if (!rawHits.length) continue // 不在本审计目标里（读的是别的文件），跳过
    const codeHits = rawHits.filter(k => stripped[k].includes(lit))
    if (!codeHits.length) hits.push({ f, line, lit, where: rawHits.join(',') })
  }
}
console.log(hits.length ? '⚠ 注释假绿候选（正断言只在注释里命中）：' : '✓ 未发现注释假绿候选')
for (const h of hits) console.log(`  - ${h.f}:${h.line} 【${h.where}】 "${h.lit}"`)
