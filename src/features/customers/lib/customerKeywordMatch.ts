/**
 * 고객 검색 SSOT (서버 /api/customers/search 와 동일 정책):
 * - 이름: 공백·대소문자 무시 부분일치
 * - 전화번호: 검색어에 숫자가 있을 때만, 숫자만 비교 (010-1234-5678 ↔ 0101234 / 010-1234 / 5678)
 * 고객코드 / id / 주소 / 메모는 검색하지 않는다.
 */
export function customerMatchesNamePhoneKeyword(
  customer: { name?: string | null; phone?: string | null },
  keyword: string,
): boolean {
  const nameQ = keyword.replace(/\s+/g, '').toLowerCase()
  if (!nameQ) return true
  const name = (customer.name ?? '').replace(/\s+/g, '').toLowerCase()
  if (name.includes(nameQ)) return true
  const digitsQ = keyword.replace(/\D/g, '')
  if (!digitsQ) return false
  return (customer.phone ?? '').replace(/\D/g, '').includes(digitsQ)
}
