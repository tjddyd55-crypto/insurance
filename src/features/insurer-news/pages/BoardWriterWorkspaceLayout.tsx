import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import useIsMobile from '../../../hooks/useIsMobile'
import { BoardWriterNavigation } from '../components/BoardWriterNavigation'
import {
  buildBoardWriterNavItems,
  buildBoardWriterNavLabels,
  type BoardWriterNavItem,
} from '../config/boardWriterNavigation'
import {
  clearPublicBoardWriterSession,
  getPublicBoardWriterToken,
  listPublicBoardWriterBoards,
  PUBLIC_BOARD_WRITER_EXIT_PATH,
  type PublicBoardWriterBoard,
} from '../services/publicBoardWriter.service'
import './board-writer-workspace.css'

const BOARD_WRITER_LOGIN_PATH = '/board-writer/login'

export type BoardWriterOutletContext = {
  board: PublicBoardWriterBoard
  viewLabel: string
  uploadLabel: string
}

type BoardWriterWorkspaceShellProps = {
  title: string
  navItems: BoardWriterNavItem[]
  outletContext: BoardWriterOutletContext
  onLogout: () => void
}

function BoardWriterWorkspacePCLayout({
  title,
  navItems,
  outletContext,
  onLogout,
}: BoardWriterWorkspaceShellProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="pc-root board-writer-workspace-layout board-writer-workspace-layout--pc">
      <header className="board-writer-workspace-layout__header" aria-label="작성자 워크스페이스">
        <div className="board-writer-workspace-layout__header-main">
          <h1 className="board-writer-workspace-layout__title">{title}</h1>
          <BoardWriterNavigation
            items={navItems}
            pathname={location.pathname}
            search={location.search}
            variant="pc"
            onNavigate={(path) => navigate(path)}
          />
        </div>
        <FormButton htmlType="button" variant="secondary" onClick={onLogout}>
          로그아웃
        </FormButton>
      </header>
      <div className="board-writer-workspace-layout__content user-app-shell">
        <Outlet context={outletContext} />
      </div>
    </div>
  )
}

function BoardWriterWorkspaceMobileLayout({
  title,
  navItems,
  outletContext,
  onLogout,
}: BoardWriterWorkspaceShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useBackButtonClose(drawerOpen, () => setDrawerOpen(false))

  return (
    <div className="mobile-root board-writer-workspace-layout board-writer-workspace-layout--mobile">
      {isMobile ? (
        <header className="mobile-topbar board-writer-workspace-layout__mobile-topbar" aria-label="모바일 상단바">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="menu-btn"
            aria-label="메뉴 열기"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((value) => !value)}
          >
            ☰
          </FormButton>
          <div className="title">{title}</div>
        </header>
      ) : null}

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="mobile-workspace-drawer-backdrop board-writer-workspace-layout__drawer-backdrop"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="mobile-workspace-drawer mobile-workspace-drawer--overlay board-writer-workspace-layout__drawer">
            <div className="mobile-workspace-drawer__header">
              <strong>{title}</strong>
            </div>
            <BoardWriterNavigation
              items={navItems}
              pathname={location.pathname}
              search={location.search}
              variant="mobile"
              onNavigate={(path) => {
                navigate(path)
                setDrawerOpen(false)
              }}
            />
            <div className="mobile-workspace-drawer__footer">
              <FormButton
                htmlType="button"
                variant="secondary"
                className="mobile-workspace-drawer__logout"
                onClick={() => {
                  setDrawerOpen(false)
                  onLogout()
                }}
              >
                로그아웃
              </FormButton>
            </div>
          </aside>
        </>
      ) : null}

      <div className="mobile-workspace-content content-wrapper content-wrapper--mobile user-app-shell">
        <Outlet context={outletContext} />
      </div>
    </div>
  )
}

export function BoardWriterWorkspaceLayout() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [board, setBoard] = useState<PublicBoardWriterBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getPublicBoardWriterToken()
    if (!token?.trim()) {
      navigate(BOARD_WRITER_LOGIN_PATH, { replace: true })
      return
    }
    if (!boardSlug.trim()) {
      navigate('/board-writer/workspace', { replace: true })
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const boards = await listPublicBoardWriterBoards(token)
        const matched = boards.find((row) => row.slug === boardSlug)
        if (!matched) {
          if (!cancelled) {
            setBoard(null)
            setError('작성 권한이 없는 소식지입니다.')
          }
          return
        }
        if (!cancelled) {
          setBoard(matched)
        }
      } catch {
        if (!cancelled) {
          clearPublicBoardWriterSession()
          navigate(BOARD_WRITER_LOGIN_PATH, { replace: true })
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
  }, [boardSlug, navigate])

  const navItems = useMemo(
    () => (board ? buildBoardWriterNavItems(board, board.slug) : []),
    [board],
  )
  const labels = useMemo(() => (board ? buildBoardWriterNavLabels(board) : null), [board])

  const handleLogout = () => {
    clearPublicBoardWriterSession()
    navigate(PUBLIC_BOARD_WRITER_EXIT_PATH, { replace: true })
  }

  if (loading) {
    return (
      <main className="page insurer-news-page user-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  if (error || !board || !labels) {
    return (
      <main className="page insurer-news-page user-page">
        <div className="insurer-news-empty">{error || '소식지를 불러오지 못했습니다.'}</div>
      </main>
    )
  }

  const outletContext: BoardWriterOutletContext = {
    board,
    viewLabel: labels.viewLabel,
    uploadLabel: labels.uploadLabel,
  }

  const shellProps: BoardWriterWorkspaceShellProps = {
    title: labels.title,
    navItems,
    outletContext,
    onLogout: handleLogout,
  }

  return isMobile ? (
    <BoardWriterWorkspaceMobileLayout {...shellProps} />
  ) : (
    <BoardWriterWorkspacePCLayout {...shellProps} />
  )
}
