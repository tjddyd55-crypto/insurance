import { useCallback, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import { deleteManagerNewsletter } from '../services/insurerNews.service'
import type { NewsChannel, NewsletterItem } from '../types'
import { canDeleteNewsletter } from '../utils/canDeleteNewsletter'

export function useNewsletterDelete(channel: NewsChannel) {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const canDelete = useCallback(
    (item: Pick<NewsletterItem, 'publisherId'>) => canDeleteNewsletter(user, item),
    [user],
  )

  const deleteNewsletter = useCallback(
    async (item: Pick<NewsletterItem, 'id' | 'publisherId'>, onSuccess?: () => void) => {
      if (!token?.trim() || busyId) {
        return
      }
      const confirmed = await confirm({
        title: '소식지 삭제',
        message: '이 소식지를 삭제합니다. 첨부파일도 함께 삭제됩니다.',
        confirmLabel: '삭제',
        cancelLabel: '취소',
        tone: 'danger',
      })
      if (!confirmed) {
        return
      }
      setError('')
      setNotice('')
      setBusyId(item.id)
      try {
        await deleteManagerNewsletter(token, item.id, { channel })
        setNotice('삭제되었습니다.')
        onSuccess?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : '소식지 삭제에 실패했습니다.')
      } finally {
        setBusyId(null)
      }
    },
    [token, busyId, channel, confirm],
  )

  return {
    canDelete,
    deleteNewsletter,
    busyId,
    error,
    notice,
    setNotice,
    setError,
    confirmDialog,
  }
}
