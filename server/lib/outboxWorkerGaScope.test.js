import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('outbox GA scope contracts', () => {
  it('claim alimtalk worker selects and updates with ga_id', () => {
    const src = read('server/alimtalk/claimReceivedAlimtalk.js')
    assert.match(src, /WHERE ga_id = \$1/)
    assert.match(src, /AND ga_id = \$2/)
    assert.match(src, /listOutboxGaIdsWithDueRows/)
    assert.match(src, /quarantineOutboxRowsMissingGaId/)
    assert.match(src, /loadClaimAlimtalkRecipient\(db, input\.agentId, contextGaId\)/)
    assert.doesNotMatch(
      src,
      /SELECT \*\s+FROM claim_alimtalk_outbox\s+WHERE status IN \('PENDING', 'FAILED'\)/,
    )
  })

  it('workers prevent tick overlap and rate-limit identical errors', () => {
    const index = read('server/index.js')
    assert.match(index, /claimAlimtalkTickRunning/)
    assert.match(index, /registrationAlimtalkTickRunning/)
    assert.match(index, /lastClaimAlimtalkTickError/)
    assert.doesNotMatch(index, /processPendingPushOutbox/)
  })

  it('customer registration alimtalk worker is ga-scoped', () => {
    const src = read('server/alimtalk/customerRegistrationCompletedAlimtalk.js')
    assert.match(src, /WHERE ga_id = \$1/)
    assert.match(src, /AND ga_id = \$2/)
    assert.match(src, /listOutboxGaIdsWithDueRows/)
    assert.match(src, /customer_registration_alimtalk_outbox/)
  })

  it('outbox GA helper lists tenants via systemQuery only', () => {
    const helper = read('server/lib/outboxWorkerGaScope.js')
    assert.match(helper, /systemQuery/)
    assert.match(helper, /SELECT DISTINCT ga_id/)
    assert.match(helper, /import \{ systemQuery \}/)
    assert.doesNotMatch(helper, /import \{[^}]*safeQuery/)
  })
})
