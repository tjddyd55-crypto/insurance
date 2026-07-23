import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { canUseNewsletterBoardAdminRoutes } from '../../auth/roleGuards'
import { listVisibleNewsletterBoards } from '../services/insurerNews.service'
import {
  LOSS_ADJUSTER_SYSTEM_KEY,
  isLossAdjusterSystemMenuBoard,
} from '../utils/newsletterBoardMenuLinks'
import { NewsletterHubPage } from './NewsletterHubPage'

export function LossAdjusterNewsletterHubPage() {
  const { user, token } = useAuth()
  const canManage = canUseNewsletterBoardAdminRoutes(user?.role)
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('손해사정사 소식지')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const boards = await listVisibleNewsletterBoards(token)
        if (cancelled) {
          return
        }
        const systemBoard = boards.find(
          (board) =>
            isLossAdjusterSystemMenuBoard(board) ||
            String(board.systemKey ?? '').toUpperCase() === LOSS_ADJUSTER_SYSTEM_KEY,
        )
        if (systemBoard) {
          setLabel(systemBoard.label.trim() || '손해사정사 소식지')
          setIsActive(systemBoard.isActive !== false)
        } else {
          // ensure 실패·미포함이면 일반 사용자는 비활성으로 간주
          setIsActive(false)
        }
      } catch {
        if (!cancelled) {
          setIsActive(true)
          setLabel('손해사정사 소식지')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const emptyMessage = useMemo(() => `${label}에 등록된 게시글이 없습니다.`, [label])

  if (loading) {
    return (
      <main className="page page--with-back newsletter-hub-page">
        <div className="insurer-news-empty">불러오는 중...</div>
      </main>
    )
  }

  if (!isActive && !canManage) {
    return (
      <main className="page page--with-back newsletter-hub-page">
        <section className="insurer-news-empty" style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
          <p style={{ margin: 0 }}>현재 사용하지 않는 소식지입니다.</p>
          <Link to="/portal/newsletters">
            <FormButton htmlType="button" variant="primary">
              원수사 소식지로 이동
            </FormButton>
          </Link>
        </section>
      </main>
    )
  }

  return (
    <NewsletterHubPage
      channel="LOSS_ADJUSTER"
      title={label}
      detailBasePath="/portal/adjuster-news"
      emptyMessage={emptyMessage}
      noSessionMessage="GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다."
    />
  )
}
