import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../form'
import { useAuth } from '../../features/auth/AuthProvider'
import { listVisibleNewsletterBoards } from '../../features/insurer-news/services/insurerNews.service'
import { isGlobalNewsletterBoard } from '../../features/insurer-news/utils/newsletterBoardScope'
import './ga-required-notice.css'

export type GaRequiredNoticeProps = {
  /** 미지정 시 로그인 세션에서 첫 공용 소식지 경로를 조회한다. */
  publicNewsletterPath?: string
}

/**
 * GA 소속이 없는 공용(GENERAL) 계정이 GA 전용 메뉴에 접근할 때 표시한다.
 */
export default function GaRequiredNotice({ publicNewsletterPath }: GaRequiredNoticeProps) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const staticPath = publicNewsletterPath?.trim() || null
  const [asyncPath, setAsyncPath] = useState<string | null>(null)

  useEffect(() => {
    if (staticPath) {
      return undefined
    }
    if (!token?.trim()) {
      setAsyncPath('/dashboard')
      return undefined
    }
    let cancelled = false
    void listVisibleNewsletterBoards(token)
      .then((boards) => {
        if (cancelled) {
          return
        }
        const globalBoard = boards.find((board) => isGlobalNewsletterBoard(board))
        if (globalBoard?.slug) {
          setAsyncPath(`/portal/boards/${encodeURIComponent(globalBoard.slug)}`)
          return
        }
        setAsyncPath('/dashboard')
      })
      .catch(() => {
        if (!cancelled) {
          setAsyncPath('/dashboard')
        }
      })
    return () => {
      cancelled = true
    }
  }, [staticPath, token])

  const resolvedPublicNewsletterPath = staticPath ?? asyncPath ?? '/dashboard'

  const handlePublicNewsletter = () => {
    navigate(resolvedPublicNewsletterPath || '/dashboard')
  }

  return (
    <main className="page page--with-back ga-required-notice-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>안내</h1>
        </div>
      </header>
      <section className="ga-required-notice-page__card" aria-labelledby="ga-required-notice-title">
        <h2 id="ga-required-notice-title" className="ga-required-notice-page__title">
          공용 계정에서는 사용할 수 없는 메뉴입니다.
        </h2>
        <p className="ga-required-notice-page__text">
          이 기능은 GA 소속 계정 전용 기능입니다.
          <br />
          공용 계정에서는 공용 소식지만 확인할 수 있습니다.
        </p>
        <div className="ga-required-notice-page__actions">
          <FormButton type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            대시보드 돌아가기
          </FormButton>
          <FormButton type="button" variant="primary" onClick={handlePublicNewsletter}>
            공용 소식지 보기
          </FormButton>
        </div>
      </section>
    </main>
  )
}
