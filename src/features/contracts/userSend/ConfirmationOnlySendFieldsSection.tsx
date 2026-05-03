/**
 * confirmation_only 발송 화면 — 관리자 정의 확인서 항목 입력(아직 서버 전송 없음).
 */
import { FormInput, FormTextarea } from '../../../components/form'
import type { UserContractConfirmationFieldRow } from './contractSignatureSendClient'

type Props = {
  fields: UserContractConfirmationFieldRow[]
  values: Record<string, string>
  onChange: (fieldKey: string, value: string) => void
  loading: boolean
  loadError: string | null
  validationMessage: string | null
  disabled?: boolean
}

export function ConfirmationOnlySendFieldsSection({
  fields,
  values,
  onChange,
  loading,
  loadError,
  validationMessage,
  disabled = false,
}: Props) {
  return (
    <div className="contract-signature-send-conf-only">
      <p className="contract-signature-console__body-text" style={{ margin: '0 0 8px' }}>
        관리자가 정의한 확인서 항목 값을 입력합니다. 실제 발송은 다음 단계에서 연결됩니다.
      </p>
      {loadError ? (
        <div className="contract-signature-console__alert--danger" role="alert">
          {loadError}
        </div>
      ) : null}
      {loading ? <p className="contract-signature-console__hint">확인 항목을 불러오는 중…</p> : null}
      {!loading && !loadError && fields.length === 0 ? (
        <p className="contract-signature-console__inline-warning" role="status">
          등록된 확인 항목이 없습니다. 관리자 전자서명 템플릿에서 확인서 항목을 추가해 주세요.
        </p>
      ) : null}
      <div className="contract-signature-send-conf-only__stack">
        {fields.map((f) => {
          const v = values[f.fieldKey] ?? ''
          const id = `conf-send-${f.fieldKey}`
          return (
            <div key={f.id} className="contract-signature-send-conf-only__field">
              {f.inputType === 'textarea' ? (
                <label className="contract-signature-send-conf-only__label" htmlFor={id}>
                  <span className="contract-signature-send-conf-only__label-text">
                    {f.label}
                    {f.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                  </span>
                  {f.helpText ? (
                    <span className="contract-signature-send-conf-only__help">{f.helpText}</span>
                  ) : null}
                  <FormTextarea
                    id={id}
                    className="contract-signature-send-conf-only__control"
                    rows={4}
                    disabled={disabled || loading}
                    placeholder={f.placeholder ?? undefined}
                    value={v}
                    onChange={(e) => onChange(f.fieldKey, e.target.value)}
                  />
                </label>
              ) : (
                <label className="contract-signature-send-conf-only__label" htmlFor={id}>
                  <span className="contract-signature-send-conf-only__label-text">
                    {f.label}
                    {f.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                  </span>
                  {f.helpText ? (
                    <span className="contract-signature-send-conf-only__help">{f.helpText}</span>
                  ) : null}
                  <FormInput
                    id={id}
                    className="contract-signature-send-conf-only__control"
                    type={f.inputType === 'number' ? 'number' : f.inputType === 'date' ? 'date' : 'text'}
                    disabled={disabled || loading}
                    placeholder={f.placeholder ?? undefined}
                    value={v}
                    onChange={(e) => onChange(f.fieldKey, e.target.value)}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
      {validationMessage ? (
        <p className="contract-signature-console__inline-warning" role="status" style={{ marginTop: 10 }}>
          {validationMessage}
        </p>
      ) : null}
    </div>
  )
}
