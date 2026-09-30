import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from './templates'
import {
  applyConsultationCustomer,
  consultationCustomerFromScenario,
  consultationSavePayload,
  customerDisplayLabel,
  customerDraftFromSelection,
  emptyCustomerDraft,
} from './customerContext'
import { filterMockCustomers } from '../customer/mockPreviewCustomers'

describe('customerContext', () => {
  it('customerDraftFromSelection', () => {
    expect(customerDraftFromSelection(null)).toEqual({ customerId: null, customerNameSnapshot: null })
    expect(customerDraftFromSelection({ id: 'a', name: '김민수' })).toEqual({
      customerId: 'a',
      customerNameSnapshot: '김민수',
    })
  })

  it('customerDisplayLabel', () => {
    expect(customerDisplayLabel({ customerId: 'a', customerNameSnapshot: '김민수' })).toBe('김민수 고객')
    expect(customerDisplayLabel({ customerId: null, customerNameSnapshot: null })).toBe('고객 미지정')
  })

  it('filterMockCustomers by name or phone', () => {
    expect(filterMockCustomers('김민수')).toHaveLength(1)
    expect(filterMockCustomers('010-2345')).toHaveLength(1)
  })

  it('reopens a saved simulation with its customer and keeps that customer on save', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const saved = applyConsultationCustomer(
      scenario,
      customerDraftFromSelection({ id: 'c-1', name: '김민수' }),
    )
    expect(consultationCustomerFromScenario(saved)).toEqual({
      customerId: 'c-1',
      customerNameSnapshot: '김민수',
    })
    const payload = consultationSavePayload(saved, saved.title)
    expect(payload.customerId).toBe('c-1')
    expect(payload.customerNameSnapshot).toBe('김민수')
    expect(payload.customerName).toBe('김민수')
  })

  it('keeps a legacy customerName when the snapshot field is empty', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerId = 'c-1'
    scenario.customerNameSnapshot = null
    scenario.customerName = '김민수'
    const payload = consultationSavePayload(scenario, '암 상담')
    expect(payload.title).toBe('암 상담')
    expect(payload.customerId).toBe('c-1')
    expect(payload.customerNameSnapshot).toBe('김민수')
  })

  it('clears the customer only when the editor removes it', () => {
    const scenario = applyConsultationCustomer(createScenarioFromTemplate('cancer')!, {
      customerId: 'c-1',
      customerNameSnapshot: '김민수',
    })
    const cleared = applyConsultationCustomer(scenario, emptyCustomerDraft())
    expect(consultationCustomerFromScenario(cleared)).toEqual(emptyCustomerDraft())
    expect(consultationSavePayload(cleared, cleared.title).customerId).toBeNull()
    expect(consultationSavePayload(cleared, cleared.title).customerNameSnapshot).toBeNull()
  })

  it('replaces the customer when a different one is picked', () => {
    const scenario = applyConsultationCustomer(createScenarioFromTemplate('cancer')!, {
      customerId: 'c-1',
      customerNameSnapshot: '김민수',
    })
    const next = applyConsultationCustomer(
      scenario,
      customerDraftFromSelection({ id: 'c-2', name: '이지은' }),
    )
    expect(consultationSavePayload(next, next.title)).toMatchObject({
      customerId: 'c-2',
      customerNameSnapshot: '이지은',
    })
  })
})
