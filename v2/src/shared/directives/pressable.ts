import type { Directive, DirectiveBinding } from 'vue'

/**
 * Give non-native click surfaces the same keyboard contract as a button.
 *
 * This directive deliberately does not replace a real <button>. It is a
 * migration bridge for older templates where changing the DOM tag would
 * disturb layout or event semantics. The click handler remains the single
 * source of truth; Enter and Space are translated into that same click.
 */
type PressableElement = HTMLElement & {
  __zyPressable?: {
    disabled: boolean
    onKeydown: (event: KeyboardEvent) => void
    onClick: (event: MouseEvent) => void
  }
}

function isNestedInteractive(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return false
  const hit = target.closest(
    'button, a[href], input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="menuitem"]'
  )
  return !!hit && hit !== root
}

function resolveDisabled(el: HTMLElement, binding: DirectiveBinding<unknown>): boolean {
  if (binding.value === false) return true
  return el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')
}

function onKeydown(el: PressableElement, event: KeyboardEvent): void {
  const state = el.__zyPressable
  if (!state || state.disabled) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (isNestedInteractive(event.target, el)) return
  event.preventDefault()
  el.click()
}

function sync(el: PressableElement, binding: DirectiveBinding<unknown>): void {
  const state = el.__zyPressable
  if (!state) return
  state.disabled = resolveDisabled(el, binding)
  el.tabIndex = state.disabled ? -1 : 0
  if (!el.hasAttribute('role')) el.setAttribute('role', 'button')
  if (state.disabled) el.setAttribute('aria-disabled', 'true')
  else el.removeAttribute('aria-disabled')
}

export const vPressable: Directive<PressableElement, unknown> = {
  mounted(el, binding) {
    const state = {
      disabled: false,
      onKeydown: (event: KeyboardEvent) => onKeydown(el, event),
      onClick: (event: MouseEvent) => {
        if (el.__zyPressable?.disabled) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      },
    }
    el.__zyPressable = state
    el.addEventListener('keydown', state.onKeydown)
    el.addEventListener('click', state.onClick, true)
    sync(el, binding)
  },
  updated(el, binding) {
    sync(el, binding)
  },
  unmounted(el) {
    const state = el.__zyPressable
    if (!state) return
    el.removeEventListener('keydown', state.onKeydown)
    el.removeEventListener('click', state.onClick, true)
    delete el.__zyPressable
  },
}

export default vPressable
