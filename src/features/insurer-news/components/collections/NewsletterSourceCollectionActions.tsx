import { useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../../auth/generalGa'
import { NewsletterCollectionDetailActions } from './NewsletterCollectionDetailActions'
import { useNewsletterCollections } from './useNewsletterCollections'

/**
 * t299 — GA/공용 게시판 소식지 상세 헤더용 ☆ / 내 폴더에 담기 / 내 바인더에 담기.
 * 원수사 상세와 같은 NewsletterCollectionDetailActions 를 쓰고, 서버가 원본 열람 권한을 다시 확인한다.
 */
export function NewsletterSourceCollectionActions({ newsletterId }: { newsletterId: string }) {
  const { user, token } = useAuth()
  const enabled = Boolean(newsletterId) && !isPublicGeneralAccount(user)
  const collections = useNewsletterCollections(token, enabled)
  const [notice, setNotice] = useState('')
  if (!enabled) return null
  return (
    <>
      {notice ? (
        <span className="newsletter-collections-header-notice" role="status" title={notice}>
          {notice}
        </span>
      ) : null}
      <NewsletterCollectionDetailActions
        token={token}
        newsletterId={newsletterId}
        collections={collections}
        onNotice={setNotice}
      />
    </>
  )
}
