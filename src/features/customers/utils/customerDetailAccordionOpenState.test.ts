import { describe, expect, it } from 'vitest'
import {
  createDefaultCustomerDetailOpenSections,
  resetCustomerDetailOpenSectionsForCustomer,
  toggleCustomerDetailSectionOpen,
} from './customerDetailAccordionOpenState'

describe('customerDetailAccordionOpenState', () => {
  it('case 1: defaults to basic open only', () => {
    expect(createDefaultCustomerDetailOpenSections()).toEqual({
      basic: true,
      vehicle: false,
      linked: false,
      fireInsurance: false,
      business: false,
      alertDates: false,
    })
  })

  it('case 2: opening vehicle keeps basic open', () => {
    const initial = createDefaultCustomerDetailOpenSections()
    const next = toggleCustomerDetailSectionOpen(initial, 'vehicle', true)
    expect(next.basic).toBe(true)
    expect(next.vehicle).toBe(true)
  })

  it('case 3: opening business keeps basic and vehicle open', () => {
    let state = createDefaultCustomerDetailOpenSections()
    state = toggleCustomerDetailSectionOpen(state, 'vehicle', true)
    state = toggleCustomerDetailSectionOpen(state, 'business', true)
    expect(state.basic).toBe(true)
    expect(state.vehicle).toBe(true)
    expect(state.business).toBe(true)
    expect(state.linked).toBe(false)
  })

  it('case 4: closing vehicle leaves basic and business open', () => {
    let state = createDefaultCustomerDetailOpenSections()
    state = toggleCustomerDetailSectionOpen(state, 'vehicle', true)
    state = toggleCustomerDetailSectionOpen(state, 'business', true)
    state = toggleCustomerDetailSectionOpen(state, 'vehicle', false)
    expect(state.basic).toBe(true)
    expect(state.vehicle).toBe(false)
    expect(state.business).toBe(true)
  })

  it('case 5: unrelated sections stay open when only one section toggles', () => {
    let state = createDefaultCustomerDetailOpenSections()
    state = toggleCustomerDetailSectionOpen(state, 'vehicle', true)
    state = toggleCustomerDetailSectionOpen(state, 'business', true)
    state = toggleCustomerDetailSectionOpen(state, 'alertDates', true)
    const beforeModal = { ...state }
    // Quick CRUD modal open/close does not touch accordion state.
    expect(state).toEqual(beforeModal)
    expect(state.vehicle).toBe(true)
    expect(state.business).toBe(true)
    expect(state.alertDates).toBe(true)
  })

  it('case 6: customer change resets to basic open only', () => {
    let state = createDefaultCustomerDetailOpenSections()
    state = toggleCustomerDetailSectionOpen(state, 'vehicle', true)
    state = toggleCustomerDetailSectionOpen(state, 'business', true)
    expect(resetCustomerDetailOpenSectionsForCustomer()).toEqual(
      createDefaultCustomerDetailOpenSections(),
    )
  })
})
