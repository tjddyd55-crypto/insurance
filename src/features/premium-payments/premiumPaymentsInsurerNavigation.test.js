import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const feature = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(feature, rel), 'utf8')

describe('card collection insurer navigation (left panel = insurers)', () => {
  it('sidebar title / search placeholder switch by mode', () => {
    const s = read('pages/overview/PremiumPaymentsCustomerSidebar.tsx')
    assert.match(s, /insurerMode \? '보험회사' : '카드 수납 고객'/)
    assert.match(s, /placeholder="보험회사 검색"/)
    assert.match(s, /placeholder="고객명 또는 연락처 검색"/)
    assert.match(s, /data-testid="card-insurer-item"/)
    // 보험사별 왼쪽에 고객 그룹/선택 상태가 없어야 함
    assert.doesNotMatch(s, /card-insurer-customer-group|card-insurer-filter/)
  })

  it('right panel nests customers once and reuses the existing contract table', () => {
    const d = read('pages/overview/PremiumPaymentsInsurerDetail.tsx')
    assert.match(d, /CollectionTargetsTable/)
    assert.match(d, /card-insurer-customer-group/)
    assert.match(d, /총 \{groups.length\}명 · \{contractCount\}건/)
  })

  it('insurer selection groups already-loaded rows (no per-insurer API call)', () => {
    const h = read('hooks/usePremiumPaymentsOverviewState.ts')
    assert.equal((h.match(/listCardPaymentContractsOverview\(/g) ?? []).length, 1)
    assert.match(h, /groupContractsByCustomerForInsurer\(rows, effectiveInsurerKey\)/)
    assert.match(h, /filterInsurerOptions\(insurerOptions, insurerSearch\)/)
  })
})
