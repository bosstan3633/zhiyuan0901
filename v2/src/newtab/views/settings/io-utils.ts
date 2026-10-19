/**
 * 导入 / 导出两个子域共用的两个纯工具（V3.8.42 P0-3 第四批抽出）
 *
 * ★为什么抽出来而不是让两个子域互相 props 传递：
 *   `downloadFile` / `dateStr` 都被 import（导入前自动备份）与 export（附件包 zip + 四路导出）用。
 *   走 props 会形成**双向依赖**——export 组件要传给 import，import 组件要传给 export，
 *   而两者都由同一个宿主渲染，宿主就得同时持有并双向接线，代码比共享模块更难读。
 *   两个函数都**零依赖**（只用浏览器 API 与 Date），放进 settings/ 这个子域目录是最自然的位置。
 *
 * ★函数体逐字来自 GlobalSettings.vue（搬移时刻原文），未改一个字符。
 */

/** 触发浏览器下载：Blob → objectURL → a[download]，用完立即 revoke */
export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/** 文件名用的日期戳（YYYY-MM-DD，UTC）——导出与"导入前自动备份"共用同一口径 */
export function dateStr() { return new Date().toISOString().slice(0, 10) }
