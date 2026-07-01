import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import {
  createExternalAccountVaultAdapter,
  formatExternalAccountVaultTitle,
  type AccountVaultAdapter,
} from '../api/accountVaultAdapter'
import { fetchExternalAccountVaultMeta } from '../api/externalAccountVaultApi'
import ExternalAccountVaultPCView from './external-account-vault/ExternalAccountVaultPCView'
import ExternalAccountVaultMobileView from './external-account-vault/ExternalAccountVaultMobileView'

export type ExternalAccountVaultViewProps = {
  adapter: AccountVaultAdapter | null
  title: string
  metaLoading: boolean
  metaError: string
}

export default function ExternalAccountVaultPage() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const shareToken = String(tokenParam ?? '').trim()
  const adapter = useMemo(() => createExternalAccountVaultAdapter(shareToken), [shareToken])
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)
  const [metaError, setMetaError] = useState('')

  useEffect(() => {
    if (!shareToken) {
      setMetaError('유효하지 않은 링크입니다.')
      setMetaLoading(false)
      return
    }
    let cancelled = false
    setMetaLoading(true)
    setMetaError('')
    void fetchExternalAccountVaultMeta(shareToken)
      .then((meta) => {
        if (cancelled) {
          return
        }
        setOwnerDisplayName(meta.ownerDisplayName ?? '')
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setOwnerDisplayName('')
        setMetaError(error instanceof ApiError ? error.message : '링크 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setMetaLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [shareToken])

  const title = formatExternalAccountVaultTitle(ownerDisplayName)

  return (
    <ResponsiveLayout<ExternalAccountVaultViewProps>
      PC={ExternalAccountVaultPCView}
      Mobile={ExternalAccountVaultMobileView}
      viewProps={{
        adapter: metaError ? null : adapter,
        title,
        metaLoading,
        metaError,
      }}
    />
  )
}
