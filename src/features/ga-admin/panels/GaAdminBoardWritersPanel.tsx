import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { FormDialog } from '../../../components/dialog'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listGaAdminNewsletterBoards } from '../../insurer-news/services/insurerNews.service'
import type { NewsletterBoard } from '../../insurer-news/types'
import {
  createGaAdminBoardWriter,
  listGaAdminBoardWriters,
  patchGaAdminBoardWriter,
  type GaAdminBoardWriterRow,
} from '../../insurer-news/services/publicBoardWriter.service'

export default function GaAdminBoardWritersPanel() {
  const { token, user } = useAuth()
  const [writers, setWriters] = useState<GaAdminBoardWriterRow[]>([])
  const [boards, setBoards] = useState<NewsletterBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([])
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'GA_ADMIN') {
      return
    }
    setLoading(true)
    setError('')
    try {
      const [writerRows, boardRows] = await Promise.all([
        listGaAdminBoardWriters(token),
        listGaAdminNewsletterBoards(token),
      ])
      setWriters(writerRows)
      setBoards(boardRows.filter((b) => b.boardScope === 'ga' || b.contentScope === 'ga'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  function toggleBoard(boardId: string) {
    setSelectedBoardIds((prev) =>
      prev.includes(boardId) ? prev.filter((id) => id !== boardId) : [...prev, boardId],
    )
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!token?.trim()) return
    setCreateErr('')
    setCreateBusy(true)
    try {
      await createGaAdminBoardWriter(token, {
        loginId: loginId.trim(),
        password,
        name: name.trim() || loginId.trim(),
        allowedBoardIds: selectedBoardIds,
      })
      setCreateOpen(false)
      setLoginId('')
      setPassword('')
      setName('')
      setSelectedBoardIds([])
      await load()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally {
      setCreateBusy(false)
    }
  }

  async function toggleActive(writer: GaAdminBoardWriterRow) {
    if (!token?.trim()) return
    try {
      await patchGaAdminBoardWriter(token, writer.id, { isActive: !writer.isActive })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  return (
    <div className="ga-admin-workspace-panel">
      <div className="ga-admin-workspace-panel__toolbar">
        <h2 className="ga-admin-workspace-panel__title">소식지 작성자</h2>
        <FormButton type="button" onClick={() => setCreateOpen(true)}>작성자 생성</FormButton>
      </div>
      {error ? <StatusMessage tone="error" message={error} /> : null}
      {loading ? (
        <LoadingState message="불러오는 중…" />
      ) : writers.length === 0 ? (
        <EmptyState message="등록된 작성자가 없습니다." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>로그인 ID</th>
              <th>허용 board</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {writers.map((w) => (
              <tr key={w.id}>
                <td>{w.name || '—'}</td>
                <td>{w.loginId}</td>
                <td>{(w.allowedBoardIds ?? []).join(', ') || '—'}</td>
                <td>{w.isActive ? '활성' : '비활성'}</td>
                <td>
                  <FormButton type="button" variant="secondary" onClick={() => void toggleActive(w)}>
                    {w.isActive ? '비활성화' : '활성화'}
                  </FormButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <FormDialog open={createOpen} title="소식지 작성자 생성" onClose={() => !createBusy && setCreateOpen(false)}>
        <form onSubmit={onCreate}>
          <FieldWrapper label="이름">
            <FormInput value={name} onChange={(ev) => setName(ev.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="로그인 ID" required>
            <FormInput value={loginId} onChange={(ev) => setLoginId(ev.target.value)} autoComplete="off" />
          </FieldWrapper>
          <FieldWrapper label="비밀번호" required>
            <FormInput
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="new-password"
            />
          </FieldWrapper>
          <FieldWrapper label="허용 GA 소식지" required>
            <div className="ga-admin-writer-board-picks">
              {boards.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">먼저 GA 소식지를 생성해 주세요.</p>
              ) : (
                boards.map((b) => (
                  <label key={b.id} className="ga-admin-writer-board-picks__item">
                    <input
                      type="checkbox"
                      checked={selectedBoardIds.includes(b.id)}
                      onChange={() => toggleBoard(b.id)}
                    />
                    {b.label}
                  </label>
                ))
              )}
            </div>
          </FieldWrapper>
          {createErr ? <StatusMessage tone="error" message={createErr} /> : null}
          <div className="form-actions">
            <FormButton type="submit" busy={createBusy} disabled={selectedBoardIds.length === 0}>
              생성
            </FormButton>
          </div>
        </form>
      </FormDialog>
    </div>
  )
}
