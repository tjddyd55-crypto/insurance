import { buildAdvisorContactHref, inferAdvisorContactType, type AdvisorContactType } from './advisorContactLink'
import { formatKrPhoneNumberForDisplay } from './formatKrPhoneNumber'
import { parseCareerDisplayLines } from './parseCareerDisplayLines'

export type AdvisorPublicInfoBlock = {
  label: string
  value?: string
  displayValue?: string
  copyText?: string
  copyable?: boolean
  lines?: string[]
  href?: string
  external?: boolean
}

function contactFact(
  label: string,
  value: string,
  type: AdvisorContactType,
  options?: { displayValue?: string; copyable?: boolean },
): AdvisorPublicInfoBlock | null {
  const v = value.trim()
  if (!v) return null
  const link = buildAdvisorContactHref(v, type)
  const display = options?.displayValue ?? v
  return {
    label,
    value: v,
    displayValue: display,
    copyText: display,
    copyable: options?.copyable ?? true,
    ...link,
  }
}

export function buildAdvisorPublicInfoBlocks(input: {
  gaName?: string | null
  teamName?: string | null
  careerText?: string | null
  officeLine?: string | null
  publicPhone?: string | null
  showPublicPhone?: boolean | null
  publicFax?: string | null
  showPublicFax?: boolean | null
  publicEmail?: string | null
  showPublicEmail?: boolean | null
  customContacts?: Array<{
    label: string
    value: string
    contactType?: AdvisorContactType | string | null
    isVisible?: boolean | null
  }>
}): AdvisorPublicInfoBlock[] {
  const blocks: AdvisorPublicInfoBlock[] = []
  const affiliation = [input.gaName, input.teamName].filter(Boolean).join(' ')
  if (affiliation) blocks.push({ label: '소속', value: affiliation })
  const careerLines = parseCareerDisplayLines(
    String(input.careerText ?? ''),
    input.gaName ?? null,
    input.teamName ?? null,
  )
  if (careerLines.length === 1) {
    blocks.push({ label: '경력', value: careerLines[0] })
  } else if (careerLines.length > 1) {
    blocks.push({ label: '경력', lines: careerLines })
  }
  const office = String(input.officeLine ?? '').trim()
  if (office) blocks.push({ label: '사무실', value: office })

  if (input.showPublicPhone !== false) {
    const raw = String(input.publicPhone ?? '')
    const phone = contactFact('전화', raw, 'phone', {
      displayValue: formatKrPhoneNumberForDisplay(raw),
    })
    if (phone) blocks.push(phone)
  }
  if (input.showPublicFax === true) {
    const raw = String(input.publicFax ?? '')
    const fax = contactFact('팩스', raw, 'text', {
      displayValue: formatKrPhoneNumberForDisplay(raw),
    })
    if (fax) blocks.push(fax)
  }
  if (input.showPublicEmail === true) {
    const email = contactFact('이메일', String(input.publicEmail ?? ''), 'email')
    if (email) blocks.push(email)
  }

  for (const row of input.customContacts ?? []) {
    if (row.isVisible === false) continue
    const label = String(row.label ?? '').trim()
    const value = String(row.value ?? '').trim()
    if (!label || !value) continue
    const type = (row.contactType as AdvisorContactType) || inferAdvisorContactType(value)
    const displayValue = type === 'phone' ? formatKrPhoneNumberForDisplay(value) : value
    const fact = contactFact(label, value, type, { displayValue })
    if (fact) blocks.push(fact)
  }

  return blocks
}
