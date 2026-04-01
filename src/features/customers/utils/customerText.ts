import type { CustomerRecord } from '../domain/types'

export function generateCustomerText(data: Partial<CustomerRecord> | Record<string, unknown>) {
  const name = String(data.name ?? '')
  const ssn = String(data.ssn ?? '')
  const carrier = String(data.carrier ?? '')
  const phone = String(data.phone ?? '')
  const address = String(data.address ?? '')
  const height = String(data.height ?? '')
  const weight = String(data.weight ?? '')
  const job = String(data.job ?? '')
  const driving = String(data.driving ?? '')
  const medical = String(data.medical ?? '')
  const carNumber = String(data.carNumber ?? (data as Record<string, unknown>).car_number ?? '')
  const carModel = String(data.carModel ?? (data as Record<string, unknown>).car_model ?? '')
  const carYear = String(data.carYear ?? (data as Record<string, unknown>).car_year ?? '')
  const renewalDate = String(data.renewalDate ?? (data as Record<string, unknown>).renewal_date ?? '')

  const text = `
-이름: ${name}
-주민번호: ${ssn}
-통신사/핸드폰번호: ${carrier}/${phone}
-주소: ${address}
-키/몸무게: ${height}/${weight}
-직업/회사명/하는일/지역: ${job}
-운전여부: ${driving}
-차량번호: ${carNumber}
-차종/연식: ${carModel} / ${carYear}
-만기(갱신)일: ${renewalDate}

-5년안에 병원에서 진단이나 수술, 치료 받으신적 있으신가요?
${medical}
`
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
