/**
 * 第卅三轮 REQ-024：详情抽屉文本框高度记忆。
 *
 * 默认高度 180px（此前 64~96px 偏小），右下角手柄拖拽调节，
 * 100~420px 夹取，松手后写入 UIPrefs.taHeights[<key>] 持久化（重启保留）。
 */
import { ref } from 'vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { UIPrefs } from '@/shared/models'

export function useTaHeight(key: string, ui: UIPrefs | undefined | null, def = 180) {
  const taH = ref(ui?.taHeights?.[key] ?? def)

  function startTaResize(e: MouseEvent) {
    e.preventDefault()
    const startY = e.clientY
    const startH = taH.value
    const move = (ev: MouseEvent) => {
      taH.value = Math.min(420, Math.max(100, startH + (ev.clientY - startY)))
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      const taHeights = { ...(ui?.taHeights || {}), [key]: Math.round(taH.value) }
      if (ui) ui.taHeights = taHeights
      saveUIPrefs({ taHeights })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return { taH, startTaResize }
}
