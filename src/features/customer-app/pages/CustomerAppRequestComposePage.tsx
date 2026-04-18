import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import {
  createCustomerClaimRequest,
  requestClaimFilePresign,
  uploadCustomerClaimFileProxy,
} from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'

interface UploadReadyFile {
  file: File
}

export default function CustomerAppRequestComposePage() {
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const [title, setTitle] = useState('')
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    const mapped: UploadReadyFile[] = selected.map((file) => ({
      file,
    }))
    setFiles(mapped)
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
        title: title.trim(),
        memo: memo.trim(),
        files: uploadedFiles,
      })
      setResult('요청이 전송되었습니다.')
      setTitle('')
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
      <FormInput
        className="w-full text-sm"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="제목 (선택)"
      />
      <FormTextarea
        className="w-full text-sm"
        rows={4}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="요청 메모"
      />
      <div className="space-y-1">
        <FormInput type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} />
        <div className="text-xs text-[var(--text-secondary)]">
          이미지/PDF만 업로드할 수 있습니다. (최대 10MB)
        </div>
        {files.length > 0 ? (
          <ul className="text-xs space-y-1">
            {files.map((item) => (
              <li key={item.file.name + item.file.size}>{item.file.name}</li>
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
