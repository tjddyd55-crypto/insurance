import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { isCarInsuranceFeatureEnabledForGa } from '../../dashboard/gaTenantMenu'
import { formatKoreanDateTime } from '../../application/utils/date'
import type { InsuranceApplicationRecord } from '../../application/domain/types'
import {
  assertCustomerDataRecord,
  deleteCustomer,
  listCustomerForms,
  listCustomers,
  updateCustomer,
} from '../api/customersApi'
import type { CustomerRecord } from '../domain/types'
import { customerNoteItems, normalizeCustomerNotesBag } from '../domain/types'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import { buildKakaoCustomerCopyText } from '../utils/customerText'
import { calculateInsuranceAgeFromRrn, formatLocalYmd } from '../utils/insuranceAge'
import { formatDateYmdInput } from '../utils/insuranceInfo'
import { EXCEL_COLUMN_META, exportCustomersExcel } from '../utils/exportCustomersExcel'
import { normalizeSsn, RRN_NORMALIZED_LENGTH } from '../utils/customerExcelUpload'
import {
  CustomerForm,
  InsuranceInline,
  drivingText,
} from '../../../components/customer/CustomerForm'
import { PageBackButton } from '../../../components/common/PageBackButton'
import {
  EXPANDABLE_CARD_INVALID_ID,
  useExpandableCard,
} from '../../../hooks/useExpandableCard'
import {
  fetchConsultationCounts,
  listCustomerConsultations,
  searchCustomersAdvanced,
} from '../api/customerExtraApi'
import { parseConsultationStoredBody } from '../utils/consultationBodyFormat'
import { CustomerConsultationSection } from '../components/CustomerConsultationSection'
import { CustomerInlineNotesSection } from '../components/CustomerInlineNotesSection'
import { CustomerRelationsStrip } from '../components/CustomerRelationsStrip'

const RECENT_CUSTOMER_SEARCHES_KEY = 'insurance.customers.recentSearches.v1'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const LAST_CONSULT_FETCH_CONCURRENCY = 12

async function fetchLastConsultDatesByCustomerId(
  token: string,
  customerIds: number[],
): Promise<Record<number, string>> {
  const out: Record<number, string> = {}
  for (let i = 0; i < customerIds.length; i += LAST_CONSULT_FETCH_CONCURRENCY) {
    const chunk = customerIds.slice(i, i + LAST_CONSULT_FETCH_CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async (cid) => {
        try {
          const rows = await listCustomerConsultations(token, cid, { limit: 1 })
          const first = rows[0]
          if (!first) {
            return { cid, dateLabel: null as string | null }
          }
          const { dateLabel } = parseConsultationStoredBody(first.body, first.createdAt)
          return { cid, dateLabel }
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            return { cid, dateLabel: null as string | null }
          }
          throw e
        }
      }),
    )
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value.dateLabel) {
        out[s.value.cid] = s.value.dateLabel
      }
    }
  }
  return out
}

function readRecentCustomerSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CUSTOMER_SEARCHES_KEY)
    const a = raw ? JSON.parse(raw) : []
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
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

function inferIsDriverFromDriving(driving: string): boolean | null {
  const t = String(driving ?? '').trim()
  if (!t) {
    return null
  }
  if (t.includes('운전 안함') || t.includes('안 함')) {
    return false
  }
  if (t.startsWith('운전함') || t === '운전') {
    return true
  }
  return null
}

type CustomerListMetrics = {
  insuranceAge: number | null
  maturityYmd: string | null
}

function getCustomerListMetrics(c: CustomerRecord): CustomerListMetrics {
  const computed = calculateInsuranceAgeFromRrn(c.ssn ?? '')
  if (computed) {
    return {
      insuranceAge: computed.insuranceAge,
      maturityYmd: formatLocalYmd(computed.maturityDate),
    }
  }
  if (c.insuranceAge != null && c.nextAgeDate) {
    const ymd = formatDateYmdInput(c.nextAgeDate)
    return {
      insuranceAge: c.insuranceAge,
      maturityYmd: ymd !== '-' ? ymd : null,
    }
  }
  return { insuranceAge: null, maturityYmd: null }
}

function customerInsuranceDisplay(c: CustomerRecord): {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
} {
  const m = getCustomerListMetrics(c)
  return {
    ageText: m.insuranceAge != null ? `${m.insuranceAge}세` : '—',
    dateText: m.maturityYmd ?? '—',
    maturityYmd: m.maturityYmd,
    insuranceAgeNum: m.insuranceAge,
  }
}

function genderSummaryLabel(c: CustomerRecord): string {
  if (c.gender === 'male') {
    return '남'
  }
  if (c.gender === 'female') {
    return '여'
  }
  return '—'
}

function customerPhoneHref(phone: string | undefined, scheme: 'tel' | 'sms'): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) {
    return null
  }
  return `${scheme}:${digits}`
}

type CustomerAdvancedFilters = {
  minInsuranceAge: string
  maxInsuranceAge: string
  gender: '' | 'male' | 'female'
}

const EMPTY_ADVANCED_FILTERS: CustomerAdvancedFilters = {
  minInsuranceAge: '',
  maxInsuranceAge: '',
  gender: '',
}

/** 주민번호(숫자 13자리) 중복 그룹마다 순환 적용하는 표시색 */
const CUSTOMER_SSN_DUP_PALETTE = [
  'var(--distinct-hue-0)',
  'var(--distinct-hue-1)',
  'var(--distinct-hue-2)',
  'var(--distinct-hue-3)',
  'var(--distinct-hue-4)',
  'var(--distinct-hue-5)',
] as const

type CustomerSsnDupHighlight = {
  groupLabel: number
  color: string
}

function buildSsnDuplicateHighlightByCustomerId(rows: CustomerRecord[]): Map<number, CustomerSsnDupHighlight> {
  const byNorm = new Map<string, CustomerRecord[]>()
  for (const c of rows) {
    const k = normalizeSsn(c.ssn ?? '')
    if (k.length !== RRN_NORMALIZED_LENGTH) {
      continue
    }
    const arr = byNorm.get(k) ?? []
    arr.push(c)
    byNorm.set(k, arr)
  }
  const dupEntries = [...byNorm.entries()].filter(([, arr]) => arr.length > 1)
  dupEntries.sort(([a], [b]) => a.localeCompare(b))
  const out = new Map<number, CustomerSsnDupHighlight>()
  dupEntries.forEach(([, arr], idx) => {
    const groupLabel = idx + 1
    const color = CUSTOMER_SSN_DUP_PALETTE[idx % CUSTOMER_SSN_DUP_PALETTE.length]
    for (const c of arr) {
      out.set(c.id, { groupLabel, color })
    }
  })
  return out
}

function parseOptionalInt(s: string): number | null {
  const t = s.trim()
  if (!t) {
    return null
  }
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function customerRenewalYmd(c: CustomerRecord): string | null {
  const raw = (c.renewalDate ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function customerPassesAdvancedFilters(c: CustomerRecord, filters: CustomerAdvancedFilters): boolean {
  const metrics = getCustomerListMetrics(c)

  if (filters.gender === 'male' || filters.gender === 'female') {
    if (c.gender !== filters.gender) {
      return false
    }
  }

  const minA = parseOptionalInt(filters.minInsuranceAge)
  if (minA != null) {
    if (metrics.insuranceAge == null || metrics.insuranceAge < minA) {
      return false
    }
  }

  const maxA = parseOptionalInt(filters.maxInsuranceAge)
  if (maxA != null) {
    if (metrics.insuranceAge == null || metrics.insuranceAge > maxA) {
      return false
    }
  }

  return true
}

/** 영업 연락 우선: 상령/만기 D-day가 이 값 이하이면 오늘 대상(경과 포함) */
const CONTACT_TARGET_DDAY_MAX = 30

function isYmdWithinContactDday(ymd: string | null): boolean {
  if (!ymd) {
    return false
  }
  const d = getDDay(ymd)
  return d !== null && d <= CONTACT_TARGET_DDAY_MAX
}

function customerIsTodayContactTarget(c: CustomerRecord): boolean {
  const mat = getCustomerListMetrics(c).maturityYmd
  const car = customerRenewalYmd(c)
  return isYmdWithinContactDday(mat) || isYmdWithinContactDday(car)
}

function ymdAscSortKey(ymd: string | null): string {
  return ymd ?? '9999-12-31'
}

function parseCreatedAtMs(iso: string | undefined | null): number {
  const t = Date.parse(String(iso ?? ''))
  return Number.isFinite(t) ? t : 0
}

type CustomerSortType = 'age' | 'car' | 'recent' | null

type CustomerEditFormState = {
  name: string
  gender: 'male' | 'female' | null
  ssn: string
  phone: string
  address: string
  height: string
  weight: string
  job: string
  isDriver: boolean | null
  carType: string
  medical: string
  insuranceHistory: string
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

function recordToEditForm(c: CustomerRecord): CustomerEditFormState {
  let isDriver = c.isDriver
  if (isDriver == null) {
    isDriver = inferIsDriverFromDriving(c.driving)
  }
  return {
    name: c.name ?? '',
    gender: c.gender ?? null,
    ssn: c.ssn ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    height: c.height ?? '',
    weight: c.weight ?? '',
    job: c.job ?? '',
    isDriver,
    carType: c.carType ?? '',
    medical: c.medical ?? '',
    insuranceHistory: normalizeCustomerNotesBag(c.notes).insuranceHistory,
    carNumber: c.carNumber ?? '',
    carModel: c.carModel ?? '',
    carYear: c.carYear ?? '',
    renewalDate: c.renewalDate ?? '',
  }
}

function normalizeCustomerEditCarYearForApi(raw: string | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function normalizeCustomerEditRenewalDateForApi(raw: string | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    return ''
  }
  const head = s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

/** API 이후에도 상태에 깨진 행·undefined 슬롯이 들어가지 않도록 최종 방어 */
function coerceCustomersStatePayload(rows: unknown): CustomerRecord[] {
  if (!Array.isArray(rows)) {
    console.error('[CustomersPage] ❌ customers is not an array:', rows)
    throw new Error('Invalid customers response')
  }
  return rows.map((c, idx) => assertCustomerDataRecord(c, { listIndex: idx }))
}

type CustomerListCardProps = {
  customer: CustomerRecord
  ssnDupHighlight: CustomerSsnDupHighlight | undefined
  isSelectMode: boolean
  selectedCustomerIds: string[]
  setSelectedCustomerIds: Dispatch<SetStateAction<string[]>>
  expandedId: number | null
  setExpandedId: Dispatch<SetStateAction<number | null>>
  editingId: number | null
  editForm: CustomerEditFormState | null
  setEditForm: Dispatch<SetStateAction<CustomerEditFormState | null>>
  onEditSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  onStatusMessage: (msg: string) => void
  carFeatureEnabled: boolean
  historyLoading: boolean
  historyForms: InsuranceApplicationRecord[]
  onCopyCustomer: (c: CustomerRecord) => void
  onStartEdit: (c: CustomerRecord) => void
  onCancelEdit: () => void
  onDeleteCustomer: (c: CustomerRecord) => void
  onNavigateToFormEdit: (formId: string) => void
  token: string | null
  onOpenCustomer: (customerId: number) => void
  consultationCount: number
  lastConsultDateLabel: string | null
  onConsultationCountsInvalidate: () => void
  onCustomerNotesPersisted: () => void | Promise<void>
  onToggleFavorite: (c: CustomerRecord) => void | Promise<void>
}

function CustomerListCard({
  customer: c,
  ssnDupHighlight,
  isSelectMode,
  selectedCustomerIds,
  setSelectedCustomerIds,
  expandedId,
  setExpandedId,
  editingId,
  editForm,
  setEditForm,
  onEditSubmit,
  onStatusMessage,
  carFeatureEnabled,
  historyLoading,
  historyForms,
  onCopyCustomer,
  onStartEdit,
  onCancelEdit,
  onDeleteCustomer,
  onNavigateToFormEdit,
  token,
  onOpenCustomer,
  consultationCount,
  lastConsultDateLabel,
  onConsultationCountsInvalidate,
  onCustomerNotesPersisted,
  onToggleFavorite,
}: CustomerListCardProps) {
  const validCustomerId =
    c != null &&
    typeof c === 'object' &&
    typeof c.id === 'number' &&
    Number.isFinite(c.id)
      ? c.id
      : null

  const expandableCardId = validCustomerId ?? EXPANDABLE_CARD_INVALID_ID
  const {
    expanded,
    detailClosing,
    showExpandedChrome,
    toggleExpanded,
    handleDetailTransitionEnd,
  } = useExpandableCard({
    cardId: expandableCardId,
    expandedId,
    setExpandedId,
    interactionDisabled: isSelectMode,
  })

  if (
    c == null ||
    typeof c !== 'object' ||
    typeof c.id !== 'number' ||
    !Number.isFinite(c.id)
  ) {
    console.error('[CustomerListCard] Invalid customer render:', c)
    return null
  }

  const ins = customerInsuranceDisplay(c)
  const recentConsultText =
    consultationCount > 0 ? lastConsultDateLabel ?? '—' : '—'
  const smsHref = customerPhoneHref(c.phone, 'sms')
  const telHref = customerPhoneHref(c.phone, 'tel')
  const hasDialablePhone = telHref != null

  function handleSummaryKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isSelectMode) {
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }
  return (
    <li
      className={`record-card customer-card customer-expand-card transition-all duration-200 ease-out${
        isSelectMode ? ' customer-expand-card--select-mode' : ''
      }${expanded ? ' customer-expand-card--focal' : ''}`}
      data-customer-card-id={c.id}
    >
      {isSelectMode ? (
        <div className="customer-expand-card__select">
          <input
            type="checkbox"
            checked={selectedCustomerIds.includes(String(c.id))}
            onChange={() => {
              const id = String(c.id)
              setSelectedCustomerIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${c.name} 선택`}
          />
        </div>
      ) : null}
      <div className="customer-expand-card__main">
        <div
          className={`customer-expand-summary${isSelectMode ? '' : ' customer-expand-summary--toggle transition-transform duration-150 ease-out active:scale-[0.98]'}`}
          role={isSelectMode ? undefined : 'button'}
          tabIndex={isSelectMode ? undefined : 0}
          aria-expanded={isSelectMode ? undefined : showExpandedChrome}
          aria-label={
            isSelectMode ? undefined : `${c.name} 상세 ${showExpandedChrome ? '접기' : '펼치기'}`
          }
          onClick={toggleExpanded}
          onKeyDown={handleSummaryKeyDown}
        >
          <span className="customer-expand-summary__content w-full min-w-0">
            <div className="flex justify-between items-center gap-2 w-full min-w-0">
              <div className="min-w-0 flex-1">
                <div className="customer-card-text-name flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`customer-card-name-primary font-semibold${ssnDupHighlight ? ' customer-name-ssn-dup' : ''}`}
                    style={ssnDupHighlight ? { color: ssnDupHighlight.color } : undefined}
                  >
                    {ssnDupHighlight ? (
                      <span
                        className="customer-name-ssn-dup__badge"
                        aria-label={`중복 그룹 ${ssnDupHighlight.groupLabel}`}
                      >
                        [{ssnDupHighlight.groupLabel}]
                      </span>
                    ) : null}
                    {c.name}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] font-normal">
                    {genderSummaryLabel(c)}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] font-normal">
                    보험나이 {ins.ageText}
                  </span>
                </div>
                <div className="text-sm text-[var(--text-secondary)] customer-card-summary-meta mt-0.5">
                  상령일: {ins.dateText} · 상담일: {recentConsultText}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="flex items-center gap-2"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="text-lg leading-none p-0 border-0 bg-transparent cursor-pointer shrink-0"
                    aria-label={c.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                    aria-pressed={c.isFavorite}
                    disabled={!token?.trim()}
                    onClick={(e) => {
                      e.stopPropagation()
                      void onToggleFavorite(c)
                    }}
                  >
                    {c.isFavorite ? (
                      <span className="text-yellow-400" aria-hidden>
                        ★
                      </span>
                    ) : (
                      <span className="text-gray-400" aria-hidden>
                        ☆
                      </span>
                    )}
                  </button>
                  {smsHref ? (
                    <a
                      href={smsHref}
                      className="text-lg text-blue-500 leading-none"
                      aria-label="문자 보내기"
                      onClick={(e) => e.stopPropagation()}
                    >
                      💬
                    </a>
                  ) : (
                    <span className="text-lg opacity-35 grayscale" aria-hidden>
                      💬
                    </span>
                  )}
                  {hasDialablePhone ? (
                    <a
                      href={telHref}
                      className="customer-card-tel-link text-xl leading-none"
                      aria-label="전화 걸기"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📞
                    </a>
                  ) : (
                    <span className="text-xl text-gray-400 leading-none transition-colors" aria-hidden>
                      📞
                    </span>
                  )}
                </div>
                <span className="customer-expand-summary__hint" aria-hidden="true">
                  {showExpandedChrome ? '▲' : '▼'}
                </span>
              </div>
            </div>
          </span>
        </div>

        {expanded ? (
          <div
            className={`customer-expand-detail${detailClosing ? ' customer-expand-detail--closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onTransitionEnd={handleDetailTransitionEnd}
          >
            <div
              className="customer-detail-toolbar"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: 0 }}>{c.name}</div>
              <div
                className="customer-card-icon-actions"
                style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}
              >
                <button
                  type="button"
                  className="customer-icon-action"
                  title="카톡 복사"
                  aria-label="카톡 복사"
                  onClick={() => void onCopyCustomer(c)}
                >
                  📋
                </button>
                {editingId !== c.id ? (
                  <button
                    type="button"
                    className="customer-icon-action"
                    title="수정"
                    aria-label="수정"
                    onClick={() => onStartEdit(c)}
                  >
                    ✏️
                  </button>
                ) : null}
                <button
                  type="button"
                  className="customer-icon-action"
                  title="삭제"
                  aria-label="삭제"
                  onClick={() => void onDeleteCustomer(c)}
                >
                  🗑
                </button>
              </div>
            </div>
            {editingId === c.id && editForm ? (
              <>
                <div className="customer-edit-banner" role="status">
                  ✏ 고객 정보 수정 중
                </div>
                <form
                  className="customer-edit-form"
                  onSubmit={(e) => {
                    void onEditSubmit(e)
                  }}
                >
                  <div className="field-grid-customers">
                    <label className="field">
                      <span className="field__label">이름</span>
                      <input
                        className="field__control"
                        name="customer-name"
                        autoComplete="name"
                        value={editForm.name ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                      />
                    </label>
                    <div className="field field--wide">
                      <span className="field__label">성별</span>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
                        <label>
                          <input
                            type="radio"
                            name={`gender-edit-${c.id}`}
                            checked={editForm.gender === 'male'}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, gender: 'male' } : prev))
                            }
                          />{' '}
                          남
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`gender-edit-${c.id}`}
                            checked={editForm.gender === 'female'}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, gender: 'female' } : prev))
                            }
                          />{' '}
                          여
                        </label>
                      </div>

                    </div>
                    <label className="field">
                      <span className="field__label">주민번호</span>
                      <input
                        className="field__control"
                        name="customer-ssn"
                        autoComplete="off"
                        value={editForm.ssn ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, ssn: e.target.value } : prev))
                        }
                      />
                    </label>
                    <InsuranceInline ssn={editForm.ssn ?? ''} />
                    <label className="field">
                      <span className="field__label">전화번호</span>
                      <input
                        className="field__control"
                        name="customer-phone"
                        autoComplete="tel"
                        value={editForm.phone ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">주소</span>
                      <input
                        className="field__control"
                        name="customer-address"
                        autoComplete="street-address"
                        value={editForm.address ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, address: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">키</span>
                      <input
                        className="field__control"
                        value={editForm.height ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, height: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">몸무게</span>
                      <input
                        className="field__control"
                        value={editForm.weight ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, weight: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">직업 / 회사명 등</span>
                      <input
                        className="field__control"
                        value={editForm.job ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, job: e.target.value } : prev))
                        }
                      />
                    </label>
                    <div className="field field--wide">
                      <span className="field__label">운전 여부</span>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 4 }}>
                        <label>
                          <input
                            type="radio"
                            name={`driver-edit-${c.id}`}
                            checked={editForm.isDriver === true}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, isDriver: true } : prev))
                            }
                          />{' '}
                          운전함
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`driver-edit-${c.id}`}
                            checked={editForm.isDriver === false}
                            onChange={() =>
                              setEditForm((prev) => (prev ? { ...prev, isDriver: false } : prev))
                            }
                          />{' '}
                          운전 안함
                        </label>
                      </div>
                    </div>
                    <label className="field field--wide">
                      <span className="field__label">차종 (운전 형태)</span>
                      <input
                        className="field__control"
                        type="text"
                        placeholder="예: 승용차, SUV, 1톤 트럭"
                        value={editForm.carType ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carType: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">5년 이내 진단·수술·치료 (건강 고지)</span>
                      <textarea
                        className="field__control"
                        name="customer-medical"
                        rows={3}
                        value={editForm.medical ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, medical: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">보험가입내역</span>
                      <textarea
                        className="field__control"
                        name="customer-insurance-history"
                        rows={4}
                        placeholder="보험가입내역 입력"
                        value={editForm.insuranceHistory ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, insuranceHistory: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">차량번호</span>
                      <input
                        className="field__control"
                        value={editForm.carNumber ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carNumber: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">차종</span>
                      <input
                        className="field__control"
                        value={editForm.carModel ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carModel: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">연식</span>
                      <input
                        className="field__control"
                        value={editForm.carYear ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carYear: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">만기(갱신)일</span>
                      <input
                        className="field__control"
                        type="date"
                        value={editForm.renewalDate ? editForm.renewalDate.slice(0, 10) : ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, renewalDate: e.target.value } : prev))
                        }
                      />
                    </label>
                  </div>
                  <div className="customer-edit-actions">
                    <button className="button-save" type="submit">
                      수정 저장
                    </button>
                    <button className="button-cancel" type="button" onClick={onCancelEdit}>
                      취소
                    </button>
                  </div>
                </form>
                {token ? (
                  <CustomerRelationsStrip
                    customerId={c.id}
                    customerName={c.name}
                    token={token}
                    onOpenCustomer={onOpenCustomer}
                    focusedCustomerId={expandedId}
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className="customer-detail-read">
                  <p>
                    <strong>주민번호:</strong> {c.ssn || '—'}
                  </p>
                  <p style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center' }}>
                    <span>
                      <strong>보험나이:</strong> {ins.ageText}
                    </span>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                      <strong>상령일:</strong> {ins.dateText}
                      <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
                    </span>
                  </p>
                  <p>
                    <strong>핸드폰번호:</strong> {c.phone || '—'}
                  </p>
                  <p>
                    <strong>주소:</strong> {c.address || '—'}
                  </p>
                  <p>
                    <strong>키/몸무게:</strong>{' '}
                    {c.height?.trim() || c.weight?.trim()
                      ? `${c.height?.trim() || '—'}/${c.weight?.trim() || '—'}`
                      : '—'}
                  </p>
                  <p>
                    <strong>직업/회사명/하는일/지역:</strong> {c.job?.trim() || '—'}
                  </p>
                  <p>
                    <strong>운전여부:</strong>{' '}
                    {c.isDriver === true
                      ? '운전함'
                      : c.isDriver === false
                        ? '운전 안함'
                        : c.driving || '—'}
                  </p>
                  <p>
                    <strong>차종:</strong> {c.carType.trim() || '—'}
                  </p>
                  <p>
                    <strong>5년 이내 진단, 수술, 치료:</strong> {c.medical?.trim() || '—'}
                  </p>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
                  <div className="customer-section-title !mt-5">[자동차보험 정보]</div>
                  <div className="customer-car-info-grid text-sm text-[var(--text-primary)]">
                    <div>차량번호:</div>
                    <div>{c.carNumber || '—'}</div>
                    <div>차종:</div>
                    <div>{c.carModel || '—'}</div>
                    <div>연식:</div>
                    <div>{c.carYear || '—'}</div>
                    <div>만기일:</div>
                    <div>
                      {c.renewalDate || '—'}{' '}
                      <CustomerDDayBadge renewalDate={c.renewalDate} />
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
                  <div className="customer-section-title !mt-5">[보험가입내역]</div>
                  <div className="customer-insurance-history-body">
                    {normalizeCustomerNotesBag(c.notes).insuranceHistory?.trim()
                      ? normalizeCustomerNotesBag(c.notes).insuranceHistory
                      : '내용 없음'}
                  </div>
                </div>
                <div className="customer-expand-section-divider" role="presentation" />
                {token ? (
                  <CustomerInlineNotesSection
                    customer={c}
                    token={token}
                    onPersisted={onCustomerNotesPersisted}
                    onStatusMessage={onStatusMessage}
                  />
                ) : null}
                {token ? (
                  <CustomerConsultationSection
                    customerId={c.id}
                    token={token}
                    onMutated={onConsultationCountsInvalidate}
                  />
                ) : null}
                <div className="customer-expand-section-divider" role="presentation" />
                {token ? (
                  <CustomerRelationsStrip
                    customerId={c.id}
                    customerName={c.name}
                    token={token}
                    onOpenCustomer={onOpenCustomer}
                    focusedCustomerId={expandedId}
                  />
                ) : null}
                <div className="customer-expand-section-divider" role="presentation" />
                {carFeatureEnabled ? (
                  <div className="customer-form-history mt-5">
                    <div className="customer-section-title">[연결된 신청서]</div>
                    {historyLoading ? (
                      <p className="customer-form-history__status">불러오는 중…</p>
                    ) : historyForms.length === 0 ? (
                      <p className="customer-form-history__status">이 고객 ID로 연결된 신청서가 없습니다.</p>
                    ) : (
                      <ul className="customer-form-history__list">
                        {historyForms.map((row) => (
                          <li key={row.id} className="customer-form-history__item">
                            <div>
                              <strong>{row.title}</strong>
                              <span className="customer-form-history__meta">
                                저장: {formatKoreanDateTime(row.updatedAt)} · 만기 {row.expiryDate || '—'}
                              </span>
                            </div>
                            <button
                              className="button button--secondary"
                              type="button"
                              onClick={() => onNavigateToFormEdit(row.id)}
                            >
                              열기
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token } = useAuth()
  const externalRegistrationUrl = useMemo(() => {
    if (!user?.id) {
      return ''
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/customer/input?ref=${encodeURIComponent(user.id)}`
  }, [user?.id])
  const carFeatureEnabled = isCarInsuranceFeatureEnabledForGa(user?.gaCode)
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [customersTotalCount, setCustomersTotalCount] = useState(0)
  const customersRef = useRef<CustomerRecord[]>([])
  customersRef.current = customers
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [historyForms, setHistoryForms] = useState<InsuranceApplicationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)
  const tab = searchParams.get('mode') === 'create' ? 'create' : 'list'
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentCustomerSearches())
  const [sortType, setSortType] = useState<CustomerSortType>(null)
  const [advancedFilters, setAdvancedFilters] = useState<CustomerAdvancedFilters>(() => ({
    ...EMPTY_ADVANCED_FILTERS,
  }))
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [deepSearch, setDeepSearch] = useState(false)
  const [advSearchHits, setAdvSearchHits] = useState<CustomerRecord[] | null>(null)
  const [advSearchLoading, setAdvSearchLoading] = useState(false)
  const [consultationCounts, setConsultationCounts] = useState<Record<number, number>>({})
  const [lastConsultDateMap, setLastConsultDateMap] = useState<Record<number, string>>({})
  const [onlyWithConsultations, setOnlyWithConsultations] = useState(false)
  const [filterNoRecentConsult, setFilterNoRecentConsult] = useState(false)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showScrollToTop, setShowScrollToTop] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShowScrollToTop(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const ssnDupHighlightByCustomerId = useMemo(
    () => buildSsnDuplicateHighlightByCustomerId(customers),
    [customers],
  )

  const keywordFilteredCustomers = useMemo(() => {
    if (advSearchHits != null) {
      return advSearchHits
    }
    const q = keyword.trim()
    if (!q) {
      return customers
    }
    return customers.filter((c) => c.name.includes(q) || (c.phone ?? '').includes(q))
  }, [customers, keyword, advSearchHits])

  const filteredCustomers = useMemo(() => {
    let list = keywordFilteredCustomers.filter((c) => customerPassesAdvancedFilters(c, advancedFilters))
    if (onlyWithConsultations) {
      list = list.filter((c) => (consultationCounts[c.id] ?? 0) > 0)
    }
    if (filterNoRecentConsult) {
      list = list.filter((c) => {
        const last = lastConsultDateMap[c.id]
        return !last || Date.now() - new Date(last).getTime() > THIRTY_DAYS_MS
      })
    }
    if (favoriteOnly) {
      list = list.filter((c) => c.isFavorite)
    }
    return list
  }, [
    keywordFilteredCustomers,
    advancedFilters,
    onlyWithConsultations,
    consultationCounts,
    filterNoRecentConsult,
    lastConsultDateMap,
    favoriteOnly,
  ])

  const todayContactTargets = useMemo(
    () => filteredCustomers.filter((c) => customerIsTodayContactTarget(c)),
    [filteredCustomers],
  )

  const advancedFiltersActive = useMemo(() => {
    const f = advancedFilters
    return !!(f.minInsuranceAge.trim() || f.maxInsuranceAge.trim() || f.gender)
  }, [advancedFilters])

  const listIsNarrowed = useMemo(
    () =>
      keyword.trim() !== '' ||
      advancedFiltersActive ||
      onlyWithConsultations ||
      filterNoRecentConsult ||
      favoriteOnly ||
      advSearchHits != null,
    [keyword, advancedFiltersActive, onlyWithConsultations, filterNoRecentConsult, favoriteOnly, advSearchHits],
  )

  const sortedCustomers = useMemo(() => {
    const copy = [...filteredCustomers]
    const favoriteFirst = (a: CustomerRecord, b: CustomerRecord) =>
      Number(b.isFavorite) - Number(a.isFavorite)
    const tieName = (a: CustomerRecord, b: CustomerRecord) => a.name.localeCompare(b.name, 'ko')

    if (sortType === null) {
      copy.sort((a, b) => {
        const f = favoriteFirst(a, b)
        return f !== 0 ? f : tieName(a, b)
      })
    } else if (sortType === 'age') {
      copy.sort((a, b) => {
        const f = favoriteFirst(a, b)
        if (f !== 0) {
          return f
        }
        const ka = ymdAscSortKey(getCustomerListMetrics(a).maturityYmd)
        const kb = ymdAscSortKey(getCustomerListMetrics(b).maturityYmd)
        const cmp = ka.localeCompare(kb)
        return cmp !== 0 ? cmp : tieName(a, b)
      })
    } else if (sortType === 'car') {
      copy.sort((a, b) => {
        const f = favoriteFirst(a, b)
        if (f !== 0) {
          return f
        }
        const ka = ymdAscSortKey(customerRenewalYmd(a))
        const kb = ymdAscSortKey(customerRenewalYmd(b))
        const cmp = ka.localeCompare(kb)
        return cmp !== 0 ? cmp : tieName(a, b)
      })
    } else {
      copy.sort((a, b) => {
        const f = favoriteFirst(a, b)
        if (f !== 0) {
          return f
        }
        const ta = parseCreatedAtMs(a.createdAt)
        const tb = parseCreatedAtMs(b.createdAt)
        if (tb !== ta) {
          return tb - ta
        }
        return tieName(a, b)
      })
    }
    return copy
  }, [filteredCustomers, sortType])

  const allVisibleIds = useMemo(() => sortedCustomers.map((c) => String(c.id)), [sortedCustomers])
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedCustomerIds.includes(id))

  const refreshConsultationCounts = useCallback(async (activeCustomerIds?: number[]) => {
    if (!token || user?.role !== 'USER') {
      setConsultationCounts({})
      setLastConsultDateMap({})
      return
    }
    const allowed = new Set(
      activeCustomerIds ?? customersRef.current.map((c) => c.id),
    )
    try {
      const { counts } = await fetchConsultationCounts(token)
      const next: Record<number, number> = {}
      for (const [k, v] of Object.entries(counts)) {
        const id = Number(k)
        if (!Number.isFinite(id) || !allowed.has(id)) {
          continue
        }
        next[id] = Number(v) || 0
      }
      setConsultationCounts(next)
      const idsWithConsult = Object.entries(next)
        .filter(([, n]) => n > 0)
        .map(([idKey]) => Number(idKey))
      const dates = await fetchLastConsultDatesByCustomerId(token, idsWithConsult)
      setLastConsultDateMap(dates)
    } catch {
      setConsultationCounts({})
      setLastConsultDateMap({})
    }
  }, [token, user?.role])

  const loadCustomers = useCallback(async () => {
    if (!token || user?.role !== 'USER') {
      setIsLoading(false)
      setCustomersTotalCount(0)
      return
    }
    setIsLoading(true)
    try {
      const { customers: rows, total } = await listCustomers(token)
      const safeData = coerceCustomersStatePayload(rows)
      if (import.meta.env.DEV) {
        console.log('[CustomersPage] customers after load:', safeData)
      }
      setCustomers(safeData)
      setCustomersTotalCount(total)
      await refreshConsultationCounts(safeData.map((r) => r.id))
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role, refreshConsultationCounts])

  const handleToggleFavorite = useCallback(
    async (c: CustomerRecord) => {
      if (!token?.trim()) {
        return
      }
      try {
        await updateCustomer(token, c.id, { isFavorite: !c.isFavorite })
        await loadCustomers()
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : '즐겨찾기 변경에 실패했습니다.')
      }
    },
    [token, loadCustomers],
  )

  /** 연계 고객 등: 검색어로 찾지 않고 목록에서 카드만 펼침 (검색·심층 검색 상태는 초기화) */
  const openCustomerInList = useCallback((customerId: number) => {
    setSearchInput('')
    setKeyword('')
    setAdvSearchHits(null)
    setExpandedId(customerId)
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-customer-card-id="${customerId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => setKeyword(searchInput), 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    const q = keyword.trim()
    if (!q) {
      return
    }
    try {
      const prev = readRecentCustomerSearches()
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5)
      localStorage.setItem(RECENT_CUSTOMER_SEARCHES_KEY, JSON.stringify(next))
      setRecentSearches(next)
    } catch {
      /* ignore */
    }
  }, [keyword])

  useEffect(() => {
    if (user?.role !== 'USER') {
      setIsLoading(false)
      return
    }
    void loadCustomers()
  }, [user?.role, loadCustomers])

  useEffect(() => {
    if (expandedId == null) {
      return
    }
    if (!customers.some((c) => c.id === expandedId)) {
      setExpandedId(null)
    }
  }, [customers, expandedId])

  useEffect(() => {
    const valid = new Set(customers.map((c) => String(c.id)))
    setSelectedCustomerIds((prev) => {
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [customers])

  useEffect(() => {
    if (!deepSearch || !token || user?.role !== 'USER') {
      setAdvSearchHits(null)
      setAdvSearchLoading(false)
      return
    }
    const q = keyword.trim()
    if (!q) {
      setAdvSearchHits(null)
      setAdvSearchLoading(false)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setAdvSearchLoading(true)
        try {
          const rows = await searchCustomersAdvanced(token, { q, includeRelations: true, limit: 500 })
          if (!cancelled) {
            setAdvSearchHits(coerceCustomersStatePayload(rows))
          }
        } catch (error) {
          if (!cancelled) {
            setStatusText(error instanceof Error ? error.message : '심층 검색에 실패했습니다.')
            setAdvSearchHits(null)
          }
        } finally {
          if (!cancelled) {
            setAdvSearchLoading(false)
          }
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [deepSearch, keyword, token, user?.role])

  useEffect(() => {
    if (editingId != null && expandedId !== editingId) {
      setEditingId(null)
      setEditForm(null)
    }
  }, [expandedId, editingId])

  useEffect(() => {
    if (expandedId == null) {
      setHistoryForms([])
      return
    }
    if (!carFeatureEnabled) {
      setHistoryForms([])
      return
    }
    if (!token) {
      return
    }
    setHistoryForms([])
    let cancelled = false
    setHistoryLoading(true)
    void listCustomerForms(token, expandedId)
      .then((rows) => {
        if (!cancelled) {
          setHistoryForms(rows)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusText(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.')
          setHistoryForms([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [expandedId, token, carFeatureEnabled])

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) {
      return
    }
    const n = selectedCustomerIds.filter((id) => allVisibleIds.includes(id)).length
    el.indeterminate = n > 0 && n < allVisibleIds.length
  }, [selectedCustomerIds, allVisibleIds])

  useEffect(() => {
    if (tab !== 'list' && isSelectMode) {
      setIsSelectMode(false)
      setSelectedCustomerIds([])
      setSelectedColumns([])
      setIsColumnPickerOpen(false)
    }
  }, [tab, isSelectMode])

  async function copyCustomer(rec: CustomerRecord) {
    const text = buildKakaoCustomerCopyText(rec)
    try {
      await navigator.clipboard.writeText(text)
      window.alert('복사되었습니다')
    } catch {
      setStatusText('복사에 실패했습니다.')
    }
  }

  function applyQuickFilter(type: 'AGE_UNDER_30_MALE' | 'AGE_OVER_40_FEMALE') {
    if (type === 'AGE_UNDER_30_MALE') {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        maxInsuranceAge: '30',
        gender: 'male',
      })
    } else {
      setAdvancedFilters({
        ...EMPTY_ADVANCED_FILTERS,
        minInsuranceAge: '40',
        gender: 'female',
      })
    }
  }

  function startEdit(c: CustomerRecord) {
    setExpandedId(c.id)
    setEditingId(c.id)
    setEditForm(recordToEditForm(c))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function handleUpdateCustomer() {
    if (!token?.trim()) {
      const msg = '로그인이 필요합니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    if (user?.role !== 'USER') {
      const msg = '고객 정보를 수정할 권한이 없습니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    if (editingId == null || !editForm) {
      const msg = '수정 중인 고객이 없습니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const base = customers.find((x) => x.id === editingId)
    if (!base) {
      const msg = '고객 정보를 찾을 수 없습니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const name = editForm.name.trim()
    if (!name) {
      const msg = '이름은 필수입니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const carYearForApi = normalizeCustomerEditCarYearForApi(editForm.carYear)
    const renewalDateForApi = normalizeCustomerEditRenewalDateForApi(editForm.renewalDate)
    try {
      await updateCustomer(token, editingId, {
        name,
        ssn: editForm.ssn,
        phone: editForm.phone,
        carrier: '',
        address: editForm.address,
        height: editForm.height,
        weight: editForm.weight,
        job: editForm.job,
        driving: drivingText(editForm.isDriver),
        medical: editForm.medical,
        gender: editForm.gender,
        isDriver: editForm.isDriver,
        carType: editForm.carType.trim(),
        notes: {
          items: customerNoteItems(base),
          insuranceHistory: editForm.insuranceHistory.trim(),
        },
        carNumber: editForm.carNumber,
        carModel: editForm.carModel,
        carYear: carYearForApi,
        renewalDate: renewalDateForApi,
        isFavorite: base.isFavorite === true,
      })
      setStatusText('고객 정보를 수정했습니다.')
      cancelEdit()
      await loadCustomers()
    } catch (error) {
      const msg = error instanceof Error ? error.message : '수정에 실패했습니다.'
      setStatusText(msg)
      window.alert(msg)
    }
  }

  async function handleEditFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await handleUpdateCustomer()
  }

  function enterExcelSelectMode() {
    setExpandedId(null)
    setEditingId(null)
    setEditForm(null)
    setIsSelectMode(true)
    setSelectedCustomerIds([])
    setSelectedColumns(['name'])
    setIsColumnPickerOpen(false)
    setStatusText('')
  }

  function exitExcelSelectMode() {
    setIsSelectMode(false)
    setSelectedCustomerIds([])
    setSelectedColumns([])
    setIsColumnPickerOpen(false)
  }

  function runExport(rows: CustomerRecord[]) {
    try {
      exportCustomersExcel(rows, selectedColumns)
      setStatusText('엑셀 파일을 저장했습니다.')
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
    }
  }

  function handleDownloadSelected() {
    if (selectedCustomerIds.length === 0) {
      window.alert('고객을 선택해주세요')
      setStatusText('다운로드할 고객을 선택해 주세요.')
      return
    }
    const idSet = new Set(selectedCustomerIds)
    const rows = sortedCustomers.filter((c) => idSet.has(String(c.id)))
    runExport(rows)
  }

  /** 현재 검색·정렬된 목록 전체 (필터 반영) */
  function handleDownloadListAll() {
    if (sortedCustomers.length === 0) {
      window.alert('다운로드할 고객이 없습니다.')
      setStatusText('목록에 표시된 고객이 없습니다.')
      return
    }
    runExport([...sortedCustomers])
  }

  function toggleExcelColumn(id: string) {
    setSelectedColumns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleDeleteCustomer(c: CustomerRecord) {
    if (!token || user?.role !== 'USER') {
      return
    }
    if (
      !window.confirm(
        `고객 "${c.name}"(번호 ${c.id})를 목록에서 삭제할까요? 기존 신청서의 고객 연결(customer_id)은 유지됩니다.`,
      )
    ) {
      return
    }
    try {
      await deleteCustomer(token, c.id)
      if (expandedId === c.id) {
        setExpandedId(null)
      }
      if (editingId === c.id) {
        cancelEdit()
      }
      setStatusText('고객을 삭제했습니다.')
      await loadCustomers()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '삭제에 실패했습니다.')
    }
  }

  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  return (
    <main
      className={`page customers-page page--with-back${
        isSelectMode && tab === 'list' ? ' customers-page--excel-toolbar-pad' : ''
      }`}
    >
      <PageBackButton />
      {isSelectMode && tab === 'list' ? (
        <div className="customers-excel-toolbar" role="region" aria-label="엑셀 다운로드 선택">
          <p className="customers-excel-toolbar__status">
            엑셀 선택 중 —「선택 다운로드」는 체크한 고객,「목록 전체 다운로드」는 지금 검색·필터·정렬된 목록만
          </p>
          <div className="customers-excel-toolbar__row">
            <label className="customers-excel-toolbar__select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  if (allVisibleSelected) {
                    setSelectedCustomerIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
                  } else {
                    setSelectedCustomerIds((prev) => [...new Set([...prev, ...allVisibleIds])])
                  }
                }}
              />
              전체 선택
            </label>
            <button type="button" className="filter-button" onClick={() => setIsColumnPickerOpen(true)}>
              컬럼 선택
            </button>
            <button type="button" className="cta-button" onClick={handleDownloadSelected}>
              선택 다운로드
            </button>
            <button type="button" className="cta-button" onClick={handleDownloadListAll}>
              목록 전체 다운로드
            </button>
            <button type="button" className="filter-button" onClick={exitExcelSelectMode}>
              취소
            </button>
          </div>
        </div>
      ) : null}
      <header className="page-header customers-page__header">
        {tab === 'list' ? (
          <>
            {!isSelectMode ? (
              <div className="customers-page__action-row">
                <button type="button" className="cta-button customers-page__action-btn" onClick={() => setSearchParams({ mode: 'create' })}>
                  고객 등록
                </button>
                <button
                  type="button"
                  className="cta-button customers-page__action-btn"
                  disabled={!externalRegistrationUrl}
                  onClick={() => {
                    if (externalRegistrationUrl) {
                      window.open(externalRegistrationUrl, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  등록 링크
                </button>
                <button type="button" className="cta-button customers-page__action-btn" onClick={enterExcelSelectMode}>
                  엑셀 다운로드
                </button>
              </div>
            ) : null}
            <div className="customers-page__search-row">
              <input
                className="search-input customers-page__search-input"
                type="search"
                placeholder="이름 / 전화번호 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
                aria-label="이름 또는 전화번호 검색"
              />
              <button
                type="button"
                className={`px-3 py-2 rounded-lg border text-sm shrink-0 transition-colors ${
                  favoriteOnly
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                    : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
                aria-pressed={favoriteOnly}
                onClick={() => setFavoriteOnly((v) => !v)}
              >
                중요 고객
              </button>
              <button
                type="button"
                className={`customers-page__filter-toggle${showFilters ? ' customers-page__filter-toggle--on' : ''}`}
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
              >
                필터
              </button>
            </div>
          </>
        ) : (
          <div className="customers-page__create-nav">
            <button type="button" className="link-btn link-btn--compact" onClick={() => setSearchParams({})}>
              ← 고객 목록
            </button>
          </div>
        )}
        {statusText ? <p className="customers-page__status">{statusText}</p> : null}
      </header>

      {tab === 'create' ? (
        <>
          <section className="card" style={{ marginTop: 0 }}>
            <CustomerForm
              onStatusMessage={setStatusText}
              onInternalSaveSuccess={() => void loadCustomers()}
            />
          </section>
        </>
      ) : (
        <section className="list-section" style={{ marginTop: 0 }}>
          {recentSearches.length > 0 ? (
            <>
              <p className="customers-page__recent-label">최근:</p>
              <div className="customers-page__recent-chips" aria-label="최근 검색어">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="customers-page__recent-chip"
                    onClick={() => {
                      setSearchInput(term)
                      setKeyword(term)
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {showFilters ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 8,
                  fontSize: '0.95rem',
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={deepSearch}
                    onChange={(e) => setDeepSearch(e.target.checked)}
                  />
                  상담·연계 포함 검색 (서버 심층 검색)
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={onlyWithConsultations}
                    onChange={(e) => setOnlyWithConsultations(e.target.checked)}
                  />
                  상담 기록이 있는 고객만 보기
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={filterNoRecentConsult}
                    onChange={(e) => setFilterNoRecentConsult(e.target.checked)}
                  />
                  최근 30일 상담 없음
                </label>
              </div>
              {advSearchLoading ? (
                <p
                  className="text-[var(--text-secondary)]"
                  style={{ margin: '6px 0 0', fontSize: '0.9rem' }}
                  role="status"
                >
                  심층 검색 중…
                </p>
              ) : null}

              {!isLoading && customers.length > 0 ? (
                <div className="customers-today-targets" role="status">
                  <p className="customers-today-targets__title">
                    🔥 오늘 연락 대상 (<strong>{todayContactTargets.length}</strong>명)
                  </p>
                  <p className="customers-today-targets__hint">
                    상령일 또는 자동차 만기 D-{CONTACT_TARGET_DDAY_MAX} 이하(임박·경과) — 현재 검색·필터 범위 기준
                  </p>
                </div>
              ) : null}

              <div className="customers-sort-row" role="group" aria-label="목록 정렬 (같은 버튼을 다시 누르면 해제되어 이름 가나다순)">
                <span className="customers-sort-row__label">정렬</span>
                <div className="customers-sort-row__buttons filter-group">
                  <button
                    type="button"
                    className={`filter-button${sortType === 'age' ? ' active' : ''}`}
                    aria-pressed={sortType === 'age'}
                    onClick={() => setSortType((t) => (t === 'age' ? null : 'age'))}
                  >
                    상령일 빠른순
                  </button>
                  <button
                    type="button"
                    className={`filter-button${sortType === 'car' ? ' active' : ''}`}
                    aria-pressed={sortType === 'car'}
                    onClick={() => setSortType((t) => (t === 'car' ? null : 'car'))}
                  >
                    자동차 만기순
                  </button>
                  <button
                    type="button"
                    className={`filter-button${sortType === 'recent' ? ' active' : ''}`}
                    aria-pressed={sortType === 'recent'}
                    onClick={() => setSortType((t) => (t === 'recent' ? null : 'recent'))}
                  >
                    최근등록
                  </button>
                </div>
              </div>

              <div className="customers-advanced-filters" role="search" aria-label="고급 검색">
                <div className="customers-advanced-filters__grid">
                  <label className="customers-advanced-filters__field">
                    <span>보험나이 최소</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={advancedFilters.minInsuranceAge}
                      onChange={(e) =>
                        setAdvancedFilters((f) => ({ ...f, minInsuranceAge: e.target.value }))
                      }
                    />
                  </label>
                  <label className="customers-advanced-filters__field">
                    <span>보험나이 최대</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={advancedFilters.maxInsuranceAge}
                      onChange={(e) =>
                        setAdvancedFilters((f) => ({ ...f, maxInsuranceAge: e.target.value }))
                      }
                    />
                  </label>
                  <label className="customers-advanced-filters__field">
                    <span>성별</span>
                    <select
                      value={advancedFilters.gender}
                      onChange={(e) =>
                        setAdvancedFilters((f) => ({
                          ...f,
                          gender: e.target.value as CustomerAdvancedFilters['gender'],
                        }))
                      }
                    >
                      <option value="">전체</option>
                      <option value="male">남</option>
                      <option value="female">여</option>
                    </select>
                  </label>
                </div>
                <div className="customers-advanced-filters__quick filter-group">
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => applyQuickFilter('AGE_UNDER_30_MALE')}
                  >
                    30세 이하 남성
                  </button>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => applyQuickFilter('AGE_OVER_40_FEMALE')}
                  >
                    40세 이상 여성
                  </button>
                  {advancedFiltersActive ? (
                    <button
                      type="button"
                      className="filter-button"
                      onClick={() => setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS })}
                    >
                      필터 초기화
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {!isLoading && customers.length > 0 ? (
            <p className="customers-filter-result customers-page__result-count" role="status" aria-live="polite">
              검색·필터 결과:{' '}
              <span className="customers-page__result-count-strong">
                <strong>{listIsNarrowed ? sortedCustomers.length : customersTotalCount}</strong>명
              </span>
            </p>
          ) : null}

          {isLoading ? (
            <div
              className="customers-page__list-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="customers-page__list-loading__text">로딩 중…</span>
            </div>
          ) : customers.length === 0 ? (
            <p className="empty-state">등록된 고객이 없습니다.</p>
          ) : sortedCustomers.length === 0 ? (
            <p className="empty-state">
              {keyword.trim() ||
              advancedFiltersActive ||
              onlyWithConsultations ||
              filterNoRecentConsult ||
              favoriteOnly
                ? onlyWithConsultations &&
                    !keyword.trim() &&
                    !advancedFiltersActive &&
                    !filterNoRecentConsult &&
                    !favoriteOnly
                  ? '상담 기록이 있는 고객이 없습니다. 필터에서 「상담 기록이 있는 고객만 보기」를 해제해 보세요.'
                  : favoriteOnly &&
                      !keyword.trim() &&
                      !advancedFiltersActive &&
                      !onlyWithConsultations &&
                      !filterNoRecentConsult
                    ? '중요 고객으로 표시된 고객이 없습니다. 카드의 ★로 추가해 보세요.'
                    : '검색·필터 조건에 맞는 고객이 없습니다.'
                : '고객이 없습니다.'}
            </p>
          ) : (
            <ul className="record-list customer-expand-list customer-list customers-page__customer-list">
              {sortedCustomers.map((c) => (
                <CustomerListCard
                  key={c.id}
                  customer={c}
                  ssnDupHighlight={ssnDupHighlightByCustomerId.get(c.id)}
                  isSelectMode={isSelectMode}
                  selectedCustomerIds={selectedCustomerIds}
                  setSelectedCustomerIds={setSelectedCustomerIds}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  onEditSubmit={handleEditFormSubmit}
                  onStatusMessage={setStatusText}
                  carFeatureEnabled={carFeatureEnabled}
                  historyLoading={historyLoading}
                  historyForms={historyForms}
                  onCopyCustomer={copyCustomer}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDeleteCustomer={handleDeleteCustomer}
                  onNavigateToFormEdit={(formId) => navigate(`/form/${formId}/edit`)}
                  token={token}
                  onOpenCustomer={openCustomerInList}
                  consultationCount={consultationCounts[c.id] ?? 0}
                  lastConsultDateLabel={lastConsultDateMap[c.id] ?? null}
                  onConsultationCountsInvalidate={() => {
                    void refreshConsultationCounts()
                  }}
                  onCustomerNotesPersisted={() => {
                    void loadCustomers()
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {isColumnPickerOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setIsColumnPickerOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsColumnPickerOpen(false)
            }
          }}
        >
          <div
            className="modal modal-excel-columns"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-columns-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="excel-columns-title">엑셀에 포함할 항목</h3>
            <div className="modal-body">
              <ul className="modal-excel-columns__list">
                {EXCEL_COLUMN_META.map((col) => (
                  <li key={col.id} className="modal-excel-columns__item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.id)}
                        onChange={() => toggleExcelColumn(col.id)}
                      />
                      {col.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-actions">
              <button type="button" className="confirm" onClick={() => setIsColumnPickerOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showScrollToTop ? (
        <button
          type="button"
          className="scroll-to-top"
          aria-label="맨 위로 스크롤"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      ) : null}
    </main>
  )
}
