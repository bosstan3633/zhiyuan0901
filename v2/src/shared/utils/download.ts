/**
 * R172-T11/T12：浏览器端"另存为"的统一出口。
 * 只有一件事需要一致：**文件名带日期、BOM 与 MIME 配对**。此前 CSV 的写法长在抽屉里，
 * 复盘报告（Markdown / PNG）再来一份就必然漂移，故收在一处。
 */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** `20260927` —— 导出文件名后缀（本地日期，与 `todayKey` 同一口径） */
export function stampDay(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

function fire(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 文本导出：只有 CSV 补 UTF-8 BOM（Excel 需要）；Markdown / 纯文本 / HTML 不补——编辑器与 git diff 会把 BOM 当噪音 */
export function downloadText(filename: string, text: string, mime: 'csv' | 'md' | 'txt' | 'html'): void {
  const bom = mime === 'csv' ? '﻿' : ''
  const type = mime === 'csv' ? 'text/csv;charset=utf-8' : mime === 'md' ? 'text/markdown;charset=utf-8' : mime === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8'
  fire(new Blob([bom + text], { type }), filename)
}

export function downloadBlob(filename: string, blob: Blob): void {
  fire(blob, filename)
}
