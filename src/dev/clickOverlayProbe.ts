/**
 * Click overlay probe (dev-only).
 *
 * 목적:
 *   사용자가 "클릭이 먹을 때도 있고 안 먹을 때도 있다",
 *   "일부 뷰만 안 뜬다" 같이 원인이 모호한 UI 증상을 겪을 때,
 *   화면 위에 **투명 오버레이**가 클릭을 가로채는지를 실시간으로 특정한다.
 *
 * 동작:
 *   - dev 환경(개발 빌드 또는 Railway dev 호스트)에서만 활성화한다.
 *   - pointerdown(capture)에서 `event.target`과 동일 좌표의 `elementFromPoint`가
 *     다르면 "overlay hides target" 경고를 찍는다.
 *   - 같은 서명은 쿨다운 안에서 억제하여 콘솔을 오염시키지 않는다.
 *   - 수동 진단용으로 `window.__overlayProbe(x?, y?)`를 노출한다.
 *
 * 이 프로브는 UI/UX에 영향을 주지 않는다 (리스너는 passive, 렌더링 없음).
 */

type ElementLike = Element | null

const COOLDOWN_MS = 3000
const MAX_CLASS_CHARS = 80

function describe(el: ElementLike): string {
  if (!el) return '(none)'
  const tag = el.tagName.toLowerCase()
  const rawClass = typeof el.className === 'string' ? el.className : ''
  const cls = rawClass.trim().replace(/\s+/g, '.').slice(0, MAX_CLASS_CHARS)
  return cls ? `${tag}.${cls}` : tag
}

function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  const host = window.location.hostname
  return host.includes('insurance-dev') || host.includes('localhost')
}

function installProbe(): void {
  if (typeof window === 'undefined') return
  if ((window as unknown as { __overlayProbeInstalled?: boolean }).__overlayProbeInstalled) {
    return
  }
  ;(window as unknown as { __overlayProbeInstalled: boolean }).__overlayProbeInstalled = true

  const lastWarnAt = new Map<string, number>()

  function reportIfCovered(target: ElementLike, x: number, y: number, phase: string): void {
    const top = document.elementFromPoint(x, y)
    if (!top || !target) return
    if (top === target) return
    if (target.contains(top) || top.contains(target)) return

    const signature = `${describe(target)}|${describe(top)}`
    const now = performance.now()
    const last = lastWarnAt.get(signature) ?? 0
    if (now - last < COOLDOWN_MS) return
    lastWarnAt.set(signature, now)

    console.warn(
      `[overlay-probe:${phase}] click intended for ${describe(target)} but top element is ${describe(top)} at (${Math.round(x)},${Math.round(y)})`,
      { target, top },
    )
  }

  window.addEventListener(
    'pointerdown',
    (event) => {
      reportIfCovered(event.target as ElementLike, event.clientX, event.clientY, 'pointerdown')
    },
    { capture: true, passive: true },
  )

  ;(window as unknown as {
    __overlayProbe: (x?: number, y?: number) => { target: ElementLike; top: ElementLike }
  }).__overlayProbe = (x?: number, y?: number) => {
    const cx = x ?? Math.floor(window.innerWidth / 2)
    const cy = y ?? Math.floor(window.innerHeight / 2)
    const top = document.elementFromPoint(cx, cy)
    console.info(`[overlay-probe:manual] at (${cx},${cy}) → ${describe(top)}`, top)
    return { target: top, top }
  }

  console.info('[overlay-probe] installed (dev only). Use __overlayProbe(x?,y?) for a manual check.')
}

if (isDevEnvironment()) {
  installProbe()
}

export {}
