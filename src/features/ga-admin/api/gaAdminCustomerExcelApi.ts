import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { GaCustomerExcelSettingsDto } from '../../admin/api/gaCustomerExcelAdminApi'

export async function fetchGaAdminCustomerExcelSettings(token: string): Promise<GaCustomerExcelSettingsDto> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<GaCustomerExcelSettingsDto>('/api/ga-admin/customer-excel/settings', { token })
}

export async function saveGaAdminCustomerExcelFeatureEnabled(
  token: string,
  featureEnabled: boolean,
): Promise<{ ok: boolean; settings: GaCustomerExcelSettingsDto }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest('/api/ga-admin/customer-excel/settings', {
    method: 'PUT',
    token,
    body: JSON.stringify({ featureEnabled }),
  })
}
