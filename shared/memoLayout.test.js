import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MEMO_DEFAULT_X,
  MEMO_DEFAULT_Y,
  buildArrangedNotePositions,
  clampNotePosition,
  getMemoBoardVisibleNotes,
} from './memoLayout.js'

test('clampNotePosition moves negative coordinates inside board', () => {
  const next = clampNotePosition({ x: -40, y: -10, width: 260, height: 200 }, 800, 600)
  assert.equal(next.x, MEMO_DEFAULT_X)
  assert.equal(next.y, MEMO_DEFAULT_Y)
})

test('clampNotePosition keeps note inside board bounds', () => {
  const next = clampNotePosition({ x: 5000, y: 4000, width: 260, height: 200 }, 800, 600)
  assert.equal(next.x, 540)
  assert.equal(next.y, 400)
})

test('getMemoBoardVisibleNotes ignores hidden list on memo route', () => {
  const notes = [{ id: 'a' }, { id: 'b' }]
  const hidden = { a: true }
  assert.deepEqual(getMemoBoardVisibleNotes(notes, hidden, true), notes)
  assert.deepEqual(getMemoBoardVisibleNotes(notes, hidden, false), [{ id: 'b' }])
})

test('buildArrangedNotePositions lays out column grid', () => {
  assert.deepEqual(buildArrangedNotePositions(4), [
    { x: 24, y: 24 },
    { x: 300, y: 24 },
    { x: 576, y: 24 },
    { x: 24, y: 260 },
  ])
})
