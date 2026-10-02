import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  googleConnectErrorMessage,
  readServiceIntegrationConnectResult,
  type ServiceIntegrationCard,
} from '../../api/serviceIntegrationsApi'
import type { ServiceIntegrationsViewProps } from '../../hooks/useServiceIntegrationsState'
import ServiceIntegrationsMobileView from './ServiceIntegrationsMobileView'
import ServiceIntegrationsPCView from './ServiceIntegrationsPCView'

function googleCard(overrides: Partial<ServiceIntegrationCard>): ServiceIntegrationCard {
  return {
    key: 'google_calendar',
    group: 'google',
    groupLabel: 'Google',
    name: 'Google',
    description: 'Google Calendar 일정과 Google Tasks 할 일을 일정 관리에서 읽기 전용으로 함께 봅니다.',
    kind: 'oauth',
    availability: 'ready',
    status: 'disconnected',
    lastSyncedAt: null,
    lastError: null,
    secretMasked: null,
    sender: '',
    accountLabel: '',
    connectedAt: null,
    settingsPath: null,
    ...overrides,
  }
}

function render(card: ServiceIntegrationCard, mobile = false) {
  const props: ServiceIntegrationsViewProps = {
    loading: false,
    error: '',
    notice: '',
    balanceText: '',
    providers: [card],
    busyKey: '',
    onConnect: () => undefined,
    onDisconnect: () => undefined,
    onOpenSettings: () => undefined,
    onRefreshBalance: () => undefined,
  }
  const View = mobile ? ServiceIntegrationsMobileView : ServiceIntegrationsPCView
  return renderToStaticMarkup(<View {...props} />)
}

describe('서비스 연동 Google 카드', () => {
  it('미연동: Google 연결 버튼, 해제 비활성, 계정 정보 없음', () => {
    for (const mobile of [false, true]) {
      const html = render(googleCard({}), mobile)
      expect(html).toContain('미연동')
      expect(html).toContain('Google 연결')
      expect(html).toMatch(/disabled=""[^>]*>연결 해제|연결 해제/)
      expect(html).not.toContain('계정</dt>')
    }
  })

  it('연결됨: 카드 제목 Google, 연동됨, email, 사용 중 Calendar · Tasks, 다시 연결/연결 해제', () => {
    const html = render(googleCard({
      status: 'connected',
      accountLabel: 'alice@example.com',
      connectedAt: '2026-10-02T01:00:00.000Z',
      lastSyncedAt: '2026-10-02T01:05:00.000Z',
      needsReconsent: false,
      products: {
        calendar: { status: 'available', scopeGranted: true, readOnly: true },
        tasks: { status: 'available', scopeGranted: true, needsReconsent: false, readOnly: true },
      },
    }))
    expect(html).toContain('<h3>Google</h3>')
    expect(html).toContain('연동됨')
    expect(html).toContain('alice@example.com')
    expect(html).toContain('사용 중')
    expect(html).toContain('Google Calendar · Google Tasks (읽기 전용)')
    expect(html).not.toContain('Google Tasks 읽기 권한이 없습니다')
    expect(html).toContain('다시 연결')
    expect(html).toContain('연결 해제')
    expect(html).toContain('마지막 조회')
    expect(html).not.toContain('자격 증명')
  })

  it('Tasks scope 없음(이전 Calendar 전용 동의): Calendar 만 사용 중 + 다시 연결 안내', () => {
    for (const mobile of [false, true]) {
      const html = render(googleCard({
        status: 'connected',
        accountLabel: 'alice@example.com',
        needsReconsent: true,
        products: {
          calendar: { status: 'available', scopeGranted: true, readOnly: true },
          tasks: { status: 'scope_missing', scopeGranted: false, needsReconsent: true, readOnly: true },
        },
      }), mobile)
      expect(html).toContain('연동됨')
      expect(html).toContain('Google Calendar (읽기 전용)')
      expect(html).not.toContain('Google Calendar · Google Tasks')
      expect(html).toContain('Google Tasks 읽기 권한이 없습니다. 다시 연결하면 Google 할 일도 일정 관리에서 볼 수 있습니다.')
      expect(html).toContain('다시 연결')
    }
  })

  it('재연결 필요: 안내와 다시 연결', () => {
    const html = render(googleCard({ status: 'needs_reauth', accountLabel: 'alice@example.com' }))
    expect(html).toContain('재연결 필요')
    expect(html).toContain('Google 연결이 만료되었거나 권한이 취소되었습니다. 다시 연결해 주세요.')
    expect(html).toContain('다시 연결')
  })

  it('미설정: 연결 버튼 비활성', () => {
    const html = render(googleCard({ status: 'unconfigured', availability: 'unconfigured' }))
    expect(html).toContain('미설정')
    expect(html).toMatch(/disabled=""[^>]*>Google 연결/)
  })

  it('connect 응답의 이동 주소는 accounts.google.com 일 때만 따른다', () => {
    expect(readServiceIntegrationConnectResult({ action: 'redirect', url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }))
      .toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })
    expect(readServiceIntegrationConnectResult({ success: true, data: { url: 'https://evil.example/auth' } })).toEqual({})
    expect(readServiceIntegrationConnectResult({ url: 'javascript:alert(1)' })).toEqual({})
  })

  it('callback 오류 reason 을 이해 가능한 문구로', () => {
    expect(googleConnectErrorMessage('access_denied')).toContain('취소')
    expect(googleConnectErrorMessage('session_mismatch')).toContain('다시 시도')
    expect(googleConnectErrorMessage('scope_missing')).toContain('Calendar')
    expect(googleConnectErrorMessage('???')).toContain('연결하지 못했습니다')
  })

  it('검증 기간 허용 목록 밖(connectAllowed=false): Google 연동 준비 중 버튼 비활성, Google 연결 버튼 없음', () => {
    for (const mobile of [false, true]) {
      const html = render(googleCard({ connectAllowed: false }), mobile)
      expect(html).toMatch(/disabled=""[^>]*>Google 연동 준비 중</)
      expect(html).not.toContain('>Google 연결<')
    }
    const allowed = render(googleCard({ connectAllowed: true }))
    expect(allowed).toContain('Google 연결')
    expect(allowed).not.toContain('Google 연동 준비 중')
  })
})
