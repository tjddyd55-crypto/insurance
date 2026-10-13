import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGaCompaniesAdminListWhere,
  parseGaCompaniesAdminListParams,
} from './gaCompaniesAdminListQuery.js'

test('parseGaCompaniesAdminListParams defaults', () => {
  const p = parseGaCompaniesAdminListParams({})
  assert.equal(p.page, 1)
  assert.equal(p.pageSize, 20)
  assert.equal(p.q, '')
  assert.equal(p.groupFilter, 'all')
})

test('parseGaCompaniesAdminListParams group and search', () => {
  const p = parseGaCompaniesAdminListParams({
    page: '2',
    pageSize: '50',
    q: '서울',
    groupFilter: '3',
  })
  assert.equal(p.page, 2)
  assert.equal(p.pageSize, 50)
  assert.equal(p.offset, 50)
  assert.equal(p.q, '서울')
  assert.equal(p.groupFilter, 3)
})

test('buildGaCompaniesAdminListWhere ungrouped adds null check', () => {
  const { where, params } = buildGaCompaniesAdminListWhere({
    q: '',
    groupFilter: 'ungrouped',
  })
  assert.match(where, /m\.group_id IS NULL/)
  assert.equal(params.length, 0)
})

test('buildGaCompaniesAdminListWhere search uses single param', () => {
  const { where, params } = buildGaCompaniesAdminListWhere({
    q: 'GA001',
    groupFilter: 'all',
  })
  assert.match(where, /ILIKE/)
  assert.equal(params.length, 1)
  assert.equal(params[0], '%GA001%')
})
