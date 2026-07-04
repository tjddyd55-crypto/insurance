import { describe, expect, it, vi } from 'vitest'
import type { UserInsurerAccountRow } from './userInsurerAccountsApi'
import {
  SHARED_USER_INSURER_ACCOUNT_CATEGORIES,
  ALL_USER_INSURER_ACCOUNT_CATEGORIES,
} from '../config/userInsurerAccounts.config'
import { withVisibleAccountCategories, type AccountVaultAdapter } from './accountVaultAdapter'

function makeRow(id: string, category: UserInsurerAccountRow['category']): UserInsurerAccountRow {
  return {
    id,
    ownerUserId: 'u1',
    gaId: 1,
    category,
    companyName: 'Test',
    loginId: 'id',
    loginPassword: 'pw',
    memo: '',
    sortOrder: 0,
    isCustom: false,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  }
}

function makeAdapter(rows: UserInsurerAccountRow[]): AccountVaultAdapter {
  return {
    fetchAccounts: vi.fn(async () => rows),
    createAccount: vi.fn(async (payload) => makeRow('new', payload.category)),
    patchAccount: vi.fn(async (id) => rows.find((row) => row.id === id) ?? makeRow(id, 'LIFE')),
    deleteAccount: vi.fn(async () => undefined),
  }
}

describe('withVisibleAccountCategories', () => {
  it('fetchAccounts returns only visible categories', async () => {
    const base = makeAdapter([
      makeRow('1', 'LIFE'),
      makeRow('2', 'NON_LIFE'),
      makeRow('3', 'GENERAL'),
    ])
    const filtered = withVisibleAccountCategories(base, SHARED_USER_INSURER_ACCOUNT_CATEGORIES)
    const rows = await filtered.fetchAccounts()
    expect(rows.map((row) => row.category)).toEqual(['LIFE', 'NON_LIFE'])
  })

  it('createAccount rejects disallowed category', async () => {
    const base = makeAdapter([])
    const filtered = withVisibleAccountCategories(base, SHARED_USER_INSURER_ACCOUNT_CATEGORIES)
    await expect(
      filtered.createAccount({
        category: 'GENERAL',
        companyName: 'X',
        loginId: '',
        loginPassword: '',
      }),
    ).rejects.toThrow('shared_account_category_not_allowed')
  })

  it('allows all categories when ALL list is passed', async () => {
    const base = makeAdapter([makeRow('3', 'GENERAL')])
    const filtered = withVisibleAccountCategories(base, ALL_USER_INSURER_ACCOUNT_CATEGORIES)
    const rows = await filtered.fetchAccounts()
    expect(rows).toHaveLength(1)
    await expect(
      filtered.createAccount({
        category: 'GENERAL',
        companyName: 'X',
        loginId: '',
        loginPassword: '',
      }),
    ).resolves.toMatchObject({ category: 'GENERAL' })
  })
})
