import { describe, expect, it } from 'vitest'
import { insertSmsMessageVariable } from './insertSmsMessageVariable'

describe('insertSmsMessageVariable', () => {
  it('inserts token at cursor position', () => {
    const result = insertSmsMessageVariable('안녕하세요. 안내드립니다.', '{고객명}', 7, 7)
    expect(result.text).toBe('안녕하세요. {고객명}안내드립니다.')
    expect(result.cursor).toBe(12)
  })

  it('replaces selected range with token', () => {
    const result = insertSmsMessageVariable('안녕하세요. 고객 안내드립니다.', '{고객명}', 7, 9)
    expect(result.text).toBe('안녕하세요. {고객명} 안내드립니다.')
    expect(result.cursor).toBe(12)
  })
})
