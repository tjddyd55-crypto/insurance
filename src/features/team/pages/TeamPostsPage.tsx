import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { cdnUrlForObjectKey } from '../../insurer-news/lib/insurerNewsCdn'
import { useAuth } from '../../auth/AuthProvider'
import {
  createTeamPost,
  fetchTeamPosts,
  presignTeamPostAttachment,
  type TeamPostAttachment,
  type TeamPostRow,
} from '../api/teamApi'

function snippet(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) {
    return t
  }
  return `${t.slice(0, max)}…`
}

function formatPostDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleString('ko-KR')
}

function guessContentType(file: File): string {
  if (file.type) {
    return file.type
  }
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf')) {
    return 'application/pdf'
  }
  if (n.endsWith('.png')) {
    return 'image/png'
  }
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (n.endsWith('.webp')) {
    return 'image/webp'
  }
  if (n.endsWith('.gif')) {
    return 'image/gif'
  }
  return 'application/octet-stream'
}

async function uploadTeamPostFiles(
  token: string,
  files: File[],
): Promise<{ objectKey: string; fileName: string; fileUrl: string }[]> {
  const out: { objectKey: string; fileName: string; fileUrl: string }[] = []
  for (const file of files) {
    const contentType = guessContentType(file)
    const presign = await presignTeamPostAttachment(token, {
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    })
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      ...(presign.putHeaders ?? {}),
    }
    const put = await fetch(presign.uploadUrl, { method: 'PUT', headers, body: file })
    if (!put.ok) {
      throw new Error('파일 업로드에 실패했습니다.')
    }
    out.push({
      objectKey: presign.objectKey,
      fileName: file.name,
      fileUrl: cdnUrlForObjectKey(presign.objectKey),
    })
  }
  return out
}

function PostCard({ post }: { post: TeamPostRow }) {
  return (
    <div className="p-3 border-b border-[var(--border-default)]">
      {post.isNotice ? (
        <div className="text-xs text-amber-400 mb-1">공지</div>
      ) : null}
      <div className="font-semibold text-[var(--text-primary)]">{post.title}</div>
      <div className="text-sm text-[var(--text-secondary)] mt-1">{snippet(post.content)}</div>
      <div className="text-xs text-[var(--text-secondary)] mt-2 opacity-80">{formatPostDate(post.createdAt)}</div>
      {post.attachments.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {post.attachments.map((file: TeamPostAttachment) => (
            <a
              key={file.id}
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--text-primary)] underline"
            >
              {file.fileName}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function TeamPostsPage() {
  const { token, user } = useAuth()
  const [posts, setPosts] = useState<TeamPostRow[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isNotice, setIsNotice] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSetNotice = Boolean(ownerId && user?.id && ownerId === user.id)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setLoading(false)
      return
    }
    setLoadError('')
    try {
      const data = await fetchTeamPosts(token)
      setPosts(data.posts)
      setOwnerId(data.ownerId ?? null)
    } catch (e) {
      setPosts([])
      setOwnerId(null)
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    setSubmitError('')
    const titleTrim = title.trim()
    const contentTrim = content.trim()
    if (!titleTrim) {
      setSubmitError('제목을 입력해 주세요.')
      return
    }
    if (!contentTrim) {
      setSubmitError('내용을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      let uploaded: { objectKey: string; fileName: string; fileUrl: string }[] = []
      if (files.length > 0) {
        uploaded = await uploadTeamPostFiles(token, files)
      }
      await createTeamPost(token, {
        title: titleTrim,
        content: contentTrim,
        isNotice: canSetNotice && isNotice,
        attachments: uploaded,
      })
      setTitle('')
      setContent('')
      setIsNotice(false)
      setFiles([])
      await load()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 className="text-[var(--text-primary)]" style={{ marginTop: 12 }}>
        팀 게시판
      </h1>

      {loadError ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {loadError}
          {loadError.includes('소속') ? (
            <span className="block mt-2">
              <Link to="/profile" className="underline">
                프로필에서 팀에 참여
              </Link>
              해 주세요.
            </span>
          ) : null}
        </p>
      ) : null}

      {!loadError && !loading ? (
        <form className="mt-4 space-y-3 border border-[var(--border-default)] rounded-lg p-4" onSubmit={(ev) => void onSubmit(ev)}>
          <div className="text-sm font-medium text-[var(--text-primary)]">글 작성</div>
          <label className="block text-sm text-[var(--text-secondary)]">
            제목
            <input
              className="mt-1 w-full box-border border border-[var(--border-default)] rounded-md p-2 text-sm bg-[var(--bg-soft)] text-[var(--text-primary)]"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              maxLength={200}
            />
          </label>
          <label className="block text-sm text-[var(--text-secondary)]">
            내용
            <textarea
              className="mt-1 w-full min-h-[120px] box-border border border-[var(--border-default)] rounded-md p-2 text-sm bg-[var(--bg-soft)] text-[var(--text-primary)]"
              value={content}
              onChange={(ev) => setContent(ev.target.value)}
              maxLength={50000}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={isNotice}
              disabled={!canSetNotice}
              onChange={(ev) => setIsNotice(ev.target.checked)}
            />
            공지로 등록 {canSetNotice ? null : <span className="text-xs text-[var(--text-secondary)]">(팀장만)</span>}
          </label>
          <label className="block text-sm text-[var(--text-secondary)]">
            첨부 (이미지·PDF, 최대 10개)
            <input
              type="file"
              className="mt-1 w-full text-sm"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              onChange={(ev) => setFiles(Array.from(ev.target.files ?? []))}
            />
          </label>
          {submitError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {submitError}
            </p>
          ) : null}
          <button
            type="submit"
            className="cta-button"
            disabled={submitting}
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">불러오는 중…</p>
      ) : !loadError ? (
        <div className="mt-6 border-t border-[var(--border-default)]">
          {posts.length === 0 ? (
            <p className="py-6 text-sm text-[var(--text-secondary)]">등록된 글이 없습니다.</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      ) : null}
    </div>
  )
}
