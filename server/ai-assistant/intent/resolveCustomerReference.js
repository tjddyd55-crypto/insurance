/**
 * Reference resolution helpers (not intent classification).
 * @param {string} text
 */
export function messageUsesPreviousCustomerReference(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  return /(그\s*사람|그\s*고객|이\s*고객|아까\s*(그\s*)?(사람|고객)|방금\s*(그\s*)?(사람|고객)|저\s*사람)/.test(t)
}

/**
 * @param {object} target classified.target
 * @param {string} text
 */
export function resolveCustomerIdFromContext(target, conversation, text) {
  const ref = String(target?.reference ?? '').toLowerCase()
  if (target?.customerId) {
    return Number(target.customerId)
  }
  if (ref === 'previous_customer' || ref === 'current_customer' || messageUsesPreviousCustomerReference(text)) {
    const id = conversation?.resolvedEntities?.customer?.customerId
    return id != null ? Number(id) : null
  }
  return null
}
