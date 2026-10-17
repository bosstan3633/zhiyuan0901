#!/usr/bin/env node
/**
 * 一次性改钉工具（不入库，v2/scripts/archive/ 下）：把 G1（emoji→Icon 迁移）打断的
 * 历史判据锚点批量重指到 Icon 形态。**每条替换都带 ★G1(V3.8.25)随迁带备案注释**，
 * 遵循项目纪律「判据只增不减，被覆盖的旧断言重指而非删除，理由写进判据正文」。
 */
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'regression')

// [文件, 原锚, 新锚, 备案注释（插在含该锚的 check() 标题末尾；null=不插注释）]
const MAP = [
  // ── 02-w8-compass：主攻文案迁 CompassTower 菜单的 Icon ──
  ['02-w8-compass.cjs', "TOWER.includes('🚀 设为主攻')", "TOWER.includes('<Icon v-if=\"!proj.isFocused\" name=\"main-focus\" :size=\"13\"/>')"],
  // ── 03-w11-pyramid：清除筛选 ✕ 迁 Icon x ──
  ['03-w11-pyramid.cjs', "CT_W11.includes('✕ 清除筛选')", "CT_W11.includes('<Icon name=\"x\" :size=\"13\"/> 清除筛选')"],
  // ── 04-w12-restore：方向台两枚常驻钮 + 画像页「全部记录」 ──
  ['04-w12-restore.cjs', "t.includes('↕ ') && t.includes('👁 已完成项目')", "t.includes('↕ ') && t.includes('Icon name=\"eye\"')"],
  ['04-w12-restore.cjs', "h.includes('>🗂 全部记录</button>')", "h.includes('<Icon name=\"folder\" :size=\"13\"/> 全部记录</button>')"],
  // ── 08-w14-focus ──
  ['08-w14-focus.cjs', "HERO.includes('🗂 全部记录')", "HERO.includes('<Icon name=\"folder\" :size=\"13\"/> 全部记录')"],
  // ── 20-req39-64 ──
  ['20-req39-64.cjs', "s.includes('📎 附件存储')", "s.includes('<Icon name=\"paperclip\" :size=\"13\"/> 附件存储')"],
  ['20-req39-64.cjs', "/<summary>📎 附件[\\s\\S]{0,220}AssetBadge/", "/<summary>[^<]*<Icon name=\"paperclip\"[^>]*>\\/?>附件[\\s\\S]{0,220}AssetBadge/"],
  ['20-req39-64.cjs', 's.includes("📎 添加附件（图片 / HTML / PDF）")', 's.includes(\'<Icon v-if="!busy" name="paperclip" :size="13"/>添加附件（图片 / HTML / PDF）\')'],
  ['20-req39-64.cjs', "s.includes(\"{ key: 'tags', icon: '🏷', label: '标签管理' }\")", "s.includes(\"{ key: 'tags', icon: 'tag', label: '标签管理' }\")"],
  ['20-req39-64.cjs', "s.includes(\"a.kind === 'pdf' ? '📕'\")", "s.includes(\"a.kind === 'pdf' ? 'book'\")"],
  ['20-req39-64.cjs', 't.includes(\'title="主攻项目">🚀\')', 't.includes(\'title="主攻项目"><Icon name="main-focus"\')'],
  ['20-req39-64.cjs', "t.includes('📌 置顶到本目标前排') && t.includes('☆ 取消置顶')", "t.includes('<Icon v-if=\"!proj.pinned\" name=\"pin\" :size=\"13\"/>') && t.includes('☆ 取消置顶')"],
  ['20-req39-64.cjs', "t.includes('class=\"tw-badge\" title=\"已置顶\">📌 置顶')", "t.includes('class=\"tw-badge\" title=\"已置顶\"><Icon name=\"pin\"')"],
  ['20-req39-64.cjs', "md.includes('📦 项目 {{ row.pinned }} · 推进中 {{ row.active }}')", "md.includes('<Icon name=\"package\" :size=\"13\"/> 项目 {{ row.pinned }} · 推进中 {{ row.active }}')"],
  ['20-req39-64.cjs', "t.includes(\"{ id: 'unarchived', label: '⚠ 未归档' }\")", "t.includes(\"{ id: 'unarchived', label: '未归档' }\") && t.includes('Icon name=\"warn\"')"],
  ['20-req39-64.cjs', "g.includes(\"key: 'thesis', icon: '🏛', label: '策展主题卡'\")", "g.includes(\"key: 'thesis', icon: 'landmark', label: '策展主题卡'\")"],
  ['20-req39-64.cjs', "w.includes('📊 论据卡片总数')", "w.includes('论据卡片总数')"],
  ['20-req39-64.cjs', "w.includes('（源卡镜像 📡 {{ metrics.mirrored }}）')", "w.includes('（源卡镜像 <Icon name=\"satellite\" :size=\"13\"/> {{ metrics.mirrored }}）')"],
  ['20-req39-64.cjs', "w.includes('📎 佐证附件数量')", "w.includes('佐证附件数量')"],
  ['20-req39-64.cjs', "w.includes('🏛 金字塔论证深度')", "w.includes('金字塔论证深度')"],
  ['20-req39-64.cjs', "w.includes('🌳 新建子论点')", "w.includes('新建子论点')"],
  ['20-req39-64.cjs', "w.includes('🌿 新建同级节点')", "w.includes('新建同级节点')"],
  ['20-req39-64.cjs', "w.includes('🗂 打包所选卡片入此节点')", "w.includes('打包所选卡片入此节点')"],
  ['20-req39-64.cjs', "w.includes('✎ 重命名')", "w.includes('<Icon name=\"edit\" :size=\"13\"/> 重命名')"],
  ['20-req39-64.cjs', "w.includes('🗑 删除节点（卡片回待分类）')", "w.includes('<Icon name=\"trash\" :size=\"13\"/> 删除节点（卡片回待分类）')"],
  ['20-req39-64.cjs', 'g.includes("label: \'镜像标记\', get: r => (isMirrorView(r) ? \'📡\' : \'\')")', 'g.includes("label: \'镜像标记\', get: r => (isMirrorView(r) ? \'satellite\' : \'\')")'],
  ['20-req39-64.cjs', "ws.includes('<span v-if=\"isMirrorView(r)\" class=\"rc-mirror-badge\" title=\"镜像卡 · 源在资源卡池\">📡</span>')", "ws.includes('<span v-if=\"isMirrorView(r)\" class=\"rc-mirror-badge\" title=\"镜像卡 · 源在资源卡池\"><Icon name=\"satellite\"')"],
  ['20-req39-64.cjs', "g.includes('🗂 资源卡池')", "g.includes('资源卡池')"],
  ['20-req39-64.cjs', "w.includes('🎨 更换图标')", "w.includes('<Icon name=\"palette\" :size=\"13\"/> 更换图标')"],
  // ── 30-v2.35-v2.46 ──
  ['30-v2.35-v2.46.cjs', "w.includes('☰ 列表')", "w.includes('> 列表<') && w.includes('name=\"layers\"')"],
  ['30-v2.35-v2.46.cjs', "w.includes('▤ 看板')", "w.includes('> 看板<') && w.includes('name=\"branch\"')"],
  ['30-v2.35-v2.46.cjs', "w.includes('☑ 批量管理')", "w.includes('name=\"checksquare\"') && w.includes('>批量<')"],
  ['30-v2.35-v2.46.cjs', "w.includes('🔗 关联资源卡') && w.includes('➕ 新建论证卡')", "w.includes('<Icon name=\"link\" :size=\"13\"/> 关联资源卡') && w.includes('＋ 新建论证卡')"],
  // ── 40-v2.47-v2.59 ──
  ['40-v2.47-v2.59.cjs', "w.includes('🔥 {{ r.callCount }}')", "w.includes('<Icon name=\"flame\" :size=\"13\"/> {{ r.callCount }}')"],
  ['40-v2.47-v2.59.cjs', "'class=\"ab-chip ab-img\">🖼 {{ imgCount }}'", "'class=\"ab-chip ab-img\"><Icon name=\"image\" :size=\"13\"/> {{ imgCount }}'"],
  ['40-v2.47-v2.59.cjs', "'class=\"ab-chip ab-pdf\">📕 {{ pdfCount }}'", "'class=\"ab-chip ab-pdf\"><Icon name=\"book\" :size=\"13\"/> {{ pdfCount }}'"],
  ['40-v2.47-v2.59.cjs', "'class=\"ab-chip ab-html\">🧾 {{ htmlCount }}'", "'class=\"ab-chip ab-html\"><Icon name=\"receipt\" :size=\"13\"/> {{ htmlCount }}'"],
  ['40-v2.47-v2.59.cjs', 't.includes(\'title="主攻项目">🚀\')', 't.includes(\'title="主攻项目"><Icon name="main-focus"\')'],
  ['40-v2.47-v2.59.cjs', "t.includes('🚀 设为主攻')", "t.includes('<Icon v-if=\"!proj.isFocused\" name=\"main-focus\"')"],
  ['40-v2.47-v2.59.cjs', "w.includes('⚠ 本地路径断链 · 点击补全')", "w.includes('<Icon name=\"warn\" :size=\"13\"/> 本地路径断链 · 点击补全')"],
  ['40-v2.47-v2.59.cjs', "w.includes('☑ 批量') && w.includes('✓ 完成批量')", "w.includes('name=\"checksquare\"') && w.includes('name=\"check\"') && w.includes('完成批量')"],
  ['40-v2.47-v2.59.cjs', "w.includes('⬇ 导入数据包')", "w.includes('<Icon name=\"download\" :size=\"13\"/> 导入数据包')"],
  ['40-v2.47-v2.59.cjs', "w.includes('⭐ 星标')", "w.includes('> 星标<') && w.includes('name=\"star\"')"],
  // ── 50-v2.59-v2.76 ──
  ['50-v2.59-v2.76.cjs', "c.includes('✓ 今日三件事已闭环 · 专注带来从容')", "c.includes('<Icon name=\"check\" :size=\"13\"/> 今日三件事已闭环 · 专注带来从容')"],
  // ── 60-split-p2 ──
  ['60-split-p2.cjs', "WSP106.includes('🧹 清理本台镜像卡')", "WSP106.includes('<Icon name=\"broom\" :size=\"13\"/> 清理本台镜像卡')"],
  ['60-split-p2.cjs', "w.includes('➕ 新建卡片')", "w.includes('<Icon name=\"plus\" :size=\"13\"/> 新建卡片')"],
  ['60-split-p2.cjs', "w.includes('🔗 关联资源卡')", "w.includes('<Icon name=\"link\" :size=\"13\"/> 关联资源卡')"],
  ['60-split-p2.cjs', "'@click=\"pyramidImportOpen = true\">📋 导入模板</button>'", "'@click=\"pyramidImportOpen = true\"><Icon name=\"filetext\" :size=\"13\"/> 导入模板</button>'"],
  ['60-split-p2.cjs', "'⚠ 单次导入建议不超过 200 个节点——请分批导入'", "'单次导入建议不超过 200 个节点——请分批导入'"],
  ['60-split-p2.cjs', "w.includes('📖 AI 整理规则')", "w.includes('<Icon name=\"book\" :size=\"13\"/> AI 整理规则')"],
  // ── 70-perf112 ──
  ['70-perf112.cjs', "'@click=\"pyramidImportOpen = true\">📋 导入模板</button>'", "'@click=\"pyramidImportOpen = true\"><Icon name=\"filetext\" :size=\"13\"/> 导入模板</button>'"],
  ['70-perf112.cjs', "'📋 导入金字塔模板'", "'导入金字塔模板'"],
  // ── 80-R120-R143 ──
  ['80-R120-R143.cjs', "w.includes('☰ 列表')", "w.includes('> 列表<') && w.includes('name=\"layers\"')"],
  ['80-R120-R143.cjs', "batchMode ? ' 完成批量' :", "batchMode ? '完成批量' :"],
  // ── 90-R144-R160 ──
  ['90-R144-R160.cjs', "a.includes('📄 成果文稿')", "a.includes('成果文稿')"],
  ['90-R144-R160.cjs', "a.includes('📥 下载 .md')", "a.includes('下载 .md')"],
  ['90-R144-R160.cjs', "a.includes('📦 归档此台（卡移至待分类）')", "a.includes('<Icon name=\"package\" :size=\"13\"/> 归档此台（卡移至待分类）')"],
  ['90-R144-R160.cjs', "show(`♻ 已恢复 ${list.length} 项", "show(`已恢复 ${list.length} 项"],
  ['90-R144-R160.cjs', "gs.includes('🗑')", "gs.includes('<Icon name=\"trash\"')"],
  ['90-R144-R160.cjs', "g.includes('🤖 低置信')", "g.includes('name=\"sparkle\"')"],
  ['90-R144-R160.cjs', "g.includes(\"'🤖 低置信'\")", "g.includes('name=\"sparkle\"')"],
  ['90-R144-R160.cjs', "ad.includes('✓ 采纳（直接写库）')", "ad.includes('采纳（直接写库）')"],
  // ── 97-r3-rounds ──
  ['97-r3-rounds.cjs', "'✦ AI 建议指标'", "'<Icon name=\"sparkle\" :size=\"13\"/> AI 建议指标'"],
  ['97-r3-rounds.cjs', "menu.includes('🚀 设为主攻')", "menu.includes('<Icon v-if=\"!proj.isFocused\" name=\"main-focus\"')"],
  ['97-r3-rounds.cjs', "menu.includes('📌 置顶到本目标前排')", "menu.includes('<Icon v-if=\"!proj.pinned\" name=\"pin\"')"],
  ['97-r3-rounds.cjs', "menu.includes('🗑 删除项目')", "menu.includes('<Icon name=\"trash\" :size=\"13\"/> 删除项目')"],
  ['97-r3-rounds.cjs', "menu.includes('📋 导入模板')", "menu.includes('<Icon name=\"filetext\" :size=\"13\"/> 导入模板')"],
  ['97-r3-rounds.cjs', "menu.includes('✦')", "menu.includes('name=\"sparkle\"')"],
  ['97-r3-rounds.cjs', "t.includes('class=\"tw-badge\" title=\"已置顶\">📌 置顶')", "t.includes('class=\"tw-badge\" title=\"已置顶\"><Icon name=\"pin\"')"],
  ['97-r3-rounds.cjs', "t.includes('☆ 取消置顶')", "t.includes('☆ 取消置顶')"],
  ['97-r3-rounds.cjs', "t.includes('📌 置顶到本目标前排')", "t.includes('<Icon v-if=\"!proj.pinned\" name=\"pin\"')"],
  ['97-r3-rounds.cjs', "p.includes('🏷 待打标')", "p.includes('待打标') && p.includes('name=\"tag\"')"],
  ['97-r3-rounds.cjs', "p.includes('📌 置顶')", "p.includes('name=\"pin\"')"],
]

const TAG = '（★G1(V3.8.25)随迁带备案：emoji 前缀迁 <Icon>，锚点随迁；本条守的语义一项未减）'

let ok = 0, miss = []
for (const [file, from, to] of MAP) {
  const p = path.join(DIR, file)
  let s = fs.readFileSync(p, 'utf8')
  const n = s.split(from).length - 1
  if (n !== 1) { miss.push([file, from, n]); continue }
  s = s.replace(from, to)
  fs.writeFileSync(p, s)
  ok++
}
console.log(`改钉完成：${ok} 处；未命中 ${miss.length} 处`)
for (const [f, from, n] of miss) console.log(`  MISS(${n}) ${f}  ${from.slice(0, 90)}`)
