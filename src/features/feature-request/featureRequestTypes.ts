/** feature_requests.request_type — DB·API SSOT */
export type FeatureRequestType = 'error' | 'inquiry' | 'feature' | 'other'

export const FEATURE_REQUEST_TYPE_OPTIONS: { value: FeatureRequestType; label: string }[] = [
  { value: 'error', label: '오류' },
  { value: 'inquiry', label: '문의' },
  { value: 'feature', label: '기능 요청' },
  { value: 'other', label: '기타' },
]

export const FEATURE_REQUEST_TYPE_VALUES = new Set<FeatureRequestType>(
  FEATURE_REQUEST_TYPE_OPTIONS.map((o) => o.value),
)

export function featureRequestTypeLabel(type: FeatureRequestType | string | null | undefined): string {
  const found = FEATURE_REQUEST_TYPE_OPTIONS.find((o) => o.value === type)
  return found?.label ?? '기타'
}

export function parseFeatureRequestType(raw: unknown): FeatureRequestType | null {
  const value = String(raw ?? '').trim()
  if (FEATURE_REQUEST_TYPE_VALUES.has(value as FeatureRequestType)) {
    return value as FeatureRequestType
  }
  return null
}
