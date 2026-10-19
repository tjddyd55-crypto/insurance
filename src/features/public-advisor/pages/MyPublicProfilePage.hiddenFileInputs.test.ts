import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * 모바일 명함 편집기의 파일 업로드 input 3개는 `.pap-editor-form input { width:100% }` 규칙에
 * 덮여 가로 스크롤을 만들었다. HTML `hidden` 속성으로 레이아웃에서 제외하고,
 * 버튼 → ref.current?.click() 연결과 같은 파일 재선택용 value 초기화는 유지되어야 한다.
 */
const here = dirname(fileURLToPath(import.meta.url))
const pagePath = join(here, 'MyPublicProfilePage.tsx')
const source = readFileSync(pagePath, 'utf8')
const css = readFileSync(join(here, '..', 'public-advisor.css'), 'utf8')
const sf = ts.createSourceFile(pagePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

type JsxEl = ts.JsxSelfClosingElement | ts.JsxOpeningElement

function collect(node: ts.Node, out: JsxEl[] = []): JsxEl[] {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) out.push(node)
  // forEachChild는 콜백이 truthy를 반환하면 순회를 멈추므로 반환값을 버린다
  ts.forEachChild(node, (child) => {
    collect(child, out)
  })
  return out
}

function attr(el: JsxEl, name: string): ts.JsxAttribute | undefined {
  return el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name,
  )
}

function attrText(el: JsxEl, name: string): string | undefined {
  return attr(el, name)?.initializer?.getText(sf)
}

const elements = collect(sf)
const fileInputs = elements.filter(
  (el) => el.tagName.getText(sf) === 'input' && attrText(el, 'type') === '"file"',
)
const buttonOnClicks = elements
  .filter((el) => el.tagName.getText(sf) === 'button')
  .map((el) => attrText(el, 'onClick') ?? '')

const EXPECTED = [
  { ref: 'profileInputRef', handler: 'onProfilePhotoPick' },
  { ref: 'businessCardFrontInputRef', handler: 'onBusinessCardPick' },
  { ref: 'galleryInputRef', handler: 'onGalleryPick' },
]

describe('MyPublicProfilePage hidden file inputs (mobile sideways overflow fix)', () => {
  it('has exactly the 3 upload file inputs, in order', () => {
    expect(fileInputs.map((el) => attrText(el, 'ref'))).toEqual(EXPECTED.map((e) => `{${e.ref}}`))
  })

  it.each(EXPECTED)('$ref is removed from layout with the HTML hidden attribute', ({ ref }) => {
    const el = fileInputs.find((i) => attrText(i, 'ref') === `{${ref}}`)!
    const hidden = attr(el, 'hidden')
    expect(hidden).toBeDefined()
    // 불리언 속성 그대로(hidden) — hidden={false} 같은 조건부 해제 금지
    expect(hidden?.initializer).toBeUndefined()
    // 레이아웃을 차지하던 옛 클래스는 더 이상 쓰지 않는다
    expect(attrText(el, 'className')).toBeUndefined()
  })

  it.each(EXPECTED)('$ref keeps image accept, change handler and same-file reselect reset', ({ ref, handler }) => {
    const el = fileInputs.find((i) => attrText(i, 'ref') === `{${ref}}`)!
    expect(attrText(el, 'accept')).toBe('"image/jpeg,image/png,image/webp"')
    const onChange = attrText(el, 'onChange') ?? ''
    expect(onChange).toContain(`${handler}(`)
    expect(onChange).toMatch(/e\.target\.value\s*=\s*''/)
  })

  it.each(EXPECTED)('an upload button still opens $ref via ref.current?.click()', ({ ref }) => {
    expect(buttonOnClicks.some((code) => code.includes(`${ref}.current?.click()`))).toBe(true)
  })

  it('no longer ships the unused .pap-hidden-input rule', () => {
    expect(source).not.toContain('pap-hidden-input')
    expect(css).not.toContain('.pap-hidden-input')
  })
})
