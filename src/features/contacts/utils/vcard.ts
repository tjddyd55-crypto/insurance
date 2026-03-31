import type { InsuranceContact } from '../domain/types'
import { normalizePhoneNumber } from './phone'

export function createVCardContent(contact: InsuranceContact): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.managerName}`,
    `N:${contact.managerName};;;`,
    `ORG:${contact.companyName}`,
    contact.position ? `TITLE:${contact.position}` : '',
    `TEL;TYPE=CELL:${normalizePhoneNumber(contact.phoneNumber)}`,
    'END:VCARD',
  ].filter(Boolean)

  return `${lines.join('\r\n')}\r\n`
}
