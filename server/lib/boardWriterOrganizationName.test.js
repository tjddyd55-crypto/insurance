import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapBoardWriterRow } from './boardWriterService.js'

describe('mapBoardWriterRow organizationName', () => {
  it('maps organization_name and falls back to empty string', () => {
    const withOrg = mapBoardWriterRow({
      id: 'w1',
      login_id: 'writer01',
      name: '성리나',
      organization_name: '한앤율',
      writer_scope: 'ga',
      owner_ga_id: 7,
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      last_login_at: null,
    })
    assert.equal(withOrg.organizationName, '한앤율')
    assert.equal(withOrg.name, '성리나')

    const withoutOrg = mapBoardWriterRow({
      id: 'w2',
      login_id: 'writer02',
      name: '김담당',
      writer_scope: 'ga',
      owner_ga_id: 7,
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      last_login_at: null,
    })
    assert.equal(withoutOrg.organizationName, '')
  })
})
