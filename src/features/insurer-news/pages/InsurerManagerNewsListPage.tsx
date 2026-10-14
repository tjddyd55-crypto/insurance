import { useCallback, useEffect, useMemo, useState } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import GaRestrictedFeatureNotice from '../../../components/access/GaRestrictedFeatureNotice'
import { useConfirmDialog } from '../../../components/dialog'
import { formatTimestampSearchHaystack } from '../../../utils/displayDateTime'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import {
  deleteManagerNewsletter,
  getAllPublishedForGa,
  getNewslettersForInsurerManagerCompany,
} from '../services/insurerNews.service'
import type { NewsChannel, NewsletterItem } from '../types'
import { canDeleteNewsletter } from '../utils/newsletterDeletePermission'
import InsurerManagerNewsListMobileView from './InsurerManagerNewsList/InsurerManagerNewsListMobileView'
import {
  NewsletterCollectionsNav,
  type NewsletterCollectionView,
} from '../components/collections/NewsletterCollectionsNav'
import { NewsletterCollectionDetailActions } from '../components/collections/NewsletterCollectionDetailActions'
import { NewsletterFolderAddItemsDialog } from '../components/collections/NewsletterFolderAddItemsDialog'
import { useNewsletterCollections } from '../components/collections/useNewsletterCollections'
import { removeNewsletterFromFolder } from '../services/newsletterCollections.service'
import InsurerManagerNewsListPCView from './InsurerManagerNewsList/InsurerManagerNewsListPCView'
import type { InsurerManagerNewsListViewProps } from './InsurerManagerNewsList/insurerManagerNewsListViewProps'

type InsurerManagerNewsListPageProps = {
  channel?: NewsChannel
  title?: string
  subtitle?: string
  openPathPrefix?: string
  emptyMessage?: string
  fetchScope?: 'manager' | 'ga'
  noSessionMessage?: string
  /** 개인 폴더·즐겨찾기·내 바인더 담기 (GA 원수사 소식지 허브 전용 opt-in). */
  enableCollections?: boolean
}

/**
 * 원수사(또는 손해사정사) 담당자 소식지 목록 라우트 container.
 *
 * 책임:
 *   1. 라우트 호출부에서 전달받은 props 로 목록 조회 파라미터를 확정한다.
 *   2. 세션·GA 코드·회사 스코프 가드 (noSession 화면).
 *   3. 목록 아이템 로딩 (items / error).
 *   4. PC/Mobile View 로 분기 위임 (`ResponsiveLayout<ViewProps>`).
 *
 * 상세 조회·모달·줌 같은 PC 전용 상태는 `InsurerManagerNewsListPCView` 가 보유한다
 * (container 에 두면 Mobile 번들에도 코드가 섞이고, Mobile 이 인라인 모달을 쓰지
 * 않으므로 의미도 없다).
 *
 * 공개 props 시그니처는 기존과 **완전히 동일** 하다:
 *   - `/insurer/news` 라우트 직접 호출 (기본값)
 *   - `NewsletterHubPage` 에서 props 주입
 *   - `LossAdjusterManagerNewsListPage` 에서 props 주입
 * 세 호출처 모두 이번 리팩토링의 영향 없음 (시그니처 유지).
 */
export function InsurerManagerNewsListPage({
  channel = 'INSURER',
  title = '원수사 소식지 조회',
  subtitle = '',
  openPathPrefix = '/insurer/news',
  emptyMessage = '등록된 소식지가 없습니다.',
  fetchScope = 'manager',
  noSessionMessage = '원수사 담당자 계정(소속 회사 정보 포함)으로 로그인한 후 이용할 수 있습니다.',
  enableCollections = false,
}: InsurerManagerNewsListPageProps) {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const isPublicAccount = isPublicGeneralAccount(user)
  /*
   * GA 전체 공개 피드(`fetchScope === 'ga'`) 는 회사 소속이 없어도 조회 가능하다.
   * 손해사정사 채널은 회사 단위 격리가 아니라 GA 단위로 공유되므로 역시 회사 스코프가
   * 필요 없다 — 이 둘을 제외하면 모두 회사 스코프 필수.
   */
  const requiresCompanyScope = fetchScope === 'manager' && channel !== 'LOSS_ADJUSTER'

  const [items, setItems] = useState<NewsletterItem[]>([])
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState('')
  const collectionsEnabled =
    enableCollections && fetchScope === 'ga' && channel === 'INSURER' && !isPublicAccount
  const collections = useNewsletterCollections(token, collectionsEnabled)
  const [collectionView, setCollectionView] = useState<NewsletterCollectionView>({ kind: 'all' })
  const [collectionNotice, setCollectionNotice] = useState('')
  const [folderAddOpen, setFolderAddOpen] = useState(false)

  const canDeleteItem = useCallback(
    (item: NewsletterItem) => canDeleteNewsletter(item, user),
    [user],
  )

  const handleDeleteItem = useCallback(
    async (item: NewsletterItem): Promise<boolean> => {
      if (!token?.trim() || deleteBusyId) {
        return false
      }
      const confirmed = await confirm({
        title: '소식지 삭제',
        message: '이 소식지를 삭제하시겠습니까?\n삭제한 소식지는 목록에서 보이지 않습니다.',
        tone: 'danger',
        confirmLabel: '삭제',
        cancelLabel: '취소',
      })
      if (!confirmed) {
        return false
      }
      setDeleteBusyId(item.id)
      setDeleteNotice('')
      try {
        await deleteManagerNewsletter(token, item.id, { channel })
        setItems((prev) => prev.filter((row) => row.id !== item.id))
        setDeleteNotice('소식지가 삭제되었습니다.')
        return true
      } catch (e) {
        setDeleteNotice(e instanceof Error ? e.message : '삭제에 실패했습니다.')
        return false
      } finally {
        setDeleteBusyId(null)
      }
    },
    [token, deleteBusyId, confirm, channel],
  )

  useEffect(() => {
    if (isPublicAccount || !token?.trim() || !gaCode || (requiresCompanyScope && companyId == null)) {
      return
    }
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const rows =
          fetchScope === 'ga'
            ? await getAllPublishedForGa(gaCode, token, { channel })
            : await getNewslettersForInsurerManagerCompany(token, gaCode, companyId ?? 0, { channel })
        if (!cancelled) {
          setItems(rows)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchScope, channel, token, gaCode, companyId, requiresCompanyScope, isPublicAccount])

  const collectionScopedItems = useMemo(() => {
    if (!collectionsEnabled || collectionView.kind === 'all') {
      return items
    }
    const ids =
      collectionView.kind === 'favorites'
        ? collections.data.favoriteNewsletterIds
        : collections.data.folders.find((folder) => folder.id === collectionView.folderId)?.newsletterIds ?? []
    const allowed = new Set(ids)
    return items.filter((item) => allowed.has(item.id))
  }, [collectionsEnabled, collectionView, collections.data, items])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return collectionScopedItems
    }
    return collectionScopedItems.filter((item) => {
      const haystack = [
        item.insurerName,
        item.title,
        item.summary,
        item.publishedAt,
        formatTimestampSearchHaystack(item.publishedAt),
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join('\n')
      return haystack.includes(q)
    })
  }, [collectionScopedItems, searchQuery])

  if (isPublicAccount) {
    return (
      <GaRestrictedFeatureNotice
        feature={channel === 'LOSS_ADJUSTER' ? 'loss-adjuster-newsletter' : 'insurer-newsletter'}
      />
    )
  }

  if (!gaCode || (requiresCompanyScope && companyId == null)) {
    return (
      <main className="page page--with-back insurer-news-page">
        <header className="page-header page-header--has-inline-back">
          <div className="page-header__title-row">
            <h1>{title}</h1>
          </div>
        </header>
        <div className="insurer-news-empty">{noSessionMessage}</div>
      </main>
    )
  }

  const viewProps: InsurerManagerNewsListViewProps = {
    items: filteredItems,
    error,
    title,
    subtitle,
    emptyMessage,
    openPathPrefix,
    channel,
    fetchScope,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    noSearchResults: searchQuery.trim() !== '' && filteredItems.length === 0,
    onDeleteItem: handleDeleteItem,
    canDeleteItem,
    deleteBusyId,
    deleteNotice: deleteNotice || collectionNotice,
  }

  const activeFolder =
    collectionView.kind === 'folder'
      ? collections.data.folders.find((folder) => folder.id === collectionView.folderId) ?? null
      : null

  if (collectionsEnabled) {
    viewProps.collectionsNav = (
      <NewsletterCollectionsNav
        token={token}
        collections={collections}
        view={collectionView}
        onViewChange={(next) => {
          setCollectionView(next)
          setCollectionNotice('')
        }}
        totalCount={items.length}
        onAddItems={() => setFolderAddOpen(true)}
        onNotice={setCollectionNotice}
      />
    )
    if (collectionView.kind === 'favorites') {
      viewProps.collectionEmptyMessage = '즐겨찾기한 소식지가 없습니다. 소식지 상세에서 ☆ 를 눌러 추가하세요.'
    } else if (activeFolder) {
      viewProps.collectionEmptyMessage = '폴더가 비어 있습니다. [소식지 추가] 로 담아 보세요.'
    }
    viewProps.renderDetailCollectionActions = (item, closeDetail) => (
      <NewsletterCollectionDetailActions
        token={token}
        newsletterId={item.id}
        collections={collections}
        onNotice={setCollectionNotice}
        onRemoveFromFolder={
          activeFolder
            ? () => {
                void (async () => {
                  try {
                    await removeNewsletterFromFolder(token, activeFolder.id, item.id)
                    setCollectionNotice(`'${activeFolder.name}'에서 뺐습니다. 원본 소식지는 그대로 남아 있습니다.`)
                    closeDetail()
                    await collections.refresh()
                  } catch (e) {
                    setCollectionNotice(e instanceof Error ? e.message : '폴더에서 빼지 못했습니다.')
                  }
                })()
              }
            : undefined
        }
      />
    )
  }

  return (
    <>
      {confirmDialog}
      {collectionsEnabled ? (
        <NewsletterFolderAddItemsDialog
          open={folderAddOpen}
          token={token}
          folder={activeFolder}
          items={items}
          collections={collections.data}
          onClose={() => setFolderAddOpen(false)}
          onAdded={(message) => {
            setCollectionNotice(message)
            void collections.refresh()
          }}
        />
      ) : null}
      <ResponsiveLayout<InsurerManagerNewsListViewProps>
        PC={InsurerManagerNewsListPCView}
        Mobile={InsurerManagerNewsListMobileView}
        viewProps={viewProps}
      />
    </>
  )
}
