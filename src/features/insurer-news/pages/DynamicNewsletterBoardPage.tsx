import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import GaRequiredNotice from '../../../components/access/GaRequiredNotice'
import { formatTimestampSearchHaystack } from '../../../utils/displayDateTime'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { getDynamicNewsletterBoardFeed } from '../services/insurerNews.service'
import type { NewsletterBoard, NewsletterItem } from '../types'
import { isGaOnlyNewsletterBoard } from '../utils/newsletterBoardScope'
import DynamicNewsletterBoardMobileView from './DynamicNewsletterBoard/DynamicNewsletterBoardMobileView'
import DynamicNewsletterBoardPCView from './DynamicNewsletterBoard/DynamicNewsletterBoardPCView'
import type { DynamicNewsletterBoardViewProps } from './DynamicNewsletterBoard/dynamicNewsletterBoardViewProps'

export function DynamicNewsletterBoardPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const { user, token } = useAuth()
  const isPublicAccount = isPublicGeneralAccount(user)
  const [board, setBoard] = useState<NewsletterBoard | null>(null)
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessForbidden, setAccessForbidden] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || !boardSlug.trim()) {
      setBoard(null)
      setItems([])
      setAccessForbidden(false)
      setLoading(false)
      setError('소식지 메뉴를 불러올 수 없습니다.')
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setError('')
    setAccessForbidden(false)
    void getDynamicNewsletterBoardFeed(boardSlug, token)
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.kind === 'success') {
          setBoard(result.board)
          setItems(result.newsletters)
          return
        }
        setBoard(null)
        setItems([])
        if (result.kind === 'forbidden') {
          setAccessForbidden(true)
          return
        }
        if (result.kind === 'not_found') {
          setError(result.message)
          return
        }
        setError(result.message)
      })
      .catch((e) => {
        if (!cancelled) {
          setBoard(null)
          setItems([])
          setError(e instanceof Error ? e.message : '소식지 목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [boardSlug, token])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return items
    }
    return items.filter((item) =>
      [item.insurerName, item.title, item.summary, item.publishedAt, formatTimestampSearchHaystack(item.publishedAt)]
        .map((value) => String(value ?? '').toLowerCase())
        .join('\n')
        .includes(q),
    )
  }, [items, searchQuery])

  const showGaRequiredNotice =
    isPublicAccount &&
    !loading &&
    (accessForbidden || (board != null && isGaOnlyNewsletterBoard(board)))

  if (showGaRequiredNotice) {
    return <GaRequiredNotice />
  }

  const viewProps: DynamicNewsletterBoardViewProps = {
    boardSlug,
    board,
    items: filteredItems,
    error,
    loading,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    openPathPrefix: `/portal/boards/${encodeURIComponent(boardSlug)}`,
    noSearchResults: searchQuery.trim() !== '' && filteredItems.length === 0,
  }

  return (
    <ResponsiveLayout<DynamicNewsletterBoardViewProps>
      PC={DynamicNewsletterBoardPCView}
      Mobile={DynamicNewsletterBoardMobileView}
      viewProps={viewProps}
    />
  )
}
