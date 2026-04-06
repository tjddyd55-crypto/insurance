import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { PageBackButton } from '../../../components/common/PageBackButton'
import {
  fetchTeamMembers,
  kickTeamMember,
  leaveTeam,
  type TeamMemberRow,
} from '../api/teamApi'

export default function TeamMembersPage() {
  const { token, user, login } = useAuth()
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setPageLoading(false)
      return
    }
    setError('')
    try {
      const data = await fetchTeamMembers(token)
      setMembers(data.members)
      setOwnerId(data.ownerId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setPageLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const iAmOwner = Boolean(ownerId && user?.id && ownerId === user.id)

  const handleKick = async (memberUserId: string) => {
    if (!token?.trim() || !user) {
      return
    }
    if (!window.confirm('강퇴하시겠습니까?')) {
      return
    }
    setActionBusy(true)
    setError('')
    try {
      await kickTeamMember(token, memberUserId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '강퇴에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!token?.trim() || !user) {
      return
    }
    if (!window.confirm('팀에서 나가시겠습니까?')) {
      return
    }
    setActionBusy(true)
    setError('')
    try {
      await leaveTeam(token)
      login({ token, user: { ...user, teamId: null } })
      window.alert('팀에서 나갔습니다')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '팀 나가기에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 className="text-[var(--text-primary)]" style={{ marginTop: 12 }}>
        팀원
      </h1>

      {error ? (
        <p style={{ color: 'var(--danger)', marginTop: 8 }} role="alert">
          {error}
        </p>
      ) : null}

      {pageLoading ? (
        <p style={{ marginTop: 12 }} role="status">
          불러오는 중…
        </p>
      ) : members.length === 0 ? (
        <div className="text-sm text-[var(--text-secondary)]" style={{ marginTop: 16 }}>
          팀이 없습니다
        </div>
      ) : (
        <>
          {!iAmOwner ? (
            <div className="flex justify-end mb-2 mt-2">
              <button
                type="button"
                disabled={actionBusy}
                className="text-sm text-[var(--text-secondary)] hover:underline disabled:opacity-50"
                onClick={() => void handleLeave()}
              >
                팀 나가기
              </button>
            </div>
          ) : null}
          <div className="border-t border-[var(--border-default)]">
            {members.map((m) => {
              const isRowOwner = Boolean(ownerId && m.userId === ownerId)
              const isMe = Boolean(user?.id && m.userId === user.id)
              return (
                <div
                  key={m.userId}
                  className="flex justify-between items-center py-2 border-b border-[var(--border-default)] gap-2"
                >
                  <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-w-0">
                    <span className="truncate">{m.displayName || m.username}</span>
                    {isRowOwner ? (
                      <span className="text-amber-400 text-xs whitespace-nowrap shrink-0">★ 팀장</span>
                    ) : null}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {iAmOwner && !isRowOwner ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        className="text-xs disabled:opacity-50"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => void handleKick(m.userId)}
                      >
                        강퇴
                      </button>
                    ) : null}
                    {isMe && !isRowOwner ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        className="text-xs text-[var(--text-secondary)] disabled:opacity-50"
                        onClick={() => void handleLeave()}
                      >
                        나가기
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
