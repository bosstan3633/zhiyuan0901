/**
 * R159（信任层 T5）：存储键字典——**全站唯一真源**。
 *
 * 纪律（R159 门禁「裸字符串键名即红」）：`src/**` 内除本文件外，
 * 任何 `'zy_*'` / `'lm_*'` 存储键**字面量**都不得出现；一律经 `K` 引用。
 * 新增存储键：先在本文件登记，再使用。
 */
export const K = {
  /** 主数据（单根 JSON） */
  DATA: 'zy_data_v2',
  /** UI 偏好 */
  UI: 'zy_ui_v2',
  /** 附件二进制 IndexedDB 库名（zy_assets） */
  ASSETS_DB: 'zy_assets',
  /** 卡片操作事件日志 */
  EVENT_LOG: 'zy_event_log',
  /** 好奇心探索累计起算时刻 */
  CURIO_SINCE: 'zy_curio_cum_since',
  /** 运行期错误日志 */
  ERROR_LOG: 'zy_error_log',
  /** 本地文件路径记忆（HTML/PDF 附件） */
  FILE_PATHS: 'zy_file_paths',
  /** 附件打包（导入用） */
  ASSET_PACK: 'zy_asset_pack',
  /** 网页采集偏好 */
  CAPTURE_PREF: 'zy_capture_pref',
  /** 热度统计（WRR 等） */
  STATS: 'zy_stats_v1',
  /** 快速采集预填 */
  QC_PREFILL: 'zy_qc_prefill',
  /** AI 配置 */
  AI_CONFIG: 'zy_ai_v1',
  /** AI 一次性指令 */
  AI_DIRECTIVES: 'zy_ai_directives_v1',
  /** 标签整体整理备份 */
  TAGREVISE_BACKUP: 'zy_tagrevise_backup_v1',
  /** R159 启动期清理的遗留键（V1 时代） */
  LEGACY: ['lm_data_v5', 'lm_data_v5_backup'] as readonly string[]
} as const
