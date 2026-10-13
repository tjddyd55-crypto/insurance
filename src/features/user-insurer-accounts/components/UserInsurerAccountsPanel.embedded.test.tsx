import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/form', () => ({
  FormButton: () => null,
  FormInput: () => null,
}))

vi.mock('./UserInsurerAccountCopyButton', () => ({
  UserInsurerAccountCopyButton: () => null,
}))

const { UserInsurerAccountsPanel } = await import('./UserInsurerAccountsPanel')

const vaultStub = {
  activeTab: 'LIFE' as const,
  setActiveTab: vi.fn(),
  accounts: [],
  lifeAccounts: [],
  nonLifeAccounts: [],
  generalAccounts: [],
  loading: false,
  error: '',
  pendingId: null,
  addOpen: false,
  addForm: { companyName: '', loginId: '', loginPassword: '' },
  setAddForm: vi.fn(),
  load: vi.fn(),
  saveAccountField: vi.fn(),
  removeAccount: vi.fn(),
  openAddModal: vi.fn(),
  closeAddModal: vi.fn(),
  submitAdd: vi.fn(),
  confirmDialog: null,
}

describe('UserInsurerAccountsPanel embedded render', () => {
  it('renders stacked layout without runtime reference errors', () => {
    const html = renderToStaticMarkup(
      createElement(UserInsurerAccountsPanel, {
        ...vaultStub,
        layout: 'stacked',
      }),
    )
    expect(html.length).toBeGreaterThan(0)
  })
})
