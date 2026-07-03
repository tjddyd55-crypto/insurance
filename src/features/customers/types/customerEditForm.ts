import type { CustomerCarFormItem } from './customerCarForm'

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
  medical: string
  insuranceHistory: string
  /** 계좌번호 — notes.jsonb.accountNumber 로 저장(자유 텍스트) */
  accountNumber: string
  cars: CustomerCarFormItem[]
  crmExtensionFields: Record<string, string>
  /** 유입 경로 — 빈 문자열은 미지정 */
  inflowSource: string
  /** 유입 경로가 소개일 때 소개자 이름 */
  referrerName: string
}