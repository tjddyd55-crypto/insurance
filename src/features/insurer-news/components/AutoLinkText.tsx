import type { ReactNode } from 'react'
import { parseTextTokens } from '../utils/linkTextParser.js'

type Props = {
  text: string
  className?: string
  enableAutoLinking?: boolean
  enablePhoneLinks?: boolean
}

/**
 * plain-text 본문을 안전하게 React 노드로 렌더.
 * HTML 저장/dangerouslySetInnerHTML 없이 URL·전화만 링크화.
 */
export function AutoLinkText({
  text,
  className,
  enableAutoLinking = true,
  enablePhoneLinks = true,
}: Props) {
  if (!enableAutoLinking && !enablePhoneLinks) {
    return <div className={className}>{text}</div>
  }

  const tokens = parseTextTokens(text)
  const nodes: ReactNode[] = []

  tokens.forEach((token, index) => {
    if (token.type === 'lineBreak') {
      nodes.push(<br key={`br-${index}`} />)
      return
    }
    if (token.type === 'url' && enableAutoLinking) {
      nodes.push(
        <a
          key={`url-${index}`}
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ wordBreak: 'break-all' }}
        >
          {token.value}
        </a>,
      )
      return
    }
    if (token.type === 'phone' && enablePhoneLinks) {
      nodes.push(
        <a key={`phone-${index}`} href={token.href} style={{ wordBreak: 'break-all' }}>
          {token.value}
        </a>,
      )
      return
    }
    if (token.type === 'text' || token.type === 'url' || token.type === 'phone') {
      nodes.push(<span key={`t-${index}`}>{token.value}</span>)
    }
  })

  return <div className={className}>{nodes}</div>
}
