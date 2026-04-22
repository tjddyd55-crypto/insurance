import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FileUploader from '../../../components/common/FileUploader'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormTextarea } from '../../../components/form'
import {
  createCustomerClaimRequest,
  getCustomerAppProfile,
  requestClaimFilePresign,
  uploadCustomerClaimFileProxy,
} from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppProfile } from '../session/customerAppSession'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

interface UploadReadyFile {
  id: string
  file: File
}

export default function CustomerAppRequestComposePage() {
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [profile, setProfile] = useState(() => readCustomerAppProfile())
  const [memo, setMemo] = useState('')
  const [files, setFiles] = useState<UploadReadyFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
    }
  }, [navigate, session])

  useEffect(() => {
    if (!session) {
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const remoteProfile = await getCustomerAppProfile(session.appToken)
        if (!mounted || !remoteProfile) {
          return
        }
        setProfile({
          name: remoteProfile.name,
          birthDate: remoteProfile.birthDate,
          phone: remoteProfile.phone,
          savedAt: remoteProfile.savedAt,
        })
      } catch {
        // 조회 실패 시 로컬 캐시를 유지한다.
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [session])

  if (!session) {
    return (
      <main className="content-wrapper py-6 max-w-xl">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-2">
          <h1 className="text-base font-semibold">고객 앱 연결 필요</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            요청 작성 전에 설계사 링크로 먼저 연결해 주세요.
          </p>
          <Link to="/customer-app" className="text-sm text-blue-600">
            연결 화면으로 이동
          </Link>
        </section>
      </main>
    )
  }

  const validateClaimFile = (file: File): string | null => {
    const contentType = file.type || 'application/octet-stream'
    const isPdf = contentType === 'application/pdf'
    const isImage = contentType.startsWith('image/')
    if (!isPdf && !isImage) {
      return '이미지 또는 PDF 파일만 업로드할 수 있습니다.'
    }
    const maxBytes = 10 * 1024 * 1024
    if (file.size > maxBytes) {
      return '파일은 최대 10MB까지 업로드할 수 있습니다.'
    }
    return null
  }

  const handleAppendFiles = (selectedFiles: File[]) => {
    const mapped: UploadReadyFile[] = selectedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
    }))
    if (mapped.length > 0) {
      setError('')
    }
    setFiles((prev) => [...prev, ...mapped])
  }

  const handleRemoveFile = (targetId: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== targetId))
  }

  const uploadSingleFile = async (file: File): Promise<string> => {
    const contentType = file.type || 'application/octet-stream'
    const presign = await requestClaimFilePresign(session.appToken, {
      fileName: file.name,
      contentType,
      fileSize: file.size,
    })
    const tryProxyUpload = async () => {
      await uploadCustomerClaimFileProxy(session.appToken, {
        storageKey: presign.storageKey,
        contentType,
        fileSize: file.size,
        file,
      })
    }
    if (presign.uploadMethod === 'proxy' || !presign.uploadUrl) {
      await tryProxyUpload()
      return presign.storageKey
    }
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      ...(presign.putHeaders ?? {}),
    }
    try {
      const response = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers,
        body: file,
      })
      if (!response.ok) {
        await tryProxyUpload()
      }
    } catch {
      await tryProxyUpload()
    }
    return presign.storageKey
  }

  const handleSubmit = async () => {
    if (!profile) {
      setError('청구 요청 전에 내정보를 먼저 저장해 주세요.')
      navigate('/customer-app/profile')
      return
    }
    if (!memo.trim()) {
      setError('청구 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      const uploadedFiles = []
      for (const item of files) {
        const storageKey = await uploadSingleFile(item.file)
        uploadedFiles.push({
          storageKey,
          fileName: item.file.name,
          contentType: item.file.type,
          fileSize: item.file.size,
        })
      }
      await createCustomerClaimRequest(session.appToken, {
        memo: memo.trim(),
        files: uploadedFiles,
        requester: {
          name: profile.name,
          birthDate: profile.birthDate,
          phone: profile.phone,
        },
      })
      setResult('요청이 전송되었습니다.')
      setMemo('')
      setFiles([])
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '요청 전송에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CustomerAppShell title="청구 요청 작성">
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={result} tone="success" />
      {!profile ? (
        <div className="text-xs text-red-500">
          내정보가 저장되지 않았습니다. 먼저 내정보에서 이름/생년월일/연락처를 저장해 주세요.
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">
          요청자 정보: {profile.name} / {profile.birthDate} / {profile.phone}
        </div>
      )}
      <div className="text-sm font-medium">내용</div>
      <FormTextarea
        className="w-full text-sm"
        rows={5}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="청구 요청 내용을 입력해 주세요."
      />
      <div className="space-y-1">
        <div className="text-sm font-medium">첨부</div>
        <FileUploader
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          validateFile={validateClaimFile}
          onFiles={handleAppendFiles}
          onInvalidBatch={(failures) => {
            const firstMessage = failures[0]?.message
            if (firstMessage) {
              setError(firstMessage)
            }
          }}
          disabled={busy}
          primaryHint="이미지 또는 PDF를 드래그하여 놓거나, 클릭하여 선택하세요."
          hintLines={[
            '이미지는 본문에 표시되고, PDF는 다운로드 링크로 제공됩니다.',
            'JPG · PNG · WEBP · GIF · PDF (이미지·PDF 각 최대 10MB)',
          ]}
        />
        <div className="text-xs text-[var(--text-secondary)]">
          이미지/PDF만 업로드할 수 있습니다. (최대 10MB)
        </div>
        {files.length > 0 ? (
          <ul className="text-xs space-y-2">
            {files.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-default)] px-2 py-1">
                <span className="truncate">{item.file.name}</span>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="!h-7 !px-2 text-[11px]"
                  onClick={() => handleRemoveFile(item.id)}
                >
                  삭제
                </FormButton>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex gap-2">
        <FormButton htmlType="button" variant="primary" onClick={() => void handleSubmit()} loading={busy}>
          요청 전송
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={() => navigate('/customer-app/requests')}>
          내역 보기
        </FormButton>
      </div>
    </CustomerAppShell>
  )
}
