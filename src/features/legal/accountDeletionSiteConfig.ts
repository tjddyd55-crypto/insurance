import { privacySiteConfig } from './privacySiteConfig'

/** Google Play · 앱스토어 계정 삭제 URL(/account-deletion) 공개 안내 페이지 설정 */
export const accountDeletionSiteConfig = {
  documentTitle: 'ONE FC 계정 삭제 요청 안내',
  metaDescription:
    'ONE FC 계정 및 관련 개인정보 삭제 요청 방법, 필요 정보, 삭제·보관 데이터, 처리 기간 및 담당자 연락처 안내입니다.',
  metaRobots: 'index, follow',
  serviceName: privacySiteConfig.serviceName,
  operatorLegalName: privacySiteConfig.operatorLegalName,
  representativeName: privacySiteConfig.representativeName,
  privacyOfficerName: privacySiteConfig.privacyOfficerName,
  privacyOfficerRole: privacySiteConfig.privacyOfficerRole,
  contactEmail: privacySiteConfig.privacyEmail,
  contactPhone: privacySiteConfig.privacyPhone,
  privacyPolicyPath: '/privacy',
  /** 삭제 요청 검토·처리 안내 (운영 정책) */
  reviewStartWithin: '접수 후 영업일 기준 7일 이내',
  completionWithin: '최대 30일 이내',
  lastRevisedDate: '2026년 6월 16일',
} as const
