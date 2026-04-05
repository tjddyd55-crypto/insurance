import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { createTeam, fetchTeamMembers, joinTeam, type TeamMemberRow } from '../api/teamApi'

export default function TeamMembersPage() {
  const { token } = useAuth()
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [teamNameInput, setTeamNameInput] = useState('')
  const [joinIdInput, setJoinIdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setPageLoading(false)
      return
    }
    setError('')
    try {
      const data = await fetchTeamMembers(token)
      setTeamId(data.teamId)
      setTeamName(data.teamName)
      setMembers(data.members)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setPageLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await createTeam(token, teamNameInput.trim() || undefined)
      setTeamNameInput('')
      window.alert('팀이 생성되었습니다.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀 만들기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const copyTeamId = async () => {
    if (!teamId?.trim()) {
      return
    }
    try {
      await navigator.clipboard.writeText(teamId)
      window.alert('팀 ID가 복사되었습니다.')
    } catch {
      setError('클립보드 복사에 실패했습니다. 팀 ID를 직접 선택해 복사해 주세요.')
    }
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await joinTeam(token, joinIdInput.trim())
      setJoinIdInput('')
      window.alert('팀에 참여했습니다.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀 참여에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 style={{ marginTop: 12 }}>팀원</h1>
      <p style={{ color: '#555', fontSize: '0.95rem' }}>
        같은 GA 소속 팀을 만들거나 참여한 뒤, 멤버 목록을 확인할 수 있습니다.
      </p>
      {error ? (
        <p style={{ color: '#b00020', marginTop: 8 }} role="alert">
          {error}
        </p>
      ) : null}
      {pageLoading ? (
        <p style={{ marginTop: 12 }} role="status">
          불러오는 중…
        </p>
      ) : null}

      <section style={{ marginTop: 20, padding: 16, border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>내 팀</h2>
        {teamId ? (
          <p>
            <strong>{teamName || '팀'}</strong>
            <br />
            <span style={{ fontSize: '0.85rem', color: '#666' }}>팀 ID: {teamId}</span>
            <br />
            <button
              type="button"
              className="cta-button"
              style={{ marginTop: 10, minHeight: 44, padding: '0 14px', fontSize: '0.95rem' }}
              onClick={() => void copyTeamId()}
            >
              팀 ID 복사
            </button>
          </p>
        ) : (
          <div
            role="status"
            style={{
              marginTop: 8,
              padding: '14px 16px',
              borderRadius: 8,
              border: '1px solid #ffcc80',
              background: '#fff8e1',
              color: '#5d4037',
              fontSize: '0.95rem',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 6 }}>아직 소속된 팀이 없습니다</strong>
            아래에서 팀을 새로 만들거나, 동료가 공유한 팀 ID로 참여하면 멤버 목록과 협업 기능을 쓸 수 있습니다.
          </div>
        )}
      </section>

      {!teamId && !pageLoading ? (
        <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
          <form onSubmit={onCreate}>
            <h2 style={{ fontSize: '1.05rem' }}>팀 만들기</h2>
            <p style={{ fontSize: '0.9rem', color: '#555', marginTop: 0 }}>[팀 생성]</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              팀 이름 (선택)
              <input
                value={teamNameInput}
                onChange={(ev) => setTeamNameInput(ev.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
                maxLength={120}
                placeholder="예: 강남1팀"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? '처리 중…' : '팀 생성'}
            </button>
          </form>
          <form onSubmit={onJoin}>
            <h2 style={{ fontSize: '1.05rem' }}>팀 참여</h2>
            <p style={{ fontSize: '0.9rem', color: '#555', marginTop: 0 }}>[팀 코드 입력 → 팀 연결]</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              팀 ID
              <input
                value={joinIdInput}
                onChange={(ev) => setJoinIdInput(ev.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
                placeholder="리더가 공유한 UUID"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? '처리 중…' : '참여'}
            </button>
          </form>
        </div>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem' }}>[팀원 목록]</h2>
        {members.length === 0 ? (
          <p style={{ color: '#666' }}>표시할 멤버가 없습니다.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {members.map((m) => (
              <li key={m.userId} style={{ marginBottom: 8 }}>
                <strong>{m.displayName || m.username}</strong>
                <span style={{ color: '#666', marginLeft: 8, fontSize: '0.9rem' }}>
                  {m.role} · {m.username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
