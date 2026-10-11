import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  archiveAdminNotice,
  deleteAdminNotice,
  fetchAdminNotices,
  publishAdminNotice,
  setAdminNoticePopup,
} from '../api/adminNoticesApi'
import type { AdminNotice } from '../types/adminNotice.types'
import type { AdminNoticeConsoleVariant } from '../adminNoticeConsole'
import { adminNoticePageRoot } from '../adminNoticeConsole'

type AdminNoticeListPageProps = {
  variant?: AdminNoticeConsoleVariant
}

const STATUS_LABEL: Record<AdminNotice['status'], string> = {
  draft: '임시저장',
  published: '게시',
  archived: '보관',
}

export default function AdminNoticeListPage({ variant = 'platform' }: AdminNoticeListPageProps) {
  const { token } = useAuth()
  const pageRoot = adminNoticePageRoot(variant)
  const pageTitle = variant === 'ga' ? '공지사항' : '공지사항 관리'
  const pageDesc =
    variant === 'ga'
      ? '소속 GA 사용자에게만 노출되는 공지를 작성합니다.'
      : '로그인/첫 진입 팝업으로 표시할 관리자 공지를 작성합니다.'
  const [items, setItems] = useState<AdminNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      setItems(await fetchAdminNotices(token, variant))
    } catch (e) {
      console.error('[admin-notices] failed to load notices', e)
      setError('공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, variant])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (id: number, action: () => Promise<unknown>) => {
    setPendingId(id)
    try {
      await action()
      await load()
    } catch (e) {
      console.error('[admin-notices] failed to run notice action', e)
      setError('처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="page admin-notices-page admin-notices-page--pc page--with-back content-wrapper page-shell">
      <header className="admin-notices-page__header">
        <h1>{pageTitle}</h1>
        <p className="admin-notices-page__desc">{pageDesc}</p>
      </header>

      <div className="admin-notices-page__toolbar">
        <FormButton htmlType="button" variant="primary" onClick={() => void load()} disabled={loading}>
          새로고침
        </FormButton>
        <Link to={`${pageRoot}/new`}>
          <FormButton htmlType="button" variant="secondary">
            공지 작성
          </FormButton>
        </Link>
      </div>

      {loading ? <p className="admin-notices-page__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="admin-notices-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && items.length === 0 ? <p className="admin-notices-page__muted">등록된 공지가 없습니다.</p> : null}

      <div className="admin-notices-page__list">
        {items.map((item) => (
          <article key={item.id} className="admin-notices-page__card">
            <div className="admin-notices-page__card-head">
              <h2>{item.title}</h2>
              <div className="admin-notices-page__badges">
                <span>{STATUS_LABEL[item.status]}</span>
                {item.showAsPopup ? <span className="admin-notices-page__badge--popup">팝업</span> : null}
                {variant === 'platform' && item.audienceScope === 'GA' ? (
                  <span>GA 전용</span>
                ) : null}
              </div>
            </div>
            <p className="admin-notices-page__preview">{item.plainText || '본문 없음'}</p>
            <div className="admin-notices-page__actions">
              <Link to={`${pageRoot}/${item.id}`}>
                <FormButton htmlType="button" variant="secondary" size="sm">
                  수정
                </FormButton>
              </Link>
              {item.status !== 'published' ? (
                <FormButton
                  htmlType="button"
                  variant="primary"
                  size="sm"
                  disabled={pendingId === item.id}
                  onClick={() => void runAction(item.id, () => publishAdminNotice(token!, item.id, variant))}
                >
                  게시
                </FormButton>
              ) : null}
              {item.status === 'published' && !item.showAsPopup ? (
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  size="sm"
                  disabled={pendingId === item.id}
                  onClick={() => void runAction(item.id, () => setAdminNoticePopup(token!, item.id, variant))}
                >
                  팝업 설정
                </FormButton>
              ) : null}
              {item.status !== 'archived' ? (
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  size="sm"
                  disabled={pendingId === item.id}
                  onClick={() => void runAction(item.id, () => archiveAdminNotice(token!, item.id, variant))}
                >
                  보관
                </FormButton>
              ) : null}
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                disabled={pendingId === item.id}
                onClick={() => void runAction(item.id, () => deleteAdminNotice(token!, item.id, variant))}
              >
                삭제
              </FormButton>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
