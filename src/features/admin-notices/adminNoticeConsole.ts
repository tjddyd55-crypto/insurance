export type AdminNoticeConsoleVariant = 'platform' | 'ga'

export function adminNoticeApiRoot(variant: AdminNoticeConsoleVariant): string {
  return variant === 'ga' ? '/api/ga-admin/notices' : '/api/admin/notices'
}

export function adminNoticePageRoot(variant: AdminNoticeConsoleVariant): string {
  return variant === 'ga' ? '/ga-admin/notices' : '/admin/notices'
}
