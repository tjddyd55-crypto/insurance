import { FormButton } from '../../../components/form'
import { asTrimmedText, cleanPhone, formatPhone } from '../../contacts/utils/phone'
import type { CompanyDirectoryEntry, CompanyHistorySnapshot } from '../domain/types'
import { copyToClipboard } from '../utils/clipboard'
import {
  contactRoleKey,
  isHistoryContactFieldChanged,
  isHistoryPhoneChanged,
  isHistoryTextChanged,
  pairHistoryContacts,
  sortCompanyContactsByInputOrder,
} from '../../../../server/lib/companyHistoryDiff.js'
import {
  formatCompanyUpdatedBadgeDate,
  type CompanyDirectoryChangeSummary,
} from '../utils/companyDirectoryChanges'

function telHref(raw: string): string {
  const d = cleanPhone(raw)
  return d ? `tel:${d}` : '#'
}

function copy(text: string, onCopyFeedback?: (message: string) => void) {
  void copyToClipboard(text).then((ok) => {
    onCopyFeedback?.(
      ok ? '복사되었습니다.' : '복사하지 못했습니다. 번호를 직접 선택해 복사해 주세요.',
    )
  })
}

function renderPositionLabel(position: string | undefined | null) {
  const text = asTrimmedText(position)
  if (!text) {
    return '—'
  }
  if (text === '설계매니저') {
    return (
      <>
        설계
        <br />
        매니저
      </>
    )
  }
  return text
}

export type CompanyCardProps =
  | {
      variant: 'directory'
      entry: CompanyDirectoryEntry
      showEditButton?: boolean
      onEdit?: (entry: CompanyDirectoryEntry) => void
      onCopyFeedback?: (message: string) => void
      /** 마지막 저장 기준 변경 요약(기준일 배지 + 변경 필드 빨간 강조). 없으면 강조/배지 미표시. */
      changeSummary?: CompanyDirectoryChangeSummary
    }
  | {
      variant: 'history'
      companyName: string
      before: CompanyHistorySnapshot
      after: CompanyHistorySnapshot
      onCopyFeedback?: (message: string) => void
    }

export function CompanyCard(props: CompanyCardProps) {
  const onCopyFeedback = props.onCopyFeedback
  const handleCopy = (text: string) => copy(text, onCopyFeedback)

  if (props.variant === 'directory') {
    const c = props.entry
    const customerCenter = asTrimmedText(c.customerCenter)
    const systemPhone = asTrimmedText(c.systemPhone)
    const incallNumber = asTrimmedText(c.incallNumber)
    const visitInfo = asTrimmedText(c.visitInfo)
    const summary = props.changeSummary
    const updatedBadgeDate = formatCompanyUpdatedBadgeDate(summary?.updatedAt)

    return (
      <article className="company-card">
        <div className="company-card__header">
          <h3 className="company-card__title">{c.name}</h3>
          {updatedBadgeDate ? (
            <span className="company-card__updated-badge" title="마지막 수정일">
              수정일 {updatedBadgeDate}
            </span>
          ) : null}
          {props.showEditButton && props.onEdit ? (
            <FormButton
              htmlType="button"
              className="button button--small company-card__edit"
              onClick={() => props.onEdit?.(c)}
            >
              수정
            </FormButton>
          ) : null}
        </div>

        <div className="company-info-block">
          <div className="info-row">
            <span className="label">고객센터</span>
            <span className={`value${summary?.customerCenterChanged ? ' changed' : ''}`}>
              {customerCenter ? formatPhone(customerCenter) : '—'}
            </span>
            <div className="info-row-actions">
              {customerCenter ? (
                <div className="actions-mini">
                  <a href={telHref(customerCenter)} aria-label="고객센터 전화">
                    📞
                  </a>
                  <FormButton htmlType="button" onClick={() => handleCopy(customerCenter)} aria-label="고객센터 번호 복사">
                    📋
                  </FormButton>
                </div>
              ) : null}
            </div>
          </div>

          <div className="info-row">
            <span className="label">전산문의</span>
            <span className={`value${summary?.systemChanged ? ' changed' : ''}`}>
              {systemPhone ? formatPhone(systemPhone) : '—'}
            </span>
            <div className="info-row-actions">
              {systemPhone ? (
                <div className="actions-mini">
                  <a href={telHref(systemPhone)} aria-label="전산문의 전화">
                    📞
                  </a>
                  <FormButton htmlType="button" onClick={() => handleCopy(systemPhone)} aria-label="전산문의 번호 복사">
                    📋
                  </FormButton>
                </div>
              ) : null}
            </div>
          </div>

          <div className="info-row">
            <span className="label">인콜</span>
            <span className={`value${summary?.incallChanged ? ' changed' : ''}`}>
              {incallNumber ? formatPhone(incallNumber) : '—'}
            </span>
            <div className="info-row-actions">
              {incallNumber ? (
                <div className="actions-mini">
                  <a href={telHref(incallNumber)} aria-label="인콜 전화">
                    📞
                  </a>
                  <FormButton htmlType="button" onClick={() => handleCopy(incallNumber)} aria-label="인콜 번호 복사">
                    📋
                  </FormButton>
                </div>
              ) : null}
            </div>
          </div>

          {visitInfo ? (
            <div className="info-row info-row--visit">
              <span className="label">방문일</span>
              <span className={`value${summary?.visitInfoChanged ? ' changed' : ''}`}>{visitInfo}</span>
              <div className="info-row-actions" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {c.contacts?.length ? (
          <div className="company-contacts-block">
            {sortCompanyContactsByInputOrder(c.contacts).map((p, idx) => {
              const name = asTrimmedText(p.name)
              const position = asTrimmedText(p.position)
              const phoneRaw = asTrimmedText(p.phone)
              const contactChange = summary?.contactChangesByRole.get(contactRoleKey(position))

              return (
                <div key={p.id != null ? p.id : `new-${c.id}-${idx}`} className="contact-row">
                  <div className={`position${contactChange?.positionChanged ? ' changed' : ''}`}>
                    {renderPositionLabel(position)}
                  </div>
                  <div className="contact-row-main">
                    <div className={`name${contactChange?.nameChanged ? ' changed' : ''}`}>{name || '—'}</div>
                    <div
                      className={`${phoneRaw ? 'phone' : 'phone phone--empty'}${contactChange?.phoneChanged ? ' changed' : ''}`}
                    >
                      {phoneRaw ? formatPhone(phoneRaw) : '—'}
                    </div>
                  </div>
                  <div className="actions actions-mini">
                    {phoneRaw ? (
                      <a href={telHref(phoneRaw)} aria-label={`${formatPhone(phoneRaw)} 전화`}>
                        📞
                      </a>
                    ) : null}
                    {phoneRaw ? (
                      <FormButton htmlType="button" onClick={() => handleCopy(phoneRaw)} aria-label="담당자 번호 복사">
                        📋
                      </FormButton>
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
              <br />
              담당자에게 등록 요청하세요
            </div>
          </div>
        )}
      </article>
    )
  }

  const { companyName, before, after } = props
  const customerCenter = asTrimmedText(after.customerCenter)
  const systemPhone = asTrimmedText(after.system)
  const incallNumber = asTrimmedText(after.incall)
  const visitInfo = asTrimmedText(after.visitInfo)
  const contactPairs = pairHistoryContacts(before.contacts ?? [], after.contacts ?? [])

  return (
    <article className="company-card company-card--diff">
      <div className="company-card__header">
        <h3 className="company-card__title">{companyName}</h3>
      </div>

      <div className="company-info-block">
        <div className="info-row">
          <span className="label">고객센터</span>
          <span
            className={`value${isHistoryPhoneChanged(before.customerCenter, after.customerCenter) ? ' changed' : ''}`}
          >
            {customerCenter ? formatPhone(customerCenter) : '—'}
          </span>
          <div className="info-row-actions">
            {customerCenter ? (
              <div className="actions-mini">
                <a href={telHref(customerCenter)} aria-label="고객센터 전화">
                  📞
                </a>
                <FormButton htmlType="button" onClick={() => handleCopy(customerCenter)} aria-label="고객센터 번호 복사">
                  📋
                </FormButton>
              </div>
            ) : null}
          </div>
        </div>

        <div className="info-row">
          <span className="label">전산문의</span>
          <span className={`value${isHistoryPhoneChanged(before.system, after.system) ? ' changed' : ''}`}>
            {systemPhone ? formatPhone(systemPhone) : '—'}
          </span>
          <div className="info-row-actions">
            {systemPhone ? (
              <div className="actions-mini">
                <a href={telHref(systemPhone)} aria-label="전산문의 전화">
                  📞
                </a>
                <FormButton htmlType="button" onClick={() => handleCopy(systemPhone)} aria-label="전산문의 번호 복사">
                  📋
                </FormButton>
              </div>
            ) : null}
          </div>
        </div>

        <div className="info-row">
          <span className="label">인콜</span>
          <span className={`value${isHistoryPhoneChanged(before.incall, after.incall) ? ' changed' : ''}`}>
            {incallNumber ? formatPhone(incallNumber) : '—'}
          </span>
          <div className="info-row-actions">
            {incallNumber ? (
              <div className="actions-mini">
                <a href={telHref(incallNumber)} aria-label="인콜 전화">
                  📞
                </a>
                <FormButton htmlType="button" onClick={() => handleCopy(incallNumber)} aria-label="인콜 번호 복사">
                  📋
                </FormButton>
              </div>
            ) : null}
          </div>
        </div>

        {visitInfo || asTrimmedText(before.visitInfo) ? (
          <div className="info-row info-row--visit">
            <span className="label">방문일</span>
            <span className={`value${isHistoryTextChanged(before.visitInfo, after.visitInfo) ? ' changed' : ''}`}>
              {visitInfo || '—'}
            </span>
            <div className="info-row-actions" aria-hidden="true" />
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
            const posCh = isHistoryContactFieldChanged('position', b, a, { isNew: pair.isNew })
            const nameCh = isHistoryContactFieldChanged('name', b, a, { isNew: pair.isNew })
            const phoneCh = isHistoryContactFieldChanged('phone', b, a, { isNew: pair.isNew })
            const rowKey = `hist-${idx}-${position}-${name}-${phoneRaw}`

            return (
              <div key={rowKey} className="contact-row">
                <div className={`position${posCh ? ' changed' : ''}`}>{renderPositionLabel(position)}</div>
                <div className="contact-row-main">
                  <div className={`name${nameCh ? ' changed' : ''}`}>{asTrimmedText(name) || '—'}</div>
                  <div className={`phone${asTrimmedText(phoneRaw) ? '' : ' phone--empty'}${phoneCh ? ' changed' : ''}`}>
                    {asTrimmedText(phoneRaw) ? formatPhone(phoneRaw) : '—'}
                  </div>
                </div>
                <div className="actions actions-mini">
                  {asTrimmedText(phoneRaw) ? (
                    <a href={telHref(phoneRaw)} aria-label={`${formatPhone(phoneRaw)} 전화`}>
                      📞
                    </a>
                  ) : null}
                  {asTrimmedText(phoneRaw) ? (
                    <FormButton htmlType="button" onClick={() => handleCopy(phoneRaw)} aria-label="담당자 번호 복사">
                      📋
                    </FormButton>
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
            <br />
            담당자에게 등록 요청하세요
          </div>
        </div>
      )}
    </article>
  )
}
