/**
 * 테스트 전용: service_integrations / oauth states 를 메모리로 흉내 내는 pool 과 가짜 Google.
 * 운영 코드에서 import 하지 않는다.
 */

export function createFakeIntegrationPool(options = {}) {
  /** @type {Map<string, any>} key = `${user_id}|${provider_key}` */
  const integrations = new Map()
  /** @type {Map<string, any>} */
  const states = new Map()
  const queries = []
  const pool = {
    integrations,
    states,
    queries,
    async query(text, params = []) {
      const sql = String(text).replace(/\s+/g, ' ').trim()
      queries.push({ sql, params })
      if (sql.startsWith('DELETE FROM service_integration_oauth_states WHERE expires_at')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.startsWith('INSERT INTO service_integration_oauth_states')) {
        const [stateHash, bindingHash, userId, providerKey, expiresAt] = params
        states.set(stateHash, { state_hash: stateHash, binding_hash: bindingHash, user_id: userId, provider_key: providerKey, expires_at: expiresAt })
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith('DELETE FROM service_integration_oauth_states WHERE state_hash')) {
        const row = states.get(params[0])
        states.delete(params[0])
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
      }
      if (sql.includes('FROM service_integrations') && sql.startsWith('SELECT')) {
        assertUserScoped(sql)
        const [userId, providerKey] = params
        const rows = [...integrations.values()].filter((row) => row.user_id === userId && (providerKey === undefined || row.provider_key === providerKey))
        return { rows: rows.map((row) => ({ ...row, has_secret: Boolean(row.credential_ciphertext) })), rowCount: rows.length }
      }
      if (sql.startsWith('INSERT INTO service_integrations')) {
        const [userId, providerKey, ciphertext, publicConfig, email] = params
        if (!userId) throw new Error('owner invariant: user_id required')
        const key = `${userId}|${providerKey}`
        const previous = integrations.get(key)
        integrations.set(key, {
          id: previous?.id ?? integrations.size + 1,
          owner_scope: 'USER',
          user_id: userId,
          ga_id: null,
          provider_key: providerKey,
          status: 'connected',
          credential_ciphertext: ciphertext,
          public_config: JSON.parse(publicConfig),
          provider_account_email: email,
          connected_at: new Date(),
          last_error: null,
          last_synced_at: previous?.last_synced_at ?? null,
          updated_at: new Date(),
        })
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith('UPDATE service_integrations')) {
        assertUserScoped(sql)
        const [userId, providerKey, value] = params
        const row = integrations.get(`${userId}|${providerKey}`)
        if (!row) return { rows: [], rowCount: 0 }
        if (sql.includes('SET credential_ciphertext')) row.credential_ciphertext = value
        else if (sql.includes("SET status = 'error'")) { row.status = 'error'; row.last_error = value }
        else if (sql.includes('SET last_synced_at')) row.last_synced_at = new Date()
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith('DELETE FROM service_integrations')) {
        assertUserScoped(sql)
        const [userId, providerKey] = params
        const existed = integrations.delete(`${userId}|${providerKey}`)
        return { rows: [], rowCount: existed ? 1 : 0 }
      }
      if (options.crmAgeRows && sql.includes('c.next_age_date IS NOT NULL')) {
        return { rows: options.crmAgeRows.filter((row) => row.owner === params[1]), rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  return pool
}

/**
 * 모든 service_integrations 읽기·쓰기는 USER 소유자 조건을 가져야 한다.
 * @param {string} sql
 */
function assertUserScoped(sql) {
  if (!sql.includes("owner_scope = 'USER'") || !sql.includes('user_id = $1') || !sql.includes('ga_id IS NULL')) {
    throw new Error(`unscoped integration query: ${sql}`)
  }
}

export const CALENDAR_ONLY_SCOPE = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly'
export const DEFAULT_GRANTED_SCOPE = `${CALENDAR_ONLY_SCOPE} https://www.googleapis.com/auth/tasks.readonly`

/**
 * 가짜 Google. code → 계정, access token → 계정으로 응답한다.
 * Tasks 는 토큰에 tasks.readonly 가 없으면 실제 Google 처럼 403 을 준다.
 */
export function createFakeGoogle() {
  const accounts = new Map()
  const codes = new Map()
  const accessIndex = new Map()
  const revoked = []
  const calls = []
  let failCalendar = false
  let failTasks = false
  let failRevoke = false
  let seq = 0

  /**
   * @param {string} sub
   * @param {string} email
   * @param {Array<{ meta: object, events: object[] }>} calendars
   * @param {Array<{ meta: { id: string, title?: string }, tasks: object[] }>} [taskLists]
   */
  function addAccount(sub, email, calendars, taskLists = []) {
    accounts.set(sub, { sub, email, name: email.split('@')[0], calendars, taskLists, refresh: new Set() })
  }

  function issueCode(sub, opts = {}) {
    seq += 1
    const code = `code-${sub}-${seq}`
    codes.set(code, { sub, scope: opts.scope ?? DEFAULT_GRANTED_SCOPE })
    return code
  }

  const accessScopes = new Map()
  const refreshScopes = new Map()

  function issueAccess(sub, scope, expiresIn = 3600) {
    seq += 1
    const token = `access-${sub}-${seq}`
    accessIndex.set(token, sub)
    accessScopes.set(token, scope)
    return { access_token: token, expires_in: expiresIn }
  }

  /** 페이지 크기 2 로 잘라 nextPageToken 을 흉내 낸다. */
  function paged(items, url, prefix) {
    const size = 2
    const token = url.searchParams.get('pageToken') ?? ''
    const start = token.startsWith(prefix) ? Number(token.slice(prefix.length)) : 0
    const next = start + size < items.length ? `${prefix}${start + size}` : undefined
    return { items: items.slice(start, start + size), nextPageToken: next }
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(String(input))
    const auth = String(init.headers?.Authorization ?? '')
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    calls.push({ url: url.toString(), bearer, body: init.body ? String(init.body) : '' })
    const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
    if (url.href === 'https://oauth2.googleapis.com/token') {
      const form = new URLSearchParams(String(init.body))
      if (form.get('grant_type') === 'authorization_code') {
        const entry = codes.get(form.get('code'))
        codes.delete(form.get('code'))
        if (!entry) return json(400, { error: 'invalid_grant' })
        seq += 1
        const refresh = `refresh-${entry.sub}-${seq}`
        accounts.get(entry.sub).refresh.add(refresh)
        refreshScopes.set(refresh, entry.scope)
        return json(200, { ...issueAccess(entry.sub, entry.scope), refresh_token: refresh, scope: entry.scope, token_type: 'Bearer' })
      }
      if (form.get('grant_type') === 'refresh_token') {
        const refresh = form.get('refresh_token')
        const account = [...accounts.values()].find((item) => item.refresh.has(refresh))
        if (!account || revoked.includes(refresh)) return json(400, { error: 'invalid_grant' })
        const scope = refreshScopes.get(refresh)
        return json(200, { ...issueAccess(account.sub, scope), scope })
      }
      return json(400, { error: 'unsupported_grant_type' })
    }
    if (url.href === 'https://oauth2.googleapis.com/revoke') {
      if (failRevoke) return json(503, { error: 'backend_error' })
      revoked.push(new URLSearchParams(String(init.body)).get('token'))
      return json(200, {})
    }
    const sub = accessIndex.get(bearer)
    const account = sub ? accounts.get(sub) : null
    if (url.href === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return account ? json(200, { sub: account.sub, email: account.email, name: account.name }) : json(401, {})
    }
    if (url.pathname === '/calendar/v3/users/me/calendarList') {
      if (!account) return json(401, {})
      if (failCalendar) return json(503, {})
      const page = url.searchParams.get('pageToken') ? 1 : 0
      const half = Math.ceil(account.calendars.length / 2)
      const items = page === 0 ? account.calendars.slice(0, half) : account.calendars.slice(half)
      return json(200, { items: items.map((calendar) => calendar.meta), nextPageToken: page === 0 && account.calendars.length > half ? 'p2' : undefined })
    }
    const eventsMatch = /^\/calendar\/v3\/calendars\/([^/]+)\/events$/.exec(url.pathname)
    if (eventsMatch) {
      if (!account) return json(401, {})
      if (failCalendar) return json(503, {})
      const calendar = account.calendars.find((item) => item.meta.id === decodeURIComponent(eventsMatch[1]))
      if (!calendar) return json(404, {})
      const page = url.searchParams.get('pageToken') ? 1 : 0
      const half = Math.ceil(calendar.events.length / 2)
      const items = page === 0 ? calendar.events.slice(0, half) : calendar.events.slice(half)
      return json(200, { items, nextPageToken: page === 0 && calendar.events.length > half ? 'e2' : undefined })
    }
    if (url.hostname === 'tasks.googleapis.com') {
      if (!account) return json(401, {})
      if (!String(accessScopes.get(bearer) ?? '').split(' ').includes('https://www.googleapis.com/auth/tasks.readonly')) {
        return json(403, { error: { status: 'PERMISSION_DENIED' } })
      }
      if (failTasks) return json(503, {})
      if (url.pathname === '/tasks/v1/users/@me/lists' || url.pathname === '/tasks/v1/users/%40me/lists') {
        return json(200, paged(account.taskLists.map((list) => ({ kind: 'tasks#taskList', ...list.meta })), url, 'l'))
      }
      const tasksMatch = /^\/tasks\/v1\/lists\/([^/]+)\/tasks$/.exec(url.pathname)
      if (tasksMatch) {
        const list = account.taskLists.find((item) => item.meta.id === decodeURIComponent(tasksMatch[1]))
        if (!list) return json(404, {})
        const showCompleted = url.searchParams.get('showCompleted') === 'true'
        const showHidden = url.searchParams.get('showHidden') === 'true'
        const visible = list.tasks.filter((task) => (showCompleted || task.status !== 'completed') && (showHidden || task.hidden !== true))
        return json(200, paged(visible, url, 't'))
      }
      return json(404, {})
    }
    return json(404, {})
  }

  return {
    fetchImpl,
    addAccount,
    issueCode,
    revoked,
    calls,
    accounts,
    setCalendarFailure(value) { failCalendar = value },
    setTasksFailure(value) { failTasks = value },
    setRevokeFailure(value) { failRevoke = value },
    expireAccessTokens() { accessIndex.clear() },
  }
}
