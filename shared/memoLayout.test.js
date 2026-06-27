import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MEMO_CANVAS_PADDING,
  MEMO_DEFAULT_X,
  MEMO_DEFAULT_Y,
  MEMO_MINIMIZED_HEIGHT,
  MEMO_ROUTED_BOARD_MIN_HEIGHT,
  buildArrangedNotePositions,
  clampMemoNoteDragPosition,
  clampNotePosition,
  clampNotePositionMin,
  getMemoBoardCanvasHeight,
  getMemoBoardCanvasSize,
  getMemoBoardCanvasWidth,
  getMemoBoardDragMaxX,
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

test('getMemoBoardVisibleNotes hides minimized notes on memo route', () => {
  const notes = [{ id: 'a' }, { id: 'b' }]
  const minimized = { a: true }
  assert.deepEqual(getMemoBoardVisibleNotes(notes, {}, true, minimized), [{ id: 'b' }])
})

test('clampNotePositionMin keeps negative coordinates inside left/top bounds only', () => {
  const next = clampNotePositionMin({ x: -40, y: -10, width: 260, height: 200 })
  assert.equal(next.x, MEMO_DEFAULT_X)
  assert.equal(next.y, MEMO_DEFAULT_Y)
})

test('clampNotePositionMin does not clamp right or bottom overflow', () => {
  const next = clampNotePositionMin({ x: 5000, y: 4000, width: 260, height: 200 })
  assert.equal(next.x, 5000)
  assert.equal(next.y, 4000)
})

test('getMemoBoardCanvasWidth does not expand when expandWidth is false', () => {
  const width = getMemoBoardCanvasWidth([{ x: 900, y: 24, width: 260, height: 200 }], {
    viewportWidth: 800,
    expandWidth: false,
  })
  assert.equal(width, 800)
})

test('getMemoBoardDragMaxX follows current board width', () => {
  const note = { x: 24, y: 24, width: 260, height: 200 }
  assert.equal(getMemoBoardDragMaxX(note, 800), 540)
  assert.equal(getMemoBoardDragMaxX(note, 1200), 940)
})

test('clampMemoNoteDragPosition keeps note inside PC board bounds', () => {
  const note = { x: 24, y: 24, width: 260, height: 200 }
  const inside = clampMemoNoteDragPosition(note, 5000, 4000, 800, 600)
  assert.equal(inside.x, 540)
  assert.equal(inside.y, 400)

  const widerBoard = clampMemoNoteDragPosition(note, 5000, 4000, 1200, 600)
  assert.equal(widerBoard.x, 940)
})

test('clampMemoNoteDragPosition does not allow negative coordinates', () => {
  const note = { x: 24, y: 24, width: 260, height: 200 }
  const next = clampMemoNoteDragPosition(note, -40, -10, 800, 600)
  assert.equal(next.x, 0)
  assert.equal(next.y, 0)
})

test('getMemoBoardCanvasWidth expands beyond viewport when notes extend to the right', () => {
  const width = getMemoBoardCanvasWidth([{ x: 900, y: 24, width: 260, height: 200 }], {
    viewportWidth: 390,
  })
  assert.ok(width >= 900 + 260 + MEMO_CANVAS_PADDING)
  assert.ok(width > 390)
})

test('getMemoBoardCanvasWidth expands when dragDraft position exceeds viewport', () => {
  const atRest = getMemoBoardCanvasWidth([{ id: 'a', x: 24, y: 24, width: 260, height: 200 }], {
    viewportWidth: 390,
  })
  assert.ok(atRest >= 390)

  const whileDragging = getMemoBoardCanvasWidth([{ id: 'a', x: 820, y: 24, width: 260, height: 200 }], {
    viewportWidth: 390,
  })
  assert.ok(whileDragging >= 820 + 260 + MEMO_CANVAS_PADDING)
  assert.ok(whileDragging > atRest)
})

test('getMemoBoardCanvasSize keeps horizontal and vertical expansion in sync with draft note', () => {
  const draftNotes = [{ id: 'a', x: 820, y: 1100, width: 260, height: 200 }]
  const size = getMemoBoardCanvasSize(draftNotes, {
    routedPage: true,
    viewportWidth: 390,
    viewportHeight: 800,
  })
  assert.ok(size.width >= 820 + 260 + MEMO_CANVAS_PADDING)
  assert.ok(size.height != null && size.height >= 1100 + 200 + MEMO_CANVAS_PADDING)
})

test('getMemoBoardCanvasSize includes draft note positions for drag expansion', () => {
  const size = getMemoBoardCanvasSize(
    [
      { x: 24, y: 24, width: 260, height: 200 },
      { x: 700, y: 900, width: 260, height: 200 },
    ],
    { routedPage: true, viewportWidth: 390, viewportHeight: 800 },
  )
  assert.ok(size.width >= 700 + 260 + MEMO_CANVAS_PADDING)
  assert.ok(size.height != null && size.height >= 900 + 200 + MEMO_CANVAS_PADDING)
})

test('getMemoBoardCanvasHeight expands beyond viewport when notes extend downward', () => {
  const height = getMemoBoardCanvasHeight([{ x: 24, y: 1200, width: 260, height: 200 }], {
    routedPage: true,
    viewportHeight: 800,
  })
  assert.ok(height != null && height >= MEMO_ROUTED_BOARD_MIN_HEIGHT)
  assert.ok(height >= 1200 + 200 + MEMO_CANVAS_PADDING)
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
