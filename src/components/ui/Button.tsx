import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type UiButtonVariant = 'primary' | 'secondary'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: UiButtonVariant
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-[background-color,border-color,transform] active:scale-[0.98] disabled:opacity-50'
  const skin =
    variant === 'primary'
      ? 'border border-[var(--border-default)] bg-[var(--brand)] text-[var(--text-on-primary)] hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)]'
      : 'border border-[var(--border-default)] bg-[var(--bg-soft)] text-[var(--text-primary)] hover:bg-[var(--btn-hover-bg)] hover:border-[var(--btn-hover-border)]'
  return (
    <button type={type} {...props} className={`${base} ${skin} ${className}`.trim()}>
      {children}
    </button>
  )
}
