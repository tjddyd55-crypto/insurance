export type CustomerCarFormItem = {
  id?: number
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
  /** 보험회사(자유 입력, 선택) */
  insuranceCompany?: string
  carType?: string
  memo?: string
  isPrimary?: boolean
}
