import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function buildContractSignatureSendPath(params) {
  const qs = new URLSearchParams()
  if (
    params.customerId != null &&
    Number.isInteger(params.customerId) &&
    params.customerId > 0
  ) {
    qs.set('customerId', String(params.customerId))
  }
  const returnTo = params.returnTo?.trim()
  if (returnTo) {
    qs.set('returnTo', returnTo)
  }
  const query = qs.toString()
  return query ? `/contracts/signatures/send?${query}` : '/contracts/signatures/send'
}

const historyPagePath = join(
  repoRoot,
  'src/features/contracts/userHistory/ContractSignatureHistoryPage.tsx',
)

describe('buildContractSignatureSendPath', () => {
  it('includes customerId and never points to dashboard', () => {
    const path = buildContractSignatureSendPath({ customerId: 42 })
    assert.equal(path, '/contracts/signatures/send?customerId=42')
    assert.ok(!path.includes('dashboard'))
  })

  it('adds returnTo when provided', () => {
    const path = buildContractSignatureSendPath({
      customerId: 7,
      returnTo: '/customers/7/files?customerId=7',
    })
    assert.ok(path.startsWith('/contracts/signatures/send?'))
    assert.ok(path.includes('customerId=7'))
    assert.ok(path.includes('returnTo=%2Fcustomers%2F7%2Ffiles'))
  })
})

describe('ContractSignatureHistoryPage workspace guard regression', () => {
  it('does not redirect customer workspace signatures to dashboard', () => {
    const source = readFileSync(historyPagePath, 'utf8')
    assert.ok(!source.includes('Navigate to="/dashboard"'))
    assert.ok(!source.includes('canAccessContractSignatureUserSend'))
  })
})
