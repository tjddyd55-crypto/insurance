import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('customer-app request compose success UX', () => {
  it('shows BaseDialog success and navigates to request list', () => {
    const src = readFileSync(
      join(root, 'src/features/customer-app/pages/CustomerAppRequestComposePage.tsx'),
      'utf8',
    )
    assert.match(src, /BaseDialog/)
    assert.match(src, /요청이 접수되었습니다/)
    assert.match(src, /보험 청구 요청이 정상적으로 접수되었습니다/)
    assert.match(src, /접수된 내용은 문의내역에서 확인할 수 있습니다/)
    assert.match(src, /문의내역 확인/)
    assert.match(src, /closeOnBackdrop=\{false\}/)
    assert.match(src, /closeOnEsc=\{false\}/)
    assert.match(src, /\/customer-app\/requests\?claimId=/)
    assert.match(src, /replace:\s*true/)
    assert.match(src, /submitLockRef/)
    assert.match(src, /created\?\.requestId/)
    assert.doesNotMatch(src, /요청이 전송되었습니다/)
  })
})
