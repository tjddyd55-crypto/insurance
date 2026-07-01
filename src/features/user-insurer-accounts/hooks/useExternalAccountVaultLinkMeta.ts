import { useEffect } from 'react'
import {
  EXTERNAL_ACCOUNT_VAULT_LINK_DESCRIPTION,
  formatExternalAccountVaultLinkTitle,
} from '../api/accountVaultAdapter'

const DEFAULT_APP_HTML_TITLE = 'ONE FC'

function ensureMeta(selector: string, build: () => HTMLMetaElement): HTMLMetaElement {
  const existing = document.head.querySelector(selector)
  if (existing instanceof HTMLMetaElement) {
    return existing
  }
  const created = build()
  document.head.appendChild(created)
  return created
}

/** 외부 계정관리 share URL — document title / OG / twitter 메타 동기화 */
export function useExternalAccountVaultLinkMeta(ownerDisplayName: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const resolvedName = String(ownerDisplayName ?? '').trim()
    if (!resolvedName) {
      return undefined
    }

    const linkTitle = formatExternalAccountVaultLinkTitle(resolvedName)
    const prevTitle = document.title
    document.title = linkTitle

    const metaDesc = ensureMeta('meta[name="description"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      return meta
    })
    const prevDesc = metaDesc.getAttribute('content') ?? ''
    metaDesc.setAttribute('content', EXTERNAL_ACCOUNT_VAULT_LINK_DESCRIPTION)

    const ogTitle = ensureMeta('meta[property="og:title"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:title')
      return meta
    })
    const prevOgTitle = ogTitle.getAttribute('content') ?? ''
    ogTitle.setAttribute('content', linkTitle)

    const ogDescription = ensureMeta('meta[property="og:description"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:description')
      return meta
    })
    const prevOgDescription = ogDescription.getAttribute('content') ?? ''
    ogDescription.setAttribute('content', EXTERNAL_ACCOUNT_VAULT_LINK_DESCRIPTION)

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'twitter:title')
      return meta
    })
    const prevTwitterTitle = twitterTitle.getAttribute('content') ?? ''
    twitterTitle.setAttribute('content', linkTitle)

    const twitterDescription = ensureMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'twitter:description')
      return meta
    })
    const prevTwitterDescription = twitterDescription.getAttribute('content') ?? ''
    twitterDescription.setAttribute('content', EXTERNAL_ACCOUNT_VAULT_LINK_DESCRIPTION)

    return () => {
      document.title = prevTitle || DEFAULT_APP_HTML_TITLE
      metaDesc.setAttribute('content', prevDesc)
      ogTitle.setAttribute('content', prevOgTitle)
      ogDescription.setAttribute('content', prevOgDescription)
      twitterTitle.setAttribute('content', prevTwitterTitle)
      twitterDescription.setAttribute('content', prevTwitterDescription)
    }
  }, [enabled, ownerDisplayName])
}
