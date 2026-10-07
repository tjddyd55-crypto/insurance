import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import GaRestrictedFeatureNotice from '../../../components/access/GaRestrictedFeatureNotice'
import { formatTimestampSearchHaystack } from '../../../utils/displayDateTime'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { getDynamicNewsletterBoardFeed } from '../services/insurerNews.service'
import { isGaOnlyNewsletterBoard } from '../utils/newsletterBoardScope'
import DynamicNewsletterBoardMobileView from './DynamicNewsletterBoard/DynamicNewsletterBoardMobileView'
import DynamicNewsletterBoardPCView from './DynamicNewsletterBoard/DynamicNewsletterBoardPCView'
import type { DynamicNewsletterBoardViewProps } from './DynamicNewsletterBoard/dynamicNewsletterBoardViewProps'

export function DynamicNewsletterBoardPage() {
  const { boardSlug = '' } = useParams<{ boardSlug: string }>()
  const { user, token } = useAuth()
  const isPublicAccount = isPublicGeneralAccount(user)
  const [searchQuery, setSearchQuery] = useState('')
  const canLoad = Boolean(token?.trim() && boardSlug.trim())
  const idleError = '소식지 메뉴를 불러올 수 없습니다.'

  const query = useQuery({
    queryKey: ['dynamic-newsletter-board-feed', boardSlug, token],
    queryFn: () => getDynamicNewsletterBoardFeed(boardSlug, token!),
    enabled: canLoad,
  })

  const board = query.data?.kind === 'success' ? query.data.board : null
  const items = query.data?.kind === 'success' ? query.data.newsletters : []
  const accessForbidden = query.data?.kind === 'forbidden'
  const feedError =
    query.data?.kind === 'not_found' || query.data?.kind === 'error'
      ? query.data.message
      : query.isError
        ? query.error instanceof Error
          ? query.error.message
          : '소식지 목록을 불러오지 못했습니다.'
        : ''

  const viewBoard = canLoad ? board : null
  const viewItems = canLoad ? items : []
  const viewLoading = canLoad ? query.isLoading : false
  const viewError = canLoad ? feedError : idleError
  const viewAccessForbidden = canLoad ? accessForbidden : false

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return viewItems
    }
    return viewItems.filter((item) =>
      [item.authorDisplayName, item.authorName, item.insurerName, item.title, item.summary, item.publishedAt, formatTimestampSearchHaystack(item.publishedAt)]
        .map((value) => String(value ?? '').toLowerCase())
        .join('\n')
        .includes(q),
    )
  }, [searchQuery, viewItems])

  const showGaRequiredNotice =
    isPublicAccount &&
    !viewLoading &&
    (viewAccessForbidden || (viewBoard != null && isGaOnlyNewsletterBoard(viewBoard)))

  if (showGaRequiredNotice) {
    return <GaRestrictedFeatureNotice feature="loss-adjuster-board" />
  }

  const viewProps: DynamicNewsletterBoardViewProps = {
    boardSlug,
    board: viewBoard,
    items: filteredItems,
    error: viewError,
    loading: viewLoading,
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
