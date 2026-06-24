/** @typedef {{ name?: string; position?: string; phone?: string; displayOrder?: number; sortOrder?: number; orderIndex?: number; positionOrder?: number; sequence?: number; id?: number }} HistoryContactLine */

const STAFF_ORDER_FIELD_KEYS = ['displayOrder', 'sortOrder', 'orderIndex', 'positionOrder', 'sequence']

export function getStaffContactOrder(row) {
  if (!row || typeof row !== 'object') {
    return null
  }
  for (const key of STAFF_ORDER_FIELD_KEYS) {
    const value = Number(row[key])
    if (Number.isFinite(value)) {
      return value
    }
  }
  return null
}

/**
 * staff 입력/저장 순서 기준 정렬. 직책명 정렬은 하지 않는다.
 * @param {HistoryContactLine[]} rows
 */
export function sortCompanyContactsByInputOrder(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftOrder = getStaffContactOrder(left.row)
      const rightOrder = getStaffContactOrder(right.row)
      if (leftOrder != null && rightOrder != null) {
        return leftOrder - rightOrder
      }
      if (leftOrder != null) {
        return -1
      }
      if (rightOrder != null) {
        return 1
      }
      return left.index - right.index
    })
    .map((entry) => entry.row)
}

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
  const before = sortCompanyContactsByInputOrder(Array.isArray(beforeContacts) ? beforeContacts : [])
  const after = sortCompanyContactsByInputOrder(Array.isArray(afterContacts) ? afterContacts : [])

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

  for (const beforeRow of before) {
    const key = contactRoleKey(beforeRow.position)
    if (key && matchedBeforeKeys.has(key)) {
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

/** @typedef {{
 *   id?: string | number
 *   companyId?: string
 *   companyName?: string
 *   category?: string
 *   updatedAt?: string
 *   savedAt?: string
 *   before?: unknown
 *   after?: unknown
 * }} CompanyHistoryEntryLike */

/**
 * 화면 표시용 날짜 + 보험회사 그룹 키.
 * @param {CompanyHistoryEntryLike} entry
 */
export function getHistoryCompanyGroupKey(entry) {
  const displayDate = normalizeHistoryText(entry.updatedAt) || '날짜 없음'
  const companyId = normalizeHistoryText(entry.companyId)
  if (companyId) {
    return `${displayDate}:${companyId}`
  }
  const category = normalizeHistoryText(entry.category)
  const companyName = normalizeHistoryText(entry.companyName)
  return `${displayDate}:${category}:${companyName}`
}

/**
 * @param {CompanyHistoryEntryLike} left
 * @param {CompanyHistoryEntryLike} right
 * @returns {number} 양수면 left가 더 최신
 */
export function compareHistoryEntryRecency(left, right) {
  const leftTime = new Date(left.savedAt ?? left.updatedAt ?? 0).getTime()
  const rightTime = new Date(right.savedAt ?? right.updatedAt ?? 0).getTime()
  if (leftTime !== rightTime) {
    return leftTime - rightTime
  }
  return Number(left.id ?? 0) - Number(right.id ?? 0)
}

/**
 * @param {CompanyHistoryEntryLike[]} entries
 */
export function pickLatestHistoryEntry(entries) {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) {
    return null
  }
  return [...list].sort((left, right) => compareHistoryEntryRecency(right, left))[0]
}

/**
 * 같은 날짜 + 같은 보험회사 이력은 최신 저장본 1건만 남긴다. DB 원본은 변경하지 않는다.
 * @param {CompanyHistoryEntryLike[]} entries
 */
export function collapseCompanyHistoryByDateAndCompany(entries) {
  const list = Array.isArray(entries) ? entries : []
  const latestByGroup = new Map()

  for (const entry of list) {
    const key = getHistoryCompanyGroupKey(entry)
    const prev = latestByGroup.get(key)
    if (!prev || compareHistoryEntryRecency(entry, prev) > 0) {
      latestByGroup.set(key, entry)
    }
  }

  return [...latestByGroup.values()].sort((left, right) => {
    const dateCmp = (right.updatedAt || '').localeCompare(left.updatedAt || '')
    if (dateCmp !== 0) {
      return dateCmp
    }
    const timeCmp = compareHistoryEntryRecency(right, left)
    if (timeCmp !== 0) {
      return timeCmp
    }
    return normalizeHistoryText(left.companyName).localeCompare(
      normalizeHistoryText(right.companyName),
      'ko',
    )
  })
}
