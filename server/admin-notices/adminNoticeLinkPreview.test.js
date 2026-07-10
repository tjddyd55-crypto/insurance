import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertSafeExternalUrl,
  isPrivateOrReservedIp,
  parseLinkPreviewFromHtml,
} from './adminNoticeLinkPreview.js'

test('assertSafeExternalUrl blocks localhost and private networks', () => {
  assert.throws(() => assertSafeExternalUrl('http://localhost/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://127.0.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://10.0.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://192.168.0.1/test'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('http://169.254.169.254/latest'), /blocked_url|invalid_url/)
  assert.throws(() => assertSafeExternalUrl('javascript:alert(1)'), /invalid_url/)
  assert.throws(() => assertSafeExternalUrl('file:///etc/passwd'), /invalid_url/)
  assert.throws(() => assertSafeExternalUrl('data:text/html,hi'), /invalid_url/)
})

test('assertSafeExternalUrl allows public https URLs', () => {
  assert.equal(assertSafeExternalUrl('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc')
})

test('isPrivateOrReservedIp covers ipv4 ranges and metadata', () => {
  assert.equal(isPrivateOrReservedIp('10.1.2.3'), true)
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true)
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true)
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true)
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false)
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
  assert.equal(preview?.imageUrl, 'https://cdn.example/thumb.jpg')
  assert.equal(preview?.siteName, 'Example')
  assert.equal(preview?.domain, 'example.com')
})

test('parseLinkPreviewFromHtml falls back to title and description meta', () => {
  const html = `<!doctype html>
<html>
  <head>
    <title>Fallback Title</title>
    <meta name="description" content="Fallback Desc" />
    <meta name="twitter:image" content="/img/a.png" />
  </head>
  <body></body>
</html>`

  const preview = parseLinkPreviewFromHtml(html, 'https://example.com/page')
  assert.equal(preview?.title, 'Fallback Title')
  assert.equal(preview?.description, 'Fallback Desc')
  assert.equal(preview?.image, 'https://example.com/img/a.png')
})
