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
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50'
  const skin =
    variant === 'primary'
      ? 'border border-[var(--border-default)] bg-[var(--brand)] text-[var(--text-on-primary)]'
      : 'border border-[var(--border-default)] bg-[var(--bg-soft)] text-[var(--text-primary)]'
  return (
    <button type={type} {...props} className={`${base} ${skin} ${className}`.trim()}>
      {children}
    </button>
  )
}
