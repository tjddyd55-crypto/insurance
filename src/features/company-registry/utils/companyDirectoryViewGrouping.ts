import type { CompanyDirectoryEntry } from '../domain/types'

/** 조회·편집 SSOT: 보험회사 마스터(`id`)당 카드 1개. 동일 id 중복 행은 담당자만 병합한다. */
export function groupCompanyDirectoryEntriesByMasterId(
  entries: CompanyDirectoryEntry[],
): CompanyDirectoryEntry[] {
  const byId = new Map<number, CompanyDirectoryEntry>()

  for (const entry of entries) {
    const id = entry.id
    const existing = byId.get(id)
    if (!existing) {
      byId.set(id, {
        ...entry,
        contacts: [...(entry.contacts ?? [])],
      })
      continue
    }

    const mergedContacts = [...(existing.contacts ?? [])]
    const seenContactIds = new Set(
      mergedContacts.map((row) => row.id).filter((contactId) => contactId != null),
    )
    for (const person of entry.contacts ?? []) {
      if (person.id != null && seenContactIds.has(person.id)) {
        continue
      }
      mergedContacts.push(person)
      if (person.id != null) {
        seenContactIds.add(person.id)
      }
    }
    byId.set(id, {
      ...existing,
      contacts: mergedContacts,
    })
  }

  return Array.from(byId.values())
}
