import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import {
  clearPublicBoardWriterSession,
  getPublicBoardWriterToken,
  listBoardWriterNewsletters,
  PUBLIC_BOARD_WRITER_EXIT_PATH,
} from '../services/publicBoardWriter.service'
import type { NewsletterItem } from '../types'
import type { BoardWriterOutletContext } from './BoardWriterWorkspaceLayout'
import BoardWriterNewsListMobileView from './BoardWriterNews/BoardWriterNewsListMobileView'
import BoardWriterNewsListPCView from './BoardWriterNews/BoardWriterNewsListPCView'
import type { BoardWriterNewsListViewProps } from './BoardWriterNews/boardWriterNewsListViewProps'

export function BoardWriterNewsListPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const { board, viewLabel } = useOutletContext<BoardWriterOutletContext>()
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const token = getPublicBoardWriterToken()
    if (!token?.trim()) {
      navigate(PUBLIC_BOARD_WRITER_EXIT_PATH, { replace: true })
      return
    }
    if (!boardSlug.trim() || board.slug !== boardSlug) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const rows = await listBoardWriterNewsletters(token, boardSlug)
        if (!cancelled) {
          setItems(rows)
        }
      } catch {
        if (!cancelled) {
          clearPublicBoardWriterSession()
          navigate(PUBLIC_BOARD_WRITER_EXIT_PATH, { replace: true })
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
  }, [board.slug, boardSlug, navigate])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return items
    }
    return items.filter((item) =>
      [item.insurerName, item.title, item.summary, item.publishedAt]
        .map((value) => String(value ?? '').toLowerCase())
        .join('\n')
        .includes(q),
    )
  }, [items, searchQuery])

  const listPathPrefix = `/board-writer/boards/${encodeURIComponent(boardSlug)}/news`
  const viewProps: BoardWriterNewsListViewProps = {
    pageTitle: viewLabel,
    items: filteredItems,
    error,
    loading,
    emptyMessage: '등록된 소식지가 없습니다.',
    listPathPrefix,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    noSearchResults: searchQuery.trim() !== '' && filteredItems.length === 0,
  }

  return (
    <ResponsiveLayout<BoardWriterNewsListViewProps>
      PC={BoardWriterNewsListPCView}
      Mobile={BoardWriterNewsListMobileView}
      viewProps={viewProps}
    />
  )
}
