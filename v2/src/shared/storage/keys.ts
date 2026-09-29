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
  /** 快速采集预填 */
  QC_PREFILL: 'zy_qc_prefill',
  /** AI 配置 */
  AI_CONFIG: 'zy_ai_v1',
  /** AI 一次性指令 */
  AI_DIRECTIVES: 'zy_ai_directives_v1',
  /** 标签整体整理备份 */
  TAGREVISE_BACKUP: 'zy_tagrevise_backup_v1',
  /** V3.7.0：分类→标签 + 台内卡收编 迁移前的全量备份（设置页迁移报告卡可下载/回退） */
  MIGRATE_BACKUP: 'zy_migrate_backup_v1',
  /** R1.5：分类→标签迁移报告（独立小键，不进 zy_data_v2 主根——红线更正） */
  MIGRATE_REPORT: 'zy_cats_migrate_report_v1',
  /** R159 启动期清理的遗留键（V1 时代） */
  LEGACY: ['lm_data_v5', 'lm_data_v5_backup'] as readonly string[]
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
