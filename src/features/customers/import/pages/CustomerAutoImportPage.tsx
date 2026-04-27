import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../../../../lib/apiClient'
import { useAuth } from '../../../auth/AuthProvider'
import PCOnlySection from '../../../../components/PCOnlySection'
import { Button } from '../../../../components/ui'
import {
  applyCustomerImportJob,
  fetchCustomerImportRows,
  uploadCustomerImportJob,
} from '../api/customerImportApi'
import { CustomerImportRowsTable } from '../components/CustomerImportRowsTable'
import { CustomerImportStatusTabs } from '../components/CustomerImportStatusTabs'
import { CustomerImportSummary } from '../components/CustomerImportSummary'
import { CustomerImportUploader } from '../components/CustomerImportUploader'
import type { CustomerImportJob, CustomerImportRowRecord, CustomerImportRowStatus } from '../types/customerImportTypes'

function canAccessMyInfoPage(role: string | undefined): boolean {
  return role === 'USER' || role === 'GA_ADMIN'
}

export function CustomerAutoImportPage() {
  const { token, user, isAuthenticated } = useAuth()
  const [pickFile, setPickFile] = useState<File | null>(null)
  const [job, setJob] = useState<CustomerImportJob | null>(null)
  const [tab, setTab] = useState<CustomerImportRowStatus>('ready')
  const [rows, setRows] = useState<CustomerImportRowRecord[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [applyMsg, setApplyMsg] = useState('')
  const [rowsTick, setRowsTick] = useState(0)

  useEffect(() => {
    if (!token?.trim() || !job?.id) {
      setRows([])
      return
    }
    let cancelled = false
    setRowsLoading(true)
    setError('')
    void fetchCustomerImportRows(token, job.id, { status: tab, limit: 500 })
      .then(({ rows: r }) => {
        if (!cancelled) {
          setRows(r)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRowsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, job?.id, tab, rowsTick])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!canAccessMyInfoPage(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }
  if (!token?.trim()) {
    return <Navigate to="/login" replace />
  }

  const counts = job
    ? {
        ready: job.readyRows,
        incomplete: job.incompleteRows,
        duplicate: job.duplicateRows,
        error: job.errorRows,
        imported: job.importedRows,
      }
    : null

  const onUpload = async () => {
    if (!pickFile) {
      setError('파일을 선택해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    setApplyMsg('')
    try {
      const j = await uploadCustomerImportJob(token, pickFile)
      setJob(j)
      setPickFile(null)
      setTab('ready')
      setRowsTick((n) => n + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onApply = async () => {
    if (!job?.id) {
      return
    }
    setBusy(true)
    setError('')
    setApplyMsg('')
    try {
      const r = await applyCustomerImportJob(token, job.id)
      setJob(r.job)
      setApplyMsg(`반영: 성공 ${r.appliedInRequest}건, 실패 ${r.failedInRequest}건`)
      setRowsTick((n) => n + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '반영에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onReupload = () => {
    setJob(null)
    setPickFile(null)
    setRows([])
    setTab('ready')
    setApplyMsg('')
    setError('')
  }

  return (
    <div className="profile-page max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">고객 데이터 자동 업로드</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          엑셀 파일을 그대로 올리면 서버가 자동으로 고객 데이터를 분류합니다. 지원: .xlsx, .xls, .csv
        </p>
      </div>

      <PCOnlySection>
        <section className="mb-6">
          <h2 className="profile-page__section-title">파일 업로드</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <CustomerImportUploader
              disabled={busy}
              selectedName={pickFile?.name ?? ''}
              onFileSelected={setPickFile}
            />
            <Button type="button" disabled={busy || !pickFile} onClick={() => void onUpload()}>
              {busy ? '처리 중…' : '업로드 및 분석'}
            </Button>
            {job ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={onReupload}>
                원본 다시 올리기
              </Button>
            ) : null}
          </div>
        </section>

        {error ? (
          <p className="status status--error text-sm mb-4" role="alert">
            {error}
          </p>
        ) : null}
        {applyMsg ? (
          <p className="status text-sm mb-4" role="status">
            {applyMsg}
          </p>
        ) : null}

        <section className="mb-6">
          <h2 className="profile-page__section-title">분석 결과</h2>
          <div className="mt-2">
            <CustomerImportSummary job={job} />
          </div>
          {job && job.readyRows > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void onApply()}>
                정상 데이터 반영 ({job.readyRows}건)
              </Button>
            </div>
          ) : null}
        </section>

        {job ? (
          <section className="mb-6">
            <h2 className="profile-page__section-title">행 목록</h2>
            <div className="mt-3 mb-3">
              <CustomerImportStatusTabs active={tab} onChange={setTab} counts={counts ?? undefined} />
            </div>
            <CustomerImportRowsTable rows={rows} loading={rowsLoading} />
          </section>
        ) : null}
      </PCOnlySection>

      <div className="switch-text mt-8">
        <Link to="/profile" className="switch-text__action">
          내 정보 관리로
        </Link>
      </div>
    </div>
  )
}
