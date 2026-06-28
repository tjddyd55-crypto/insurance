import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePlainTextFromHtml, sanitizeAdminNoticeHtml } from './adminNoticeHtmlSanitize.js'

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
