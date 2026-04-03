import type { CustomerRecord } from '../domain/types'
import { calculateInsuranceInfo, formatDateYmdInput, formatInsuranceUiDate } from './insuranceInfo'

function resolveInsuranceForCopy(data: Partial<CustomerRecord>) {
  const storedAge = data.insuranceAge
  const storedNext = data.nextAgeDate
  if (storedAge != null && storedNext) {
    return {
      age: storedAge,
      dateLabel: formatDateYmdInput(storedNext),
      ok: true,
    }
  }
  const fromRrn = calculateInsuranceInfo(String(data.ssn ?? ''))
  if (fromRrn.age != null && fromRrn.nextAgeDate) {
    return {
      age: fromRrn.age,
      dateLabel: formatInsuranceUiDate(fromRrn.nextAgeDate),
      ok: true,
    }
  }
  return { age: null as number | null, dateLabel: '', ok: false }
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

  const ins = resolveInsuranceForCopy(data as Partial<CustomerRecord>)
  const insuranceLine = ins.ok
    ? `보험나이: ${ins.age}세 · 상령일: ${ins.dateLabel}`
    : '보험나이: 확인 필요 · 상령일: 확인 필요'

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
${insuranceLine}
운전여부: ${driverLine}

[메모]
${memoBlock}
`
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
