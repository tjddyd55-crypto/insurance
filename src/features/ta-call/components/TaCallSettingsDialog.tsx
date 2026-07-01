import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import {
  TA_CALL_MAX_TARGET,
  TA_CALL_MIN_TARGET,
  TA_CALL_RECOMMENDED_TARGETS,
} from '../config/taCall.config'

type TaCallSettingsDialogProps = {
  open: boolean
  busy: boolean
  draftTarget: number
  dirty: boolean
  variant: 'pc' | 'mobile'
  onClose: () => void
  onSave: () => void
  onChangeTarget: (next: number) => void
}

export default function TaCallSettingsDialog({
  open,
  busy,
  draftTarget,
  dirty,
  variant,
  onClose,
  onSave,
  onChangeTarget,
}: TaCallSettingsDialogProps) {
  const handleEscape = () => {
    if (dirty) {
      const ok = window.confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?')
      if (!ok) return
    }
    onClose()
  }

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onEscapeRequest={handleEscape}
      closeOnBackdrop={false}
      ariaLabel="오늘의 TA 설정"
      panelClassName={`ta-call-settings-dialog ta-call-settings-dialog--${variant}`}
    >
      <div className="ta-call-settings-dialog__header">
        <h2 className="ta-call-settings-dialog__title">하루 목표 전화 수</h2>
      </div>
      <div className="ta-call-settings-dialog__body">
        <div className="ta-call-settings-dialog__stepper">
          <button
            type="button"
            className="ta-call-settings-dialog__step-btn"
            disabled={busy || draftTarget <= TA_CALL_MIN_TARGET}
            onClick={() => onChangeTarget(draftTarget - 1)}
            aria-label="목표 인원 줄이기"
          >
            −
          </button>
          <span className="ta-call-settings-dialog__value">{draftTarget}명</span>
          <button
            type="button"
            className="ta-call-settings-dialog__step-btn"
            disabled={busy || draftTarget >= TA_CALL_MAX_TARGET}
            onClick={() => onChangeTarget(draftTarget + 1)}
            aria-label="목표 인원 늘리기"
          >
            +
          </button>
        </div>
        <div className="ta-call-settings-dialog__recommended">
          {TA_CALL_RECOMMENDED_TARGETS.map((value) => (
            <button
              key={value}
              type="button"
              className="ta-call-settings-dialog__chip"
              disabled={busy}
              onClick={() => onChangeTarget(value)}
            >
              {value}명
            </button>
          ))}
        </div>
        <p className="ta-call-settings-dialog__hint">
          허용 범위 {TA_CALL_MIN_TARGET}~{TA_CALL_MAX_TARGET}명 · 변경된 목표는 다음 날부터 기본 적용됩니다.
        </p>
      </div>
      <div className="ta-call-settings-dialog__footer">
        <FormButton type="button" variant="secondary" disabled={busy} onClick={handleEscape}>
          취소
        </FormButton>
        <FormButton type="button" variant="primary" disabled={busy} onClick={onSave}>
          저장
        </FormButton>
      </div>
    </BaseDialog>
  )
}
