/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { user: { id: 'user-a' }, token: 'token-a' }

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => auth,
}))

const pending: Array<{ token: string; resolve: (value: unknown) => void }> = []

vi.mock('../api/serviceIntegrationsApi', async () => {
  const actual = await vi.importActual<typeof import('../api/serviceIntegrationsApi')>('../api/serviceIntegrationsApi')
  return {
    ...actual,
    fetchServiceIntegrations: vi.fn((token: string) => new Promise((resolve) => pending.push({ token, resolve }))),
  }
})

const { useServiceIntegrationsState } = await import('./useServiceIntegrationsState')

function Probe() {
  const state = useServiceIntegrationsState()
  return (
    <div>
      <p data-notice>{state.notice}</p>
      <p data-error>{state.error}</p>
      <ul>{state.providers.map((provider) => <li key={provider.key}>{provider.accountLabel}</li>)}</ul>
    </div>
  )
}

describe('서비스 연동 사용자 전환·OAuth 복귀', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    pending.length = 0
    auth.user = { id: 'user-a' }
    auth.token = 'token-a'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('다른 사용자로 로그인하면 이전 사용자 Google 계정 표시가 사라진다', async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/service-integrations']}><Probe /></MemoryRouter>)
    })
    await act(async () => {
      pending.at(-1)?.resolve([{ key: 'google_calendar', accountLabel: 'alice@example.com', status: 'connected' }])
    })
    expect(container.textContent).toContain('alice@example.com')
    auth.user = { id: 'user-b' }
    auth.token = 'token-b'
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/service-integrations']}><Probe /></MemoryRouter>)
    })
    expect(container.textContent).not.toContain('alice@example.com')
    expect(pending.at(-1)?.token).toBe('token-b')
  })

  it('OAuth 성공 복귀 시 안내 문구', async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/service-integrations?google=connected']}><Probe /></MemoryRouter>)
    })
    expect(container.querySelector('[data-notice]')?.textContent).toBe('Google 계정이 연결되었습니다.')
  })

  it('OAuth 오류 복귀 시 이해 가능한 오류', async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/service-integrations?google=error&reason=access_denied']}><Probe /></MemoryRouter>)
    })
    expect(container.querySelector('[data-error]')?.textContent).toContain('Google 동의가 취소되어')
  })
})
