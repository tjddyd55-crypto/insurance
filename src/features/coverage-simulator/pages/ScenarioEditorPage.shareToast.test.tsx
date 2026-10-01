/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simulation = {
  id: '113',
  title: '암 치료',
  diseaseType: 'cancer' as const,
  description: '',
  customerId: null,
  customerNameSnapshot: '김민수',
  consultationDate: '2026-10-02',
  items: [],
  createdAt: '2026-10-01T01:16:00.000Z',
  updatedAt: '2026-10-01T01:16:00.000Z',
  kind: 'consultation' as const,
}

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    token: 'token-1',
    isAuthenticated: true,
  }),
}))

vi.mock('../../auth/authApi', () => ({
  fetchMe: vi.fn(async () => ({ id: 'user-1' })),
}))

vi.mock('../storage/coverageSimulatorStorage.api', async () => {
  const actual = await vi.importActual<typeof import('../storage/coverageSimulatorStorage.api')>(
    '../storage/coverageSimulatorStorage.api',
  )
  return {
    ...actual,
    fetchCoverageTemplates: vi.fn(async () => []),
    fetchCoverageSimulations: vi.fn(async () => [simulation]),
    createCoverageSimulationApi: vi.fn(async () => simulation),
  }
})

vi.mock('../api/coverageSimulatorShareApi', () => ({
  createCoverageSimulationShare: vi.fn(async () => ({
    shareId: '91',
    shareUrl: 'https://insurance-dev.up.railway.app/coverage/share/same-token',
    createdAt: '2026-10-02T00:00:00.000Z',
    expiresAt: null,
    pdfReady: true,
  })),
  listCoverageSimulationShares: vi.fn(async () => ({ shares: [] })),
  revokeCoverageSimulationShare: vi.fn(async () => undefined),
  uploadCoverageSharePdf: vi.fn(async () => undefined),
  createCoveragePdfArtifact: vi.fn(async () => ({ downloadUrl: '' })),
}))

import { CoverageSimulatorCrmRouteLayout } from './CoverageSimulatorCrmRouteLayout'
import { ScenarioEditorPage } from './ScenarioEditorPage'
import { resetCrmCoverageStorageSession } from '../storage/crmCoverageStorageSession'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function flushUntil(ready: () => boolean) {
  const started = Date.now()
  while (!ready()) {
    if (Date.now() - started > 4000) {
      throw new Error(`timed out. body=${document.body.textContent?.slice(0, 400) ?? ''}`)
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
}

describe('standalone coverage editor share toast', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetCrmCoverageStorageSession()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    host = document.createElement('div')
    host.className = 'app-main-content app-main-content--workspace-outlet-host'
    host.style.overflow = 'hidden'
    host.style.height = '120px'
    document.body.appendChild(host)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host?.remove()
    root = null
    host = null
    resetCrmCoverageStorageSession()
  })

  it('shows 복사되었습니다. on the routed scenario page without opening history first', async () => {
    root = createRoot(host!)
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/coverage-simulator/scenarios/113']}>
          <Routes>
            <Route path="/coverage-simulator" element={<CoverageSimulatorCrmRouteLayout />}>
              <Route path="scenarios/:scenarioId" element={<ScenarioEditorPage />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })

    await flushUntil(() =>
      [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === '공유'),
    )

    const shareButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '공유',
    )
    expect(shareButton).toBeTruthy()
    await act(async () => {
      shareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await flushUntil(() => document.body.textContent?.includes('복사되었습니다.') === true)

    const toast = document.querySelector('.coverage-simulator-toast')
    expect(toast?.textContent).toBe('복사되었습니다.')
    expect(toast?.parentElement).toBe(document.body)
    expect(host?.contains(toast ?? null)).toBe(false)
    expect(document.body.textContent?.includes('고객에게 공유')).toBe(false)
  })
})
