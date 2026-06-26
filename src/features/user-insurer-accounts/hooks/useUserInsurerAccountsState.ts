import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import {
  createUserInsurerAccount,
  deleteUserInsurerAccount,
  fetchUserInsurerAccounts,
  patchUserInsurerAccount,
  type UserInsurerAccountRow,
} from '../api/userInsurerAccountsApi'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'

export type UserInsurerAccountsViewProps = ReturnType<typeof useUserInsurerAccountsState>

export function useUserInsurerAccountsState() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''

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
    memo: '',
  })

  const load = useCallback(async () => {
    if (!authToken) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await fetchUserInsurerAccounts(authToken)
      setAccounts(rows)
    } catch (e) {
      setAccounts([])
      setError(e instanceof ApiError ? e.message : '계정 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    void load()
  }, [load])

  const visibleAccounts = useMemo(
    () => accounts.filter((row) => row.category === activeTab),
    [accounts, activeTab],
  )

  const saveAccountField = useCallback(
    async (row: UserInsurerAccountRow, patch: Partial<UserInsurerAccountRow>) => {
      if (!authToken) {
        return
      }
      setPendingId(row.id)
      setError('')
      try {
        const updated = await patchUserInsurerAccount(authToken, row.id, {
          companyName: patch.companyName,
          loginId: patch.loginId,
          loginPassword: patch.loginPassword,
          memo: patch.memo,
        })
        setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
      } finally {
        setPendingId(null)
      }
    },
    [authToken],
  )

  const removeAccount = useCallback(
    async (row: UserInsurerAccountRow) => {
      if (!authToken || !row.isCustom) {
        return
      }
      setPendingId(row.id)
      setError('')
      try {
        await deleteUserInsurerAccount(authToken, row.id)
        setAccounts((prev) => prev.filter((item) => item.id !== row.id))
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '삭제에 실패했습니다.')
      } finally {
        setPendingId(null)
      }
    },
    [authToken],
  )

  const openAddModal = useCallback(() => {
    setAddForm({ companyName: '', loginId: '', loginPassword: '', memo: '' })
    setAddOpen(true)
  }, [])

  const closeAddModal = useCallback(() => {
    setAddOpen(false)
  }, [])

  const submitAdd = useCallback(async () => {
    if (!authToken) {
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
      const created = await createUserInsurerAccount(authToken, {
        category: activeTab,
        companyName,
        loginId: addForm.loginId.trim(),
        loginPassword: addForm.loginPassword,
        memo: addForm.memo,
      })
      setAccounts((prev) => [...prev, created])
      setAddOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '추가에 실패했습니다.')
    } finally {
      setPendingId(null)
    }
  }, [activeTab, addForm, authToken])

  return {
    activeTab,
    setActiveTab,
    accounts: visibleAccounts,
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
