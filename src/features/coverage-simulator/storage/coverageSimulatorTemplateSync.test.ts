import { describe, expect, it } from 'vitest'
import { buildSeedScenarioTemplate } from '../domain/scenarioSeed'
import {
  isPristineSeedTemplate,
  shouldUploadLegacyTemplate,
  simulationBelongsToTemplate,
  systemTemplateIdForStoredTemplateId,
} from './coverageSimulatorTemplateSync'

describe('coverage simulator template sync', () => {
  it('matches a server template to a simulation saved under the old local id', () => {
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, 'local-uuid')).toBe(true)
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, '15')).toBe(true)
    expect(simulationBelongsToTemplate({ id: '15', legacyClientId: 'local-uuid' }, 'other')).toBe(false)
  })

  it('skips pristine seeds that no saved simulation references', () => {
    const seed = buildSeedScenarioTemplate('cancer')
    expect(seed).not.toBeNull()
    expect(isPristineSeedTemplate(seed!)).toBe(true)
    expect(shouldUploadLegacyTemplate(seed!, new Set())).toBe(false)
    expect(shouldUploadLegacyTemplate(seed!, new Set([seed!.id]))).toBe(true)
  })

  it('maps system and legacy seed ids onto the system catalog id', () => {
    expect(systemTemplateIdForStoredTemplateId('system:cancer')).toBe('system:cancer')
    expect(systemTemplateIdForStoredTemplateId('seed:heart')).toBe('system:heart')
    expect(systemTemplateIdForStoredTemplateId('local-uuid')).toBeNull()
    expect(
      simulationBelongsToTemplate({ id: 'system:cancer', systemCatalogId: 'system:cancer' }, 'system:cancer'),
    ).toBe(true)
    expect(
      simulationBelongsToTemplate({ id: 'system:cancer', systemCatalogId: 'system:cancer' }, 'seed:cancer'),
    ).toBe(true)
    expect(
      simulationBelongsToTemplate(
        {
          id: 'system:cancer',
          systemCatalogId: 'system:cancer',
          name: '암 치료',
          aliasIds: ['legacy-seed-cancer'],
        },
        'legacy-seed-cancer',
      ),
    ).toBe(true)
    expect(
      simulationBelongsToTemplate(
        { id: 'system:cancer', systemCatalogId: 'system:cancer', name: '암 치료' },
        'orphan-seed-uuid',
        { diseaseType: 'cancer', templateNameSnapshot: '암 치료' },
      ),
    ).toBe(true)
    expect(
      simulationBelongsToTemplate(
        { id: 'system:cancer', systemCatalogId: 'system:cancer', name: '암 치료' },
        'orphan-seed-uuid',
        { diseaseType: 'cancer', templateNameSnapshot: '암 치료', claimedByOtherTemplate: true },
      ),
    ).toBe(false)
  })

  it('uploads a user template even when nothing references it yet', () => {
    expect(
      shouldUploadLegacyTemplate(
        {
          id: 'mine',
          name: '내 시나리오',
          sourceType: 'user',
          items: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        new Set(),
      ),
    ).toBe(true)
  })
})
