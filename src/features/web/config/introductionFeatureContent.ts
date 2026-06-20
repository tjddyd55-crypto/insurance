export const INTRO_SERVICE_INQUIRY_HREF = 'tel:01022221382'
export const INTRO_SERVICE_INQUIRY_ARIA_LABEL = '010-2222-1382로 전화 문의하기'
export const INTRO_SERVICE_INQUIRY_TITLE = '010-2222-1382로 전화 문의'

export const introMainHighlights = [
  '고객 통합 관리',
  '상담 & 소통',
  '파일 & 문서관리',
  '청구 & 보상관리',
  '지도 & 지역관리',
  '고객앱 연동',
] as const

export const introCustomerCapabilities = [
  {
    title: '고객 정보관리',
    description: '고객 기본정보와 보험 관련 정보를 한눈에 확인하고 관리할 수 있습니다.',
  },
  {
    title: '고객 개인 파일관리',
    description: '고객별 파일을 폴더별로 정리하고 필요한 자료를 빠르게 확인할 수 있습니다.',
  },
  {
    title: '고객 상담 관리',
    description: '상담 내용과 요청사항을 기록하여 담당자 간 공유가 가능합니다.',
  },
  {
    title: '고객 청구관리',
    description: '청구 요청, 첨부파일, 진행 상태를 체계적으로 관리할 수 있습니다.',
  },
  {
    title: '고객 지역 지도리스트',
    description: '고객 위치를 지도에서 확인하고 지역별 관리에 활용할 수 있습니다.',
  },
] as const

export const introSupportCapabilities = [
  {
    title: '소식지 공유',
    description: '원수사, 손해사정사, 업무 안내 자료를 한 곳에서 공유할 수 있습니다.',
  },
  {
    title: '팀장 전용 팀관리',
    description: '팀원 현황과 업무 진행 상태를 확인하고 관리할 수 있습니다.',
  },
  {
    title: '신청서 PDF 자동화',
    description: '자주 사용하는 신청서를 PDF 문서로 작성하고 업무 시간을 줄일 수 있습니다.',
  },
  {
    title: '고객앱 소통',
    description: '개인메시지, 청구문의, 고객 안내를 고객앱에서 주고받을 수 있습니다.',
  },
] as const

export const introFeatureImages = {
  overview: {
    src: '/introduction/features/insurance-crm-overview.png',
    alt: '보험 CRM 전체 기능 소개',
  },
  customer: {
    src: '/introduction/features/insurance-crm-customer-features.png',
    alt: '고객관리와 청구관리 기능 소개',
  },
  support: {
    src: '/introduction/features/insurance-crm-support-features.png',
    alt: '소식지 팀관리 신청서 고객앱 소통 기능 소개',
  },
} as const

export const introPrivacyNote =
  '※ 화면 내 개인정보는 예시 데이터로 마스킹 처리되었습니다.'
