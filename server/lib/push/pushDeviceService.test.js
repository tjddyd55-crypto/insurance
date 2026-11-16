import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { registerUserPushDevice } from './pushDeviceService.js'

function uniqueViolation(constraint) {
  return Object.assign(new Error(`duplicate key violates ${constraint}`), {
    code: '23505',
    constraint,
  })
}

function createFakeDb(initialRows) {
  let nextId = Math.max(0, ...initialRows.map((row) => row.id)) + 1
  return {
    rows: initialRows.map((row) => ({ ...row })),
    deletedIds: [],
    async query(text, params) {
      const sql = text.replace(/\s+/g, ' ').trim()
      if (sql.startsWith('DELETE FROM user_push_devices')) {
        const [token] = params
        const scoped = /AND ga_id = \$2/.test(sql)
        const userId = params[scoped ? 2 : 1]
        const installationId = params[scoped ? 3 : 2]
        const deleted = this.rows.filter((row) =>
          row.device_token === token &&
          (!scoped || row.ga_id === params[1]) &&
          (!sql.includes('ga_id IS NOT NULL') || row.ga_id != null) &&
          !(row.user_id === userId && row.installation_id === installationId),
        )
        this.deletedIds.push(...deleted.map((row) => row.id))
        this.rows = this.rows.filter((row) => !deleted.includes(row))
        return { rows: [], rowCount: deleted.length }
      }
      if (sql.startsWith('INSERT INTO user_push_devices')) {
        const [gaId, userId, platform, token, appPackage, installationId, appVersion] = params
        const ownRow = this.rows.find((row) =>
          row.user_id === userId && row.installation_id === installationId,
        )
        const upsert = sql.includes('ON CONFLICT (user_id, installation_id)')
        if (ownRow && !upsert) {
          throw uniqueViolation('uq_user_push_devices_user_installation')
        }
        if (this.rows.some((row) => row !== ownRow && row.device_token === token)) {
          throw uniqueViolation('uq_user_push_devices_device_token')
        }
        const row = ownRow ?? { id: nextId++ }
        Object.assign(row, {
          ga_id: gaId, user_id: userId, platform, device_token: token,
          app_package: appPackage, installation_id: installationId, app_version: appVersion,
          is_active: true, revoked_at: null,
        })
        if (!ownRow) this.rows.push(row)
        return { rows: [{ id: row.id }], rowCount: 1 }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

const input = {
  userId: 'user-A', gaId: 1, deviceToken: 'token-T',
  installationId: 'installation-1', appPackage: 'com.onefc.app',
}

describe('registerUserPushDevice global token cleanup', () => {
  let previousPackage
  beforeEach(() => {
    previousPackage = process.env.PUSH_APP_PACKAGE
    process.env.PUSH_APP_PACKAGE = 'com.onefc.app'
  })
  afterEach(() => {
    if (previousPackage == null) delete process.env.PUSH_APP_PACKAGE
    else process.env.PUSH_APP_PACKAGE = previousPackage
  })

  for (const isActive of [false, true]) {
    it(`moves another GA's ${isActive ? 'active' : 'revoked'} token to the newly logged-in user`, async () => {
      const db = createFakeDb([{
        id: 10, user_id: 'user-B', ga_id: 1202, device_token: 'token-T',
        installation_id: 'installation-1', is_active: isActive,
        revoked_at: isActive ? null : '2026-01-01T00:00:00Z',
      }])

      const result = await registerUserPushDevice(db, input)

      assert.equal(db.rows.length, 1)
      const [row] = db.rows.filter((device) => device.device_token === 'token-T')
      assert.ok(row)
      assert.equal(result.id, row.id)
      assert.equal(row.user_id, 'user-A')
      assert.equal(row.ga_id, 1)
      assert.equal(row.is_active, true)
      assert.equal(row.revoked_at, null)
    })
  }

  it('re-registers the same user/installation without deleting its row', async () => {
    const db = createFakeDb([{
      id: 10, user_id: 'user-A', ga_id: 1, device_token: 'old-token',
      installation_id: 'installation-1', is_active: false,
      revoked_at: '2026-01-01T00:00:00Z',
    }])

    assert.deepEqual(await registerUserPushDevice(db, input), { id: 10 })
    assert.equal(db.rows.length, 1)
    assert.equal(db.rows[0].device_token, 'token-T')
    assert.equal(db.rows[0].is_active, true)
    assert.equal(db.rows[0].revoked_at, null)
    // Repeating the same token also exercises the DELETE's own-row exclusion.
    assert.deepEqual(await registerUserPushDevice(db, input), { id: 10 })
    assert.deepEqual(db.deletedIds, [])
    assert.equal(db.rows.length, 1)
  })
})
