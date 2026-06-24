import { buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'

export type RelatedEntityNavigateOptions = {
  isMobile?: boolean
}

/**
 * 플랫폼 Todo 연결 대상별 상세 URL. 현재 MVP는 customer만.
 */
export function buildRelatedEntityHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  options: RelatedEntityNavigateOptions = {},
): string | null {
  if (!entityType || !entityId?.trim()) return null
  switch (entityType) {
    case 'customer': {
      const id = Number(entityId.trim())
      if (!Number.isInteger(id) || id < 1) return null
      return buildExternalCustomerNavigateTarget({
        customerId: id,
        isMobile: options.isMobile === true,
      })
    }
    case 'document':
    case 'e_document':
    case 'case':
    case 'tenant':
      return null
    default:
      return null
  }
}
