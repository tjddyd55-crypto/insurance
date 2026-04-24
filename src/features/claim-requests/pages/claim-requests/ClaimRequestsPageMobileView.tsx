import { Children, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

type ClaimRequestsPageMobileViewProps = {
  children: ReactNode
}

const INLINE_DETAIL_TITLE = '선택한 청구 요청 상세'
const RAW_LINK_FIELD_TITLES = ['연결 코드', '연결 URL']
const PROTECTED_SECTION_TITLES = ['링크 발송', '연결 상태', '청구 요청 목록']
const PROTECTED_LINK_ACTION_TITLES = ['링크 발송', '문자 발송', '카카오 발송', '링크 미리보기']

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

function nodeContainsAnyText(node: ReactNode, targets: string[]): boolean {
  return targets.some((target) => nodeContainsText(node, target))
}

function shouldRemoveInlineDetail(node: ReactElement<{ children?: ReactNode }>): boolean {
  if (!nodeContainsText(node, INLINE_DETAIL_TITLE)) {
    return false
  }

  return !PROTECTED_SECTION_TITLES.some((title) => nodeContainsText(node, title))
}

function shouldRemoveRawLinkField(node: ReactElement<{ children?: ReactNode }>): boolean {
  if (!nodeContainsAnyText(node, RAW_LINK_FIELD_TITLES)) {
    return false
  }

  // Keep the entire link card/header/action group and continue filtering inside it.
  if (nodeContainsAnyText(node, PROTECTED_LINK_ACTION_TITLES)) {
    return false
  }

  return true
}

function shouldInspectChildren(node: ReactElement<{ children?: ReactNode }>): boolean {
  return nodeContainsText(node, INLINE_DETAIL_TITLE) || nodeContainsAnyText(node, RAW_LINK_FIELD_TITLES)
}

function filterMobileChildren(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map(filterMobileChildren).filter(Boolean)
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node
  }

  if (shouldRemoveInlineDetail(node) || shouldRemoveRawLinkField(node)) {
    return null
  }

  if (!shouldInspectChildren(node)) {
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
