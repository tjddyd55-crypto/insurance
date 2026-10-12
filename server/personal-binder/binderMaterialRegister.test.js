import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('binder material register reuses existing material instead of duplicate error', async () => {
  const source = await readFile(new URL('./binderMaterialRegister.js', import.meta.url), 'utf8')
  assert.match(source, /findReusableBinderMaterial/)
  assert.match(source, /file_id = \$1/)
  assert.match(source, /reused: true/)
  assert.doesNotMatch(source, /이미 자료 보관함에 등록된 파일입니다/)
})
