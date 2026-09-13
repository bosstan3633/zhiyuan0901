/**
 * R113-N5（T10）：真全屏的动态浮层宿主
 *
 * 背景：金字塔全屏走浏览器原生 requestFullscreen（宿主 = .ws-page）。
 * 浏览器只绘制全屏元素子树——任何 `Teleport to="body"` 的浮层在全屏期间不可见。
 *
 * 方案：全屏时把「浮层挂载点」指到全屏元素内；退出时回到 body。
 * 各浮层组件把 `Teleport to="body"` 改为 `:to="overlayTarget"`（useOverlayTarget）。
 *
 * 不改面：浏览器顶栏 / GlobalPopups / Toast / App 级 ResourceDetailDrawer
 * ——它们在 Workspace 之外，全屏下不可见属于设计内行为（切台 Tab 同理，退出全屏即恢复）。
 */
import { computed, ref, type Ref } from 'vue'

/** 当前全屏宿主元素；null = 非全屏（浮层回 body） */
const fsHost: Ref<HTMLElement | null> = ref(null)

/** 全屏进入/退出时由 Workspace 调用 */
export function setOverlayFsHost(el: HTMLElement | null): void {
  fsHost.value = el
}

/** 浮层组件用：Teleport 的动态目标（全屏元素 or body） */
export function useOverlayTarget() {
  return computed(() => fsHost.value || document.body)
}
