import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('personal binder schema defines folder table and nullable folder_id', async () => {
  const source = await readFile(new URL('./personalBinderSchema.js', import.meta.url), 'utf8')
  assert.match(source, /personal_binder_folders/)
  assert.match(source, /folder_type IN \('material', 'binder'\)/)
  assert.match(source, /personal_binder_materials[\s\S]*folder_id/)
  assert.match(source, /personal_binders[\s\S]*folder_id/)
  assert.match(source, /ON DELETE SET NULL/)
})

test('personal binder API exposes folder routes and scoped writes', async () => {
  const apiSource = await readFile(new URL('../apis/personalBinderApi.js', import.meta.url), 'utf8')
  const registerSource = await readFile(
    new URL('./binderMaterialRegister.js', import.meta.url),
    'utf8',
  )
  assert.match(apiSource, /\/personal-binders\/folders/)
  assert.match(apiSource, /resolveFolderIdForWrite/)
  assert.match(registerSource, /INSERT INTO personal_binder_materials[\s\S]*folder_id/)
})
