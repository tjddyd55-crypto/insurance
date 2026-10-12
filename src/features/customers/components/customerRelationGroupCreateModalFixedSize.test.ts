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

function mediaBlocks(source: string, query: string): string[] {
  const out: string[] = []
  const head = `@media ${query} {`
  let i = source.indexOf(head)
  while (i !== -1) {
    let depth = 0
    let j = i + head.length - 1
    for (; j < source.length; j++) {
      if (source[j] === '{') depth++
      else if (source[j] === '}' && --depth === 0) break
    }
    out.push(source.slice(i + head.length, j))
    i = source.indexOf(head, j)
  }
  return out
}

describe('가족 그룹 만들기 모달: PC SSOT + 모바일 웹(#81) 보존', () => {
  const pc = mediaBlocks(css, '(min-width: 769px)').filter((b) =>
    b.includes('customer-relation-group-modal--create'),
  )
  const mobile = mediaBlocks(css, '(max-width: 768px)').filter((b) =>
    b.includes('customer-relation-group-modal--create'),
  )

  it('PC 규칙은 min-width: 769px 블록 하나에만 있고 84vh/760px 를 유지한다', () => {
    expect(pc).toHaveLength(1)
    expect(pc[0]).toMatch(/height: min\(84vh, 760px\)/)
    expect(pc[0]).not.toMatch(/78vh/)
  })

  it('모바일 웹 규칙은 max-width: 768px 안에서 패널 높이 고정 + 결과만 내부 스크롤', () => {
    expect(mobile).toHaveLength(1)
    const m = mobile[0]
    expect(m).toMatch(
      /\.customer-relation-group-modal--create \{[^}]*height: calc\(100dvh - 32px\);[^}]*max-height: calc\(100dvh - 32px\)/,
    )
    expect(m).toMatch(/\.customer-relations-modal__body \{[^}]*overflow: hidden/)
    expect(m).toMatch(/\.customer-relations-modal__results \{[^}]*flex: 1 1 auto;[^}]*overflow-y: auto/)
    expect(m).not.toMatch(/84vh|78vh/)
  })

  it('모바일 웹(#81) 순서: 관계 선택 → 검색 결과 order 규칙은 max-width: 768px 안에만 있다', () => {
    expect(mobile[0]).toMatch(
      /\.customer-relation-group-compose\s*>\s*\.customer-relations-modal__results \{[^}]*order: 1;/,
    )
    expect(pc[0]).not.toMatch(/order:/)
    const outside = css.replace(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/g, '')
    expect(outside).not.toMatch(/customer-relation-group-compose\s*>\s*\.customer-relations-modal__results/)
  })

  it('--create 규칙은 미디어쿼리 밖에 없고 __scroll 래퍼는 부활하지 않는다', () => {
    const outside = css
      .replace(/@media \(min-width: 769px\) \{[\s\S]*?\n\}/g, '')
      .replace(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/g, '')
    expect(outside).not.toMatch(/customer-relation-group-modal--create[^\n]*\{/)
    expect(css).not.toMatch(/customer-relation-group-create__scroll/)
    expect(tsx).not.toMatch(/customer-relation-group-create__scroll/)
  })
})
