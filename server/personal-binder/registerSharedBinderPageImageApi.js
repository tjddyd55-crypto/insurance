import { loadSharedBinderDetail } from './personalBinderShareService.js'
import {
  issueSharedBinderPageImageToken,
  readSharedBinderPageImageToken,
} from './binderPageImageToken.js'
import { resolveBinderPageImageWidth } from './binderPageImageWidth.js'
import {
  OPEN_IMAGE_CACHE_CONTROL,
  STABLE_IMAGE_CACHE_CONTROL,
  guarded,
  httpError,
  linkBody,
  positiveId,
  requestScope,
  sendPageImage,
} from './registerPersonalBinderPageImageApi.js'
import { createBinderPageImageService } from './serveBinderPageImage.js'
import { listSharedBinderViewerPages } from './sharedBinderViewerPages.js'

const SHARED_OPEN_PATH_PREFIX = '/api/personal-binders/shared/page-images/open/'

function shareTarget(req) {
  const shareId = positiveId(req.params.shareId)
  if (!shareId) throw httpError(400, '잘못된 공유 ID입니다.')
  return shareId
}

function indexTarget(req) {
  const index = positiveId(req.params.index)
  if (!index) throw httpError(400, '페이지 번호가 올바르지 않습니다.')
  return index
}

/** 공유 접근 확인은 기존 공유 상세 규칙(같은 GA + active) 그대로. 404 면 그 아래는 보지 않는다. */
async function sharedViewer(deps, scope, shareId) {
  const detail = await loadSharedBinderDetail(deps.pool, scope, shareId)
  return { detail, pages: listSharedBinderViewerPages(detail) }
}

async function sharedViewerPage(deps, scope, shareId, index) {
  const { pages } = await sharedViewer(deps, scope, shareId)
  const page = pages.find((entry) => entry.index === index)
  if (!page) throw httpError(400, '바인더 페이지 범위를 벗어났습니다.')
  return page
}

async function handleSharedPages(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const shareId = shareTarget(req)
  const { detail, pages } = await sharedViewer(deps, scope, shareId)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ shareId: String(detail.id), binderId: null, title: detail.title, pageCount: pages.length, pages })
}

async function handleSharedPageLink(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const shareId = shareTarget(req)
  const index = indexTarget(req)
  const page = await sharedViewerPage(deps, scope, shareId, index)
  const width = resolveBinderPageImageWidth({ width: req.query?.width, preset: req.query?.preset })
  const token = issueSharedBinderPageImageToken(deps.JWT_SECRET, {
    userId: scope.userId,
    gaId: scope.gaId,
    shareId,
    shareFileId: Number(page.shareFileId),
    page: page.pdfPageNumber,
    width,
  })
  res.setHeader('Cache-Control', 'no-store')
  res.json(linkBody(req, token, {
    shareId: String(shareId),
    viewerIndex: index,
    shareFileId: page.shareFileId,
    page: page.pdfPageNumber,
    width,
    kind: page.kind,
    mimeType: page.mimeType,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    itemId: page.itemId,
  }, SHARED_OPEN_PATH_PREFIX))
}

async function handleSharedPageBytes(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const shareId = shareTarget(req)
  const index = indexTarget(req)
  const width = resolveBinderPageImageWidth({ width: req.query?.width, preset: req.query?.preset })
  const page = await sharedViewerPage(deps, scope, shareId, index)
  const rendered = await deps.service.renderSharedFilePage(scope, shareId, Number(page.shareFileId), page.pdfPageNumber, width)
  sendPageImage(res, rendered.image, STABLE_IMAGE_CACHE_CONTROL)
}

async function handleSharedOpenImage(deps, req, res) {
  let decoded = ''
  try {
    decoded = decodeURIComponent(String(req.params.token ?? ''))
  } catch {
    res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
    return
  }
  const token = readSharedBinderPageImageToken(deps.JWT_SECRET, decoded)
  if (!token.ok) {
    res.status(token.status).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
    return
  }
  // 열 때마다 공유 상태를 다시 확인한다(해제되면 남은 토큰도 404).
  const rendered = await deps.service.renderSharedFilePage(
    { userId: token.claims.userId, gaId: token.claims.gaId },
    token.claims.shareId,
    token.claims.shareFileId,
    token.claims.page,
    token.claims.width,
  )
  sendPageImage(res, rendered.image, OPEN_IMAGE_CACHE_CONTROL)
}

/**
 * 공유 바인더 페이지 이미지(읽기 전용). 개인 바인더 페이지 이미지 API 와 같은 계약·같은 렌더/캐시/토큰 방식.
 *  GET /personal-binders/shared/:shareId/pages              → { shareId, title, pageCount, pages }
 *  GET /personal-binders/shared/:shareId/pages/:index       → openUrl(10분 토큰) JSON
 *  GET /personal-binders/shared/:shareId/pages/:index/image → JPEG (Bearer)
 *  GET /personal-binders/shared/page-images/open/:token     → JPEG (헤더 없이, RN Image 용)
 * 접근: 기존 공유 규칙 그대로(같은 GA 사용자, 공유 status = active). 그 외 404. 매 호출 DB 로 다시 확인.
 */
export function registerSharedBinderPageImageApi(apiRouter, ctx) {
  const deps = { ...ctx, service: ctx.service ?? createBinderPageImageService(ctx) }
  const protect = ctx.requireAuth
  const wrap = (handler) => guarded(ctx.handleDbError, handler)
  apiRouter.get('/personal-binders/shared/page-images/open/:token', wrap((req, res) => handleSharedOpenImage(deps, req, res)))
  apiRouter.get('/personal-binders/shared/:shareId/pages/:index/image', protect, wrap((req, res) => handleSharedPageBytes(deps, req, res)))
  apiRouter.get('/personal-binders/shared/:shareId/pages/:index', protect, wrap((req, res) => handleSharedPageLink(deps, req, res)))
  apiRouter.get('/personal-binders/shared/:shareId/pages', protect, wrap((req, res) => handleSharedPages(deps, req, res)))
}
