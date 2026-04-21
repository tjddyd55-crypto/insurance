import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SetStateAction,
  type TouchEvent,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useConfirmDialog } from '../../../components/dialog'
import { getPublicOrigin } from '../../../lib/publicOrigin'
import { useAuth } from '../../auth/AuthProvider'
import { isCarInsuranceFeatureEnabledForGa } from '../../dashboard/gaTenantMenu'
import {
  assertCustomerDataRecord,
  deleteCustomer,
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
  CUSTOMER_MEDICAL_QUESTION_HINT,
  CUSTOMER_MEDICAL_QUESTION_TEXT,
  formatCustomerPhoneUi,
  formatCustomerSsnUi,
} from '../utils/customerDisplayFormat'
import {
  CustomerForm,
  InsuranceInline,
  drivingText,
} from '../../../components/customer/CustomerForm'
import {
  EXPANDABLE_CARD_INVALID_ID,
  useExpandableCard,
} from '../../../hooks/useExpandableCard'
import useIsMobile from '../../../hooks/useIsMobile'
import { useDebounce } from '../../../hooks/useDebounce'
import { ExitConfirmDialog } from '../../../components/ExitConfirmDialog'
import { MSG_CUSTOMER_CREATE_EXIT } from '../../../navigation/backNavigationPolicy'
import { searchCustomersAdvanced, type CustomerConsultationRow } from '../api/customerExtraApi'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { useGaSettings } from '../../ga-settings/useGaSettings'
import CustomerAutoModal from '../components/mobile/CustomerAutoModal'
import CustomerConsultationsModal from '../components/mobile/CustomerConsultationsModal'
import CustomerFilesModal from '../components/mobile/CustomerFilesModal'
import CustomerGaDataModal from '../components/mobile/CustomerGaDataModal'
import { CustomerRelationsStrip } from '../components/CustomerRelationsStrip'
import CustomersPageMobileView from './customers/CustomersPageMobileView'
import CustomersPagePCView from './customers/CustomersPagePCView'

/** WebView: touchstart·mousedown·합성 click 연속 시 복사/알림 중복 방지 */
const INVITE_COPY_POINTER_DEBOUNCE_MS = 450

/** 오른쪽 작업영역(파일·상담·메모·GA)이 라우트로 고객을 고정할 때 — 카드 접힘과 `?customerId=` 동기화 충돌 방지
 *  새 탭이 추가되면 아래 목록만 갱신하면 된다. regex 오타·누락으로 인한 UX 차이를 막기 위해 배열로 관리한다.
 */
const WORKSPACE_SIDE_DETAIL_TABS = ['files', 'consultations', 'ga-excel', 'memos', 'auto-form'] as const
const WORKSPACE_SIDE_DETAIL_PATH_RE = new RegExp(
  `^/customers/[^/]+/(?:${WORKSPACE_SIDE_DETAIL_TABS.join('|')})(?:/|$)`,
)
function isCustomerWorkspaceSideDetailPath(pathname: string): boolean {
  return WORKSPACE_SIDE_DETAIL_PATH_RE.test(pathname)
}

/**
 * 고객 전환 시 "현재 보고 있던 탭"을 유지하기 위해 경로에서 탭을 식별한다.
 *
 * 예: `/customers/123/memos` 에서 B 고객 선택 → `/customers/456/memos`
 *     `/customers/123/auto-form` 에서 B 고객 선택 → `/customers/456/auto-form`
 *
 * 새 우측 메뉴가 추가되면 위 `WORKSPACE_SIDE_DETAIL_TABS` 와 이 함수 두 곳만
 * 함께 업데이트하면 된다. 기본값(`files`)은 상세 탭이 없는 상태에서 처음 고객을
 * 선택할 때의 랜딩 탭을 가리킨다.
 */
function resolveCustomerWorkspaceTab(
  pathname: string,
): 'files' | 'consultations' | 'memos' | 'ga-excel' | 'auto-form' {
  if (pathname.includes('/consultations')) {
    return 'consultations'
  }
  if (pathname.includes('/memos')) {
    return 'memos'
  }
  if (pathname.includes('/ga-excel') || pathname.includes('/ga')) {
    return 'ga-excel'
  }
  if (pathname.includes('/auto-form')) {
    return 'auto-form'
  }
  return 'files'
}

function isScrollableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  const canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  return canScrollY && el.scrollHeight > el.clientHeight + 1
}

function resolveCustomerScrollContainer(target: HTMLElement): HTMLElement {
  const listContainer = document.querySelector('.customers-page__customer-list')
  if (isScrollableElement(listContainer)) {
    return listContainer
  }

  let current: Element | null = target
  while (current != null) {
    if (isScrollableElement(current)) {
      return current
    }
    current = current.parentElement
  }

  if (document.scrollingElement instanceof HTMLElement) {
    return document.scrollingElement
  }

  return document.documentElement
}

async function copyTextWithWebViewFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)

    try {
      textarea.focus()
      textarea.select()
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
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

/** 카드 상단: API가 phone / phoneNumber / phone_number 중 무엇으로 주든 통일 */
function resolveCustomerListPhone(
  customer: CustomerRecord & { phoneNumber?: unknown; phone_number?: unknown },
): string {
  const raw = customer.phoneNumber ?? customer.phone_number ?? customer.phone ?? ''
  if (raw == null) {
    return ''
  }
  return typeof raw === 'string' ? raw : String(raw)
}

/**
 * 전화 아이콘 — 이모지(📞)는 OS/브라우저에서 멀티컬러 비트맵으로 그려져 `color`/`text-*`가
 * 적용되지 않는 경우가 많음. SVG + currentColor로 테마·부모 링크와 분리해 색을 준다.
 */
function CustomerListTelSvg({
  hasPhone,
  withLinkHover,
}: {
  hasPhone: boolean
  withLinkHover?: boolean
}) {
  const tone = hasPhone
    ? withLinkHover
      ? 'h-5 w-5 shrink-0 !text-green-500 transition-colors group-hover:!text-green-400 active:!text-green-600'
      : 'h-5 w-5 shrink-0 !text-green-500 transition-colors'
    : 'h-5 w-5 shrink-0 text-gray-400 transition-colors'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={tone}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
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

function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
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

function ymdAscSortKey(ymd: string | null): string {
  return ymd ?? '9999-12-31'
}

function parseCreatedAtMs(iso: string | undefined | null): number {
  const t = Date.parse(String(iso ?? ''))
  return Number.isFinite(t) ? t : 0
}

function normalizeYmd(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null
  }
  return s
}

function parseYmdMs(ymd: string | null | undefined): number {
  const valid = normalizeYmd(ymd)
  if (!valid) {
    return 0
  }
  const t = Date.parse(`${valid}T00:00:00.000Z`)
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
  onSelectCustomer: (c: CustomerRecord) => void
  editingId: number | null
  editForm: CustomerEditFormState | null
  setEditForm: Dispatch<SetStateAction<CustomerEditFormState | null>>
  onEditSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  carFeatureEnabled: boolean
  gaExcelEnabled: boolean
  onCopyCustomer: (c: CustomerRecord) => void
  onStartEdit: (c: CustomerRecord) => void
  onCancelEdit: () => void
  onDeleteCustomer: (c: CustomerRecord) => void
  onOpenFilesModal: (customerId: number) => void
  onOpenConsultationsModal: (customerId: number) => void
  onOpenAutoModal: (customerId: number) => void
  onOpenGaModal: (customerId: number) => void
  onOpenRelatedCustomer: (customerId: number, customerName?: string) => void
  token: string | null
  onToggleFavorite: (c: CustomerRecord) => void | Promise<void>
  /**
   * PC/Mobile 분기를 컴포넌트 내부 `useIsMobile()` 호출이 아니라 부모에서 내려주는
   * 명시적 variant 로 받는다 (AGENTS.md §8-5 Tier 4).
   * 상위 `CustomersPage` 는 이미 동일 세션에서 `isMobile` 을 계산해 View 를 분기하므로,
   * 자식 카드는 그 값을 그대로 내려받아 쓰면 된다 — 훅이 여러 곳에서 중복 호출되지 않는다.
   */
  variant: 'pc' | 'mobile'
}

const CustomerListCard = memo(function CustomerListCard({
  customer: c,
  ssnDupHighlight,
  isSelectMode,
  selectedCustomerIds,
  setSelectedCustomerIds,
  expandedId,
  setExpandedId,
  onSelectCustomer,
  editingId,
  editForm,
  setEditForm,
  onEditSubmit,
  carFeatureEnabled,
  gaExcelEnabled,
  onCopyCustomer,
  onStartEdit,
  onCancelEdit,
  onDeleteCustomer,
  onOpenFilesModal,
  onOpenConsultationsModal,
  onOpenAutoModal,
  onOpenGaModal,
  onOpenRelatedCustomer,
  token,
  onToggleFavorite,
  variant,
}: CustomerListCardProps) {
  const isMobile = variant === 'mobile'
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
  const recentConsultText = c.lastConsultDate ? formatDateYmdInput(c.lastConsultDate) : '-'
  const phone = resolveCustomerListPhone(c)
  const hasPhone = typeof phone === 'string' && phone.trim() !== ''
  const smsHref = customerPhoneHref(phone, 'sms')
  const telHref = customerPhoneHref(phone, 'tel')

  function handleSummaryKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isSelectMode) {
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
      onSelectCustomer(c)
    }
  }
  return (
    <li
      id={`customer-${c.id}`}
      data-customer-id={c.id}
      className={`record-card customer-card customer-expand-card transition-all duration-200 ease-out${
        isSelectMode ? ' customer-expand-card--select-mode' : ''
      }${expanded ? ' customer-expand-card--focal' : ''}`}
      data-customer-card-id={c.id}
    >
      {isSelectMode ? (
        <div className="customer-expand-card__select">
          <FormInput
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
          onClick={() => {
            toggleExpanded()
            onSelectCustomer(c)
          }}
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
                  className="customer-card__actions"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="icon-box">
                    <FormButton
                      htmlType="button"
                      variant="action"
                      className="text-lg leading-none disabled:opacity-50"
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
                    </FormButton>
                  </div>
                  {/* 전화/문자 아이콘은 모바일(터치 디바이스)에서만 의미가 있어 PC에서는 DOM 자체를 넣지 않는다.
                      CSS display:none 대신 조건부 렌더로 의도를 명시해 향후 유틸리티 override 위험을 제거한다. */}
                  {isMobile ? (
                    <>
                      <div className="icon-box icon-box--sms">
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
                      </div>
                      <div className="icon-box icon-box--tel">
                        {telHref ? (
                          <a
                            href={telHref}
                            className="group transition-opacity hover:opacity-90 active:opacity-80"
                            aria-label="전화 걸기"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CustomerListTelSvg hasPhone withLinkHover />
                          </a>
                        ) : (
                          <span aria-hidden>
                            <CustomerListTelSvg hasPhone={hasPhone} />
                          </span>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
                <span className="customer-expand-summary__hint" aria-hidden="true">
                  {showExpandedChrome ? '▲' : '▼'}
                </span>
              </div>
            </div>
          </span>
        </div>

        <div
            className={`customer-expand-detail${detailClosing ? ' customer-expand-detail--closing' : ''}`}
            hidden={!expanded && !detailClosing}
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
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="customer-icon-action"
                  title="카톡 복사"
                  aria-label="카톡 복사"
                  onClick={() => void onCopyCustomer(c)}
                >
                  📋
                </FormButton>
                {editingId !== c.id ? (
                  <FormButton
                    htmlType="button"
                    variant="action"
                    className="customer-icon-action"
                    title="수정"
                    aria-label="수정"
                    onClick={() => onStartEdit(c)}
                  >
                    ✏️
                  </FormButton>
                ) : null}
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="customer-icon-action"
                  title="삭제"
                  aria-label="삭제"
                  onClick={() => void onDeleteCustomer(c)}
                >
                  🗑
                </FormButton>
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
                      <FormInput
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
                          <FormInput
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
                          <FormInput
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
                      <FormInput
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
                      <FormInput
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
                      <FormInput
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
                      <FormInput
                        className="field__control"
                        value={editForm.height ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, height: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">몸무게</span>
                      <FormInput
                        className="field__control"
                        value={editForm.weight ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, weight: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">직업 / 회사명 등</span>
                      <FormInput
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
                          <FormInput
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
                          <FormInput
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
                      <FormInput
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
                      <span className="field__label">
                        {CUSTOMER_MEDICAL_QUESTION_TEXT}
                        <br />
                        <small style={{ opacity: 0.85 }}>{CUSTOMER_MEDICAL_QUESTION_HINT}</small>
                      </span>
                      <FormTextarea
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
                      <FormTextarea
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
                      <FormInput
                        className="field__control"
                        value={editForm.carNumber ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carNumber: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">차종</span>
                      <FormInput
                        className="field__control"
                        value={editForm.carModel ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carModel: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">연식</span>
                      <FormInput
                        className="field__control"
                        value={editForm.carYear ?? ''}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, carYear: e.target.value } : prev))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">만기(갱신)일</span>
                      <FormInput
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
                    <FormButton className="button-save" htmlType="submit" variant="primary">
                      수정 저장
                    </FormButton>
                    <FormButton className="button-cancel" htmlType="button" variant="secondary" onClick={onCancelEdit}>
                      취소
                    </FormButton>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="customer-detail-read">
                  <p>
                    <strong>주민번호:</strong> {formatCustomerSsnUi(c.ssn) || '—'}
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
                    <strong>핸드폰번호:</strong> {formatCustomerPhoneUi(c.phone) || '—'}
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
                    <strong>{CUSTOMER_MEDICAL_QUESTION_TEXT}</strong>
                    <br />
                    <span style={{ opacity: 0.85 }}>{CUSTOMER_MEDICAL_QUESTION_HINT}</span>
                  </p>
                  <p>{c.medical?.trim() || '—'}</p>
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
              </>
            )}
            <div className="customer-expand-section-divider" role="presentation" />
            {!(editingId === c.id && editForm) ? (
              <>
                {isMobile ? (
                  <>
                    <div className="customer-expand-section-divider" role="presentation" />
                    <div className={`customer-detail-feature-actions ${isMobile ? 'customer-detail-feature-actions--mobile' : ''}`}>
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        className="button button--secondary"
                        onClick={() => onOpenFilesModal(c.id)}
                      >
                        고객 파일
                      </FormButton>
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        className="button button--secondary"
                        onClick={() => onOpenConsultationsModal(c.id)}
                      >
                        상담 내역
                      </FormButton>
                      {carFeatureEnabled ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="button button--secondary"
                          onClick={() => onOpenAutoModal(c.id)}
                        >
                          자동차 신청서
                        </FormButton>
                      ) : null}
                      {gaExcelEnabled ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          className="button button--secondary"
                          onClick={() => onOpenGaModal(c.id)}
                        >
                          GA 데이터 보기
                        </FormButton>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
      </div>
    </li>
  )
})

export default function CustomersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  /**
   * 고객등록 → 목록: 반드시 replace. setSearchParams({}) / blocker.proceed() 사용 금지(히스토리 중복·이중 POP).
   * 차단 중이면 reset()만 하고 이 함수로 이동한다.
   */
  const navigateToCustomerListReplace = useCallback(() => {
    navigate('/customers', { replace: true })
  }, [navigate])
  const { user, token } = useAuth()
  const { gaSettings } = useGaSettings()
  const { confirm, confirmDialog } = useConfirmDialog()
  const carFeatureEnabled = isCarInsuranceFeatureEnabledForGa(user?.gaCode)
  const gaExcelEnabled = gaSettings.use_ga_excel === true
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [customersTotalCount, setCustomersTotalCount] = useState(0)
  const customersRef = useRef<CustomerRecord[]>([])
  customersRef.current = customers
  const [statusText, setStatusText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const tab = searchParams.get('mode') === 'create' ? 'create' : 'list'
  const selectedCustomerIdFromQuery = useMemo(
    () => parseSelectedCustomerId(searchParams.get('customerId')),
    [searchParams],
  )
  /**
   * `CustomersPage` 는 좌측 목록(카드 펼침)과 `?customerId=` 쿼리만 관리한다.
   * "지금 선택된 고객 id" 의 단일 진실 원천은 **URL path** 이며,
   * 이 값을 소비하는 쪽(우측 워크스페이스)은 `CustomerWorkspaceLayout` 이 자체적으로
   * path → query 순서로 memo 파생한다 (routing-ssot.mdc §1 · §9).
   *
   * 과거에는 이 파일에도 `selectedCustomerId` state 가 존재해 두 개의 pull effect
   * (query→state, expandedId→state) 가 동일 state 를 다른 source 로 당겨 쓰며
   * 핑퐁(Maximum update depth exceeded) 을 유발했지만, 해당 state 는 실제로
   * 이 컴포넌트 내부·하위 뷰 어디에서도 read 되지 않는 **dead state** 였기 때문에
   * memo 로 전환하지 않고 그대로 제거했다. 선택 고객 id 가 필요해지는 시점에는
   * `CustomerWorkspaceLayout` 의 파생값을 재사용한다.
   */
  const [expandedId, rawSetExpandedId] = useState<number | null>(() => {
    if (selectedCustomerIdFromQuery != null) {
      return selectedCustomerIdFromQuery
    }
    return null
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null)
  const [activeMobileModal, setActiveMobileModal] = useState<
    null | 'files' | 'consultations' | 'auto' | 'ga'
  >(null)
  const [activeMobileCustomerId, setActiveMobileCustomerId] = useState<number | null>(null)
  const [scrollRequestKey, setScrollRequestKey] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const scrollCountRef = useRef(0)
  const expandedIdRef = useRef<number | null>(null)
  const editingIdRef = useRef<number | null>(null)
  const editFormRef = useRef<CustomerEditFormState | null>(null)
  expandedIdRef.current = expandedId
  editingIdRef.current = editingId
  editFormRef.current = editForm

  /**
   * expandedId state 와 `?customerId=` 쿼리를 **한 번의 호출로 원자 업데이트**하는 래퍼.
   *
   * 과거에는 expandedId 가 바뀐 뒤 별도의 effect(구:Effect C) 가 뒤늦게 URL 을 따라붙이는
   * 구조였다. 이는 routing-ssot.mdc §3 가 명시한 red flag("effect 안에서 setSearchParams"
   * + "state→URL reflect") 에 해당해, 특정 타이밍에 URL 과 state 가 어긋나거나 사용자
   * 조작을 덮어쓸 여지를 남겼다.
   *
   * 래퍼는 state 를 먼저 반영한 뒤, side-detail path(/customers/:id/*) 가 아닌 경우에만
   * query 를 동기화한다. side-detail path 에서는 우측 패널(CustomerFiles/Memos 등) 이
   * 동일 쿼리를 관장하므로 목록의 접기·펼치기가 패널 URL 을 덮어쓰면 안 된다
   * (routing-ssot.mdc §6-B).
   *
   * 이 래퍼는 내부적으로 useState 의 raw setter 를 감싸기 때문에 기존 호출부
   * (`setExpandedId(id)` · `useExpandableCard` prop 등) 를 고치지 않아도 자동으로
   * URL 동기화가 적용된다.
   */
  const setExpandedId = useCallback<Dispatch<SetStateAction<number | null>>>(
    (updater) => {
      const prev = expandedIdRef.current
      const next =
        typeof updater === 'function'
          ? (updater as (prev: number | null) => number | null)(prev)
          : updater
      rawSetExpandedId(next)
      if (isCustomerWorkspaceSideDetailPath(location.pathname)) {
        return
      }
      const currentQueryId = parseSelectedCustomerId(searchParams.get('customerId'))
      if (currentQueryId === next) {
        return
      }
      const nextParams = new URLSearchParams(searchParams)
      if (next == null) {
        nextParams.delete('customerId')
      } else {
        nextParams.set('customerId', String(next))
      }
      setSearchParams(nextParams, { replace: true })
    },
    [location.pathname, searchParams, setSearchParams],
  )

  // NOTE: Router supports only one blocker. Global AppExitConfirm handles POP blocking (including customer create).
  const [searchInput, setSearchInput] = useState('')
  const keyword = useDebounce(searchInput, 300)
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
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [customerCreateExitModalOpen, setCustomerCreateExitModalOpen] = useState(false)
  /** 터치→합성 mouse/click 등으로 초대 복사가 두 번 도는 것 방지 */
  const inviteCopyPointerTsRef = useRef(0)

  useEffect(() => {
    function onScroll() {
      setShowScrollToTop(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /** React Native WebView: 하드웨어 뒤로가기는 앱이 소비 후 이 이벤트만 전달 → ExitConfirmDialog 단일 표시 */
  useEffect(() => {
    if (tab !== 'create') {
      return
    }
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ reason?: string }>
      if (ce.detail?.reason !== 'customer-create-exit') {
        return
      }
      setCustomerCreateExitModalOpen(true)
    }
    window.addEventListener('insurance-native-back', handler as EventListener)
    return () => window.removeEventListener('insurance-native-back', handler as EventListener)
  }, [tab])

  const ssnDupHighlightByCustomerIdPrevRef = useRef<Map<number, CustomerSsnDupHighlight>>(new Map())
  const ssnDupHighlightByCustomerId = useMemo(() => {
    const built = buildSsnDuplicateHighlightByCustomerId(customers)
    const prev = ssnDupHighlightByCustomerIdPrevRef.current
    const next = new Map<number, CustomerSsnDupHighlight>()
    for (const [id, hi] of built) {
      const old = prev.get(id)
      const stable =
        old != null && old.groupLabel === hi.groupLabel && old.color === hi.color ? old : hi
      next.set(id, stable)
    }
    ssnDupHighlightByCustomerIdPrevRef.current = next
    return next
  }, [customers])

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
    if (favoriteOnly) {
      list = list.filter((c) => c.isFavorite)
    }
    return list
  }, [keywordFilteredCustomers, advancedFilters, favoriteOnly])

  const advancedFiltersActive = useMemo(() => {
    const f = advancedFilters
    return !!(f.minInsuranceAge.trim() || f.maxInsuranceAge.trim() || f.gender)
  }, [advancedFilters])

  const listIsNarrowed = useMemo(
    () =>
      keyword.trim() !== '' ||
      advancedFiltersActive ||
      favoriteOnly ||
      advSearchHits != null,
    [keyword, advancedFiltersActive, favoriteOnly, advSearchHits],
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
        const ta = parseYmdMs(a.lastConsultDate) || parseCreatedAtMs(a.createdAt)
        const tb = parseYmdMs(b.lastConsultDate) || parseCreatedAtMs(b.createdAt)
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
      setCustomers(safeData)
      setCustomersTotalCount(total)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role])

  const handleToggleFavorite = useCallback(
    async (c: CustomerRecord) => {
      if (!token?.trim()) {
        return
      }
      const targetId = c.id
      const previousFavorite = c.isFavorite
      const nextFavorite = !previousFavorite
      setCustomers((prev) =>
        prev.map((row) =>
          row.id === targetId ? { ...row, isFavorite: !row.isFavorite } : row,
        ),
      )
      setAdvSearchHits((hits) =>
        hits == null
          ? null
          : hits.map((row) =>
              row.id === targetId ? { ...row, isFavorite: !row.isFavorite } : row,
            ),
      )
      try {
        await updateCustomer(token, targetId, { isFavorite: nextFavorite })
      } catch (error) {
        setCustomers((prev) =>
          prev.map((row) =>
            row.id === targetId ? { ...row, isFavorite: previousFavorite } : row,
          ),
        )
        setAdvSearchHits((hits) =>
          hits == null
            ? null
            : hits.map((row) =>
                row.id === targetId ? { ...row, isFavorite: previousFavorite } : row,
              ),
        )
        setStatusText(error instanceof Error ? error.message : '즐겨찾기 변경에 실패했습니다.')
      }
    },
    [token],
  )

  /**
   * 카드 요약 클릭에 따르는 부수 작업 전담 핸들러.
   *
   * 책임 분리 (routing-ssot.mdc §4, 단일 책임 원칙):
   *  - expandedId 토글 + 접기 애니메이션은 `useExpandableCard.toggleExpanded` 전담
   *  - 이 핸들러는 같은 클릭에 뒤따르는 두 가지만 수행한다.
   *      1) 펼친 카드가 보이도록 스크롤 요청
   *      2) PC 에서는 우측 워크스페이스 path 로 이동
   *
   * 과거에는 여기서도 `setExpandedId(c.id)` 를 호출해 `toggleExpanded` 와
   * 이중으로 setter 를 트리거했고, 그 부작용으로 같은 이벤트에서
   * URL 동기화가 두 번 수행되었다. 책임을 분리한 뒤로는 setter 호출이
   * 한 번으로 정리되고, 각 함수 이름이 곧 그 함수의 역할이 된다.
   */
  const handleSelectCustomer = useCallback(
    (c: CustomerRecord) => {
      setScrollRequestKey((prev) => prev + 1)
      if (isMobile) {
        return
      }
      const safeTab = resolveCustomerWorkspaceTab(location.pathname)
      navigate(`/customers/${c.id}/${safeTab}`, {
        replace: true,
        state: { customerName: c.name },
      })
    },
    [isMobile, location.pathname, navigate],
  )

  const handleOpenRelatedCustomer = useCallback(
    (customerId: number, customerName?: string) => {
      // 연계고객 클릭은 "검색"이 아니라 해당 고객 선택/펼침으로 동작해야 한다.
      setSearchInput('')
      setDeepSearch(false)
      setFavoriteOnly(false)
      setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS })
      setAdvSearchHits(null)
      setExpandedId(customerId)
      setScrollRequestKey((prev) => prev + 1)

      const next = new URLSearchParams(searchParams)
      next.delete('mode')
      next.set('customerId', String(customerId))
      const qs = next.toString()

      if (isMobile) {
        navigate(qs ? `/customers?${qs}` : '/customers', {
          replace: true,
          state: customerName?.trim() ? { customerName } : undefined,
        })
        return
      }

      const safeTab = resolveCustomerWorkspaceTab(location.pathname)
      navigate(
        qs ? `/customers/${customerId}/${safeTab}?${qs}` : `/customers/${customerId}/${safeTab}`,
        {
          replace: true,
          state: customerName?.trim() ? { customerName } : undefined,
        },
      )
    },
    [isMobile, location.pathname, navigate, searchParams, setExpandedId],
  )

  useEffect(() => {
    if (user?.role !== 'USER') {
      setIsLoading(false)
      return
    }
    void loadCustomers()
  }, [user?.role, loadCustomers])

  /**
   * 카드 펼침(expandedId)은 요약 클릭으로만 바꾼다.
   * `?customerId=` 는 작업공간·CustomerFilesPage 등이 유지할 수 있으므로,
   * URL 쿼리가 바뀌었다고 펼침을 강제하지 않는다(파일 패널 ↔ 목록 충돌 방지).
   */
  /**
   * [HISTORY] 과거에는 `selectedCustomerId` 가 이 컴포넌트의 state 였고,
   * 두 개의 pull effect(A: query→state, B: expandedId→state) 가 각기 다른 source 로부터
   * 값을 당겨 쓰며 핑퐁 → `Maximum update depth exceeded` 를 유발했다.
   *
   * 근본 정리 결과: 해당 state 는 이 파일 안에서도 하위 뷰에서도 **실제로 read 되지 않던**
   * dead state 였다 (우측 워크스페이스는 `CustomerWorkspaceLayout` 이 path 기준으로 자체
   * 파생). 따라서 memo 로 전환할 필요 없이 state 와 두 pull effect 를 통째로 제거했다.
   *
   * 선택된 고객 id 의 단일 진실 원천은 이제 `CustomerWorkspaceLayout` 의 path → query
   * 파생값 한 곳뿐이다 (routing-ssot.mdc §1 · §9).
   *
   * 이 주석 블록 자체는 SSOT 근본 정리 마지막 커밋에서 함께 제거될 예정이다.
   */

  useLayoutEffect(() => {
    if (expandedId == null) {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      return
    }
    scrollCountRef.current = 0
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    let disposed = false
    let retry = 0
    let rafId = 0
    const pendingTimers: number[] = []
    // 모바일(WebView)에서는 카드/리스트 렌더 반영이 늦어 attach 재시도 여유를 더 준다.
    const maxRetry = isMobile ? 60 : 8

    const tryAttach = () => {
      if (disposed) {
        return
      }

      const target = document.querySelector<HTMLElement>(`[data-customer-id="${expandedId}"]`)
      if (!target) {
        if (retry < maxRetry) {
          retry += 1
          rafId = requestAnimationFrame(tryAttach)
        }
        return
      }

      // 모바일 전용 스크롤 전략.
      // 이전에 펼쳐져 있던 카드가 닫힘 애니메이션(≈320ms) 동안 높이가 줄면서
      // 타깃 카드의 실제 Y 좌표가 계속 변한다. ResizeObserver는 "대상 자신"의 크기 변화만 잡기 때문에
      // 주변 카드가 축소되는 케이스를 놓친다. 그래서 컨테이너 기준 Y 계산 대신
      // 네이티브 scrollIntoView(현재 위치 기준)를 애니메이션 구간 전·중·후에 여러 번 호출해
      // 최종 레이아웃에서 항상 최상단에 고정되도록 한다.
      if (isMobile) {
        const snap = () => {
          if (disposed || !target.isConnected) {
            return
          }
          // options-object 미지원 구형 WebView 호환을 위해 boolean 인자 사용(= block:'start').
          target.scrollIntoView(true)
        }
        rafId = requestAnimationFrame(snap)
        ;[120, 260, 380].forEach((ms) => {
          pendingTimers.push(window.setTimeout(snap, ms))
        })
        return
      }

      const container = resolveCustomerScrollContainer(target)

      const runScroll = () => {
        if (disposed || !target.isConnected) {
          return
        }
        if (scrollCountRef.current >= 2) {
          return
        }
        scrollCountRef.current += 1

        const containerRect = container.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()

        const y = targetRect.top - containerRect.top + container.scrollTop
        const stickyElements = container.querySelectorAll<HTMLElement>(
          '.sticky, .filter-bar, .search-bar',
        )
        let stickyHeight = 0
        stickyElements.forEach((el) => {
          const rect = el.getBoundingClientRect()
          // 컨테이너 상단 영역과 실제로 겹치는 요소만 높이에 합산
          const isOverlapping = rect.bottom >= containerRect.top && rect.top <= containerRect.top

          if (isOverlapping) {
            stickyHeight += rect.height
          }
        })

        container.scrollTo({
          top: Math.max(0, y - stickyHeight),
          behavior: 'smooth',
        })
      }

      const observer = new ResizeObserver(() => {
        runScroll()
      })
      observer.observe(target)
      observerRef.current = observer

      requestAnimationFrame(runScroll)
    }

    rafId = requestAnimationFrame(tryAttach)

    return () => {
      disposed = true
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      pendingTimers.forEach((id) => window.clearTimeout(id))
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [expandedId, isMobile, scrollRequestKey])

  // NOTE: "expandedId 변화 → ?customerId= 반영" 을 담당하던 effect(구:Effect C) 는 제거했다.
  // 동일 책임을 위 `setExpandedId` 래퍼가 동기적으로 수행하므로(§3 red flag 해소),
  // state→URL reflect 전용 effect 는 더 이상 필요 없다.

  useEffect(() => {
    if (expandedId == null) {
      return
    }
    const inMainList = customers.some((c) => c.id === expandedId)
    const inAdvHits = advSearchHits?.some((c) => c.id === expandedId) ?? false
    if (!inMainList && !inAdvHits) {
      setExpandedId(null)
    }
  }, [customers, advSearchHits, expandedId, setExpandedId])

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
          const rows = await searchCustomersAdvanced(token, { q, includeRelations: false, limit: 500 })
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

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm(null)
  }, [])

  const handleUpdateCustomer = useCallback(async () => {
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
    const activeEditingId = editingIdRef.current
    const activeEditForm = editFormRef.current
    if (activeEditingId == null || !activeEditForm) {
      const msg = '수정 중인 고객이 없습니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const base = customersRef.current.find((x) => x.id === activeEditingId)
    if (!base) {
      const msg = '고객 정보를 찾을 수 없습니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const name = activeEditForm.name.trim()
    if (!name) {
      const msg = '이름은 필수입니다.'
      setStatusText(msg)
      window.alert(msg)
      return
    }
    const carYearForApi = normalizeCustomerEditCarYearForApi(activeEditForm.carYear)
    const renewalDateForApi = normalizeCustomerEditRenewalDateForApi(activeEditForm.renewalDate)
    try {
      await updateCustomer(token, activeEditingId, {
        name,
        ssn: activeEditForm.ssn,
        phone: activeEditForm.phone,
        carrier: '',
        address: activeEditForm.address,
        height: activeEditForm.height,
        weight: activeEditForm.weight,
        job: activeEditForm.job,
        driving: drivingText(activeEditForm.isDriver),
        medical: activeEditForm.medical,
        gender: activeEditForm.gender,
        isDriver: activeEditForm.isDriver,
        carType: activeEditForm.carType.trim(),
        notes: {
          items: customerNoteItems(base),
          insuranceHistory: activeEditForm.insuranceHistory.trim(),
        },
        carNumber: activeEditForm.carNumber,
        carModel: activeEditForm.carModel,
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
  }, [token, user?.role, cancelEdit, loadCustomers])

  const handleEditFormSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      await handleUpdateCustomer()
    },
    [handleUpdateCustomer],
  )

  const copyCustomer = useCallback(async (rec: CustomerRecord) => {
    const text = buildKakaoCustomerCopyText(rec)
    try {
      await navigator.clipboard.writeText(text)
      window.alert('복사되었습니다')
    } catch {
      setStatusText('복사에 실패했습니다.')
    }
  }, [])

  const handleDeleteCustomer = useCallback(
    async (c: CustomerRecord) => {
      if (!token || user?.role !== 'USER') {
        return
      }
      const confirmed = await confirm({
        title: '고객 삭제',
        message: `고객 "${c.name}"(번호 ${c.id})를 목록에서 삭제할까요? 기존 신청서의 고객 연결(customer_id)은 유지됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!confirmed) {
        return
      }
      try {
        await deleteCustomer(token, c.id)
        if (expandedIdRef.current === c.id) {
          setExpandedId(null)
        }
        if (editingIdRef.current === c.id) {
          cancelEdit()
        }
        setStatusText('고객을 삭제했습니다.')
        await loadCustomers()
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : '삭제에 실패했습니다.')
      }
    },
    [token, user?.role, cancelEdit, loadCustomers, confirm, setExpandedId],
  )

  const startEdit = useCallback(
    (cl: CustomerRecord) => {
      setExpandedId(cl.id)
      setEditingId(cl.id)
      setEditForm(recordToEditForm(cl))
    },
    [setExpandedId],
  )

  const openMobileModal = useCallback(
    (modalType: 'files' | 'consultations' | 'auto' | 'ga', customerId: number) => {
      if (!isMobile) {
        return
      }
      setActiveMobileCustomerId(customerId)
      setActiveMobileModal(modalType)
      window.history.pushState({ ...(window.history.state ?? {}), modal: true }, '')
    },
    [isMobile],
  )

  const closeMobileModal = useCallback(() => {
    if (!isMobile || activeMobileModal == null) {
      return
    }
    if (window.history.state?.modal === true) {
      window.history.back()
      return
    }
    setActiveMobileModal(null)
    setActiveMobileCustomerId(null)
  }, [activeMobileModal, isMobile])

  useEffect(() => {
    if (!isMobile) {
      return
    }
    const handlePopState = () => {
      if (activeMobileModal != null) {
        setActiveMobileModal(null)
        setActiveMobileCustomerId(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [activeMobileModal, isMobile])

  const handleOpenFilesModal = useCallback(
    (customerId: number) => {
      openMobileModal('files', customerId)
    },
    [openMobileModal],
  )

  const handleOpenConsultationsModal = useCallback(
    (customerId: number) => {
      openMobileModal('consultations', customerId)
    },
    [openMobileModal],
  )

  const handleOpenAutoModal = useCallback(
    (customerId: number) => {
      openMobileModal('auto', customerId)
    },
    [openMobileModal],
  )

  const handleOpenGaModal = useCallback(
    (customerId: number) => {
      openMobileModal('ga', customerId)
    },
    [openMobileModal],
  )

  const handleCustomerConsultationCreated = useCallback(
    (customerId: number, row: Pick<CustomerConsultationRow, 'consultationDate' | 'createdAt'>) => {
      const dateFromRow = normalizeYmd(row.consultationDate)
      const dateFromCreatedAt = normalizeYmd(String(row.createdAt ?? '').slice(0, 10))
      const nextConsultDate = dateFromRow ?? dateFromCreatedAt
      if (!nextConsultDate) {
        return
      }

      const apply = (target: CustomerRecord): CustomerRecord => {
        const current = normalizeYmd(target.lastConsultDate)
        if (current != null && current >= nextConsultDate) {
          return target
        }
        return { ...target, lastConsultDate: nextConsultDate }
      }

      const sortByConsultDateDesc = (a: CustomerRecord, b: CustomerRecord) => {
        const ta = parseYmdMs(a.lastConsultDate)
        const tb = parseYmdMs(b.lastConsultDate)
        if (tb !== ta) {
          return tb - ta
        }
        return parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt)
      }

      setCustomers((prev) =>
        prev.map((rowItem) => (rowItem.id === customerId ? apply(rowItem) : rowItem)).sort(sortByConsultDateDesc),
      )
      setAdvSearchHits((hits) =>
        hits == null
          ? null
          : hits.map((rowItem) => (rowItem.id === customerId ? apply(rowItem) : rowItem)).sort(sortByConsultDateDesc),
      )
    },
    [],
  )


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

  /** 모바일 앱 WebView는 /customer/register 네비를 네이티브에서 막음 — 여기서는 복사만. */
  const runCustomerRegisterInviteCopy = useCallback(async () => {
    const refUsername = (user?.username ?? '').trim()
    const gaCode = (user?.gaCode ?? '').trim().toUpperCase()
    if (!gaCode) {
      window.alert('GA 코드가 없습니다')
      return
    }
    if (!refUsername) {
      window.alert('로그인 정보가 없습니다.')
      return
    }
    const origin = getPublicOrigin()
    if (!origin) {
      window.alert('초대 링크를 만들 수 없습니다. VITE_BASE_URL 설정을 확인해 주세요.')
      return
    }
    const inviteUrl = `${origin}/customer/register?ref=${encodeURIComponent(refUsername)}&ga=${encodeURIComponent(gaCode)}`
    const copied = await copyTextWithWebViewFallback(inviteUrl)
    if (copied) {
      alert('링크 복사 완료')
      return
    }
    alert('복사 실패')
  }, [user?.username, user?.gaCode])

  const invokeInviteCopyFromPointer = useCallback(() => {
    const now = Date.now()
    if (now - inviteCopyPointerTsRef.current < INVITE_COPY_POINTER_DEBOUNCE_MS) {
      return
    }
    inviteCopyPointerTsRef.current = now
    void runCustomerRegisterInviteCopy()
  }, [runCustomerRegisterInviteCopy])

  const onCustomerRegisterInviteCopyTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      invokeInviteCopyFromPointer()
    },
    [invokeInviteCopyFromPointer],
  )

  const onCustomerRegisterInviteCopyMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      invokeInviteCopyFromPointer()
    },
    [invokeInviteCopyFromPointer],
  )

  const onCustomerRegisterInviteCopyClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onCustomerRegisterInviteCopyKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      void runCustomerRegisterInviteCopy()
    },
    [runCustomerRegisterInviteCopy],
  )

  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  const excelToolbarNode =
    isSelectMode && tab === 'list' ? (
      <div className="customers-excel-toolbar" role="region" aria-label="엑셀 다운로드 선택">
        <p className="customers-excel-toolbar__status">
          엑셀 선택 중 —「선택 다운로드」는 체크한 고객,「목록 전체 다운로드」는 지금 검색·필터·정렬된 목록만
        </p>
        <div className="customers-excel-toolbar__row">
          <label className="customers-excel-toolbar__select-all">
            <FormInput
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
          <FormButton htmlType="button" variant="action" className="filter-button" onClick={() => setIsColumnPickerOpen(true)}>
            컬럼 선택
          </FormButton>
          <FormButton htmlType="button" variant="action" className="cta-button" onClick={handleDownloadSelected}>
            선택 다운로드
          </FormButton>
          <FormButton htmlType="button" variant="action" className="cta-button" onClick={handleDownloadListAll}>
            목록 전체 다운로드
          </FormButton>
          <FormButton htmlType="button" variant="action" className="filter-button" onClick={exitExcelSelectMode}>
            취소
          </FormButton>
        </div>
      </div>
    ) : null

  const headerNode = (
    <header className="page-header customers-page__header">
      {tab === 'list' ? (
        <>
          {!isSelectMode ? (
            <div className="customers-page__action-row">
              <FormButton
                htmlType="button"
                variant="action"
                className="cta-button customers-page__action-btn"
                onClick={() => setSearchParams({ mode: 'create' }, { replace: true })}
              >
                고객 등록
              </FormButton>
              <div
                role="button"
                tabIndex={0}
                className="cta-button customers-page__action-btn customers-page__invite-copy-btn"
                style={{ touchAction: 'manipulation' }}
                aria-label="고객 등록 링크 복사"
                onTouchStart={onCustomerRegisterInviteCopyTouchStart}
                onMouseDown={onCustomerRegisterInviteCopyMouseDown}
                onClick={onCustomerRegisterInviteCopyClick}
                onKeyDown={onCustomerRegisterInviteCopyKeyDown}
              >
                등록 링크
              </div>
              <FormButton
                htmlType="button"
                variant="action"
                className="cta-button customers-page__action-btn"
                onClick={() => {
                  if (isMobile) {
                    const msg = 'PC 버전에서 가능합니다.'
                    setStatusText(msg)
                    window.alert(msg)
                    return
                  }
                  enterExcelSelectMode()
                }}
              >
                엑셀 다운로드
              </FormButton>
            </div>
          ) : null}
          <div className="customers-page__search-row">
            <FormInput
              className="search-input customers-page__search-input"
              type="search"
              placeholder="이름 / 전화번호 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              aria-label="이름 또는 전화번호 검색"
            />
            <FormButton
              htmlType="button"
              variant="action"
              className={`favorite-btn${favoriteOnly ? ' favorite-btn--on' : ''}`}
              aria-pressed={favoriteOnly}
              onClick={() => setFavoriteOnly((v) => !v)}
            >
              중요 고객
            </FormButton>
            <FormButton
              htmlType="button"
              variant="action"
              className={`customers-page__filter-toggle${showFilters ? ' customers-page__filter-toggle--on' : ''}`}
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              필터
            </FormButton>
          </div>
        </>
      ) : (
        <div className="customers-page__create-nav">
          <FormButton
            htmlType="button"
            variant="action"
            className="link-btn link-btn--compact"
            onClick={(e) => {
              e.stopPropagation()
              setCustomerCreateExitModalOpen(true)
            }}
          >
            ← 고객 목록
          </FormButton>
        </div>
      )}
      {statusText ? <p className="customers-page__status">{statusText}</p> : null}
    </header>
  )

  const listBodyNode = (
    <section className="list-section" style={{ marginTop: 0 }}>
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
              <FormInput
                type="checkbox"
                checked={deepSearch}
                onChange={(e) => setDeepSearch(e.target.checked)}
              />
              상담·연계 포함 검색 (서버 심층 검색)
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

          <div className="customers-sort-row" role="group" aria-label="목록 정렬 (같은 버튼을 다시 누르면 해제되어 이름 가나다순)">
            <span className="customers-sort-row__label">정렬</span>
            <div className="customers-sort-row__buttons filter-group">
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${sortType === 'age' ? ' active' : ''}`}
                aria-pressed={sortType === 'age'}
                onClick={() => setSortType((t) => (t === 'age' ? null : 'age'))}
              >
                상령일 빠른순
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${sortType === 'car' ? ' active' : ''}`}
                aria-pressed={sortType === 'car'}
                onClick={() => setSortType((t) => (t === 'car' ? null : 'car'))}
              >
                자동차 만기순
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${sortType === 'recent' ? ' active' : ''}`}
                aria-pressed={sortType === 'recent'}
                onClick={() => setSortType((t) => (t === 'recent' ? null : 'recent'))}
              >
                최근등록
              </FormButton>
            </div>
          </div>

          <div className="customers-advanced-filters" role="search" aria-label="고급 검색">
            <div className="customers-advanced-filters__grid">
              <label className="customers-advanced-filters__field">
                <span>보험나이 최소</span>
                <FormInput
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
                <FormInput
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
                <FormSelect
                  value={advancedFilters.gender}
                  onChange={(e) =>
                    setAdvancedFilters((f) => ({
                      ...f,
                      gender: e.target.value as CustomerAdvancedFilters['gender'],
                    }))
                  }
                  options={[
                    { value: '', label: '전체' },
                    { value: 'male', label: '남' },
                    { value: 'female', label: '여' },
                  ]}
                />
              </label>
            </div>
            <div className="customers-advanced-filters__quick filter-group">
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
                onClick={() => applyQuickFilter('AGE_UNDER_30_MALE')}
              >
                30세 이하 남성
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
                onClick={() => applyQuickFilter('AGE_OVER_40_FEMALE')}
              >
                40세 이상 여성
              </FormButton>
              {advancedFiltersActive ? (
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="filter-button"
                  onClick={() => setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS })}
                >
                  필터 초기화
                </FormButton>
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
          favoriteOnly
            ? favoriteOnly &&
                !keyword.trim() &&
                !advancedFiltersActive
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
              onSelectCustomer={handleSelectCustomer}
              editingId={editingId}
              editForm={editForm}
              setEditForm={setEditForm}
              onEditSubmit={handleEditFormSubmit}
              carFeatureEnabled={carFeatureEnabled}
              gaExcelEnabled={gaExcelEnabled}
              onCopyCustomer={copyCustomer}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onDeleteCustomer={handleDeleteCustomer}
              onOpenFilesModal={handleOpenFilesModal}
              onOpenConsultationsModal={handleOpenConsultationsModal}
              onOpenAutoModal={handleOpenAutoModal}
              onOpenGaModal={handleOpenGaModal}
              onOpenRelatedCustomer={handleOpenRelatedCustomer}
              token={token}
              onToggleFavorite={handleToggleFavorite}
              variant={isMobile ? 'mobile' : 'pc'}
            />
          ))}
        </ul>
      )}
    </section>
  )

  const createBodyNode = (
    <section className="card" style={{ marginTop: 0 }}>
      <CustomerForm
        onStatusMessage={setStatusText}
        onInternalSaveSuccess={() => {
          void loadCustomers()
          navigateToCustomerListReplace()
        }}
      />
    </section>
  )

  const columnPickerNode =
    isColumnPickerOpen ? (
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
                    <FormInput
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
            <FormButton htmlType="button" variant="action" className="confirm" onClick={() => setIsColumnPickerOpen(false)}>
              닫기
            </FormButton>
          </div>
        </div>
      </div>
    ) : null

  const scrollTopNode =
    showScrollToTop ? (
      <FormButton
        htmlType="button"
        variant="action"
        className="scroll-to-top"
        aria-label="맨 위로 스크롤"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </FormButton>
    ) : null

  const createExitConfirmNode =
    customerCreateExitModalOpen ? (
      <ExitConfirmDialog
        message={MSG_CUSTOMER_CREATE_EXIT}
        title="등록 이탈 확인"
        onCancel={() => {
          setCustomerCreateExitModalOpen(false)
        }}
        onConfirm={() => {
          navigateToCustomerListReplace()
          setCustomerCreateExitModalOpen(false)
        }}
      />
    ) : null

  const mobileDetailModalNode =
    isMobile && activeMobileCustomerId != null ? (
      <>
        {activeMobileModal === 'files' ? (
          <CustomerFilesModal
            customerId={activeMobileCustomerId}
            onClose={closeMobileModal}
          />
        ) : null}
        {activeMobileModal === 'consultations' ? (
          <CustomerConsultationsModal
            customerId={activeMobileCustomerId}
            onCreated={(row) => handleCustomerConsultationCreated(activeMobileCustomerId, row)}
            onClose={closeMobileModal}
          />
        ) : null}
        {activeMobileModal === 'auto' ? (
          <CustomerAutoModal
            customerId={activeMobileCustomerId}
            onClose={closeMobileModal}
          />
        ) : null}
        {activeMobileModal === 'ga' ? (
          <CustomerGaDataModal
            customerId={activeMobileCustomerId}
            onClose={closeMobileModal}
          />
        ) : null}
      </>
    ) : null

  const bodyNode = (
    <>
      {tab === 'create' ? createBodyNode : listBodyNode}
      {mobileDetailModalNode}
    </>
  )

  const viewProps: {
    isSelectMode: boolean
    showExcelToolbar: boolean
    excelToolbarNode: ReactNode
    headerNode: ReactNode
    bodyNode: ReactNode
    columnPickerNode: ReactNode
    scrollTopNode: ReactNode
    createExitConfirmNode: ReactNode
    confirmDialogNode: ReactNode
  } = {
    isSelectMode,
    showExcelToolbar: tab === 'list',
    excelToolbarNode,
    headerNode,
    bodyNode,
    columnPickerNode,
    scrollTopNode,
    createExitConfirmNode,
    confirmDialogNode: confirmDialog,
  }

  if (isMobile) {
    return <CustomersPageMobileView {...viewProps} />
  }
  return <CustomersPagePCView {...viewProps} />
}
