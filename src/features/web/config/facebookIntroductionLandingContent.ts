/** Facebook 광고 랜딩(`/introduction/facebook`) 카피 SSOT */

export const FB_HERO = {
  headline: '고객관리 아직도 여러 곳에서 하시나요?',
  headlineAccent: '여러 곳에서 하시나요?',
  subline: '고객정보 · 파일보관 · 일정관리 · 문자발송을 ONE FC 하나로',
  trustLine: '현직 FC가 직접 개발한 보험설계사 맞춤 CRM',
  promoBadge: '3개월 무료쿠폰 제공',
  brand: 'ONE FC CRM',
  adImageSrc: '/introduction/facebook/hero-ad.jpg',
  adImageAlt:
    '고객관리 아직도 여러 곳에서 하시나요? 고객정보·파일보관·일정관리·문자발송을 ONE FC 하나로. 현직 FC가 직접 개발한 보험설계사 맞춤 CRM. 3개월 무료쿠폰 제공.',
  belowAdLead: '보험설계사 업무를 ONE FC 하나로 관리하세요.',
} as const

export const FB_SCREENSHOTS_SECTION = {
  title: '실제 사용 화면을 확인해보세요',
  body: 'ONE FC는 실제 보험설계사 업무에서 바로 사용할 수 있도록 구성되어 있습니다.',
  privacyNote: '※ 화면 내 개인정보는 예시 데이터로 마스킹 처리되었습니다.',
} as const

export const FB_FEATURES_SECTION = {
  title: '흩어져 있던 업무를 ONE FC 하나로',
  items: [
    { id: 'customers', icon: '👤', title: '고객정보', description: '고객별 정보를 한 곳에서 관리' },
    { id: 'files', icon: '📁', title: '파일보관', description: '고객 자료와 문서를 고객별로 정리' },
    { id: 'schedule', icon: '📅', title: '일정관리', description: '상담 및 업무 일정을 체계적으로 관리' },
    { id: 'sms', icon: '💬', title: '문자발송', description: '고객 안내와 소통을 더 간편하게' },
  ] as const,
} as const

export const FB_PROBLEM_SECTION = {
  title: '이런 방식으로 관리하고 계신가요?',
  items: [
    '고객정보는 Excel',
    '상담 내용은 카톡/메모',
    '파일은 PC 폴더',
    '일정은 캘린더 또는 수기 메모',
    '고객 안내는 별도 문자 프로그램',
  ] as const,
  solution: '여러 곳에 흩어진 업무를 ONE FC 하나로 관리하세요.',
} as const

export const FB_FC_SECTION = {
  title: '현직 FC가 직접 개발했습니다',
  paragraphs: [
    'ONE FC는 실제 보험설계사 업무를 하면서 느낀 불편함을 바탕으로 개발한 CRM입니다.',
    '현장에서 필요한 기능과 반복적으로 불편했던 업무를 하나씩 개선하는 방향으로 계속 발전하고 있습니다.',
  ] as const,
  keywords: ['현직 FC', '실제 업무 경험', '보험설계사 맞춤', '현장 중심 개선'] as const,
} as const

export const FB_PROMO_SECTION = {
  title: '지금 가입하면 3개월 무료쿠폰 제공',
  hint:
    '회원가입 후 ONE FC 첫 화면의 이용권·결제 화면에서 프로모션 코드를 입력해 주세요.',
  detail:
    '회원가입 후 ONE FC 첫 화면의 이용권/결제 화면에서 CJAGG46X를 입력하면 3개월 무료 이용이 적용됩니다.',
  copyLabel: '코드 복사',
} as const

export const FB_FINAL_SECTION = {
  title: '고객관리를 ONE FC 하나로 시작하세요',
  trustLine: '현직 FC가 직접 개발한 보험설계사 맞춤 CRM',
  promoBadge: '3개월 무료쿠폰 제공',
} as const

export const FB_CTA = {
  pcStart: 'PC에서 시작하기',
  android: 'Android 다운로드',
  iphone: 'iPhone 다운로드',
  freeStart: '3개월 무료로 시작하기',
  viewPromo: '3개월 무료 혜택 보기',
} as const

export const FB_NAV_ITEMS = [
  { id: 'fb-screenshots', label: '화면' },
  { id: 'fb-features', label: '기능' },
  { id: 'fb-fc', label: '현직 FC' },
  { id: 'fb-promo-mid', label: '무료 혜택' },
  { id: 'fb-download', label: '설치' },
] as const

export const FB_SECTION_IDS = [
  'fb-hero',
  'fb-screenshots',
  'fb-features',
  'fb-problem',
  'fb-fc',
  'fb-promo-mid',
  'fb-download',
  'fb-final',
] as const

export type FacebookIntroSectionId = (typeof FB_SECTION_IDS)[number]
