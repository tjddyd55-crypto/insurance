import { ApiError, apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export type GaCustomerExcelCapability = {
  gaId: number | null
  featureEnabled: boolean
  configReady: boolean
  showDesignerUi: boolean
  message: string
}

export async function fetchGaCustomerExcelCapability(token: string): Promise<GaCustomerExcelCapability> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<GaCustomerExcelCapability>('/api/ga-customer-excel/capability', { token })
}

export async function uploadGaCustomerExcelData(token: string, file: File): Promise<{ ok: boolean; rowCount: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(resolveApiUrl('/api/ga-customer-excel/upload'), {
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
    const msg = typeof (data as { message?: string })?.message === 'string' ? (data as { message: string }).message : '업로드에 실패했습니다.'
    throw new ApiError(msg, res.status)
  }
  return data as { ok: boolean; rowCount: number }
}

export type GaCustomerExcelDataRow = { rowIndex: number; cells: Record<string, string> }

export async function fetchCustomerGaExcelData(
  token: string,
  customerId: number,
): Promise<{ displayHeaders: string[]; displayColumnIds: string[]; rows: GaCustomerExcelDataRow[]; message: string }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest(`/api/customers/${customerId}/ga-excel-data`, { token })
}
