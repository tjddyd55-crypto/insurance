import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertSafeExternalUrl,
  parseLinkPreviewFromHtml,
} from './adminNoticeLinkPreview.js'

test('assertSafeExternalUrl blocks localhost and private networks', () => {
  assert.throws(() => assertSafeExternalUrl('http://localhost/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://127.0.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://10.0.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://192.168.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('javascript:alert(1)'), /invalid_url/)
  assert.throws(() => assertSafeExternalUrl('file:///etc/passwd'), /invalid_url/)
})

test('assertSafeExternalUrl allows public https URLs', () => {
  assert.equal(assertSafeExternalUrl('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc')
})

test('parseLinkPreviewFromHtml extracts og metadata', () => {
  const html = `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="샘플 제목" />
    <meta property="og:description" content="샘플 설명" />
    <meta property="og:image" content="https://cdn.example/thumb.jpg" />
    <meta property="og:site_name" content="Example" />
    <link rel="canonical" href="https://example.com/page" />
  </head>
  <body></body>
</html>`

  const preview = parseLinkPreviewFromHtml(html, 'https://example.com/page')
  assert.equal(preview?.title, '샘플 제목')
  assert.equal(preview?.description, '샘플 설명')
  assert.equal(preview?.image, 'https://cdn.example/thumb.jpg')
  assert.equal(preview?.siteName, 'Example')
  assert.equal(preview?.domain, 'example.com')
})
