/**
 * 고객 일괄등록 Excel — 컬럼 SSOT (다운로드 샘플 · 파서 · 실패/export 공통)
 * CustomerEditForm / POST /api/customers 에 실제 저장되는 필드만 포함한다.
 */

export type CustomerExcelColumnKey =
  | 'name'
  | 'phone'
  | 'ssn'
  | 'birthDate'
  | 'gender'
  | 'address'
  | 'addressDetail'
  | 'job'
  | 'memo'
  | 'businessRepresentativeName'
  | 'businessNumber'
  | 'businessAddress'
  | 'businessAddressDetail'
  | 'businessMemo'
  | 'carrier'
  | 'height'
  | 'weight'
  | 'medical'
  | 'insuranceHistory'
  | 'inflowSource'
  | 'referrerName'
  | 'isDriver'
  | 'carType'
  | 'carNumber'
  | 'carModel'
  | 'carYear'
  | 'renewalDate'

export type CustomerExcelColumnDef = {
  key: CustomerExcelColumnKey
  labelKo: string
  description: string
}

/** 샘플·신규 양식 기본 컬럼 순서 */
export const CUSTOMER_EXCEL_PRIMARY_COLUMNS: CustomerExcelColumnDef[] = [
  { key: 'name', labelKo: '이름', description: '필수. 고객 이름' },
  { key: 'phone', labelKo: '휴대폰', description: '010-1234-5678 또는 숫자만. 이름과 함께 연락처 또는 주민번호 중 하나는 필수' },
  {
    key: 'ssn',
    labelKo: '주민등록번호',
    description: '선택. 13자리(하이픈 가능). 연락처 없을 때 이름+주민번호로 등록 가능',
  },
  { key: 'birthDate', labelKo: '생년월일', description: 'YYYY-MM-DD 권장. 주민번호 없이 성별·생년월일만으로도 등록 가능' },
  {
    key: 'gender',
    labelKo: '성별',
    description: '남 / 여 / 남자 / 여자 / male / female / M / F 등 입력 가능',
  },
  { key: 'address', labelKo: '주소', description: '도로명·지번 주소' },
  { key: 'addressDetail', labelKo: '상세주소', description: '동·호수 등 (주소와 합쳐 저장)' },
  { key: 'job', labelKo: '직업', description: '직업 / 회사명' },
  { key: 'memo', labelKo: '메모', description: '"/" 로 구분 시 여러 메모 항목' },
  { key: 'businessRepresentativeName', labelKo: '대표자명', description: '사업자 정보 — 대표자명' },
  { key: 'businessNumber', labelKo: '사업자번호', description: '000-00-00000 형식 권장' },
  { key: 'businessAddress', labelKo: '사업장주소', description: '사업장 기본 주소' },
  { key: 'businessAddressDetail', labelKo: '사업장상세주소', description: '사업장 상세주소(기본 주소와 합쳐 저장)' },
  { key: 'businessMemo', labelKo: '사업자메모', description: '사업자 관련 메모' },
]

/** 하위 호환 — 기존 양식에만 있는 자동차·신체 등 (샘플 1행에는 미포함) */
export const CUSTOMER_EXCEL_LEGACY_OPTIONAL_COLUMNS: CustomerExcelColumnDef[] = [
  { key: 'carrier', labelKo: '통신사', description: '통신사(선택)' },
  { key: 'height', labelKo: '키', description: '키(cm 등)' },
  { key: 'weight', labelKo: '몸무게', description: '몸무게(kg 등)' },
  { key: 'medical', labelKo: '병력사항', description: '병력·건강 관련 메모' },
  { key: 'insuranceHistory', labelKo: '보험가입내역', description: 'notes.insuranceHistory' },
  { key: 'inflowSource', labelKo: '유입경로', description: '유입 경로 코드(폼과 동일)' },
  { key: 'referrerName', labelKo: '소개자', description: '소개자·이관 담당자 이름' },
  { key: 'isDriver', labelKo: '운전여부', description: 'TRUE / FALSE' },
  { key: 'carType', labelKo: '자동차종류', description: '운전 시 차종' },
  { key: 'carNumber', labelKo: '차번호', description: '차량번호' },
  { key: 'carModel', labelKo: '자동차모델명', description: '차명' },
  { key: 'carYear', labelKo: '년식', description: '연식' },
  { key: 'renewalDate', labelKo: '갱신일', description: 'YYYY-MM-DD' },
]

export const CUSTOMER_EXCEL_ALL_COLUMN_DEFS: CustomerExcelColumnDef[] = [
  ...CUSTOMER_EXCEL_PRIMARY_COLUMNS,
  ...CUSTOMER_EXCEL_LEGACY_OPTIONAL_COLUMNS,
]

export const CUSTOMER_EXCEL_UPLOAD_HEADERS = CUSTOMER_EXCEL_ALL_COLUMN_DEFS.map((c) => c.key)

export const CUSTOMER_EXCEL_SAMPLE_HEADERS = CUSTOMER_EXCEL_PRIMARY_COLUMNS.map((c) => c.key)

export const CUSTOMER_EXCEL_UPLOAD_HEADER_LABELS_KO = CUSTOMER_EXCEL_ALL_COLUMN_DEFS.map((c) => c.labelKo)

export const CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO = CUSTOMER_EXCEL_PRIMARY_COLUMNS.map((c) => c.labelKo)

export function buildHeaderLabelToKeyMap(): Record<string, CustomerExcelColumnKey> {
  const map: Record<string, CustomerExcelColumnKey> = {}
  for (const col of CUSTOMER_EXCEL_ALL_COLUMN_DEFS) {
    map[col.labelKo] = col.key
  }
  map['휴대폰번호'] = 'phone'
  map['주민번호'] = 'ssn'
  map['성별'] = 'gender'
  map['이름'] = 'name'
  return map
}
