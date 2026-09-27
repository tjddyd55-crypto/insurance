/**
 * 드롭존이 맞지 않는 파일 선택.
 * 리치 텍스트 툴바 버튼, 「파일 선택」처럼 이미 트리거가 있는 곳에서 쓴다.
 * display:none 은 일부 모바일에서 change가 오지 않아 화면 밖 클립으로 숨긴다.
 */
import { forwardRef, type ChangeEventHandler } from 'react'
import FormInput from '../form/FormInput'

export type HiddenFileInputProps = {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  name?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}

export const HiddenFileInput = forwardRef<HTMLInputElement, HiddenFileInputProps>(function HiddenFileInput(
  { accept, multiple, disabled, className, name, onChange },
  ref,
) {
  const mergedClassName = ['common-hidden-file-input', className].filter(Boolean).join(' ')
  return (
    <FormInput
      ref={ref}
      type="file"
      name={name}
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      className={mergedClassName}
      onChange={onChange}
    />
  )
})
