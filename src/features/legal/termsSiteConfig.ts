import { businessInfo } from '../../config/businessInfo.config'

/** 이용약관 공개 페이지 메타·표기 설정 */
export const termsSiteConfig = {
  documentTitle: 'ONE FC 이용약관',
  metaDescription: `${businessInfo.businessName}이 제공하는 ONE FC 서비스 이용에 관한 안내입니다.`,
  metaRobots: 'index, follow',
  serviceName: 'ONE FC',
  operatorLegalName: businessInfo.businessName,
  /** 현재 판의 시행일 (제12조에 따라 개정 공지일로부터 7일 이후) */
  effectiveDate: '2026년 10월 9일',
  /** 최종 개정일 = 개정 공지일 */
  lastRevisedDate: '2026년 10월 2일',
  /** 시행일 전까지 적용되는 종전 약관의 시행일 */
  previousEffectiveDate: '2026년 7월 13일',
} as const
