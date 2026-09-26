import { loadBinderDetail } from '../apis/personalBinderApi.js'
import {
  BINDER_PAGE_IMAGE_TOKEN_TTL_SEC,
  issueBinderPageImageToken,
  readBinderPageImageToken,
} from './binderPageImageToken.js'
import { resolveBinderPageImageWidth } from './binderPageImageWidth.js'
import { listBinderViewerPages } from './binderViewerPages.js'
import { loadOwnedBinderMaterialFile } from './loadOwnedBinderMaterialFile.js'
import { classifyBinderSource, sourcePageCount } from './renderBinderPageImage.js'
import { createBinderPageImageService } from './serveBinderPageImage.js'

const OPEN_IMAGE_CACHE_CONTROL = 'private, max-age=300'
const STABLE_IMAGE_CACHE_CONTROL = 'private, max-age=86400'

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status })
}

function requestScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  const gaId = Number(req.user?.gaId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  return { userId, gaId }
}

function positiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sendError(error, req, res, handleDbError) {
  if (error?.httpStatus) {
    res.status(error.httpStatus).json({ message: error.message })
    return
  }
  handleDbError(error, req, res)
}

function guarded(handleDbError, handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  }
}

function materialTarget(req) {
  const materialId = positiveId(req.params.materialId)
  const page = positiveId(req.params.page)
  if (!materialId) throw httpError(400, '잘못된 자료 ID입니다.')
  if (!page) throw httpError(400, '페이지 번호가 올바르지 않습니다.')
  return {
    materialId,
    page,
    width: resolveBinderPageImageWidth({ width: req.query?.width, preset: req.query?.preset }),
  }
}

function describeMaterial(row) {
  const mimeType = String(row.file_mime || row.material_mime || '')
  const kind = classifyBinderSource(mimeType)
  if (kind === 'unsupported') throw httpError(415, '페이지 이미지로 열 수 없는 파일 형식입니다.')
  return {
    materialId: String(row.id),
    fileId: Number(row.file_id),
    mimeType,
    kind,
    pageCount: sourcePageCount(kind, row.page_count),
  }
}

function linkBody(req, token, fields) {
  const openPath = `/api/personal-binders/page-images/open/${encodeURIComponent(token)}`
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get?.('host') ?? '').split(',')[0].trim()
  return {
    ...fields,
    contentType: 'image/jpeg',
    access: 'open-token',
    expiresInSec: BINDER_PAGE_IMAGE_TOKEN_TTL_SEC,
    expiresAt: new Date(Date.now() + BINDER_PAGE_IMAGE_TOKEN_TTL_SEC * 1000).toISOString(),
    openPath,
    openUrl: host ? `${proto}://${host}${openPath}` : openPath,
  }
}

function sendPageImage(res, image, cacheControl) {
  res.setHeader('Content-Type', image.contentType)
  res.setHeader('Content-Length', String(image.buffer.length))
  res.setHeader('Cache-Control', cacheControl)
  res.setHeader('X-Page-Image-Cache', image.cache === 'hit' ? 'hit' : 'miss')
  res.setHeader('X-Image-Width', String(image.pixelWidth))
  res.setHeader('X-Image-Height', String(image.pixelHeight))
  res.status(200).end(image.buffer)
}

async function ownedMaterial(deps, scope, materialId) {
  const row = await loadOwnedBinderMaterialFile(deps.pool, materialId, scope)
  if (!row) throw httpError(404, '자료를 찾을 수 없습니다.')
  return row
}

async function viewerTarget(deps, scope, binderId, index) {
  const detail = await loadBinderDetail(deps.pool, binderId, scope)
  if (!detail) throw httpError(404, '바인더를 찾을 수 없습니다.')
  const page = listBinderViewerPages(detail).find((entry) => entry.index === index)
  if (!page) throw httpError(400, '바인더 페이지 범위를 벗어났습니다.')
  return { detail, page }
}

function issueLink(deps, req, res, scope, fields) {
  if (!Number.isInteger(fields.fileId) || fields.fileId < 1) {
    throw httpError(409, '자료 파일을 찾을 수 없습니다.')
  }
  const token = issueBinderPageImageToken(deps.JWT_SECRET, {
    userId: scope.userId,
    gaId: scope.gaId,
    materialId: Number(fields.materialId),
    fileId: fields.fileId,
    page: fields.page,
    width: fields.width,
  })
  res.setHeader('Cache-Control', 'no-store')
  res.json(linkBody(req, token, fields))
}

async function handleMaterialPages(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const materialId = positiveId(req.params.materialId)
  if (!materialId) throw httpError(400, '잘못된 자료 ID입니다.')
  const described = describeMaterial(await ownedMaterial(deps, scope, materialId))
  res.setHeader('Cache-Control', 'private, no-store')
  res.json(described)
}

async function handleMaterialPageLink(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const target = materialTarget(req)
  const described = describeMaterial(await ownedMaterial(deps, scope, target.materialId))
  if (target.page > described.pageCount) throw httpError(400, '페이지 범위를 벗어났습니다.')
  issueLink(deps, req, res, scope, {
    materialId: described.materialId,
    fileId: described.fileId,
    page: target.page,
    width: target.width,
    kind: described.kind,
    mimeType: described.mimeType,
  })
}

async function handleMaterialPageBytes(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const target = materialTarget(req)
  const rendered = await deps.service.renderMaterialPage(scope, target.materialId, target.page, target.width)
  sendPageImage(res, rendered.image, STABLE_IMAGE_CACHE_CONTROL)
}

async function handleBinderPages(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const binderId = positiveId(req.params.binderId)
  if (!binderId) throw httpError(400, '잘못된 바인더 ID입니다.')
  const detail = await loadBinderDetail(deps.pool, binderId, scope)
  if (!detail) throw httpError(404, '바인더를 찾을 수 없습니다.')
  const pages = listBinderViewerPages(detail)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ binderId: detail.id, title: detail.title, pageCount: pages.length, pages })
}

async function handleBinderPageLink(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const binderId = positiveId(req.params.binderId)
  const index = positiveId(req.params.index)
  if (!binderId) throw httpError(400, '잘못된 바인더 ID입니다.')
  if (!index) throw httpError(400, '페이지 번호가 올바르지 않습니다.')
  const { page } = await viewerTarget(deps, scope, binderId, index)
  const width = resolveBinderPageImageWidth({ width: req.query?.width, preset: req.query?.preset })
  issueLink(deps, req, res, scope, {
    binderId: String(binderId),
    viewerIndex: index,
    materialId: page.materialId,
    fileId: page.fileId,
    page: page.pdfPageNumber,
    width,
    kind: page.kind,
    mimeType: page.mimeType,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    itemId: page.itemId,
  })
}

async function handleBinderPageBytes(deps, req, res) {
  const scope = requestScope(req, res)
  if (!scope) return
  const binderId = positiveId(req.params.binderId)
  const index = positiveId(req.params.index)
  if (!binderId) throw httpError(400, '잘못된 바인더 ID입니다.')
  if (!index) throw httpError(400, '페이지 번호가 올바르지 않습니다.')
  const width = resolveBinderPageImageWidth({ width: req.query?.width, preset: req.query?.preset })
  const { page } = await viewerTarget(deps, scope, binderId, index)
  const rendered = await deps.service.renderMaterialPage(scope, Number(page.materialId), page.pdfPageNumber, width)
  sendPageImage(res, rendered.image, STABLE_IMAGE_CACHE_CONTROL)
}

async function handleOpenImage(deps, req, res) {
  let decoded = ''
  try {
    decoded = decodeURIComponent(String(req.params.token ?? ''))
  } catch {
    res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
    return
  }
  const token = readBinderPageImageToken(deps.JWT_SECRET, decoded)
  if (!token.ok) {
    res.status(token.status).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
    return
  }
  const rendered = await deps.service.renderMaterialPage(
    { userId: token.claims.userId, gaId: token.claims.gaId },
    token.claims.materialId,
    token.claims.page,
    token.claims.width,
  )
  if (Number(rendered.row.file_id) !== token.claims.fileId) {
    throw httpError(404, '자료를 찾을 수 없습니다.')
  }
  sendPageImage(res, rendered.image, OPEN_IMAGE_CACHE_CONTROL)
}

/**
 * 개인 바인더 페이지 이미지.
 * JSON 링크는 Bearer 로 받고, openUrl 은 헤더 없이 React Native Image 가 연다.
 * 바이트 응답은 Bearer 로도 받을 수 있다.
 */
export function registerPersonalBinderPageImageApi(apiRouter, ctx) {
  const deps = { ...ctx, service: createBinderPageImageService(ctx) }
  const protect = ctx.requireAuth
  const wrap = (handler) => guarded(ctx.handleDbError, handler)
  apiRouter.get(
    '/personal-binders/page-images/open/:token',
    wrap((req, res) => handleOpenImage(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/materials/:materialId/pages/:page/image',
    protect,
    wrap((req, res) => handleMaterialPageBytes(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/materials/:materialId/pages/:page',
    protect,
    wrap((req, res) => handleMaterialPageLink(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/materials/:materialId/pages',
    protect,
    wrap((req, res) => handleMaterialPages(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/:binderId/pages/:index/image',
    protect,
    wrap((req, res) => handleBinderPageBytes(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/:binderId/pages/:index',
    protect,
    wrap((req, res) => handleBinderPageLink(deps, req, res)),
  )
  apiRouter.get(
    '/personal-binders/:binderId/pages',
    protect,
    wrap((req, res) => handleBinderPages(deps, req, res)),
  )
}
