import { ApiError, apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import type {
  GaCustomerExcelSettingsDto,
  GaExcelColumnDef,
  GaExcelMatchRule,
} from '../../admin/api/gaCustomerExcelAdminApi'

export async function fetchGaAdminCustomerExcelSettings(token: string): Promise<GaCustomerExcelSettingsDto> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<GaCustomerExcelSettingsDto>('/api/ga-admin/customer-excel/settings', { token })
}

export async function saveGaAdminCustomerExcelSettings(
  token: string,
  body: {
    featureEnabled: boolean
    matchRules: GaExcelMatchRule[]
  },
): Promise<{ ok: boolean; settings: GaCustomerExcelSettingsDto }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest('/api/ga-admin/customer-excel/settings', {
    method: 'PUT',
    token,
    body: JSON.stringify(body),
  })
}

export async function uploadGaAdminCustomerExcelSample(
  token: string,
  file: File,
): Promise<{ ok: boolean; sampleColumns: GaExcelColumnDef[]; settings: GaCustomerExcelSettingsDto }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(resolveApiUrl('/api/ga-admin/customer-excel/sample'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new ApiError(text || '응답 파싱 실패', res.status)
  }
  if (!res.ok) {
    const msg =
      typeof (data as { message?: string })?.message === 'string'
        ? (data as { message: string }).message
        : '업로드에 실패했습니다.'
    throw new ApiError(msg, res.status)
  }
  return data as { ok: boolean; sampleColumns: GaExcelColumnDef[]; settings: GaCustomerExcelSettingsDto }
}
