import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MEMO_DEFAULT_X,
  MEMO_DEFAULT_Y,
  MEMO_MINIMIZED_HEIGHT,
  MEMO_ROUTED_BOARD_MIN_HEIGHT,
  buildArrangedNotePositions,
  clampNotePosition,
  getMemoBoardCanvasHeight,
  getMemoBoardVisibleNotes,
  memoLayoutBoxesOverlap,
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

test('getMemoBoardCanvasHeight expands routed memo board vertically', () => {
  const height = getMemoBoardCanvasHeight([{ x: 24, y: 1200, width: 260, height: 200 }], {
    routedPage: true,
    viewportHeight: 800,
  })
  assert.ok(height != null && height >= MEMO_ROUTED_BOARD_MIN_HEIGHT)
  assert.ok(height >= 1200 + 200 + 120)
})

test('buildArrangedNotePositions lays out without overlap', () => {
  const notes = [
    { id: 'a', width: 260, height: 200 },
    { id: 'b', width: 260, height: 200 },
    { id: 'c', width: 260, height: 200 },
    { id: 'd', width: 260, height: 200 },
  ]
  const arranged = buildArrangedNotePositions(notes, { boardWidth: 900 })
  assert.equal(arranged.length, 4)
  assert.equal(memoLayoutBoxesOverlap(arranged), false)
  assert.equal(arranged[0].x, 24)
  assert.equal(arranged[0].y, 24)
})

test('buildArrangedNotePositions respects varying note sizes', () => {
  const notes = [
    { id: 'a', width: 300, height: 220 },
    { id: 'b', width: 240, height: 180 },
    { id: 'c', width: 280, height: 260 },
  ]
  const arranged = buildArrangedNotePositions(notes, { boardWidth: 700 })
  assert.equal(memoLayoutBoxesOverlap(arranged), false)
  assert.ok(arranged[1].x > arranged[0].x)
})

test('buildArrangedNotePositions wraps to next row when boardWidth exceeded', () => {
  const notes = [
    { id: 'a', width: 260, height: 200 },
    { id: 'b', width: 260, height: 200 },
    { id: 'c', width: 260, height: 200 },
  ]
  const arranged = buildArrangedNotePositions(notes, { boardWidth: 620 })
  assert.equal(memoLayoutBoxesOverlap(arranged), false)
  assert.equal(arranged[0].y, 24)
  assert.equal(arranged[1].y, 24)
  assert.ok(arranged[2].y > arranged[0].y + 200)
})

test('buildArrangedNotePositions uses row max height for next row y', () => {
  const notes = [
    { id: 'a', width: 260, height: 200 },
    { id: 'b', width: 260, height: 320 },
    { id: 'c', width: 260, height: 200 },
  ]
  const arranged = buildArrangedNotePositions(notes, { boardWidth: 620 })
  assert.equal(arranged[2].y, 24 + 320 + 24)
})

test('buildArrangedNotePositions uses minimized height for collapsed notes', () => {
  const notes = [
    { id: 'a', width: 260, height: 200, x: 0, y: 0 },
    { id: 'b', width: 260, height: 200, x: 0, y: 0 },
  ]
  const arranged = buildArrangedNotePositions(notes, {
    boardWidth: 900,
    minimizedNoteIds: ['b'],
  })
  assert.equal(arranged[1].height, MEMO_MINIMIZED_HEIGHT)
  assert.equal(memoLayoutBoxesOverlap(arranged), false)
})
