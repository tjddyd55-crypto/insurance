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
/** `/memo` routed board — 아래쪽 드래그·배치용 최소 캔버스 높이(px) */
export const MEMO_ROUTED_BOARD_MIN_HEIGHT = 2400

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

/**
 * @param {Array<{ id: string }>} notes
 * @param {Record<string, boolean>} hiddenNotes
 * @param {boolean} isMemoRoute
 */
export function getMemoBoardVisibleNotes(notes, hiddenNotes, isMemoRoute) {
  if (isMemoRoute) {
    return notes
  }
  return notes.filter((note) => !hiddenNotes[note.id])
}

/**
 * @param {Array<MemoLayoutNote & { id?: string }>} notes
 * @param {{ routedPage?: boolean, viewportHeight?: number }} [options]
 * @returns {number | undefined}
 */
export function getMemoBoardCanvasHeight(notes, options = {}) {
  const routedPage = Boolean(options.routedPage)
  const viewportHeight = Math.max(0, Number(options.viewportHeight) || 720)
  const routedMin = Math.max(viewportHeight, MEMO_ROUTED_BOARD_MIN_HEIGHT)
  if (!notes.length) {
    return routedPage ? routedMin : undefined
  }
  const bottoms = notes.map((note) => {
    const y = Number.isFinite(Number(note.y)) ? Number(note.y) : MEMO_DEFAULT_Y
    return y + noteHeight(note)
  })
  const canvasBottom = Math.max(...bottoms) + 160
  if (routedPage) {
    return Math.max(routedMin, canvasBottom)
  }
  return canvasBottom
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
