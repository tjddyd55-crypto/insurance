import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAccountVaultSharePageTitle,
  injectAccountVaultShareMeta,
} from '../lib/accountVaultSharePublicMeta.js'

test('buildAccountVaultSharePageTitle uses owner display name', () => {
  assert.equal(buildAccountVaultSharePageTitle('박성용'), '박성용 계정관리')
  assert.equal(buildAccountVaultSharePageTitle('김철수'), '김철수 계정관리')
  assert.equal(buildAccountVaultSharePageTitle(''), '사용자 계정관리')
})

test('injectAccountVaultShareMeta sets og and twitter tags for valid owner', () => {
  const html = `<!doctype html><html><head><title>ONE FC</title></head><body></body></html>`
  const out = injectAccountVaultShareMeta(html, '박성용')

  assert.match(out, /<title>박성용 계정관리<\/title>/)
  assert.match(out, /property="og:title" content="박성용 계정관리"/)
  assert.match(out, /property="og:description" content="보험사 계정관리 페이지입니다."/)
  assert.match(out, /name="twitter:title" content="박성용 계정관리"/)
  assert.match(out, /name="twitter:description" content="보험사 계정관리 페이지입니다."/)
})

test('injectAccountVaultShareMeta leaves html unchanged without owner name', () => {
  const html = `<!doctype html><html><head><title>ONE FC</title></head><body></body></html>`
  assert.equal(injectAccountVaultShareMeta(html, null), html)
})
