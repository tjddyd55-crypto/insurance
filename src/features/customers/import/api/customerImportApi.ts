import { ApiError, apiRequest, resolveApiUrl } from '../../../../lib/apiClient'
import type { CustomerImportJob, CustomerImportRowRecord, CustomerImportRowStatus } from '../types/customerImportTypes'

function throwUnlessOk(res: Response, payload: { message?: string; error?: string }) {
  if (!res.ok) {
    throw new ApiError(payload.message ?? payload.error ?? '요청 처리에 실패했습니다.', res.status)
  }
}

export async function uploadCustomerImportJob(token: string, file: File): Promise<CustomerImportJob> {
  const url = resolveApiUrl('/api/customers/import-jobs')
  const body = new FormData()
  body.append('file', file)
  const headers: Record<string, string> = {}
  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }
  const res = await fetch(url, { method: 'POST', headers, body })
  const payload = (await res.json().catch(() => ({}))) as { data?: CustomerImportJob; message?: string }
  throwUnlessOk(res, payload)
  if (!payload.data) {
    throw new ApiError('응답에 작업 정보가 없습니다.', 500)
  }
  return payload.data
}

export async function fetchCustomerImportJobs(token: string, limit = 40): Promise<CustomerImportJob[]> {
  const raw = await apiRequest<CustomerImportJob[]>(`/api/customers/import-jobs?limit=${limit}`, { token })
  return Array.isArray(raw) ? raw : []
}

export async function fetchCustomerImportJob(token: string, jobId: string): Promise<CustomerImportJob> {
  return apiRequest<CustomerImportJob>(`/api/customers/import-jobs/${encodeURIComponent(jobId)}`, { token })
}

export async function fetchCustomerImportRows(
  token: string,
  jobId: string,
  opts: { status?: CustomerImportRowStatus; limit?: number; offset?: number },
): Promise<{ rows: CustomerImportRowRecord[]; total: number }> {
  const sp = new URLSearchParams()
  if (opts.status) {
    sp.set('status', opts.status)
  }
  if (opts.limit != null) {
    sp.set('limit', String(opts.limit))
  }
  if (opts.offset != null) {
    sp.set('offset', String(opts.offset))
  }
  const q = sp.toString()
  const path = `/api/customers/import-jobs/${encodeURIComponent(jobId)}/rows${q ? `?${q}` : ''}`
  const raw = await apiRequest<{ data?: CustomerImportRowRecord[]; total?: number }>(path, { token })
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'data' in raw) {
    const o = raw as { data?: CustomerImportRowRecord[]; total?: number }
    return { rows: Array.isArray(o.data) ? o.data : [], total: Number(o.total ?? 0) || 0 }
  }
  return { rows: [], total: 0 }
}

export type ApplyImportResult = {
  job: CustomerImportJob
  appliedInRequest: number
  failedInRequest: number
}

export async function applyCustomerImportJob(token: string, jobId: string): Promise<ApplyImportResult> {
  const url = resolveApiUrl(`/api/customers/import-jobs/${encodeURIComponent(jobId)}/apply`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
    },
    body: JSON.stringify({}),
  })
  const payload = (await res.json().catch(() => ({}))) as {
    data?: { job?: CustomerImportJob; appliedInRequest?: number; failedInRequest?: number }
    message?: string
  }
  throwUnlessOk(res, payload)
  const job = payload.data?.job
  if (!job) {
    throw new ApiError('응답에 작업 정보가 없습니다.', 500)
  }
  return {
    job,
    appliedInRequest: Number(payload.data?.appliedInRequest ?? 0) || 0,
    failedInRequest: Number(payload.data?.failedInRequest ?? 0) || 0,
  }
}
