import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type UiButtonVariant = 'primary' | 'secondary' | 'action' | 'danger'
export type UiButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: UiButtonVariant
  size?: UiButtonSize
  loading?: boolean
  fullWidth?: boolean
  loadingText?: string
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  loadingText = '처리 중…',
  type = 'button',
  disabled = false,
  ...props
}: ButtonProps) {
  const variantClassName =
    variant === 'action' ? '' : variant === 'primary' ? 'button--primary' : `button--${variant}`
  const sizeClassName = size === 'sm' ? 'button--small' : ''
  const fullWidthClassName = fullWidth ? 'button--full' : ''
  const mergedClassName = ['button', variantClassName, sizeClassName, fullWidthClassName, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} {...props} disabled={disabled || loading} className={mergedClassName}>
      {loading ? loadingText : children}
    </button>
  )
}
