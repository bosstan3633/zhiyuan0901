/**
 * R159（信任层 T5）：存储键字典——**全站唯一真源**。
 *
 * 纪律（R159 门禁「裸字符串键名即红」）：`src/**` 内除本文件外，
 * 任何 `'zy_*'` / `'lm_*'` 存储键**字面量**都不得出现；一律经 `K` 引用。
 * 新增存储键：先在本文件登记，再使用。
 *
 * R164（A3）：K **只装 chrome.storage 键**——IndexedDB 库名与导出包标识
 * 不是存储键，另立 IDB_NAMES / EXPORT_MARKERS 两组（否则「裸键名即红」的语义边界被稀释）。
 */
export const K = {
  /** 主数据（单根 JSON） */
  DATA: 'zy_data_v2',
  /** UI 偏好 */
  UI: 'zy_ui_v2',
  /** 卡片操作事件日志 */
  EVENT_LOG: 'zy_event_log',
  /** 云同步元数据（登录态/版本/上次上传下载时间；不含主数据） */
  CLOUD_META: 'zy_cloud_meta_v1',
  /** 云同步回执的本机私有动作载荷；不进云端快照，最多保留 30 天 */
  CLOUD_SYNC_ACTIONS: 'zy_cloud_sync_actions_v1',
  /** 最近一次成功同步的完整业务基线；仅本机保存，用于三端字段级合并 */
  CLOUD_SYNC_BASE: 'zy_cloud_sync_base_v1',
  /** 跨页面/后台的云同步互斥锁，避免手动与自动任务同时覆盖 */
  CLOUD_SYNC_LOCK: 'zy_cloud_sync_lock_v1',
  /** 设置页覆盖的 Supabase 项目地址与 publishable key */
  CLOUD_ENV: 'zy_cloud_env',
  /** 好奇心探索累计起算时刻 */
  CURIO_SINCE: 'zy_curio_cum_since',
  /** 运行期错误日志 */
  ERROR_LOG: 'zy_error_log',
  /** 本地文件路径记忆（HTML/PDF 附件） */
  FILE_PATHS: 'zy_file_paths',
  /** 网页采集偏好 */
  CAPTURE_PREF: 'zy_capture_pref',
  /** 热度统计（WRR 等） */
  STATS: 'zy_stats_v1',
  /** R172-T2（04-67 §7.4）：按日聚合统计（热力图/复盘的时间序列真源；只增不淘汰） */
  DAILY_STATS: 'zy_daily_stats',
  /** AI 配置 */
  AI_CONFIG: 'zy_ai_v1',
  /** W4（V3.8.4）：captureEnrich 一次性迁移已跑过的戳（存独立键，不进 AppData / 不随备份外发） */
  AI_CAPTURE_ENRICH_MIGRATED: 'zy_ai_capture_enrich_migrated_v1',
  /** AI 一次性指令 */
  AI_DIRECTIVES: 'zy_ai_directives_v1',
  /** 标签整体整理备份 */
  TAGREVISE_BACKUP: 'zy_tagrevise_backup_v1',
  /** V3.7.0：分类→标签 + 台内卡收编 迁移前的全量备份（设置页迁移报告卡可下载/回退） */
  MIGRATE_BACKUP: 'zy_migrate_backup_v1',
  /** R1.5：分类→标签迁移报告（独立小键，不进 zy_data_v2 主根——红线更正） */
  MIGRATE_REPORT: 'zy_cats_migrate_report_v1',
  /** R4-a：迁移停用开关（设置页「回退到迁移前」时置位，启动期跳过池迁移；不进主 JSON） */
  MIGRATE_OPTOUT: 'zy_migrate_optout',
  /** R3-B′：方向台项目卡折叠态的 **sessionStorage** 键（浏览态非偏好，不进 chrome.storage 也不进导出链） */
  TREE_PROJ_FOLD_SS: 'zy_tree_proj_fold_v1',
  /** N2（V3.8.18）：方向台项目 AI 诊断报告——**chrome.storage.session** 专属键。
   *  会话缓存，关浏览器即失效；不进 AppData 主根、不随导出外发、不落卡片池。 */
  PROJ_DIAG: 'zy_proj_diag_v1',
  /** R159 启动期清理的遗留键（V1 时代） */
  LEGACY: ['lm_data_v5', 'lm_data_v5_backup'] as readonly string[]
} as const

/** localStorage 专属键（移动端 PWA；不属于 chrome.storage 语义） */
export const LOCAL_KEYS = {
  /** 桌面设备稳定 ID：用于生成跨设备可合并的全局唯一操作事件 ID */
  DEVICE_ID: 'zy_device_id',
  /** 移动端待提交链接 */
  MOBILE_PENDING: 'zy_mobile_pending',
  /** 移动端登录会话 */
  MOBILE_SESSION: 'zy_mobile_session',
  /** 桌面 Inbox 最近一次成功拉取的本地缓存；断网时仍可按时间盘点 */
  INBOX_CACHE: 'zy_inbox_cache',
  /** Inbox 卡片已在本机创建但远端转化状态尚未写回的重试队列 */
  INBOX_CONVERSION_QUEUE: 'zy_inbox_conversion_queue',
  /** Inbox 元数据已在本机更新但尚未写回云端的重试队列 */
  INBOX_EDIT_QUEUE: 'zy_inbox_edit_queue',
  /** 策展附件远端删除重试队列；只在本地保存对象路径，不保存凭据 */
  CURATION_ASSET_DELETE_QUEUE: 'zy_curation_asset_delete_queue',
  /** 账号操作事件拉取游标；按账号保存最后一条服务端接收时间 */
  ACCOUNT_EVENT_CURSOR: 'zy_account_event_cursor'
} as const

/**
 * R164（A3）：非 chrome.storage 命名空间——IndexedDB 库名。
 * 组装"名字像存储键、实则不是"的标识；断言据此要求 K 内不得混入非 storage 键。
 */
export const IDB_NAMES = {
  /** 附件二进制 IndexedDB 库名 */
  ASSETS: 'zy_assets'
} as const

/** R164（A3）：导出包类型标识（写进附件包 zip 的 manifest.type，非存储键） */
export const EXPORT_MARKERS = {
  ASSET_PACK: 'zy_asset_pack'
} as const
