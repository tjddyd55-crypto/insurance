/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseContractFileId(value) {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) {
    return null
  }
  return raw
}

/**
 * 전자서명 발송 세션 삭제 시 storage에서 제거할 key를 수집한다.
 * 고객 원본 파일(세션과 무관한 path)은 포함하지 않는다.
 *
 * @param {string} sessionId
 * @param {string[]} filePaths
 * @returns {string[]}
 */
export function collectContractSendSessionStorageKeys(sessionId, filePaths) {
  /** @type {Set<string>} */
  const keys = new Set()
  const sid = String(sessionId ?? '').trim()
  if (!sid) {
    return []
  }
  const sessionPrefix = `contracts/${sid}/`

  const pushKey = (raw) => {
    const key = String(raw ?? '').trim()
    if (!key) {
      return
    }
    if (key.startsWith(sessionPrefix) || key.startsWith('contracts/send-attachments/')) {
      keys.add(key)
    }
  }

  for (const path of filePaths ?? []) {
    pushKey(path)
  }

  return [...keys]
}

/**
 * @param {unknown} rows
 * @returns {string[]}
 */
export function collectContractFileIdsFromRows(rows) {
  /** @type {Set<string>} */
  const ids = new Set()
  for (const row of rows ?? []) {
    for (const key of Object.keys(row ?? {})) {
      const parsed = parseContractFileId(row[key])
      if (parsed) {
        ids.add(parsed)
      }
    }
  }
  return [...ids]
}
