import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import {
  TA_CALL_MAX_TARGET,
  TA_CALL_MIN_TARGET,
  TA_CALL_RECOMMENDED_TARGETS,
} from '../config/taCall.config'
import type { TaCallSettings, TaTargetGender } from '../types/taCall.types'

type TaCallSettingsDialogProps = {
  open: boolean
  busy: boolean
  draftSettings: TaCallSettings
  dirty: boolean
  variant: 'pc' | 'mobile'
  onClose: () => void
  onSave: () => void
  onChangeTarget: (next: number) => void
  onChangeGender: (gender: TaTargetGender) => void
  onChangeSangnyeongDays: (raw: string) => void
  onChangeInsuranceAgeMin: (raw: string) => void
  onChangeInsuranceAgeMax: (raw: string) => void
  onChangeExcludeMinors: (checked: boolean) => void
}

export default function TaCallSettingsDialog({
  open,
  busy,
  draftSettings,
  dirty,
  variant,
  onClose,
  onSave,
  onChangeTarget,
  onChangeGender,
  onChangeSangnyeongDays,
  onChangeInsuranceAgeMin,
  onChangeInsuranceAgeMax,
  onChangeExcludeMinors,
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
        <h2 className="ta-call-settings-dialog__title">오늘의 TA 설정</h2>
      </div>
      <div className="ta-call-settings-dialog__body">
        <section className="ta-call-settings-dialog__section">
          <h3 className="ta-call-settings-dialog__section-title">하루 목표 전화 수</h3>
          <div className="ta-call-settings-dialog__stepper">
            <button
              type="button"
              className="ta-call-settings-dialog__step-btn"
              disabled={busy || draftSettings.dailyTargetCount <= TA_CALL_MIN_TARGET}
              onClick={() => onChangeTarget(draftSettings.dailyTargetCount - 1)}
              aria-label="목표 인원 줄이기"
            >
              −
            </button>
            <span className="ta-call-settings-dialog__value">{draftSettings.dailyTargetCount}명</span>
            <button
              type="button"
              className="ta-call-settings-dialog__step-btn"
              disabled={busy || draftSettings.dailyTargetCount >= TA_CALL_MAX_TARGET}
              onClick={() => onChangeTarget(draftSettings.dailyTargetCount + 1)}
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
        </section>

        <section className="ta-call-settings-dialog__section">
          <h3 className="ta-call-settings-dialog__section-title">타겟 조건</h3>
          <label className="ta-call-settings-dialog__field">
            <span>성별</span>
            <select
              className="ta-call-settings-dialog__select"
              disabled={busy}
              value={draftSettings.targetGender}
              onChange={(e) => onChangeGender(e.target.value as TaTargetGender)}
            >
              <option value="all">전체</option>
              <option value="male">남</option>
              <option value="female">여</option>
            </select>
          </label>
          <label className="ta-call-settings-dialog__field">
            <span>상령일</span>
            <div className="ta-call-settings-dialog__inline">
              <FormInput
                type="number"
                min={0}
                disabled={busy}
                value={draftSettings.targetSangnyeongDays ?? ''}
                onChange={(e) => onChangeSangnyeongDays(e.target.value)}
              />
              <span>일 이내</span>
            </div>
          </label>
          <div className="ta-call-settings-dialog__field">
            <span>보험나이</span>
            <div className="ta-call-settings-dialog__age-row">
              <FormInput
                type="number"
                min={0}
                disabled={busy}
                value={draftSettings.targetInsuranceAgeMin ?? ''}
                placeholder="최소"
                onChange={(e) => onChangeInsuranceAgeMin(e.target.value)}
              />
              <span>세 이상</span>
              <FormInput
                type="number"
                min={0}
                disabled={busy}
                value={draftSettings.targetInsuranceAgeMax ?? ''}
                placeholder="최대"
                onChange={(e) => onChangeInsuranceAgeMax(e.target.value)}
              />
              <span>세 이하</span>
            </div>
          </div>
          <label className="ta-call-settings-dialog__checkbox">
            <input
              type="checkbox"
              checked={draftSettings.excludeMinors}
              disabled={busy}
              onChange={(e) => onChangeExcludeMinors(e.target.checked)}
            />
            <span>미성년 제외</span>
          </label>
        </section>

        <p className="ta-call-settings-dialog__hint">
          조건을 설정하면 해당 조건에 맞는 고객 중에서 오늘의 TA가 자동 배정됩니다.
        </p>
        <p className="ta-call-settings-dialog__hint">
          이미 생성된 오늘 목록은 유지되며, 변경된 조건은 다음 배정부터 적용됩니다.
        </p>
        <p className="ta-call-settings-dialog__hint">
          허용 범위 {TA_CALL_MIN_TARGET}~{TA_CALL_MAX_TARGET}명
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
