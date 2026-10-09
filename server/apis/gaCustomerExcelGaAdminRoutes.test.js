import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const apiSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'gaCustomerExcelApi.js'), 'utf8')

describe('gaCustomerExcelApi GA_ADMIN routes', () => {
  it('registers scoped settings GET/PUT for GA_ADMIN', () => {
    assert.match(apiSource, /apiRouter\.get\('\/ga-admin\/customer-excel\/settings'/)
    assert.match(apiSource, /apiRouter\.put\('\/ga-admin\/customer-excel\/settings'/)
    assert.match(apiSource, /\/ga-admin\/customer-excel\/sample/)
    assert.match(apiSource, /requireGaAdminRole/)
    assert.match(apiSource, /req\.gaAdminScopeGaId/)
    assert.match(apiSource, /persistGaCustomerExcelSettings/)
    assert.match(apiSource, /parseGaIdFromUser/)
  })
})
