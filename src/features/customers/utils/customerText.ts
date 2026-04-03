import type { CustomerRecord } from '../domain/types'
import { calculateInsuranceInfo, formatDateYmdInput } from './insuranceInfo'

function resolveInsuranceSnapshot(data: Partial<CustomerRecord>) {
  const storedAge = data.insuranceAge
  const storedNext = data.nextAgeDate
  if (storedAge != null && storedNext) {
    return { age: storedAge, nextYmd: formatDateYmdInput(storedNext) }
  }
  const fromRrn = calculateInsuranceInfo(String(data.ssn ?? ''))
  const ymd = fromRrn.nextAgeDate
    ? `${fromRrn.nextAgeDate.getFullYear()}-${fromRrn.nextAgeDate.getMonth() + 1}-${fromRrn.nextAgeDate.getDate()}`
    : null
  if (fromRrn.age != null && ymd) {
    return { age: fromRrn.age, nextYmd: ymd }
  }
  return { age: null as number | null, nextYmd: null as string | null }
}

function genderLabel(g: CustomerRecord['gender']): string {
  if (g === 'male') {
    return '남'
  }
  if (g === 'female') {
    return '여'
  }
  return '확인 필요'
}

export function generateCustomerText(data: Partial<CustomerRecord> | Record<string, unknown>) {
  const name = String(data.name ?? '')
  const gender = (data as Partial<CustomerRecord>).gender
  const notes = Array.isArray((data as Partial<CustomerRecord>).notes)
    ? ((data as Partial<CustomerRecord>).notes as CustomerRecord['notes'])
    : []

  const isDriver = (data as Partial<CustomerRecord>).isDriver
  const carType = String((data as Partial<CustomerRecord>).carType ?? '').trim()

  const { age, nextYmd } = resolveInsuranceSnapshot(data as Partial<CustomerRecord>)

  const insuranceLine =
    age != null && nextYmd
      ? `${age}세 (상령일: ${formatDateYmdInput(nextYmd)})`
      : '확인 필요'

  const driverLine =
    isDriver === true
      ? `운전함${carType ? ` (${carType})` : ''}`
      : isDriver === false
        ? '운전 안함'
        : '확인 필요'

  const memoBlock = notes.length > 0 ? notes.map((n) => `- ${n.content}`).join('\n') : ''

  const text = `
이름: ${name}
성별: ${genderLabel(gender ?? null)}
보험나이: ${insuranceLine}
운전여부: ${driverLine}

[메모]
${memoBlock}
`
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
