import { Children, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

type ClaimRequestsPageMobileViewProps = {
  children: ReactNode
}

const INLINE_DETAIL_TITLE = '선택한 청구 요청 상세'
const PROTECTED_SECTION_TITLES = ['링크 발송', '연결 상태', '청구 요청 목록']

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

function shouldRemoveInlineDetail(node: ReactElement<{ children?: ReactNode }>): boolean {
  if (!nodeContainsText(node, INLINE_DETAIL_TITLE)) {
    return false
  }

  return !PROTECTED_SECTION_TITLES.some((title) => nodeContainsText(node, title))
}

function filterMobileChildren(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map(filterMobileChildren).filter(Boolean)
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node
  }

  if (shouldRemoveInlineDetail(node)) {
    return null
  }

  if (!nodeContainsText(node, INLINE_DETAIL_TITLE)) {
    return node
  }

  return cloneElement(node, {
    children: filterMobileChildren(node.props.children),
  })
}

export default function ClaimRequestsPageMobileView({ children }: ClaimRequestsPageMobileViewProps) {
  return (
    <main className="page claim-requests-page claim-requests-page--mobile page--with-back content-wrapper space-y-4">
      {filterMobileChildren(Children.toArray(children))}
    </main>
  )
}
