import { cleanPhone, formatPhone } from '../../contacts/utils/phone'
import type { CompanyHistorySnapshot } from '../domain/types'
import { copyToClipboard } from '../utils/clipboard'

export function isFieldChanged(beforeVal: string | undefined | null, afterVal: string | undefined | null): boolean {
  return (beforeVal ?? '') !== (afterVal ?? '')
}

function telHref(raw: string): string {
  const d = cleanPhone(raw)
  return d ? `tel:${d}` : '#'
}

type ContactLine = { name: string; position: string; phone: string }

function contactSortKey(c: ContactLine): string {
  return `${c.position}\t${c.name}\t${c.phone}`
}

function pairContacts(beforeContacts: ContactLine[], afterContacts: ContactLine[]) {
  const B = [...beforeContacts].sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b), 'ko'))
  const A = [...afterContacts].sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b), 'ko'))
  const len = Math.max(B.length, A.length)
  const pairs: Array<{ before: ContactLine; after: ContactLine }> = []
  for (let i = 0; i < len; i++) {
    pairs.push({
      before: B[i] ?? { position: '', name: '', phone: '' },
      after: A[i] ?? { position: '', name: '', phone: '' },
    })
  }
  return pairs
}

function copy(text: string) {
  copyToClipboard(text)
}

export interface CompanyCardDiffProps {
  companyName: string
  before: CompanyHistorySnapshot
  after: CompanyHistorySnapshot
}

export function CompanyCardDiff({ companyName, before, after }: CompanyCardDiffProps) {
  const customerCenter = after.customerCenter?.trim() ?? ''
  const systemPhone = after.system?.trim() ?? ''
  const incallNumber = after.incall?.trim() ?? ''
  const visitInfo = after.visitInfo?.trim() ?? ''

  const contactPairs = pairContacts(before.contacts ?? [], after.contacts ?? [])

  return (
    <article className="company-card company-card--diff">
      <div className="company-card__header">
        <h3 className="company-card__title">{companyName}</h3>
      </div>

      <div className="company-info-block">
        <div className="info-row">
          <span className="label">고객센터</span>
          <span
            className={`value${isFieldChanged(before.customerCenter, after.customerCenter) ? ' changed' : ''}`}
          >
            {customerCenter ? formatPhone(customerCenter) : '—'}
          </span>
          {customerCenter ? (
            <div className="actions-mini">
              <a href={telHref(customerCenter)} aria-label="고객센터 전화">
                📞
              </a>
              <button type="button" onClick={() => copy(customerCenter)} aria-label="고객센터 번호 복사">
                📋
              </button>
            </div>
          ) : null}
        </div>

        <div className="info-row">
          <span className="label">전산문의</span>
          <span className={`value${isFieldChanged(before.system, after.system) ? ' changed' : ''}`}>
            {systemPhone ? formatPhone(systemPhone) : '—'}
          </span>
          {systemPhone ? (
            <div className="actions-mini">
              <a href={telHref(systemPhone)} aria-label="전산문의 전화">
                📞
              </a>
              <button type="button" onClick={() => copy(systemPhone)} aria-label="전산문의 번호 복사">
                📋
              </button>
            </div>
          ) : null}
        </div>

        <div className="info-row">
          <span className="label">인콜</span>
          <span className={`value${isFieldChanged(before.incall, after.incall) ? ' changed' : ''}`}>
            {incallNumber ? formatPhone(incallNumber) : '—'}
          </span>
          {incallNumber ? (
            <div className="actions-mini">
              <button type="button" onClick={() => copy(incallNumber)} aria-label="인콜 번호 복사">
                📋
              </button>
            </div>
          ) : null}
        </div>

        {visitInfo || before.visitInfo?.trim() ? (
          <div className="info-row">
            <span className="label">방문일</span>
            <span className={`value${isFieldChanged(before.visitInfo, after.visitInfo) ? ' changed' : ''}`}>
              {visitInfo || '—'}
            </span>
          </div>
        ) : null}
      </div>

      {contactPairs.length ? (
        <div className="company-contacts-block">
          {contactPairs.map((pair, idx) => {
            const b = pair.before
            const a = pair.after
            const hasAfter = Boolean(a.position || a.name || a.phone)
            const hasBefore = Boolean(b.position || b.name || b.phone)
            if (!hasAfter && !hasBefore) {
              return null
            }
            const position = hasAfter ? a.position : b.position
            const name = hasAfter ? a.name : b.name
            const phoneRaw = hasAfter ? a.phone : b.phone
            const contactText = [position, name].filter(Boolean).join(' ') || '—'
            const posCh = isFieldChanged(b.position, a.position)
            const nameCh = isFieldChanged(b.name, a.name)
            const phoneCh = isFieldChanged(b.phone, a.phone)

            return (
              <div key={`diff-${idx}-${contactText}-${phoneRaw}`} className="contact-row">
                <span className="contact-text">
                  <span className={posCh ? 'changed' : undefined}>{position}</span>
                  {position && name ? ' ' : null}
                  <span className={nameCh ? 'changed' : undefined}>{name}</span>
                </span>
                {phoneRaw ? (
                  <span className={`contact-phone${phoneCh ? ' changed' : ''}`}>{formatPhone(phoneRaw)}</span>
                ) : (
                  <span className={`contact-phone contact-phone--empty${phoneCh ? ' changed' : ''}`}>—</span>
                )}
                <div className="actions-mini">
                  {phoneRaw ? (
                    <a href={telHref(phoneRaw)} aria-label={`${formatPhone(phoneRaw)} 전화`}>
                      📞
                    </a>
                  ) : null}
                  {phoneRaw ? (
                    <button type="button" onClick={() => copy(phoneRaw)} aria-label="담당자 번호 복사">
                      📋
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="contact-card--empty">
          <div className="empty-box contact-card--empty-msg" role="status">
            📭 등록된 담당자가 없습니다
          </div>
        </div>
      )}
    </article>
  )
}
