/**
 * Server-owned semantic vocabulary for unstructured customer blocks (pre-DB mapping).
 * Keys must match GPT strict schema enum.
 */
export const SEMANTIC_FIELD_KEYS = Object.freeze([
  'personName',
  'gender',
  'residentRegistrationNumber',
  'phone',
  'address',
  'detailAddress',
  'height',
  'weight',
  'job',
  'company',
  'drivingStatus',
  'carType',
  'carNumber',
  'carModel',
  'carYear',
  'renewalDate',
  'medical',
  'insuranceHistory',
  'memo',
])

export const SEMANTIC_GPT_CONFIDENCE = Object.freeze({
  APPLY: 0.9,
  REVIEW: 0.7,
})
