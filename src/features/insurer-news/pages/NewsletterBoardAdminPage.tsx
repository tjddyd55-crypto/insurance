import { useCallback, useEffect, useState } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import {
  createNewsletterBoard,
  deleteNewsletterBoard,
  listAdminNewsletterBoards,
} from '../services/insurerNews.service'
import type { NewsletterBoard } from '../types'
import NewsletterBoardAdminMobileView from './NewsletterBoardAdmin/NewsletterBoardAdminMobileView'
import NewsletterBoardAdminPCView from './NewsletterBoardAdmin/NewsletterBoardAdminPCView'
import type { NewsletterBoardAdminViewProps } from './NewsletterBoardAdmin/newsletterBoardAdminViewProps'

export function NewsletterBoardAdminPage() {
  const { user, token } = useAuth()
  const role = user?.role ?? ''
  const [boards, setBoards] = useState<NewsletterBoard[]>([])
  const [label, setLabel] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  const canManage = role === 'SUPER_ADMIN' || role === 'GA_ADMIN'

  const loadBoards = useCallback(async () => {
    if (!token?.trim() || !canManage) {
      setBoards([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setBoards(await listAdminNewsletterBoards(token))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '소식지 메뉴를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [canManage, token])

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const handleCreate = () => {
    if (!token?.trim() || busy) {
      return
    }
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const created = await createNewsletterBoard(token, { label: label.trim(), isPublic })
        setBoards((prev) => [...prev, created])
        setLabel('')
        setIsPublic(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : '소식지 메뉴 추가에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleDelete = (board: NewsletterBoard) => {
    if (!token?.trim() || busy) {
      return
    }
    void (async () => {
      const ok = await confirm({
        title: '소식지 메뉴 삭제',
        message: `"${board.label}" 메뉴를 삭제하시겠습니까? 기존 글은 삭제하지 않고 메뉴에서만 제외됩니다.`,
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      setBusy(true)
      setError('')
      try {
        await deleteNewsletterBoard(token, board.id)
        setBoards((prev) => prev.filter((item) => item.id !== board.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : '소식지 메뉴 삭제에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  if (!canManage) {
    return (
      <main className="page page--with-back newsletter-board-admin-page">
        <div className="insurer-news-empty">소식지 메뉴 관리 권한이 없습니다.</div>
      </main>
    )
  }

  const viewProps: NewsletterBoardAdminViewProps = {
    role,
    boards,
    label,
    isPublic,
    loading,
    busy,
    error,
    onLabelChange: setLabel,
    onPublicChange: setIsPublic,
    onCreate: handleCreate,
    onDelete: handleDelete,
  }

  return (
    <>
      <ResponsiveLayout<NewsletterBoardAdminViewProps>
        PC={NewsletterBoardAdminPCView}
        Mobile={NewsletterBoardAdminMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}
