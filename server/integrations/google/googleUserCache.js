/**
 * Google 조회 캐시. 키는 항상 사용자 id 로 시작한다.
 * 예: google-events:{userId}:{calendarId}:{timeMin}:{timeMax}, google-calendars:{userId},
 *     google-tasklists:{userId}, google-tasks:{userId}:{taskListId}:{range}:{status}
 * 사용자 id 없는 키(예: google-events:2026-10)는 만들지 않는다.
 */

const TTL_MS = 60 * 1000
const MAX_ENTRIES = 500

const KINDS = ['google-events', 'google-calendars', 'google-tasklists', 'google-tasks']

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const store = new Map()

/**
 * @param {'google-events' | 'google-calendars' | 'google-tasklists' | 'google-tasks'} kind
 * @param {string} userId
 * @param {string[]} [parts]
 */
export function googleCacheKey(kind, userId, parts = []) {
  const owner = String(userId ?? '').trim()
  if (!owner) {
    throw new Error('google_cache_owner_required')
  }
  if (!KINDS.includes(kind)) {
    throw new Error('google_cache_kind_unknown')
  }
  return [kind, owner, ...parts].join(':')
}

/**
 * @param {string} key
 * @param {number} [now]
 */
export function readGoogleCache(key, now = Date.now()) {
  const entry = store.get(key)
  if (!entry) {
    return undefined
  }
  if (entry.expiresAt <= now) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} [now]
 */
export function writeGoogleCache(key, value, now = Date.now()) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  store.set(key, { expiresAt: now + TTL_MS, value })
}

/**
 * 연결·교체·해제·재인증 필요 시 그 사용자 캐시만 지운다.
 * @param {string} userId
 */
export function clearGoogleUserCache(userId) {
  const owner = String(userId ?? '').trim()
  if (!owner) return
  const prefixes = KINDS.map((kind) => `${kind}:${owner}`)
  for (const key of [...store.keys()]) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
      store.delete(key)
    }
  }
}

export function googleCacheKeysForTest() {
  return [...store.keys()]
}

export function resetGoogleCacheForTest() {
  store.clear()
}
