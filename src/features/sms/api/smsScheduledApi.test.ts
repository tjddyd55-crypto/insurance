import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createSmsScheduledMessage, fetchSmsScheduledMessages } from './smsScheduledApi'

vi.mock('../../../lib/apiClient', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../lib/apiClient'

const mockedApiRequest = vi.mocked(apiRequest)

describe('smsScheduledApi', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('fetchSmsScheduledMessages calls GET /api/sms/scheduled', async () => {
    mockedApiRequest.mockResolvedValueOnce([
      {
        id: 1,
        name: '예약1',
        recipientGroupId: 3,
        messageBody: 'hello',
        messageType: 'info',
        scheduleType: 'once',
        sendDate: '2099-01-01',
        sendTime: '09:00',
        status: 'active',
      },
    ])
    const rows = await fetchSmsScheduledMessages('token')
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/sms/scheduled', { token: 'token' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('예약1')
  })

  it('createSmsScheduledMessage calls POST /api/sms/scheduled', async () => {
    mockedApiRequest.mockResolvedValueOnce({ id: 2, name: 'new' })
    await createSmsScheduledMessage('token', {
      name: 'new',
      recipientGroupId: '3',
      messageBody: 'body',
      messageType: 'info',
      scheduleType: 'once',
      sendDate: '2099-01-01',
      sendTime: '09:00',
    })
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/api/sms/scheduled',
      expect.objectContaining({
        method: 'POST',
        token: 'token',
      }),
    )
  })
})
