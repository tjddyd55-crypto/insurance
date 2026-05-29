export const CUSTOMERS_LIST_REFRESH_EVENT = 'insurance-customers-list-refresh'

export function dispatchCustomersListRefresh() {
  window.dispatchEvent(new CustomEvent(CUSTOMERS_LIST_REFRESH_EVENT))
}
