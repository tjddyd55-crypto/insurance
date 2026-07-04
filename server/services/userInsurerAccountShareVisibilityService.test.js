import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getShareVisibility,
  getTargetShareState,
  listSharedAccountUsers,
  setShareVisibility,
} from './userInsurerAccountShareVisibilityService.js'

/** safeQuery 시그니처(db, sql, params, opts) 를 흉내내는 fake. 마지막 호출을 기록한다. */
function makeFakeQuery(rows) {
  const calls = []
  const fake = async (_db, sql, params, opts) => {
    calls.push({ sql, params, opts })
    return { rows, rowCount: rows.length }
  }
  return { fake, calls }
}

test('getShareVisibility — 행이 없으면 기본 OFF(false)', async () => {
  const { fake } = makeFakeQuery([])
  const enabled = await getShareVisibility(null, fake, 'u1', 10)
  assert.equal(enabled, false)
})

test('getShareVisibility — is_enabled=true 면 true', async () => {
  const { fake } = makeFakeQuery([{ is_enabled: true }])
  const enabled = await getShareVisibility(null, fake, 'u1', 10)
  assert.equal(enabled, true)
})

test('setShareVisibility — upsert 후 적용된 boolean 을 반환한다', async () => {
  const { fake, calls } = makeFakeQuery([])
  const enabled = await setShareVisibility(null, fake, 'u1', 10, true)
  assert.equal(enabled, true)
  assert.match(calls[0].sql, /INSERT INTO user_insurer_account_share_prefs/)
  assert.deepEqual(calls[0].params, [10, 'u1', true])
})

test('listSharedAccountUsers — 이름만 매핑하고 요청자 본인을 제외한다', async () => {
  const { fake, calls } = makeFakeQuery([
    { id: 'u2', display_name: '김성용', name: null, username: 'kim' },
    { id: 'u3', display_name: '', name: '홍길동', username: 'hong' },
  ])
  const data = await listSharedAccountUsers(null, fake, 10, 'u1')
  assert.deepEqual(data, [
    { userId: 'u2', name: '김성용' },
    { userId: 'u3', name: '홍길동' },
  ])
  // 같은 GA + 공유 ON + 본인 제외 조건이 쿼리에 반영되는지
  assert.match(calls[0].sql, /is_enabled = true/)
  assert.match(calls[0].sql, /owner_user_id <> \$2/)
  assert.match(calls[0].sql, /u\.role = 'USER'/)
  assert.deepEqual(calls[0].params, [10, 'u1'])
})

test('getTargetShareState — 대상 pref 행이 없으면 null (다른 GA·미설정 = 접근 차단 근거)', async () => {
  const { fake } = makeFakeQuery([])
  const state = await getTargetShareState(null, fake, 10, 'other-ga-user')
  assert.equal(state, null)
})

test('getTargetShareState — 대상 공유 OFF 면 isEnabled=false 로 반환(=403 근거)', async () => {
  const { fake } = makeFakeQuery([{ ga_id: 10, is_enabled: false }])
  const state = await getTargetShareState(null, fake, 10, 'u2')
  assert.deepEqual(state, { gaId: 10, isEnabled: false })
})

test('share visibility lifecycle — 행 없음 GET false, PATCH true/false 반영', async () => {
  /** @type {Map<string, boolean>} */
  const prefs = new Map()
  const key = '10:u1'

  const fake = async (_db, sql, params) => {
    const gaId = params[0]
    const userId = params[1]
    const mapKey = `${gaId}:${userId}`

    if (sql.includes('SELECT is_enabled') && sql.includes('FROM user_insurer_account_share_prefs')) {
      const enabled = prefs.get(mapKey)
      return enabled === undefined ? { rows: [], rowCount: 0 } : { rows: [{ is_enabled: enabled }], rowCount: 1 }
    }

    if (sql.includes('INSERT INTO user_insurer_account_share_prefs')) {
      prefs.set(mapKey, Boolean(params[2]))
      return { rows: [], rowCount: 1 }
    }

    throw new Error(`unexpected sql: ${sql}`)
  }

  assert.equal(await getShareVisibility(null, fake, 'u1', 10), false)
  assert.equal(await setShareVisibility(null, fake, 'u1', 10, true), true)
  assert.equal(await getShareVisibility(null, fake, 'u1', 10), true)
  assert.equal(await setShareVisibility(null, fake, 'u1', 10, false), false)
  assert.equal(await getShareVisibility(null, fake, 'u1', 10), false)
})
