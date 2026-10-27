#!/usr/bin/env node
/* P0-2（V3.8.41）旧结构夹具运行器 —— 把 `normalizeLegacyCards` 的**真实实现**拉出来跑一遍。
 *
 * ★为什么要这么拐一道：判据若只读源码字面量，把函数体改成空壳也能过；
 *   只有把函数真跑起来、拿输出断言语义，才是行为级闸。
 *
 * ★★本文件自身是「自建提取器」的教训样本，账要记清楚：
 *   第一版想手写正则剥 TS 类型标注，为此连踩**七次**假红/假失败——
 *     ① 漏了回调形参上的内联标注 `forEach((c: {…}) => …)` → new Function 抛 `Unexpected token ':'`；
 *     ② 补了形参标注，漏了 `[]` 后缀与 `| undefined` 复合类型；
 *     ③ 改成逐字符配平，收尾 `/\}\s*$/` 又因尾部夹换行匹配不到；
 *     ④ 配平被模板字符串 `` `r${…}` `` 的 `${` 污染；
 *     ⑤ 顶层终止符判定漏 `=>`，配平一路吃到箭头函数体的 `{`，输出从 9500 字缩到 228 字；
 *     ⑥ 终止符「先增减 depth 再判定」，被 `{…}[]` 的 `>` 打到 depth=-1 而全部跳过；
 *     ⑦ 改用进入前 depth 仍不够——`{…}[]` 里 `}` 与 `[]` 让 depth 中途两次归零。
 *   七次的症状都一样：**代码完全正确，判据全红**。这正是记忆里那条
 *   「判据自建的提取器必须先拿已知样本验证」的复现，而且比以往更贵。
 *   ⇒ 终局解法：**不手写剥离器**，直接用项目已装的 `esbuild` 转译
 *     （同 `build-compat.cjs` 那条路），零自制解析、零类型语法坑。
 *     下游判据读本脚本的退出码与 stdout，不关心它怎么拿到函数。
 *
 * 用法：node legacy-fixture-run.cjs → stdout 输出归一化后的卡（JSON）
 */
const fs = require('fs')
const path = require('path')

const here = __dirname
/* ★R181 随迁带备案：`normalizeLegacyCards` 随 P0-2 归一化实现整体从 repository.ts 拆到 legacy-normalize.ts，
   故夹具改从该文件取函数；它现在是该文件最后一个导出，尾部即文件尾。 */
const repoTs = path.join(here, '..', 'legacy-normalize.ts')
const sample = JSON.parse(fs.readFileSync(path.join(here, 'legacy-library.sample.json'), 'utf8'))

/* 1) 从 legacy-normalize.ts 里取出 normalizeLegacyCards 的源码区间 */
const repo = fs.readFileSync(repoTs, 'utf8')
const from = repo.indexOf('export function normalizeLegacyCards')
const to = repo.length
if (from < 0 || to <= from) { console.error('剥不出 normalizeLegacyCards —— 锚点漂了'); process.exit(2) }
const body = repo.slice(from, to)
if (body.length < 3000) { console.error(`切出的函数体过短（${body.length} 字符）——锚点多半没对上`); process.exit(2) }

/* 2) esbuild 转译成可执行 JS。刻意只切这一段：本仓库用的是 `@/` 别名，
 *    整文件转译会在解析 import 时报错（而 import 与被测函数无关）。 */
const esbuild = require('esbuild')
let js = ''
try {
  js = esbuild.transformSync(body, { loader: 'ts', format: 'cjs', target: 'es2020' }).code
} catch (e) {
  console.error('esbuild 转译失败：' + e.message)
  process.exit(2)
}
if (!/normalizeLegacyCards/.test(js)) { console.error('转译结果里没有 normalizeLegacyCards'); process.exit(2) }

/* 3) 求值该函数 */
let normalizeLegacyCards
try {
  const mod = { exports: {} }
  const fn = new Function('module', 'exports', 'require', js)
  fn(mod, mod.exports, require)
  normalizeLegacyCards = mod.exports.normalizeLegacyCards
} catch (e) {
  console.error('求值失败：' + e.message)
  process.exit(2)
}
if (typeof normalizeLegacyCards !== 'function') { console.error('取不到函数（导出形态变了？）'); process.exit(2) }

/* 4) 喂夹具 */
const mk = (arr) => JSON.parse(JSON.stringify(arr || []))
const d = {
  tagTree: [],
  curiosities: mk(sample.curiosities),
  resources: mk(sample.resources),
  tasks: mk(sample.tasks),
  workspaces: mk(sample.workspaces),
  categories: mk(sample.categories),
}
normalizeLegacyCards(d)

/* 5) 幂等验证：同一份归一化再跑一遍，结果必须逐字节相同。
   这是「只在缺失时补、不覆盖已有值」的行为证据（P0-2-1c）。 */
const snap = () => JSON.stringify({ c: d.curiosities, r: d.resources, t: d.tasks, w: d.workspaces, g: d.categories, tree: d.tagTree })
const s1 = snap()
normalizeLegacyCards(d)
const s2 = snap()

const pick = (arr, keys) => arr.map(x => { const o = {}; for (const k of keys) o[k] = x[k]; return o })
process.stdout.write(JSON.stringify({
  全为幂等: s1 === s2,
  curiosities: pick(d.curiosities, ['src', 'question', 'status', 'description', 'tags', 'title']),
  resources: pick(d.resources, ['src', 'link', 'linkType', 'description', 'kind', 'id', 'title']),
  tasks: pick(d.tasks, ['src', 'status', 'priority', 'dueDate', 'description', 'kind', 'title']),
  workspaces: pick(d.workspaces, ['src', 'order', 'archived', 'name']),
  categories: pick(d.categories, ['src', 'order', 'name']),
}, null, 1))
