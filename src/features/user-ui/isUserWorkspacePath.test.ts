import { describe, expect, it } from 'vitest'
import { isAdminWorkspacePath, isUserWorkspacePath } from './isUserWorkspacePath'

describe('isUserWorkspacePath', () => {
  it('includes primary user workspace routes', () => {
    expect(isUserWorkspacePath('/customers')).toBe(true)
    expect(isUserWorkspacePath('/customers/1/files')).toBe(true)
    expect(isUserWorkspacePath('/portal/newsletters')).toBe(true)
    expect(isUserWorkspacePath('/claim-requests')).toBe(true)
    expect(isUserWorkspacePath('/application/documents')).toBe(true)
    expect(isUserWorkspacePath('/application/documents/28')).toBe(true)
    expect(isUserWorkspacePath('/application/documents/history')).toBe(true)
    expect(isUserWorkspacePath('/insurance/contacts')).toBe(true)
    expect(isUserWorkspacePath('/memo')).toBe(true)
    expect(isUserWorkspacePath('/storage')).toBe(true)
    expect(isUserWorkspacePath('/contracts/signatures/history')).toBe(true)
    expect(isUserWorkspacePath('/contracts/signatures/send')).toBe(true)
  })

  it('excludes admin routes', () => {
    expect(isAdminWorkspacePath('/admin')).toBe(true)
    expect(isAdminWorkspacePath('/admin/users')).toBe(true)
    expect(isUserWorkspacePath('/admin/users')).toBe(false)
    expect(isUserWorkspacePath('/internal/admin/foo')).toBe(false)
  })
})
