import { useCallback, useEffect, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchTeamMembers,
  kickTeamMember,
  leaveTeam,
  type TeamMemberRow,
} from '../api/teamApi'

export default function TeamMembersPage() {
  const { token, user, login } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
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
    const confirmed = await confirm({
      title: '팀원 강퇴',
      message: '강퇴하시겠습니까?',
      tone: 'danger',
    })
    if (!confirmed) {
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
    const confirmed = await confirm({
      title: '팀 나가기',
      message: '팀에서 나가시겠습니까?',
      tone: 'danger',
    })
    if (!confirmed) {
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
      <h1 className="text-[var(--text-primary)]" style={{ marginTop: 12 }}>
        팀 관리 (팀원 관리)
      </h1>
      <p className="text-sm text-[var(--text-secondary)]" style={{ marginTop: 6 }}>
        팀원 목록과 강퇴·나가기를 관리합니다.
      </p>

      <StatusMessage message={error} tone="error" className="mt-2" />

      {pageLoading ? (
        <LoadingState className="mt-3 text-left text-sm text-[var(--text-secondary)]" />
      ) : members.length === 0 ? (
        <EmptyState message="팀이 없습니다" className="mt-4 text-left text-sm text-[var(--text-secondary)]" />
      ) : (
        <>
          {!iAmOwner ? (
            <div className="flex justify-end mb-2 mt-2">
              <FormButton
                htmlType="button"
                variant="action"
                disabled={actionBusy}
                className="text-sm text-[var(--text-secondary)] hover:underline disabled:opacity-50"
                onClick={() => void handleLeave()}
              >
                팀 나가기
              </FormButton>
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
                      <FormButton
                        htmlType="button"
                        variant="action"
                        disabled={actionBusy}
                        className="text-xs disabled:opacity-50"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => void handleKick(m.userId)}
                      >
                        강퇴
                      </FormButton>
                    ) : null}
                    {isMe && !isRowOwner ? (
                      <FormButton
                        htmlType="button"
                        variant="action"
                        disabled={actionBusy}
                        className="text-xs text-[var(--text-secondary)] disabled:opacity-50"
                        onClick={() => void handleLeave()}
                      >
                        나가기
                      </FormButton>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  )
}
