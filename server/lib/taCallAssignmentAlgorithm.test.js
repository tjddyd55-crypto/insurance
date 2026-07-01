import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickTaAssignments } from './taCallAssignmentAlgorithm.js'

function seqRandom() {
  let i = 0
  return () => {
    i += 1
    return (i % 997) / 997
  }
}

test('pickTaAssignments: no duplicate within same day', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const { picks } = pickTaAssignments(ids, 5, 1, new Set(), new Set(), seqRandom())
  assert.equal(picks.length, 5)
  assert.equal(new Set(picks).size, 5)
})

test('pickTaAssignments: prefers unassigned in current round', () => {
  const ids = [1, 2, 3, 4, 5]
  const roundAssigned = new Set([1, 2, 3])
  const { picks } = pickTaAssignments(ids, 2, 1, roundAssigned, new Set(), () => 0.1)
  assert.deepEqual(new Set(picks), new Set([4, 5]))
})

test('pickTaAssignments: starts new round when all assigned once', () => {
  const ids = [1, 2, 3]
  const roundAssigned = new Set([1, 2, 3])
  const { picks, rotationRound } = pickTaAssignments(ids, 2, 1, roundAssigned, new Set(), () => 0.5)
  assert.equal(rotationRound, 2)
  assert.equal(picks.length, 2)
  assert.ok(picks.every((id) => ids.includes(id)))
})

test('pickTaAssignments: caps at eligible count', () => {
  const ids = [1, 2, 3]
  const { picks } = pickTaAssignments(ids, 10, 1, new Set(), new Set(), () => 0.5)
  assert.equal(picks.length, 3)
})

test('pickTaAssignments: respects already assigned today when topping up', () => {
  const ids = [1, 2, 3, 4, 5]
  const todayAssigned = new Set([1, 2])
  const { picks } = pickTaAssignments(ids, 4, 1, new Set([1, 2]), todayAssigned, () => 0.2)
  assert.equal(picks.length, 2)
  assert.ok(!picks.includes(1))
  assert.ok(!picks.includes(2))
})
