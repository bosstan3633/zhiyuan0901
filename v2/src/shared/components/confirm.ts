import { reactive } from 'vue'

/** B28：全局确认弹窗状态（单例） */
export const confirmState = reactive({
  open: false,
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: true,
  resolve: null as ((v: boolean) => void) | null
})

/** 用法：const ok = await useConfirm({ title: '删除资源卡', message: '…', confirmText: '确认删除' }) */
export function useConfirm(opts: { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    confirmState.title = opts.title || '确认操作'
    confirmState.message = opts.message
    confirmState.confirmText = opts.confirmText || '确认'
    confirmState.cancelText = opts.cancelText || '取消'
    confirmState.danger = opts.danger !== false
    confirmState.open = true
    confirmState.resolve = resolve
  })
}

export function resolveConfirm(v: boolean) {
  confirmState.open = false
  const r = confirmState.resolve
  confirmState.resolve = null
  r?.(v)
}
