import { planBinderExport } from './exportPersonalBinderPdf.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerPersonalBinderApi } from '../apis/personalBinderApi.js'
import { registerCustomerExtraApi } from '../apis/customerExtraApi.js'
import { loadBinderDetail } from './personalBinderDetail.js'
import { resolveBinderMaterialTitle, resolveBinderMaterialRows } from './binderMaterialTitle.js'
import { insertPersonalBinderMaterial } from './binderMaterialRegister.js'
import { deleteStorageFileBatch } from '../lib/storageBatchDelete.js'
import { cleanupPersonalBinderRefsForDeletedStorageFile } from './personalBinderStorageFileSync.js'

const scope = { userId: 'owner', gaId: 7 }
function routerFor(register, pool) {
  const routes = new Map()
  const router = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map((method) =>
    [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]))
  register(router, { pool, requireAuth() {}, handleDbError(error) { throw error } })
  return routes
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

test('binder deletion removes structure and folder link, preserving library material and file', async () => {
  const writes = []
  const file = { id: 3, original_name: 'A.pdf' }
  const material = { id: 4, file_id: 3 }
  const client = { release() {}, async query(sql, params) {
    writes.push(String(sql))
    if (String(sql).includes('UPDATE personal_binders')) {
      assert.deepEqual(params, [1, 'owner', 7])
      assert.match(sql, /owner_user_id = \$2 AND ga_id = \$3/)
      assert.match(sql, /folder_id = NULL/)
    }
    return { rowCount: 1, rows: [{ id: 1 }] }
  } }
  const routes = routerFor(registerPersonalBinderApi, { connect: async () => client })
  const res = response()
  await routes.get('delete /personal-binders/:binderId')({ user: { id: 'owner', gaId: 7, ga_id: 7 }, params: { binderId: '1' } }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { ok: true })
  assert.ok(writes.some((sql) => sql.includes('DELETE FROM personal_binder_items')))
  assert.ok(writes.some((sql) => sql.includes('DELETE FROM personal_binder_sections')))
  assert.ok(writes.every((sql) => !/DELETE FROM (files|personal_binder_materials)|UPDATE files/.test(sql)))
  assert.equal(file.original_name, 'A.pdf')
  assert.equal(material.file_id, 3)
})

test('foreign binder deletion returns 404 without deleting structure', async () => {
  const writes = []
  const client = { release() {}, async query(sql) {
    writes.push(String(sql)); return { rowCount: 0, rows: [] }
  } }
  const routes = routerFor(registerPersonalBinderApi, { connect: async () => client })
  const res = response()
  await routes.get('delete /personal-binders/:binderId')({ user: { id: 'other', gaId: 7 }, params: { binderId: '1' } }, res)
  assert.equal(res.statusCode, 404)
  assert.ok(!writes.some((sql) => sql.includes('DELETE FROM')))
})

test('batch delete isolates failures and forwards explicit reference cleanup', async () => {
  const active = new Set([1, 2, 3])
  const run = (force) => deleteStorageFileBatch([1, 2, 3], force, async (id, remove) => {
    if (id === 2) return { status: 404 }
    if (id === 3 && !remove) return { status: 409, body: { code: 'BINDER_FILE_IN_USE' } }
    active.delete(id); return { status: 200 }
  })
  assert.deepEqual(await run(false), { deleted: [1], failed: [{ id: 2, reason: 'NOT_FOUND' }, { id: 3, reason: 'USED_IN_BINDER' }] })
  assert.deepEqual([...active], [2, 3])
  assert.deepEqual((await run(true)).deleted, [1, 3])
  await assert.rejects(() => deleteStorageFileBatch(Array(101).fill(1), false, () => {}), /100/)
  await assert.rejects(() => deleteStorageFileBatch(['1'], false, () => {}), /100/)
})

test('storage rename persists B.pdf, preserves original and isolates owner plus GA', async () => {
  const file = { id: 3, user_id: 'owner', ga_id: 7, original_name: 'A.pdf', display_name: 'A.pdf', status: 'active' }
  const pool = { async query(sql, params) {
    if (String(sql).includes('UPDATE files')) {
      assert.match(sql, /SET display_name = \$1/)
      assert.doesNotMatch(sql, /SET original_name/)
      assert.match(sql, /user_id = \$3[\s\S]*ga_id = \$4/)
      if (params[2] !== file.user_id || params[3] !== file.ga_id) return { rows: [], rowCount: 0 }
      file.display_name = params[0]
    } else if (params[1] !== file.user_id || params[2] !== file.ga_id) return { rows: [], rowCount: 0 }
    return { rows: [{ ...file }], rowCount: 1 }
  } }
  const routes = routerFor(registerCustomerExtraApi, pool)
  const rename = routes.get('patch /storage/files/:fileId')
  const res = response()
  await rename({ user: { id: 'owner', gaId: 7 }, params: { fileId: '3' }, body: { displayName: 'B.pdf' } }, res)
  assert.equal(file.display_name, 'B.pdf')
  assert.equal(file.original_name, 'A.pdf')
  for (const user of [{ id: 'other', gaId: 7 }, { id: 'owner', gaId: 8 }]) {
    const denied = response()
    await rename({ user, params: { fileId: '3' }, body: { displayName: 'C.pdf' } }, denied)
    assert.equal(denied.statusCode, 404)
  }
})

test('existing binder detail follows display name; explicit custom title survives C.pdf', async () => {
  let name = 'B.pdf'
  let custom = null
  const executor = { async query(sql, params) {
    if (sql.includes('FROM files')) {
      assert.deepEqual(params, [[3], 'owner', 7])
      return { rows: [{ id: 3, display_name: name, original_name: 'A.pdf' }] }
    }
    if (sql.includes('FROM personal_binders')) return { rows: [{ id: 1, title: 'Binder' }] }
    if (sql.includes('FROM personal_binder_sections')) return { rows: [{ id: 2, title: 'Section', sort_order: 0 }] }
    return { rows: [{ id: 5, section_id: 2, material_id: 4, file_id: 3,
      material_title: 'A.pdf', file_display_name: name, file_original_name: 'A.pdf', original_file_name: 'A.pdf', custom_title: custom, page_count: 2 }] }
  } }
  assert.equal((await loadBinderDetail(executor, 1, scope)).sections[0].items[0].material.title, 'B.pdf')
  assert.equal(resolveBinderMaterialTitle({ title: 'A', original_file_name: 'A.pdf', file_display_name: name }), 'B.pdf')
  custom = '상담 전용'; name = 'C.pdf'
  assert.equal((await loadBinderDetail(executor, 1, scope)).sections[0].items[0].material.title, '상담 전용')
  const rows = await resolveBinderMaterialRows(executor, [{ file_id: 3, title: 'B.pdf', source_display_name: 'B.pdf' }], scope)
  assert.equal(rows[0].title, 'C.pdf')
  assert.equal(resolveBinderMaterialTitle({ title: 'Unknown legacy', original_file_name: 'A.pdf', file_display_name: name }), 'Unknown legacy')
})

test('new inherited material records renamed source display name', async () => {
  await insertPersonalBinderMaterial({ async query(sql, params) {
    assert.match(sql, /source_display_name/)
    assert.equal(params[4], 'B.pdf')
    assert.equal(params[5], 'A.pdf')
    assert.equal(params[12], 'B.pdf')
    return { rows: [{ title: params[4] }] }
  } }, scope, { fileId: 3, title: 'B.pdf', originalFileName: 'A.pdf', pageCount: 2 })
})

test('file cleanup removes items and page selections, soft deletes material in same executor', async () => {
  const state = { items: [{ material: 4, page_selection: [1] }], deleted: false }
  await cleanupPersonalBinderRefsForDeletedStorageFile({ async query(sql, params) {
    assert.equal(params[1], 'owner'); assert.equal(params[2], 7)
    if (sql.includes('SELECT id')) return { rows: [{ id: 4 }] }
    assert.match(sql, /owner_user_id = \$2/); assert.match(sql, /ga_id = \$3/)
    if (sql.includes('DELETE FROM personal_binder_items')) state.items = []
    if (sql.includes('UPDATE personal_binder_materials')) state.deleted = true
    return { rowCount: 1, rows: [] }
  } }, scope, 3)
  assert.deepEqual(state.items, [])
  assert.equal(state.deleted, true)
})

test('batch route runs real single-delete policy with owner/GA isolation and reference cleanup', async () => {
  const files = new Map([1, 2, 3].map((id) => [id, { id, user_id: id === 2 ? 'other' : 'owner', ga_id: 7, file_size: 100, file_path: '', customer_id: null, team_id: null }]))
  let item = true
  let materialDeleted = false
  const query = async (sql, params = []) => {
    sql = String(sql)
    if (sql.includes('SELECT id, customer_id, file_path')) {
      const file = files.get(params[0])
      return file && file.user_id === params[1] && file.ga_id === params[2] && !file.deleted
        ? { rows: [file], rowCount: 1 } : { rows: [], rowCount: 0 }
    }
    if (sql.includes('SELECT m.id, m.title') || sql.includes('SELECT id FROM personal_binder_materials')) {
      assert.deepEqual(params.slice(1), ['owner', 7])
      return { rows: params[0] === 3 && !materialDeleted ? [{ id: 30, title: 'A.pdf' }] : [] }
    }
    if (sql.includes('FROM personal_binder_items i')) return { rows: item ? [{ id: 10, title: 'Binder', item_count: 1 }] : [] }
    if (sql.includes('UPDATE files')) {
      const file = files.get(params[0])
      assert.equal(params[1], 'owner'); assert.equal(params[2], 7)
      file.deleted = true
      return { rows: [{ id: file.id }], rowCount: 1 }
    }
    if (sql.includes('DELETE FROM personal_binder_items')) item = false
    if (sql.includes('UPDATE personal_binder_materials')) materialDeleted = true
    return { rows: [], rowCount: 1 }
  }
  const pool = { query, connect: async () => ({ query, release() {} }) }
  const routes = routerFor(registerCustomerExtraApi, pool)
  const handler = routes.get('delete /storage/files/batch')
  const request = { user: { id: 'owner', gaId: 7, gaCode: 'testga' }, body: { fileIds: [1, 2, 3] } }
  const first = response()
  await handler(request, first)
  assert.deepEqual(first.body, { deleted: [1], failed: [{ id: 2, reason: 'NOT_FOUND' }, { id: 3, reason: 'USED_IN_BINDER' }] })
  assert.equal(files.get(2).deleted, undefined)
  assert.equal(files.get(3).deleted, undefined)
  const second = response()
  await handler({ ...request, body: { fileIds: [3], removeBinderReferences: true } }, second)
  assert.deepEqual(second.body, { deleted: [3], failed: [] })
  assert.equal(item, false)
  assert.equal(materialDeleted, true)
  assert.equal(files.get(3).deleted, true)
})


test('active owned detail preserves viewer/page-image fields and PDF page selections', async () => {
  const executor = { async query(sql, params) {
    if (sql.includes('FROM personal_binders')) return { rows: [{ id: 1, title: 'Binder' }] }
    if (sql.includes('FROM personal_binder_sections')) return { rows: [{ id: 2, title: 'Section', sort_order: 0 }] }
    assert.match(sql, /INNER JOIN files f ON f.id = m.file_id/)
    assert.match(sql, /f.user_id = m.owner_user_id AND f.ga_id = m.ga_id/)
    assert.match(sql, /f.deleted_at IS NULL AND f.status = 'active'/)
    assert.deepEqual(params, [1, 'owner', 7])
    return { rows: [{ id: 5, section_id: 2, material_id: 4, file_id: 3,
      material_title: 'A.pdf', original_file_name: 'A.pdf', mime_type: 'application/pdf',
      page_count: 3, page_selection: [3, 1], sort_order: 0 }] }
  } }
  const detail = await loadBinderDetail(executor, 1, scope)
  const item = detail.sections[0].items[0]
  assert.equal(item.material.fileId, 3)
  assert.equal(item.material.pageCount, 3)
  assert.equal(item.material.mimeType, 'application/pdf')
  assert.deepEqual(planBinderExport(detail).map((job) => ({ materialId: job.materialId, pages: job.pages })),
    [{ materialId: '4', pages: [3, 1] }])
})

test('binder list counts only sources eligible for binder detail, retaining empty sections', async () => {
  const pool = { async query(sql) {
    assert.match(sql, /COUNT\(DISTINCT s.id\)/)
    assert.match(sql, /COUNT\(DISTINCT CASE WHEN f.id IS NOT NULL THEN i.material_id END\)/)
    assert.match(sql, /CASE WHEN f.id IS NULL THEN 0/)
    assert.match(sql, /m.deleted_at IS NULL/)
    assert.match(sql, /m.owner_user_id = b.owner_user_id AND m.ga_id = b.ga_id/)
    assert.match(sql, /f.user_id = b.owner_user_id AND f.ga_id = b.ga_id/)
    assert.match(sql, /f.deleted_at IS NULL AND f.status = 'active'/)
    return { rows: [] }
  } }
  const res = response()
  await routerFor(registerPersonalBinderApi, pool).get('get /personal-binders')({ user: { id: 'owner', gaId: 7 } }, res)
  assert.equal(res.statusCode, 200)
})

test('item insert maps unavailable source to 409 and rolls back without writing', async () => {
  const calls = []
  const client = { release() { calls.push('release') }, async query(sql) {
    calls.push(sql.trim())
    if (sql.includes('SELECT s.id')) return { rows: [{ id: 2, binder_id: 1 }], rowCount: 1 }
    return { rows: [], rowCount: 0 }
  } }
  const res = response()
  const routes = routerFor(registerPersonalBinderApi, { connect: async () => client })
  await routes.get('post /personal-binders/sections/:sectionId/items')({
    user: { id: 'owner', gaId: 7 }, params: { sectionId: '2' }, body: { materialId: 4 },
  }, res)
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'BINDER_SOURCE_UNAVAILABLE')
  assert.ok(calls.includes('BEGIN'))
  assert.ok(calls.includes('ROLLBACK'))
  assert.equal(calls.at(-1), 'release')
  assert.ok(!calls.some((sql) => sql.includes('INSERT INTO personal_binder_items')))
})
