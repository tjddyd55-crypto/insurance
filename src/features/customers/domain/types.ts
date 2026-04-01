export interface CustomerRecord {
  id: number
  userId: string
  name: string
  ssn: string
  phone: string
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
