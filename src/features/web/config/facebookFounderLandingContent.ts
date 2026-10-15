/** 현직 FC 메시지형 Facebook 랜딩 (`/facebook`) 카피 SSOT */

import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../constants/appInstallLinks'
import { INTRO_PHONE_DISPLAY, INTRO_TEL_HREF } from './introductionLandingContent'

export const FF_PATH = '/facebook' as const

export const FF_HERO = {
  eyebrow: '현직 FC가 직접 만들었습니다.',
  headline: '보험설계사 업무,\n정말 편하게 만들고 싶었습니다.',
  updateLine: '현직에서 직접 사용하면서 계속 업데이트하고 있습니다.',
  promoLabel: '3개월 무료쿠폰 제공',
  installCta: 'ONE FC 설치하기',
} as const

export const FF_MADE = {
  title: '제가 직접 쓰려고 만든 프로그램입니다.',
  paragraphs: [
    '보험설계사 일을 하다 보면 고객정보는 여기, 파일은 저기, 일정은 또 다른 곳, 문자는 또 따로 관리하게 됩니다.',
    '저도 현장에서 똑같은 불편을 계속 겪었습니다.',
    '그래서 정말 제가 업무할 때 편하게 쓰기 위해 ONE FC를 만들기 시작했습니다.',
    '업무를 하다가 필요하다고 느끼는 부분은 계속 추가하고 개선하고 있습니다.',
  ],
  emphasis: 'ONE FC는 제가 실제 업무에서 매일 사용하기 위해 만든 CRM입니다.',
} as const

export const FF_POSITION = {
  title: 'FC 업무의 가장 기본이 되는 베이스를 만들었습니다.',
  paragraphs: [
    '보험설계사를 위한 좋은 프로그램들은 이미 많이 있습니다.',
    '고객에게 카드뉴스나 콘텐츠를 보내거나, 카카오톡이나 메시지를 발송하거나, 보험금 청구를 돕거나, 보장분석을 하는 등 각각 특정 기능에 집중된 프로그램들도 많습니다.',
    '그런 기능들도 모두 중요합니다.',
    '하지만 제가 실제 현장에서 일하면서 느낀 것은 그보다 더 기본이 되는 사무업무가 편해야 전체 업무가 편해진다는 것이었습니다.',
  ],
  emphasis:
    'ONE FC는 FC가 하루 업무를 시작해서 끝낼 때까지 반복적으로 사용하는 기본 사무업무를 한 곳에서 관리하는 데 집중했습니다.',
} as const

export const FF_BASE_FEATURES = {
  title: '고객정보부터 파일, 일정, 상담, 문자, 청구까지',
  subtitle: 'FC 업무의 기본 베이스를 ONE FC에 담았습니다.',
  items: [
    { id: 'customers', title: '고객관리', description: '고객정보와 필요한 업무 정보를 한 곳에서' },
    { id: 'files', title: '파일관리', description: '고객별 자료와 문서를 찾기 쉽게' },
    { id: 'schedule', title: '일정관리', description: '상담·약속·업무 일정을 한 곳에서' },
    { id: 'consult', title: '상담관리', description: '고객과의 상담 내용을 계속 이어서 확인' },
    { id: 'sms', title: '문자발송', description: '고객 안내와 연락을 CRM에서 바로' },
    { id: 'claims', title: '청구관리', description: '보험청구 관련 업무도 고객과 연결해서 관리' },
    { id: 'mobile', title: '모바일', description: '밖에서도 필요한 고객정보를 바로 확인' },
  ],
} as const

export const FF_TOGETHER = {
  title: 'ONE FC 하나만 쓰라는 이야기가 아닙니다.',
  paragraphs: [
    '보장분석에 강한 프로그램이 필요하다면 함께 사용하면 됩니다.',
    '카드뉴스나 콘텐츠 발송에 특화된 서비스가 필요하다면 그 서비스도 같이 사용하면 됩니다.',
    '카카오톡이나 다른 전문 기능이 필요하다면 그 기능에 강한 서비스를 같이 사용해도 됩니다.',
  ],
  headline: '기본 업무는 ONE FC,\n전문 기능은 필요한 프로그램과 함께.',
  closing: [
    'ONE FC는 모든 프로그램을 대체하려고 만든 서비스가 아닙니다.',
    'ONE FC를 FC 업무의 기본 베이스로 두고, 각자 필요한 전문 프로그램을 함께 사용하면 오히려 업무 효율이 더 좋아질 수 있다고 생각합니다.',
  ],
  emphasis: 'ONE FC가 기본 업무의 중심을 잡아주고, 다른 전문 프로그램이 필요한 기능을 더해줍니다.',
  tagline: 'FC 업무의 중심을 잡아주는 CRM',
  brand: 'ONE FC',
} as const

export const FF_SCREENSHOTS = {
  title: '실제 ONE FC 사용 화면',
  body: '말로만 설명하지 않고 실제 사용 화면을 보여드립니다.',
  privacyNote: '※ 화면 내 개인정보는 예시 데이터로 마스킹 처리되었습니다.',
  shotCopy: {
    customers: { title: '고객관리', description: '고객정보를 한 곳에서' },
    files: { title: '파일보관', description: '고객별 자료를 빠르게' },
    schedule: { title: '일정관리', description: '상담과 업무 일정을 한눈에' },
    dashboard: { title: 'PC 화면', description: 'PC에서 업무를 한 화면에서' },
    sms: { title: '문자발송', description: '고객 안내를 CRM에서 바로' },
  },
} as const

export const FF_MOBILE = {
  title: '모바일에서도 고객정보를 바로 확인',
  body: '외근 중에도 고객 기본정보와 필요한 업무 정보를 한 화면에서 확인할 수 있습니다.',
} as const

/** `/facebook` 전용 모바일 실화면 (introduction/facebook asset과 분리) */
export const FF_MOBILE_SCREENSHOT = {
  src: '/facebook/screenshots/customer-mobile-detail.webp',
  width: 1041,
  height: 5699,
} as const

/** 현직 FC·지속 개선 — 후반 1문장만 */
export const FF_CONTINUOUS = {
  line: '지금도 현장에서 직접 사용하면서 필요한 기능을 계속 개선하고 있습니다.',
} as const

export const FF_PROMO = {
  lead: '처음부터 결제하지 않으셔도 됩니다.',
  title: '딱 3개월만 제대로 사용해보세요.',
  paragraphs: [
    '3개월 동안 실제 업무에 충분히 사용해보고',
    'ONE FC가 나에게 필요한 프로그램인지 직접 판단해 주세요.',
  ],
  promoBadge: '3개월 무료쿠폰 제공',
  copyLabel: '쿠폰코드 복사',
  hint: '회원가입 후 이용권 화면에서 위 코드를 입력해 주세요.',
} as const

export const FF_PHONE_ONBOARD = {
  title: '설치하셨다면 ONE FC를 켜놓고 꼭 한번 전화 주세요.',
  paragraphs: [
    'ONE FC에는 고객관리, 파일, 일정, 상담, 문자, 청구 등 실제 업무에 필요한 기능이 많이 들어 있습니다.',
    '그냥 혼자 둘러보는 것보다 처음 한번 설명을 듣고 사용하면 훨씬 빠르게 익힐 수 있습니다.',
  ],
  emphasis:
    '프로그램을 켜놓고 전화 주시면 실제 화면을 같이 보면서 기능과 활용 방법을 설명드리겠습니다.',
  phoneCta: 'ONE FC 켜고 전화하기',
} as const

export const FF_FINAL = {
  title: '보험설계사 업무,\n이제 ONE FC를 기본으로 시작해보세요.',
  pcCta: 'PC 설치하기',
  androidCta: 'Android 설치하기',
  iphoneCta: 'iPhone 설치하기',
  phoneCta: 'ONE FC 켜고 전화하기',
} as const

export const FF_CTA_LINKS = {
  pc: DESKTOP_DOWNLOAD_URL,
  android: ANDROID_APP_DOWNLOAD_URL,
  iphone: ONE_FC_APP_STORE_URL,
} as const

export const FF_CONTACT = {
  telHref: INTRO_TEL_HREF,
  phoneDisplay: INTRO_PHONE_DISPLAY,
} as const

export const FF_STICKY = {
  label: '3개월 무료',
  install: '설치하기',
} as const

/** 하단 PC·Android·iPhone 설치 선택 영역 (Hero·스티키 CTA 스크롤 대상) */
export const FF_INSTALL_SECTION_ID = 'ff-install' as const
