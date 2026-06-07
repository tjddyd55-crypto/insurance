export type NaverMapPageContext = {
  href: string
  origin: string
  pathname: string
  search: string
  referrer: string
}

export type NaverMapNavigationContext = {
  navigationType: string
  redirectCount: number
  referrerPath: string
}

export type NaverMapAuthDiagnosticSnapshot = NaverMapPageContext &
  NaverMapNavigationContext & {
    clientIdMasked: string
    scriptQueryKey: string | null
    scriptHasCallback: boolean
    authFailureCalled: boolean
  }

const SENSITIVE_QUERY_KEYS = ['ncpKeyId', 'ncpClientId', 'govClientId', 'finClientId', 'clientSecret'] as const

export function maskClientKey(clientKey: string): string {
  const trimmed = clientKey.trim()
  if (!trimmed) {
    return '(empty)'
  }
  return `${trimmed.slice(0, 3)}…(len ${trimmed.length})`
}

export function sanitizeNaverUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (!parsed.searchParams.has(key)) {
        continue
      }
      const value = parsed.searchParams.get(key) ?? ''
      parsed.searchParams.set(key, maskClientKey(value))
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`
  } catch {
    return '(invalid-url)'
  }
}

export function getNaverMapPageContext(): NaverMapPageContext {
  return {
    href: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer || '(empty)',
  }
}

export function getNaverMapNavigationContext(): NaverMapNavigationContext {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  let referrerPath = '(empty)'
  if (document.referrer) {
    try {
      const parsed = new URL(document.referrer)
      referrerPath = `${parsed.pathname}${parsed.search}`
    } catch {
      referrerPath = '(invalid-referrer)'
    }
  }

  return {
    navigationType: nav?.type ?? 'unknown',
    redirectCount: nav?.redirectCount ?? 0,
    referrerPath,
  }
}

export function readNaverSdkScriptMeta(): { queryKey: string | null; hasCallback: boolean } {
  const script = document.querySelector('script[data-customer-map-provider="naver"]') as HTMLScriptElement | null
  if (!script?.src) {
    return { queryKey: null, hasCallback: false }
  }
  try {
    const parsed = new URL(script.src)
    let queryKey: string | null = null
    if (parsed.searchParams.has('ncpKeyId')) {
      queryKey = 'ncpKeyId'
    } else if (parsed.searchParams.has('ncpClientId')) {
      queryKey = 'ncpClientId'
    } else if (parsed.searchParams.has('govClientId')) {
      queryKey = 'govClientId'
    } else if (parsed.searchParams.has('finClientId')) {
      queryKey = 'finClientId'
    }
    return {
      queryKey,
      hasCallback: parsed.searchParams.has('callback'),
    }
  } catch {
    return { queryKey: 'invalid_url', hasCallback: false }
  }
}

export function buildNaverMapAuthDiagnosticSnapshot(
  clientKey: string,
  authFailureCalled: boolean,
): NaverMapAuthDiagnosticSnapshot {
  const scriptMeta = readNaverSdkScriptMeta()
  return {
    ...getNaverMapPageContext(),
    ...getNaverMapNavigationContext(),
    clientIdMasked: maskClientKey(clientKey),
    scriptQueryKey: scriptMeta.queryKey,
    scriptHasCallback: scriptMeta.hasCallback,
    authFailureCalled,
  }
}

export function logNaverMapAuthDiagnostics(
  scope: string,
  clientKey: string,
  authFailureCalled: boolean,
  extras?: Record<string, unknown>,
): NaverMapAuthDiagnosticSnapshot {
  const snapshot = buildNaverMapAuthDiagnosticSnapshot(clientKey, authFailureCalled)
  console.info(`[${scope}] naver map auth diagnostics`, {
    ...snapshot,
    ...extras,
  })
  return snapshot
}

/**
 * /v3/auth 등 NAVER 지도 네트워크 요청을 관찰한다.
 * query 에 포함된 key 는 sanitizeNaverUrl 로 마스킹한다.
 */
export function installNaverMapAuthRequestObserver(scope: string): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {}
  }

  const seen = new Set<string>()
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const resource = entry as PerformanceResourceTiming
      const name = resource.name
      if (!name.includes('naver.com')) {
        continue
      }
      if (!name.includes('/v3/auth') && !name.includes('/openapi/v3/maps.js')) {
        continue
      }

      const status =
        'responseStatus' in resource && typeof resource.responseStatus === 'number'
          ? resource.responseStatus
          : 'unknown'
      const dedupeKey = `${name}|${status}`
      if (seen.has(dedupeKey)) {
        continue
      }
      seen.add(dedupeKey)

      console.info(`[${scope}] naver map network`, {
        url: sanitizeNaverUrl(name),
        responseStatus: status,
        initiatorType: resource.initiatorType,
        pageHref: window.location.href,
        pageOrigin: window.location.origin,
        documentReferrer: document.referrer || '(empty)',
        referrerPath: getNaverMapNavigationContext().referrerPath,
      })
    }
  })

  try {
    observer.observe({ type: 'resource', buffered: true })
  } catch {
    return () => {}
  }

  return () => {
    observer.disconnect()
  }
}
