import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  INSURER_MANAGER_REFERENCE_GA_CODE,
  listInsurerManagerCompanyChoicesForGa,
} from './insurerManagerCompanyChoices.js'

const indexSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.js'), 'utf8')

describe('insurerManagerCompanyChoices', () => {
  it('registers company-choices route on insurer-managers API', () => {
    assert.match(indexSource, /\/insurer-managers\/company-choices/)
    assert.match(indexSource, /listInsurerManagerCompanyChoicesForGa/)
  })

  it('uses YJASSET reference GA code constant', () => {
    assert.equal(INSURER_MANAGER_REFERENCE_GA_CODE, 'YJASSET')
  })

  it('rejects missing gaId', async () => {
    await assert.rejects(
      () => listInsurerManagerCompanyChoicesForGa({ connect: async () => ({}) }, null),
      /GA 컨텍스트/,
    )
  })
})
