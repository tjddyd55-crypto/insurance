/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { user: { id: 'user-a' }, token: 'token-a' }
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth }))

const card = (status: string) => ({ key: 'google_calendar', name: 'Google', status, availability: 'ready', kind: 'oauth' })
let googleStatus = 'disconnected'
const fetchMock = vi.fn(async () => [card(googleStatus)])
const connectMock = vi.fn(async (_token: string, _key: string, _options?: { client?: 'desktop' }) => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=s' }))

vi.mock('../api/serviceIntegrationsApi', async () => {
  const actual = await vi.importActual<typeof import('../api/serviceIntegrationsApi')>('../api/serviceIntegrationsApi')
  return { ...actual, fetchServiceIntegrations: fetchMock, connectServiceIntegration: connectMock }
})

const { useServiceIntegrationsState, DESKTOP_OAUTH_POLL_MS } = await import('./useServiceIntegrationsState')

let latest: ReturnType<typeof useServiceIntegrationsState>
function Probe() {
  latest = useServiceIntegrationsState()
  return <p data-notice>{latest.notice}</p>
}

describe('데스크톱 앱 Google 연동: 시스템 브라우저 + 상태 재조회', () => {
  let container: HTMLDivElement
  let root: Root
  let openSpy: ReturnType<typeof vi.fn>
  let assignSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    googleStatus = 'disconnected'
    fetchMock.mockClear()
    connectMock.mockClear()
    openSpy = vi.fn()
    assignSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign: assignSpy } })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    delete (window as { electronAPI?: unknown }).electronAPI
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function mountAndConnect() {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/service-integrations']}><Probe /></MemoryRouter>)
    })
    await act(async () => {
      latest.onConnect(card('disconnected') as never)
    })
  }

  it('데스크톱: client=desktop 로 시작, window.open(외부 브라우저), 앱 복귀 시 연동됨', async () => {
    ;(window as { electronAPI?: unknown }).electronAPI = {}
    await mountAndConnect()
    expect(connectMock).toHaveBeenCalledWith('token-a', 'google_calendar', { client: 'desktop' })
    expect(openSpy).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=s', '_blank', 'noopener,noreferrer')
    expect(assignSpy).not.toHaveBeenCalled()
    expect(container.textContent).toContain('브라우저에서 Google 동의')

    const before = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(DESKTOP_OAUTH_POLL_MS) })
    expect(fetchMock.mock.calls.length).toBe(before + 1)

    googleStatus = 'connected'
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(latest.providers[0].status).toBe('connected')
    expect(container.textContent).toContain('Google 계정이 연결되었습니다.')

    const after = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(DESKTOP_OAUTH_POLL_MS * 3) })
    expect(fetchMock.mock.calls.length).toBe(after)
  })

  it('웹: 기존대로 client 없이 시작하고 현재 창에서 이동', async () => {
    await mountAndConnect()
    expect(connectMock).toHaveBeenCalledWith('token-a', 'google_calendar', {})
    expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=s')
    expect(openSpy).not.toHaveBeenCalled()
  })
})
