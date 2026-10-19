/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import AddressSearchField from './AddressSearchField'

/**
 * 버그: 모바일 명함 편집기의 '주소 검색' 버튼 접근성 이름이 '사무실 주소 주소 지우기' 로 읽혔다.
 * 원인: 호출부가 `<label>` 로 필드 전체를 감싸 첫 labelable 자손(주소 검색 버튼)이 그 label 의 컨트롤이 되고,
 * 버튼 이름이 label 텍스트(자기 자신 제외: '사무실 주소' + '주소 지우기' …)로 계산됐다.
 * 수정: label 래퍼 제거, 그룹(role=group)에 aria-labelledby(labelId) 로 라벨 연결.
 *
 * 저장소에 @testing-library 가 없어(의존성 추가 금지) jsdom 위에서 accname 의 해당 부분
 * (aria-labelledby → aria-label → <label> 연결 → 텍스트 콘텐츠)만 계산하는 헬퍼를 쓴다.
 * 버튼에 연결된 <label> 이 0개인지(button.labels)도 직접 단언한다.
 */

const FILLED = {
  zonecode: '04524',
  baseAddress: '서울 중구 세종대로 110',
  detailAddress: '3층',
  sido: '서울',
  sigungu: '중구',
  regionCaptured: true,
}

const g = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
g.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(ui: ReactElement): HTMLDivElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(ui))
  return host
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function text(node: Node, exclude: Element | null): string {
  if (node === exclude) return ''
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element)) return ''
  if (node instanceof HTMLInputElement) return node.value ? ` ${node.value} ` : ''
  const own = node.getAttribute('aria-label')
  if (own) return ` ${own} `
  return Array.from(node.childNodes)
    .map((c) => text(c, exclude))
    .join(node instanceof HTMLButtonElement || node instanceof HTMLSpanElement ? '' : ' ')
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** accname 부분 구현: aria-labelledby → aria-label → 연결된 <label> → (버튼) 텍스트 콘텐츠. */
function accessibleName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    return squash(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    )
  }
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return squash(ariaLabel)
  const labels = (el as HTMLButtonElement | HTMLInputElement).labels
  if (labels && labels.length > 0) {
    return squash(Array.from(labels).map((l) => text(l, el)).join(' '))
  }
  return squash(el.textContent ?? '')
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) => squash(b.textContent ?? '') === label)
}

function OfficeAddress(props: { clearable?: boolean; previewStatic?: boolean }) {
  return (
    <div className="pap-editor-address">
      <span id="office-address-label">사무실 주소</span>
      <AddressSearchField value={FILLED} onChange={() => {}} labelId="office-address-label" {...props} />
    </div>
  )
}

describe('AddressSearchField accessible names', () => {
  it('root cause reproduction: wrapping the field in <label> leaks the label into the search button name', () => {
    const c = mount(
      <label>
        <span>사무실 주소</span>
        <AddressSearchField value={{ zonecode: '', baseAddress: '', detailAddress: '' }} onChange={() => {}} clearable />
      </label>,
    )
    const search = buttonByText(c, '주소 검색')!
    expect(search.labels.length).toBe(1)
    expect(accessibleName(search)).toBe('사무실 주소 주소 지우기')
  })

  it('CASE1 clearable: search button name is exactly 주소 검색', () => {
    const c = mount(<OfficeAddress clearable />)
    const search = buttonByText(c, '주소 검색')!
    expect(search).toBeDefined()
    expect(search.labels.length).toBe(0)
    expect(search.hasAttribute('aria-label')).toBe(false)
    expect(search.hasAttribute('aria-labelledby')).toBe(false)
    expect(accessibleName(search)).toBe('주소 검색')
  })

  it('CASE2 clearable: clear button name is its own text 주소 지우기', () => {
    const c = mount(<OfficeAddress clearable />)
    const clear = c.querySelector<HTMLButtonElement>('button.customer-address-field__clear')!
    expect(clear).not.toBeNull()
    expect(clear.labels.length).toBe(0)
    expect(accessibleName(clear)).toBe('주소 지우기')
  })

  it('CASE3 label 사무실 주소 names the address group containing the inputs', () => {
    const c = mount(<OfficeAddress clearable />)
    const group = c.querySelector('[role="group"]')!
    expect(group).not.toBeNull()
    expect(accessibleName(group)).toBe('사무실 주소')
    const inputs = Array.from(group.querySelectorAll('input'))
    expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual(['우편번호', '기본 주소', '상세 주소'])
    // 라벨 텍스트는 어떤 버튼 이름에도 섞이지 않는다
    for (const b of Array.from(group.querySelectorAll('button'))) {
      expect(accessibleName(b)).not.toContain('사무실 주소')
    }
  })

  it('CASE4 clearable=false: no clear button, search button still 주소 검색', () => {
    const c = mount(<OfficeAddress />)
    expect(c.querySelector('.customer-address-field__clear')).toBeNull()
    expect(buttonByText(c, '주소 지우기')).toBeUndefined()
    expect(accessibleName(buttonByText(c, '주소 검색')!)).toBe('주소 검색')
  })

  it('CASE5 previewStatic: no clear button (and no search button)', () => {
    const c = mount(<OfficeAddress clearable previewStatic />)
    expect(c.querySelector('.customer-address-field__clear')).toBeNull()
    expect(c.querySelectorAll('button').length).toBe(0)
  })

  it('without labelId the default output has no group role (other screens unchanged)', () => {
    const c = mount(<AddressSearchField value={FILLED} onChange={() => {}} />)
    const rootEl = c.firstElementChild!
    expect(rootEl.hasAttribute('role')).toBe(false)
    expect(rootEl.hasAttribute('aria-labelledby')).toBe(false)
  })
})

/** 호출부: AddressSearchField 를 <label> 로 감싸지 않고 labelId 로 라벨을 연결한다. */
const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LABELLED_CALLERS = [
  'features/public-advisor/pages/MyPublicProfilePage.tsx',
  'features/customers/components/detail-quick-crud/CustomerFireInsuranceQuickSection.tsx',
  'features/customers/components/detail-quick-crud/CustomerBusinessQuickSection.tsx',
  'features/customers/components/detail-quick-crud/CustomerBasicCoreEditFields.tsx',
]

function addressFieldUsages(rel: string) {
  const path = join(srcRoot, rel)
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: { insideLabel: boolean; hasLabelId: boolean }[] = []
  const visit = (node: ts.Node, labelDepth: number) => {
    let depth = labelDepth
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'label') depth += 1
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(sf) === 'AddressSearchField'
    ) {
      found.push({
        insideLabel: depth > 0,
        hasLabelId: node.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'labelId'),
      })
    }
    ts.forEachChild(node, (child) => {
      visit(child, depth)
    })
  }
  visit(sf, 0)
  return found
}

describe('AddressSearchField callers do not wrap it in <label>', () => {
  it.each(LABELLED_CALLERS)('%s', (rel) => {
    const usages = addressFieldUsages(rel)
    expect(usages.length).toBe(1)
    expect(usages[0]).toEqual({ insideLabel: false, hasLabelId: true })
  })
})
