/**
 * AI customer list/search query metadata — derived from CRM customer columns & custom fields.
 * Not a natural-language synonym table.
 */

export const CUSTOMER_QUERY_LOGIC = Object.freeze(['AND'])

export const CUSTOMER_QUERY_OPERATORS = Object.freeze([
  'EQ',
  'CONTAINS',
  'IN',
  'BEFORE',
  'AFTER',
  'BETWEEN',
  'PERIOD',
  'IS_NULL',
  'IS_NOT_NULL',
  'INCLUDES',
  'EXCLUDES',
  'STARTS_WITH',
  'ENDS_WITH',
])

export const CUSTOMER_QUERY_PERIOD_TOKENS = Object.freeze([
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'NEXT_WEEK',
  'THIS_MONTH',
  'NEXT_MONTH',
  'LAST_30_DAYS',
])

/** @type {Array<{
 *   key: string,
 *   label: string,
 *   type: 'string' | 'enum' | 'date' | 'relation' | 'derived',
 *   searchable: boolean,
 *   operators: string[],
 *   enumValues?: string[],
 *   derived?: string,
 *   privacyLevel?: 'normal' | 'sensitive' | 'identifying' | 'internal',
 *   source?: string,
 * }>} */
export const CUSTOMER_QUERY_FIELD_DEFINITIONS = [
  {
    key: 'name',
    label: '이름',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'STARTS_WITH'],
  },
  {
    key: 'gender',
    label: '성별',
    type: 'enum',
    searchable: true,
    operators: ['EQ', 'IN'],
    enumValues: ['MALE', 'FEMALE'],
    source: 'customers.gender',
  },
  {
    key: 'phone',
    label: '연락처',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'ENDS_WITH'],
  },
  {
    key: 'birthDate',
    label: '생년월일',
    type: 'date',
    searchable: true,
    operators: ['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD'],
    privacyLevel: 'sensitive',
    source: 'customers.birth_date',
  },
  {
    key: 'customerCode',
    label: '고객번호',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'STARTS_WITH'],
    source: 'customers.customer_code',
  },
  {
    key: 'isFavorite',
    label: '중요 고객',
    type: 'boolean',
    searchable: true,
    operators: ['EQ'],
    source: 'customers.is_favorite',
  },
  {
    key: 'address',
    label: '주소',
    type: 'string',
    searchable: true,
    operators: ['CONTAINS', 'EQ'],
    source: 'customers.address + address_sido + address_sigungu',
  },
  {
    key: 'job',
    label: '직업',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
  },
  {
    key: 'drivingText',
    label: '운전(텍스트)',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
    source: 'customers.driving',
  },
  {
    key: 'isDriver',
    label: '운전 여부',
    type: 'boolean',
    searchable: true,
    operators: ['EQ'],
    source: 'customers.is_driver',
  },
  {
    key: 'company',
    label: '회사',
    type: 'relation',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
  },
  {
    key: 'labels',
    label: '고객 라벨',
    type: 'relation',
    searchable: true,
    operators: ['INCLUDES', 'EXCLUDES'],
  },
  {
    key: 'insurer',
    label: '주력보험사',
    type: 'relation',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
  },
  {
    key: 'carNumber',
    label: '차량번호',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'],
  },
  {
    key: 'carModel',
    label: '차량모델',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'],
  },
  {
    key: 'carType',
    label: '차종',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'],
    source: 'customers.car_type',
  },
  {
    key: 'carYear',
    label: '차량 연식',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
    source: 'customers.car_year',
  },
  {
    key: 'renewalDate',
    label: '자동차 만기일',
    type: 'date',
    searchable: true,
    operators: ['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD'],
  },
  {
    key: 'createdAt',
    label: '등록일',
    type: 'date',
    searchable: true,
    operators: ['BEFORE', 'AFTER', 'BETWEEN', 'PERIOD'],
    source: 'customers.created_at',
  },
  {
    key: 'insuranceAge',
    label: '보험나이',
    type: 'derived',
    searchable: true,
    operators: ['EQ', 'BETWEEN'],
    derived: 'insuranceAgeFromBirth',
  },
  {
    key: 'nextAgeDate',
    label: '상령일',
    type: 'date',
    searchable: true,
    operators: ['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD'],
    source: 'customers.next_age_date',
  },
  {
    key: 'ssn',
    label: '주민등록번호',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'ENDS_WITH'],
    privacyLevel: 'identifying',
    source: 'customers.ssn',
  },
  {
    key: 'height',
    label: '키',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
    privacyLevel: 'sensitive',
    source: 'customers.height',
  },
  {
    key: 'weight',
    label: '몸무게',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
    privacyLevel: 'sensitive',
    source: 'customers.weight',
  },
  {
    key: 'medical',
    label: '의료·건강 고지',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
    privacyLevel: 'sensitive',
    source: 'customers.medical',
  },
  { key: 'carrier', label: '통신사', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.carrier' },
  { key: 'memo', label: '메모', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.notes' },
  { key: 'inflowSource', label: '유입 경로', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.inflow_source' },
  { key: 'referrerName', label: '소개자·이관 출처', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.referrer_name' },
  { key: 'smsOptOut', label: '문자 수신거부', type: 'boolean', searchable: true, operators: ['EQ'], source: 'customers.sms_opt_out' },
  { key: 'businessRepresentativeName', label: '사업자 대표자명', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.business_representative_name' },
  { key: 'businessNumber', label: '사업자등록번호', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS', 'ENDS_WITH'], source: 'customers.business_number' },
  { key: 'businessAddress', label: '사업장 주소', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.business_address' },
  { key: 'businessMemo', label: '사업자 메모', type: 'string', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customers.business_memo' },
  { key: 'fireLocationAddress', label: '화재보험 소재지', type: 'relation', searchable: true, operators: ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'], source: 'customer_fire_insurance_locations.address' },
  { key: 'fireLocationMemo', label: '화재보험 소재지 메모', type: 'relation', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customer_fire_insurance_locations.memo' },
  { key: 'carMemo', label: '자동차 메모', type: 'relation', searchable: true, operators: ['EQ', 'CONTAINS'], source: 'customer_cars.memo' },
]

const FIELD_BY_KEY = new Map(CUSTOMER_QUERY_FIELD_DEFINITIONS.map((f) => [f.key, f]))

export function getCustomerQueryField(key) {
  return FIELD_BY_KEY.get(String(key ?? '').trim()) ?? null
}

export function listSearchableCustomerQueryFields() {
  return CUSTOMER_QUERY_FIELD_DEFINITIONS.filter((f) => f.searchable)
}

export function listKnownCustomerQueryFields() {
  return [...CUSTOMER_QUERY_FIELD_DEFINITIONS]
}

export function listNonQueryableCustomerQueryFields() {
  return CUSTOMER_QUERY_FIELD_DEFINITIONS.filter((f) => !f.searchable)
}
