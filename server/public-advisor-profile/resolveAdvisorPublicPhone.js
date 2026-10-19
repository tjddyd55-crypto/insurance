export function resolveAdvisorPublicPhone(row) {
  if (row?.show_public_phone === false) return ''
  const published = String(row?.public_phone ?? '').trim()
  if (published) return published
  return String(row?.phone_number ?? '').trim()
}
