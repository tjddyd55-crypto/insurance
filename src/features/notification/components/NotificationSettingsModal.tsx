import type { ReactNode } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog/FormDialog'
import type { GoogleAutoSyncKind, GoogleAutoSyncState, UserAlertSettings } from '../api/notificationApi'

export type NotificationSettingsModalProps = {
  open: boolean
  draft: UserAlertSettings | null
  busy: boolean
  error: string
  onChange: (next: UserAlertSettings) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
  google?: GoogleAutoSyncState | null
  onGoogleChange?: (next: GoogleAutoSyncState) => void
}

const GOOGLE_KIND_ROWS: Array<{ kind: GoogleAutoSyncKind; label: string }> = [
  { kind: 'todo', label: 'ONE FC 할 일' },
  { kind: 'car_expiry', label: '자동차 만기 알림' },
  { kind: 'insurance_age_date', label: '상령일 알림' },
  { kind: 'special_date', label: '알림일(사용자 지정)' },
]

function GoogleAutoSyncSection({
  google,
  onChange,
}: {
  google: GoogleAutoSyncState
  onChange: (next: GoogleAutoSyncState) => void
}) {
  const canTurnOn = google.available && google.connected && google.calendarWritable
  const masterDisabled = !google.enabled && !canTurnOn
  return (
    <ToggleRow
      label="Google 캘린더 자동 연동"
      enabled={google.enabled}
      onToggle={(enabled) => {
        if (enabled && !canTurnOn) return
        onChange({ ...google, enabled })
      }}
    >
      <p className="notification-settings-modal__hint">
        ON 하면 ONE FC 할 일과 아래에서 선택한 알림이 연결된 본인 Google 캘린더에 &quot;[상령일] 고객 이름&quot;, &quot;[할 일] 할 일 제목&quot;
        같은 제목으로 자동 등록됩니다(앞으로 {google.windowDays}일 범위). 연락처·주민번호·계좌·병력·메모 내용은 보내지 않습니다.
        OFF 하면 더 이상 등록하지 않고, OFF 한 날 다음 날 이후의 ONE FC 자동 일정만 Google 에서 지웁니다.
        지난 일정과 당일 일정, Google 에서 직접 만든 일정, Google 할 일, ONE FC 원본은 그대로 둡니다.
      </p>
      {masterDisabled ? (
        <p className="notification-settings-modal__hint">
          {!google.available
            ? '현재 계정에서는 아직 사용할 수 없습니다.'
            : !google.connected
              ? '내 정보 → 업무 편의 → 서비스 연동에서 Google을 먼저 연결해 주세요.'
              : 'Google 캘린더 쓰기 권한이 필요합니다. 서비스 연동에서 권한을 허용해 주세요.'}
        </p>
      ) : null}
      {GOOGLE_KIND_ROWS.map((row) => (
        <label
          key={row.kind}
          className={`notification-settings-modal__toggle${google.enabled ? '' : ' is-disabled'}`}
        >
          <FormInput
            type="checkbox"
            disabled={!google.enabled}
            checked={google.kinds[row.kind]}
            onChange={(event) =>
              onChange({ ...google, kinds: { ...google.kinds, [row.kind]: event.target.checked } })
            }
          />
          <span>{row.label}</span>
        </label>
      ))}
      {google.enabled || google.syncStatus === 'syncing' ? (
        <p className="notification-settings-modal__hint" data-testid="gcal-sync-status">
          {google.syncStatus === 'syncing'
            ? 'Google 캘린더 동기화 중… (창을 닫아도 계속 진행됩니다)'
            : google.syncStatus === 'error' || google.lastSyncError
              ? '동기화 오류: 일부가 실패했습니다. 자동으로 다시 시도합니다.'
              : google.lastSyncAt
                ? 'Google 캘린더 동기화 완료'
                : ''}
        </p>
      ) : null}
    </ToggleRow>
  )
}

function ToggleRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string
  enabled: boolean
  onToggle: (next: boolean) => void
  children?: ReactNode
}) {
  return (
    <section className="notification-settings-modal__section">
      <div className="notification-settings-modal__section-head">
        <h3 className="notification-settings-modal__section-title">{label}</h3>
        <label className="notification-settings-modal__toggle">
          <input
            type="checkbox"
            className="form-input"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>{enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>
      {children}
    </section>
  )
}

function DaysBeforeField({
  enabled,
  value,
  onChange,
}: {
  enabled: boolean
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label className={`notification-settings-modal__days${enabled ? '' : ' is-disabled'}`}>
      <FormInput
        type="number"
        min={0}
        max={365}
        step={1}
        disabled={!enabled}
        value={value}
        onChange={(event) => {
          const raw = event.target.value
          if (raw === '') {
            return
          }
          const n = Number(raw)
          if (!Number.isInteger(n)) {
            return
          }
          onChange(Math.max(0, Math.min(365, n)))
        }}
      />
      <span>일 전부터 표시</span>
    </label>
  )
}

export function NotificationSettingsModal({
  open,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onCancel,
  google,
  onGoogleChange,
}: NotificationSettingsModalProps) {
  return (
    <FormDialog
      open={open && draft != null}
      title="알림 설정"
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEsc={false}
      onEscapeRequest={busy ? undefined : onCancel}
      usePortal
      panelClassName="notification-settings-modal"
      footer={
        <div className="notification-settings-modal__footer">
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onCancel}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="primary" disabled={busy || !draft} onClick={() => void onSave()}>
            {busy ? '저장 중…' : '저장'}
          </FormButton>
        </div>
      }
    >
      {draft ? (
        <div className="notification-settings-modal__body">
          <ToggleRow
            label="상령일 알림"
            enabled={draft.insuranceAge.enabled}
            onToggle={(enabled) =>
              onChange({
                ...draft,
                insuranceAge: { ...draft.insuranceAge, enabled },
              })
            }
          >
            <DaysBeforeField
              enabled={draft.insuranceAge.enabled}
              value={draft.insuranceAge.daysBefore}
              onChange={(daysBefore) =>
                onChange({
                  ...draft,
                  insuranceAge: { ...draft.insuranceAge, daysBefore },
                })
              }
            />
          </ToggleRow>

          <ToggleRow
            label="자동차 만기 알림"
            enabled={draft.carExpiry.enabled}
            onToggle={(enabled) =>
              onChange({
                ...draft,
                carExpiry: { ...draft.carExpiry, enabled },
              })
            }
          >
            <DaysBeforeField
              enabled={draft.carExpiry.enabled}
              value={draft.carExpiry.daysBefore}
              onChange={(daysBefore) =>
                onChange({
                  ...draft,
                  carExpiry: { ...draft.carExpiry, daysBefore },
                })
              }
            />
          </ToggleRow>

          <ToggleRow
            label="지정일 알림"
            enabled={draft.specialDate.enabled}
            onToggle={(enabled) =>
              onChange({
                ...draft,
                specialDate: { ...draft.specialDate, enabled },
              })
            }
          >
            <DaysBeforeField
              enabled={draft.specialDate.enabled}
              value={draft.specialDate.daysBefore}
              onChange={(daysBefore) =>
                onChange({
                  ...draft,
                  specialDate: { ...draft.specialDate, daysBefore },
                })
              }
            />
          </ToggleRow>

          <ToggleRow
            label="청구요청 알림"
            enabled={draft.claimRequest.enabled}
            onToggle={(enabled) =>
              onChange({
                ...draft,
                claimRequest: { enabled },
              })
            }
          >
            <p className="notification-settings-modal__hint">
              고객앱에서 청구 문의 또는 파일이 올라오면 알림을 표시합니다.
            </p>
          </ToggleRow>

          {google && onGoogleChange ? <GoogleAutoSyncSection google={google} onChange={onGoogleChange} /> : null}

          {error ? (
            <p className="notification-settings-modal__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  )
}
