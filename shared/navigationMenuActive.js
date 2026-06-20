/**
 * 메뉴 active 판정 — claim-requests 탭(query) 분리.
 * PC 상단·모바일 드로어·대시보드가 공통으로 사용한다.
 */

export function parseSearchParams(search) {
  const raw = String(search ?? '').trim()
  if (!raw) {
    return new URLSearchParams()
  }
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
}

export function splitMenuItemPath(itemPath) {
  const raw = String(itemPath ?? '').trim()
  const queryIndex = raw.indexOf('?')
  if (queryIndex === -1) {
    return { pathname: raw, searchParams: new URLSearchParams() }
  }
  return {
    pathname: raw.slice(0, queryIndex),
    searchParams: parseSearchParams(raw.slice(queryIndex)),
  }
}

export function getClaimTabParam(search) {
  return parseSearchParams(search).get('claimTab')?.trim() ?? ''
}

export function isCustomerNewsClaimTab(claimTab) {
  return claimTab === 'news-all' || claimTab === 'news-personal'
}

export function isClaimManagementClaimTab(claimTab) {
  return !claimTab || claimTab === 'inbox' || claimTab === 'claims'
}

/**
 * @returns {boolean | null} null 이면 claim-requests 규칙 대상이 아님
 */
export function matchClaimRequestsMenuPath(pathname, search, itemPath) {
  const { pathname: menuPathname, searchParams: menuSearchParams } = splitMenuItemPath(itemPath)
  if (menuPathname !== '/claim-requests') {
    return null
  }

  const menuClaimTab = menuSearchParams.get('claimTab')?.trim() ?? ''
  const currentClaimTab = getClaimTabParam(search)

  const customerWorkspaceMatch = /^\/customers\/\d+\/claim-requests(?:\/|$)/.test(pathname)
  if (customerWorkspaceMatch) {
    if (isCustomerNewsClaimTab(menuClaimTab)) {
      return false
    }
    return isClaimManagementClaimTab(currentClaimTab)
  }

  if (pathname !== '/claim-requests') {
    return false
  }

  if (menuClaimTab === 'news-all') {
    return isCustomerNewsClaimTab(currentClaimTab)
  }

  if (!menuSearchParams.has('claimTab')) {
    return isClaimManagementClaimTab(currentClaimTab)
  }

  return currentClaimTab === menuClaimTab
}
