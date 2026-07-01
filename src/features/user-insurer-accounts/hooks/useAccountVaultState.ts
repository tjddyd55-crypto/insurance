import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'

export type AccountVaultViewProps = ReturnType<typeof useAccountVaultState>

export function useAccountVaultState(adapter: AccountVaultAdapter | null) {
  const [activeTab, setActiveTab] = useState<UserInsurerAccountCategory>('LIFE')
  const [accounts, setAccounts] = useState<UserInsurerAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    companyName: '',
    loginId: '',
    loginPassword: '',
  })

  const load = useCallback(async () => {
    if (!adapter) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await adapter.fetchAccounts()
      setAccounts(rows)
    } catch (e) {
      setAccounts([])
      setError(e instanceof ApiError ? e.message : '계정 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [adapter])

  useEffect(() => {
    void load()
  }, [load])

  const lifeAccounts = useMemo(
    () => accounts.filter((row) => row.category === 'LIFE'),
    [accounts],
  )

  const nonLifeAccounts = useMemo(
    () => accounts.filter((row) => row.category === 'NON_LIFE'),
    [accounts],
  )

  const generalAccounts = useMemo(
    () => accounts.filter((row) => row.category === 'GENERAL'),
    [accounts],
  )

  const saveAccountField = useCallback(
    async (row: UserInsurerAccountRow, patch: Partial<UserInsurerAccountRow>) => {
      if (!adapter) {
        return
      }
      setPendingId(row.id)
      setError('')
      try {
        const updated = await adapter.patchAccount(row.id, {
          companyName: patch.companyName,
          loginId: patch.loginId,
          loginPassword: patch.loginPassword,
        })
        setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
      } finally {
        setPendingId(null)
      }
    },
    [adapter],
  )

  const removeAccount = useCallback(
    async (row: UserInsurerAccountRow) => {
      if (!adapter || !row.isCustom) {
        return
      }
      setPendingId(row.id)
      setError('')
      try {
        await adapter.deleteAccount(row.id)
        setAccounts((prev) => prev.filter((item) => item.id !== row.id))
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '삭제에 실패했습니다.')
      } finally {
        setPendingId(null)
      }
    },
    [adapter],
  )

  const openAddModal = useCallback((category: UserInsurerAccountCategory = 'LIFE') => {
    setActiveTab(category)
    setAddForm({ companyName: '', loginId: '', loginPassword: '' })
    setAddOpen(true)
  }, [])

  const closeAddModal = useCallback(() => {
    setAddOpen(false)
  }, [])

  const submitAdd = useCallback(async () => {
    if (!adapter) {
      return
    }
    const companyName = addForm.companyName.trim()
    if (!companyName) {
      setError('회사명을 입력해 주세요.')
      return
    }
    setPendingId('new')
    setError('')
    try {
      const created = await adapter.createAccount({
        category: activeTab,
        companyName,
        loginId: addForm.loginId.trim(),
        loginPassword: addForm.loginPassword,
      })
      setAccounts((prev) => [...prev, created])
      setAddOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '추가에 실패했습니다.')
    } finally {
      setPendingId(null)
    }
  }, [activeTab, addForm, adapter])

  return {
    activeTab,
    setActiveTab,
    accounts,
    lifeAccounts,
    nonLifeAccounts,
    generalAccounts,
    loading,
    error,
    pendingId,
    addOpen,
    addForm,
    setAddForm,
    load,
    saveAccountField,
    removeAccount,
    openAddModal,
    closeAddModal,
    submitAdd,
  }
}
