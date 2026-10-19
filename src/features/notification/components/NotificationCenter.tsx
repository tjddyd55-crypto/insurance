import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import {
  dismissNotification,
  fetchNotificationSettings,
  fetchNotifications,
  patchNotificationSettings,
  fetchGoogleAutoSync,
  saveGoogleAutoSync,
  type GoogleAutoSyncState,
  type NotificationListType,
  type NotificationListView,
  type NotificationRow,
  type UserAlertSettings,
} from '../api/notificationApi'
import { DEFAULT_USER_ALERT_SETTINGS } from '../config/notificationCenter.config'
import { dispatchNotificationRefresh } from '../notificationRefreshDispatch'
import { canNavigateFromNotification, openNotificationNavigate } from '../utils/notificationCustomerNavigation'
import { NotificationCenterSections } from './NotificationCenterSections'
import { NotificationConfirmModal } from './NotificationConfirmModal'
import { NotificationSettingsModal } from './NotificationSettingsModal'

const VIEW_OPTIONS: Array<{ value: NotificationListView; label: string }> = [
  { value: 'active', label: '미확인' },
  { value: 'confirmed', label: '확인한 알림' },
]

function resolveNotificationLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'DB_ERROR') {
      return '알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
    return error.message
  }
  return '알림을 불러오지 못했습니다.'
}

export type NotificationCenterProps = {
  token: string
}

export function NotificationCenter({ token }: NotificationCenterProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [view, setView] = useState<NotificationListView>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<NotificationRow | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<UserAlertSettings | null>(null)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [googleDraft, setGoogleDraft] = useState<GoogleAutoSyncState | null>(null)
  const [googleSaved, setGoogleSaved] = useState<GoogleAutoSyncState | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!token.trim()) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { notifications } = await fetchNotifications(token, { limit: 100, view, type: 'all' })
      setItems(notifications)
    } catch (e) {
      setItems([])
      setError(resolveNotificationLoadError(e))
    } finally {
      setLoading(false)
    }
  }, [token, view])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setExpandedSections(new Set())
  }, [view])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleNameClick = async (row: NotificationRow) => {
    if (!canNavigateFromNotification(row)) {
      return
    }
    setPendingId(row.id)
    try {
      openNotificationNavigate({ notification: row, navigate })
    } catch (e) {
      setError(resolveNotificationLoadError(e))
    } finally {
      setPendingId(null)
    }
  }

  const openConfirmModal = (row: NotificationRow) => {
    if (isConfirming) {
      return
    }
    setConfirmError('')
    setConfirmTarget(row)
  }

  const closeConfirmModal = () => {
    if (isConfirming) {
      return
    }
    setConfirmTarget(null)
    setConfirmError('')
  }

  const handleConfirmSubmit = async () => {
    if (!confirmTarget || isConfirming) {
      return
    }
    setIsConfirming(true)
    setConfirmError('')
    try {
      await dismissNotification(token, confirmTarget.id)
      setItems((prev) => prev.filter((item) => item.id !== confirmTarget.id))
      setConfirmTarget(null)
      setToast('알림을 확인 처리했습니다.')
      dispatchNotificationRefresh()
    } catch {
      setConfirmError('알림 확인 처리에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsConfirming(false)
    }
  }

  const openSettingsModal = async () => {
    if (!token.trim() || settingsBusy) {
      return
    }
    setSettingsError('')
    setSettingsBusy(true)
    try {
      const { data } = await fetchNotificationSettings(token)
      setSettingsDraft(data ?? { ...DEFAULT_USER_ALERT_SETTINGS })
      try {
        const g = await fetchGoogleAutoSync(token)
        setGoogleDraft(g)
        setGoogleSaved(g)
      } catch {
        setGoogleDraft(null)
        setGoogleSaved(null)
      }
      setSettingsOpen(true)
    } catch (e) {
      // 조회 실패해도 모달은 기본값으로 열어 "무반응"을 막는다.
      setSettingsDraft({ ...DEFAULT_USER_ALERT_SETTINGS })
      setSettingsOpen(true)
      setSettingsError(resolveNotificationLoadError(e))
    } finally {
      setSettingsBusy(false)
    }
  }

  const closeSettingsModal = () => {
    if (settingsBusy) {
      return
    }
    setSettingsOpen(false)
    setSettingsDraft(null)
    setSettingsError('')
    setGoogleDraft(null)
    setGoogleSaved(null)
  }

  const handleSettingsSave = async () => {
    if (!settingsDraft || settingsBusy) {
      return
    }
    setSettingsBusy(true)
    setSettingsError('')
    try {
      await patchNotificationSettings(token, settingsDraft)
      if (googleDraft && JSON.stringify(googleDraft) !== JSON.stringify(googleSaved)) {
        try {
          const saved = await saveGoogleAutoSync(token, { enabled: googleDraft.enabled, kinds: googleDraft.kinds })
          setGoogleSaved(saved)
          setGoogleDraft(saved)
          if (saved.syncStatus === 'syncing') {
            setToast('알림 설정을 저장했습니다. Google 캘린더 동기화는 백그라운드에서 진행됩니다.')
            dispatchNotificationRefresh()
            setSettingsOpen(false)
            setSettingsDraft(null)
            await load()
            return
          }
        } catch (e) {
          // 저장 실패를 성공처럼 닫지 않는다.
          setSettingsError(
            e instanceof Error && e.message ? e.message : 'Google 캘린더 자동 연동 설정을 저장하지 못했습니다.',
          )
          return
        }
      }
      setSettingsOpen(false)
      setSettingsDraft(null)
      setToast('알림 설정을 저장했습니다.')
      dispatchNotificationRefresh()
      await load()
    } catch (e) {
      setSettingsError(resolveNotificationLoadError(e))
    } finally {
      setSettingsBusy(false)
    }
  }

  const toggleSectionExpanded = (type: NotificationListType | string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="notification-center">
      <NotificationConfirmModal
        row={confirmTarget}
        busy={isConfirming}
        error={confirmError}
        onConfirm={handleConfirmSubmit}
        onCancel={closeConfirmModal}
      />
      <NotificationSettingsModal
        open={settingsOpen}
        draft={settingsDraft}
        busy={settingsBusy}
        error={settingsError}
        onChange={setSettingsDraft}
        onSave={handleSettingsSave}
        google={googleDraft}
        onGoogleChange={setGoogleDraft}
        onCancel={closeSettingsModal}
      />

      <div className="notification-center__filters">
        <div className="notification-center__filter-row">
          <div className="notification-center__filter-buttons">
            {VIEW_OPTIONS.map((option) => (
              <FormButton
                key={option.value}
                htmlType="button"
                variant={view === option.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setView(option.value)}
              >
                {option.label}
              </FormButton>
            ))}
          </div>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={settingsBusy}
            onClick={() => void openSettingsModal()}
          >
            알림 설정
          </FormButton>
        </div>
        {view === 'confirmed' ? (
          <span className="notification-center__view-hint">최근 1개월 내 확인한 알림만 표시됩니다.</span>
        ) : null}
      </div>

      {toast ? <p className="notification-center__toast">{toast}</p> : null}

      {loading ? <p className="notification-center__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="notification-center__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <NotificationCenterSections
          items={items}
          view={view}
          expandedSections={expandedSections}
          pendingId={pendingId}
          isConfirming={isConfirming}
          confirmTargetId={confirmTarget?.id ?? null}
          onNameClick={(row) => void handleNameClick(row)}
          onConfirm={openConfirmModal}
          onToggleExpanded={toggleSectionExpanded}
        />
      ) : null}
    </div>
  )
}
