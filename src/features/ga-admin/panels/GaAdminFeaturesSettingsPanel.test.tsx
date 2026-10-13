import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'GaAdminFeaturesSettingsPanel.tsx'),
  'utf8',
)

describe('GaAdminFeaturesSettingsPanel', () => {
  it('reuses shared GaCustomerExcelManagementPanel SSOT', () => {
    expect(panelSource).toContain('GaCustomerExcelManagementPanel')
    expect(panelSource).toContain('createGaAdminGaExcelManagementApi')
    expect(panelSource).not.toContain('saveGaAdminCustomerExcelFeatureEnabled')
  })
})
