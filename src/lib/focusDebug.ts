const FOCUS_DEBUG_EVENT = 'onefc:focus-debug'
const FOCUS_DEBUG_ENABLED = import.meta.env.VITE_FOCUS_DEBUG === 'true'

export type FocusDebugDetail = Record<string, unknown>

/** Development-only lifecycle signal for common focus-sensitive UI layers. */
export function emitFocusDebug(type: string, detail?: FocusDebugDetail) {
  if (!FOCUS_DEBUG_ENABLED || typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent(FOCUS_DEBUG_EVENT, { detail: { type, detail } }))
}

export function isFocusDebugEnabled() {
  return FOCUS_DEBUG_ENABLED
}

export { FOCUS_DEBUG_EVENT }
