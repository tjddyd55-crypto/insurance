import { describe, expect, it, vi } from 'vitest'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'
import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import {
  buildAccountDeleteConfirmRequest,
  deleteAccountWithConfirm,
} from './accountVaultDeleteConfirm'

function makeRow(overrides: Partial<UserInsurerAccountRow> = {}): UserInsurerAccountRow {
  return {
    id: 'acc-1',
    ownerUserId: 'u1',
    gaId: 1,
    category: 'GENERAL',
    companyName: '네이버',
    loginId: 'id',
    loginPassword: 'pw',
    memo: '',
    sortOrder: 0,
    isCustom: true,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('buildAccountDeleteConfirmRequest', () => {
  it('includes category and company name in message', () => {
    const request = buildAccountDeleteConfirmRequest(makeRow())
    expect(request.title).toBe('계정을 삭제할까요?')
    expect(request.confirmLabel).toBe('삭제')
    expect(request.cancelLabel).toBe('취소')
    expect(request.tone).toBe('danger')
    expect(String(request.message)).toContain('일반')
    expect(String(request.message)).toContain('네이버')
    expect(String(request.message)).toContain('복구할 수 없습니다')
  })
})

describe('deleteAccountWithConfirm', () => {
  it('does not call deleteAccount before confirm', async () => {
    const deleteAccount = vi.fn(async () => undefined)
    const confirm = vi.fn(async () => false)
    const adapter: AccountVaultAdapter = {
      fetchAccounts: vi.fn(),
      createAccount: vi.fn(),
      patchAccount: vi.fn(),
      deleteAccount,
    }

    const deleted = await deleteAccountWithConfirm(makeRow(), adapter, confirm)

    expect(deleted).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('calls deleteAccount only after confirm', async () => {
    const deleteAccount = vi.fn(async () => undefined)
    const confirm = vi.fn(async () => true)
    const onConfirmed = vi.fn()
    const adapter: AccountVaultAdapter = {
      fetchAccounts: vi.fn(),
      createAccount: vi.fn(),
      patchAccount: vi.fn(),
      deleteAccount,
    }

    const deleted = await deleteAccountWithConfirm(makeRow(), adapter, confirm, { onConfirmed })

    expect(deleted).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(onConfirmed).toHaveBeenCalledTimes(1)
    expect(deleteAccount).toHaveBeenCalledTimes(1)
    expect(deleteAccount).toHaveBeenCalledWith('acc-1')
  })

  it('skips non-custom rows', async () => {
    const deleteAccount = vi.fn(async () => undefined)
    const confirm = vi.fn(async () => true)
    const adapter: AccountVaultAdapter = {
      fetchAccounts: vi.fn(),
      createAccount: vi.fn(),
      patchAccount: vi.fn(),
      deleteAccount,
    }

    const deleted = await deleteAccountWithConfirm(makeRow({ isCustom: false }), adapter, confirm)

    expect(deleted).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })
})
