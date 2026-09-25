import { useCallback, useEffect, useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import { useAuth } from '../../auth/AuthProvider'
import {
  listCoverageSimulationShares,
  revokeCoverageSimulationShare,
  type CoverageShareListItem,
} from '../api/coverageSimulatorShareApi'
import { copyTextToClipboard } from '../lib/clipboard'

type Props = {
  consultationId: string
  showToast: (message: string) => void
}

function formatShareDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${d} ${hh}:${mm}`
}

export function CoverageShareHistoryPanel({ consultationId, showToast }: Props) {
  const { token } = useAuth()
  const [shares, setShares] = useState<CoverageShareListItem[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!token || !consultationId) return
    setLoading(true)
    try {
      const res = await listCoverageSimulationShares(token, consultationId)
      setShares(res.shares)
    } catch {
      showToast('공유 이력을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [consultationId, showToast, token])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!token) return null

  const revoke = async (shareId: string) => {
    if (!token) return
    try {
      await revokeCoverageSimulationShare(token, shareId)
      showToast('공유를 중지했습니다.')
      await reload()
    } catch {
      showToast('공유 중지에 실패했습니다.')
    }
  }

  const copyLink = async (url: string | null) => {
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }

  if (!loading && shares.length === 0) return null

  return (
    <section className="cs-share-history" aria-label="공유 이력">
      <h2 className="cs-share-history__title">공유 이력</h2>
      {loading ? <p className="cs-share-history__muted">불러오는 중…</p> : null}
      <ul className="cs-share-history__list">
        {shares.map((entry) => (
          <li key={entry.shareId} className="cs-share-history__item">
            <div className="cs-share-history__meta">
              <span>{formatShareDate(entry.createdAt)}</span>
              {entry.revokedAt ? <span className="cs-share-history__revoked">중지됨</span> : null}
            </div>
            <div className="cs-share-history__actions">
              <FormButton
                variant="secondary"
                className="coverage-simulator-secondary-btn cs-share-history__btn"
                disabled={!entry.shareUrl}
                onClick={() => void copyLink(entry.shareUrl)}
              >
                링크 복사
              </FormButton>
              {!entry.revokedAt ? (
                <FormButton
                  variant="secondary"
                  className="coverage-simulator-secondary-btn cs-share-history__btn"
                  onClick={() => void revoke(entry.shareId)}
                >
                  공유 중지
                </FormButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
