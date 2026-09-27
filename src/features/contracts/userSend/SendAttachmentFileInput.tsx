/**
 * 전자서명 발송 첨부 파일 선택.
 * 화면의 「+ 첨부파일 추가」 버튼이 이 입력을 연다.
 * 드롭존으로 바꾸면 그 버튼과 첨부 목록 흐름이 달라지므로 HiddenFileInput만 쓴다.
 */
import { forwardRef, type ChangeEventHandler } from 'react'
import { HiddenFileInput } from '../../../components/common/HiddenFileInput'

type Props = {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}

export const SendAttachmentFileInput = forwardRef<HTMLInputElement, Props>(function SendAttachmentFileInput(
  { accept, multiple, disabled, className, onChange },
  ref,
) {
  return (
    <HiddenFileInput
      ref={ref}
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      className={className}
      onChange={onChange}
    />
  )
})
