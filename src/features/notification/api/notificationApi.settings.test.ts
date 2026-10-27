import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchNotificationSettings } from './notificationApi'

const storedSettings = {
  insuranceAge: { enabled: false, daysBefore: 10 },
  carExpiry: { enabled: false, daysBefore: 14 },
  specialDate: { enabled: true, daysBefore: 7 },
  claimRequest: { enabled: false },
}

function respond(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchNotificationSettings', () => {
  it('reads saved values when apiRequest unwraps the success/data envelope', async () => {
    respond({ success: true, data: storedSettings })

    await expect(fetchNotificationSettings('test-token')).resolves.toEqual(storedSettings)
  })

  it('uses existing UI defaults only when the user has no saved row', async () => {
    respond({
      success: true,
      data: {
        insuranceAge: { enabled: true, daysBefore: 30 },
        carExpiry: { enabled: true, daysBefore: 30 },
        specialDate: { enabled: true, daysBefore: 0 },
        claimRequest: { enabled: true },
      },
      configured: false,
    })

    await expect(fetchNotificationSettings('test-token')).resolves.toEqual({
      insuranceAge: { enabled: true, daysBefore: 30 },
      carExpiry: { enabled: true, daysBefore: 30 },
      specialDate: { enabled: true, daysBefore: 30 },
      claimRequest: { enabled: true },
    })
  })

  it('preserves explicitly saved zero-day windows and false toggles in the envelope shape', async () => {
    const settings = {
      ...storedSettings,
      insuranceAge: { enabled: true, daysBefore: 0 },
      specialDate: { enabled: false, daysBefore: 0 },
    }
    respond({ success: true, data: settings, configured: true })

    await expect(fetchNotificationSettings('test-token')).resolves.toEqual(settings)
  })
})
