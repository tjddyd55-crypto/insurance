/**
 * 실제 PostgreSQL 로 SQL 의미 검증 (로컬 임시 DB 전용).
 * ONEFC_TEST_PG_URL 이 없으면 skip — DEV/Production DB 에 절대 연결하지 말 것.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { recordSuccessfulUserLoginSession } from './authSessions.js'
import { recordUserAccessContext, resetUserAccessContextThrottleForTests } from './userAccessContext.js'
import { loadAdminUserAccessContext } from './adminUserAccessContext.js'

const url = process.env.ONEFC_TEST_PG_URL
const skip = !url || /railway|rlwy|amazonaws|supabase/i.test(url) ? 'ONEFC_TEST_PG_URL(로컬 임시 DB) 없음' : false

test('PG 통합: first 1회 / last 갱신 / throttle / 로그인 session 메타 / 기존 login 필드 / GA isolation', { skip }, async () => {
  const pool = new pg.Pool({ connectionString: url })
  try {
    await pool.query(`DROP SCHEMA IF EXISTS t527 CASCADE; CREATE SCHEMA t527; SET search_path TO t527`)
    await pool.query(`SET search_path TO t527`)
    const q = async (sql, p) => {
      const c = await pool.connect()
      try {
        await c.query('SET search_path TO t527')
        return await c.query(sql, p)
      } finally {
        c.release()
      }
    }
    const sp = { query: q }
    await q(`CREATE TABLE users (id TEXT PRIMARY KEY, ga_id INT, is_deleted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ, last_login_ip TEXT, last_login_user_agent TEXT)`)
    await q(`CREATE TABLE user_auth_sessions (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ, ip_inet TEXT, user_agent TEXT, fingerprint TEXT)`)
    await q(`CREATE TABLE user_registered_devices (id BIGSERIAL PRIMARY KEY, user_id TEXT, fingerprint TEXT, last_seen_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, UNIQUE (user_id, fingerprint))`)
    // initDb 와 같은 additive ALTER (기존 row 는 NULL 유지 = backfill 없음)
    await q(`INSERT INTO users (id, ga_id) VALUES ('old', 7)`)
    await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_client_type TEXT, ADD COLUMN IF NOT EXISTS last_client_type TEXT,
      ADD COLUMN IF NOT EXISTS last_device_model TEXT, ADD COLUMN IF NOT EXISTS last_app_version TEXT, ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`)
    await q(`ALTER TABLE user_auth_sessions ADD COLUMN IF NOT EXISTS client_type TEXT, ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS device_model TEXT, ADD COLUMN IF NOT EXISTS app_version TEXT`)
    const old = (await q(`SELECT first_client_type, last_seen_at FROM users WHERE id='old'`)).rows[0]
    assert.deepEqual(old, { first_client_type: null, last_seen_at: null }, '기존 사용자 backfill 없음')

    // 로그인 성공: Windows 앱
    resetUserAccessContextThrottleForTests()
    const req = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Electron/33.0.0 Safari/537.36',
        'x-forwarded-for': '198.51.100.7',
        'x-onefc-client-type': 'desktop_windows',
        'x-onefc-app-version': '1.0.7',
        'x-onefc-platform': 'windows',
      },
      socket: {},
    }
    await recordSuccessfulUserLoginSession(sp, 'old', req, null)
    let u = (await q(`SELECT * FROM users WHERE id='old'`)).rows[0]
    assert.equal(u.first_client_type, 'desktop_windows')
    assert.equal(u.last_client_type, 'desktop_windows')
    assert.equal(u.last_device_model, 'Windows PC')
    assert.equal(u.last_app_version, '1.0.7')
    assert.ok(u.last_seen_at)
    assert.ok(u.last_login_at, '기존 last_login_at 정상')
    assert.equal(u.last_login_ip, '198.51.100.7', '기존 last_login_ip 의미 불변')
    assert.equal(u.last_login_user_agent, req.headers['user-agent'], '기존 last_login_user_agent 의미 불변')
    const s = (await q(`SELECT * FROM user_auth_sessions WHERE user_id='old'`)).rows
    assert.equal(s.length, 1)
    assert.deepEqual([s[0].client_type, s[0].platform, s[0].device_model, s[0].app_version], ['desktop_windows', 'windows', 'Windows PC', '1.0.7'])

    // 같은 사용자 PC 웹 접속 (다른 채널) → last 갱신, first 유지
    resetUserAccessContextThrottleForTests()
    const web = { clientType: 'web_desktop', deviceModel: 'Windows · Chrome', appVersion: null }
    assert.equal((await recordUserAccessContext(sp, 'old', web)).status, 'written')
    u = (await q(`SELECT * FROM users WHERE id='old'`)).rows[0]
    assert.equal(u.first_client_type, 'desktop_windows', 'first overwrite 안 됨')
    assert.equal(u.last_client_type, 'web_desktop')
    assert.equal(u.last_app_version, null)

    // throttle (SQL): 같은 컨텍스트, last_seen 5분 전 → write 없음 / 20분 전 → write
    resetUserAccessContextThrottleForTests()
    await q(`UPDATE users SET last_seen_at = NOW() - interval '5 minutes' WHERE id='old'`)
    assert.equal((await recordUserAccessContext(sp, 'old', web)).status, 'not_written')
    resetUserAccessContextThrottleForTests()
    await q(`UPDATE users SET last_seen_at = NOW() - interval '20 minutes' WHERE id='old'`)
    assert.equal((await recordUserAccessContext(sp, 'old', web)).status, 'written')
    // 미확인 컨텍스트는 last_* 를 null 로 지우지 않음
    resetUserAccessContextThrottleForTests()
    await recordUserAccessContext(sp, 'old', { clientType: null, deviceModel: null, appVersion: null }, { force: true })
    u = (await q(`SELECT * FROM users WHERE id='old'`)).rows[0]
    assert.equal(u.last_client_type, 'web_desktop')

    // 관리자 상세 + GA isolation
    assert.equal(await loadAdminUserAccessContext(sp, { userId: 'old', forcedGaId: 8 }), null)
    const d = await loadAdminUserAccessContext(sp, { userId: 'old', forcedGaId: 7 })
    assert.deepEqual(d.usedClientTypes, ['web_desktop', 'desktop_windows'])
    assert.equal(d.recentSessions.length, 1)
    assert.equal(d.firstClientType, 'desktop_windows')
  } finally {
    await pool.query('DROP SCHEMA IF EXISTS t527 CASCADE').catch(() => {})
    await pool.end()
  }
})
