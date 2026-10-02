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
    expect(html).toContain('tasks.readonly')
    expect(html).toContain('Google Tasks 할 일 목록 및 할 일 정보(제목, 메모, 예정일, 완료 여부, 목록 이름 등)')
    expect(html).toContain('일정/할 일 관리 화면에서 이용자 본인의 Google 일정 및 할 일을 읽기 전용으로 함께 표시하는 데에만 이용합니다')
    expect(html).toContain('Google Tasks 할 일을 생성·수정·완료 처리·삭제하지 않습니다')
    expect(html).toContain('Google 일정 및 할 일 정보는 영구 저장하지 않고')
    expect(html).toContain('서비스 연동 → Google → 연결 해제')
    expect(html).toContain('Google Calendar 캘린더 목록 및 일정 정보, Google Tasks 할 일 목록 및 할 일 정보 (자세한 내용은 제13조)')
    expect(html).not.toContain('auth/tasks')
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
    expect(html).toContain('Google Calendar 및 Google Tasks 등 외부 서비스와 연동하는 기능')
    expect(html).toContain('Google Calendar 및 Google Tasks 연동은 일정과 할 일을 읽기 전용으로 표시하는 데 한정됩니다')
    expect(html).toContain('언제든지 연결을 해제할 수 있으며')
  })

  it('소개 랜딩 주요 기능에 Google Calendar 및 Google Tasks 읽기 전용 연동 문장', () => {
    const html = render(<IntroLandingSections goToSection={() => {}} contactForm={null} />, '/introduction')
    expect(html).toContain(
      '사용자가 선택한 Google Calendar 및 Google Tasks의 일정과 할 일을 ONE FC 일정 관리 화면에서 함께 확인할 수 있도록 읽기 전용으로 연동합니다.',
    )
  })
})
