import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Mirrors src/features/insurer-sites/lib/adminInsurerSiteSaveBody.ts for node:test. */
function buildAdminInsurerSiteSaveBody(form) {
  const sortOrder = Number(form.sortOrder)
  const sort = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0
  return {
    category: form.category,
    name: form.name,
    logoPath: String(form.logoPath ?? '').trim(),
    salesUrl: form.salesUrl,
    homepageUrl: form.homepageUrl,
    disclosureUrl: form.disclosureUrl,
    sortOrder: sort,
    isActive: form.isActive,
  }
}

describe('insurer-sites UI policy (보상홈 미노출)', () => {
  it('user page has no 보상홈 / claimUrl usage', () => {
    const src = readFileSync(path.join(root, 'src/features/insurer-sites/pages/InsurerSitesPage.tsx'), 'utf8')
    assert.doesNotMatch(src, /보상홈/)
    assert.doesNotMatch(src, /claimUrl/)
    assert.match(src, /설계사이트 →/)
    assert.match(src, /공식홈/)
    assert.match(src, /공시실/)
    assert.match(src, /안내사항/)
  })

  it('admin page has no 보상홈 UI label and uses save helper', () => {
    const src = readFileSync(
      path.join(root, 'src/features/insurer-sites/pages/AdminInsurerSitesPage.tsx'),
      'utf8',
    )
    assert.doesNotMatch(src, /보상홈/)
    assert.match(src, /buildAdminInsurerSiteSaveBody/)
  })

  it('save body omits claimUrl so PATCH preserves DB value', () => {
    const body = buildAdminInsurerSiteSaveBody({
      category: 'life',
      name: '푸본현대생명',
      logoPath: '/assets/insurers/fubon.png',
      salesUrl: 'https://example.com/sales',
      homepageUrl: 'https://example.com/',
      disclosureUrl: '',
      sortOrder: '10',
      isActive: true,
    })
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'claimUrl'), false)
    assert.equal(body.sortOrder, 10)
    assert.equal(body.name, '푸본현대생명')
  })

  it('TS helper documents UI-only hide and has no claimUrl field', () => {
    const ts = readFileSync(
      path.join(root, 'src/features/insurer-sites/lib/adminInsurerSiteSaveBody.ts'),
      'utf8',
    )
    assert.doesNotMatch(ts, /claimUrl:/)
    assert.match(ts, /claimUrl은 UI 미노출/)
  })

  it('compact square card CSS keeps actions inside 200px box', () => {
    const css = readFileSync(path.join(root, 'src/features/insurer-sites/insurer-sites.css'), 'utf8')
    assert.match(css, /aspect-ratio:\s*1\s*\/\s*1/)
    assert.match(css, /--insurer-site-card-max:\s*200px/)
    assert.match(css, /\.insurer-site-card\s*\{[\s\S]*?box-sizing:\s*border-box/)
    assert.match(css, /grid-template-rows:/)
    assert.match(css, /--insurer-site-primary-h/)
    assert.match(css, /--insurer-site-secondary-h/)
    assert.match(css, /\.insurer-site-card__secondary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/)
    assert.match(css, /\.insurer-site-card__logo\s*\{[\s\S]*?background:\s*transparent/)
    assert.doesNotMatch(css, /보상홈/)
    assert.doesNotMatch(css, /margin-top:\s*auto/)
  })
})
