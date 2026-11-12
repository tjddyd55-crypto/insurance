import test from 'node:test'
import assert from 'node:assert/strict'
import { assertBinderItemSources } from './assertBinderItemSources.js'

const scope = { userId: 'owner', gaId: 7 }
function fakeSource(source = {}) {
  return { async query(sql, params) {
    assert.match(sql, /FROM files f[\s\S]*JOIN personal_binder_materials m/)
    assert.match(sql, /m.owner_user_id = f.user_id AND m.ga_id = f.ga_id/)
    assert.match(sql, /b.owner_user_id = m.owner_user_id AND b.ga_id = m.ga_id/)
    assert.match(sql, /b.owner_user_id = \$3 AND b.ga_id = \$4/)
    assert.match(sql, /m.deleted_at IS NULL AND f.deleted_at IS NULL AND f.status = 'active'/)
    assert.match(sql, /FOR SHARE OF f/)
    assert.deepEqual(params, [2, [4], 'owner', 7])
    const valid = source.owner !== 'other' && source.ga !== 8 && !source.materialDeleted && !source.fileDeleted && !source.inactive && !source.missing
    return { rows: valid ? [{ id: 4 }] : [] }
  } }
}
test('locks valid sources in caller transaction and deduplicates IDs', async () => {
  await assertBinderItemSources(fakeSource(), 2, [4, 4], scope)
})
for (const source of [{ owner: 'other' }, { ga: 8 }, { materialDeleted: true }, { fileDeleted: true }, { inactive: true }, { missing: true }]) {
  test(`unavailable source ${JSON.stringify(source)} returns 409`, async () => {
    await assert.rejects(assertBinderItemSources(fakeSource(source), 2, [4], scope), (error) => {
      assert.equal(error.httpStatus, 409)
      assert.equal(error.code, 'BINDER_SOURCE_UNAVAILABLE')
      assert.equal(error.message, '원본 파일이 삭제되었거나 사용할 수 없습니다. 목록을 새로고침해 주세요.')
      return true
    })
  })
}
test('rejects partially available source batches', async () => {
  await assert.rejects(assertBinderItemSources({ query: async () => ({ rows: [{ id: 4 }] }) }, 2, [4, 5], scope), { code: 'BINDER_SOURCE_UNAVAILABLE' })
})
test('empty sections need no file locks', async () => {
  await assertBinderItemSources({ query() { throw new Error('unexpected query') } }, 2, [], scope)
})
