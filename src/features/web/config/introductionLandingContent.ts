import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../constants/appInstallLinks'
import { businessInfo, formatPhoneForTelLink } from '../../../config/businessInfo.config'

export const INTRO_TEL_HREF = `tel:${formatPhoneForTelLink(businessInfo.customerServicePhone)}`
export const INTRO_PHONE_DISPLAY = businessInfo.customerServicePhone

export const INTRO_NAV_ITEMS = [
  { id: 'overview', label: 'ONE FC' },
  { id: 'fc', label: 'FC' },
  { id: 'branch', label: '지점' },
  { id: 'insurer', label: '원수사' },
  { id: 'customer', label: '고객앱' },
  { id: 'solution', label: '주요 기능' },
  { id: 'download', label: '다운로드' },
] as const

export const INTRO_SECTION_IDS = [
  'overview',
  'problem',
  'integration',
  'fc',
  'branch',
  'insurer',
  'customer',
  'structure',
  'comparison',
  'solution',
  'sync',
  'download',
  'start',
  'contact',
] as const

export type IntroSectionId = (typeof INTRO_SECTION_IDS)[number]

export const INTRO_HERO = {
  eyebrow: '보험업무 통합 플랫폼',
  title: '보험업무에 필요한\n모든 기능을 하나로',
  body: '고객관리부터 문자, 메모, 청구, 지점 공지와 원수사 소식까지. 여러 프로그램을 오가던 복잡한 업무를 ONE FC 하나로 통합하세요.',
  primaryCta: 'ONE FC 설치하기',
  secondaryCta: '주요 기능 살펴보기',
  helperStrong: '사용할 기기에 맞는 ONE FC를 설치하세요.',
  helperSub: '회원가입은 설치한 앱 또는 PC 프로그램에서 진행됩니다.',
  helperCombined:
    'Android 앱, iPhone 앱 또는 PC 프로그램을 설치한 뒤 프로그램 안에서 회원가입하고 이용할 수 있습니다.',
  diagramSources: ['고객관리', '문자', '메모', '청구', '지점 공지', '원수사 소식'] as const,
} as const

export const INTRO_PROBLEM = {
  eyebrow: 'PROBLEM',
  title: '보험업무, 아직도 여러 프로그램을 오가고 있나요?',
  body: '도구가 늘어날수록 정보는 흩어지고, 같은 일을 반복하게 됩니다.',
  tools: [
    '엑셀 고객관리',
    '문자 발송 사이트',
    '메모 프로그램',
    '카카오톡',
    '밴드',
    '이메일과 파일',
    '원수사별 소통방',
    '사무실 PC 저장',
  ] as const,
  results: [
    '정보 분산',
    '반복 작업',
    '자료 누락',
    '외부 확인 어려움',
    '개인 PC 종속',
    '이전 자료 검색 어려움',
  ] as const,
} as const

export const INTRO_INTEGRATION = {
  eyebrow: 'INTEGRATION',
  title: 'ONE FC가 업무와 사람을 연결합니다',
  body: '흩어져 있던 업무를 한곳으로 모으고, FC·지점·원수사·고객이 같은 흐름 안에서 움직입니다.',
  works: [
    '고객관리',
    '상담 및 메모',
    '문자와 알림',
    '보험금 청구',
    '고객 요청',
    '계정관리',
    '지점 공지',
    '원수사 소식',
    '파일과 자료',
  ] as const,
  participants: [
    { title: 'FC', desc: '고객관리 · 문자 · 메모' },
    { title: 'GA·지점', desc: '공지 · 자료 · 운영' },
    { title: '원수사 담당자', desc: '시책 · 상품 · 공지' },
    { title: '고객', desc: '요청 · 첨부 · 확인' },
  ] as const,
} as const

export const INTRO_FC = {
  eyebrow: 'FOR FC',
  title: 'FC는 고객에게만 집중하세요',
  body: '고객을 선택하면 기본정보부터 상담, 메모, 계약, 문자, 청구 요청과 파일까지 한곳에서 확인할 수 있습니다.',
  features: [
    '고객정보 통합관리',
    '상담 및 메모',
    '보험계약 관리',
    '개인·단체·자동문자',
    '보험금 청구 요청',
    '고객별 파일',
    '보험회사 계정관리',
    '카드 수납 관리',
    'PC·모바일 확인',
  ] as const,
  highlight: '엑셀을 열고, 문자 사이트에 접속하고, 다시 메모 프로그램을 실행할 필요가 없습니다.',
} as const

export const INTRO_BRANCH = {
  eyebrow: 'FOR BRANCH',
  title: '지점의 공지와 자료를 하나의 공간에',
  before: [
    '카카오톡 단체방',
    '밴드',
    '개별 파일 전달',
    '신규 FC에게 반복 전달',
    '과거 자료 검색 어려움',
  ] as const,
  after: [
    '지점 공지',
    '업무자료',
    '교육자료',
    '운영 안내',
    '소속 FC 공유',
    '지속적인 자료 보관',
  ] as const,
  highlight: '대화 속에 묻히는 자료가 아니라 지점의 업무 자산으로 축적합니다.',
} as const

export const INTRO_INSURER = {
  eyebrow: 'INSURER NEWS',
  title: '원수사별 시책과 상품 소식을 한곳에서',
  flow: ['원수사 담당자', 'ONE FC 소식지', 'GA·지점', '소속 FC'] as const,
  uses: [
    '시책 안내',
    '신상품 소식',
    '가입 및 심사 기준',
    '업무 공지',
    '교육자료',
    '프로모션',
    '담당자 안내',
  ] as const,
  note: '소식지는 담당자가 등록한 공용 안내를 소속 FC가 확인하는 구조입니다.',
} as const

export const INTRO_CUSTOMER = {
  eyebrow: 'CUSTOMER APP',
  title: '고객의 요청도 담당 FC에게 바로 연결됩니다',
  steps: [
    '고객이 청구 또는 문의 등록',
    '사진과 파일 첨부',
    '담당 FC 업무 화면에 요청 연결',
    'FC가 고객별 요청 확인',
    '업무 처리 기록 보존',
  ] as const,
  note: '고객이 등록한 요청을 담당 FC가 ONE FC에서 확인할 수 있습니다.',
} as const

export const INTRO_STRUCTURE = {
  eyebrow: 'STRUCTURE',
  title: '전체 연결 구조',
  body: '원수사·지점·FC·고객이 ONE FC를 중심으로 연결됩니다.',
} as const

export const INTRO_COMPARISON = {
  eyebrow: 'COMPARISON',
  title: '기존 방식과 ONE FC 비교',
  rows: [
    { before: '엑셀 고객정보', after: '온라인 통합관리' },
    { before: '문자 사이트', after: '고객 화면에서 문자' },
    { before: '별도 메모', after: '고객별 상담·메모' },
    { before: '카카오톡 청구자료', after: '고객앱 청구자료' },
    { before: '밴드·단체방 공지', after: '지점 자료 보관' },
    { before: '원수사별 채팅방', after: '원수사 소식지' },
    { before: '사무실 PC만', after: 'PC·모바일' },
    { before: '개인 자료', after: '조직 업무자산' },
  ] as const,
} as const

export const INTRO_SOLUTION = {
  eyebrow: 'SOLUTION',
  title: '주요 기능 요약',
  groups: [
    {
      title: '고객관리',
      items: ['고객 정보', '상담·메모', '계약', '파일', '지도'],
    },
    {
      title: '소통',
      items: ['개인문자', '단체문자', '자동문자', '고객앱 요청'],
    },
    {
      title: '청구',
      items: ['청구 요청', '첨부파일', '진행 확인'],
    },
    {
      title: '지점·소식',
      items: ['지점 공지', '업무자료', '원수사 소식지'],
    },
    {
      title: '업무 편의',
      items: ['보험사 계정', '신청서 PDF', '카드 수납'],
    },
    {
      title: '멀티 디바이스',
      items: ['PC 프로그램', 'Android 앱', 'iPhone 앱'],
    },
  ] as const,
} as const

export const INTRO_SYNC = {
  eyebrow: 'SYNC',
  title: 'PC와 모바일에서 같은 계정으로',
  body: 'PC와 모바일은 같은 ONE FC 계정으로 이용할 수 있습니다.',
  devices: [
    { title: 'PC 프로그램 · 웹', desc: '고객관리 · 문자 · 자료 정리' },
    { title: '모바일 앱', desc: '고객정보 · 요청 확인 · 알림' },
  ] as const,
} as const

export const INTRO_DOWNLOAD = {
  eyebrow: 'DOWNLOAD',
  title: 'ONE FC를 설치하고 시작하세요',
  body: '사용할 기기에 맞는 ONE FC를 설치한 뒤 프로그램에서 회원가입하면 이용할 수 있습니다.',
  stepsTitle: 'ONE FC 이용 방법',
  steps: [
    {
      num: '1',
      title: '사용할 기기 선택',
      desc: 'Android · iPhone · PC 중 업무에 사용할 환경을 고릅니다.',
    },
    {
      num: '2',
      title: '앱 또는 PC 프로그램 설치',
      desc: '아래 다운로드 카드에서 스토어 또는 설치 파일로 이동합니다.',
    },
    {
      num: '3',
      title: '프로그램에서 회원가입 후 이용',
      desc: '설치한 ONE FC를 실행해 회원가입하면 바로 사용할 수 있습니다.',
    },
  ] as const,
  accountNote: 'PC와 모바일은 같은 ONE FC 계정으로 이용할 수 있습니다.',
  cards: [
    {
      id: 'android',
      eyebrow: 'ANDROID',
      title: 'Android 앱',
      desc: '안드로이드 휴대폰에서 ONE FC를 설치하고 이용하세요.',
      button: 'Android 앱 설치',
      note: '앱 설치 후 회원가입',
      href: ANDROID_APP_DOWNLOAD_URL,
      external: true,
    },
    {
      id: 'iphone',
      eyebrow: 'IPHONE',
      title: 'iPhone 앱',
      desc: '아이폰에서 ONE FC를 설치하고 이용하세요.',
      button: 'iPhone 앱 설치',
      note: '앱 설치 후 회원가입',
      href: ONE_FC_APP_STORE_URL,
      external: true,
    },
    {
      id: 'pc',
      eyebrow: 'PC',
      title: 'PC 프로그램',
      desc: '사무실 PC에서 ONE FC를 설치하고 업무를 시작하세요.',
      button: 'PC 프로그램 다운로드',
      note: '프로그램 설치 후 회원가입',
      href: DESKTOP_DOWNLOAD_URL,
      external: false,
      download: true,
    },
  ] as const,
} as const

export const INTRO_FINAL = {
  title: '이제 ONE FC 하나로 보험업무를 시작하세요',
  body: '사용할 기기에 맞는 앱 또는 PC 프로그램을 설치하고, 프로그램 안에서 회원가입해 이용할 수 있습니다.',
  primaryCta: 'ONE FC 설치하기',
  secondaryCta: '도입 문의하기',
} as const

export const INTRO_CONTACT = {
  eyebrow: 'CONTACT',
  title: '도입과 이용이 궁금하신가요?',
  body: 'GA·지점 도입, 기능, 비용 또는 설치 방법이 궁금하시면 문의를 남겨 주세요.',
  phoneTitle: '전화 문의',
  phoneHours: '평일 09:00~18:00 · 상담 가능 시간을 남겨 주시면 맞춰 연락드립니다.',
  topicsTitle: '이런 문의를 도와드려요',
  topics: [
    'GA·지점 단체 도입 상담',
    '이용요금 문의',
    '기능 문의',
    '설치 지원',
    '원수사 소식지 운영 문의',
  ] as const,
  selfServeTitle: '바로 이용하실 분은 문의 없이 ONE FC를 설치할 수 있습니다.',
  selfServeLink: '설치하기',
  formTitle: '온라인 문의',
} as const

export const INTRO_INQUIRY_TYPES = [
  { value: 'FC_PERSONAL', label: 'FC 개인 이용 문의' },
  { value: 'BRANCH_ADOPTION', label: 'GA·지점 도입 문의' },
  { value: 'INSURER_NEWS', label: '원수사 소식지 문의' },
  { value: 'CUSTOMER_APP', label: '고객앱 문의' },
  { value: 'PRICING', label: '이용요금 문의' },
  { value: 'FEATURE', label: '기능 문의' },
  { value: 'INSTALL', label: '설치 문의' },
  { value: 'OTHER', label: '기타 문의' },
] as const

export const INTRO_CONTACT_TIMES = [
  { value: 'MORNING', label: '오전' },
  { value: 'AFTERNOON', label: '오후' },
  { value: 'EVENING', label: '저녁' },
  { value: 'ANYTIME', label: '상관없음' },
] as const

export type IntroInquiryType = (typeof INTRO_INQUIRY_TYPES)[number]['value']
export type IntroContactTime = (typeof INTRO_CONTACT_TIMES)[number]['value']
