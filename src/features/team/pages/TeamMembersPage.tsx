import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { fetchTeamMembers, type TeamMemberRow } from '../api/teamApi'

export default function TeamMembersPage() {
  const { token } = useAuth()
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [error, setError] = useState('')
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

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 style={{ marginTop: 12 }}>팀원</h1>
      {error ? (
        <p style={{ color: 'var(--danger)', marginTop: 8 }} role="alert">
          {error}
        </p>
      ) : null}
      {pageLoading ? (
        <p style={{ marginTop: 12 }} role="status">
          불러오는 중…
        </p>
      ) : !teamId ? (
        <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          소속된 팀이 없습니다. 프로필에서 팀을 생성하거나 연결해 주세요.
        </p>
      ) : members.length === 0 ? (
        <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          표시할 팀원이 없습니다.
        </p>
      ) : (
        <div className="space-y-2" style={{ marginTop: 16 }}>
          {members.map((m) => (
            <div key={m.userId} className="text-sm text-[var(--text-primary)]">
              {m.displayName || m.username} {m.role} - {m.username}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
