import { describe, expect, it } from 'vitest'
import { BINDER_EMPTY_SECTION_MESSAGE, binderTocSectionAction } from './binderToc'

describe('binder TOC empty section', () => {
  it('keeps page navigation when the section has items', () => {
    expect(binderTocSectionAction(2)).toBe('navigate')
  })

  it('asks for the common empty notice when the section has no items', () => {
    expect(binderTocSectionAction(0)).toBe('empty')
    expect(BINDER_EMPTY_SECTION_MESSAGE).toBe('이 섹션에는 아직 자료가 없습니다.')
  })
})
