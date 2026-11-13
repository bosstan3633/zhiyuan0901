/**
 * V4.0.3 · Supabase 云同步现行契约。
 *
 * Airtable 退役后保留旧断言 ID，但把正向实现断言迁到这里：
 *   - 存储键只有一个真源，客户端与设置页不复制字面量；
 *   - 只接受 publishable key，Auth / PostgREST / 采集路径固定；
 *   - 快照 revision 乐观锁、冲突确认、格式校验与出云清理；
 *   - 采集查询与 429 重试可被静态核对；
 *   - Airtable 运行时代码、命令和入口不得回流。
 */
const { check, read, exists, codeOnly, base, fs, srcFileEntries } = require('./helpers.cjs')

console.log('【V4.0.3 · Supabase 云同步契约】')

const KEYS = read('/shared/storage/keys.ts')
const CLIENT = read('/shared/cloud/client.ts')
const SYNC = read('/shared/cloud/sync.ts')
const SETTINGS = read('/newtab/views/settings/SettingsCloudSync.vue')
const USECLOUD = read('/newtab/composables/useCloudSync.ts')
const DATA_MANAGEMENT = read('/newtab/views/settings/SettingsDataManagement.vue')
const MANIFEST = read('/manifest.ts')

const CLOUD_META_KEY = 'zy_cloud_meta_v1'
const CLOUD_ENV_KEY = 'zy_cloud_env'
const cloudSources = [CLIENT, SYNC, SETTINGS, DATA_MANAGEMENT].join('\n')

check('R192-1 ★云存储键唯一真源：cloud meta / env 只在 keys.ts 定义，其他源码不复制字面量', () => {
  const all = srcFileEntries().filter(x => x.rel !== 'shared/storage/keys.ts')
  const leaked = all.filter(x => x.text.includes(CLOUD_META_KEY) || x.text.includes(CLOUD_ENV_KEY))
  return KEYS.includes(`CLOUD_META: '${CLOUD_META_KEY}'`)
    && KEYS.includes(`CLOUD_ENV: '${CLOUD_ENV_KEY}'`)
    && leaked.length === 0
    && CLIENT.includes("const OVERRIDE_KEY = K.CLOUD_ENV")
    && SYNC.includes("const META_KEY = K.CLOUD_META")
})

check('R192-2（V4.3.0 重指）★只接受 publishable key：构建环境与设置页覆盖都拒绝 secret / service role；移动采集退役后不再保留第二套 PWA 鉴权入口', () => {
  const secretAssignment = /(?:VITE_SUPABASE_(?:SERVICE_ROLE|SECRET)|service_role\s*:|secret\s*:)/.test(cloudSources)
  return CLIENT.includes("anonKey.startsWith('sb_publishable_')")
    && SETTINGS.includes("anonKey.startsWith('sb_publishable_')")
    && !exists('/mobile/App.vue')
    && !secretAssignment
})

check('R192-3 ★Auth 与 PostgREST 路径固定：密码 / 刷新 / 登出与快照表都走现行 Supabase 端点', () => {
  return CLIENT.includes("'/auth/v1/token?grant_type=password'")
    && CLIENT.includes("'/auth/v1/token?grant_type=refresh_token'")
    && CLIENT.includes("'/auth/v1/logout'")
    && CLIENT.includes("'/rest/v1/cloud_snapshots'")
    && CLIENT.includes('/rest/v1/cloud_snapshots?select=revision,updated_at,state')
})

check('R192-4 ★快照写入返回 representation：插入与更新都带 Prefer，revision 可回写本机基线', () => {
  return CLIENT.includes("insertSnapshot:")
    && CLIENT.includes("updateSnapshot:")
    && (CLIENT.match(/Prefer: 'return=representation'/g) || []).length >= 2
    && SYNC.includes('const rev = ins[0]?.revision ?? 1')
    && SYNC.includes('const rev = upd[0].revision')
})

check('R192-5（V4.0.4 重指）★PATCH 乐观锁：按 user_id + revision 双条件更新，基线不符时先要求用户确认；取消或拉回均不得静默覆盖', () => {
  const merge = read('/shared/cloud/threeWayMerge.ts')
  const modal = read('/newtab/components/cloud/CloudMergeConflictModal.vue')
  return CLIENT.includes('&revision=eq.${expectedRevision}')
    && CLIENT.includes('method: \'PATCH\'')
    && SYNC.includes('const preview = mergeThreeWaySnapshots(baseline?.state || null, localState, beforeState)')
    && SYNC.includes("if (decision.action === 'cancel') return { kind: 'cancelled'")
    && SYNC.includes("if (decision.action === 'download') return { kind: 'download_requested'")
    && SYNC.includes("if (decision.action === 'upload') {")
    && SYNC.includes("} else if (decision.action === 'merge') {")
    && SYNC.includes('mergeThreeWaySnapshots(baseline?.state || null, localState, beforeState, decision.choices)')
    && SYNC.includes('cloud.updateSnapshot(env, token, meta.userId, remote.revision, candidate)')
    && merge.includes('baseKnown')
    && merge.includes('mergeRecordArray(')
    && USECLOUD.includes('await sync.uploadNow(')
    && SETTINGS.includes('<CloudMergeConflictModal')
    && modal.includes("action: 'merge'")
    && modal.includes("action: 'upload'")
    && modal.includes("action: 'download'")
})

check('R192-6（V4.2.1 重指）★快照结构与格式校验：SnapshotState 保留 ui 字段兼容旧快照，但云边界 sanitizeCloudSnapshot 固定输出 ui:null；恢复只接受 version === 2，且不覆盖本机界面偏好', () => {
  return SYNC.includes('export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }')
    && SYNC.includes('return { data: d, ui: safeUi, eventLog: [...eventLog] }')
    && SYNC.includes('export function sanitizeCloudSnapshot(snapshot: SnapshotState): SnapshotState')
    && SYNC.includes('return { data: clean.data, ui: null, eventLog: clean.eventLog }')
    && SYNC.includes("st.data.version !== 2")
    && SYNC.includes("throw new Error('云端快照格式不兼容')")
    && USECLOUD.includes('repository.cloudRestoreAtomic({')
    && USECLOUD.includes('nextUi: null')
    && USECLOUD.includes('await store.refreshAfterCloudRestore(nextData, null)')
    && USECLOUD.includes('eventLog: snapshot.eventLog')
})

check('R192-7（V4.1.0 重指）★出云清理：旧同步映射与内部字段剥离；普通卡附件六字段白名单，策展节点附件额外保留 Storage 元数据，正文仍不含 Blob', () => {
  const assetStart = SYNC.indexOf('const safeAsset =')
  const assetEnd = SYNC.indexOf('const stripAssets', assetStart)
  const assetBody = assetStart >= 0 && assetEnd > assetStart ? SYNC.slice(assetStart, assetEnd) : ''
  return SYNC.includes('delete d.airtableSync')
    && SYNC.includes('delete d.airtableMap')
    && SYNC.includes('delete (d as Record<string, unknown>).__wid')
    && SYNC.includes('delete (safeUi as unknown as Record<string, unknown>).__cloud')
    && assetBody.includes('id: a.id')
    && assetBody.includes('kind: a.kind')
    && assetBody.includes('name: a.name')
    && assetBody.includes('size: a.size')
    && assetBody.includes('mime: a.mime')
    && assetBody.includes('createdAt: a.createdAt')
    && !assetBody.includes('...a')
    && SYNC.includes('c.assets = c.assets.map(safeAsset)')
    && !assetBody.includes('blob')
    && SYNC.includes('SAFE_CURATION_UPLOAD_STATES')
    && SYNC.includes('storagePath: asset.storagePath')
    && SYNC.includes('uploadState: SAFE_CURATION_UPLOAD_STATES.has(asset.uploadState')
})

check('R192-8（V4.3.0 重指）★移动采集 Inbox 全链退役：PWA、PC 面板、composable、capture_inbox 客户端与设置页入口全部移除；旧深链只做回首页兼容', () => {
  const ROUTER = read('/newtab/router.ts')
  return !exists('/mobile/App.vue')
    && !exists('/newtab/components/compass/InboxPanel.vue')
    && !exists('/newtab/composables/useInbox.ts')
    && !CLIENT.includes('/rest/v1/capture_inbox')
    && !SYNC.includes('listCaptures')
    && !SETTINGS.includes('mobile-capture-inbox')
    && !SETTINGS.includes('/deck/inbox')
    && ROUTER.includes("path: '/deck/inbox'")
    && ROUTER.includes("redirect: '/'")
})

check('R192-12（V4.1.0）★今日三件事随主快照同步：dailyFocus 全槽位字段不裁剪，focusAutoDate / focusMutedDate 同行进入指纹与恢复链', () => {
  const start = SYNC.indexOf('function preserveDailyFocus')
  const end = SYNC.indexOf('/** 脱敏：普通卡附件只保留索引', start)
  const body = start >= 0 && end > start ? SYNC.slice(start, end) : ''
  return body.includes('Object.entries(source || {})')
    && body.includes('(slots || []).map(slot => ({ ...slot }))')
    && SYNC.includes('dailyFocus: preserveDailyFocus(d.dailyFocus)')
    && SYNC.includes('focusAutoDate: d.focusAutoDate')
    && SYNC.includes('focusMutedDate: d.focusMutedDate')
    && SYNC.includes('return { data: d, ui: safeUi, eventLog: [...eventLog] }')
    && USECLOUD.includes('repository.cloudRestoreAtomic({')
    && USECLOUD.includes('nextData,')
})

check('R192-9 ★429 有界退避：最多重试 3 次、基础 300ms、封顶 4000ms，并优先读取 retry-after', () => {
  return CLIENT.includes('const RATE_LIMIT_MAX_RETRY = 3')
    && CLIENT.includes('const RATE_LIMIT_BASE_MS = 300')
    && CLIENT.includes('const RATE_LIMIT_CAP_MS = 4_000')
    && CLIENT.includes("res.headers.get('retry-after')")
    && CLIENT.includes('if (res.status !== 429 || attempt === RATE_LIMIT_MAX_RETRY) break')
    && CLIENT.includes('await retry429(res, attempt)')
})

check('R192-10 ★Airtable 零回流负向守卫：运行时代码、manifest 命令、设置页签都已退役，只保留旧数据清理', () => {
  const runtimeRefs = srcFileEntries().filter(x => {
    if (x.rel === 'shared/cloud/sync.ts') return false
    if (x.rel === 'shared/storage/repository.ts') return false
    if (x.rel === 'newtab/views/settings/dataPackage.ts') return false
    return x.text.includes("@/shared/storage/airtable")
      || x.text.includes('sync-airtable')
      || x.text.includes("'package' | 'assets' | 'airtable'")
  })
  const background = read('/background/index.ts')
  return runtimeRefs.length === 0
    && !MANIFEST.includes("'sync-airtable'")
    && MANIFEST.includes("'alarms'")
    && background.includes("const AUTO_SYNC_ALARM = 'zy-cloud-auto-sync'")
    && !background.includes('airtable-poll')
    && DATA_MANAGEMENT.includes("'package' | 'assets' | 'cloud'")
    && DATA_MANAGEMENT.includes("<button class=\"dm-tab\" :class=\"{ on: tab === 'cloud' }\" @click=\"tab = 'cloud'\">云同步</button>")
})

check('R192-11（V4.0.4 重指）★已有构建 env 仍可覆盖：配置入口常显，展开字段与登录区解耦', () => {
  return SETTINGS.includes('const cfgOpen = ref(false)')
    && SETTINGS.includes('cfgOpen.value = !current')
    && SETTINGS.includes('cfgOpen.value = false')
    && SETTINGS.includes('@click="cfgOpen = !cfgOpen"')
    && SETTINGS.includes('<template v-if="cfgOpen">')
    && SETTINGS.includes('<template v-if="env && !loggedIn">')
    && SETTINGS.includes('await client.setCloudEnvOverride({ url, anonKey })')
    && !SETTINGS.includes('v-if="!env"')
    && !SETTINGS.includes('v-else-if="!loggedIn"')
})

// ===== R63 · 设置改造 + Airtable 单向同步轮 =====
check('R63-1（V4.0.3 重指）★Airtable 数据层整体退役：旧同步模型与运行时文件不再回流；repository 与云快照仍主动剥离 airtableSync / airtableMap，旧凭据不会随升级或上云继续存在', () => {
  const m = read('/shared/models/index.ts');
  const r = read('/shared/storage/repository.ts');
  const s = read('/shared/cloud/sync.ts');
  return !exists('/shared/storage/airtable.ts')
    && !m.includes('interface AirtableSyncState') && !m.includes('interface AirtableMapEntry')
    && r.includes('delete (data as unknown as Record<string, unknown>).airtableSync')
    && r.includes('delete (data as unknown as Record<string, unknown>).airtableMap')
    && s.includes('delete d.airtableSync') && s.includes('delete d.airtableMap');
});
check('R63-2（V4.0.3 重指）★自动建字段链路退役：旧 ensureColumns / Base meta fields 写远端结构的实现不存在；现行云客户端只访问受限 PostgREST 表，不含 Airtable API 端点', () => {
  const c = read('/shared/cloud/client.ts');
  return !exists('/shared/storage/airtable.ts')
    && !c.includes('api.airtable.com') && !c.includes('/meta/bases/') && !c.includes('fields')
    && c.includes('/rest/v1/cloud_snapshots') && !c.includes('/rest/v1/capture_inbox');
});
check('R63-3（V4.0.3 重指）★增量同步升级为快照 revision：GET 快照、POST 首版、PATCH 条件更新三路径齐备；429 改为有界指数退避，不再保留旧 30 秒固定等待与 recordId 映射', () => {
  const c = read('/shared/cloud/client.ts');
  const s = read('/shared/cloud/sync.ts');
  return c.includes('getSnapshot:') && c.includes('insertSnapshot:') && c.includes('updateSnapshot:')
    && c.includes('RATE_LIMIT_MAX_RETRY = 3') && c.includes('RATE_LIMIT_CAP_MS = 4_000')
    && s.includes('const rows = await cloud.getSnapshot(env, token, meta.userId)')
    && !s.includes('recordId') && !s.includes('cursorAt');
});
check('R63-4（V4.2.1 重指）★跨设备同步只覆盖业务 AppData 与 eventLog：UIPrefs 保留在本机，sanitizeCloudSnapshot 固定 ui:null；资源、任务、方向台、今日三件事与策展台作为业务子树整体进出云端', () => {
  const s = read('/shared/cloud/sync.ts');
  const c = read('/shared/cloud/client.ts');
  return s.includes('export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }')
    && s.includes('export function sanitizeCloudSnapshot(snapshot: SnapshotState): SnapshotState')
    && s.includes('return { data: clean.data, ui: null, eventLog: clean.eventLog }')
    && s.includes('const input = stableStringify(clean.data)')
    && s.includes('const clean = sanitizeCloudSnapshot(snapshot)')
    && c.includes('state: unknown') && !s.includes('collectSyncRows');
});
check('R63-5（V4.0.4 重指）★软删语义保留在本地数据树内：云快照不按已删除状态裁剪卡片，恢复时整棵 AppData 原样回灌；旧 Airtable「已删除」checkbox 不再存在', () => {
  const s = read('/shared/cloud/sync.ts');
  const start = s.indexOf('export function sanitizeSnapshot')
  const end = s.indexOf('\nconst MANIFEST_FIELDS', start)
  const body = start >= 0 && end > start ? s.slice(start, end) : ''
  return body.includes('const d = JSON.parse(JSON.stringify(data)) as AppData')
    && !body.includes('deletedAt') && !body.includes("'已删除'")
    && USECLOUD.includes('repository.cloudRestoreAtomic({')
    && USECLOUD.includes('await store.refreshAfterCloudRestore(nextData, null)')
    && USECLOUD.includes('meta.value = await sync.getCloudMeta()');
});
check('R63-6（V4.0.3 重指）★数据管理只保留三页签：数据包 / 附件管理 / 云同步；书签导入并入数据包，旧 Airtable 配置、轮询、日志与配额入口零回流', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const dm = read('/newtab/views/settings/SettingsDataManagement.vue');
  return g.includes("{ key: 'data', icon: 'database', label: '数据管理' }")
    && !g.includes("{ key: 'airtable', icon: 'refresh', label: 'Airtable 同步' }")
    && dm.includes("type DataTab = 'package' | 'assets' | 'cloud'")
    && dm.includes("tab === 'package'") && dm.includes("tab === 'assets'") && dm.includes("tab === 'cloud'")
    && dm.includes('浏览器书签') && dm.includes('SettingsCloudSync')
    && !codeOnly(dm).includes('testAtConnection') && !codeOnly(dm).includes('runAtSync') && !codeOnly(dm).includes('toggleAtPoll');
});
check('R63-7（V4.2.0 重指）★manifest 与 background 的 Airtable 运行时零回流：无 sync-airtable 命令、无旧轮询或命令转发；alarms 仅允许 V4.2.0 的云同步自动上传', () => {
  const m = read('/manifest.ts');
  const b = read('/background/index.ts');
  return !m.includes("'sync-airtable'") && m.includes("'alarms'")
    && !b.includes("case 'sync-airtable'") && !b.includes('triggerAirtableSync') && !b.includes('zy-autosync')
    && b.includes("const AUTO_SYNC_ALARM = 'zy-cloud-auto-sync'")
    && b.includes('periodInMinutes: AUTO_SYNC_PERIOD_MINUTES')
    && !b.includes('airtable-poll');
});
check('R63-8（V4.0.4 重指）★后台轮询退役：background 不再注册 Airtable alarm、storage.onChanged 对齐或无页跳过逻辑；启动检查只由常驻顶栏按钮触发一次，App 不重复探测', () => {
  const b = read('/background/index.ts');
  const a = read('/newtab/App.vue');
  const button = read('/newtab/components/CloudSyncButton.vue');
  return !b.includes("const AT_POLL_ALARM = 'airtable-poll'") && !b.includes('periodInMinutes: 180')
    && !b.includes('alignAirtableAlarm') && !b.includes('轮询跳过：无已开新标签页')
    && a.includes("import('@/shared/cloud/sync')")
    && !a.includes('useCloudSync')
    && !a.includes('cloudSync.refreshCloudStatus')
    && button.includes('onMounted(() =>')
    && button.includes('void cloud.refreshCloudStatus(true, store)')
    && USECLOUD.includes('await refreshCloudStatus(false)')
    && USECLOUD.includes('if (!force && !current.checkOnStart) return checkResult.value')
});
check('R63-9（V4.0.4 重指）★newtab 云同步执行器按需加载：入口与顶栏零静态运行时代码引用，App 只保留空闲预取动态 import，网络读写集中在共享 composable 的动态加载中', () => {
  const a = read('/newtab/App.vue');
  const button = read('/newtab/components/CloudSyncButton.vue');
  const runtimeCloudImport = source => source.split('\n').some(line =>
    /^\s*import\s+(?!type\b)/.test(line)
    && /['"]@\/shared\/cloud\/(?:client|sync)['"]/.test(line),
  );
  return !a.includes("msg?.type === 'zy-airtable-sync'") && !a.includes('runAirtableSync') && !a.includes('atSyncBusy')
    && !a.includes('zy-autosync') && !a.includes('@/shared/storage/airtable')
    && a.includes("import('@/shared/cloud/sync')")
    && !runtimeCloudImport(a) && !runtimeCloudImport(button)
    && USECLOUD.includes("import('@/shared/cloud/client')")
    && USECLOUD.includes("import('@/shared/cloud/sync')")
    && USECLOUD.includes('const result = await sync.checkRemote(captured.snapshot)');
});
check('R63-10（V4.0.4 重指）★首页云同步状态：页脚 foot-sync 复用共享六态关系；状态点击统一进入数据管理的云同步页签，不再保留旧 Airtable 立即同步入口', () => {
  const c = read('/newtab/views/CompassHome.vue');
  return c.includes('class="foot-sync"') && c.includes('data-testid="cloud-sync-status"')
    && c.includes(':class="cloudState"')
    && c.includes('const cloudState = cloud.state')
    && c.includes('const cloudStatusText = cloud.statusText')
    && c.includes('const cloudStatusDetail = cloud.statusDetail')
    && c.includes('function onCloudStatusClick()') && c.includes("router.push('/settings?page=cloud')")
    && !c.includes('pendingRows(store.data!)') && !c.includes("router.push('/settings?page=airtable')");
});
check('R63-11（V3.9.23 随迁）镜像语义仍在：通用数据包保留投射记录；资源池卡面显示“已镜像到”；镜像卡可定位源卡；旧按台 CSV 与全景统计零回流', () => {
  const pkg = read('/newtab/views/settings/dataPackage.ts');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const mir = read('/newtab/composables/useWorkspaceMirror.ts');
  const retired = ['const panCounts = computed', 'function panCountByWs', 'function panCountByCat', 'panMirrorSrc', 'jumpMirrorSource', 'function gWsById', 'class="rc-mirror-badge"'];
  return retired.every(k => !host.includes(k))
    && pkg.includes('curationProjections') && pkg.includes('mergeById(d.curationProjections')
    && !exists('/newtab/views/settings/SettingsExportPanel.vue')
    && pool.includes('class="pcp-mirror-badge"') && pool.includes("'已镜像到：' + mirrorNamesOf(r).join('、')")
    && mir.includes('function locateMirrorSource(r: ResourceCard)') && mir.includes("router.push('/')");
});
check('R63-12 ★R4-Da 退役重指带备案：原守「全景移动守卫：镜像卡=改投射落点（p.targetWsId/p.targetCatId）+ 池卡真身禁直接搬入策展台（守点文案「池卡真身不能直接搬入策展台」）」——整页退役后守卫没丢，而是下沉到真正写数据的三层，判据按那三层点名：① useWorkspaceMirror.moveMirrorTo 只改投射记录 p.targetCatId（源卡零影响，注释即 R61 纪律）② hub.projectCardToBoard 两道硬门槛：源卡必须 !deletedAt && workspaceId===CURATION_WS_ID、且 toWsId===CURATION_WS_ID 直接 return null（真身唯一入池，池不是搬运目标）③ useWorkspaceBatch 批量/单卡移动只作用 natives，镜像一律拦并给守点文案；GS 侧那套直写投射 + 守点文案按 codeOnly 零命中', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const mir = read('/newtab/composables/useWorkspaceMirror.ts');
  const hub = read('/shared/storage/hub.ts');
  const bat = read('/newtab/composables/useWorkspaceBatch.ts');
  const retired = ['p.targetWsId = targetWs', 'p.targetCatId = cat?.id', '池卡真身不能直接搬入策展台', 'const panMoveWs', 'panMoveCat'];
  return retired.every(k => !g.includes(k))
    && mir.includes('function moveMirrorTo(m: MirrorView, catId: string)') && mir.includes('p.targetCatId = catId || undefined')
    && hub.includes('const src = d.resources.find(r => r.id === cardId && !r.deletedAt && r.workspaceId === CURATION_WS_ID)')
    /* ★W17-C06 重指：hub 拆出可判别版本 projectCardToBoardEx（返回 { id, created }），
       「池不是搬运目标」这道硬门槛一字未减，只是返回值从 null 变成 { id: null, created: false }。 */
    && hub.includes('if (toWsId === CURATION_WS_ID) return { id: null, created: false }')
    && bat.includes("if (mirrors.length && !natives.length) { showToast('📡 所选均为镜像卡——移动请在源卡处操作，或先移出镜像'); return }")
    && bat.includes('natives.forEach(r => { r.workspaceId = moveWsId.value; r.categoryId = catId; r.updatedAt = Date.now() })')
    && bat.includes("if (isMirrorView(r)) { showToast('📡 镜像卡为引用——移动落点请直接拖拽，编辑请到源卡'); return }");
});
check('R63-13 导出适配随统一数据包收口：CSV/指定台导出退役；投射与支持关联并入包，Airtable 凭证和映射剥离', () => { const g = codeOnly(read('/newtab/views/GlobalSettings.vue')); const d = read('/newtab/views/settings/dataPackage.ts'); return !g.includes('exportWorkspace') && !g.includes('resCsvValue') && d.includes('mergeById(d.curationProjections') && d.includes('mergeById(d.supportLinks') && d.includes('delete safe.airtableSync') && d.includes('delete safe.airtableMap'); });
check('R63-14 导入兼容：mergeImport 四字段组（含 thesis）合并保留 R62 语义', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const)") && g.includes('if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()'); });

// ============ R64：资源台归一 + 同步自愈 + 界面瘦身（V2.34.0） ============
check('R64-1（V4.0.4 重指）★云同步冲突判定以远端 revision 为权威：每次上传先 GET 当前快照，远端修订与本地基线不一致时不得直接覆盖', () => {
  const c = read('/shared/cloud/client.ts');
  const s = read('/shared/cloud/sync.ts');
  return c.includes('select=revision,updated_at,state') && c.includes('&limit=1')
    && s.includes('const rows = await cloud.getSnapshot(env, token, meta.userId)')
    && s.includes('const localRevision = meta.revision || 0')
    && s.includes('if ((remote.revision !== localRevision || attempt > 0) && !canUseInitialApproval)');
});
check('R64-2（V4.0.4 重指）★冲突必须用户确认后再条件更新：onConflict 可取消或改走拉回；确认上传后仍以 PATCH revision 条件防另一设备抢先', () => {
  const s = read('/shared/cloud/sync.ts');
  const c = read('/shared/cloud/client.ts');
  return s.includes('const decision = await onConflict({')
    && s.includes("mode: 'merge'")
    && s.includes("if (decision.action === 'cancel') return { kind: 'cancelled'")
    && s.includes("if (decision.action === 'download') return { kind: 'download_requested'")
    && s.includes("if (decision.action === 'merge')")
    && s.includes('const canUseInitialApproval = attempt === 0 && initialApproval === remote.revision')
    && s.includes('cloud.updateSnapshot(env, token, meta.userId, remote.revision, candidate)')
    && c.includes('user_id=eq.${encodeURIComponent(userId)}&revision=eq.${expectedRevision}');
});
check('R64-3（V4.0.4 重指）★快照写入返回 representation：插入与更新都读取服务端 revision 并回写本机基线，避免下一次同步误判冲突', () => {
  const c = read('/shared/cloud/client.ts');
  const s = read('/shared/cloud/sync.ts');
  return (c.match(/Prefer: 'return=representation'/g) || []).length === 2
    && s.includes('const rev = ins[0]?.revision ?? 1')
    && s.includes('const rev = upd[0].revision')
    && (s.match(/revision: rev,\s+syncedFingerprint: fingerprint,\s+syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,\s+lastUploadAt: Date\.now\(\)/g) || []).length === 2;
});
check('R64-4（V4.1.0 重指）★设置文案完成云同步换轨：无 Free 配额旧口径，明确普通卡片附件本机保存、策展节点附件进入私有 Storage，云端不写入 Blob', () => {
  const dm = codeOnly(read('/newtab/views/settings/SettingsDataManagement.vue'));
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const cloud = codeOnly(read('/newtab/views/settings/SettingsCloudSync.vue'));
  return !dm.includes('Free 版配额') && !g.includes('Free 版配额') && !dm.includes('quotaHint')
    && dm.includes('Supabase 云同步')
    && cloud.includes('普通卡片附件留在本机')
    && cloud.includes('策展节点附件进入你的私有 Storage')
    && cloud.includes('AI 凭据不上云');
});
check('R64-5 方向状态新口径：战略目标=非归档 Direction 数 + 推进中项目=任务数≠0（不再计算 DHI 百分比）', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('pushing') && c.includes('goals') && !c.includes('dhiPct'); });
check('R64-6（R120-TB1 修订）方向状态 5 格平铺：战略目标 + 推进项目（各自数值，均下钻 dhi 明细）', () => { const m = read('/newtab/components/compass/MetricBar.vue'); return m.includes('战略目标') && m.includes('推进项目') && m.includes('pushingMain') && m.includes('m.value.dhi.goals') && m.includes('m.value.dhi.pushing') && !m.includes('DHI 方向契合度'); });
check('R64-7 下钻抽屉同步口径：各行=项目数/推进中项目数（挂有非软删任务即推进）', () => { const d = read('/newtab/components/compass/MetricDrillDrawer.vue'); return d.includes('推进中 = 该项目下挂有任务') && d.includes('任务数 ≠ 0'); });
check('R64-8 三件事瘦身：满员提示条与副文案删除 + lock-bar 样式清理', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('lock-bar') && !h.includes('锁定今日最重要的 3 件事') && !h.includes('已满 3/3'); });
check('R64-9（V4.0.4 重指）云状态 chip 归因：共享关系文案统一可点，跳转设置页云同步分区', () => {
  const h = read('/newtab/views/CompassHome.vue');
  return h.includes('data-testid="cloud-sync-status"')
    && h.includes('<span>{{ cloudStatusText }}</span>')
    && h.includes('<span class="cloud-detail">{{ cloudStatusDetail }}</span>')
    && h.includes('const cloudStatusText = cloud.statusText')
    && h.includes("void router.push('/settings?page=cloud')");
});
check('R64-10 hub-merge 迁移：旧台树挂资源台同名根分类 + 原生卡平移 + 实体删除 + 幂等 hubMergedAt', () => { const m = read('/shared/storage/curationMigration.ts'); const mod = read('/shared/models/index.ts'); return m.includes('export function migrateHubMerge') && m.includes('hubMergedAt') && m.includes('name === b.name') && m.includes("d.workspaces = d.workspaces.filter(w => w.id !== b.id)") && mod.includes('hubMergedAt?'); });
check('R64-11 迁移链挂载：app.ts 调 migrateHubMerge + 备份条件（R128-A2 改判 hubMergeWorkPending，防资源台归档时每次启动下载备份）', () => { const a = read('/newtab/stores/app.ts'); return a.includes('migrateHubMerge(data.value)') && a.includes('hubMergeWorkPending(data.value)') && a.includes('!data.value.hubMigratedAt'); });
// R179-MIGRATED R64-12
// V3.7.0（R179）随迁重写：采集统一入池
check('R64-12（V3.7.0 重指）采集统一入资源卡池：workspaceId 固定 CURATION_WS_ID、categoryId 置空，台面/分类选择器退役', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('workspaceId: CURATION_WS_ID') && g.includes("categoryId: ''") && !g.includes('defaultCaptureWsId') && g.includes('资源卡池'); });
check('R64-13（V3.9.8 随迁）树状递归呈现由画布承担：子分类按 parentId 递归挂载，卡片只显示直属节点，不再混入父级分区平铺', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return h.includes('function childrenOf(catId: string)')
    && h.includes('const key = r.categoryId || \'\'')
    && h.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>')
    && n.includes('function children(): Category[]')
    && n.includes('(n.parentId || \'\') === props.node.id')
    && n.includes('props.cardsByCat.get(props.node.id)');
});
/* V3.7.0（R179）退役 R64-14：同 R34-8——卡面分类路径徽标随 hub 分类退役。 */
check('R64-15（V3.9.14 重指）画布连线：金字塔继续由伪元素生成同层横线与父到子竖线；树状不再猜测固定中线，改由 CurationMindMap 读取真实父子节点盒坐标生成 SVG 正交 elbow，L1–L4 每段都要从父节点右缘连到子节点左缘', () => {
  const c = read('/newtab/components/curation/curation.css');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  return !host.includes('py-links-svg') && !host.includes('drawPyLinks')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children::before')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children > .mind-branch::before')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-branch:has(> .mind-children) > .mind-node::after')
    && c.includes('.mind-connectors path')
    && m.includes("stage.querySelectorAll<HTMLElement>('[data-mind-branch]')")
    && m.includes("branch.querySelector<HTMLElement>(':scope > .mind-node')")
    && m.includes("children.querySelectorAll<HTMLElement>(':scope > .mind-branch')")
    && m.includes('const px = pr.right - sr.left')
    && m.includes('const cx = cr.left - sr.left')
    && m.includes('M ${px} ${py} H ${mx} V ${cy} H ${cx}')
    && m.includes('new ResizeObserver(scheduleTreeConnectors)');
});
check('R64-16（V4.0.3 重指）中心论点创建：空画布 CTA 发 open-create-thesis，宿主 openThesisCreate 打开新建抽屉并预置 isThesis；论点由连续页头主舞台与画布 L1 双入口承担，旧入口文案零回流', () => {
  const w = read('/newtab/views/Workspace.vue');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return m.includes("emit('open-create-thesis')") && m.includes('action-label="＋ 写下中心论点"')
    && w.includes('function openThesisCreate()') && w.includes('editingResource.isThesis = true')
    && !w.includes('点击设立中心论点') && w.includes('class="ws-head"')
    && w.includes('class="thesis-banner"') && w.includes('class="thesis-empty-inner"')
    && w.includes('中心论点') && w.includes('openThesisCard');
});
