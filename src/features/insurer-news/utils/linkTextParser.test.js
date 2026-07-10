import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractFirstExternalUrl,
  normalizeTelHref,
  parseTextTokens,
  toAbsoluteHttpUrl,
} from './linkTextParser.js'

test('detects https and www urls', () => {
  const tokens = parseTextTokens('방문 https://example.com 과 www.naver.com')
  const urls = tokens.filter((t) => t.type === 'url')
  assert.equal(urls.length, 2)
  assert.equal(urls[0].href, 'https://example.com')
  assert.equal(urls[1].href, 'https://www.naver.com')
})

test('detects korean phone numbers', () => {
  const tokens = parseTextTokens('문의 010-1234-5678 / 1588-1234')
  const phones = tokens.filter((t) => t.type === 'phone')
  assert.equal(phones.length, 2)
  assert.equal(phones[0].href, 'tel:01012345678')
  assert.equal(phones[1].href, 'tel:15881234')
})

test('does not treat url path digits as phone', () => {
  const tokens = parseTextTokens('https://example.com/path/01012345678')
  assert.equal(tokens.filter((t) => t.type === 'phone').length, 0)
  assert.equal(tokens.filter((t) => t.type === 'url').length, 1)
})

test('does not treat date as phone', () => {
  const tokens = parseTextTokens('일정 2026-07-10')
  assert.equal(tokens.filter((t) => t.type === 'phone').length, 0)
})

test('does not treat amount-like numbers as phone', () => {
  const tokens = parseTextTokens('금액 1,234,567원 / 순위 3위')
  assert.equal(tokens.filter((t) => t.type === 'phone').length, 0)
})

test('detects landline and spaced mobile', () => {
  const tokens = parseTextTokens('02-123-4567 / 010 1234 5678')
  const phones = tokens.filter((t) => t.type === 'phone')
  assert.equal(phones.length, 2)
  assert.equal(phones[0].href, 'tel:021234567')
  assert.equal(phones[1].href, 'tel:01012345678')
})

test('normalizeTelHref strips separators', () => {
  assert.equal(normalizeTelHref('010 1234 5678'), '01012345678')
})

test('toAbsoluteHttpUrl prefixes www', () => {
  assert.equal(toAbsoluteHttpUrl('www.example.com'), 'https://www.example.com')
})

test('extractFirstExternalUrl returns first valid url', () => {
  assert.equal(
    extractFirstExternalUrl('안내 www.example.com 그리고 https://second.com'),
    'https://www.example.com',
  )
})

test('preserves line breaks as tokens', () => {
  const tokens = parseTextTokens('첫줄\n둘째줄')
  assert.ok(tokens.some((t) => t.type === 'lineBreak'))
})
