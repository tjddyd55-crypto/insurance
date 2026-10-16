/**
 * t321 Google 캘린더 자동 연동.
 * ONE FC 원본(할 일·고객 알림)은 DB 가 원본이고, 사용자가 연결한 "본인" Google Calendar 에 일정 사본만 만든다.
 * - 대상 날짜는 기존 알림 조립(loadReminderSourceRows + assembleReminderEvents)을 그대로 쓴다(재계산 금지).
 * - 기존 알림 설정(user_notification_settings)에서 OFF 인 알림 유형은 보내지 않는다.
 * - Google 일정에는 일반 제목만 보낸다(고객명·연락처·메모·링크 없음). ONE FC 원본은 바꾸지 않는다.
 * - 이벤트 id 는 (사용자, Google 계정, 캘린더, 원본 키)로 결정되는 값이라 재시도·시간초과에도 한 건만 생긴다.
 * - 삭제·수정 전에는 Google 에서 다시 읽어 private extendedProperties 의 소유 태그를 확인한다(제목·날짜로 판단하지 않는다).
 * - OFF: 설정을 먼저 저장하고(세대 번호 증가), OFF 한 서울 날짜 "다음 날 이후" 사본만 삭제 대기로 표시한다. 과거·당일은 보존.
 */
import crypto from 'node:crypto'
import { addDaysYmd, seoulYmd } from '../../lib/seoulCalendarDate.js'
import { readUserIntegration } from '../integrationStore.js'
import { loadReminderSourceRows } from '../../reminders/reminderQuery.js'
import { assembleReminderEvents } from '../../reminders/reminderEvents.js'
import { getUserNotificationSettings } from '../../services/userNotificationSettingsService.js'
import { googleGetJson, googleSendJson } from './googleApiHttp.js'
import { GOOGLE_ACCOUNT_PROVIDER_KEY, hasCalendarWriteScope, isGoogleWriteEnabledFor, readGoogleOAuthConfig } from './googleOAuthConfig.js'
import { getGoogleAccessToken, googleError } from './googleTokenService.js'
import { clearGoogleUserCache } from './googleUserCache.js'

export const AUTOSYNC_ENV = 'GOOGLE_CALENDAR_AUTOSYNC_ENABLED'
export const AUTOSYNC_WINDOW_DAYS = 90
export const AUTOSYNC_KINDS = Object.freeze(['todo', 'car_expiry', 'insurance_age_date', 'special_date'])
export const AUTOSYNC_TITLES = Object.freeze({
  todo: 'ONE FC 할 일',
  car_expiry: 'ONE FC 자동차보험 만기',
  insurance_age_date: 'ONE FC 상령일 알림',
  special_date: 'ONE FC 고객 알림',
})
const KIND_COLUMN = { todo: 'todo_enabled', car_expiry: 'car_expiry_enabled', insurance_age_date: 'insurance_age_enabled', special_date: 'special_date_enabled' }
const KIND_ORIGINAL_SETTING = { car_expiry: 'carExpiry', insurance_age_date: 'insuranceAge', special_date: 'specialDate' }
const TAG_APP = 'onefcAutoSync'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3'

/** @param {Record<string, string | undefined>} [env] */
export function isAutoSyncEnabledFor(userId, env = process.env) {
  const on = ['1', 'true', 'yes', 'on'].includes(String(env[AUTOSYNC_ENV] ?? '').trim().toLowerCase())
  return on && isGoogleWriteEnabledFor(userId, env)
}

/** @param {import('pg').Pool} pool */
export async function ensureGoogleAutoSyncSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_autosync_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      todo_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      car_expiry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      insurance_age_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      special_date_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      generation BIGINT NOT NULL DEFAULT 0,
      last_sync_at TIMESTAMPTZ NULL,
      last_sync_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_sync_map (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL,
      google_account_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      alert_kind TEXT NOT NULL,
      event_date DATE NOT NULL,
      google_event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      content_hash TEXT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT google_calendar_sync_map_status_chk CHECK (status IN ('pending','active','pending_delete','deleted','retained','conflict','failed'))
    )
  `)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_gcal_sync_map_key ON google_calendar_sync_map (user_id, google_account_id, calendar_id, source_key)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_gcal_sync_map_user_status ON google_calendar_sync_map (user_id, status)`)
}

const DEFAULT_SETTINGS = { enabled: false, kinds: { todo: true, car_expiry: true, insurance_age_date: true, special_date: true }, calendarId: 'primary', generation: 0 }

function mapSettingsRow(row) {
  if (!row) return { ...DEFAULT_SETTINGS, kinds: { ...DEFAULT_SETTINGS.kinds }, lastSyncAt: null, lastSyncError: null, gaId: null }
  return {
    enabled: row.enabled === true,
    kinds: Object.fromEntries(AUTOSYNC_KINDS.map((k) => [k, row[KIND_COLUMN[k]] !== false])),
    calendarId: String(row.calendar_id || 'primary'),
    generation: Number(row.generation ?? 0),
    lastSyncAt: row.last_sync_at ?? null,
    lastSyncError: row.last_sync_error ?? null,
    gaId: row.ga_id == null ? null : Number(row.ga_id),
  }
}

export async function readAutoSyncSettings(pool, userId) {
  const r = await pool.query('SELECT * FROM google_calendar_autosync_settings WHERE user_id = $1', [String(userId)])
  return mapSettingsRow(r.rows[0])
}

/** 사용자 계정 기준 시드 해시(로그·태그에 원래 id 를 노출하지 않음). */
function ownerTag(userId) {
  return crypto.createHash('sha256').update(`onefc-owner:${userId}`).digest('hex').slice(0, 32)
}

export function autoSyncEventId(userId, accountId, calendarId, sourceKey) {
  const h = crypto.createHash('sha256').update(`${userId}|${accountId}|${calendarId}|${sourceKey}`).digest('hex').slice(0, 40)
  return `onefcas${h}` // base32hex(0-9a-v) 부분집합
}

/** Google 에 보낼 본문. 일반 제목·날짜만. 원문·고객 정보·링크는 넣지 않는다. */
export function buildAutoSyncEventPayload(item, ctx) {
  const completed = item.kind === 'todo' && item.completed
  const title = `${AUTOSYNC_TITLES[item.kind]}${completed ? ' (완료)' : ''}`
  return {
    summary: title,
    description: 'ONE FC 앱에서 자동으로 만든 일정입니다. 자세한 내용은 ONE FC에서 확인하세요.',
    start: { date: item.date },
    end: { date: addDaysYmd(item.date, 1) },
    transparency: 'transparent',
    visibility: 'private',
    reminders: { useDefault: completed ? false : true, ...(completed ? { overrides: [] } : {}) },
    extendedProperties: { private: { app: TAG_APP, owner: ctx.ownerTag, key: crypto.createHash('sha256').update(item.key).digest('hex').slice(0, 32), kind: item.kind } },
  }
}

function contentHash(item) {
  return `${item.date}|${item.kind}|${item.completed ? 1 : 0}`
}

/** 이 이벤트가 이 사용자의 ONE FC 자동 사본인지(태그로만 판단). */
export function isOwnedAutoSyncEvent(event, owner, key) {
  const p = event?.extendedProperties?.private ?? {}
  if (p.app !== TAG_APP || p.owner !== owner) return false
  return key ? p.key === crypto.createHash('sha256').update(key).digest('hex').slice(0, 32) : true
}

/** 일정 관리에서 ONE FC 가 만든 사본은 숨긴다(원본은 ONE FC 쪽에 이미 보인다). */
export function isOnefcAutoSyncCopy(event) {
  return event?.extendedProperties?.private?.app === TAG_APP
}

/**
 * 동기화 대상(원하는 상태). 기존 알림 조립 결과를 그대로 쓴다.
 * @returns {Promise<Map<string, { key: string, kind: string, sourceType: string, sourceId: string, date: string, completed: boolean }>>}
 */
export async function loadDesiredItems(pool, scope) {
  const { userId, gaId, fromYmd, toYmd, kinds } = scope
  const out = new Map()
  if (kinds.todo) {
    const r = await pool.query(
      `SELECT id, due_date::text AS due, status FROM todos
       WHERE ga_id = $1 AND (owner_user_id = $2 OR assignee_user_id = $2)
         AND status IN ('pending','completed') AND due_date IS NOT NULL
         AND due_date >= $3::date AND due_date <= $4::date`,
      [gaId, userId, fromYmd, toYmd],
    )
    for (const row of r.rows) {
      const key = `todo:${row.id}`
      out.set(key, { key, kind: 'todo', sourceType: 'todo', sourceId: String(row.id), date: String(row.due).slice(0, 10), completed: row.status === 'completed' })
    }
  }
  const reminderKinds = ['car_expiry', 'insurance_age_date', 'special_date'].filter((k) => kinds[k])
  if (reminderKinds.length) {
    const original = await getUserNotificationSettings(pool, userId, gaId)
    const allowed = reminderKinds.filter((k) => original[KIND_ORIGINAL_SETTING[k]]?.enabled !== false)
    if (allowed.length) {
      const rows = await loadReminderSourceRows(pool, { userId, gaId, fromYmd, toYmd })
      for (const ev of assembleReminderEvents({ ...rows, fromYmd, toYmd })) {
        if (!allowed.includes(ev.type)) continue
        const key = `reminder:${ev.id}`
        out.set(key, { key, kind: ev.type, sourceType: String(ev.source), sourceId: String(ev.id), date: ev.startDate, completed: false })
      }
    }
  }
  return out
}

function eventUrl(calendarId, eventId) {
  const base = `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  return new URL(eventId ? `${base}/${encodeURIComponent(eventId)}` : base)
}

async function getEventOrNull(access, calendarId, eventId) {
  try {
    return await googleGetJson(access.fetchImpl, eventUrl(calendarId, eventId), access.accessToken)
  } catch (error) {
    if (error?.code === 'google_unavailable') {
      // googleGetJson 은 404 를 google_unavailable 로 올린다 → 직접 확인
      const res = await access.fetchImpl(eventUrl(calendarId, eventId), { headers: { Authorization: `Bearer ${access.accessToken}` } }).catch(() => null)
      if (res && (res.status === 404 || res.status === 410)) return null
    }
    throw error
  }
}

/** 생성(멱등). 같은 id 가 이미 있으면 소유 태그 확인 후 갱신·복구. */
async function upsertEvent(access, calendarId, eventId, payload, ctx, key) {
  try {
    return await googleSendJson(access.fetchImpl, 'POST', eventUrl(calendarId), access.accessToken, { body: { id: eventId, ...payload } })
  } catch (error) {
    if (error?.code !== 'google_conflict' && error?.code !== 'google_timeout') throw error
  }
  const existing = await getEventOrNull(access, calendarId, eventId)
  if (!existing) {
    return googleSendJson(access.fetchImpl, 'POST', eventUrl(calendarId), access.accessToken, { body: { id: eventId, ...payload } })
  }
  if (!isOwnedAutoSyncEvent(existing, ctx.ownerTag, key)) throw googleError('autosync_not_owned')
  return googleSendJson(access.fetchImpl, 'PUT', eventUrl(calendarId, eventId), access.accessToken, { body: { ...payload, status: 'confirmed' } })
}

async function patchEvent(access, calendarId, eventId, payload, ctx, key) {
  const existing = await getEventOrNull(access, calendarId, eventId)
  if (!existing || existing.status === 'cancelled') return upsertEvent(access, calendarId, eventId, payload, ctx, key)
  if (!isOwnedAutoSyncEvent(existing, ctx.ownerTag, key)) throw googleError('autosync_not_owned')
  return googleSendJson(access.fetchImpl, 'PUT', eventUrl(calendarId, eventId), access.accessToken, { body: { ...payload, status: 'confirmed' } })
}

/** 삭제: 태그로 소유 확인된 경우만. 이미 없으면 성공으로 본다. */
async function deleteOwnedEvent(access, calendarId, eventId, ctx, key) {
  const existing = await getEventOrNull(access, calendarId, eventId)
  if (!existing || existing.status === 'cancelled') return 'gone'
  if (!isOwnedAutoSyncEvent(existing, ctx.ownerTag, key)) throw googleError('autosync_not_owned')
  try {
    await googleSendJson(access.fetchImpl, 'DELETE', eventUrl(calendarId, eventId), access.accessToken)
  } catch (error) {
    if (error?.code === 'google_not_found') return 'gone'
    throw error
  }
  return 'deleted'
}

async function setMap(pool, id, status, extra = {}) {
  await pool.query(
    `UPDATE google_calendar_sync_map
     SET status = $2, last_error = $3, content_hash = COALESCE($4, content_hash), event_date = COALESCE($5::date, event_date),
         attempts = CASE WHEN $3 IS NULL THEN 0 ELSE attempts + 1 END,
         history = (history || jsonb_build_array(jsonb_build_object('at', NOW(), 'status', $2::text, 'error', $3::text)))
                   - CASE WHEN jsonb_array_length(history) >= 20 THEN 0 ELSE 1000 END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, extra.error ?? null, extra.hash ?? null, extra.date ?? null],
  )
}

/**
 * OFF(전체 또는 유형) 직후: 설정이 이미 저장된 상태에서 호출. OFF 서울 날짜 다음 날 이후 사본만 삭제 대기로.
 * 과거·당일 사본은 retained(관리 종료, Google 에 그대로 둠).
 */
export async function markOffKinds(pool, userId, offKinds, offYmd = seoulYmd()) {
  if (!offKinds.length) return { pendingDelete: 0, retained: 0 }
  const del = await pool.query(
    `UPDATE google_calendar_sync_map SET status = 'pending_delete', updated_at = NOW(),
       history = history || jsonb_build_array(jsonb_build_object('at', NOW(), 'status', 'pending_delete', 'offDate', $3::text))
     WHERE user_id = $1 AND alert_kind = ANY($2) AND status IN ('pending','active','failed','conflict') AND event_date > $3::date`,
    [String(userId), offKinds, offYmd],
  )
  const keep = await pool.query(
    `UPDATE google_calendar_sync_map SET status = 'retained', updated_at = NOW(),
       history = history || jsonb_build_array(jsonb_build_object('at', NOW(), 'status', 'retained', 'offDate', $3::text))
     WHERE user_id = $1 AND alert_kind = ANY($2) AND status IN ('pending','active','failed') AND event_date <= $3::date`,
    [String(userId), offKinds, offYmd],
  )
  return { pendingDelete: del.rowCount ?? 0, retained: keep.rowCount ?? 0 }
}

/**
 * 설정 저장(먼저 저장 → 세대 증가 → OFF 처리 표시). 실패하면 throw(가짜 성공 없음).
 */
export async function saveAutoSyncSettings(pool, userId, gaId, patch, offYmd = seoulYmd()) {
  const prev = await readAutoSyncSettings(pool, userId)
  const next = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : prev.enabled,
    kinds: { ...prev.kinds },
  }
  for (const k of AUTOSYNC_KINDS) if (typeof patch.kinds?.[k] === 'boolean') next.kinds[k] = patch.kinds[k]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `INSERT INTO google_calendar_autosync_settings (user_id, ga_id, enabled, todo_enabled, car_expiry_enabled, insurance_age_enabled, special_date_enabled, generation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1)
       ON CONFLICT (user_id) DO UPDATE SET ga_id = EXCLUDED.ga_id, enabled = EXCLUDED.enabled, todo_enabled = EXCLUDED.todo_enabled,
         car_expiry_enabled = EXCLUDED.car_expiry_enabled, insurance_age_enabled = EXCLUDED.insurance_age_enabled,
         special_date_enabled = EXCLUDED.special_date_enabled, generation = google_calendar_autosync_settings.generation + 1, updated_at = NOW()
       RETURNING *`,
      [String(userId), gaId, next.enabled, next.kinds.todo, next.kinds.car_expiry, next.kinds.insurance_age_date, next.kinds.special_date],
    )
    const offKinds = AUTOSYNC_KINDS.filter((k) => !(next.enabled && next.kinds[k]))
    const marked = await markOffKinds(client, userId, offKinds, offYmd)
    await client.query('COMMIT')
    return { settings: mapSettingsRow(r.rows[0]), marked }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

const running = new Map()

/** 사용자 단위 직렬화 + DB advisory lock(다중 인스턴스). */
export function requestAutoSync(pool, userId, options = {}) {
  const id = String(userId)
  const prev = running.get(id) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(() => reconcileUser(pool, id, options))
  running.set(id, next)
  next.finally(() => { if (running.get(id) === next) running.delete(id) }).catch(() => {})
  return next
}

/**
 * 한 사용자 동기화(초기 동기화·이벤트 후속·주기 보정 공통).
 * @param {{ env?: Record<string,string|undefined>, fetchImpl?: typeof fetch, today?: string, config?: any }} options
 */
export async function reconcileUser(pool, userId, options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const today = options.today ?? seoulYmd()
  const result = { created: 0, updated: 0, deleted: 0, retained: 0, failed: 0, skipped: '' }
  const client = await pool.connect()
  let locked = false
  try {
    const lk = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [`gcal-autosync:${userId}`])
    locked = lk.rows[0]?.ok === true
    if (!locked) { result.skipped = 'busy'; return result }
    const settings = await readAutoSyncSettings(client, userId)
    const pendingDeletes = (await client.query(`SELECT * FROM google_calendar_sync_map WHERE user_id = $1 AND status = 'pending_delete'`, [userId])).rows
    const active = settings.enabled && settings.gaId != null && isAutoSyncEnabledFor(userId, env)
    if (!active && !pendingDeletes.length) { result.skipped = 'off'; return result }

    const row = await readUserIntegration(client, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
    if (!row || row.status !== 'connected') { result.skipped = 'not_connected'; await noteSync(client, userId, 'not_connected'); return result }
    if (!hasCalendarWriteScope(row.credential?.scope)) { result.skipped = 'write_scope_missing'; await noteSync(client, userId, 'write_scope_missing'); return result }
    const accountId = String(row.credential?.sub ?? '').trim()
    if (!accountId) { result.skipped = 'account_unknown'; return result }
    const config = options.config ?? readGoogleOAuthConfig(env)
    const token = await getGoogleAccessToken(client, config, { userId, fetchImpl })
    const access = { accessToken: token.accessToken, fetchImpl }
    const ctx = { ownerTag: ownerTag(userId) }
    const calendarId = settings.calendarId

    // 1) 삭제 대기 처리(현재 연결 계정의 사본만. 다른 계정 사본은 이 토큰으로 건드리지 않는다).
    for (const m of pendingDeletes) {
      if (m.google_account_id !== accountId) continue
      try {
        await deleteOwnedEvent(access, m.calendar_id, m.google_event_id, ctx, m.source_key)
        await setMap(client, m.id, 'deleted')
        result.deleted += 1
      } catch (error) {
        await setMap(client, m.id, error?.code === 'autosync_not_owned' ? 'conflict' : 'pending_delete', { error: String(error?.code ?? 'error') })
        result.failed += 1
      }
    }
    if (!active) { await noteSync(client, userId, result.failed ? 'partial' : null); return result }

    // 2) 원하는 상태(서울 오늘 ~ +90일 롤링 구간)
    const fromYmd = today
    const toYmd = addDaysYmd(today, AUTOSYNC_WINDOW_DAYS)
    const enabledKinds = Object.fromEntries(AUTOSYNC_KINDS.map((k) => [k, settings.kinds[k]]))
    const desired = await loadDesiredItems(client, { userId, gaId: settings.gaId, fromYmd, toYmd, kinds: enabledKinds })
    const maps = (await client.query(
      `SELECT *, to_char(event_date, 'YYYY-MM-DD') AS ymd FROM google_calendar_sync_map WHERE user_id = $1 AND google_account_id = $2 AND calendar_id = $3`,
      [userId, accountId, calendarId],
    )).rows
    const byKey = new Map(maps.map((m) => [m.source_key, m]))
    const generation = settings.generation
    const stillCurrent = async () => {
      const g = await client.query('SELECT enabled, generation FROM google_calendar_autosync_settings WHERE user_id = $1', [userId])
      return g.rows[0]?.enabled === true && Number(g.rows[0]?.generation) === generation
    }

    for (const item of desired.values()) {
      if (!(await stillCurrent())) { result.skipped = 'settings_changed'; break }
      const hash = contentHash(item)
      let m = byKey.get(item.key)
      if (m && m.status === 'active' && m.content_hash === hash) continue
      if (m && m.status === 'conflict') continue
      const eventId = m?.google_event_id ?? autoSyncEventId(userId, accountId, calendarId, item.key)
      if (!m) {
        const ins = await client.query(
          `INSERT INTO google_calendar_sync_map (user_id, ga_id, google_account_id, calendar_id, source_type, source_id, source_key, alert_kind, event_date, google_event_id, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,'pending')
           ON CONFLICT (user_id, google_account_id, calendar_id, source_key) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [userId, settings.gaId, accountId, calendarId, item.sourceType, item.sourceId, item.key, item.kind, item.date, eventId],
        )
        m = ins.rows[0]
      }
      const payload = buildAutoSyncEventPayload(item, ctx)
      try {
        if (m.status === 'active') {
          await patchEvent(access, calendarId, eventId, payload, ctx, item.key)
          result.updated += 1
        } else {
          await upsertEvent(access, calendarId, eventId, payload, ctx, item.key)
          result.created += 1
        }
        await setMap(client, m.id, 'active', { hash, date: item.date })
      } catch (error) {
        await setMap(client, m.id, error?.code === 'autosync_not_owned' ? 'conflict' : 'failed', { error: String(error?.code ?? 'error') })
        result.failed += 1
      }
    }

    // 3) 원본이 사라졌거나 대상에서 빠진(완료 외 취소·삭제·날짜 변경) 사본: 오늘 이후(>= 오늘)만 삭제, 과거는 보존
    if (result.skipped !== 'settings_changed') {
      for (const m of maps) {
        if (desired.has(m.source_key)) continue
        if (!['active', 'failed', 'pending'].includes(m.status)) continue
        const date = String(m.ymd)
        if (!settings.kinds[m.alert_kind]) continue // 유형 OFF 는 markOffKinds 가 처리
        if (date < today) { await setMap(client, m.id, 'retained'); result.retained += 1; continue }
        if (date > toYmd) continue
        try {
          await deleteOwnedEvent(access, m.calendar_id, m.google_event_id, ctx, m.source_key)
          await setMap(client, m.id, 'deleted')
          result.deleted += 1
        } catch (error) {
          await setMap(client, m.id, error?.code === 'autosync_not_owned' ? 'conflict' : 'failed', { error: String(error?.code ?? 'error') })
          result.failed += 1
        }
      }
    }
    await noteSync(client, userId, result.failed ? 'partial' : null)
    clearGoogleUserCache(userId)
    return result
  } catch (error) {
    await noteSync(client, userId, String(error?.code ?? 'sync_failed')).catch(() => {})
    throw error
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`gcal-autosync:${userId}`]).catch(() => {})
    client.release()
  }
}

async function noteSync(db, userId, error) {
  await db.query('UPDATE google_calendar_autosync_settings SET last_sync_at = NOW(), last_sync_error = $2 WHERE user_id = $1', [userId, error])
}

/** 주기 보정: 켜진 사용자 + 삭제 대기 남은 사용자. 오류는 code 만 기록. */
export async function reconcileAllUsers(pool, options = {}) {
  const env = options.env ?? process.env
  if (!['1', 'true', 'yes', 'on'].includes(String(env[AUTOSYNC_ENV] ?? '').trim().toLowerCase())) return { users: 0 }
  const r = await pool.query(`
    SELECT user_id FROM google_calendar_autosync_settings WHERE enabled = TRUE
    UNION SELECT DISTINCT user_id FROM google_calendar_sync_map WHERE status = 'pending_delete'`)
  for (const { user_id: uid } of r.rows) {
    await requestAutoSync(pool, String(uid), options).catch((error) => {
      console.warn('[gcal-autosync] reconcile failed', { code: String(error?.code ?? 'error') })
    })
  }
  return { users: r.rows.length }
}

/** 할 일 변경 후 호출(실패해도 ONE FC 저장에는 영향 없음). */
export function notifyTodoChanged(pool, userId) {
  if (!isAutoSyncEnabledFor(userId)) return
  setTimeout(() => {
    requestAutoSync(pool, userId).catch((error) => console.warn('[gcal-autosync] todo sync failed', { code: String(error?.code ?? 'error') }))
  }, 300)
}
