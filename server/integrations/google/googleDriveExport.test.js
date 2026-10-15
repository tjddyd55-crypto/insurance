import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMultipartBody,
  createDriveExport,
  driveExportName,
  normalizeExportFileIds,
  readDriveTargetFolder,
} from './googleDriveExport.js'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const pdf = Buffer.from('%PDF-1.4 test')
const files = {
  1: { id: 1, customer_id: null, mime_type: 'application/pdf', display_name: 'a/b.pdf', file_size: pdf.length, file_path: 'p1' },
  2: { id: 2, customer_id: 9, mime_type: 'application/pdf', display_name: 'c.pdf', file_size: 10, file_path: 'p2' },
  3: { id: 3, customer_id: null, mime_type: 'application/zip', display_name: 'z.zip', file_size: 10, file_path: 'p3' },
  4: { id: 4, customer_id: null, mime_type: 'image/png', display_name: 'big.png', file_size: 30 * 1024 * 1024, file_path: 'p4' },
}

function makeExport(fetchImpl, extra = {}) {
  return createDriveExport({
    pool: {},
    assertReady: async () => ({}),
    getOwnedFile: async (id) => files[id] ?? null,
    readBuffer: async () => pdf,
    withAccess: async (_u, run) => run('tok'),
    fetchImpl,
    ...extra,
  })
}
const req = { user: { id: 'u1' } }

test('name / ids normalization', () => {
  assert.equal(driveExportName('a/b\\c.pdf'), 'a b c.pdf')
  assert.equal(driveExportName(''), 'onefc-file')
  assert.deepEqual(normalizeExportFileIds([1, '1', 2]), [1, 2])
  assert.throws(() => normalizeExportFileIds([]), { code: 'export_no_files' })
  assert.throws(() => normalizeExportFileIds([0]), { code: 'export_no_files' })
  assert.throws(() => normalizeExportFileIds(Array.from({ length: 11 }, (_, i) => i + 1)), { code: 'export_too_many' })
})

test('multipart body contains metadata and bytes', () => {
  const mp = buildMultipartBody({ name: 'x' }, pdf, 'application/pdf')
  const text = mp.body.toString('latin1')
  assert.match(mp.contentType, /^multipart\/related; boundary=onefc/)
  assert.ok(text.includes('{"name":"x"}') && text.includes('%PDF-1.4 test'))
})

test('target folder: root default, non-folder rejected, canAddChildren false rejected', async () => {
  assert.deepEqual(await readDriveTargetFolder({ accessToken: 't' }, null), { id: 'root', name: '내 드라이브' })
  await assert.rejects(readDriveTargetFolder({ accessToken: 't' }, '../x'), { code: 'export_folder_invalid' })
  const f1 = async () => json(200, { id: 'folderAAAAAA', mimeType: 'application/pdf', name: 'n' })
  await assert.rejects(readDriveTargetFolder({ accessToken: 't', fetchImpl: f1 }, 'folderAAAAAA'), { code: 'export_folder_invalid' })
  const f2 = async () => json(200, { id: 'folderAAAAAA', mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } })
  await assert.rejects(readDriveTargetFolder({ accessToken: 't', fetchImpl: f2 }, 'folderAAAAAA'), { code: 'export_folder_not_writable' })
  const f3 = async () => json(404, {})
  await assert.rejects(readDriveTargetFolder({ accessToken: 't', fetchImpl: f3 }, 'folderAAAAAA'), { code: 'export_folder_invalid' })
})

test('export: only POST create to Drive, guards per file', async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init.method })
    if (init.method === 'GET') return json(200, { id: 'folderAAAAAA', name: 'QA', mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } })
    const body = init.body.toString('latin1')
    assert.ok(body.includes('"parents":["folderAAAAAA"]'))
    return json(200, { id: 'newfile123456', name: 'a b.pdf', size: String(pdf.length) })
  }
  const out = await makeExport(fetchImpl)(req, { fileIds: [1, 2, 3, 4, 99], driveFolderId: 'folderAAAAAA', gaId: 1 })
  assert.equal(out.status, 200)
  assert.equal(out.body.okCount, 1)
  assert.deepEqual(out.body.results.map((r) => r.code ?? 'ok'), ['ok', 'file_customer', 'file_type', 'file_too_large', 'file_not_found'])
  assert.ok(calls.every((c) => c.method === 'GET' || c.method === 'POST'))
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
  assert.match(calls.find((c) => c.method === 'POST').url, /upload\/drive\/v3\/files\?uploadType=multipart/)
})

test('export: folder not writable (403 on create) becomes request error', async () => {
  const fetchImpl = async (_url, init) => init.method === 'GET'
    ? json(200, { id: 'folderAAAAAA', mimeType: 'application/vnd.google-apps.folder' })
    : json(403, { error: { errors: [{ reason: 'insufficientFilePermissions' }] } })
  const out = await makeExport(fetchImpl)(req, { fileIds: [1], driveFolderId: 'folderAAAAAA' })
  assert.equal(out.status, 403)
  assert.equal(out.body.code, 'export_folder_not_writable')
})

test('export: size mismatch reported as failure', async () => {
  const fetchImpl = async (_url, init) => init.method === 'GET' ? json(200, {}) : json(200, { id: 'x1234567890', size: '1' })
  const out = await makeExport(fetchImpl)(req, { fileIds: [1], driveFolderId: null })
  assert.equal(out.body.okCount, 0)
  assert.equal(out.body.results[0].code, 'upload_failed')
})

test('export: double request blocked, disabled flag, not logged in', async () => {
  let release
  const gate = new Promise((r) => { release = r })
  const slow = makeExport(async (_u, init) => { await gate; return init.method === 'GET' ? json(200, {}) : json(200, { id: 'x1234567890', size: String(pdf.length) }) })
  const first = slow(req, { fileIds: [1] })
  const second = await slow(req, { fileIds: [1] })
  assert.equal(second.status, 409)
  assert.equal(second.body.code, 'export_in_progress')
  release()
  assert.equal((await first).status, 200)
  const disabled = makeExport(async () => json(200, {}), { assertReady: async () => { const e = new Error('x'); e.code = 'drive_disabled'; throw e } })
  assert.equal((await disabled(req, { fileIds: [1] })).status, 403)
  assert.equal((await disabled({ user: {} }, { fileIds: [1] })).status, 401)
})
