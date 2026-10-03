import { describe, expect, it } from 'vitest'

import { validateAiImportAttachmentFile } from './aiSecretaryImportFile'

describe('validateAiImportAttachmentFile', () => {
  it('rejects unsupported extensions', () => {
    const file = { name: 'notes.pdf', size: 100 } as File
    expect(validateAiImportAttachmentFile(file)).toBe('현재 이 파일 형식은 아직 지원하지 않습니다.')
  })

  it('accepts xlsx', () => {
    const file = { name: 'customers.xlsx', size: 100 } as File
    expect(validateAiImportAttachmentFile(file)).toBeNull()
  })
})
