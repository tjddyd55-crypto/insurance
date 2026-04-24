import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'

type ClaimRequestsPageMobileViewProps = {
  children: ReactNode
}

const INLINE_DETAIL_TITLE = '선택한 청구 요청 상세'

function nodeContainsText(node: ReactNode, target: string): boolean {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(target)
  }

  if (Array.isArray(node)) {
    return node.some((child) => nodeContainsText(child, target))
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeContainsText(node.props.children, target)
  }

  return false
}

export default function ClaimRequestsPageMobileView({ children }: ClaimRequestsPageMobileViewProps) {
  const visibleChildren = Children.toArray(children).filter((child) => !nodeContainsText(child, INLINE_DETAIL_TITLE))

  return (
    <main className="page claim-requests-page claim-requests-page--mobile page--with-back content-wrapper space-y-4">
      {visibleChildren}
    </main>
  )
}
