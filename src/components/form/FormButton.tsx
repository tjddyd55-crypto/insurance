import type { ButtonHTMLAttributes } from 'react'
import { Button, type UiButtonSize } from '../ui'

export type FormButtonVariant = 'primary' | 'secondary' | 'action' | 'danger'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  htmlType?: 'button' | 'submit' | 'reset'
  variant?: FormButtonVariant
  size?: UiButtonSize
  loading?: boolean
  loadingText?: string
  fullWidth?: boolean
}

export default function FormButton({
  htmlType = 'button',
  variant = 'action',
  size = 'md',
  loading = false,
  loadingText = '처리 중…',
  fullWidth = false,
  className = '',
  children,
  ...props
}: Props) {
  return (
    <Button
      {...props}
      type={htmlType}
      variant={variant}
      size={size}
      loading={loading}
      loadingText={loadingText}
      fullWidth={fullWidth}
      className={className}
    >
      {children}
    </Button>
  )
}
