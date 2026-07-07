import type { SmsBulkSearchCustomer, SmsRecipientAddResult, SmsSelectedRecipient } from '../types/smsBulkRecipient.types'

function normalizePhone(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '')
}

export function mergeSmsRecipientSelections(
  existing: SmsSelectedRecipient[],
  incoming: SmsBulkSearchCustomer[],
): { recipients: SmsSelectedRecipient[]; result: SmsRecipientAddResult } {
  const seenCustomerIds = new Set(existing.map((item) => item.customerId))
  const seenPhones = new Set(existing.map((item) => normalizePhone(item.phone)).filter(Boolean))

  const skipped = {
    already_added: 0,
    duplicate_phone: 0,
    no_phone: 0,
    invalid_phone: 0,
    opt_out: 0,
  }
  const added: SmsSelectedRecipient[] = []

  for (const item of incoming) {
    if (seenCustomerIds.has(item.customerId)) {
      skipped.already_added += 1
      continue
    }
    const phone = normalizePhone(item.phone)
    if (phone && seenPhones.has(phone)) {
      skipped.duplicate_phone += 1
      continue
    }

    if (!phone) {
      skipped.no_phone += 1
    } else if (item.blockedReason === 'invalid_phone') {
      skipped.invalid_phone += 1
    } else if (item.blockedReason === 'opt_out') {
      skipped.opt_out += 1
    }

    seenCustomerIds.add(item.customerId)
    if (phone) {
      seenPhones.add(phone)
    }
    added.push({ ...item })
  }

  return {
    recipients: [...existing, ...added],
    result: { addedCount: added.length, skipped },
  }
}

export function mergeCustomerIdsForGroup(
  existingIds: number[],
  incomingIds: number[],
): { mergedIds: number[]; addedCount: number; alreadyInGroup: number } {
  const seen = new Set(existingIds)
  const merged = [...existingIds]
  let addedCount = 0
  let alreadyInGroup = 0

  for (const rawId of incomingIds) {
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0) {
      continue
    }
    if (seen.has(id)) {
      alreadyInGroup += 1
      continue
    }
    seen.add(id)
    merged.push(id)
    addedCount += 1
  }

  return { mergedIds: merged, addedCount, alreadyInGroup }
}
