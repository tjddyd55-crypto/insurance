import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import { useAuth } from '../../auth/AuthProvider'
import {
  importSharedPersonalBinder,
  listSharedPersonalBinders,
  type SharedPersonalBinderSummary,
} from '../personalBinderShare.api'
import '../styles/personal-binder.css'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 1) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PersonalBinderSharedPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<SharedPersonalBinderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importTarget, setImportTarget] = useState<SharedPersonalBinderSummary | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      setRows(await listSharedPersonalBinders(token, signal))
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const runImport = async () => {
    if (!token || !importTarget) return
    setImportBusy(true)
    setError('')
    try {
      const idempotencyKey = `import:${importTarget.id}:${Date.now()}`
      const result = await importSharedPersonalBinder(token, importTarget.id, idempotencyKey)
      setImportTarget(null)
      navigate(`/personal-binders/edit/${result.binder.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '가져오기에 실패했습니다.')
    } finally {
      setImportBusy(false)
    }
  }

  if (!token) return <Navigate to="/login" replace />

  return (
    <main className="page personal-binder-page personal-binder-page--compact">
      <header className="personal-binder-page-header personal-binder-page-header--compact">
        <h1>공유 바인더</h1>
        <p>같은 GA 지점에서 공유된 바인더를 열람하고 내 바인더로 가져올 수 있습니다.</p>
      </header>
      {error ? <p className="personal-binder-error">{error}</p> : null}
      <section className="personal-binder-shared" aria-label="공유 바인더">
        <div className="personal-binder-shared__list-region">
          {loading ? <p>불러오는 중…</p> : null}
          {!loading && rows.length === 0 ? (
            <div className="personal-binder-shared__empty">
              <p>아직 공유된 바인더가 없습니다.</p>
              <Link to="/personal-binders">내 바인더로 돌아가기</Link>
            </div>
          ) : null}
          {!loading && rows.length > 0 ? (
            <ul className="personal-binder-shared__list">
              {rows.map((row) => (
                <li key={row.id} className="personal-binder-shared__card">
                  <div>
                    <strong>{row.title}</strong>
                    <p>
                      {row.ownerName ?? row.ownerUserId} · {formatDate(row.createdAt)} · 섹션{' '}
                      {row.sectionCount} · 자료 {row.fileCount}
                    </p>
                  </div>
                  <div className="personal-binder-shared__card-actions">
                    <FormButton
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/personal-binders/shared/${row.id}/view`)}
                    >
                      미리보기
                    </FormButton>
                    <FormButton variant="primary" size="sm" onClick={() => setImportTarget(row)}>
                      내 바인더로 가져오기
                    </FormButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <BaseDialog
        open={importTarget != null}
        onClose={() => !importBusy && setImportTarget(null)}
        closeOnBackdrop={!importBusy}
        ariaLabel="가져오기 확인"
      >
        {importTarget ? (
          <>
            <h2 className="personal-binder-dialog-title">내 바인더로 가져오기</h2>
            <p className="personal-binder-dialog-lead">
              파일은 내 저장 공간(1GB)의 「공유 바인더 / 가져온 바인더명」 폴더에 복사됩니다. 가져온
              후에는 원본과 독립적으로 편집할 수 있습니다.
            </p>
            <dl className="personal-binder-share-dialog__meta">
              <div>
                <dt>바인더</dt>
                <dd>{importTarget.title}</dd>
              </div>
              <div>
                <dt>파일</dt>
                <dd>{importTarget.fileCount}개</dd>
              </div>
              <div>
                <dt>예상 용량</dt>
                <dd>{formatBytes(importTarget.totalBytes)}</dd>
              </div>
            </dl>
            <div className="personal-binder-dialog-actions">
              <FormButton variant="secondary" disabled={importBusy} onClick={() => setImportTarget(null)}>
                취소
              </FormButton>
              <FormButton variant="primary" loading={importBusy} onClick={() => void runImport()}>
                가져오기
              </FormButton>
            </div>
          </>
        ) : null}
      </BaseDialog>
    </main>
  )
}
