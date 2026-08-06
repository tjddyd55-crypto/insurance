import { useCallback, useEffect, useState } from 'react'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import type { InsurerSite, InsurerSiteCategory } from '../api/insurerSitesApi'
import { fetchActiveInsurerSites } from '../api/insurerSitesApi'
import { InsurerSiteLogoMark } from '../components/InsurerSiteLogoMark'
import { safeOpenUrl } from '../lib/insurerSiteLinks'
import '../insurer-sites.css'

function SecondaryLink(props: { label: string; url: string }) {
  const has = Boolean(String(props.url ?? '').trim())
  return (
    <FormButton
      htmlType="button"
      variant="secondary"
      className="insurer-site-card__secondary-btn"
      disabled={!has}
      tabIndex={has ? undefined : -1}
      aria-label={has ? `${props.label} (새 창)` : `${props.label} 연결 없음`}
      onClick={() => {
        if (has) safeOpenUrl(props.url)
      }}
    >
      {props.label}
    </FormButton>
  )
}

export default function InsurerSitesPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<InsurerSiteCategory>('non_life')
  const [items, setItems] = useState<InsurerSite[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetchActiveInsurerSites(token, tab)
      setItems(Array.isArray(res.items) ? res.items : [])
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, tab])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="page page--with-back insurer-sites-page">
      <header className="page-header">
        <h1>보험사 설계사이트</h1>
        <p>보험사별 설계사이트, 공식 홈페이지와 공시실로 빠르게 이동할 수 있습니다.</p>
      </header>

      <div className="insurer-sites-tabs" role="tablist" aria-label="보험 구분">
        {(
          [
            { id: 'non_life' as const, label: '손해보험사' },
            { id: 'life' as const, label: '생명보험사' },
          ] as const
        ).map((t) => {
          const active = tab === t.id
          return (
            <FormButton
              key={t.id}
              htmlType="button"
              role="tab"
              aria-selected={active}
              variant={active ? 'primary' : 'secondary'}
              className={`insurer-sites-tabs__btn${active ? ' insurer-sites-tabs__btn--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </FormButton>
          )
        })}
      </div>

      {error ? (
        <p className="text-error" style={{ margin: '0 0 12px' }}>
          {error}
        </p>
      ) : null}
      {loading ? <p style={{ margin: 0 }}>불러오는 중…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>표시할 보험사가 없습니다.</p>
      ) : null}

      <div className="insurer-sites-grid">
        {items.map((site) => {
          const sales = String(site.salesUrl ?? '').trim()
          return (
            <article key={site.id} className="insurer-site-card">
              <div className="insurer-site-card__logo">
                <InsurerSiteLogoMark name={site.name} logoPath={site.logoPath} variant="userCard" />
              </div>
              <h2 className="insurer-site-card__name">{site.name}</h2>
              <FormButton
                htmlType="button"
                variant="primary"
                fullWidth
                className="insurer-site-card__primary"
                disabled={!sales}
                tabIndex={sales ? undefined : -1}
                aria-label={sales ? '설계사이트 (새 창)' : '설계사이트 연결 없음'}
                onClick={() => {
                  if (sales) safeOpenUrl(site.salesUrl)
                }}
              >
                설계사이트 →
              </FormButton>
              <div className="insurer-site-card__secondary">
                <SecondaryLink label="공식홈" url={site.homepageUrl} />
                <SecondaryLink label="공시실" url={site.disclosureUrl} />
              </div>
            </article>
          )
        })}
      </div>

      <aside className="insurer-sites-notice" aria-label="안내사항">
        <h2 className="insurer-sites-notice__title">안내사항</h2>
        <p className="insurer-sites-notice__body">
          각 버튼을 선택하면 해당 보험회사의 설계사이트, 공식 홈페이지 또는 공시실이 새 창에서
          열립니다. 연결되지 않은 메뉴는 비활성 상태로 표시됩니다.
        </p>
      </aside>
    </main>
  )
}
