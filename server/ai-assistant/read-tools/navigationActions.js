const ALLOWED_NAV_TYPES = new Set(['navigate.customer.detail'])

/**
 * @param {number} customerId
 */
export function buildCustomerDetailUiAction(customerId) {
  const id = Number(customerId)
  if (!Number.isInteger(id) || id < 1) {
    return []
  }
  return [
    {
      type: 'navigate.customer.detail',
      customerId: id,
      path: `/customers?customerId=${id}`,
    },
  ]
}

/**
 * @param {Array<{ type?: string, customerId?: number, path?: string }>} actions
 */
export function sanitizeUiActions(actions) {
  if (!Array.isArray(actions)) {
    return []
  }
  return actions.filter((a) => {
    if (!a || !ALLOWED_NAV_TYPES.has(a.type)) {
      return false
    }
    const id = Number(a.customerId)
    const path = String(a.path ?? '')
    return Number.isInteger(id) && id > 0 && path === `/customers?customerId=${id}`
  })
}
