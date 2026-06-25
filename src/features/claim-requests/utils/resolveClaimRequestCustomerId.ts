type ClaimCustomerIdSource = {
  customerId?: number | string | null
  customer_id?: number | string | null
  connectedCustomerId?: number | string | null
  linkedCustomerId?: number | string | null
  customer?: { id?: number | string | null } | null
}

export function resolveClaimRequestCustomerId(source: ClaimCustomerIdSource | null | undefined): number | null {
  const candidates = [
    source?.customerId,
    source?.customer_id,
    source?.connectedCustomerId,
    source?.linkedCustomerId,
    source?.customer?.id,
  ]
  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}
