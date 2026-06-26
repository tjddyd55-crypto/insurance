/** @typedef {{ x: number, y: number, width?: number, height?: number }} MemoLayoutNote */

export const MEMO_DEFAULT_X = 24
export const MEMO_DEFAULT_Y = 24
export const MEMO_DEFAULT_WIDTH = 260
export const MEMO_DEFAULT_HEIGHT = 200
export const MEMO_MIN_WIDTH = 220
export const MEMO_MIN_HEIGHT = 160

export const MEMO_ARRANGE_COLUMNS = [24, 300, 576]
export const MEMO_ARRANGE_START_Y = 24
export const MEMO_ARRANGE_ROW_STEP = 236

/**
 * @param {Pick<MemoLayoutNote, 'width'>} note
 */
export function noteWidth(note) {
  return Math.max(MEMO_MIN_WIDTH, Number(note.width) || MEMO_DEFAULT_WIDTH)
}

/**
 * @param {Pick<MemoLayoutNote, 'height'>} note
 */
export function noteHeight(note) {
  return Math.max(MEMO_MIN_HEIGHT, Number(note.height) || MEMO_DEFAULT_HEIGHT)
}

/**
 * @param {MemoLayoutNote} note
 * @param {number} boardWidth
 * @param {number} boardHeight
 */
export function clampNotePosition(note, boardWidth, boardHeight) {
  const w = noteWidth(note)
  const h = noteHeight(note)
  const maxX = Math.max(0, boardWidth - w)
  const maxY = Math.max(0, boardHeight - h)
  const rawX = Number.isFinite(Number(note.x)) ? Number(note.x) : MEMO_DEFAULT_X
  const rawY = Number.isFinite(Number(note.y)) ? Number(note.y) : MEMO_DEFAULT_Y
  return {
    x: Math.max(MEMO_DEFAULT_X, Math.min(rawX < 0 ? MEMO_DEFAULT_X : rawX, maxX || MEMO_DEFAULT_X)),
    y: Math.max(MEMO_DEFAULT_Y, Math.min(rawY < 0 ? MEMO_DEFAULT_Y : rawY, maxY || MEMO_DEFAULT_Y)),
  }
}

/** @param {number} count */
export function buildArrangedNotePositions(count) {
  const out = []
  for (let index = 0; index < count; index += 1) {
    const col = index % MEMO_ARRANGE_COLUMNS.length
    const row = Math.floor(index / MEMO_ARRANGE_COLUMNS.length)
    out.push({
      x: MEMO_ARRANGE_COLUMNS[col],
      y: MEMO_ARRANGE_START_Y + row * MEMO_ARRANGE_ROW_STEP,
    })
  }
  return out
}
