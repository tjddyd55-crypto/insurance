/**
 * 프로그램 문의 관리 — 상태·유형 한글 라벨 (admin 전용, web config 의존 최소화).
 */

import type { ProgramInquiryStatus, ProgramInquiryType } from '../api/programInquiriesAdminApi'
import {
  INTRO_CONTACT_TIMES,
  INTRO_INQUIRY_TYPES,
} from '../../web/config/introductionLandingContent'

export const PROGRAM_INQUIRY_STATUS_OPTIONS: { value: ProgramInquiryStatus; label: string }[] = [
  { value: 'NEW', label: '신규' },
  { value: 'CHECKING', label: '확인 중' },
  { value: 'CONTACTED', label: '연락 완료' },
  { value: 'COMPLETED', label: '처리 완료' },
  { value: 'SPAM', label: '스팸' },
]

export const PROGRAM_INQUIRY_TYPE_OPTIONS: { value: ProgramInquiryType; label: string }[] =
  INTRO_INQUIRY_TYPES.map((item) => ({ value: item.value, label: item.label }))

export function programInquiryStatusLabel(status: string): string {
  return PROGRAM_INQUIRY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

export function programInquiryTypeLabel(type: string): string {
  return PROGRAM_INQUIRY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

export function programInquiryContactTimeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return INTRO_CONTACT_TIMES.find((o) => o.value === value)?.label ?? value
}

export function truncateMessage(message: string, max = 80): string {
  const t = String(message ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}
