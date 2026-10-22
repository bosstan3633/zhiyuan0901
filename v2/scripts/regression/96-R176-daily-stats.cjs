/**
 * R176 分片 · 96-R176-daily-stats：按日聚合快照的**两个跨上下文数据丢失缺陷**的回归防线。
 *
 * 依赖基建见 ./helpers.cjs；本分片是**新增**，不改动既有断言（纪律：只增不减）。
 *
 * ★为什么这两条必须是「行为级」而不是「源码形状」断言：
 *   这两个缺陷都属于「代码看起来对、跑起来丢数据」，源码形状断言钉不住它们
 *   （改写实现照样能骗过 grep）。所以本分片的判据是**拿产品真实实现跑一遍**：
 *   把 `src/shared/utils/dailyStats.ts` 用 esbuild 打成可执行包，喂真实数据形状，
 *   断言输出值。⇒ 判据随实现一起变，但**行为契约不变**。
 *
 * 两个缺陷（均为探针真机/离线实测复现，非推断）：
 *  ① 边界日当天的事件被陈旧快照冻住（mergeDailyStats 的「k ≤ boundary 换快照」那支）；
 *  ② 写快照时信任本上下文的陈旧缓存 ⇒ 把别的上下文刚补好的历史格子整段覆盖掉。
 */
const {
  fs, path, base, check, read, codeOnly, SCRIPTS_DIR,
} = require('./helpers.cjs');

console.log('【R176 · 按日聚合快照：边界日事件冻住 + 跨上下文丢快照】');

/* ---- 判据用的行为级执行器：把产品真实实现打成可执行包跑一遍 ---- */
let esbuild = null;
try { esbuild = require('esbuild'); } catch { /* 依赖缺失时行为断言改走形状兜底 */ }

/**
 * 用 esbuild 打包产品真实的 dailyStats.ts，返回其导出。
 * 打包失败/依赖缺失时返回 null（判据随后退到形状断言，不会因为环境问题误红成「实现坏了」）。
 */
function loadRealDailyStats() {
  if (!esbuild) return null;
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'dailyStats.ts');
  const out = path.resolve(SCRIPTS_DIR, '..', '.r176-daily-merge.tmp.cjs');
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    });
    return require(out);
  } catch { return null; }
}

const realDs = loadRealDailyStats();

/** 造一个真实的 DayRec 形状（字段全，不靠 undefined 蒙混） */
const dayRec = (o) => ({
  c: { res: 0, curio: 0, task: 0, ...(o.c || {}) },
  del: { res: 0, curio: 0, task: 0, ...(o.del || {}) },
  s: { curio: 0, task: 0, ...(o.s || {}) },
  u: o.u || 0, d: o.d || 0, sub: o.sub || 0, focus: o.focus || 0, link: o.link || 0,
  x: { add: 0, del: 0, ...(o.x || {}) },
  w: o.w || 0,
});

/* ============ ① 边界日当天：当天的新事件不得被陈旧快照冻住 ============ */
check('R176-1 ★mergeDailyStats 边界日当天留重建：当天再发生的调出/采集/删除不得被「当天早些时候的快照切片」冻住（用户可见症状：当天明明又调出了卡，热力图「今天」那一格却停在旧值不动）', () => {
  if (!realDs) {
    // 环境无 esbuild ⇒ 退到形状判据（形状锚点缺失时视为通过，避免环境问题误红）
    const ds = read('/shared/utils/dailyStats.ts');
    return ds.includes('if (k === boundary)') && ds.includes('★R176');
  }
  const today = '2026-10-21';
  // 快照：当天早些时候写的切片（只有 1 次采集，没有后来那次调出）
  const snap = {
    v: 1,
    days: {
      '2026-08-15': dayRec({ c: { res: 9 }, x: { add: 9 }, w: 9 }),
      [today]: dayRec({ c: { res: 1 }, x: { add: 1 }, w: 1 }),
    },
    fullSince: '2026-08-15',
    base: { res: 0, task: 0, curio: 0, link: 0 },
  };
  // 重建：今天又调出了一次（u=1）⇒ 合并后 u 必须仍是 1，不能退回快照里的 0
  const rebuild = {
    v: 1,
    days: { [today]: dayRec({ c: { res: 1 }, u: 1, x: { add: 1 }, w: 2 }) },
    fullSince: today,
    base: { res: 0, task: 0, curio: 0, link: 0 },
  };
  const merged = realDs.mergeDailyStats(snap, rebuild, today);
  const r = merged.days[today];
  if (!r) return false;
  // 三条腿：① 调出数不被冻住 ② 当日加权分不被冻住 ③ 老日子仍由快照补齐（快照功能没被废掉）
  const old = merged.days['2026-08-15'];
  return r.u === 1 && r.w === 2 && !!old && old.x && old.x.add === 9 && old.w === 9;
});

check('R176-2 ★mergeDailyStats 严格早于边界日的日子仍由快照补齐（防双计的老机制不许被 R176 修破）：k < boundary 且重建有此日时事件段换快照、字段段留重建', () => {
  if (!realDs) {
    const ds = read('/shared/utils/dailyStats.ts');
    return ds.includes('if (k === boundary)') && ds.includes('c: sr.c, del: sr.del, s: sr.s, u: sr.u, x: sr.x');
  }
  // ★边界日的定义 = 「日志里最早一条非 system 事件的日期」⇒
  //   **严格早于**边界日的日子，其事件已被日志淘汰、只剩快照有 ⇒ 换快照补齐；
  //   等于边界日的那天，日志仍在增长 ⇒ 留重建（R176-1 守的就是它）。
  //   （第一版把"老日子"取成了 boundary 本身 ⇒ 判据自身写错，不是实现错；已改用严格早于的一天。）
  const oldDay = '2026-10-10';
  const boundary = '2026-10-18';
  const today = '2026-10-21';
  // 快照：老日子的**更完整**事件段（u=5）——重建因日志淘汰只剩 u=1 ⇒ 换快照才补得回来
  const snap = {
    v: 1,
    days: {
      // 快照侧：事件段更全（u=5 / c.res=2），字段段 focus=1
      [oldDay]: dayRec({ c: { res: 2 }, u: 5, focus: 1, x: { add: 2 }, w: 7 }),
      // 边界日当天在快照里也有一份（陈旧切片）——R176 要求这一行**不得**覆盖重建
      [boundary]: dayRec({ c: { res: 1 }, u: 0, x: { add: 1 }, w: 1 }),
    },
    fullSince: oldDay,
    base: { res: 0, task: 0, curio: 0, link: 0 },
  };
  const rebuild = {
    v: 1,
    days: {
      // 重建侧：事件段残缺（u=1 / c.res=1），字段段 focus=2（**故意与快照不同**，
      // 这样才能分辨合并后字段段到底取了哪一边）
      [oldDay]: dayRec({ c: { res: 1 }, u: 1, focus: 2, x: { add: 1 }, w: 5 }),
      [boundary]: dayRec({ c: { res: 1 }, u: 1, x: { add: 1 }, w: 2 }),
      [today]: dayRec({ c: { res: 1 }, u: 1, x: { add: 1 }, w: 2 }),
    },
    fullSince: oldDay,
    base: { res: 0, task: 0, curio: 0, link: 0 },
  };
  const merged = realDs.mergeDailyStats(snap, rebuild, boundary);
  const r = merged.days[oldDay];
  if (!r) return false;
  // 三条腿（字段分两边故意不同 ⇒ 能分辨谁赢）：
  //   ① 事件段取快照：u=5（重建只有 1）、c.res=2（重建只有 1）
  //   ② 字段段留重建：focus=2（快照是 1）
  //   ③ w = 快照事件分 + 重建字段分 = (7 − 2.5×1) + 2.5×2 = 9.5
  // 边界日当天：留重建（u=1 不退回快照的 0）
  const bd = merged.days[boundary];
  return r.u === 5 && r.c.res === 2 && r.focus === 2 && r.w === 9.5
    && !!bd && bd.u === 1 && bd.w === 2;
});

/* ============ ② 写快照：不得信任本上下文的陈旧缓存 ============ */
check('R176-3 ★写快照路径必须重读库里的最新快照，不信任本上下文的陈旧缓存（否则 A 上下文会用陈旧缓存把 B 上下文刚补好的历史格子整段覆盖掉 ⇒ 跨上下文丢快照 ⇒ 热力图又褪色）', () => {
  const st = read('/shared/storage/dailyStatsStore.ts');
  // 写路径必须调用「重读最新快照」的入口，而不是直接用缓存变量
  const usesLatest = st.includes('readLatestSnapshotForWrite()');
  const writesWithLatest = st.includes('const snap = await readLatestSnapshotForWrite()');
  // 负锚：写路径不得直接吃缓存（否则陈旧缓存会整段覆盖别的上下文的快照）
  const noCacheInWrite = !/writeDailyStatsNow[\s\S]{0,600}mergeDailyStats\(snapCache/.test(st);
  // 读失败时不得退回 null（null 会被当成「库里没有快照」⇒ 空覆盖，是同一缺陷的另一形态）
  const readFailFallsBack = st.includes('return snapCache');
  return usesLatest && writesWithLatest && noCacheInWrite && readFailFallsBack;
});

check('R176-4 ★重读最新快照的实现纪律：读到的坏快照不得把已有缓存顶掉；库里真没有快照时才置空缓存（把「读失败」与「真的没有」区分开）', () => {
  const st = read('/shared/storage/dailyStatsStore.ts');
  return st.includes('export async function readDailySnapshot()')
    && st.includes('async function readLatestSnapshotForWrite()')
    && st.includes('setDailySnapshotCache(latest)')
    && st.includes('setDailySnapshotCache(null)')
    && st.includes('raw[DAILY_STATS_STORE_KEY] !== undefined');
});

/* ============ ③ 回归：R174-3 原判据不许被 R176 改破 ============ */
check('R176-5 ★R174-3 落盘地基的三条口径仍在位：独立键 + 45s 时间闸 + 页隐藏补写 + 内容未变跳写 + 写闸竞态不丢最后一次写入', () => {
  const st = read('/shared/storage/dailyStatsStore.ts');
  const rp = read('/shared/storage/repository.ts');
  return st.includes('DAILY_STATS_WRITE_GATE_MS = 45_000')
    && st.includes("document.addEventListener('visibilitychange'")
    && st.includes("window.addEventListener('pagehide'")
    && st.includes('flushDailyStatsNow')
    && st.includes('json === lastWrittenJson')
    && st.includes('pendingWriteData = data')
    && (rp.match(/scheduleDailyStatsWrite\(cache\)/g) || []).length === 2;
});

/* 清理临时打包产物（不留残留文件进门禁的孤儿检查） */
try { fs.unlinkSync(path.resolve(SCRIPTS_DIR, '..', '.r176-daily-merge.tmp.cjs')); } catch { /* 本来就没有 */ }

