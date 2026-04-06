import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useAuth } from '../../auth/AuthProvider'
import { fetchTeamFiles, type TeamFileRow } from '../api/teamApi'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleString('ko-KR')
}

export default function TeamFilesPage() {
  const { token } = useAuth()
  const [files, setFiles] = useState<TeamFileRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const data = await fetchTeamFiles(token)
      setFiles(data.files)
    } catch (e) {
      setFiles([])
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 className="text-[var(--text-primary)]" style={{ marginTop: 12 }}>
        팀 자료
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mt-2">
        게시글에 첨부한 파일만 표시됩니다. (팀·게시글 단위로 분리됨)
      </p>

      {error ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
          {error.includes('소속') ? (
            <span className="block mt-2">
              <Link to="/profile" className="underline">
                프로필에서 팀에 참여
              </Link>
              해 주세요.
            </span>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">불러오는 중…</p>
      ) : !error ? (
        <ul className="mt-4 space-y-3">
          {files.length === 0 ? (
            <li className="text-sm text-[var(--text-secondary)]">첨부된 자료가 없습니다.</li>
          ) : (
            files.map((f) => (
              <li
                key={f.id}
                className="p-3 border border-[var(--border-default)] rounded-lg text-sm"
              >
                <a
                  href={f.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--text-primary)] underline"
                >
                  {f.fileName}
                </a>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  게시글: {f.postTitle || '(제목 없음)'} · {formatDate(f.postCreatedAt)}
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
