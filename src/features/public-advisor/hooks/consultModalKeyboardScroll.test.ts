import { describe, expect, it } from 'vitest'

import { createModalLayerStack } from '../../../hooks/backButtonCloseHistory'
import {
  focusedFieldScrollDelta,
  focusedFieldUsableBottom,
  isKeyboardOpen,
} from './consultModalKeyboardScroll'

describe('focusedFieldScrollDelta', () => {
  it('이미 usable 영역 안이면 스크롤하지 않는다', () => {
    expect(
      focusedFieldScrollDelta({
        fieldTop: 120,
        fieldBottom: 168,
        visibleTop: 80,
        visibleBottom: 500,
      }),
    ).toBe(0)
  })

  it('아래가 가려진 거리만 스크롤한다', () => {
    expect(
      focusedFieldScrollDelta({
        fieldTop: 460,
        fieldBottom: 520,
        visibleTop: 80,
        visibleBottom: 500,
      }),
    ).toBe(20)
  })

  it('위가 가려지면 그만큼만 되돌린다', () => {
    expect(
      focusedFieldScrollDelta({
        fieldTop: 40,
        fieldBottom: 96,
        visibleTop: 80,
        visibleBottom: 500,
      }),
    ).toBe(-40)
  })
})

describe('focusedFieldUsableBottom', () => {
  it('키보드가 닫혀 있으면 footer 위를 usable bottom 으로 쓴다', () => {
    expect(
      focusedFieldUsableBottom({
        viewportOffsetTop: 0,
        viewportHeight: 844,
        keyboardOpen: false,
        footerTop: 771,
        paddingPx: 12,
      }),
    ).toBe(759)
  })

  it('키보드가 열려 footer 가 흐름 안이면 visual viewport 하단만 쓴다', () => {
    expect(
      focusedFieldUsableBottom({
        viewportOffsetTop: 0,
        viewportHeight: 508,
        keyboardOpen: true,
        footerTop: 640,
        paddingPx: 12,
      }),
    ).toBe(496)
  })
})

describe('isKeyboardOpen', () => {
  it('visualViewport 가 레이아웃보다 충분히 작을 때만 키보드로 본다', () => {
    expect(isKeyboardOpen(844, 844)).toBe(false)
    expect(isKeyboardOpen(844, 800)).toBe(false)
    expect(isKeyboardOpen(844, 508)).toBe(true)
  })
})

describe('modalLayerStack', () => {
  it('위에 열린 레이어만 top 이다', () => {
    const stack = createModalLayerStack()
    stack.push('consult')
    stack.push('privacy')
    expect(stack.isTop('privacy')).toBe(true)
    expect(stack.isTop('consult')).toBe(false)
    stack.remove('privacy')
    expect(stack.isTop('consult')).toBe(true)
  })
})
