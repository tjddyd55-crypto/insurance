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
