import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSafeExternalUrl } from '../admin-notices/adminNoticeLinkPreview.js'
import {
  extractLinkPreviewFromBody,
  normalizeNewsletterLinkPreview,
} from './newsletterLinkPreview.js'

test('normalizeNewsletterLinkPreview returns null for empty', () => {
  assert.equal(normalizeNewsletterLinkPreview(null), null)
  assert.equal(normalizeNewsletterLinkPreview({}), null)
})

test('normalizeNewsletterLinkPreview maps fields', () => {
  const preview = normalizeNewsletterLinkPreview({
    url: 'https://example.com/a',
    title: '제목',
    description: '설명',
    imageUrl: 'https://example.com/i.jpg',
    siteName: 'Example',
  })
  assert.equal(preview?.url, 'https://example.com/a')
  assert.equal(preview?.title, '제목')
  assert.equal(preview?.domain, 'example.com')
})

test('extractLinkPreviewFromBody detects provided null as clear', () => {
  const result = extractLinkPreviewFromBody({ linkPreview: null })
  assert.equal(result.provided, true)
  assert.equal(result.linkPreview, null)
})

test('assertSafeExternalUrl blocks localhost and private ips', () => {
  assert.throws(() => assertSafeExternalUrl('http://localhost/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://127.0.0.1/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://192.168.0.1/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('javascript:alert(1)'), /invalid_url/)
  assert.equal(assertSafeExternalUrl('https://example.com/page'), 'https://example.com/page')
})
