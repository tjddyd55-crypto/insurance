import { fullSaveCompanyDirectory } from '../api/companyRegistryApi'
import {
  savePersonalRegistryContacts,
  type PersonalRegistryContactDraft,
} from '../../contacts/utils/savePersonalRegistryContacts'
import type { InsuranceContact } from '../../contacts/domain/types'
import type { ContactCompanyCardDraft } from '../domain/contactCardWorkspaceModel'
import { isPersistedDirectoryCompanyCode } from '../domain/companyCode'
import { normalizePhoneNumber } from '../../contacts/utils/phone'

function normalizeCompanyName(value: string): string {
  return String(value ?? '').trim().normalize('NFKC')
}

/** GA 기존 카드: full-save는 동일 마스터를 덮어쓰므로 종류·회사 변경은 차단한다. */
export function isGaExistingCardMetadataChangeBlocked(
  baseline: ContactCompanyCardDraft | undefined,
  draft: ContactCompanyCardDraft,
): boolean {
  if (draft.isNew || draft.markedForDeletion) {
    return false
  }
  if (!baseline) {
    return false
  }
  return (
    baseline.category !== draft.category ||
    baseline.companyCode.trim() !== draft.companyCode.trim() ||
    normalizeCompanyName(baseline.companyName) !== normalizeCompanyName(draft.companyName)
  )
}

export type CardSaveResult = {
  cardKey: string
  companyName: string
  ok: boolean
  message?: string
}

function validateContactRows(draft: ContactCompanyCardDraft): string | null {
  if (draft.markedForDeletion) return null
  if (draft.isNew && !draft.companyCode.trim()) {
    return '보험회사를 선택하세요.'
  }
  const rows = draft.contacts.filter((row) => row.name.trim() || row.phone.trim() || row.position.trim())
  for (const row of rows) {
    if (!row.name.trim() || !row.phone.trim()) {
      return `${draft.companyName}: 담당자명과 전화번호를 입력하세요.`
    }
    if (!normalizePhoneNumber(row.phone).trim()) {
      return `${draft.companyName}: 전화번호 형식을 확인하세요.`
    }
  }
  if (!draft.markedForDeletion && !draft.isNew && rows.length === 0) {
    return null
  }
  if (draft.isNew && rows.length === 0) {
    return `${draft.companyName}: 담당자를 1명 이상 입력하세요.`
  }
  return null
}

export async function saveGaContactCardDraft(
  token: string,
  draft: ContactCompanyCardDraft,
): Promise<void> {
  const contactsPayload = draft.markedForDeletion
    ? []
    : draft.contacts
        .filter((row) => row.name.trim() && row.phone.trim())
        .map((row) => ({
          name: row.name.trim(),
          position: row.position.trim(),
          phone: normalizePhoneNumber(row.phone),
        }))

  const companyCode = draft.companyCode.trim()
  const companyId =
    draft.companyId != null && isPersistedDirectoryCompanyCode(companyCode) ? draft.companyId : undefined

  await fullSaveCompanyDirectory(
    {
      company: {
        ...(companyId != null ? { id: companyId } : {}),
        companyCode,
        category: draft.category,
        name: draft.companyName.trim(),
        customerCenter: draft.customerCenter.trim(),
        systemPhone: draft.systemPhone.trim(),
        incallNumber: draft.incallNumber.trim(),
        visitInfo: draft.visitInfo.trim(),
      },
      contacts: contactsPayload,
    },
    token,
  )
}

export async function savePersonalContactCardDraft(
  token: string,
  draft: ContactCompanyCardDraft,
  allPersonalContacts: InsuranceContact[],
): Promise<void> {
  const registryDrafts: PersonalRegistryContactDraft[] = draft.markedForDeletion
    ? []
    : draft.contacts
        .filter((row) => row.name.trim() && row.phone.trim())
        .map((row) => ({
          personalContactId: row.personalContactId,
          name: row.name.trim(),
          position: row.position.trim(),
          phone: normalizePhoneNumber(row.phone),
          description: '',
        }))

  await savePersonalRegistryContacts(
    token,
    draft.category,
    draft.companyName.trim(),
    registryDrafts.length ? registryDrafts : [],
    allPersonalContacts,
  )
}

export async function saveContactCardWorkspace(params: {
  token: string
  mode: 'ga' | 'personal'
  drafts: ContactCompanyCardDraft[]
  baseline: ContactCompanyCardDraft[]
  personalContacts: InsuranceContact[]
}): Promise<CardSaveResult[]> {
  const { token, mode, drafts, baseline, personalContacts } = params
  const baselineMap = new Map(baseline.map((card) => [card.cardKey, card]))
  const results: CardSaveResult[] = []

  for (const draft of drafts) {
    if (draft.isNew && draft.markedForDeletion) {
      continue
    }
    const base = baselineMap.get(draft.cardKey)
    const serialized = JSON.stringify(draft)
    const baseSerialized = base ? JSON.stringify(base) : ''
    if (!draft.isNew && !draft.markedForDeletion && serialized === baseSerialized) {
      continue
    }

    if (mode === 'ga' && isGaExistingCardMetadataChangeBlocked(base, draft)) {
      results.push({
        cardKey: draft.cardKey,
        companyName: draft.companyName,
        ok: false,
        message:
          `${draft.companyName}: 기존 GA 보험회사 카드의 보험 종류·보험회사는 이 화면에서 변경할 수 없습니다. 담당자만 수정하세요.`,
      })
      continue
    }

    const validationError = validateContactRows(draft)
    if (validationError) {
      results.push({ cardKey: draft.cardKey, companyName: draft.companyName, ok: false, message: validationError })
      continue
    }

    try {
      if (mode === 'ga') {
        await saveGaContactCardDraft(token, draft)
      } else {
        await savePersonalContactCardDraft(token, draft, personalContacts)
      }
      results.push({ cardKey: draft.cardKey, companyName: draft.companyName, ok: true })
    } catch (error) {
      results.push({
        cardKey: draft.cardKey,
        companyName: draft.companyName,
        ok: false,
        message: error instanceof Error ? error.message : '저장에 실패했습니다.',
      })
    }
  }

  return results
}

function cloneDrafts(cards: ContactCompanyCardDraft[]): ContactCompanyCardDraft[] {
  return JSON.parse(JSON.stringify(cards)) as ContactCompanyCardDraft[]
}

/** 부분 저장 성공 시 baseline·draft를 맞춰 재시도 시 성공 카드를 다시 API에 보내지 않는다. */
export function applySuccessfulCardSaves(
  baseline: ContactCompanyCardDraft[],
  drafts: ContactCompanyCardDraft[],
  results: CardSaveResult[],
): { baseline: ContactCompanyCardDraft[]; drafts: ContactCompanyCardDraft[] } {
  const okKeys = new Set(results.filter((row) => row.ok).map((row) => row.cardKey))
  if (okKeys.size === 0) {
    return { baseline: cloneDrafts(baseline), drafts: cloneDrafts(drafts) }
  }

  let nextBaseline = cloneDrafts(baseline)
  let nextDrafts = cloneDrafts(drafts)

  for (const cardKey of okKeys) {
    const draft = nextDrafts.find((row) => row.cardKey === cardKey)
    if (!draft) continue
    if (draft.markedForDeletion) {
      nextBaseline = nextBaseline.filter((row) => row.cardKey !== cardKey)
      nextDrafts = nextDrafts.filter((row) => row.cardKey !== cardKey)
      continue
    }
    const saved = cloneDrafts([{ ...draft, isNew: false, markedForDeletion: false }])[0]
    const baseIndex = nextBaseline.findIndex((row) => row.cardKey === cardKey)
    if (baseIndex >= 0) {
      nextBaseline[baseIndex] = saved
    } else {
      nextBaseline.push(saved)
    }
    const draftIndex = nextDrafts.findIndex((row) => row.cardKey === cardKey)
    if (draftIndex >= 0) {
      nextDrafts[draftIndex] = saved
    }
  }

  return { baseline: nextBaseline, drafts: nextDrafts }
}

export function formatSaveResultsMessage(results: CardSaveResult[]): string {
  if (results.length === 0) {
    return '변경된 내용이 없습니다.'
  }
  const failed = results.filter((row) => !row.ok)
  const succeeded = results.filter((row) => row.ok)
  if (failed.length === 0) {
    return `${succeeded.length}개 보험사 연락처를 저장했습니다.`
  }
  if (succeeded.length === 0) {
    return failed.map((row) => row.message ?? `${row.companyName} 저장 실패`).join('\n')
  }
  return `${succeeded.length}개 저장, ${failed.length}개 실패: ${failed.map((row) => row.message ?? row.companyName).join('; ')}`
}
