import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <div
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
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{customerTitle}</h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>
        파일 첨부 · 메모(content)는 항목별로 저장됩니다.
      </p>

      {error ? (
        <p style={{ color: 'var(--danger, #c00)' }} role="alert">
          {error}
        </p>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem' }}>업로드</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleUpload()
          }}
          style={{ marginTop: 12 }}
        >
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}>메모 / 설명</span>
            <textarea
            className="w-full border border-[var(--border-default)] rounded-lg p-2 bg-[var(--bg-card)] text-[var(--text-primary)] box-border min-h-[100px]"
              value={content}
              onChange={(ev) => setContent(ev.target.value)}
              placeholder="항목에 함께 저장할 내용 (선택)"
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}>파일</span>
            <input type="file" accept={FILE_INPUT_ACCEPT} onChange={handleFileChange} />
          </label>
          {file ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              선택됨: {file.name}
            </p>
          ) : null}
          <button
            type="submit"
            className="cta-button"
            style={{ marginTop: 12 }}
            disabled={uploading || !file || !token?.trim()}
          >
            {uploading ? '업로드 중…' : '업로드'}
          </button>
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem' }}>첨부 목록</h2>
        {listLoading ? (
          <p style={{ color: 'var(--text-secondary)' }} role="status">
            불러오는 중…
          </p>
        ) : files.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>첨부된 파일이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {files.map((f) => (
              <li
                key={f.id}
                style={{
                  borderBottom: '1px solid var(--border-default)',
                  padding: '14px 0',
                  fontSize: '0.95rem',
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{f.content || '—'}</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.fileName}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 8 }}>
                  {f.createdAt ? new Date(f.createdAt).toLocaleString('ko-KR') : '—'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a
                    className="text-blue-500 hover:underline"
                    href={f.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    다운로드
                  </a>
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:opacity-50 text-sm bg-transparent border-0 cursor-pointer p-0"
                    disabled={uploading}
                    onClick={() => handleDelete(f)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
