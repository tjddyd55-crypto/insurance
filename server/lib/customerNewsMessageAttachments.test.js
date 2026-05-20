import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assertCustomerNewsAttachmentReadable,
  assertCustomerNewsMessageObjectKey,
  buildCustomerNewsMessageObjectKey,
  findCustomerNewsAttachmentInPayload,
  normalizeCustomerNewsAttachments,
  resolveCustomerNewsAttachmentObjectKey,
  validateCustomerNewsMessageUpload,
} from './customerNewsMessageAttachments.js'

test('validateCustomerNewsMessageUpload: image ok', () => {
  const r = validateCustomerNewsMessageUpload('image/jpeg', 1024)
  assert.equal(r.ok, true)
})

test('validateCustomerNewsMessageUpload: pdf ok', () => {
  const r = validateCustomerNewsMessageUpload('application/pdf', 1024)
  assert.equal(r.ok, true)
})

test('validateCustomerNewsMessageUpload: rejects doc', () => {
  const r = validateCustomerNewsMessageUpload('application/msword', 1024)
  assert.equal(r.ok, false)
})

test('assertCustomerNewsMessageObjectKey: agent scoped', () => {
  const key = buildCustomerNewsMessageObjectKey('ga1', 'agent-1', 'test.pdf')
  assert.equal(assertCustomerNewsMessageObjectKey(key, 'agent-1', 'ga1'), true)
  assert.equal(assertCustomerNewsMessageObjectKey(key, 'agent-2', 'ga1'), false)
})

test('normalizeCustomerNewsAttachments: preserves stored attachment id', () => {
  const storedId = '11111111-2222-4333-8444-555555555555'
  const rows = normalizeCustomerNewsAttachments([
    {
      id: storedId,
      kind: 'image',
      url: 'https://cdn.example.com/a.jpg',
      objectKey: 'insurer/ga1/agent/customer-news-attachments/a.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
      sortOrder: 0,
    },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, storedId)
  assert.equal(rows[0].mimeType, 'image/jpeg')
})

test('normalizeCustomerNewsAttachments: generates id only when missing', () => {
  const rows = normalizeCustomerNewsAttachments([
    {
      kind: 'image',
      url: 'https://cdn.example.com/a.jpg',
      objectKey: 'insurer/ga1/agent/customer-news-attachments/a.jpg',
      fileName: 'photo.jpg',
    },
  ])
  assert.equal(rows.length, 1)
  assert.match(rows[0].id, /^[0-9a-f-]{36}$/i)
})

test('findCustomerNewsAttachmentInPayload: matches id and attachmentId', () => {
  const payload = {
    attachments: [
      { id: 'att-1', fileName: 'a.jpg', url: 'https://cdn/a.jpg' },
      { attachmentId: 'att-2', fileName: 'b.jpg', url: 'https://cdn/b.jpg' },
    ],
  }
  assert.equal(findCustomerNewsAttachmentInPayload(payload, 'att-1')?.fileName, 'a.jpg')
  assert.equal(findCustomerNewsAttachmentInPayload(payload, 'att-2')?.fileName, 'b.jpg')
  assert.equal(findCustomerNewsAttachmentInPayload(payload, 'missing'), null)
})

test('findCustomerNewsAttachmentInPayload: legacy numeric index fallback', () => {
  const payload = {
    attachments: [{ fileName: 'first.jpg' }, { fileName: 'second.jpg' }],
  }
  assert.equal(findCustomerNewsAttachmentInPayload(payload, '2')?.fileName, 'second.jpg')
})

test('normalizeCustomerNewsAttachments: keeps objectKey-only legacy rows', () => {
  const rows = normalizeCustomerNewsAttachments([
    {
      id: 'legacy-1',
      kind: 'image',
      objectKey: 'insurer/ga1/agent/customer-news-attachments/legacy.jpg',
      fileName: 'legacy.jpg',
      mimeType: 'image/png',
    },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'legacy-1')
  assert.equal(rows[0].objectKey, 'insurer/ga1/agent/customer-news-attachments/legacy.jpg')
})

test('resolveCustomerNewsAttachmentObjectKey: prefers objectKey over url', () => {
  const key = resolveCustomerNewsAttachmentObjectKey(
    {
      objectKey: 'insurer/ga1/agent/customer-news-attachments/a.jpg',
      url: 'https://cdn.example.com/other.jpg',
    },
    'https://cdn.example.com',
  )
  assert.equal(key, 'insurer/ga1/agent/customer-news-attachments/a.jpg')
})

test('resolveCustomerNewsAttachmentObjectKey: extracts from cdn url', () => {
  const key = resolveCustomerNewsAttachmentObjectKey(
    {
      url: 'https://cdn.example.com/insurer/ga1/agent/customer-news-attachments/a.jpg',
    },
    'https://cdn.example.com',
  )
  assert.equal(key, 'insurer/ga1/agent/customer-news-attachments/a.jpg')
})

test('assertCustomerNewsAttachmentReadable: customer-news message key', () => {
  const key = buildCustomerNewsMessageObjectKey('ga1', 'agent-1', 'photo.jpg')
  assert.equal(assertCustomerNewsAttachmentReadable(key, 'agent-1', 'ga1'), true)
})

test('assertCustomerNewsAttachmentReadable: storage files prefix', () => {
  assert.equal(assertCustomerNewsAttachmentReadable('files/agent-1/123-photo.jpg', 'agent-1', 'ga1'), true)
})

test('assertCustomerNewsAttachmentReadable: strips CRM R2 root prefix', () => {
  const prev = process.env.CRM_R2_OBJECT_ROOT
  process.env.CRM_R2_OBJECT_ROOT = 'crm-platform/development'
  try {
    const key = 'crm-platform/development/insurer/ga1/agent-1/customer-news-attachments/a.jpg'
    assert.equal(assertCustomerNewsAttachmentReadable(key, 'agent-1', 'ga1'), true)
  } finally {
    if (prev == null) {
      delete process.env.CRM_R2_OBJECT_ROOT
    } else {
      process.env.CRM_R2_OBJECT_ROOT = prev
    }
  }
})

test('assertCustomerNewsAttachmentReadable: rejects unrelated key', () => {
  assert.equal(assertCustomerNewsAttachmentReadable('other/agent-1/secret.pdf', 'agent-1', 'ga1'), false)
})
