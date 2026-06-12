import type { HTMLAttributes, ReactNode } from 'react'

export type UserPanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: 'section' | 'div' | 'article'
  padded?: boolean
}

export default function UserPanel({
  children,
  as: Tag = 'section',
  padded = true,
  className = '',
  ...props
}: UserPanelProps) {
  const merged = ['user-panel', padded ? 'user-panel--padded' : '', className].filter(Boolean).join(' ')
  return (
    <Tag className={merged} {...props}>
      {children}
    </Tag>
  )
}
