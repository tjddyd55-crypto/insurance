import { useState } from 'react'
import './newsletterCollections.css'
import { FormButton } from '../../../../components/form'
import { NewsletterAddToBinderDialog } from './NewsletterAddToBinderDialog'
import { NewsletterAddToFolderDialog } from './NewsletterAddToFolderDialog'
import type { NewsletterCollectionsState } from './useNewsletterCollections'

/** 소식지 상세 헤더: ☆ 즐겨찾기 / 내 폴더에 담기 / 내 바인더에 담기 (+ 폴더 보기 중이면 폴더에서 빼기). */
export function NewsletterCollectionDetailActions({
  token,
  newsletterId,
  collections,
  onNotice,
  onRemoveFromFolder,
  removeFromFolderLabel,
}: {
  token: string | null | undefined
  newsletterId: string
  collections: NewsletterCollectionsState
  onNotice: (message: string) => void
  onRemoveFromFolder?: () => void
  removeFromFolderLabel?: string
}) {
  const [folderOpen, setFolderOpen] = useState(false)
  const [binderOpen, setBinderOpen] = useState(false)
  const [starBusy, setStarBusy] = useState(false)
  const favorite = collections.isFavorite(newsletterId)

  const toggleStar = async () => {
    if (starBusy) return
    setStarBusy(true)
    try {
      await collections.toggleFavorite(newsletterId)
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '즐겨찾기를 바꾸지 못했습니다.')
    } finally {
      setStarBusy(false)
    }
  }

  return (
    <>
      <FormButton
        variant="secondary"
        size="sm"
        disabled={starBusy}
        aria-pressed={favorite}
        aria-label={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
        title={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
        className={`newsletter-star-button${favorite ? ' is-on' : ''}`}
        onClick={() => void toggleStar()}
      >
        {favorite ? '★' : '☆'}
      </FormButton>
      <FormButton
        variant="secondary"
        size="sm"
        className="newsletter-collection-action"
        aria-label="내 폴더에 담기"
        onClick={() => setFolderOpen(true)}
      >
        <span className="newsletter-collection-action__long">내 폴더에 담기</span>
        <span className="newsletter-collection-action__short" aria-hidden="true">폴더</span>
      </FormButton>
      <FormButton
        variant="secondary"
        size="sm"
        className="newsletter-collection-action"
        aria-label="내 바인더에 담기"
        onClick={() => setBinderOpen(true)}
      >
        <span className="newsletter-collection-action__long">내 바인더에 담기</span>
        <span className="newsletter-collection-action__short" aria-hidden="true">바인더</span>
      </FormButton>
      {onRemoveFromFolder ? (
        <FormButton variant="secondary" size="sm" onClick={onRemoveFromFolder}>
          {removeFromFolderLabel ?? '폴더에서 빼기'}
        </FormButton>
      ) : null}
      <NewsletterAddToFolderDialog
        open={folderOpen}
        token={token}
        newsletterIds={[newsletterId]}
        collections={collections.data}
        onClose={() => setFolderOpen(false)}
        onDone={(message) => {
          onNotice(message)
          void collections.refresh()
        }}
      />
      <NewsletterAddToBinderDialog
        open={binderOpen}
        token={token}
        newsletterIds={[newsletterId]}
        onClose={() => setBinderOpen(false)}
        onDone={(message) => onNotice(message)}
      />
    </>
  )
}
