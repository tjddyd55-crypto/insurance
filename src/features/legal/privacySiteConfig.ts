import { businessInfo } from '../../config/businessInfo.config'

/**
 * 스토어 심사·고지용 개인정보처리방침에서 바꿀 값만 모았습니다.
 * 사업자·담당자 식별 정보는 businessInfo.config.ts 를 단일 진실 원천으로 사용합니다.
 */
export const privacySiteConfig = {
  /** 브라우저 탭 제목 */
  documentTitle: 'ONE FC 개인정보처리방침',
  /** 검색·미리보기용 (120자 내 권장) */
  metaDescription:
    'ONE FC의 개인정보 수집·이용, 보관, 파기 및 정보주체 권리 안내입니다.',
  metaRobots: 'index, follow',
  /** 서비스·앱 명칭 (문서 내 표기) */
  serviceName: 'ONE FC',
  /** 법적 운영자 상호(예: 회사명) */
  operatorLegalName: businessInfo.businessName,
  /** 대표자 성명 (필요 시 문서에 반영) */
  representativeName: businessInfo.representativeName,
  /** 사업자등록번호 (선택, 공개 정책에 따라 기입) */
  businessRegistrationNumber: businessInfo.businessRegistrationNumber,
  /** 주소 */
  address: businessInfo.businessAddress,
  /** 개인정보 보호책임자 성명 */
  privacyOfficerName: businessInfo.privacyOfficerName,
  /** 소속/직책 */
  privacyOfficerRole: '개인정보 보호책임자',
  /** 문의 이메일 — mailto 링크에 사용 */
  privacyEmail: businessInfo.businessEmail,
  /** 문의 전화 (선택) */
  privacyPhone: businessInfo.privacyOfficerPhone,
  /** 방침 시행일 */
  effectiveDate: '2026년 4월 1일',
  /** 최종 개정일 (시행일과 같을 수 있음) */
  lastRevisedDate: '2026년 7월 13일',
} as const
