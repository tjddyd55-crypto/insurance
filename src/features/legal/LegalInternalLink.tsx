import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildPolicyHref, sanitizeLegalReturnTo } from './legalPageNavigation'

/** 정책 문서 본문·footer 교차 링크 — 기존 returnTo 유지 */
export default function LegalInternalLink({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  const [searchParams] = useSearchParams()
  const returnTo = sanitizeLegalReturnTo(searchParams.get('returnTo'))
  return (
    <Link to={buildPolicyHref(to, returnTo)} className={className}>
      {children}
    </Link>
  )
}
