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
    searchable: false,
    operators: [],
    privacyLevel: 'identifying',
    source: 'customers.ssn',
  },
  {
    key: 'height',
    label: '키',
    type: 'string',
    searchable: false,
    operators: [],
    privacyLevel: 'sensitive',
    source: 'customers.height',
  },
  {
    key: 'weight',
    label: '몸무게',
    type: 'string',
    searchable: false,
    operators: [],
    privacyLevel: 'sensitive',
    source: 'customers.weight',
  },
  {
    key: 'medical',
    label: '의료·건강 고지',
    type: 'string',
    searchable: false,
    operators: [],
    privacyLevel: 'sensitive',
    source: 'customers.medical',
  },
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
