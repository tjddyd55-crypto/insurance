import { apiRequest } from '../../../lib/apiClient'
import { listCompanyDirectory } from '../../company-registry/api/companyRegistryApi'
import { isNewsletterInCompanyScope } from '../lib/insurerNewsCompanyScope'
import { cdnUrlForObjectKey } from '../lib/insurerNewsCdn'
import { validateInsurerNewsFile } from '../utils/validateInsurerNewsFile'
import type { InsurerSummary, LocalAttachmentDraft, NewsletterDetail, NewsletterItem } from '../types'

type PublishContextApi = {
  gaCode: string
  insurerCode: string
  insurerName: string
  insurerSlug: string
}

function sortByPublishedDesc(items: NewsletterItem[]): NewsletterItem[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.publishedAt).getTime()
    const tb = new Date(b.publishedAt).getTime()
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
}

export type InsurerNewsFeedResponse = {
  newsletters: NewsletterItem[]
  insurers: InsurerSummary[]
}

async function fetchPublishContextApi(token: string): Promise<PublishContextApi> {
  return apiRequest<PublishContextApi>('/api/insurer-news/manager/publish-context', { token })
}

async function fetchInsurerNewsFeed(
  gaCode: string,
  token: string,
  opts?: { limit?: number; insurerSlug?: string },
): Promise<InsurerNewsFeedResponse> {
  const limit = opts?.limit ?? 500
  const sp = new URLSearchParams({
    gaCode: gaCode.trim(),
    limit: String(limit),
  })
  if (opts?.insurerSlug?.trim()) {
    sp.set('insurerSlug', opts.insurerSlug.trim().toLowerCase())
  }
  try {
    const payload = await apiRequest<InsurerNewsFeedResponse | unknown[]>(
      `/api/insurer-news/feed?${sp}`,
      { token },
    )
    if (Array.isArray(payload)) {
      return { newsletters: [], insurers: [] }
    }
    return payload as InsurerNewsFeedResponse
  } catch {
    return { newsletters: [], insurers: [] }
  }
}

export async function getRecentNewslettersByGa(gaCode: string, limit = 8, token?: string | null): Promise<NewsletterItem[]> {
  if (!token?.trim()) {
    return []
  }
  const { newsletters } = await fetchInsurerNewsFeed(gaCode, token, { limit: Math.max(limit, 50) })
  return sortByPublishedDesc(newsletters).slice(0, limit)
}

export async function getNewslettersByInsurer(
  gaCode: string,
  insurerSlug: string,
  token?: string | null,
): Promise<NewsletterItem[]> {
  if (!token?.trim()) {
    return []
  }
  const { newsletters } = await fetchInsurerNewsFeed(gaCode, token, {
    insurerSlug: insurerSlug.trim().toLowerCase(),
    limit: 500,
  })
  return sortByPublishedDesc(newsletters)
}

export async function getNewsletterDetail(
  gaCode: string,
  newsletterId: string,
  token?: string | null,
): Promise<NewsletterDetail | null> {
  if (!token?.trim()) {
    return null
  }
  const q = new URLSearchParams({ gaCode })
  try {
    return await apiRequest<NewsletterDetail>(`/api/insurer-news/feed/${encodeURIComponent(newsletterId)}?${q}`, {
      token,
    })
  } catch {
    return null
  }
}

export async function getInsurersForGa(gaCode: string, token?: string | null): Promise<InsurerSummary[]> {
  if (!token?.trim()) {
    return []
  }
  const { insurers } = await fetchInsurerNewsFeed(gaCode, token, { limit: 1 })
  return [...insurers].sort((a, b) => a.insurerName.localeCompare(b.insurerName, 'ko'))
}

export async function getAllPublishedForGa(gaCode: string, token?: string | null): Promise<NewsletterItem[]> {
  if (!token?.trim()) {
    return []
  }
  const { newsletters } = await fetchInsurerNewsFeed(gaCode, token, { limit: 500 })
  return sortByPublishedDesc(newsletters)
}

/**
 * @param presignInsurerCode GA 스태프 등 세션 외 원수사 지정이 필요할 때 presign body에 포함
 */
export async function uploadNewsletterAttachments(
  token: string,
  drafts: LocalAttachmentDraft[],
  options?: { presignInsurerCode?: string },
): Promise<LocalAttachmentDraft[]> {
  const presignInsurerCode = options?.presignInsurerCode?.trim()
  const out: LocalAttachmentDraft[] = []
  for (const item of drafts) {
    if (item.status === 'failed') {
      out.push(item)
      continue
    }
    if (item.cdnUrl && item.objectKey) {
      out.push({ ...item, status: 'completed' })
      continue
    }
    if (item.file.size === 0 && item.existingAttachmentId) {
      if (!item.cdnUrl || !item.objectKey) {
        out.push({
          ...item,
          status: 'failed',
          errorMessage: '기존 첨부 메타가 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.',
        })
        continue
      }
      out.push(item)
      continue
    }

    const v = validateInsurerNewsFile(item.file)
    if (!v.ok) {
      out.push({ ...item, status: 'failed', errorMessage: v.message })
      continue
    }

    const contentType = item.file.type || (v.kind === 'file' ? 'application/pdf' : 'image/jpeg')
    try {
      const presignBody: Record<string, unknown> = {
        fileName: item.file.name || 'file',
        contentType,
        sizeBytes: item.file.size,
      }
      if (presignInsurerCode) {
        presignBody.insurerCode = presignInsurerCode
      }
      const presign = await apiRequest<{
        uploadUrl: string
        objectKey: string
        putHeaders?: Record<string, string>
      }>('/api/insurer-news/attachments/presign', {
        method: 'POST',
        token,
        body: JSON.stringify(presignBody),
      })

      const putHeaders: Record<string, string> = {
        'Content-Type': contentType,
        ...(presign.putHeaders ?? {}),
      }

      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: putHeaders,
        body: item.file,
      })

      if (!put.ok) {
        const msg = `업로드 실패 (${put.status})`
        // eslint-disable-next-line no-console -- R2 PUT 실패는 서버가 보지 못하므로 클라이언트에서만 1차 추적
        console.error(
          '[upload-fail]',
          JSON.stringify({
            stage: 'r2-put',
            objectKey: presign.objectKey,
            status: put.status,
            at: new Date().toISOString(),
          }),
        )
        out.push({ ...item, status: 'failed', errorMessage: msg })
        continue
      }

      try {
        const completeBody: Record<string, unknown> = {
          objectKey: presign.objectKey,
          byteSize: item.file.size,
          contentType,
        }
        if (presignInsurerCode) {
          completeBody.insurerCode = presignInsurerCode
        }
        await apiRequest<void>('/api/insurer-news/attachments/upload-complete', {
          method: 'POST',
          token,
          body: JSON.stringify(completeBody),
        })
      } catch (completeErr) {
        // eslint-disable-next-line no-console -- PUT 성공 후 서버 알림 실패(orphan 후보); drain과 별도로 브라우저 흔적
        console.warn(
          '[upload-complete-fail]',
          JSON.stringify({
            objectKey: presign.objectKey,
            message: completeErr instanceof Error ? completeErr.message : String(completeErr),
            at: new Date().toISOString(),
          }),
        )
      }

      const url = cdnUrlForObjectKey(presign.objectKey)
      out.push({
        ...item,
        status: 'completed',
        cdnUrl: url,
        objectKey: presign.objectKey,
        mimeType: contentType,
        sizeBytes: item.file.size,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '업로드에 실패했습니다.'
      // eslint-disable-next-line no-console -- presign/API 예외는 서버 로그와 구분해 클라이언트에서 표시
      console.error(
        '[upload-fail]',
        JSON.stringify({ stage: 'presign-or-network', message: msg, at: new Date().toISOString() }),
      )
      out.push({ ...item, status: 'failed', errorMessage: msg })
    }
  }
  return out
}

export async function createManagerNewsletter(token: string, draft: NewsletterDetail): Promise<NewsletterDetail> {
  return apiRequest<NewsletterDetail>('/api/insurer-news/manager/newsletters', {
    method: 'POST',
    token,
    body: JSON.stringify({
      bodyText: draft.bodyText,
      status: draft.status,
      gaCode: draft.gaCode,
      insurerCode: draft.insurerCode,
      insurerSlug: draft.insurerSlug,
      insurerName: draft.insurerName,
      summary: draft.summary,
      publishedAt: draft.publishedAt,
      attachments: draft.attachments.map((a) => ({
        kind: a.kind,
        url: a.url,
        objectKey: a.objectKey,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        sortOrder: a.sortOrder,
      })),
    }),
  })
}

export async function updateManagerNewsletter(
  token: string,
  newsletterId: string,
  draft: NewsletterDetail,
): Promise<NewsletterDetail> {
  return apiRequest<NewsletterDetail>(`/api/insurer-news/manager/newsletters/${encodeURIComponent(newsletterId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      bodyText: draft.bodyText,
      status: draft.status,
      gaCode: draft.gaCode,
      insurerCode: draft.insurerCode,
      insurerSlug: draft.insurerSlug,
      insurerName: draft.insurerName,
      summary: draft.summary,
      publishedAt: draft.publishedAt,
      attachments: draft.attachments.map((a) => ({
        kind: a.kind,
        url: a.url,
        objectKey: a.objectKey,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        sortOrder: a.sortOrder,
      })),
    }),
  })
}

export async function listManagerNewsletters(token: string): Promise<NewsletterItem[]> {
  return apiRequest<NewsletterItem[]>('/api/insurer-news/manager/newsletters', { token })
}

export async function getManagerNewsletterDetail(token: string, id: string): Promise<NewsletterDetail | null> {
  try {
    return await apiRequest<NewsletterDetail>(`/api/insurer-news/manager/newsletters/${encodeURIComponent(id)}`, {
      token,
    })
  } catch {
    return null
  }
}

export async function deleteNewsletterAttachment(token: string, attachmentId: string): Promise<void> {
  await apiRequest<void>(`/api/insurer-news/attachments/${encodeURIComponent(attachmentId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function getNewslettersForInsurerManagerCompany(
  token: string,
  gaCode: string,
  companyMasterId: number,
): Promise<NewsletterItem[]> {
  const rows = await listManagerNewsletters(token)
  const companies = await listCompanyDirectory(token)
  const entry = companies.find((r) => r.id === companyMasterId)
  if (!entry) {
    return []
  }
  return rows.filter((item) => isNewsletterInCompanyScope(item as NewsletterDetail, entry, gaCode))
}

export async function getNewsletterDetailForInsurerManager(
  token: string,
  gaCode: string,
  companyMasterId: number,
  newsletterId: string,
): Promise<NewsletterDetail | null> {
  const detail = await getManagerNewsletterDetail(token, newsletterId)
  if (!detail) {
    return null
  }
  const companies = await listCompanyDirectory(token)
  const entry = companies.find((r) => r.id === companyMasterId)
  if (!entry || !isNewsletterInCompanyScope(detail, entry, gaCode)) {
    return null
  }
  return detail
}

export async function resolveInsurerManagerPublishContext(
  token: string,
  gaCode: string,
  companyMasterId: number,
): Promise<PublishContextApi | { error: string }> {
  try {
    const apiCtx = await fetchPublishContextApi(token)
    if (apiCtx.gaCode.toUpperCase() !== gaCode.trim().toUpperCase()) {
      return { error: 'GA 정보가 일치하지 않습니다. 다시 로그인해 주세요.' }
    }
    const rows = await listCompanyDirectory(token)
    const entry = rows.find((r) => r.id === companyMasterId)
    if (!entry) {
      return { error: '소속 원수사 정보를 찾을 수 없습니다. GA 관리자에게 문의해 주세요.' }
    }
    if (apiCtx.insurerCode.toUpperCase() !== entry.companyCode.trim().toUpperCase()) {
      return { error: '원수사 정보가 일치하지 않습니다. GA 관리자에게 문의해 주세요.' }
    }
    return {
      gaCode: apiCtx.gaCode.toUpperCase(),
      insurerCode: apiCtx.insurerCode,
      insurerName: apiCtx.insurerName,
      insurerSlug: apiCtx.insurerSlug,
    }
  } catch {
    return { error: '발행 컨텍스트를 불러오지 못했습니다. 다시 로그인해 주세요.' }
  }
}
