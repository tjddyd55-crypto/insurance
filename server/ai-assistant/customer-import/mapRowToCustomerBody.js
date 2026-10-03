export function mapRowToCustomerBody(mapped) {
  const notes = mapped.memo
    ? {
        items: [{ id: 'import', content: mapped.memo, createdAt: new Date().toISOString() }],
        insuranceHistory: mapped.insuranceHistory ?? '',
      }
    : { items: [], insuranceHistory: mapped.insuranceHistory ?? '' }
  return {
    name: mapped.name,
    phone: mapped.phone,
    ssn: mapped.ssn,
    address: mapped.address,
    gender: mapped.gender,
    notes,
  }
}
