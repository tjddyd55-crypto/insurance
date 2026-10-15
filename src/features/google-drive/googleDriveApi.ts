import { apiRequest } from '../../lib/apiClient'
import type { StorageFileRow } from '../storage/api/storageApi'

export type GoogleDrivePickerState = {
  enabled: boolean
  pickerConfigured: boolean
  connected: boolean
  driveGranted: boolean
  accountEmail: string
  apiKey?: string
  appId?: string
  accessToken?: string
}

function unwrap<T>(raw: unknown): T {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return ('data' in body && body.data && typeof body.data === 'object' ? body.data : body) as T
}

export async function fetchGoogleDrivePicker(token: string): Promise<GoogleDrivePickerState> {
  const data = unwrap<Partial<GoogleDrivePickerState>>(await apiRequest<unknown>('/api/service-integrations/google/drive/picker', { token }))
  return {
    enabled: data.enabled === true,
    pickerConfigured: data.pickerConfigured === true,
    connected: data.connected === true,
    driveGranted: data.driveGranted === true,
    accountEmail: String(data.accountEmail ?? ''),
    apiKey: data.apiKey,
    appId: data.appId,
    accessToken: data.accessToken,
  }
}

export async function startGoogleDriveConsent(token: string, desktop: boolean): Promise<string> {
  const data = unwrap<{ url?: string }>(await apiRequest<unknown>('/api/service-integrations/google/drive/connect', {
    token,
    method: 'POST',
    body: JSON.stringify(desktop ? { client: 'desktop' } : {}),
  }))
  return String(data.url ?? '')
}

/** Drive 파일 하나를 서버가 기존 저장 경로로 가져온다. customerId 가 있으면 고객 파일. */
export async function importGoogleDriveFile(
  token: string,
  input: { driveFileId: string; customerId?: number | null; folderId?: string | number | null },
): Promise<StorageFileRow> {
  const path = input.customerId != null
    ? `/api/customers/${encodeURIComponent(String(input.customerId))}/files/import-google-drive`
    : '/api/storage/files/import-google-drive'
  return apiRequest<StorageFileRow>(path, {
    token,
    method: 'POST',
    body: JSON.stringify({ driveFileId: input.driveFileId, folderId: input.folderId ?? null }),
  })
}
