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

export function toggleCustomerDetailSectionOpen(
  previous: CustomerDetailOpenSections,
  sectionId: CustomerDetailCoreSectionId,
  expanded: boolean,
): CustomerDetailOpenSections {
  return { ...previous, [sectionId]: expanded }
}

export function resetCustomerDetailOpenSectionsForCustomer(): CustomerDetailOpenSections {
  return createDefaultCustomerDetailOpenSections()
}
