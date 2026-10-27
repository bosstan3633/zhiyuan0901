import { computed, onUnmounted, ref, type Ref } from 'vue'
import type { AppData } from '@/shared/models'
import { saveUIPrefs } from '@/shared/storage/repository'

const DIR_W_MIN = 180
const DIR_W_MAX = 420
const DIR_W_DEF = 220

export function useProjectCurationRail(d: Ref<AppData>, initialWidth?: number) {
  const projDirW = ref<number>(Math.min(DIR_W_MAX, Math.max(DIR_W_MIN, initialWidth || DIR_W_DEF)))
  const projDirGroups = computed(() => d.value.compass.directions
    .map(dir => ({ dir, projects: [...dir.projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }))
    .filter(g => g.projects.length))

  let dirDrag: { startX: number; startW: number } | null = null
  function onDirResizeMove(e: MouseEvent) {
    if (!dirDrag) return
    projDirW.value = Math.min(DIR_W_MAX, Math.max(DIR_W_MIN, dirDrag.startW + (e.clientX - dirDrag.startX)))
  }
  function onDirResizeUp() {
    document.removeEventListener('mousemove', onDirResizeMove)
    document.removeEventListener('mouseup', onDirResizeUp)
    if (dirDrag) {
      saveUIPrefs({ projRailW: projDirW.value })
      dirDrag = null
    }
  }
  function startDirResize(e: MouseEvent) {
    dirDrag = { startX: e.clientX, startW: projDirW.value }
    document.addEventListener('mousemove', onDirResizeMove)
    document.addEventListener('mouseup', onDirResizeUp)
  }
  function resetDirWidth() {
    projDirW.value = DIR_W_DEF
    saveUIPrefs({ projRailW: DIR_W_DEF })
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onDirResizeMove)
    document.removeEventListener('mouseup', onDirResizeUp)
    dirDrag = null
  })

  return {
    DIR_W_MIN,
    DIR_W_MAX,
    DIR_W_DEF,
    projDirW,
    projDirGroups,
    onDirResizeMove,
    onDirResizeUp,
    startDirResize,
    resetDirWidth,
  }
}
