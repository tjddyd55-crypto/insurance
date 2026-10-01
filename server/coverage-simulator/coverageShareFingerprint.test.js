import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { coverageShareSnapshotFingerprint } from '../../shared/coverageShareFingerprint.js'

function scenario(patch = {}) {
  return {
    id: 'consult-1',
    title: '암 치료',
    diseaseType: 'cancer',
    description: '설명',
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
        memo: '',
        order: 0,
      },
    ],
    ...patch,
  }
}

test('same content keeps one fingerprint when only timestamps change', () => {
  const first = coverageShareSnapshotFingerprint(scenario())
  const second = coverageShareSnapshotFingerprint(
    scenario({
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T03:00:00.000Z',
      customerName: '김민수',
    }),
  )
  assert.equal(first, second)
})

test('amount or title change produces a new fingerprint', () => {
  const base = coverageShareSnapshotFingerprint(scenario())
  const amountChanged = coverageShareSnapshotFingerprint(
    scenario({
      items: [
        {
          ...scenario().items[0],
          proposedAmount: 3000,
        },
      ],
    }),
  )
  const titleChanged = coverageShareSnapshotFingerprint(scenario({ title: '2안' }))
  assert.notEqual(base, amountChanged)
  assert.notEqual(base, titleChanged)
})

test('share schema adds the fingerprint column and active unique index', () => {
  const schema = readFileSync(new URL('./coverageSimulationShareSchema.js', import.meta.url), 'utf8')
  assert.match(schema, /ADD COLUMN IF NOT EXISTS snapshot_fingerprint TEXT/)
  assert.match(schema, /idx_coverage_simulation_shares_active_fingerprint/)
  assert.match(schema, /WHERE revoked_at IS NULL AND snapshot_fingerprint IS NOT NULL/)
})
