import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
vi.mock('./useLegalPageNavigation', () => ({
  useLegalPageNavigation: () => ({ goBack: () => {}, close: () => {} }),
}))

import PrivacyPolicyPage from './PrivacyPolicyPage'
import TermsOfServicePage from './TermsOfServicePage'
import { IntroLandingSections } from '../web/components/introduction/landing'

function render(node: React.ReactNode, path = '/') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)
    .replace(/<!-- -->/g, '')
    .replace(/\s+/g, ' ')
}

const POLICY_URL = 'https://developers.google.com/terms/api-services-user-data-policy'

describe('Google OAuth 공개 고지 (개인정보처리방침·약관·소개)', () => {
  it('개인정보처리방침: Google 서비스 연동 조항과 목차, 개정일', () => {
    const html = render(<PrivacyPolicyPage />, '/privacy')
    expect(html).toContain('개정일 2026년 10월 2일')
    expect(html).toContain('<a href="#s13">Google 서비스 연동</a>')
    expect(html).toContain('제13조 Google 서비스 연동')
    expect(html).toContain('calendar.readonly')
    expect(html).toContain('생성·수정·삭제하지 않습니다')
    expect(html).toContain('약 60초')
    expect(html).toContain('브라우저(로컬 저장소 등)에는 저장하지 않습니다')
    expect(html).toContain('광고 목적으로 이용하지 않습니다')
    expect(html).toContain('href="https://myaccount.google.com/permissions"')
    expect(html).toContain(`href="${POLICY_URL}"`)
    expect(html).toContain(
      'ONE FC&#x27;s use and transfer of information received from Google APIs will adhere to the',
    )
    expect(html).toContain('including the Limited Use requirements.')
  })

  it('이용약관: 외부 서비스 연동은 선택·읽기 전용·해제 가능, 개인정보처리방침 참조', () => {
    const html = render(<TermsOfServicePage />, '/terms')
    expect(html).toContain('개정일 2026년 10월 2일')
    expect(html).toContain('Google Calendar 연동은 일정을 읽기 전용으로 표시하는 데 한정됩니다')
    expect(html).toContain('언제든지 연결을 해제할 수 있으며')
  })

  it('소개 랜딩 주요 기능에 Google Calendar 읽기 전용 연동 문장', () => {
    const html = render(<IntroLandingSections goToSection={() => {}} contactForm={null} />, '/introduction')
    expect(html).toContain(
      '사용자가 선택한 Google Calendar의 일정을 ONE FC 일정 관리 화면에서 함께 확인할 수 있도록 읽기 전용으로 연동합니다.',
    )
  })
})
