/**
 * confirmation_only 발송 화면 — 관리자 정의 확인서 항목 입력.
 * 발송 API·값 저장은 서버에 연결되었으나 고객 확인 화면 준비 전까지 발송 버튼은 비활성입니다.
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
  /** 모바일 발송: contract-send-mobile-confirmation-fields BEM 적용 */
  mobileSendLayout?: boolean
}

export function ConfirmationOnlySendFieldsSection({
  fields,
  values,
  onChange,
  loading,
  loadError,
  validationMessage,
  disabled = false,
  mobileSendLayout = false,
}: Props) {
  if (mobileSendLayout) {
    return (
      <div className="contract-send-mobile-confirmation-fields">
        <div className="contract-send-mobile-confirmation-fields__header">
          <p className="contract-send-mobile-confirmation-fields__desc">
            관리자가 정의한 확인서 항목 값을 입력합니다. 고객 확인 화면이 준비되면 발송이 가능해집니다.
          </p>
        </div>
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
        <div className="contract-send-mobile-confirmation-fields__list">
          {fields.map((f) => {
            const v = values[f.fieldKey] ?? ''
            const id = `conf-send-${f.fieldKey}`
            return (
              <div key={f.id} className="contract-send-mobile-confirmation-fields__field">
                {f.inputType === 'textarea' ? (
                  <label className="contract-send-mobile-confirmation-fields__label" htmlFor={id}>
                    <span className="contract-send-mobile-confirmation-fields__label-text">
                      {f.label}
                      {f.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                    </span>
                    {f.helpText ? (
                      <span className="contract-send-mobile-confirmation-fields__help">{f.helpText}</span>
                    ) : null}
                    <FormTextarea
                      id={id}
                      className="contract-send-mobile-confirmation-fields__control"
                      rows={4}
                      disabled={disabled || loading}
                      placeholder={f.placeholder ?? undefined}
                      value={v}
                      onChange={(e) => onChange(f.fieldKey, e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="contract-send-mobile-confirmation-fields__label" htmlFor={id}>
                    <span className="contract-send-mobile-confirmation-fields__label-text">
                      {f.label}
                      {f.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                    </span>
                    {f.helpText ? (
                      <span className="contract-send-mobile-confirmation-fields__help">{f.helpText}</span>
                    ) : null}
                    <FormInput
                      id={id}
                      className="contract-send-mobile-confirmation-fields__control"
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
          <p className="contract-send-mobile-confirmation-fields__error" role="status">
            {validationMessage}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="contract-signature-send-conf-only">
      <p className="contract-signature-console__body-text" style={{ margin: '0 0 8px' }}>
        관리자가 정의한 확인서 항목 값을 입력합니다. 고객 확인 화면이 준비되면 발송이 가능해집니다.
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
