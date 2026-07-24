import { useCallback, useEffect, useMemo, useState } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import {
  createGlobalNewsletterBoard,
  createGaNewsletterBoard,
  disableNewsletterBoard,
  enableNewsletterBoard,
  listAdminNewsletterBoards,
  updateNewsletterBoard,
} from '../services/insurerNews.service'
import type { NewsletterBoard } from '../types'
import { isLossAdjusterSystemMenuBoard } from '../utils/newsletterBoardMenuLinks'
import NewsletterBoardAdminMobileView from './NewsletterBoardAdmin/NewsletterBoardAdminMobileView'
import NewsletterBoardAdminPCView from './NewsletterBoardAdmin/NewsletterBoardAdminPCView'
import { NewsletterBoardEditModal } from './NewsletterBoardAdmin/NewsletterBoardEditModal'
import type {
  NewsletterBoardAdminViewProps,
  NewsletterBoardCreateMode,
} from './NewsletterBoardAdmin/newsletterBoardAdminViewProps'

export function NewsletterBoardAdminPage() {
  const { user, token } = useAuth()
  const role = user?.role ?? ''
  const [boards, setBoards] = useState<NewsletterBoard[]>([])
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [createMode, setCreateMode] = useState<NewsletterBoardCreateMode>(
    role === 'SUPER_ADMIN' ? 'global' : 'ga',
  )
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [writerBusy, setWriterBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedBoard, setSelectedBoard] = useState<NewsletterBoard | null>(null)
  const [editingBoard, setEditingBoard] = useState<NewsletterBoard | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  const canManage = role === 'SUPER_ADMIN' || role === 'GA_ADMIN' || role === 'GA_STAFF'

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
      setError(e instanceof Error ? e.message : '소식지 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [canManage, token])

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const globalBoards = useMemo(
    () => boards.filter((b) => b.boardScope === 'global' || b.contentScope === 'global'),
    [boards],
  )
  const gaBoards = useMemo(
    () => boards.filter((b) => b.boardScope === 'ga' || (b.boardScope !== 'global' && b.contentScope === 'ga')),
    [boards],
  )

  const handleCreate = () => {
    if (!token?.trim() || busy) {
      return
    }
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const payload = { label: label.trim(), description: description.trim() || null }
        const created =
          role === 'SUPER_ADMIN' && createMode === 'global'
            ? await createGlobalNewsletterBoard(token, payload)
            : await createGaNewsletterBoard(token, payload)
        setBoards((prev) => [...prev, created])
        setLabel('')
        setDescription('')
        setNotice('게시판이 추가되었습니다.')
      } catch (e) {
        setError(e instanceof Error ? e.message : '소식지 추가에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleDisable = (board: NewsletterBoard) => {
    if (!token?.trim() || busy) {
      return
    }
    void (async () => {
      const displayName = board.label.trim() || '게시판'
      const ok = await confirm({
        title: `${displayName}을(를) 사용 중지할까요?`,
        message:
          `${displayName} 메뉴가 사용자 화면에서 숨겨집니다. 기존 게시글과 첨부파일·작성자 계정은 삭제되지 않으며 나중에 다시 사용할 수 있습니다.`,
        tone: 'danger',
        confirmLabel: '사용 중지',
        cancelLabel: '취소',
      })
      if (!ok) {
        return
      }
      setBusy(true)
      setError('')
      try {
        const updated = await disableNewsletterBoard(token, board.id, { role })
        setBoards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setNotice(`「${updated.label}」을(를) 사용 중지했습니다.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : '사용 중지에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleEnable = (board: NewsletterBoard) => {
    if (!token?.trim() || busy) {
      return
    }
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const updated = await enableNewsletterBoard(token, board.id, { role })
        setBoards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setNotice(`「${updated.label}」을(를) 다시 사용합니다.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : '다시 사용에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleEdit = (board: NewsletterBoard) => {
    if (busy || editBusy) {
      return
    }
    setEditError('')
    setEditingBoard(board)
  }

  const closeEditModal = () => {
    if (editBusy) {
      return
    }
    setEditingBoard(null)
    setEditError('')
  }

  const handleEditRequestClose = () => {
    if (editBusy) {
      return
    }
    void (async () => {
      const ok = await confirm({
        title: '변경사항 취소',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
      })
      if (ok) {
        closeEditModal()
      }
    })()
  }

  const handleEditSubmit = (input: { label: string; description: string }) => {
    if (!token?.trim() || !editingBoard || editBusy) {
      return
    }
    void (async () => {
      setEditBusy(true)
      setEditError('')
      try {
        const updated = await updateNewsletterBoard(token, editingBoard.id, input, { role })
        setBoards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        if (selectedBoard?.id === updated.id) {
          setSelectedBoard(updated)
        }
        setNotice(
          isLossAdjusterSystemMenuBoard(editingBoard)
            ? '기본 게시판 이름이 수정되었습니다.'
            : '게시판 이름이 수정되었습니다.',
        )
        closeEditModal()
        setError('')
      } catch (e) {
        setEditError(e instanceof Error ? e.message : '소식지 수정에 실패했습니다.')
      } finally {
        setEditBusy(false)
      }
    })()
  }

  if (!canManage) {
    return (
      <main className="page page--with-back newsletter-board-admin-page">
        <div className="insurer-news-empty">소식지 관리 권한이 없습니다.</div>
      </main>
    )
  }

  const viewProps: NewsletterBoardAdminViewProps = {
    role,
    token: token ?? '',
    boards,
    globalBoards,
    gaBoards,
    label,
    description,
    createMode,
    loading,
    busy: busy || writerBusy || editBusy,
    error,
    notice,
    selectedBoard,
    onLabelChange: setLabel,
    onDescriptionChange: setDescription,
    onCreateModeChange: setCreateMode,
    onCreate: handleCreate,
    onDelete: handleDisable,
    onDisable: handleDisable,
    onEnable: handleEnable,
    onEdit: handleEdit,
    onSelectBoard: setSelectedBoard,
    onWriterBusyChange: setWriterBusy,
  }

  return (
    <>
      <ResponsiveLayout<NewsletterBoardAdminViewProps>
        PC={NewsletterBoardAdminPCView}
        Mobile={NewsletterBoardAdminMobileView}
        viewProps={viewProps}
      />
      <NewsletterBoardEditModal
        board={editingBoard}
        open={editingBoard != null}
        busy={editBusy}
        error={editError}
        onClose={closeEditModal}
        onRequestClose={handleEditRequestClose}
        onSubmit={handleEditSubmit}
      />
      {confirmDialog}
    </>
  )
}
