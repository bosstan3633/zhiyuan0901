/**
 * R48 排查：基于 dist/.vite/manifest.json 重建 chunk 静态依赖图，检测循环依赖（TDZ 嫌疑）
 */
const fs = require('fs')
const path = require('path')
const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'dist', '.vite', 'manifest.json'), 'utf8'))

// 邻接表：chunk key -> 静态 imports
const graph = {}
for (const [k, v] of Object.entries(m)) graph[k] = v.imports || []

// Tarjan SCC 找环
const idx = {}, low = {}, onStack = {}, stack = [], sccs = []
let counter = 0
function strongconnect(v) {
  idx[v] = low[v] = counter++
  stack.push(v); onStack[v] = true
  for (const w of graph[v] || []) {
    if (idx[w] === undefined) { strongconnect(w); low[v] = Math.min(low[v], low[w]) }
    else if (onStack[w]) low[v] = Math.min(low[v], idx[w])
  }
  if (low[v] === idx[v]) {
    const scc = []
    for (;;) { const w = stack.pop(); onStack[w] = false; scc.push(w); if (w === v) break }
    if (scc.length > 1) sccs.push(scc)
  }
}
Object.keys(graph).forEach(v => { if (idx[v] === undefined) strongconnect(v) })

console.log('=== 循环依赖 SCC（>1 节点）:', sccs.length, '===')
for (const scc of sccs) {
  console.log('\n[环]', scc.map(k => m[k] ? m[k].file : k).join('  ⇄  '))
  // 打印环内涉及哪些源文件
  const srcs = scc.filter(k => k.startsWith('src/'))
  if (srcs.length) console.log('  源文件:', srcs.join(', '))
}

// 另外检查：newtab 主入口可达的 chunk 里，谁的模块级代码最先执行（入口顺序）
console.log('\n=== newtab 入口静态依赖链 ===')
const seen = new Set()
function walk(k, depth) {
  if (!k || seen.has(k) || depth > 4) return
  seen.add(k)
  const v = m[k]; if (!v) return
  console.log('  '.repeat(depth) + '└ ' + (v.file || k))
  ;(v.imports || []).forEach(i => walk(i, depth + 1))
}
const entry = Object.keys(m).find(k => k.includes('newtab/main.ts'))
walk(entry, 0)
