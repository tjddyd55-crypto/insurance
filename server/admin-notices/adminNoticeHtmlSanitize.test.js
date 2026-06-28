import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePlainTextFromHtml, sanitizeAdminNoticeHtml } from './adminNoticeHtmlSanitize.js'

test('admin notice API clients must read unwrapped data fields', () => {
  const createEnvelope = { success: true, data: { id: 123, title: '공지' } }
  const presignEnvelope = {
    success: true,
    data: {
      uploadUrl: 'https://example.com/upload',
      publicUrl: 'https://cdn.example/a.png',
      storageKey: 'insurance/admin-notices/temp/u1/a.png',
    },
  }
  const created = createEnvelope.data
  const presign = presignEnvelope.data
  assert.equal(created.id, 123)
  assert.equal(presign.uploadUrl, 'https://example.com/upload')
  assert.match(presign.storageKey, /^insurance\/admin-notices\//)
})

test('sanitizeAdminNoticeHtml removes script tags and event handlers', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p>안내</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)" />',
  )
  assert.equal(sanitized.includes('<script'), false)
  assert.equal(sanitized.includes('onerror'), false)
  assert.equal(sanitized.includes('javascript:'), false)
  assert.match(sanitized, /안내/)
})

test('sanitizeAdminNoticeHtml keeps allowed formatting tags', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p style="text-align:center"><strong>제목</strong></p><p><img src="https://cdn.example/a.png" alt="a" /></p>',
  )
  assert.match(sanitized, /<strong>제목<\/strong>/)
  assert.match(sanitized, /<img[^>]+src="https:\/\/cdn\.example\/a\.png"/)
})

test('derivePlainTextFromHtml extracts readable text', () => {
  const plain = derivePlainTextFromHtml('<p>첫 줄</p><p><strong>둘째</strong></p>')
  assert.equal(plain, '첫 줄\n둘째')
})

test('sanitizeAdminNoticeHtml keeps anchor href target rel', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">링크</a></p>',
  )
  assert.match(sanitized, /href="https:\/\/example.com"/)
  assert.match(sanitized, /target="_blank"/)
  assert.match(sanitized, /rel="noopener noreferrer"/)
})

test('sanitizeAdminNoticeHtml keeps img src and alt', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p><img src="https://cdn.example/insurance/admin-notices/temp/u1/a.png" alt="안내" /></p>',
  )
  assert.match(sanitized, /src="https:\/\/cdn\.example\/insurance\/admin-notices\/temp\/u1\/a\.png"/)
  assert.match(sanitized, /alt="안내"/)
})

test('sanitizeAdminNoticeHtml keeps resized image width and style', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p><img src="https://cdn.example/a.png" alt="a" width="520" style="width: 520px; max-width: 100%; height: auto;" /></p>',
  )
  assert.match(sanitized, /width="520"/)
  assert.match(sanitized, /max-width:\s*100%/)
})

test('sanitizeAdminNoticeHtml keeps link preview card markup', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<div class="admin-notice-link-preview" data-url="https://example.com"><a href="https://example.com" target="_blank" rel="noopener noreferrer"><img src="https://cdn.example/thumb.jpg" alt="" /><div class="admin-notice-link-preview__body"><strong class="admin-notice-link-preview__title">제목</strong><p class="admin-notice-link-preview__description">설명</p><span class="admin-notice-link-preview__domain">example.com</span></div></a></div>',
  )
  assert.match(sanitized, /class="admin-notice-link-preview"/)
  assert.match(sanitized, /data-url="https:\/\/example.com"/)
  assert.match(sanitized, /admin-notice-link-preview__title/)
})

test('sanitizeAdminNoticeHtml removes javascript links from preview cards', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<div class="admin-notice-link-preview" data-url="javascript:alert(1)"><a href="javascript:alert(1)">bad</a></div>',
  )
  assert.equal(sanitized.includes('javascript:'), false)
})

test('sanitizeAdminNoticeHtml keeps img data-align and width together', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<p><img src="https://cdn.example/a.png" alt="a" width="520" data-align="center" style="width: 520px; max-width: 100%; height: auto;" /></p>',
  )
  assert.match(sanitized, /data-align="center"/)
  assert.match(sanitized, /width="520"/)
})

test('sanitizeAdminNoticeHtml keeps link preview data-url and data-align', () => {
  const sanitized = sanitizeAdminNoticeHtml(
    '<div class="admin-notice-link-preview" data-url="https://example.com" data-align="right"><a href="https://example.com" target="_blank" rel="noopener noreferrer"><div class="admin-notice-link-preview__body"><strong class="admin-notice-link-preview__title">제목</strong></div></a></div>',
  )
  assert.match(sanitized, /data-url="https:\/\/example.com"/)
  assert.match(sanitized, /data-align="right"/)
})
