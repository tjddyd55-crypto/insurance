import { test } from 'node:test'
import assert from 'node:assert/strict'

function normalizeInsurerNewsObjectKeyForCdn(objectKey) {
  return String(objectKey ?? '')
    .trim()
    .replace(/^\//, '')
    .replace(/^platform-assets\//, '')
}

function cdnUrlForObjectKey(objectKey, base = 'https://cdn.platform-assets.com') {
  const key = normalizeInsurerNewsObjectKeyForCdn(objectKey)
  if (!key) {
    return ''
  }
  return `${base.replace(/\/$/, '')}/${key}`
}

function pickInsurerNewsAttachmentUrl(row) {
  const objectKey = String(row.objectKey ?? '').trim()
  if (objectKey) {
    return cdnUrlForObjectKey(objectKey)
  }
  const url = String(row.url ?? '').trim()
  return url
}

test('cdnUrlForObjectKey: platform-assets prefix 제거', () => {
  const url = cdnUrlForObjectKey('platform-assets/insurer/yjasset/uuid/file.jpg')
  assert.equal(url, 'https://cdn.platform-assets.com/insurer/yjasset/uuid/file.jpg')
})

test('pickInsurerNewsAttachmentUrl: objectKey가 구형 url보다 우선', () => {
  const legacyUrl =
    'https://cdn.platform-assets.com/insurer/yjasset/news/2026-04/삼성화재/file.png'
  const objectKey =
    'insurer/yjasset/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/news/2026-04/삼성화재/file.png'
  const picked = pickInsurerNewsAttachmentUrl({ url: legacyUrl, objectKey })
  assert.equal(
    picked,
    'https://cdn.platform-assets.com/insurer/yjasset/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/news/2026-04/삼성화재/file.png',
  )
  assert.notEqual(picked, legacyUrl)
})
