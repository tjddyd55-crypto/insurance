import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const stripSource = readFileSync(
  join(root, 'features/customers/components/CustomerRelationsStrip.tsx'),
  'utf8',
)
const groupsSource = readFileSync(
  join(root, 'features/customers/components/CustomerRelationGroupsSection.tsx'),
  'utf8',
)
const legacySource = readFileSync(
  join(root, 'features/customers/components/LegacyCustomerRelationsSection.tsx'),
  'utf8',
)
const relationsCss = readFileSync(
  join(root, 'features/customers/customer-relations-mobile-ui.css'),
  'utf8',
)

describe('customerRelationSectionUx', () => {
  it('removes top-level family group and legacy link mode buttons', () => {
    expect(stripSource).not.toContain('customer-relations-strip__header-actions')
    expect(stripSource).not.toContain('가족 그룹 만들기')
    expect(stripSource).not.toMatch(/title="개별 연결"/)
  })

  it('hides duplicate 연계 고객 heading inside accordion panel', () => {
    expect(stripSource).toContain('embedded')
    expect(stripSource).toContain('customer-relations-strip--accordion-embedded')
    expect(stripSource).toMatch(/!embedded \? <h4/)
  })

  it('shows create family group only in empty subsection', () => {
    expect(groupsSource).toContain('등록된 가족 그룹이 없습니다.')
    expect(groupsSource).toContain('+ 가족 그룹 만들기')
    expect(groupsSource).toContain('groups.length === 0')
    expect(groupsSource).not.toContain('onCreateOpenChange')
  })

  it('keeps group management actions when a group exists', () => {
    expect(groupsSource).toContain('구성원 추가')
    expect(groupsSource).toContain('이름 수정')
    expect(groupsSource).toContain('그룹 삭제')
    expect(groupsSource).toContain('customer-relation-group-member__current-badge')
  })

  it('keeps the create-family-group modal height stable with one scroll region', () => {
    const createStart = groupsSource.indexOf('ariaLabel="가족 그룹 만들기"')
    const addStart = groupsSource.indexOf('ariaLabel="그룹 구성원 추가"')
    const createBlock = groupsSource.slice(createStart, addStart)

    expect(createBlock).toContain('customer-relation-group-modal--create')
    expect(createBlock).toContain('customer-relation-group-create__scroll')
    expect(createBlock).not.toContain('customer-relation-group-pending-wrap--scroll')

    const relationAt = createBlock.indexOf("renderSelectedAndRelation('create')")
    const scrollAt = createBlock.indexOf('customer-relation-group-create__scroll')
    const hitsAt = createBlock.indexOf("renderSearchHits('create')")
    expect(relationAt).toBeGreaterThan(-1)
    expect(scrollAt).toBeGreaterThan(relationAt)
    expect(hitsAt).toBeGreaterThan(scrollAt)

    expect(relationsCss).toContain('.customer-relation-group-modal--create')
    expect(relationsCss).toContain('.customer-relation-group-create__scroll')
    expect(relationsCss).toMatch(/customer-relation-group-create__scroll\s*\{[^}]*flex:\s*1 1 auto/)
    expect(relationsCss).toMatch(/customer-relation-group-create__scroll\s*\{[^}]*min-height:\s*0/)
    expect(relationsCss).toMatch(/customer-relation-group-create__scroll\s*\{[^}]*overflow-y:\s*auto/)
    expect(relationsCss).toMatch(/customer-relation-group-modal--create\s*\{[^}]*height:\s*min\(78vh/)
  })

  it('moves individual link add action to subsection footer', () => {
    expect(legacySource).toContain('+ 개별 연결 추가')
    expect(legacySource).toContain('등록된 개별 연결 고객이 없습니다.')
    expect(legacySource).not.toContain('customer-relations-strip__description')
    expect(legacySource).not.toContain('onAddOpenChange')
  })
})
