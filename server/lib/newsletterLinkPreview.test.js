import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSafeExternalUrl } from '../admin-notices/adminNoticeLinkPreview.js'
import {
  extractLinkPreviewFromBody,
  extractNewsletterLinkPreviewFromPayload,
  fetchNewsletterLinkPreviewForApi,
  normalizeNewsletterLinkPreview,
  parseNewsletterPayload,
  resolveNewsletterDetailLinkPreview,
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

test('parseNewsletterPayload parses JSON string payload', () => {
  const payload = parseNewsletterPayload(
    JSON.stringify({
      linkPreview: { url: 'https://example.com/', title: '제목' },
    }),
  )
  assert.equal(payload.linkPreview?.url, 'https://example.com/')
})

test('resolveNewsletterDetailLinkPreview prefers top-level linkPreview', () => {
  const preview = resolveNewsletterDetailLinkPreview({
    linkPreview: { url: 'https://top.example/' },
    payload: { linkPreview: { url: 'https://payload.example/' } },
  })
  assert.equal(preview?.url, 'https://top.example/')
})

test('resolveNewsletterDetailLinkPreview falls back to payload.linkPreview', () => {
  const preview = resolveNewsletterDetailLinkPreview({
    payload: {
      linkPreview: {
        url: 'https://thedoum-counseling.co.kr/',
        title: '내 보험금 조금 더 받기 프로젝트',
      },
    },
  })
  assert.equal(preview?.url, 'https://thedoum-counseling.co.kr/')
  assert.equal(preview?.title, '내 보험금 조금 더 받기 프로젝트')
})

test('extractNewsletterLinkPreviewFromPayload returns null for empty payload', () => {
  assert.equal(extractNewsletterLinkPreviewFromPayload({}), null)
})

test('assertSafeExternalUrl blocks localhost and private ips', () => {
  assert.throws(() => assertSafeExternalUrl('http://localhost/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://127.0.0.1/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://192.168.0.1/x'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('javascript:alert(1)'), /invalid_url/)
  assert.equal(assertSafeExternalUrl('https://example.com/page'), 'https://example.com/page')
})

test('fetchNewsletterLinkPreviewForApi returns null preview for empty url', async () => {
  const result = await fetchNewsletterLinkPreviewForApi('')
  assert.deepEqual(result, { success: true, preview: null })
  const whitespace = await fetchNewsletterLinkPreviewForApi('   ')
  assert.deepEqual(whitespace, { success: true, preview: null })
})
