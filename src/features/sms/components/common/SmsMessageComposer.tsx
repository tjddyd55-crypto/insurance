import type { SmsMessageComposerProps } from './smsMessagePreview.types'
import { SmsMessageLengthIndicator } from './SmsMessageLengthIndicator'

export function SmsMessageComposer({
  value,
  onChange,
  meta,
  label = '메시지 본문',
  placeholder = '보낼 문자 내용을 입력해 주세요.',
  maxLength,
  rows = 10,
  disabled = false,
  readOnly = false,
  realSendEnabled = true,
  transitionNotice,
  onDismissTransition,
  variableButtons,
  helperText,
  validationMessage,
  showWrapHint = true,
  textareaRef,
  onTextareaSelect,
  className,
}: SmsMessageComposerProps) {
  return (
    <div className={className}>
      <label className="sms-composer__editor-label">
        {label}
        <textarea
          ref={textareaRef}
          className="sms-module__textarea sms-composer__textarea"
          rows={rows}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onClick={onTextareaSelect}
          onKeyUp={onTextareaSelect}
          onSelect={onTextareaSelect}
        />
      </label>

      <SmsMessageLengthIndicator
        meta={meta}
        realSendEnabled={realSendEnabled}
        transitionNotice={transitionNotice}
        onDismissTransition={onDismissTransition}
      />

      {showWrapHint ? (
        <p className="sms-composer__wrap-hint">
          실제 줄바꿈은 오른쪽 휴대폰 미리보기 기준으로 확인해 주세요.
        </p>
      ) : null}

      {variableButtons}
      {helperText}
      {validationMessage}
    </div>
  )
}

export default SmsMessageComposer
