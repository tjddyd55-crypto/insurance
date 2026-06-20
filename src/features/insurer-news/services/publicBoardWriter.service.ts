import { apiRequest } from '../../../lib/apiClient'
import { cdnUrlForObjectKey } from '../lib/insurerNewsCdn'
import type { LocalAttachmentDraft, NewsletterDetail, NewsletterItem } from '../types'
import { validateInsurerNewsFile } from '../utils/validateInsurerNewsFile'

const WRITER_TOKEN_KEY = 'insurance_public_board_writer_token'

export type PublicBoardWriterAccount = {
  id: string
  loginId: string
  name: string
  writerScope?: string
  isActive: boolean
  allowedBoardIds: string[] | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type PublicBoardWriterBoard = {
  id: string
  slug: string
  label: string
  boardScope: string
}

export function getPublicBoardWriterToken(): string | null {
  try {
    return sessionStorage.getItem(WRITER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setPublicBoardWriterToken(token: string | null) {
  try {
    if (!token) {
      sessionStorage.removeItem(WRITER_TOKEN_KEY)
      return
    }
    sessionStorage.setItem(WRITER_TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

/** 작성자 세션 종료(로그아웃·만료) 후 이동 경로 — 일반 로그인 화면 */
export const PUBLIC_BOARD_WRITER_EXIT_PATH = '/login'

export function clearPublicBoardWriterSession() {
  setPublicBoardWriterToken(null)
}

function writerApiPath(path: string) {
  return `/api/board-writer${path}`
}

export async function loginPublicBoardWriter(loginId: string, password: string) {
  return apiRequest<{ token: string; writer: PublicBoardWriterAccount }>('/api/board-writer/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  })
}

export async function fetchPublicBoardWriterMe(token: string) {
  return apiRequest<PublicBoardWriterAccount>(writerApiPath('/me'), { token })
}

export async function listPublicBoardWriterBoards(token: string) {
  return apiRequest<PublicBoardWriterBoard[]>(writerApiPath('/boards'), { token })
}

export async function listBoardWriterNewsletters(token: string, boardSlug: string) {
  return apiRequest<NewsletterItem[]>(writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/newsletters`), {
    token,
  })
}

export async function getBoardWriterNewsletter(token: string, boardSlug: string, newsletterId: string) {
  return apiRequest<NewsletterDetail>(
    writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/newsletters/${encodeURIComponent(newsletterId)}`),
    { token },
  )
}

export async function createBoardWriterNewsletter(
  token: string,
  boardSlug: string,
  draft: NewsletterDetail,
) {
  return apiRequest<NewsletterDetail>(writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/newsletters`), {
    method: 'POST',
    token,
    body: JSON.stringify({
      bodyText: draft.bodyText,
      status: draft.status,
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

export async function updateBoardWriterNewsletter(
  token: string,
  boardSlug: string,
  newsletterId: string,
  draft: NewsletterDetail,
) {
  return apiRequest<NewsletterDetail>(
    writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/newsletters/${encodeURIComponent(newsletterId)}`),
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        bodyText: draft.bodyText,
        status: draft.status,
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
    },
  )
}

export async function deleteBoardWriterNewsletter(token: string, boardSlug: string, newsletterId: string) {
  await apiRequest<void>(
    writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/newsletters/${encodeURIComponent(newsletterId)}`),
    { method: 'DELETE', token },
  )
}

export async function uploadBoardWriterAttachments(
  token: string,
  boardSlug: string,
  drafts: LocalAttachmentDraft[],
): Promise<LocalAttachmentDraft[]> {
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
      const presign = await apiRequest<{
        uploadUrl: string
        objectKey: string
        putHeaders?: Record<string, string>
      }>(writerApiPath(`/boards/${encodeURIComponent(boardSlug)}/attachments/presign`), {
        method: 'POST',
        token,
        body: JSON.stringify({
          fileName: item.file.name || 'file',
          contentType,
          sizeBytes: item.file.size,
        }),
      })

      const putHeaders: Record<string, string> = {
        'Content-Type': contentType,
        ...(presign.putHeaders ?? {}),
      }

      let putOk = false
      try {
        const put = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: item.file,
        })
        putOk = put.ok
      } catch {
        putOk = false
      }

      if (!putOk) {
        out.push({ ...item, status: 'failed', errorMessage: '파일 업로드에 실패했습니다.' })
        continue
      }

      out.push({
        ...item,
        status: 'completed',
        cdnUrl: cdnUrlForObjectKey(presign.objectKey),
        objectKey: presign.objectKey,
        mimeType: contentType,
        sizeBytes: item.file.size,
      })
    } catch (e) {
      out.push({
        ...item,
        status: 'failed',
        errorMessage: e instanceof Error ? e.message : '업로드에 실패했습니다.',
      })
    }
  }
  return out
}

/** @deprecated createPublicBoardWriterPost — createBoardWriterNewsletter 사용 */
export async function createPublicBoardWriterPost(token: string, boardSlug: string, bodyText: string) {
  return createBoardWriterNewsletter(token, boardSlug, {
    id: '',
    gaCode: 'GLOBAL',
    insurerCode: 'BOARD',
    insurerName: '',
    insurerSlug: `board-${boardSlug}`,
    title: '',
    summary: bodyText,
    heroImageUrl: null,
    publishedAt: new Date().toISOString(),
    status: 'PUBLISHED',
    hasImages: false,
    hasPdf: false,
    hasTextBody: bodyText.trim().length > 0,
    bodyText,
    attachments: [],
  })
}

export async function listAdminPublicBoardWriters(token: string) {
  return apiRequest<PublicBoardWriterAccount[]>('/api/admin/public-board-writers', { token })
}

export async function createAdminPublicBoardWriter(
  token: string,
  input: { loginId: string; password: string; name: string; allowedBoardIds?: string[] },
) {
  return apiRequest<PublicBoardWriterAccount>('/api/admin/public-board-writers', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

export async function createGaScopedBoardPost(token: string, boardSlug: string, bodyText: string) {
  return apiRequest<{ id: string; status: string; bodyText: string }>(
    `/api/insurer-news/boards/${encodeURIComponent(boardSlug)}/newsletters`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ bodyText, status: 'PUBLISHED' }),
    },
  )
}

function boardWriterAdminApiBase(role: string) {
  return String(role ?? '').trim().toUpperCase() === 'GA_ADMIN'
    ? '/api/ga-admin'
    : '/api/admin'
}

export async function listBoardWriterAccountsForBoard(token: string, role: string, boardId: string) {
  const base = boardWriterAdminApiBase(role)
  return apiRequest<PublicBoardWriterAccount[]>(
    `${base}/newsletter-boards/${encodeURIComponent(boardId)}/writer-accounts`,
    { token },
  )
}

export async function checkBoardWriterLoginId(
  token: string,
  role: string,
  boardId: string,
  loginId: string,
) {
  const base = boardWriterAdminApiBase(role)
  return apiRequest<{ available: boolean; loginId: string }>(
    `${base}/newsletter-boards/${encodeURIComponent(boardId)}/writer-accounts/check-login-id`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ loginId }),
    },
  )
}

export async function createBoardWriterAccountForBoard(
  token: string,
  role: string,
  boardId: string,
  input: { loginId: string; password: string; displayName?: string },
) {
  const base = boardWriterAdminApiBase(role)
  return apiRequest<PublicBoardWriterAccount>(
    `${base}/newsletter-boards/${encodeURIComponent(boardId)}/writer-accounts`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    },
  )
}

export async function resetBoardWriterAccountPassword(
  token: string,
  role: string,
  boardId: string,
  accountId: string,
  password: string,
) {
  const base = boardWriterAdminApiBase(role)
  return apiRequest<PublicBoardWriterAccount>(
    `${base}/newsletter-boards/${encodeURIComponent(boardId)}/writer-accounts/${encodeURIComponent(accountId)}/password`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ password }),
    },
  )
}

export async function setBoardWriterAccountStatus(
  token: string,
  role: string,
  boardId: string,
  accountId: string,
  isActive: boolean,
) {
  const base = boardWriterAdminApiBase(role)
  return apiRequest<PublicBoardWriterAccount>(
    `${base}/newsletter-boards/${encodeURIComponent(boardId)}/writer-accounts/${encodeURIComponent(accountId)}/status`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isActive }),
    },
  )
}

export async function patchAdminPublicBoardWriter(
  token: string,
  writerId: string,
  body: { name?: string; isActive?: boolean; password?: string; allowedBoardIds?: string[] },
) {
  return apiRequest<PublicBoardWriterAccount>(`/api/admin/public-board-writers/${encodeURIComponent(writerId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}
