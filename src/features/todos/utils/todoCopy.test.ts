import { describe, expect, it } from 'vitest'
import { firstLineTodoTitle, todoDisplayContent } from './todoCopy'

describe('firstLineTodoTitle', () => {
  it('uses first non-empty line up to 40 chars', () => {
    expect(firstLineTodoTitle('첫 줄\n둘째 줄')).toBe('첫 줄')
    expect(firstLineTodoTitle('  \n  메모 내용  ')).toBe('메모 내용')
    expect(firstLineTodoTitle('')).toBe('할일')
    expect(firstLineTodoTitle('a'.repeat(50))).toHaveLength(40)
  })
})

describe('todoDisplayContent', () => {
  it('prefers description then title fallback', () => {
    expect(todoDisplayContent({ description: '본문', title: '제목' })).toBe('본문')
    expect(todoDisplayContent({ description: '  ', title: '예전 제목' })).toBe('예전 제목')
    expect(todoDisplayContent({ description: null, title: null })).toBe('내용 없음')
    expect(todoDisplayContent({ description: '', title: '' })).toBe('내용 없음')
  })
})
