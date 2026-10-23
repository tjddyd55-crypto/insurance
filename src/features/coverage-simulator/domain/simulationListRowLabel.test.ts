import { describe, expect, it } from 'vitest'

import { createEmptyConsultationDraft } from './startConsultation'
import {
  simulationListPrimaryLabel,
  simulationListSecondaryLabel,
  simulationTemplateMetadataLabel,
} from './simulationTemplateMetadata'

describe('standalone simulation list labels', () => {
  it('uses the simulation title as the primary line', () => {
    expect(simulationListPrimaryLabel('수술비 상담')).toBe('수술비 상담')
    expect(simulationListPrimaryLabel('  ')).toBe('제목 없음')
  })

  it('puts the customer name, or 미연결, on the secondary line', () => {
    expect(
      simulationListSecondaryLabel({
        customerName: null,
        updatedAt: '2026-10-07',
        templateLabel: '템플릿 없음',
        customerScoped: false,
      }),
    ).toBe('미연결 · 2026.10.07 · 템플릿 없음')
    expect(
      simulationListSecondaryLabel({
        customerName: '김민수',
        updatedAt: '2026-10-07',
        templateLabel: '내 시나리오',
        customerScoped: false,
      }),
    ).toBe('김민수 · 2026.10.07 · 내 시나리오')
  })

  it('keeps the customer tab secondary line on the updated date', () => {
    expect(
      simulationListSecondaryLabel({
        customerName: '김민수',
        updatedAt: '2026-10-07',
        templateLabel: '내 시나리오',
        customerScoped: true,
      }),
    ).toBe('수정 2026.10.07 · 내 시나리오')
  })

  it('creates a direct simulation with no template id', () => {
    const draft = createEmptyConsultationDraft(null, '바로 만든 시뮬레이션')
    expect(draft.templateId).toBeUndefined()
    expect(draft.title).toBe('바로 만든 시뮬레이션')
    expect(simulationTemplateMetadataLabel(draft.templateId, null)).toBe('템플릿 없음')
  })
})
