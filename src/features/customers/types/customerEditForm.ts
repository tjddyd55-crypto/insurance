import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import type { CustomerCarFormItem } from './customerCarForm'
import type { CustomerFireInsuranceLocationFormItem } from './customerFireInsuranceLocationForm'
import type { CustomerSpecialDateFormItem } from './customerSpecialDateForm'
import type { CustomerCustomFieldFormItem } from './customerCustomFieldForm'

export type CustomerEditFormState = {
  name: string
  gender: 'male' | 'female' | null
  ssn: string
  phone: string
  carrier: string
  birthDate: string
  address: string
  addressDetail: string
  zonecode: string
  height: string
  weight: string
  job: string
  isDriver: boolean | null
  /** UI 제거 — 서버 `customers.car_type` 유지용(기존 값 보존) */
  carType: string
  treatmentHistoryNote: string
  medicationHistoryNote: string
  insuranceHistory: string
  /** 계좌번호 — notes.jsonb.accountNumber 로 저장(자유 텍스트) */
  accountNumber: string
  cars: CustomerCarFormItem[]
  businessInfo: CustomerBusinessInfo
  fireInsuranceLocations: CustomerFireInsuranceLocationFormItem[]
  specialDates: CustomerSpecialDateFormItem[]
  customFields: CustomerCustomFieldFormItem[]
  crmExtensionFields: Record<string, string>
  /** 유입 경로 — 빈 문자열은 미지정 */
  inflowSource: string
  /** 유입 경로 상세(소개자·이관한 사람) — referrer_name 재사용 */
  referrerName: string
  /** CRM 문자(단체/예약/자동) 수신거부 */
  smsOptOut: boolean
}