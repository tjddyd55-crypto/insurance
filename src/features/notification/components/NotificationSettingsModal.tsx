import type { ReactNode } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog/FormDialog'
import type { UserAlertSettings } from '../api/notificationApi'

export type NotificationSettingsModalProps = {
  open: boolean
  draft: UserAlertSettings | null
  busy: boolean
  error: string
  onChange: (next: UserAlertSettings) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
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
}: NotificationSettingsModalProps) {
  return (
    <FormDialog
      open={open && draft != null}
      title="알림 설정"
      onClose={onCancel}
      closeOnBackdrop={false}
      closeOnEsc={false}
      onEscapeRequest={busy ? undefined : onCancel}
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
