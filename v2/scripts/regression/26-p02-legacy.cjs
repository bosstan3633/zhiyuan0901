/**
 * P0-2 分片 · V3.8.41：老库字段系统体检 —— 归一化单一真源 + 导入路径接线
 * 依赖基建见 ./helpers.cjs。
 */
const { fs, path, base, check, read } = require('./helpers.cjs');

const REPO = read('/shared/storage/repository.ts');
const PKG = read('/newtab/views/settings/dataPackage.ts');

/* ★纪律：判据自建的提取器必须先验证能截到多少字符（B8 同源教训）。
   这里切 normalizeLegacyCards 的函数体，拿到它先打印长度、非空才拿去判红。 */
const NORM = REPO.slice(REPO.indexOf('export function normalizeLegacyCards'), REPO.indexOf('/** 加载数据（含首次初始化）'));
if (!NORM || NORM.length < 3000) {
  console.log(`  ⚠️ NORM 切片异常（len=${NORM ? NORM.length : 0}）——本分片全部断言将判红，请先修锚点`);
}

console.log('【P0-2-1 · 归一化必须是单一真源，不挂在某条读路径上】');
check('P0-2-1a ★normalizeLegacyCards 从 loadData 的内联私有步骤提为**导出函数**，且 loadData 里不再有**卡片字段类**归一化的内联定义 —— 纪律：归一化必须挂在"数据入库的那一层"，挂在读路径上则每新增一个读入口就漏一个。★口径备案：loadData 里仍有 `fixEncoded`/`fixTagNames` 两个 `fix*`，它们归一化的是**分类名/标签名的 URL 编码**（第廿九轮），不是卡片字段，与本条无关——所以只查卡片那四条', () => {
  const loadSeg = REPO.slice(REPO.indexOf('export async function loadData'));
  const cardFix = ['fixTaskStatus', 'fixCurioStatus', 'fixCurioLegacyFields', 'fixCardLegacyFields',
    'fixResourceLinkType', 'fixCardKind', 'fixCardId', 'fixCardTitle'];
  return REPO.includes('export function normalizeLegacyCards')
    && loadSeg.includes('normalizeLegacyCards(data)')
    && (loadSeg.match(/normalizeLegacyCards\(data\)/g) || []).length === 1
    && !cardFix.some(f => loadSeg.includes(`const ${f} =`))
    && loadSeg.includes('const fixEncoded =')   /* 备案：这条在，证明白名单口径没写死成"零个 fix*" */
    && !loadSeg.includes('const fixTags =');
});
check('P0-2-1b ★随迁备案：设置页「数据包导入」必须接同一套归一化（mergeDataPackage 从不经过 loadData）。归一化写在 loadData 里只治得了"启动读老库"，治不了"导入老库"，而导入恰恰是老库的主要来源。判据点名 dataPackage.ts 的合并三行之后', () => {
  const start = PKG.indexOf('export async function mergeDataPackage')
  const seg = start >= 0 ? PKG.slice(start, PKG.indexOf('const cardsAdded', start)) : ''
  return seg.length > 0
    && PKG.includes('normalizeLegacyCards, stripRetiredCardKeys')
    && seg.includes('normalizeLegacyCards(d)')
    && seg.indexOf('d.curiosities = mergeById') < seg.indexOf('normalizeLegacyCards(d)')
    && !seg.includes('const fix');
});
check('P0-2-1c ★两条入口各调一次不会打架：归一化必须**幂等**——全部按「只在缺失时补」写，不覆盖已有值。判据钉住两处证据：① 函数**头注**里声明了纯归一化与幂等（头注在切片起点之前，所以只能从 REPO 全文取，取自 NORM 会恒假红——切片纪律）② fixCurioLegacyFields 的 done→status 只在 status 缺失时才读', () => {
  return REPO.includes('为什么是「纯归一化」而不是「版本迁移」')
    && REPO.includes('全部按「只在缺失时补」写，不覆盖已有值 ⇒ 重复调用安全')
    && /if \(c\.status === undefined && typeof c\.done === 'boolean'\)/.test(NORM)
    && NORM.includes('不覆盖已有 status');
});

console.log('【P0-2-2 · 补齐盘点查出的六处缺口（逐条点名，不许少一项）】');
check('P0-2-2a ★B7-e 四条仍在（task status/priority · curio status · curio 旧字段改名 · 三卡统一改名），一条都不许在重构中丢', () => {
  return NORM.includes('const fixTaskStatus') && NORM.includes('const fixCurioStatus')
    && NORM.includes('const fixCurioLegacyFields') && NORM.includes('const fixCardLegacyFields')
    && NORM.includes('c.title') && NORM.includes('c.question')
    && NORM.includes('c.desc') && NORM.includes('c.dueAt');
});
check('P0-2-2a2 ★customFields 是键值对象，不是数组：旧判据 `Array.isArray(c.customFields)` 会把每张正常卡的字段清空——好奇心转资源时自定义字段整片静默丢失，而且启动/导入两条路都会触发。负锚钉死不得回退成数组判据', () => {
  const ok = /if \(!c\.customFields \|\| typeof c\.customFields !== 'object' \|\| Array\.isArray\(c\.customFields\)\) c\.customFields = \{\}/.test(NORM);
  const old = /if \(!Array\.isArray\(c\.customFields\)\) c\.customFields = \{\}/.test(NORM);
  return ok && !old && NORM.includes('customFields 是键值对象，不是数组');
});
check('P0-2-2b ★**资源卡 linkType 兜底 + url→link 映射**（P0-2a 首次补齐的一条）。★它与前四条性质不同：**不会崩**，所以任何"点开就炸"的实拍都抓不到它——是一次纯静态盘点才发现的行为缺陷：缺 linkType 时 toOpenableUrl 走 url 分支 ⇒ 本地文件卡被当网页打开；linkStateOf 判不出 incomplete ⇒「⚠ 待补全路径」永不出现。判据点名四段：url 映射 / 三档形状推断（file·obsidian·url）/ zy-asset:// 归 file / 已有值不改', () => {
  return NORM.includes('const fixResourceLinkType')
    && NORM.includes("typeof c.url === 'string'")
    && NORM.includes('const already = c.linkType ===')
    && NORM.includes("/^zy-asset:\\/\\//i.test(t)")
    && NORM.includes("/^obsidian:\\/\\//i.test(t)")
    && NORM.includes('/^[a-zA-Z]:[\\\\/]/.test(t)')
    && NORM.includes('盘符/绝对路径')
    && NORM.includes('这条最要紧，能救回本地文件的打开通道');
});
check('P0-2-2c ★**kind 兜底**（资源/任务/好奇各按所在表补）：缺 kind 的卡不崩，但会**从所有 kind 视角里消失**——筛选看不到、三卡统计少算、导出丢列。是一种比崩溃更安静的错，所以盘点才找得到', () => {
  return NORM.includes('const fixCardKind')
    && NORM.includes("fixCardKind(d.resources as unknown as Record<string, unknown>[], 'resource')")
    && NORM.includes("fixCardKind(d.tasks as unknown as Record<string, unknown>[], 'task')")
    && NORM.includes("fixCardKind(d.curiosities as unknown as Record<string, unknown>[], 'curiosity')")
    && NORM.includes('从所有 kind 视角里消失');
});
check('P0-2-2d ★**id 兜底**：卡 id 是全库关联的锚（指标 taskIds / supportLinks / curationProjections.cardId / 回收站恢复）。缺 id 的卡一旦被编辑就复制不出关联，且 mergeById 用它做 key 会把多张无 id 卡**折叠成一张（静默丢卡）**。★只在缺失时按 createdAt 派生，**不改任何已有 id**——改 id 等于改用户的引用关系', () => {
  return NORM.includes('const fixCardId')
    && NORM.includes("if (typeof c.id === 'string' && c.id) return")
    && NORM.includes('折叠成一张（静默丢卡）')
    && NORM.includes('不改任何已有 id');
});
check('P0-2-2e ★**title 兜底 + 好奇卡 title 不改名**：资源/任务空标题兜底成「未命名」（空标题在卡面、⌘K 结果、导出、回收站里都是一处空白可点区域，用户会以为数据丢了）；好奇卡的"标题"就是 question 本身，映射已由 fixCurioLegacyFields 做，此处**不许**再改名——那会把问题文本复制成第二份，日后改一处两处不一致', () => {
  return NORM.includes('const fixCardTitle')
    && NORM.includes("c.title = '未命名'")
    && NORM.includes('好奇卡的"标题"就是 question 本身')
    && !NORM.slice(NORM.indexOf('const fixCardTitle')).includes('fixCardTitle(d.curiosities');
});
check('P0-2-2f ★**策展台与分类必填字段兜底**（order/archived/name）：hub.ts 与 app.ts 都按 `a.order - b.order` 排序、`filter(w => !w.archived)` 取活动台——缺 order ⇒ NaN 参与比较 ⇒ 台序错乱且**每次载入都可能不同**；缺 archived ⇒ 未归档判定不确定', () => {
  return NORM.includes('const fixWorkspaces') && NORM.includes('const fixCategories')
    && NORM.includes("if (typeof c.order !== 'number') c.order = 0")
    && NORM.includes('c.archived = !!c.archived')
    && NORM.includes("c.name = '未命名台'") && NORM.includes("c.name = '未命名分类'")
    && NORM.includes('台序错乱');
});

console.log('【P0-2-3 · 负锚：归一化不许被"优化"成覆盖式】');
check("P0-2-3a ★负锚三条：① 不许写迁移戳（写了就会在用户手改备份/旧版再导入后失效——那正是要治的场景）② 不许把已有值覆盖成默认值（老库里若有用户手填的 status='doing'，覆盖成 todo 就是**改用户的账**）③ 不许拿 or-默认值 代替字段映射（那是止血：页面不崩但内容全空，用户以为数据丢了）。★判据名里写 `||` 会截断字符串，故第三条只说「or-默认值」，锚点里才用 `||` 字面量", () => {
  const normBody = NORM.slice(NORM.indexOf('export function normalizeLegacyCards'));
  return !/fix\w+MigratedAt\s*=/.test(normBody)
    && !/\bd\.\w+MigratedAt\s*=/.test(normBody)
    && REPO.includes('写戳反而会在用户')
    && NORM.includes('加 `|| \'\'` 是止血，字段映射才是治本')
    && !/c\.status = c\.status \|\|/.test(normBody);
});

console.log('【P0-2-4 · 判据自身：旧结构样本必须在位且被断言真的读到】');
check('P0-2-4a ★样本（脱敏的老库形状）作为**常驻夹具**存在并被消费：V2.x 好奇卡是 {title,desc,done}、早期资源卡只有 {url}。判据钉住夹具存在 + 三张卡各能被归一化函数接住；这样"归一化函数被误删"和"夹具被掏空"都会红，而不是双双消失成假绿', () => {
  const f = path.resolve(base, 'shared/storage/__fixtures__/legacy-library.sample.json');
  if (!fs.existsSync(f)) return false;
  let j = null;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return false }
  return j.version === 2
    && Array.isArray(j.curiosities) && j.curiosities.length >= 2
    && j.curiosities.some(c => typeof c.title === 'string' && c.title && c.question === undefined && typeof c.done === 'boolean')
    && j.curiosities.some(c => typeof c.desc === 'string')
    && Array.isArray(j.resources) && j.resources.some(r => typeof r.url === 'string' && r.linkType === undefined)
    && Array.isArray(j.tasks) && j.tasks.some(t => t.status === undefined)
    && Array.isArray(j.workspaces) && j.workspaces.some(w => typeof w.order !== 'number');
});
check('P0-2-4b ★归一化函数本身可在 Node 里直接跑通（拿夹具喂进去，验真语义而不是只验源码有字面量）：好奇卡 question 由 title 映射而来、done=true 出 status=done、资源卡 url→link+linkType=file（Windows 盘符形状）、任务卡 status 兜底 todo、策展台 order 兜 0。★这条是 P0-2 的行为级闸——只读源码字面量的话，把函数体改成空壳也能过', () => {
  const f = path.resolve(base, 'shared/storage/__fixtures__/legacy-library.sample.json');
  const src = path.resolve(base, 'shared/storage/__fixtures__/legacy-fixture-run.cjs');
  if (!fs.existsSync(f) || !fs.existsSync(src)) return false;
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [src], { encoding: 'utf8', timeout: 60000 });
  if (!r || r.status !== 0) return false;
  let out = null;
  try { out = JSON.parse(r.stdout) } catch { return false }
  const c1 = out.curiosities.find(c => c.src === 'c-old-done');
  const c2 = out.curiosities.find(c => c.src === 'c-old-todo');
  const r1 = out.resources.find(x => x.src === 'r-win-path');
  const r2 = out.resources.find(x => x.src === 'r-obsidian');
  const t1 = out.tasks.find(x => x.src === 't-nostatus');
  const w1 = out.workspaces.find(x => x.src === 'w-noorder');
  return !!c1 && c1.question === '老库里那个已求证的问题' && c1.status === 'done'
    && !!c2 && c2.question === '老库里那个待探索的问题' && c2.status === 'todo'
    && !!r1 && r1.link === 'D:\\资料\\讲义.pdf' && r1.linkType === 'file'
    && !!r2 && r2.linkType === 'obsidian'
    && !!t1 && t1.status === 'todo' && t1.priority === 'medium'
    && !!w1 && w1.order === 0 && w1.archived === false
    && out.全为幂等;
});
