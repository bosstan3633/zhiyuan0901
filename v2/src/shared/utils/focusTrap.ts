import { nextTick, onUnmounted, watch, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

let trapSeq = 0
const trapStack: number[] = []
const traps = new Map<number, { refresh: () => void }>()

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
    .filter(el => {
      const style = getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
}

/**
 * Keep keyboard focus inside the top-most overlay.
 *
 * The host already owns open/close state; this composable only adds the
 * focus lifecycle and the Tab cycle. Esc remains in each overlay shell so
 * the existing single-layer close semantics stay untouched.
 */
export function useFocusTrap(
  root: Ref<HTMLElement | null>,
  open: () => boolean,
  options: { initial?: 'container' | 'first' } = {}
) {
  const trapId = ++trapSeq
  let requested = false
  let attached = false
  let restoreTo: HTMLElement | null = null

  function cycle(event: KeyboardEvent): void {
    const panel = root.value
    if (!panel || event.key !== 'Tab') return
    const nodes = focusable(panel)
    if (!nodes.length) {
      event.preventDefault()
      panel.focus()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault()
      last.focus()
    }
  }

  function onFocusIn(event: FocusEvent): void {
    const panel = root.value
    if (!panel || !open() || panel.contains(event.target as Node)) return
    panel.focus()
  }

  function attach(): void {
    if (attached) return
    attached = true
    document.addEventListener('keydown', cycle, true)
    document.addEventListener('focusin', onFocusIn, true)
    void nextTick(() => {
      if (!attached) return
      const panel = root.value
      if (!panel) return
      if (options.initial === 'first') {
        const first = focusable(panel)[0]
        if (first) {
          first.focus()
          return
        }
      }
      panel.focus()
    })
  }

  function detach(): void {
    if (!attached) return
    attached = false
    document.removeEventListener('keydown', cycle, true)
    document.removeEventListener('focusin', onFocusIn, true)
  }

  function refresh(): void {
    const top = trapStack[trapStack.length - 1]
    if (requested && top === trapId) attach()
    else detach()
  }

  function register(): void {
    requested = true
    restoreTo = document.activeElement as HTMLElement | null
    if (!trapStack.includes(trapId)) trapStack.push(trapId)
    traps.forEach(t => t.refresh())
  }

  function unregister(): void {
    requested = false
    const at = trapStack.indexOf(trapId)
    if (at >= 0) trapStack.splice(at, 1)
    detach()
    traps.forEach(t => t.refresh())
    if (!trapStack.length && restoreTo && document.contains(restoreTo)) restoreTo.focus()
    restoreTo = null
  }

  // Register before the immediate watcher runs so the first open can attach.
  traps.set(trapId, { refresh })
  watch(open, (value) => {
    if (value) register()
    else unregister()
  }, { immediate: true })

  onUnmounted(() => {
    unregister()
    traps.delete(trapId)
  })
}
