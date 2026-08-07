import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { CustomerExcelImportPanel } from './CustomerExcelImportPanel'
import { CustomerExcelGptGuideModal } from './CustomerExcelGptGuideModal'
import { CUSTOMER_EXCEL_GPT_GUIDE_PROMPT } from '../config/customerExcelGptGuideContent'

vi.mock('../../../lib/clipboard', () => ({
  copyTextToClipboard: vi.fn(async () => true),
}))

vi.mock('../utils/customerExcelUpload', async () => {
  const actual = await vi.importActual<typeof import('../utils/customerExcelUpload')>(
    '../utils/customerExcelUpload',
  )
  return {
    ...actual,
    downloadCustomerUploadSampleXlsx: vi.fn(),
  }
})

describe('CustomerExcelImportPanel — GPT 활용법 (PC markup)', () => {
  it('renders sample download and GPT guide buttons', () => {
    const html = renderToStaticMarkup(
      <CustomerExcelImportPanel token="t" onUploadsFinished={() => undefined} />,
    )
    expect(html).toContain('샘플 다운로드')
    expect(html).toContain('GPT 활용법')
    expect(html).toContain('기존 고객 엑셀을 샘플 양식에 맞게 변환해야 한다면')
  })
})

describe('CustomerExcelGptGuideModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, steps, prompt and cautions when open', () => {
    const html = renderToStaticMarkup(
      <CustomerExcelGptGuideModal open onClose={() => undefined} usePortal={false} />,
    )
    expect(html).toContain('GPT를 활용한 고객 엑셀 변환 방법')
    expect(html).toContain('샘플 엑셀 다운로드')
    expect(html).toContain('기존 고객 엑셀과 샘플 엑셀을 GPT에 업로드')
    expect(html).toContain('지시문 복사')
    expect(html).toContain('사용 전 확인해 주세요')
    expect(html).toContain('다음 작업을 수행해줘.')
    expect(html).toContain('[병력사항 매핑 규칙]')
    expect(html).toContain('[메모 처리 규칙]')
    // 복사 대상 본문이 모달 안에 포함 (제목과 별개 상수)
    expect(html).toContain(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT.slice(0, 24))
  })

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <CustomerExcelGptGuideModal open={false} onClose={() => undefined} usePortal={false} />,
    )
    expect(html).toBe('')
  })
})
