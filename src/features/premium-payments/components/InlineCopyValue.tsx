import { FormButton } from '../../../components/form'

type Props = {
  value: string | null | undefined
  /** 화면 표시 문자열 (없으면 value trim 사용) */
  display?: string | null
  emptyLabel?: string
  mono?: boolean
  onCopy: (trimmed: string) => void
}

/**
 * 값 + 복사 버튼 한 줄 셀.
 * 값이 없으면 복사 버튼 없이 emptyLabel만 표시.
 */
export function InlineCopyValue({ value, display, emptyLabel = '-', mono = false, onCopy }: Props) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return <span className="premium-payments-cell-text">{emptyLabel}</span>
  }

  const shown = (display ?? trimmed).trim() || trimmed
  const valueClass = ['premium-payments-inline-value__text', mono ? 'premium-payments-mono' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className="premium-payments-inline-value">
      <span className={valueClass} title={shown}>
        {shown}
      </span>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="premium-payments-inline-value__copy"
        onClick={() => onCopy(trimmed)}
      >
        복사
      </FormButton>
    </span>
  )
}
