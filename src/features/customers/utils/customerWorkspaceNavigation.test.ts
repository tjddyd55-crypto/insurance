import { describe, expect, it } from 'vitest'
import {
  isCustomerWorkspaceSideDetailPath,
  parseWorkspaceCustomerIdFromPath,
  resolveCustomerWorkspaceTab,
} from './customerWorkspaceNavigation'

describe('parseWorkspaceCustomerIdFromPath', () => {
  it('reads customer id from workspace detail paths', () => {
    expect(parseWorkspaceCustomerIdFromPath('/customers/191/consultations')).toBe(191)
    expect(parseWorkspaceCustomerIdFromPath('/customers/42/files')).toBe(42)
    expect(parseWorkspaceCustomerIdFromPath('/customers/7/application-documents/history')).toBe(7)
    expect(parseWorkspaceCustomerIdFromPath('/customers/55/map')).toBe(55)
  })

  it('returns null for list-only paths', () => {
    expect(parseWorkspaceCustomerIdFromPath('/customers')).toBeNull()
    expect(parseWorkspaceCustomerIdFromPath('/customers/map')).toBeNull()
  })
})

describe('isCustomerWorkspaceSideDetailPath', () => {
  it('includes application-documents routes', () => {
    expect(isCustomerWorkspaceSideDetailPath('/customers/1/application-documents')).toBe(true)
    expect(isCustomerWorkspaceSideDetailPath('/customers/1/application-documents/history')).toBe(true)
  })

  it('includes detail map but not menu map', () => {
    expect(isCustomerWorkspaceSideDetailPath('/customers/12/map')).toBe(true)
    expect(isCustomerWorkspaceSideDetailPath('/customers/map')).toBe(false)
  })
})

describe('resolveCustomerWorkspaceTab', () => {
  it('defaults to consultations when no workspace tab is in the path', () => {
    expect(resolveCustomerWorkspaceTab('/customers')).toBe('consultations')
    expect(resolveCustomerWorkspaceTab('/customers/12')).toBe('consultations')
  })

  it('keeps explicit memo and consultation tabs', () => {
    expect(resolveCustomerWorkspaceTab('/customers/12/memos')).toBe('memos')
    expect(resolveCustomerWorkspaceTab('/customers/12/consultations')).toBe('consultations')
    expect(resolveCustomerWorkspaceTab('/customers/12/files')).toBe('files')
  })

  it('resolves detail map tab without confusing menu map', () => {
    expect(resolveCustomerWorkspaceTab('/customers/12/map')).toBe('map')
    expect(resolveCustomerWorkspaceTab('/customers/map')).toBe('consultations')
  })
})
