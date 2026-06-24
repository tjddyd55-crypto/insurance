/** @typedef {{ name?: string; position?: string; phone?: string }} HistoryContactLine */

export function normalizeHistoryText(value) {
  return String(value ?? '').trim()
}

export function normalizeHistoryPhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isHistoryTextChanged(beforeVal, afterVal) {
  return normalizeHistoryText(beforeVal) !== normalizeHistoryText(afterVal)
}

export function isHistoryPhoneChanged(beforeVal, afterVal) {
  return normalizeHistoryPhone(beforeVal) !== normalizeHistoryPhone(afterVal)
}

export function contactRoleKey(position) {
  return normalizeHistoryText(position)
}

/**
 * 직책(position) 기준으로 before/after 담당자를 매칭한다.
 * @param {HistoryContactLine[]} beforeContacts
 * @param {HistoryContactLine[]} afterContacts
 */
export function pairHistoryContacts(beforeContacts, afterContacts) {
  const before = Array.isArray(beforeContacts) ? beforeContacts : []
  const after = Array.isArray(afterContacts) ? afterContacts : []

  const beforeByRole = new Map()
  for (const row of before) {
    const key = contactRoleKey(row.position)
    if (key && !beforeByRole.has(key)) {
      beforeByRole.set(key, row)
    }
  }

  /** @type {Array<{ before: HistoryContactLine; after: HistoryContactLine; isNew: boolean }>} */
  const pairs = []
  const matchedBeforeKeys = new Set()

  for (const afterRow of after) {
    const afterPos = normalizeHistoryText(afterRow.position)
    const afterName = normalizeHistoryText(afterRow.name)
    const afterPhone = normalizeHistoryText(afterRow.phone)
    if (!afterPos && !afterName && !afterPhone) {
      continue
    }

    const key = contactRoleKey(afterRow.position)
    const beforeRow = key ? beforeByRole.get(key) : undefined
    if (key && beforeRow) {
      matchedBeforeKeys.add(key)
    }

    pairs.push({
      before: beforeRow ?? { position: afterRow.position ?? '', name: '', phone: '' },
      after: afterRow,
      isNew: !beforeRow,
    })
  }

  for (const [key, beforeRow] of beforeByRole) {
    if (matchedBeforeKeys.has(key)) {
      continue
    }
    const beforePos = normalizeHistoryText(beforeRow.position)
    const beforeName = normalizeHistoryText(beforeRow.name)
    const beforePhone = normalizeHistoryText(beforeRow.phone)
    if (!beforePos && !beforeName && !beforePhone) {
      continue
    }
    pairs.push({
      before: beforeRow,
      after: { position: beforeRow.position ?? '', name: '', phone: '' },
      isNew: false,
    })
  }

  pairs.sort((left, right) => {
    const leftKey = contactRoleKey(left.after.position || left.before.position)
    const rightKey = contactRoleKey(right.after.position || right.before.position)
    return leftKey.localeCompare(rightKey, 'ko')
  })

  return pairs
}

/**
 * @param {HistoryContactLine} beforeRow
 * @param {HistoryContactLine} afterRow
 * @param {{ isNew?: boolean }} [options]
 */
export function isHistoryContactFieldChanged(field, beforeRow, afterRow, options = {}) {
  const isNew = Boolean(options.isNew)
  if (field === 'phone') {
    if (isNew) {
      return Boolean(normalizeHistoryPhone(afterRow.phone))
    }
    return isHistoryPhoneChanged(beforeRow.phone, afterRow.phone)
  }
  if (field === 'name') {
    if (isNew) {
      return Boolean(normalizeHistoryText(afterRow.name))
    }
    return isHistoryTextChanged(beforeRow.name, afterRow.name)
  }
  if (field === 'position') {
    if (isNew) {
      return Boolean(normalizeHistoryText(afterRow.position))
    }
    return isHistoryTextChanged(beforeRow.position, afterRow.position)
  }
  return false
}
