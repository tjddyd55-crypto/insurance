import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = resolve(__dirname)
const css = readFileSync(resolve(here, '../customer-relations-mobile-ui.css'), 'utf8')
const tsx = readFileSync(resolve(here, 'CustomerRelationGroupsSection.tsx'), 'utf8')

describe('구성원 추가 모달 외곽 크기 고정', () => {
  it('구성원 추가 모달만 --add modifier 를 쓴다', () => {
    expect(tsx).toMatch(
      /ariaLabel="그룹 구성원 추가"\s*panelClassName="customer-relations-modal customer-relation-group-modal customer-relation-group-modal--add"/,
    )
  })

  it('패널 높이 고정 + 결과 목록만 내부 스크롤', () => {
    const panel = css.match(
      /\.customer-ui-modal-panel\.customer-relations-modal\.customer-relation-group-modal--add \{([^}]*)\}/,
    )
    expect(panel?.[1]).toMatch(/height: min\(72vh, 640px\)/)
    const results = css.match(
      /\.customer-relation-group-modal--add\s*\.customer-relations-modal__results \{([^}]*)\}/,
    )
    expect(results?.[1]).toMatch(/flex: 1 1 auto/)
    expect(results?.[1]).toMatch(/overflow-y: auto/)
    expect(css).toMatch(/\.customer-relation-group-modal--add \.customer-relations-modal__search,/)
  })
})
