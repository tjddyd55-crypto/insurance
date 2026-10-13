import {
  fetchGaCustomerExcelSettings,
  saveGaCustomerExcelSettings,
  uploadGaCustomerExcelSample,
  type GaExcelMatchRule,
  type GaCustomerExcelSettingsDto,
} from '../api/gaCustomerExcelAdminApi'
import {
  fetchGaAdminCustomerExcelSettings,
  saveGaAdminCustomerExcelSettings,
  uploadGaAdminCustomerExcelSample,
} from '../../ga-admin/api/gaAdminCustomerExcelApi'

export type GaCustomerExcelManagementApi = {
  loadSettings: () => Promise<GaCustomerExcelSettingsDto>
  uploadSample: (file: File) => Promise<{ settings: GaCustomerExcelSettingsDto }>
  saveSettings: (body: {
    featureEnabled: boolean
    matchRules: GaExcelMatchRule[]
  }) => Promise<{ settings: GaCustomerExcelSettingsDto }>
}

export function createSuperAdminGaExcelManagementApi(token: string, gaId: number): GaCustomerExcelManagementApi {
  return {
    loadSettings: () => fetchGaCustomerExcelSettings(token, gaId),
    uploadSample: async (file) => {
      const r = await uploadGaCustomerExcelSample(token, gaId, file)
      return { settings: r.settings }
    },
    saveSettings: (body) => saveGaCustomerExcelSettings(token, gaId, body),
  }
}

export function createGaAdminGaExcelManagementApi(token: string): GaCustomerExcelManagementApi {
  return {
    loadSettings: () => fetchGaAdminCustomerExcelSettings(token),
    uploadSample: async (file) => {
      const r = await uploadGaAdminCustomerExcelSample(token, file)
      return { settings: r.settings }
    },
    saveSettings: (body) => saveGaAdminCustomerExcelSettings(token, body),
  }
}
