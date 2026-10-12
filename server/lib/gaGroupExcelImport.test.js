import test from 'node:test'
import assert from 'node:assert/strict'
import { previewGaGroupExcelImport } from './gaGroupExcelImport.js'

test('preview: GA 코드 없으면 지점명이 DB에 있어도 신규 생성', async () => {
  let nameLookupCount = 0
  const pool = {
    query: async (sql) => {
      const s = String(sql)
      if (s.includes('LOWER(TRIM(name))')) {
        nameLookupCount += 1
        return { rows: [{ id: 99, name: '서울중앙지점', code: 'EXISTING' }] }
      }
      if (s.includes('COALESCE(MAX(id)')) {
        return { rows: [{ next_id: 200 }] }
      }
      if (s.includes('UPPER(TRIM(code))')) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
  const result = await previewGaGroupExcelImport(pool, {
    groupId: 1,
    rows: [{ rowNumber: 2, branchName: '서울중앙지점', gaCode: '' }],
  })
  assert.equal(nameLookupCount, 0)
  assert.equal(result[0].status, 'create_new')
  assert.equal(result[0].message, '신규 GA 생성')
  assert.ok(result[0].proposedCode)
})

test('preview: GA 코드 일치 시에만 기존 GA 연결', async () => {
  const pool = {
    query: async (sql, params) => {
      const s = String(sql)
      if (s.includes('UPPER(TRIM(code))') && params?.[0] === 'GA001') {
        return {
          rows: [{ id: 5, name: '서울중앙지점', code: 'GA001', status: 'active' }],
        }
      }
      if (s.includes('ga_group_members')) {
        return { rows: [] }
      }
      if (s.includes('is_deleted = false')) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
  const result = await previewGaGroupExcelImport(pool, {
    groupId: 2,
    rows: [{ rowNumber: 2, branchName: '서울중앙지점', gaCode: 'GA001' }],
  })
  assert.equal(result[0].status, 'link_existing')
  assert.equal(result[0].gaId, 5)
  assert.match(result[0].message, /코드 일치/)
})

test('preview: 존재하지 않는 GA 코드는 오류', async () => {
  const pool = {
    query: async () => ({ rows: [] }),
  }
  const result = await previewGaGroupExcelImport(pool, {
    groupId: 1,
    rows: [{ rowNumber: 2, branchName: '부산지점', gaCode: 'NOPE' }],
  })
  assert.equal(result[0].status, 'error')
})
