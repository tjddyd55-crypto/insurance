/**
 * 프로모션 코드 normalize (대소문자/공백 무시).
 * - 입력: 사용자가 입력한 코드
 * - 출력: DB에서 unique 비교용 normalized 값
 */
export function normalizePromotionCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

