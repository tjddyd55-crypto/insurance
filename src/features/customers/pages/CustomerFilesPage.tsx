import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Modal from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import {
  deleteCustomerFile,
  listCustomerFiles,
  presignCustomerFile,
  revokeStagedCustomerFileUpload,
  saveCustomerFile,
  type CustomerFileRow,
} from '../api/customerExtraApi'

const CUSTOMER_FILE_MAX_BYTES = 25 * 1024 * 1024
const CUSTOMER_FILES_MAX_COUNT = 20

const CUSTOMER_FILE_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const FILE_INPUT_ACCEPT = 'image/jpeg,image/png,application/pdf,.pdf'

const ALERT_FILE_TYPE = '파일 형식 오류'
const ALERT_SIZE = '용량 초과'
const ALERT_UPLOAD_FAIL = '업로드 실패'
const ALERT_DELETE_FAIL = '삭제 실패'

function guessCustomerFileContentType(f: File): string {
  if (f.type && CUSTOMER_FILE_ALLOWED_MIME.has(f.type)) {
    return f.type
  }
  const n = f.name.toLowerCase()
  if (n.endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (n.endsWith('.png')) {
    return 'image/png'
  }
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  return f.type || 'application/octet-stream'
}

type LocationState = { customerName?: string }

export default function CustomerFilesPage() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()

  const customerId = Number(customerIdParam)
  const validId = Number.isInteger(customerId) && customerId > 0

  const nameFromNav = (location.state as LocationState | null)?.customerName?.trim()
  const customerTitle = nameFromNav || `고객 #${customerIdParam ?? ''}`

  const [files, setFiles] = useState<CustomerFileRow[]>([])
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadList = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setListLoading(true)
    setError('')
    setNotFound(false)
    try {
      const rows = await listCustomerFiles(token, customerId)
      setFiles(rows)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setFiles([])
        return
      }
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      setFiles([])
    } finally {
      setListLoading(false)
    }
  }, [token, customerId, validId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const f = input.files?.[0] ?? null
    if (f && f.size > CUSTOMER_FILE_MAX_BYTES) {
      window.alert(ALERT_SIZE)
      input.value = ''
      setFile(null)
      return
    }
    setFile(f)
  }, [])

  const openUploadModal = useCallback(() => {
    setError('')
    setContent('')
    setFile(null)
    setIsModalOpen(true)
  }, [])

  const closeUploadModal = useCallback(() => {
    setIsModalOpen(false)
    setError('')
    setContent('')
    setFile(null)
  }, [])

  const handleUpload = async () => {
    if (uploading) {
      return
    }
    if (!token?.trim() || !validId) {
      return
    }
    if (!file) {
      setError('파일을 선택해 주세요.')
      return
    }
    if (files.length >= CUSTOMER_FILES_MAX_COUNT) {
      window.alert('파일은 최대 20개까지 업로드 가능합니다.')
      return
    }
    const contentType = guessCustomerFileContentType(file)
    if (!CUSTOMER_FILE_ALLOWED_MIME.has(contentType)) {
      window.alert(ALERT_FILE_TYPE)
      return
    }
    if (file.size < 1 || file.size > CUSTOMER_FILE_MAX_BYTES) {
      window.alert(ALERT_SIZE)
      return
    }

    setUploading(true)
    setError('')
    let rollbackObjectKey: string | null = null
    try {
      const presign = await presignCustomerFile(token, customerId, {
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      })
      rollbackObjectKey = presign.objectKey
      const putHeaders: Record<string, string> = {
        'Content-Type': contentType,
        ...(presign.putHeaders ?? {}),
      }
      const put = await fetch(presign.uploadUrl, { method: 'PUT', headers: putHeaders, body: file })
      if (!put.ok) {
        throw new Error('put')
      }
      const saved = await saveCustomerFile(token, customerId, {
        content,
        fileName: file.name,
        objectKey: presign.objectKey,
        fileUrl: presign.fileUrl,
        size: file.size,
        mimeType: contentType,
      })
      rollbackObjectKey = null
      setFiles((prev) => [saved, ...prev])
      setContent('')
      setFile(null)
      setIsModalOpen(false)
    } catch {
      if (rollbackObjectKey && token?.trim()) {
        try {
          await revokeStagedCustomerFileUpload(token, customerId, rollbackObjectKey)
        } catch (orphanErr) {
          console.warn('[ORPHAN FILE]', rollbackObjectKey, orphanErr)
        }
      }
      window.alert(ALERT_UPLOAD_FAIL)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = useCallback(
    (row: CustomerFileRow) => {
      const auth = token?.trim()
      if (!auth) {
        return
      }
      let snapshot: CustomerFileRow[] = []
      setFiles((prev) => {
        snapshot = prev
        return prev.filter((f) => f.id !== row.id)
      })
      void deleteCustomerFile(auth, row.id).catch(() => {
        setFiles(snapshot)
        window.alert(ALERT_DELETE_FAIL)
      })
    },
    [token],
  )

  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  if (!validId) {
    return (
      <div className="page-shell" style={{ padding: '1rem' }}>
        <p>잘못된 고객 ID입니다.</p>
        <button type="button" className="filter-button mt-2" onClick={() => navigate('/customers')}>
          고객 목록
        </button>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
        <h1 style={{ marginTop: 12 }}>고객을 찾을 수 없음</h1>
        <p style={{ color: 'var(--text-secondary)' }}>삭제되었거나 접근할 수 없는 고객입니다.</p>
        <button type="button" className="filter-button mt-3" onClick={() => navigate('/customers')}>
          고객 목록으로
        </button>
      </div>
    )
  }

  return (
    <div className="page-shell customer-files-page" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <div
        className="customer-files-page__toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 12,
        }}
      >
        <button type="button" className="link-btn link-btn--compact" onClick={handleBack}>
          ← 뒤로
        </button>
        <h1 className="customer-files-page__title" style={{ margin: 0, fontSize: '1.25rem', flex: '1 1 auto' }}>
          {customerTitle}
        </h1>
        <Button
          type="button"
          variant="primary"
          className="!px-3 !py-1.5 text-xs shrink-0"
          disabled={!token?.trim() || listLoading}
          onClick={openUploadModal}
        >
          작성
        </Button>
      </div>
      <p className="customer-files-page__lead" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>
        첨부 목록은 최신 순입니다. {files.length > 0 ? `(${files.length}건)` : ''}
      </p>

      {error ? (
        <p style={{ color: 'var(--danger, #c00)' }} role="alert">
          {error}
        </p>
      ) : null}

      <section className="customer-files-page__list-section" style={{ marginTop: 24 }}>
        <h2 className="customer-files-page__list-heading" style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>
          첨부 목록
        </h2>
        {listLoading ? (
          <p style={{ color: 'var(--text-secondary)' }} role="status">
            불러오는 중…
          </p>
        ) : files.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>첨부된 파일이 없습니다. 상단 「작성」에서 추가하세요.</p>
        ) : (
          <div className="customer-files-page__cards">
            {files.map((f) => (
              <div key={f.id} className="file-card">
                <div className="content">{f.content?.trim() ? f.content : '—'}</div>
                <div className="file-name">{f.fileName}</div>
                <div className="date">
                  {f.createdAt ? new Date(f.createdAt).toLocaleString('ko-KR') : '—'}
                </div>
                <div className="actions">
                  <a href={f.fileUrl} target="_blank" rel="noopener noreferrer">
                    다운로드
                  </a>
                  <button type="button" disabled={uploading} onClick={() => handleDelete(f)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={isModalOpen} onClose={closeUploadModal} ariaLabel="파일 첨부 작성" panelClassName="max-w-lg">
        <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">파일 첨부</div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleUpload()
          }}
          className="customer-files-page__upload-form"
        >
          <label className="block mb-3">
            <span className="block mb-1 text-sm text-[var(--text-secondary)]">메모 / 설명</span>
            <textarea
              className="w-full border border-[var(--border-default)] rounded-lg p-2 bg-[var(--bg-card)] text-[var(--text-primary)] box-border min-h-[100px]"
              value={content}
              onChange={(ev) => setContent(ev.target.value)}
              placeholder="항목에 함께 저장할 내용 (선택)"
            />
          </label>
          <label className="block mb-3">
            <span className="block mb-1 text-sm text-[var(--text-secondary)]">파일</span>
            <input type="file" accept={FILE_INPUT_ACCEPT} onChange={handleFileChange} className="text-sm" />
          </label>
          {file ? (
            <p className="text-xs text-[var(--text-secondary)] mb-3">선택됨: {file.name}</p>
          ) : null}
          <div className="flex gap-2 justify-end flex-wrap">
            <Button type="button" variant="secondary" onClick={closeUploadModal} disabled={uploading}>
              취소
            </Button>
            <Button type="submit" disabled={uploading || !file || !token?.trim()}>
              {uploading ? '업로드 중…' : '업로드'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
