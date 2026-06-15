import { useEffect, useMemo, useState } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchNotificationSettings,
  patchNotificationSettings,
  type NotificationSettings,
} from '../../notification/api/notificationApi'

const DEFAULT_SETTINGS: NotificationSettings = {
  customerClaimMessage: true,
  newCustomerRegistered: true,
  insurerNewsUploaded: true,
  carRenewalOneMonth: true,
  insurerContactUpdated: true,
}

const SETTING_ROWS: Array<{
  key: keyof NotificationSettings
  label: string
}> = [
  { key: 'customerClaimMessage', label: '고객앱 청구 및 메시지 접수' },
  { key: 'newCustomerRegistered', label: '신규 고객 등록' },
  { key: 'insurerNewsUploaded', label: '원수사 및 손해사정사 새글 업로드' },
  { key: 'carRenewalOneMonth', label: '자동차 만기일 한 달 전' },
  { key: 'insurerContactUpdated', label: '원수사 연락처 업데이트' },
]

type NotificationsSettingsViewProps = {
  settings: NotificationSettings
  loading: boolean
  savingKey: keyof NotificationSettings | null
  message: string
  onToggle: (key: keyof NotificationSettings, value: boolean) => void
}

function NotificationsSettingsContent({
  settings,
  loading,
  savingKey,
  message,
  onToggle,
}: NotificationsSettingsViewProps) {
  return (
    <>
      <header className="notifications-settings-page__header">
        <h1>알림 설정</h1>
        <p>{message || '받을 알림 항목을 선택합니다.'}</p>
      </header>
      <section className="notifications-settings-page__panel" aria-busy={loading}>
        {SETTING_ROWS.map((row) => (
          <label key={row.key} className="notifications-settings-page__row">
            <span className="notifications-settings-page__label">{row.label}</span>
            <FormInput
              type="checkbox"
              checked={settings[row.key]}
              disabled={loading || savingKey === row.key}
              onChange={(e) => onToggle(row.key, e.target.checked)}
              aria-label={row.label}
            />
          </label>
        ))}
      </section>
    </>
  )
}

function NotificationsSettingsPCView(props: NotificationsSettingsViewProps) {
  return (
    <main className="page notifications-settings-page notifications-settings-page--pc page--with-back content-wrapper page-shell">
      <NotificationsSettingsContent {...props} />
    </main>
  )
}

function NotificationsSettingsMobileView(props: NotificationsSettingsViewProps) {
  return (
    <main className="page notifications-settings-page notifications-settings-page--mobile page--with-back content-wrapper page-shell">
      <NotificationsSettingsContent {...props} />
    </main>
  )
}

export default function NotificationsPlaceholderPage() {
  const { token } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token?.trim()) {
        setLoading(false)
        setMessage('로그인이 필요합니다.')
        return
      }
      setLoading(true)
      setMessage('')
      try {
        const result = await fetchNotificationSettings(token)
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : '알림 설정을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const viewProps = useMemo<NotificationsSettingsViewProps>(
    () => ({
      settings,
      loading,
      savingKey,
      message,
      onToggle: async (key, value) => {
        if (!token?.trim()) {
          setMessage('로그인이 필요합니다.')
          return
        }
        const previous = settings
        setSettings((prev) => ({ ...prev, [key]: value }))
        setSavingKey(key)
        setMessage('')
        try {
          const result = await patchNotificationSettings(token, { [key]: value })
          setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
          setMessage('저장되었습니다.')
        } catch (error) {
          setSettings(previous)
          setMessage(error instanceof Error ? error.message : '알림 설정 저장에 실패했습니다.')
        } finally {
          setSavingKey(null)
        }
      },
    }),
    [loading, message, savingKey, settings, token],
  )

  return (
    <ResponsiveLayout<NotificationsSettingsViewProps>
      PC={NotificationsSettingsPCView}
      Mobile={NotificationsSettingsMobileView}
      viewProps={viewProps}
    />
  )
}
