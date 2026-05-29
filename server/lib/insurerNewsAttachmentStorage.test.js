import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  deleteInsurerNewsR2ObjectsAfterDb,
  looksLikeInsurerNewsAttachmentObjectKey,
} from './insurerNewsAttachmentStorage.js'
import { isConsentR2Enabled } from './consentStorage.js'

test('looksLikeInsurerNewsAttachmentObjectKey: newsletter news path', () => {
  assert.equal(
    looksLikeInsurerNewsAttachmentObjectKey(
      'insurer/yjasset/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/news/2026-04/file.jpg',
    ),
    true,
  )
})

test('looksLikeInsurerNewsAttachmentObjectKey: generic insurer customer file is false', () => {
  assert.equal(
    looksLikeInsurerNewsAttachmentObjectKey('insurer/yjasset/customer-app-claims/file.jpg'),
    false,
  )
})

test('deleteInsurerNewsR2ObjectsAfterDb: R2 미구성이면 no-op', async () => {
  if (isConsentR2Enabled()) {
    return
  }
  const stats = await deleteInsurerNewsR2ObjectsAfterDb(['insurer/yjasset/uuid/news/a.jpg'], {
    op: 'test',
  })
  assert.equal(stats.attempted, 0)
  assert.equal(stats.deleted, 0)
})
