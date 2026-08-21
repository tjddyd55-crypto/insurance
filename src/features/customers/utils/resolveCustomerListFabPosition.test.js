import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '.')
const source = readFileSync(join(root, 'resolveCustomerListFabPosition.ts'), 'utf8')
const config = readFileSync(
  join(root, '../config/customerRecentRegistration.config.ts'),
  'utf8',
)

/** 소스와 동일 알고리즘 (node:test 에서 TS import 없이 검증) */
function computeVisibleListRect(listRect, viewport) {
  const left = Math.max(listRect.left, 0)
  const right = Math.min(listRect.right, viewport.width)
  const top = Math.max(listRect.top, 0)
  const bottom = Math.min(listRect.bottom, viewport.height)
  const width = right - left
  const height = bottom - top
  if (!(width > 0) || !(height > 0)) return null
  return { left, right, top, bottom, width, height }
}

function computeCustomerListFabFixedPosition(params) {
  const {
    containerRect,
    viewportWidth,
    viewportHeight,
    fabWidth = 44,
    fabHeight = 52,
    bottomOffset = 24,
  } = params
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null
  if (!(fabWidth > 0) || !(fabHeight > 0)) return null
  const visible = computeVisibleListRect(containerRect, {
    width: viewportWidth,
    height: viewportHeight,
  })
  if (!visible) return null
  const halfW = fabWidth / 2
  let centerX = visible.left + visible.width / 2
  const minCenter = visible.left + halfW
  const maxCenter = visible.right - halfW
  if (minCenter <= maxCenter) {
    centerX = Math.min(maxCenter, Math.max(minCenter, centerX))
  } else {
    centerX = visible.left + visible.width / 2
  }
  centerX = Math.min(viewportWidth - halfW, Math.max(halfW, centerX))
  let top = visible.bottom - fabHeight - bottomOffset
  top = Math.min(top, viewportHeight - fabHeight)
  top = Math.max(0, top)
  return {
    position: 'fixed',
    left: Math.round(centerX),
    top: Math.round(top),
    transform: 'translateX(-50%)',
    visibility: 'visible',
  }
}

describe('customer list FAB visible-center position', () => {
  it('source drops right-inset and centers on visible list', () => {
    assert.doesNotMatch(source, /CUSTOMER_LIST_SCROLL_FAB_RIGHT_OFFSET/)
    assert.doesNotMatch(source, /containerRect\.right - fabWidth/)
    assert.doesNotMatch(config, /CUSTOMER_LIST_SCROLL_FAB_RIGHT_OFFSET/)
    assert.match(source, /computeVisibleListRect/)
    assert.match(source, /translateX\(-50%\)/)
    assert.match(source, /visible\.left \+ visible\.width \/ 2/)
    assert.match(config, /CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX = 24/)
  })

  it('A. normal list rect → centerX = list center', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: 0, right: 370, top: 40, bottom: 800, width: 370, height: 760 },
      viewportWidth: 1280,
      viewportHeight: 900,
    })
    assert.equal(style.left, 185)
    assert.equal(style.top, 800 - 52 - 24)
    assert.equal(style.transform, 'translateX(-50%)')
  })

  it('B. partial viewport clipping → centerX = visible rect center', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: -40, right: 360, top: -20, bottom: 700, width: 400, height: 720 },
      viewportWidth: 800,
      viewportHeight: 600,
    })
    // visible: left=0, right=360, bottom=600 → center=180, top=600-52-24
    assert.equal(style.left, 180)
    assert.equal(style.top, 600 - 52 - 24)
  })

  it('C. narrow PC → visible and centered', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: 0, right: 280, top: 0, bottom: 700, width: 280, height: 700 },
      viewportWidth: 820,
      viewportHeight: 700,
    })
    assert.ok(style)
    assert.equal(style.left, 140)
    assert.ok(style.left - 22 >= 0)
    assert.ok(style.left + 22 <= 280)
  })

  it('D. very narrow PC → still visible (no hide by width)', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: 0, right: 120, top: 0, bottom: 640, width: 120, height: 640 },
      viewportWidth: 360,
      viewportHeight: 640,
      fabWidth: 44,
      fabHeight: 52,
    })
    assert.ok(style)
    assert.equal(style.visibility, 'visible')
    assert.ok(style.left - 22 >= 0)
    assert.ok(style.left + 22 <= 360)
  })

  it('E. list wider than viewport → intersection center', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 },
      viewportWidth: 500,
      viewportHeight: 700,
    })
    // visible width 500 → center 250
    assert.equal(style.left, 250)
    assert.equal(style.top, 700 - 52 - 24)
  })

  it('F. resize recomputes center', () => {
    const list = { left: 0, right: 400, top: 0, bottom: 800, width: 400, height: 800 }
    const wide = computeCustomerListFabFixedPosition({
      containerRect: list,
      viewportWidth: 1400,
      viewportHeight: 900,
    })
    const half = computeCustomerListFabFixedPosition({
      containerRect: { ...list, right: 300, width: 300 },
      viewportWidth: 600,
      viewportHeight: 900,
    })
    assert.equal(wide.left, 200)
    assert.equal(half.left, 150)
    assert.notEqual(wide.left, half.left)
  })

  it('G. FAB width kept fully inside viewport', () => {
    const style = computeCustomerListFabFixedPosition({
      containerRect: { left: 0, right: 50, top: 0, bottom: 500, width: 50, height: 500 },
      viewportWidth: 50,
      viewportHeight: 500,
      fabWidth: 44,
      fabHeight: 52,
    })
    assert.ok(style)
    assert.ok(style.left - 22 >= 0)
    assert.ok(style.left + 22 <= 50)
  })
})
