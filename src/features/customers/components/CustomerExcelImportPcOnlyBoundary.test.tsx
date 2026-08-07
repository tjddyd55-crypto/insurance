import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const useIsMobileMock = vi.fn(() => false)

vi.mock('../../../hooks/useIsMobile', () => ({
  default: () => useIsMobileMock(),
}))

import PCOnlySection from '../../../components/PCOnlySection'

describe('PCOnlySection — 고객 엑셀 PC-only boundary', () => {
  beforeEach(() => {
    useIsMobileMock.mockReset()
  })

  it('PC에서는 children(엑셀 섹션)을 렌더한다', () => {
    useIsMobileMock.mockReturnValue(false)
    const html = renderToStaticMarkup(
      <PCOnlySection fallback={null}>
        <section data-testid="customer-excel-import-section">
          <button type="button">샘플 다운로드</button>
          <button type="button">GPT 활용법</button>
        </section>
      </PCOnlySection>,
    )
    expect(html).toContain('customer-excel-import-section')
    expect(html).toContain('GPT 활용법')
    expect(html).toContain('샘플 다운로드')
  })

  it('모바일에서는 fallback=null 이라 섹션·버튼을 렌더하지 않는다', () => {
    useIsMobileMock.mockReturnValue(true)
    const html = renderToStaticMarkup(
      <PCOnlySection fallback={null}>
        <section data-testid="customer-excel-import-section">
          <button type="button">샘플 다운로드</button>
          <button type="button">GPT 활용법</button>
          <pre>다음 작업을 수행해줘.</pre>
        </section>
      </PCOnlySection>,
    )
    expect(html).toBe('')
    expect(html).not.toContain('GPT 활용법')
    expect(html).not.toContain('샘플 다운로드')
    expect(html).not.toContain('다음 작업을 수행해줘')
  })
})
