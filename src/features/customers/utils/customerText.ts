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

  const text = `
-이름: ${name}
-주민번호: ${ssn}
-통신사/핸드폰번호: ${carrier}/${phone}
-주소: ${address}
-키/몸무게: ${height}/${weight}
-직업/회사명/하는일/지역: ${job}
-운전여부: ${driving}

-5년안에 병원에서 진단이나 수술, 치료 받으신적 있으신가요?
${medical}
`
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
