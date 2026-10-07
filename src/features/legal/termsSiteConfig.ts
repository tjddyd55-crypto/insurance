import { businessInfo } from '../../config/businessInfo.config'

/** 이용약관 공개 페이지 메타·표기 설정 */
export const termsSiteConfig = {
  documentTitle: 'ONE FC 이용약관',
  metaDescription: `${businessInfo.businessName}이 제공하는 ONE FC 서비스 이용에 관한 안내입니다.`,
  metaRobots: 'index, follow',
  serviceName: 'ONE FC',
  operatorLegalName: businessInfo.businessName,
  effectiveDate: '2026년 7월 13일',
  lastRevisedDate: '2026년 7월 13일',
} as const
