import { describe, expect, it } from 'vitest'

import { previewScopeMobile } from '../CoverageSimulatorScope'
import { readSessionCustomerDraft } from './CoverageSimulatorCustomerContext'

describe('CoverageSimulatorCustomerContext', () => {
  it('readSessionCustomerDraft works without React provider (saved consultation path)', () => {
    const draft = readSessionCustomerDraft(previewScopeMobile.userKey)
    expect(draft).toEqual({ customerId: null, customerNameSnapshot: null })
  })
})
