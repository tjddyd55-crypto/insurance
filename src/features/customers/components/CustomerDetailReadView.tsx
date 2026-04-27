import type { CustomerRecord } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import {
  CUSTOMER_MEDICAL_QUESTION_HINT,
  CUSTOMER_MEDICAL_QUESTION_TEXT,
  formatCustomerPhoneUi,
  formatCustomerSsnUi,
} from '../utils/customerDisplayFormat'
import { CustomerRelationsStrip } from './CustomerRelationsStrip'

export type CustomerDetailInsuranceDisplay = {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
}

function CustomerDDayBadge({ renewalDate }: { renewalDate: string }) {
  const dday = getDDay(renewalDate)
  if (dday === null) {
    return null
  }
  return <span className={getDDayBadgeClass(dday)}>{`D-${dday}`}</span>
}

/** 상령일까지 남은 일수 — 30일 이내 임박 시 강조 */
function MaturityDdayBadge({ maturityYmd }: { maturityYmd: string | null }) {
  if (!maturityYmd) {
    return null
  }
  const dday = getDDay(maturityYmd)
  if (dday === null) {
    return null
  }
  const hot = dday >= 0 && dday <= 30
  const label = hot ? `🔥 D-${dday}` : `D-${dday}`
  return (
    <span className={hot ? getDDayBadgeClass(dday) : 'customer-dday'} style={{ marginLeft: 4 }}>
      ({label})
    </span>
  )
}

type CustomerDetailReadViewProps = {
  customer: CustomerRecord
  ins: CustomerDetailInsuranceDisplay
  token: string | null
  expandedId: number | null
  onOpenRelatedCustomer: (customerId: number, customerName?: string) => void
}

export default function CustomerDetailReadView({
  customer: c,
  ins,
  token,
  expandedId,
  onOpenRelatedCustomer,
}: CustomerDetailReadViewProps) {
  return (
    <div className="customer-detail-read">
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              🆔
            </span>
            주민번호:
          </strong>{' '}
          {formatCustomerSsnUi(c.ssn) || '—'}
        </p>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center' }}>
          <span>
            <strong className="customer-info-label">
              <span className="customer-info-label__icon" aria-hidden>
                🎂
              </span>
              보험나이:
            </strong>{' '}
            {ins.ageText}
          </span>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
            <strong className="customer-info-label">
              <span className="customer-info-label__icon" aria-hidden>
                📅
              </span>
              상령일:
            </strong>{' '}
            {ins.dateText}
            <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
          </span>
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              📞
            </span>
            핸드폰번호:
          </strong>{' '}
          {formatCustomerPhoneUi(c.phone) || '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              📍
            </span>
            주소:
          </strong>{' '}
          {c.address || '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              🧍
            </span>
            키/몸무게:
          </strong>{' '}
          {c.height?.trim() || c.weight?.trim()
            ? `${c.height?.trim() || '—'}/${c.weight?.trim() || '—'}`
            : '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              💼
            </span>
            직업/회사명/하는일/지역:
          </strong>{' '}
          {c.job?.trim() || '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              🛞
            </span>
            운전여부:
          </strong>{' '}
          {c.isDriver === true
            ? '운전함'
            : c.isDriver === false
              ? '운전 안함'
              : c.driving || '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              🚙
            </span>
            차종:
          </strong>{' '}
          {c.carType.trim() || '—'}
        </p>
        <p>
          <strong className="customer-info-label">
            <span className="customer-info-label__icon" aria-hidden>
              🩺
            </span>
            {CUSTOMER_MEDICAL_QUESTION_TEXT}
          </strong>
          <br />
          <span style={{ opacity: 0.85 }}>{CUSTOMER_MEDICAL_QUESTION_HINT}</span>
        </p>
        <p>{c.medical?.trim() || '—'}</p>
        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
        <div className="customer-section-title !mt-5">🚗 [자동차보험 정보]</div>
        <div className="customer-car-info-grid text-sm text-[var(--text-primary)]">
          <div>🔢 차량번호:</div>
          <div>{c.carNumber || '—'}</div>
          <div>🚘 차종:</div>
          <div>{c.carModel || '—'}</div>
          <div>📅 연식:</div>
          <div>{c.carYear || '—'}</div>
          <div>📆 만기일:</div>
          <div>
            {c.renewalDate || '—'}{' '}
            <CustomerDDayBadge renewalDate={c.renewalDate} />
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
        <div className="customer-section-title !mt-5">📄 [보험가입내역]</div>
        <div className="customer-insurance-history-body">
          {normalizeCustomerNotesBag(c.notes).insuranceHistory?.trim()
            ? normalizeCustomerNotesBag(c.notes).insuranceHistory
            : '내용 없음'}
        </div>
        {token?.trim() ? (
          <CustomerRelationsStrip
            customerId={c.id}
            customerName={c.name}
            token={token}
            focusedCustomerId={expandedId}
            onOpenCustomer={onOpenRelatedCustomer}
          />
        ) : null}
    </div>
  )
}
