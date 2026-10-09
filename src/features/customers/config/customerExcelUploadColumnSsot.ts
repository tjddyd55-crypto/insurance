/**
 * 고객 일괄등록 Excel — 컬럼 SSOT (다운로드 샘플 · 파서 · 실패/export 공통)
 * 보험 FC 고객정보 화면에서 POST/PUT /api/customers 로 저장되는 1:1 필드 + 연결키.
 */

export type CustomerExcelColumnKey =
  | 'importKey'
  | 'name'
  | 'phone'
  | 'ssn'
  | 'birthDate'
  | 'gender'
  | 'address'
  | 'addressDetail'
  | 'job'
  | 'height'
  | 'weight'
  | 'memo'
  | 'carrier'
  | 'smsOptOut'
  | 'inflowSource'
  | 'referrerName'
  | 'treatmentHistoryNote'
  | 'medicationHistoryNote'
  | 'medical'
  | 'insuranceHistory'
  | 'accountNumber'
  | 'businessRepresentativeName'
  | 'businessNumber'
  | 'businessAddress'
  | 'businessAddressDetail'
  | 'businessMemo'
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

/** 고객기본정보 시트 — 프로그램 1:1 입력 필드 전체 (자동차 다건은 「자동차」 시트) */
export const CUSTOMER_EXCEL_PRIMARY_COLUMNS: CustomerExcelColumnDef[] = [
  {
    key: 'importKey',
    labelKo: '고객번호',
    description: 'Excel 내부 연결용 (예: C001). 자동차·알림일 등과 연결. 비우면 자동 부여.',
  },
  { key: 'name', labelKo: '이름', description: '필수. 고객 이름' },
  { key: 'phone', labelKo: '휴대폰', description: '010-1234-5678. 이름과 함께 연락처 또는 주민번호 중 하나는 필수' },
  {
    key: 'ssn',
    labelKo: '주민등록번호',
    description: '선택. 13자리(하이픈 가능). 앞자리 0 유지 — 셀 서식은 텍스트 권장',
  },
  { key: 'birthDate', labelKo: '생년월일', description: 'YYYY-MM-DD. 주민번호 없이 성별+생년월일만으로 등록 가능' },
  {
    key: 'gender',
    labelKo: '성별',
    description: '남 / 여 (남자·여자·male·female·M·F 등도 인식)',
  },
  { key: 'address', labelKo: '주소', description: '도로명·지번 주소' },
  { key: 'addressDetail', labelKo: '상세주소', description: '동·호수 등' },
  { key: 'job', labelKo: '직업', description: '직업 / 회사명' },
  { key: 'height', labelKo: '키', description: '신체정보 — 키(cm 등)' },
  { key: 'weight', labelKo: '몸무게', description: '신체정보 — 몸무게(kg 등)' },
  { key: 'memo', labelKo: '메모', description: '"/" 로 구분 시 여러 메모 항목' },
  { key: 'carrier', labelKo: '통신사', description: '통신사(선택)' },
  { key: 'smsOptOut', labelKo: '문자수신거부', description: 'Y / N 또는 TRUE / FALSE' },
  { key: 'inflowSource', labelKo: '유입경로', description: '고객 등록 화면과 동일 코드' },
  { key: 'referrerName', labelKo: '소개자', description: '소개자·이관 담당자' },
  {
    key: 'treatmentHistoryNote',
    labelKo: '수술치료병력',
    description: '5년 이내 수술·치료·입원 등 (고객 상세 병력 — 수술/치료 칸)',
  },
  {
    key: 'medicationHistoryNote',
    labelKo: '약복용병력',
    description: '약 복용 관련 (고객 상세 병력 — 약복용 칸)',
  },
  { key: 'medical', labelKo: '병력사항(레거시)', description: '단일 병력 열 — 비우고 위 두 칸 사용 권장' },
  { key: 'insuranceHistory', labelKo: '보험가입내역', description: '보험 가입·계약 메모' },
  { key: 'accountNumber', labelKo: '계좌번호', description: 'notes.accountNumber' },
  { key: 'businessRepresentativeName', labelKo: '대표자명', description: '사업자 — 대표자명' },
  { key: 'businessNumber', labelKo: '사업자번호', description: '000-00-00000, 텍스트 서식 권장' },
  { key: 'businessAddress', labelKo: '사업장주소', description: '사업장 기본 주소' },
  { key: 'businessAddressDetail', labelKo: '사업장상세주소', description: '사업장 상세' },
  { key: 'businessMemo', labelKo: '사업자메모', description: '사업자 메모' },
  { key: 'isDriver', labelKo: '운전여부', description: 'Y / N 또는 TRUE / FALSE' },
]

/** 단일 시트 구 양식 — 기본정보 시트에 자동차 1대만 넣는 경우 */
export const CUSTOMER_EXCEL_LEGACY_INLINE_CAR_COLUMNS: CustomerExcelColumnDef[] = [
  { key: 'carType', labelKo: '자동차종류', description: '운전 시 차종 (단일 시트 양식)' },
  { key: 'carNumber', labelKo: '차번호', description: '차량번호 (단일 시트)' },
  { key: 'carModel', labelKo: '자동차모델명', description: '차명 (단일 시트)' },
  { key: 'carYear', labelKo: '년식', description: '연식 (단일 시트)' },
  { key: 'renewalDate', labelKo: '갱신일', description: 'YYYY-MM-DD (단일 시트)' },
]

/** @deprecated — PRIMARY에 통합됨. 파서 호환용 alias */
export const CUSTOMER_EXCEL_LEGACY_OPTIONAL_COLUMNS: CustomerExcelColumnDef[] = [
  ...CUSTOMER_EXCEL_PRIMARY_COLUMNS.filter((c) =>
    ['carrier', 'height', 'weight', 'medical', 'insuranceHistory', 'inflowSource', 'referrerName', 'isDriver'].includes(
      c.key,
    ),
  ),
  ...CUSTOMER_EXCEL_LEGACY_INLINE_CAR_COLUMNS,
]

export const CUSTOMER_EXCEL_FULL_BASIC_COLUMNS: CustomerExcelColumnDef[] = [
  ...CUSTOMER_EXCEL_PRIMARY_COLUMNS,
]

export const CUSTOMER_EXCEL_ALL_COLUMN_DEFS: CustomerExcelColumnDef[] = [
  ...CUSTOMER_EXCEL_PRIMARY_COLUMNS,
  ...CUSTOMER_EXCEL_LEGACY_INLINE_CAR_COLUMNS,
]

export const CUSTOMER_EXCEL_UPLOAD_HEADERS = CUSTOMER_EXCEL_ALL_COLUMN_DEFS.map((c) => c.key)

export const CUSTOMER_EXCEL_SAMPLE_HEADERS = CUSTOMER_EXCEL_FULL_BASIC_COLUMNS.map((c) => c.key)

export const CUSTOMER_EXCEL_UPLOAD_HEADER_LABELS_KO = CUSTOMER_EXCEL_ALL_COLUMN_DEFS.map((c) => c.labelKo)

export const CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO = CUSTOMER_EXCEL_FULL_BASIC_COLUMNS.map((c) => c.labelKo)

export function buildHeaderLabelToKeyMap(): Record<string, CustomerExcelColumnKey> {
  const map: Record<string, CustomerExcelColumnKey> = {}
  for (const col of CUSTOMER_EXCEL_ALL_COLUMN_DEFS) {
    map[col.labelKo] = col.key
  }
  map['휴대폰번호'] = 'phone'
  map['주민번호'] = 'ssn'
  map['성별'] = 'gender'
  map['이름'] = 'name'
  map['고객번호'] = 'importKey'
  map['수술·치료 관련'] = 'treatmentHistoryNote'
  map['약복용 관련'] = 'medicationHistoryNote'
  map['계좌번호'] = 'accountNumber'
  map['문자 수신거부'] = 'smsOptOut'
  return map
}
