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
  },
  {
    key: 'phone',
    label: '연락처',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS', 'ENDS_WITH'],
  },
  {
    key: 'address',
    label: '주소',
    type: 'string',
    searchable: true,
    operators: ['CONTAINS', 'EQ'],
  },
  {
    key: 'job',
    label: '직업',
    type: 'string',
    searchable: true,
    operators: ['EQ', 'CONTAINS'],
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
  },
  {
    key: 'insuranceAge',
    label: '보험나이',
    type: 'derived',
    searchable: true,
    operators: ['EQ', 'BETWEEN'],
    derived: 'insuranceAgeFromBirth',
  },
]

const FIELD_BY_KEY = new Map(CUSTOMER_QUERY_FIELD_DEFINITIONS.map((f) => [f.key, f]))

export function getCustomerQueryField(key) {
  return FIELD_BY_KEY.get(String(key ?? '').trim()) ?? null
}

export function listSearchableCustomerQueryFields() {
  return CUSTOMER_QUERY_FIELD_DEFINITIONS.filter((f) => f.searchable)
}
