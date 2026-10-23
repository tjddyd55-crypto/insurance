import { describe, expect, it } from 'vitest'
import { buildSeedScenarioTemplate } from '../domain/scenarioSeed'
import { simulationTemplateMetadataLabel } from '../domain/simulationTemplateMetadata'
import {
  isSystemDefaultTemplate,
  shouldUploadLegacyTemplate,
  simulationBelongsToTemplate,
} from './coverageSimulatorTemplateSync'

describe('coverage simulator template sync', () => {
  it('matches a server template to a simulation saved under the old local id', () => {
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, 'local-uuid')).toBe(true)
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, '15')).toBe(true)
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, 'other')).toBe(false)
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, null)).toBe(false)
  })

  it('never uploads a system default, even when a simulation references it', () => {
    const seed = buildSeedScenarioTemplate('cancer')
    expect(seed).not.toBeNull()
    expect(isSystemDefaultTemplate(seed!)).toBe(true)
    expect(shouldUploadLegacyTemplate(seed!)).toBe(false)
    expect(
      shouldUploadLegacyTemplate({
        id: 'system:heart',
        name: '심장질환 치료',
        sourceType: 'system',
        items: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false)
    expect(
      shouldUploadLegacyTemplate({
        id: 'seed:care-dementia',
        name: '간병/치매',
        sourceType: 'user',
        items: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('does not match simulations by title or name snapshot', () => {
    expect(
      simulationBelongsToTemplate({ id: '15', legacyClientId: null }, 'orphan-seed-uuid'),
    ).toBe(false)
  })

  it('uploads a user template even when nothing references it yet', () => {
    const userTemplate = {
      id: 'mine',
      name: '내 시나리오',
      sourceType: 'user' as const,
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(isSystemDefaultTemplate(userTemplate)).toBe(false)
    expect(shouldUploadLegacyTemplate(userTemplate)).toBe(true)
  })

  it('labels a missing template without using the name snapshot', () => {
    expect(simulationTemplateMetadataLabel(undefined, '암 치료')).toBe('템플릿 없음')
    expect(simulationTemplateMetadataLabel('gone', null)).toBe('기존 템플릿')
    expect(simulationTemplateMetadataLabel('15', '내 시나리오')).toBe('내 시나리오')
  })
})
