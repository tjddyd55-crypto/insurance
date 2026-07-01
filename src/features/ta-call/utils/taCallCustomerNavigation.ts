import { buildRelatedEntityHref } from '../../todos/utils/relatedEntityNavigate'
import type { TaCallAssignment } from '../types/taCall.types'

export function canOpenTaCallCustomer(
  assignment: Pick<TaCallAssignment, 'customerId'>,
): boolean {
  return buildRelatedEntityHref('customer', assignment.customerId) != null
}

export function buildTaCallCustomerNavigateHref(
  assignment: Pick<TaCallAssignment, 'customerId'>,
  isMobile: boolean,
): string | null {
  return buildRelatedEntityHref('customer', assignment.customerId, { isMobile })
}
