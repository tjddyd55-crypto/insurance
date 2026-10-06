import { describe, expect, it } from 'vitest'

import {
  buildInitialSeedScenarioTemplates,
  compareScenarioTemplates,
  seedKeyForDiseaseType,
} from './scenarioSeed'

describe('scenarioSeed', () => {
  it('builds six seed templates with stable seed keys', () => {
    const seeds = buildInitialSeedScenarioTemplates()
    expect(seeds).toHaveLength(6)
    expect(seeds.every((row) => row.sourceType === 'user')).toBe(true)
    expect(seeds.map((row) => row.seedKey)).toContain(seedKeyForDiseaseType('cancer'))
  })

  it('sorts seed templates before custom user scenarios', () => {
    const seeds = buildInitialSeedScenarioTemplates()
    const user = {
      ...seeds[0],
      id: 'custom-user',
      name: 'AAA 사용자',
      seedKey: undefined,
    }
    const sorted = [user, seeds[0]].sort(compareScenarioTemplates)
    expect(sorted[0].seedKey).toBe(seeds[0].seedKey)
  })
})
