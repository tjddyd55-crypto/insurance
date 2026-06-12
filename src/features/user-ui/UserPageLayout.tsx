import type { ReactNode } from 'react'
import UserPageHeader, { type UserPageHeaderProps } from './UserPageHeader'

export type UserPageLayoutProps = {
  children: ReactNode
  /** default: 표준 max-width · fullBleed: 고객/메모 split 등 */
  variant?: 'default' | 'fullBleed'
  className?: string
  header?: Pick<UserPageHeaderProps, 'title' | 'subtitle' | 'actions'>
}

/**
 * 유저 영역 공통 페이지 래퍼 — 배경·여백·제목 톤을 user-ui.css SSOT 로 맞춘다.
 * 기능 로직은 children 에 그대로 둔다.
 */
export default function UserPageLayout({
  children,
  variant = 'default',
  className = '',
  header,
}: UserPageLayoutProps) {
  const rootClass = [
    'user-page',
    variant === 'fullBleed' ? 'user-page--full-bleed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass}>
      {header ? (
        <UserPageHeader title={header.title} subtitle={header.subtitle} actions={header.actions} />
      ) : null}
      <div className="user-page__content">{children}</div>
    </div>
  )
}
