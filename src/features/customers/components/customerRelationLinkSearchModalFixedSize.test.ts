import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = resolve(__dirname)
const css = readFileSync(resolve(here, '../customer-relations-mobile-ui.css'), 'utf8')
const tsx = readFileSync(resolve(here, 'LegacyCustomerRelationsSection.tsx'), 'utf8')

describe('개별 연결 「고객 검색 후 연결」 모달 외곽 크기 고정 (PC)', () => {
  it('개별 연결 검색 모달만 --link-search modifier 를 쓴다', () => {
    expect(tsx).toMatch(
      /ariaLabel="고객 검색 후 연결"\s*panelClassName="customer-relations-modal customer-relations-modal--link-search"/,
    )
  })

  it('PC 에서 패널 높이 고정 + 결과 목록만 내부 스크롤', () => {
    const block = css.slice(css.indexOf('customer-relations-modal--link-search {'))
    expect(block).toMatch(/height: min\(72vh, 640px\)/)
    const results = css.match(
      /\.customer-relations-modal--link-search\s*\.customer-relations-modal__results \{([^}]*)\}/,
    )
    expect(results?.[1]).toMatch(/flex: 1 1 auto/)
    expect(results?.[1]).toMatch(/max-height: none/)
    expect(results?.[1]).toMatch(/overflow-y: auto/)
  })
})
