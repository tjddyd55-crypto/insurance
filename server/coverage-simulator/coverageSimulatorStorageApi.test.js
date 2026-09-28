import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('coverage simulator storage schema defines tenant columns', () => {
  const source = readFileSync(path.join(__dirname, 'coverageSimulatorStorageSchema.js'), 'utf8')
  assert.match(source, /owner_user_id/)
  assert.match(source, /ga_id/)
  assert.match(source, /legacy_client_id/)
})

test('storage service scopes queries by owner and ga', () => {
  const source = readFileSync(path.join(__dirname, 'coverageSimulatorStorageService.js'), 'utf8')
  assert.match(source, /owner_user_id = \$2 AND ga_id = \$3/)
  assert.match(source, /assertCustomerRowAccessibleByVisibility/)
})

test('storage API registers template and simulation routes', () => {
  const source = readFileSync(path.join(__dirname, '../apis/coverageSimulatorStorageApi.js'), 'utf8')
  assert.match(source, /\/coverage-simulator\/templates/)
  assert.match(source, /\/coverage-simulator\/simulations/)
  assert.match(source, /duplicate/)
})
