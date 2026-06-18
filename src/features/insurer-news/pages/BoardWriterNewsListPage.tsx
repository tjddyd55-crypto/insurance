import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import {
  getPublicBoardWriterToken,
  listBoardWriterNewsletters,
  listPublicBoardWriterBoards,
  setPublicBoardWriterToken,
} from '../services/publicBoardWriter.service'
import type { NewsletterItem } from '../types'
import BoardWriterNewsListMobileView from './BoardWriterNews/BoardWriterNewsListMobileView'
import BoardWriterNewsListPCView from './BoardWriterNews/BoardWriterNewsListPCView'
import type { BoardWriterNewsListViewProps } from './BoardWriterNews/boardWriterNewsListViewProps'

export function BoardWriterNewsListPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [boardLabel, setBoardLabel] = useState('')
  const [boardScopeLabel, setBoardScopeLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const token = getPublicBoardWriterToken()
    if (!token?.trim()) {
      navigate('/board-writer/login', { replace: true })
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
        const board = boards.find((row) => row.slug === boardSlug)
        if (!board) {
          if (!cancelled) {
            setError('작성 권한이 없는 소식지입니다.')
            setItems([])
            setLoading(false)
          }
          return
        }
        if (!cancelled) {
          setBoardLabel(board.label)
          setBoardScopeLabel(board.boardScope === 'global' ? '공용 소식지' : 'GA전용 소식지')
        }
        const rows = await listBoardWriterNewsletters(token, boardSlug)
        if (!cancelled) {
          setItems(rows)
        }
      } catch {
        if (!cancelled) {
          setPublicBoardWriterToken(null)
          navigate('/board-writer/login', { replace: true })
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
    boardLabel: boardLabel || '소식지',
    boardScopeLabel,
    items: filteredItems,
    error,
    loading,
    emptyMessage: '등록된 소식지가 없습니다.',
    listPathPrefix,
    uploadPath: `${listPathPrefix}/upload`,
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
