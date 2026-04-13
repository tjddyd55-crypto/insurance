import type { ButtonHTMLAttributes } from 'react'

export type FormButtonVariant = 'primary' | 'secondary' | 'action' | 'danger'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  htmlType?: 'button' | 'submit' | 'reset'
  variant?: FormButtonVariant
}

export default function FormButton({
  htmlType = 'button',
  variant = 'action',
  className = '',
  children,
  ...props
}: Props) {
  const variantClassName = `btn--${variant}`
  const mergedClassName = ['btn', variantClassName, className].filter(Boolean).join(' ')

  return (
    <button {...props} type={htmlType} className={mergedClassName}>
      {children}
    </button>
  )
}
