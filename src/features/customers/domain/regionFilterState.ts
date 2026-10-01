export const REGION_FILTER_ALL = ''

export function isSigunguFilterEnabled(sido: string): boolean {
  return sido.trim().length > 0
}

/**
 * 시/군/구 선택지가 없으면(세종특별자치시) 읍/면/동은 시/도만으로 연다.
 */
export function isEupmyeondongFilterEnabled(
  sido: string,
  sigungu: string,
  sigunguOptionCount: number,
): boolean {
  if (!isSigunguFilterEnabled(sido)) {
    return false
  }
  if (sigunguOptionCount === 0) {
    return true
  }
  return sigungu.trim().length > 0
}

export function regionSelectOptions(values: string[], allLabel = '전체'): Array<{ value: string; label: string }> {
  return [{ value: REGION_FILTER_ALL, label: allLabel }, ...values.map((value) => ({ value, label: value }))]
}
