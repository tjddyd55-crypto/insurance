/** @typedef {{ x: number, y: number, width?: number, height?: number, id?: string }} MemoLayoutNote */

export const MEMO_DEFAULT_X = 24
export const MEMO_DEFAULT_Y = 24
export const MEMO_DEFAULT_WIDTH = 260
export const MEMO_DEFAULT_HEIGHT = 200
export const MEMO_MIN_WIDTH = 220
export const MEMO_MIN_HEIGHT = 160
export const MEMO_MINIMIZED_HEIGHT = 44

/** @deprecated fixed-column arrange — row-wrap uses note dimensions instead */
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
 * @param {MemoLayoutNote & { id?: string }} note
 * @param {{ minimizedNoteIds?: Set<string> | string[] }} [options]
 */
export function noteArrangeHeight(note, options = {}) {
  const ids = options.minimizedNoteIds
  const id = note.id != null ? String(note.id) : ''
  if (id && ids) {
    const set = ids instanceof Set ? ids : new Set(ids.map((v) => String(v)))
    if (set.has(id)) {
      return MEMO_MINIMIZED_HEIGHT
    }
  }
  return noteHeight(note)
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
 * @param {{ routedPage?: boolean, viewportHeight?: number, minimizedNoteIds?: Set<string> | string[] }} [options]
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
    return y + noteArrangeHeight(note, options)
  })
  const canvasBottom = Math.max(...bottoms) + 120
  if (routedPage) {
    return Math.max(routedMin, canvasBottom)
  }
  return canvasBottom
}

/**
 * Row-wrap arrange — each note keeps width/height; no overlap.
 *
 * @param {Array<MemoLayoutNote & { id: string }>} notes
 * @param {{
 *   boardWidth?: number,
 *   startX?: number,
 *   startY?: number,
 *   gapX?: number,
 *   gapY?: number,
 *   minimizedNoteIds?: Set<string> | string[],
 * }} [options]
 */
export function buildArrangedNotePositions(notes, options = {}) {
  const boardWidth = Number(options.boardWidth || 1200)
  const startX = Number(options.startX || 24)
  const startY = Number(options.startY || 24)
  const gapX = Number(options.gapX || 24)
  const gapY = Number(options.gapY || 24)

  let x = startX
  let y = startY
  let rowHeight = 0

  return notes.map((note) => {
    const width = noteWidth(note)
    const height = noteArrangeHeight(note, options)

    if (x > startX && x + width > boardWidth - startX) {
      x = startX
      y += rowHeight + gapY
      rowHeight = 0
    }

    const arranged = {
      id: note.id,
      x,
      y,
      width,
      height,
    }

    x += width + gapX
    rowHeight = Math.max(rowHeight, height)

    return arranged
  })
}

/** @param {Array<{ x: number, y: number, width: number, height: number }>} boxes */
export function memoLayoutBoxesOverlap(boxes) {
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]
      const b = boxes[j]
      const overlap = !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      )
      if (overlap) {
        return true
      }
    }
  }
  return false
}
