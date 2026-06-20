import {
  matchClaimRequestsMenuPath,
  parseSearchParams,
  splitMenuItemPath,
} from '@insurance-shared/navigationMenuActive.js'

export function isActivePcNavigationPath(
  pathname: string,
  itemPath: string,
  search = '',
): boolean {
  const claimMatch = matchClaimRequestsMenuPath(pathname, search, itemPath)
  if (claimMatch !== null) {
    return claimMatch
  }

  const { pathname: menuPathname, searchParams: menuSearchParams } = splitMenuItemPath(itemPath)
  if (menuSearchParams.toString()) {
    const currentParams = parseSearchParams(search)
    for (const [key, value] of menuSearchParams.entries()) {
      if (currentParams.get(key) !== value) {
        return false
      }
    }
    return pathname === menuPathname || pathname.startsWith(`${menuPathname}/`)
  }

  if (menuPathname === '/contacts') {
    return pathname === '/contacts' || pathname === '/insurance/contacts'
  }
  if (menuPathname === '/insurance/contacts') {
    return pathname === '/insurance/contacts' || pathname === '/contacts'
  }
  if (menuPathname === '/portal/newsletters') {
    return pathname === '/portal/newsletters' || pathname.startsWith('/portal/newsletters/')
  }
  if (menuPathname === '/portal/adjuster-news') {
    return pathname === '/portal/adjuster-news' || pathname.startsWith('/portal/adjuster-news/')
  }
  if (menuPathname.startsWith('/portal/boards/')) {
    return pathname === menuPathname || pathname.startsWith(`${menuPathname}/`)
  }
  if (menuPathname === '/contacts/manage') {
    return pathname === '/contacts/manage' || pathname === '/insurance/company-registry'
  }
  if (menuPathname === '/insurance/company-registry') {
    return pathname === '/insurance/company-registry' || pathname.startsWith('/insurance/company-registry/')
  }
  if (menuPathname === '/customers/map') {
    return pathname === '/customers/map' || pathname.startsWith('/customers/map/')
  }
  if (menuPathname === '/customers') {
    if (pathname === '/customers/map' || pathname.startsWith('/customers/map/')) {
      return false
    }
    return (
      pathname === '/customers' ||
      pathname.startsWith('/customers/') ||
      pathname.startsWith('/customer/')
    )
  }
  if (menuPathname.startsWith('/customers/')) {
    return pathname === menuPathname || pathname.startsWith(`${menuPathname}/`)
  }
  if (menuPathname === '/application') {
    return pathname === '/application' || pathname.startsWith('/application/')
  }
  if (menuPathname === '/application/documents') {
    if (pathname.startsWith('/application/documents/history')) {
      return false
    }
    return pathname === '/application/documents' || pathname.startsWith('/application/documents/')
  }
  if (menuPathname === '/application/documents/history') {
    return (
      pathname === '/application/documents/history' ||
      pathname.startsWith('/application/documents/history/')
    )
  }
  if (menuPathname === '/feature-request') {
    return pathname === '/feature-request' || pathname === '/feature-requests/my'
  }
  if (menuPathname === '/account/reset') {
    return pathname === '/account/reset'
  }
  if (menuPathname === '/profile') {
    return pathname === '/profile'
  }
  if (menuPathname === '/todos') {
    return pathname === '/todos'
  }
  if (menuPathname === '/notifications') {
    return pathname === '/notifications'
  }
  if (menuPathname.startsWith('/internal/')) {
    return pathname === menuPathname || pathname.startsWith(`${menuPathname}/`)
  }
  if (menuPathname === '/admin/analytics') {
    return pathname === '/admin/analytics'
  }
  if (menuPathname === '/admin/platform') {
    return pathname === '/admin/platform' || pathname.startsWith('/admin/platform/')
  }
  if (menuPathname === '/admin/ga') {
    return pathname === '/admin/ga' || pathname === '/admin/create-ga'
  }
  if (menuPathname === '/admin/delegates') {
    return pathname === '/admin/delegates' || pathname === '/admin/create-staff'
  }
  if (menuPathname === '/insurer-managers') {
    return pathname === '/insurer-managers'
  }
  if (menuPathname === '/loss-adjusters') {
    return pathname === '/loss-adjusters'
  }
  if (menuPathname === '/insurer/news') {
    if (pathname.startsWith('/insurer/news/upload')) {
      return false
    }
    return pathname === '/insurer/news' || pathname.startsWith('/insurer/news/')
  }
  if (menuPathname === '/insurer/news/upload') {
    return pathname === '/insurer/news/upload'
  }
  if (menuPathname === '/adjuster/news') {
    if (pathname.startsWith('/adjuster/news/upload')) {
      return false
    }
    return pathname === '/adjuster/news' || pathname.startsWith('/adjuster/news/')
  }
  if (menuPathname === '/adjuster/news/upload') {
    return pathname === '/adjuster/news/upload'
  }
  if (menuPathname === '/admin/audit-logs') {
    return pathname === '/admin/audit-logs'
  }
  if (menuPathname === '/insurance/insurer-sites') {
    return pathname === '/insurance/insurer-sites'
  }
  if (menuPathname === '/admin/insurer-sites') {
    return pathname === '/admin/insurer-sites'
  }
  if (
    menuPathname === '/team/manage' ||
    menuPathname === '/team/menu-settings' ||
    menuPathname === '/team/admin'
  ) {
    return pathname === '/team/members' || pathname === menuPathname || pathname.startsWith('/team/members/')
  }
  if (menuPathname.startsWith('/team/')) {
    return pathname === menuPathname || pathname.startsWith(`${menuPathname}/`)
  }
  if (menuPathname === '/memo') {
    return pathname === '/memo' || pathname.startsWith('/memo/')
  }
  return pathname === menuPathname
}
