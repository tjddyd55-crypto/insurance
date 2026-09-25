import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../auth/authApi', () => ({
  fetchMe: vi.fn(),
}))

import { fetchMe } from '../../auth/authApi'
import { CrmCoverageShareProvider } from './CrmCoverageShareProvider'
import { PreviewCoverageShareProvider } from './PreviewCoverageShareProvider'

describe('CoverageShareProvider auth isolation', () => {
  beforeEach(() => {
    vi.mocked(fetchMe).mockReset()
  })

  it('Preview provider never calls fetchMe', async () => {
    const provider = new PreviewCoverageShareProvider()

    await expect(provider.ensureAccess()).resolves.toBe(true)
    expect(fetchMe).not.toHaveBeenCalled()
  })

  it('CRM provider validates the current session', async () => {
    vi.mocked(fetchMe).mockResolvedValue({} as never)
    const provider = new CrmCoverageShareProvider('crm-token')

    await expect(provider.ensureAccess()).resolves.toBe(true)
    expect(fetchMe).toHaveBeenCalledWith('crm-token')
  })
})
