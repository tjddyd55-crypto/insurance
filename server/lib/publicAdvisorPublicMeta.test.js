import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAbsolutePublicUrl,
  defaultAdvisorOgImageUrl,
  injectPublicAdvisorProfileMeta,
} from './publicAdvisorPublicMeta.js'

test('injectPublicAdvisorProfileMeta adds og tags for published profile', () => {
  const html = '<html><head><title>ONE FC</title></head><body></body></html>'
  const req = { protocol: 'https', get: () => 'insurance-dev.up.railway.app', headers: {} }
  const out = injectPublicAdvisorProfileMeta(html, {
    title: '홍길동 FC | ONE FC',
    description: '한 줄 소개 · ABC금융서비스',
    imageUrl: 'https://cdn.example/photo.webp',
    canonicalUrl: buildAbsolutePublicUrl(req, '/fc/hong'),
    indexable: true,
  })
  assert.match(out, /property="og:title" content="홍길동 FC \| ONE FC"/)
  assert.match(out, /property="og:url" content="https:\/\/insurance-dev\.up\.railway\.app\/fc\/hong"/)
  assert.match(out, /name="robots" content="index, follow"/)
  assert.match(out, /rel="canonical" href="https:\/\/insurance-dev\.up\.railway\.app\/fc\/hong"/)
})

test('injectPublicAdvisorProfileMeta noindex when private', () => {
  const html = '<html><head><title>ONE FC</title></head><body></body></html>'
  const req = { protocol: 'https', get: () => 'localhost:3001', headers: {} }
  const out = injectPublicAdvisorProfileMeta(html, {
    title: '프로필 | ONE FC',
    description: '',
    imageUrl: defaultAdvisorOgImageUrl(req),
    canonicalUrl: buildAbsolutePublicUrl(req, '/fc/private'),
    indexable: false,
  })
  assert.match(out, /name="robots" content="noindex, nofollow"/)
})
