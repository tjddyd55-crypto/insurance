import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoverageSimulationShare } from './coverageSimulationShareService.js'

function scenario(patch = {}) {
  return {
    id: 'consult-1',
    title: '암 치료',
    diseaseType: 'cancer',
    description: '',
    customerId: 'cust-9',
    customerNameSnapshot: '김민수',
    consultationDate: '2026-10-02',
    createdAt: '2026-09-30T16:16:00.000Z',
    updatedAt: '2026-10-01T01:16:00.000Z',
    items: [
      {
        id: 'item-1',
        type: 'coverage',
        category: 'diagnosis',
        label: '진단비',
        currentAmount: 1000,
        proposedAmount: 2000,
        order: 0,
      },
    ],
    ...patch,
  }
}

function createMemoryPool() {
  const rows = []
  let nextId = 1
  const pool = {
    missNextSelect: false,
    failNextInsert: false,
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('snapshot_fingerprint = $4')) {
        if (pool.missNextSelect) {
          pool.missNextSelect = false
          return { rows: [], rowCount: 0 }
        }
        const match = rows.find(
          (row) =>
            row.ga_id === params[0] &&
            row.created_by_user_id === params[1] &&
            row.consultation_id === params[2] &&
            row.snapshot_fingerprint === params[3] &&
            row.revoked_at == null,
        )
        return { rows: match ? [match] : [], rowCount: match ? 1 : 0 }
      }
      if (text.includes('INSERT INTO coverage_simulation_shares')) {
        if (pool.failNextInsert) {
          pool.failNextInsert = false
          throw Object.assign(new Error('duplicate key'), { code: '23505' })
        }
        const row = {
          id: nextId,
          ga_id: params[0],
          consultation_id: params[1],
          share_token: params[2],
          created_by_user_id: params[8],
          snapshot_fingerprint: params[9],
          created_at: `2026-10-02T00:00:0${nextId}.000Z`,
          pdf_object_key: null,
          revoked_at: null,
        }
        nextId += 1
        rows.push(row)
        return {
          rows: [
            {
              id: row.id,
              share_token: row.share_token,
              created_at: row.created_at,
              pdf_object_key: row.pdf_object_key,
            },
          ],
          rowCount: 1,
        }
      }
      throw new Error(`unexpected sql: ${text}`)
    },
  }
  return { pool, rows }
}

const owner = { gaId: 7, userId: 'planner-1', consultationId: 'consult-1' }

test('same fingerprint reuses the stored share URL across a fresh call', async () => {
  const { pool, rows } = createMemoryPool()
  const first = await createCoverageSimulationShare(pool, { ...owner, scenario: scenario() })
  const second = await createCoverageSimulationShare(pool, {
    ...owner,
    scenario: scenario({ updatedAt: '2026-10-02T12:00:00.000Z' }),
  })
  assert.equal(second.share_token, first.share_token)
  assert.equal(rows.length, 1)
})

test('changed content stores a new share URL', async () => {
  const { pool, rows } = createMemoryPool()
  const first = await createCoverageSimulationShare(pool, { ...owner, scenario: scenario() })
  const changed = scenario()
  changed.items = [{ ...changed.items[0], proposedAmount: 9000 }]
  const second = await createCoverageSimulationShare(pool, { ...owner, scenario: changed })
  assert.notEqual(second.share_token, first.share_token)
  assert.equal(rows.length, 2)
})

test('unique violation returns the already stored share', async () => {
  const { pool, rows } = createMemoryPool()
  const first = await createCoverageSimulationShare(pool, { ...owner, scenario: scenario() })
  pool.missNextSelect = true
  pool.failNextInsert = true
  const raced = await createCoverageSimulationShare(pool, { ...owner, scenario: scenario() })
  assert.equal(raced.share_token, first.share_token)
  assert.equal(rows.length, 1)
})
