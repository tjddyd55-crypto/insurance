export function formatSmsPersonBirthDisplay(
  birthDate: string | null | undefined,
  compactBirth = false,
): string {
  if (!birthDate) {
    return '-'
  }
  if (compactBirth) {
    return birthDate.slice(0, 4)
  }
  return birthDate
}
