export function mapRowToCustomerBody(mapped) {
  const insuranceHistory = String(mapped.insuranceHistory ?? '').trim()
  const memoText = String(mapped.memo ?? '').trim()
  const notes = memoText || insuranceHistory
    ? {
        items: memoText
          ? [{ id: 'import', content: memoText, createdAt: new Date().toISOString() }]
          : [],
        insuranceHistory,
      }
    : { items: [], insuranceHistory: '' }
  return {
    name: mapped.name,
    phone: mapped.phone,
    ssn: mapped.ssn,
    address: mapped.address,
    gender: mapped.gender,
    height: mapped.height,
    weight: mapped.weight,
    job: mapped.job,
    medical: mapped.medical,
    carNumber: mapped.carNumber,
    notes,
  }
}
