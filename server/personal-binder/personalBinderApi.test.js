import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

import {
  inspectBinderMaterialBuffer,
  normalizeOrder,
  normalizePageSelection,
} from '../apis/personalBinderApi.js'

test('personal binder material inspection accepts PDF, JPEG, and PNG', async () => {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  const pdfResult = await inspectBinderMaterialBuffer(
    Buffer.from(await pdf.save()),
    'application/pdf',
    'document.pdf',
  )
  const jpeg = await sharp({
    create: { width: 20, height: 30, channels: 3, background: '#ffffff' },
  }).jpeg().toBuffer()
  const png = await sharp(jpeg).png().toBuffer()
  assert.deepEqual(pdfResult, { mimeType: 'application/pdf', pageCount: 1 })
  assert.deepEqual(
    await inspectBinderMaterialBuffer(jpeg, 'image/jpeg', 'photo.jpg'),
    { mimeType: 'image/jpeg', pageCount: 1 },
  )
  assert.deepEqual(
    await inspectBinderMaterialBuffer(png, 'image/png', 'scan.png'),
    { mimeType: 'image/png', pageCount: 1 },
  )
})

test('personal binder material inspection rejects spoofed and corrupt images', async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
  }).jpeg().toBuffer()
  await assert.rejects(
    inspectBinderMaterialBuffer(jpeg, 'image/png', 'photo.png'),
    /형식/,
  )
  await assert.rejects(
    inspectBinderMaterialBuffer(Buffer.from('broken'), 'image/jpeg', 'photo.jpg'),
    /읽을 수/,
  )
})

test('personal binder page selection normalizes duplicates and order', () => {
  assert.deepEqual(normalizePageSelection([5, 3, 3, 4], 10), [3, 4, 5])
})

test('personal binder page selection accepts null as all pages', () => {
  assert.equal(normalizePageSelection(null, 10), null)
})

test('personal binder page selection rejects invalid and empty selections', () => {
  assert.throws(() => normalizePageSelection([], 10), /선택 페이지/)
  assert.throws(() => normalizePageSelection([0, 11], 10), /선택 페이지/)
})

test('personal binder API source enforces owner and GA scope', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../apis/personalBinderApi.js', import.meta.url), 'utf8'),
  )
  assert.match(source, /owner_user_id = \$2 AND ga_id = \$3/)
  assert.match(source, /b\.owner_user_id = \$2/)
  assert.match(source, /MATERIAL_IN_USE/)
  assert.match(source, /personal-binders\/:binderId\/export/)
  assert.match(source, /readOwnedMaterialPdf/)
  assert.doesNotMatch(source, /req\.body\?\.ownerUserId/)
  assert.doesNotMatch(source, /req\.body\?\.file_path|req\.body\?\.storageUrl|req\.body\?\.objectKey/)
})

test('personal binder reorder rejects missing or foreign ids', async () => {
  const client = {
    query: async (sql) => {
      if (String(sql).includes('SELECT')) return { rows: [{ id: 1 }, { id: 2 }] }
      return { rows: [], rowCount: 0 }
    },
  }
  await assert.rejects(
    () => normalizeOrder(
      client,
      'personal_binder_sections',
      'binder_id',
      10,
      ['1', '999'],
    ),
    /순서 변경 대상/,
  )
})

test('personal binder reorder writes normalized integer positions', async () => {
  const writes = []
  const client = {
    query: async (sql, params) => {
      if (String(sql).includes('SELECT')) return { rows: [{ id: 1 }, { id: 2 }] }
      writes.push({ sql: String(sql), params })
      return { rows: [], rowCount: 1 }
    },
  }
  await normalizeOrder(
    client,
    'personal_binder_sections',
    'binder_id',
    10,
    ['2', '1'],
  )
  assert.deepEqual(writes.slice(1).map((entry) => entry.params[0]), [0, 1])
})
