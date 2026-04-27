export type CustomerEditFormState = {
  name: string
  gender: 'male' | 'female' | null
  ssn: string
  phone: string
  address: string
  addressDetail: string
  zonecode: string
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
