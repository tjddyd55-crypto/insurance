/**
 * Facebook 랜딩 실사용 화면 캡처 SSOT.
 * 이미지 교체: `public/introduction/facebook/screenshots/` 만 갱신하고 이 배열의 src·dimensions를 맞춘다.
 */

export type FacebookLandingScreenshotPlatform = 'pc' | 'mobile' | 'both'

export type FacebookLandingScreenshot = {
  id: string
  title: string
  description: string
  src: string
  srcWebp?: string
  platform: FacebookLandingScreenshotPlatform
  order: number
  width: number
  height: number
}

const FB_SCREENSHOT_BASE = '/introduction/facebook/screenshots'

/** 운영 introduction 마케팅 자료(마스킹된 예시 데이터)에서 추출한 실 UI 캡처. */
export const FACEBOOK_LANDING_SCREENSHOTS: FacebookLandingScreenshot[] = [
  {
    id: 'customers',
    title: '고객정보',
    description: '고객별 기본정보와 필요한 업무 정보를 한 곳에서 확인',
    src: `${FB_SCREENSHOT_BASE}/customer-management.webp`,
    platform: 'pc',
    order: 1,
    width: 1440,
    height: 900,
  },
  {
    id: 'files',
    title: '파일보관',
    description: '고객별 문서와 자료를 따로 찾지 않고 한 곳에서 관리',
    src: `${FB_SCREENSHOT_BASE}/file-storage.webp`,
    platform: 'pc',
    order: 2,
    width: 1440,
    height: 900,
  },
  {
    id: 'schedule',
    title: '일정관리',
    description: '상담 요청·이력과 업무 진행 일정을 놓치지 않도록 관리',
    src: `${FB_SCREENSHOT_BASE}/schedule-management.webp`,
    platform: 'both',
    order: 3,
    width: 1440,
    height: 900,
  },
  {
    id: 'sms',
    title: '문자발송',
    description: '고객 개인메시지와 안내를 CRM 안에서 더 편리하게',
    src: `${FB_SCREENSHOT_BASE}/sms-management.webp`,
    platform: 'both',
    order: 4,
    width: 1440,
    height: 900,
  },
  {
    id: 'dashboard',
    title: 'PC 메인',
    description: '사무실 PC에서 보험업무를 한 화면에서 시작',
    src: `${FB_SCREENSHOT_BASE}/desktop-main.webp`,
    platform: 'pc',
    order: 5,
    width: 1440,
    height: 900,
  },
  {
    id: 'native',
    title: '모바일 앱',
    description: '외근 중에도 고객 정보와 업무를 앱에서 확인',
    src: `${FB_SCREENSHOT_BASE}/native-main.webp`,
    platform: 'mobile',
    order: 6,
    width: 390,
    height: 844,
  },
].sort((a, b) => a.order - b.order)
