import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS,
  CUSTOMER_EXCEL_GPT_GUIDE_PROMPT,
  CUSTOMER_EXCEL_GPT_GUIDE_STEPS,
  CUSTOMER_EXCEL_GPT_GUIDE_TITLE,
} from './customerExcelGptGuideContent'
import { CUSTOMER_EXCEL_UPLOAD_HEADERS } from '../utils/customerExcelUpload'

describe('customerExcelGptGuideContent', () => {
  it('keeps title and four usage steps', () => {
    expect(CUSTOMER_EXCEL_GPT_GUIDE_TITLE).toContain('GPT')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_STEPS).toHaveLength(4)
    expect(CUSTOMER_EXCEL_GPT_GUIDE_STEPS[0]).toContain('샘플 엑셀')
  })

  it('prompt is a single plain-text string without HTML', () => {
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('다음 작업을 수행해줘.')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toMatch(/<[^>]+>/)
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('[병력사항 매핑 규칙]')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('[메모 처리 규칙]')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('[데이터 형식 규칙')
  })

  it('aligns medical/memo column names with current sample headers', () => {
    expect(CUSTOMER_EXCEL_UPLOAD_HEADERS).toContain('medical')
    expect(CUSTOMER_EXCEL_UPLOAD_HEADERS).toContain('memo')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('「병력사항」')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).toContain('「메모」')
    // C·D열 고정은 현재 샘플(주민번호/휴대폰)과 불일치 → 사용하지 않음
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toMatch(/C열과 D열/)
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toContain('수술/치료 병력사항')
  })

  it('copy target excludes title, steps and caution headings', () => {
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toContain(CUSTOMER_EXCEL_GPT_GUIDE_TITLE)
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toContain(CUSTOMER_EXCEL_GPT_GUIDE_STEPS[0])
    expect(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT).not.toContain('사용 전 확인해 주세요')
    expect(CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS.length).toBeGreaterThan(0)
  })
})
