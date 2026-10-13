import assert from 'node:assert/strict'
import test from 'node:test'

test('insertPersonalFileFromShareCopy does not double-charge storage_used', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./personalBinderShareImportService.js', import.meta.url), 'utf8'),
  )
  const fnBlock = source.slice(
    source.indexOf('async function insertPersonalFileFromShareCopy'),
    source.indexOf('export async function importSharedPersonalBinder'),
  )
  assert.doesNotMatch(fnBlock, /storage_used/)
})
