import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerIndustryTemplate } from '../../customer-templates/customerTemplate.types'

export interface CrmCustomerManagementTemplateApiRow extends Record<string, unknown> {
  id: number
  name: string
  industry_code: string
  description: string
  status: string
  revision: number
  updated_at?: string
  created_at?: string
}

export type CrmTemplateListRow = CrmCustomerManagementTemplateApiRow & {
  resolved: CustomerIndustryTemplate | null
}

export async function listCrmCustomerManagementTemplates(
  token: string,
  industryCode?: string,
): Promise<CrmTemplateListRow[]> {
  const qs =
    industryCode?.trim()
      ? `?industry_code=${encodeURIComponent(industryCode.trim().toLowerCase())}`
      : ''
  const raw = await apiRequest<{ success?: boolean; data?: unknown }>(
    `/api/admin/platform/crm-customer-management-templates${qs}`,
    { method: 'GET', token },
  )
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { data?: unknown }).data : raw
  if (!Array.isArray(data)) {
    console.error('[listCrmCustomerManagementTemplates] invalid:', raw)
    throw new ApiError('템플릿 목록을 불러오지 못했습니다.', 500)
  }
  return data as CrmTemplateListRow[]
}

export async function fetchCrmCustomerManagementTemplate(token: string, id: number) {
  const raw = await apiRequest<{ success?: boolean; data?: unknown }>(
    `/api/admin/platform/crm-customer-management-templates/${id}`,
    { method: 'GET', token },
  )
  const data = raw && typeof raw === 'object' ? (raw as { data?: unknown }).data : null
  if (!data || typeof data !== 'object') {
    throw new ApiError('템플릿을 불러오지 못했습니다.', 500)
  }
  return data as { row: CrmCustomerManagementTemplateApiRow; resolved: CustomerIndustryTemplate }
}

export async function createCrmCustomerManagementTemplate(token: string, body: unknown) {
  const raw = await apiRequest<{ success?: boolean; data?: unknown; message?: string }>(
    `/api/admin/platform/crm-customer-management-templates`,
    { method: 'POST', token, body: JSON.stringify(body) },
  )
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('저장에 실패했습니다.', 500)
  }
  const o = raw as { data?: unknown; message?: string }
  if (!o.data) {
    throw new ApiError(String(o.message ?? '저장에 실패했습니다.'), 400)
  }
  return o.data as { row: CrmCustomerManagementTemplateApiRow; resolved: CustomerIndustryTemplate }
}

export async function updateCrmCustomerManagementTemplate(token: string, id: number, body: unknown) {
  const raw = await apiRequest<{ success?: boolean; data?: unknown; message?: string }>(
    `/api/admin/platform/crm-customer-management-templates/${id}`,
    { method: 'PUT', token, body: JSON.stringify(body) },
  )
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('저장에 실패했습니다.', 500)
  }
  const o = raw as { data?: unknown; message?: string }
  if (!o.data) {
    throw new ApiError(String(o.message ?? '저장에 실패했습니다.'), 400)
  }
  return o.data as { row: CrmCustomerManagementTemplateApiRow; resolved: CustomerIndustryTemplate }
}

export async function patchTenantCrmCustomerTemplate(token: string, tenantId: number, templateId: number | null) {
  const raw = await apiRequest<{ success?: boolean; data?: unknown; message?: string }>(
    `/api/admin/platform/tenants/${tenantId}/crm-customer-template`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ crm_customer_template_id: templateId }),
    },
  )
  if (!raw || typeof raw !== 'object' || (raw as { data?: unknown }).data == null) {
    throw new ApiError(String((raw as { message?: string })?.message ?? '테넌트 설정에 실패했습니다.'), 400)
  }
  return (raw as { data: unknown }).data
}

export async function listPlatformIndustriesSimple(token: string): Promise<{ id: number; code: string; name: string }[]> {
  const raw = await apiRequest<{ items?: unknown }>('/api/admin/platform/industries', {
    method: 'GET',
    token,
  })
  const data = raw?.items
  if (!Array.isArray(data)) {
    return []
  }
  return data
    .map((r) => {
      const o = r as Record<string, unknown>
      const id = typeof o.id === 'string' ? Number(o.id) : Number(o.id)
      return {
        id: Number.isFinite(id) ? id : 0,
        code: String(o.code ?? '').trim().toLowerCase(),
        name: String(o.name ?? '').trim(),
      }
    })
    .filter((x) => x.code.length > 0 && x.id > 0)
}
