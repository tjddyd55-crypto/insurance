import {
  createInsuranceContact,
  deleteInsuranceContact,
  updateInsuranceContact,
} from '../api/contactsApi'
import type { InsuranceContact, InsuranceContactCategory } from '../domain/types'
import type { InsuranceCompanyContactDraft } from '../../company-registry/domain/types'

export type PersonalRegistryContactDraft = InsuranceCompanyContactDraft & {
  personalContactId?: string
  description?: string
}

export async function savePersonalRegistryContacts(
  token: string,
  category: InsuranceContactCategory,
  companyName: string,
  drafts: PersonalRegistryContactDraft[],
  existing: InsuranceContact[],
): Promise<void> {
  const company = companyName.trim()
  if (!company) {
    throw new Error('보험사를 선택하세요.')
  }

  const normalizedDrafts = drafts
    .map((row) => ({
      personalContactId: row.personalContactId?.trim() || '',
      name: row.name.trim(),
      position: row.position.trim(),
      phone: row.phone.trim(),
      description: row.description?.trim() ?? '',
    }))
    .filter((row) => row.name && row.phone)

  const existingForCompany = existing.filter(
    (row) => row.category === category && row.companyName.trim() === company,
  )
  const keptIds = new Set<string>()

  for (const draft of normalizedDrafts) {
    const payload = {
      category,
      companyName: company,
      managerName: draft.name,
      position: draft.position,
      phoneNumber: draft.phone,
      description: draft.description,
    }
    if (draft.personalContactId) {
      await updateInsuranceContact(draft.personalContactId, payload, token, { personal: true })
      keptIds.add(draft.personalContactId)
      continue
    }
    const created = await createInsuranceContact(payload, token, { personal: true })
    keptIds.add(created.id)
  }

  for (const row of existingForCompany) {
    if (!keptIds.has(row.id)) {
      await deleteInsuranceContact(row.id, token, '연락처 삭제', { personal: true })
    }
  }
}

export function personalContactsToDrafts(rows: InsuranceContact[]): PersonalRegistryContactDraft[] {
  if (rows.length === 0) {
    return [{ name: '', position: '', phone: '' }]
  }
  return rows.map((row) => ({
    personalContactId: row.id,
    name: row.managerName,
    position: row.position,
    phone: row.phoneNumber,
    description: '',
  }))
}
