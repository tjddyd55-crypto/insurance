import {
  CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION,
  type CustomerDetailCoreSectionId,
} from '../config/customerDetailCoreSectionOrder'

export type CustomerDetailOpenSections = Record<CustomerDetailCoreSectionId, boolean>

export function createDefaultCustomerDetailOpenSections(): CustomerDetailOpenSections {
  return {
    basic: CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION === 'basic',
    vehicle: false,
    linked: false,
    fireInsurance: false,
    business: false,
    alertDates: false,
  }
}

/** Multi-open: toggles only the target section; other sections stay unchanged. */
export function toggleCustomerDetailSectionOpen(
  previous: CustomerDetailOpenSections,
  sectionId: CustomerDetailCoreSectionId,
  expanded: boolean,
): CustomerDetailOpenSections {
  return { ...previous, [sectionId]: expanded }
}

/** Reset accordion when the selected customer changes. */
export function resetCustomerDetailOpenSectionsForCustomer(): CustomerDetailOpenSections {
  return createDefaultCustomerDetailOpenSections()
}
