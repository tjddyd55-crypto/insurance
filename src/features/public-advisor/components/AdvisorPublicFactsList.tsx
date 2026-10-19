import type { AdvisorPublicInfoBlock } from '../utils/buildAdvisorPublicInfoBlocks'
import { AdvisorPublicCopyButton } from './AdvisorPublicCopyButton'

type Props = {
  blocks: AdvisorPublicInfoBlock[]
  isPreview?: boolean
}

export function AdvisorPublicFactsList({ blocks, isPreview = false }: Props) {
  if (!blocks.length) return null

  return (
    <section className="pap-section pap-section--facts pap-fc-card">
      <h2 className="pap-section__sr-only">소속 및 연락 정보</h2>
      <dl className="pap-facts">
        {blocks.map((block) => {
          const key = `${block.label}-${block.displayValue ?? block.value ?? block.lines?.join('|') ?? ''}`
          const copyText = block.copyText ?? block.displayValue ?? block.value ?? ''
          const showCopy = Boolean(block.copyable && copyText.trim())

          return (
            <div key={key} className="pap-facts__row">
              <dt>{block.label}</dt>
              {block.lines ? (
                <dd className="pap-facts__dd--stacked">
                  {block.lines.map((line) => (
                    <span key={line} className="pap-facts__line">{line}</span>
                  ))}
                </dd>
              ) : (
                <dd className="pap-facts__dd--with-copy">
                  <span className="pap-facts__value">
                    {block.href && !isPreview ? (
                      <a
                        href={block.href}
                        target={block.external ? '_blank' : undefined}
                        rel={block.external ? 'noopener noreferrer' : undefined}
                      >
                        {block.displayValue ?? block.value}
                      </a>
                    ) : (
                      block.displayValue ?? block.value
                    )}
                  </span>
                  {showCopy ? <AdvisorPublicCopyButton text={copyText} /> : null}
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
