import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = resolve(__dirname)
const css = readFileSync(resolve(here, '../customer-relations-mobile-ui.css'), 'utf8')
const tsx = readFileSync(resolve(here, 'CustomerRelationGroupsSection.tsx'), 'utf8')

describe('가족 그룹 만들기(구성원 고객 검색) 모달 외곽 크기 고정', () => {
  it('가족 그룹 만들기 모달만 --create modifier 를 쓴다', () => {
    expect(tsx).toMatch(
      /ariaLabel="가족 그룹 만들기"\s*panelClassName="customer-relations-modal customer-relation-group-modal customer-relation-group-modal--create"/,
    )
    expect(tsx.match(/customer-relation-group-modal--create/g)).toHaveLength(1)
  })

  it('PC 패널 높이 고정 + 결과 목록만 내부 스크롤', () => {
    const panel = css.match(
      /\.customer-ui-modal-panel\.customer-relations-modal\.customer-relation-group-modal--create \{([^}]*)\}/,
    )
    expect(panel?.[1]).toMatch(/height: min\(84vh, 760px\)/)
    expect(panel?.[1]).toMatch(/max-height: calc\(100dvh - 32px\)/)
    const results = css.match(
      /\.customer-relation-group-modal--create\s*\.customer-relations-modal__results \{([^}]*)\}/,
    )
    expect(results?.[1]).toMatch(/flex: 1 1 auto/)
    expect(results?.[1]).toMatch(/min-height: 0/)
    expect(results?.[1]).toMatch(/overflow-y: auto/)
  })
})
