import { consentGetBuffer, getR2PublicCdnBase, isR2ObjectNotFoundError } from './consentStorage.js'
import { stripR2ObjectRootIfPresent, withR2ObjectRoot } from './r2KeyPolicy.js'

const STORAGE_FILE_READ_USER_MESSAGE =
  '파일 위치를 확인할 수 없습니다. 관리자에게 문의해 주세요.'

/**
 * @param {string} raw
 * @returns {string[]}
 */
function extractObjectKeysFromHttpUrl(raw) {
  const u = String(raw ?? '').trim()
  if (!/^https?:\/\//i.test(u)) {
    return []
  }
  /** @type {string[]} */
  const keys = []
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  if (base && u.startsWith(`${base}/`)) {
    keys.push(u.slice(base.length + 1).replace(/^\//, ''))
  }
  try {
    const pathname = new URL(u).pathname.replace(/^\//, '')
    if (pathname) {
      keys.push(pathname)
    }
  } catch {
    /* ignore malformed URL */
  }
  return keys
}

/**
 * DB file_path 등에서 R2 조회용 object key 후보 목록(중복 제거, 우선순위 유지).
 * @param {string | null | undefined} filePathRaw
 * @returns {string[]}
 */
export function collectStorageFileObjectKeyCandidates(filePathRaw) {
  const raw = String(filePathRaw ?? '').trim()
  if (!raw || /^file:\/\//i.test(raw)) {
    return []
  }

  /** @type {Set<string>} */
  const seeds = new Set()
  if (/^https?:\/\//i.test(raw)) {
    for (const key of extractObjectKeysFromHttpUrl(raw)) {
      if (key) {
        seeds.add(key)
      }
    }
  } else {
    seeds.add(raw.replace(/^\//, ''))
  }

  /** @type {string[]} */
  const candidates = []
  const seen = new Set()

  const push = (key) => {
    const norm = String(key ?? '').trim().replace(/^\//, '')
    if (!norm || norm.includes('..') || seen.has(norm)) {
      return
    }
    seen.add(norm)
    candidates.push(norm)
  }

  for (const seed of seeds) {
    push(seed)
    push(withR2ObjectRoot(seed))
    const stripped = stripR2ObjectRootIfPresent(seed)
    push(stripped)
    push(withR2ObjectRoot(stripped))
  }

  return candidates
}

/**
 * 단일 후보(기존 resolveStorageFileObjectKey 호환).
 * @param {string | null | undefined} filePath
 */
export function resolveStorageFileObjectKey(filePath) {
  const candidates = collectStorageFileObjectKeyCandidates(filePath)
  return candidates.length > 0 ? candidates[0] : null
}

/**
 * 후보 키를 순서대로 R2/로컬에서 읽는다. NotFound만 다음 후보로 넘긴다.
 * @param {string | null | undefined} filePathRaw
 */
export async function readStorageFileBufferFromPath(filePathRaw) {
  const candidates = collectStorageFileObjectKeyCandidates(filePathRaw)
  if (candidates.length === 0) {
    const err = new Error(STORAGE_FILE_READ_USER_MESSAGE)
    err.code = 'STORAGE_FILE_KEY_MISSING'
    throw err
  }

  let lastError = null
  for (const key of candidates) {
    try {
      return await consentGetBuffer(key)
    } catch (e) {
      lastError = e
      if (isR2ObjectNotFoundError(e)) {
        continue
      }
      throw e
    }
  }

  const err = new Error(STORAGE_FILE_READ_USER_MESSAGE)
  err.code = 'STORAGE_FILE_NOT_FOUND'
  if (lastError && typeof lastError === 'object') {
    err.cause = lastError
  }
  throw err
}

export { STORAGE_FILE_READ_USER_MESSAGE }
