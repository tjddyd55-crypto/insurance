export interface CustomerNote {
  id: string
  content: string
  createdAt: string
}

export interface CustomerRecord {
  id: number
  userId: string
  name: string
  ssn: string
  /** null: 미선택·구데이터 */
  gender: 'male' | 'female' | null
  insuranceAge: number | null
  /** YYYY-MM-DD */
  nextAgeDate: string | null
  isDriver: boolean | null
  /** 운전 시 차종 (자유 입력) */
  carType: string
  notes: CustomerNote[]
  phone: string
  /** 레거시: 신규 저장 시 사용 안 함 */
  carrier: string
  address: string
  height: string
  weight: string
  job: string
  driving: string
  medical: string
  carNumber: string
  carModel: string
  carYear: string
  /** YYYY-MM-DD 만기·갱신 예정일 */
  renewalDate: string
  createdAt: string
}
