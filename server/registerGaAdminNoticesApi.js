import { parseGaId } from './lib/parseGaId.js'
import { normalizeRbacRole } from './lib/rbacScope.js'
import {
  archiveAdminNotice,
  createAdminNotice,
  deleteAdminNotice,
  getAdminNoticeById,
  listAdminNotices,
  publishAdminNotice,
  setAdminNoticePopup,
  updateAdminNotice,
} from './admin-notices/adminNoticeService.js'
import { assertGaAdminOwnsNotice } from './admin-notices/adminNoticeScope.js'
import { resolveAdminNoticeLinkPreview } from './admin-notices/adminNoticeLinkPreview.js'
import { buildInsuranceAdminNoticeImageKey } from './storage/insuranceStorageKeys.js'
import {
  getR2InsurerAttachmentsCacheControl,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  r2GetPresignedPutUrl,
} from './lib/consentStorage.js'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * GA_ADMIN 전용 공지 API — audience_scope=GA, ga_id=세션 고정.
 *
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} deps
 */
export function registerGaAdminNoticesApi(apiRouter, deps) {
  const { pool, requireAuth, handleDbError } = deps

  function requireGaAdminRole(req, res, next) {
    if (normalizeRbacRole(req.user?.role) !== 'GA_ADMIN') {
      res.status(403).json({ success: false, message: 'GA 관리자만 이용할 수 있습니다.' })
      return
    }
    if (parseGaId(req.user?.gaId) == null) {
      res.status(400).json({ success: false, message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    next()
  }

  const guard = [requireAuth, requireGaAdminRole]

  function sessionGaId(req) {
    return parseGaId(req.user?.gaId)
  }

  function mapError(e, res) {
    const code = e?.message ?? ''
    const table = {
      title_required: { status: 400, message: '제목을 입력해 주세요.' },
      invalid_content_blocks: { status: 400, message: '본문 형식이 올바르지 않습니다.' },
      invalid_block_type: { status: 400, message: '지원하지 않는 본문 형식입니다.' },
      invalid_image_block: { status: 400, message: '이미지 정보가 올바르지 않습니다.' },
      invalid_date: { status: 400, message: '게시 기간 날짜가 올바르지 않습니다.' },
      notice_not_found: { status: 404, message: '공지를 찾을 수 없습니다.' },
      notice_forbidden: { status: 403, message: '이 공지에 접근할 수 없습니다.' },
      notice_not_published: { status: 400, message: '게시된 공지만 팝업으로 설정할 수 있습니다.' },
      ga_context_required: { status: 400, message: 'GA 컨텍스트가 없습니다.' },
    }
    const mapped = table[code]
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message })
      return true
    }
    return false
  }

  async function loadOwnedNotice(req, res) {
    const gaId = sessionGaId(req)
    const notice = await getAdminNoticeById(pool, req.params.id)
    try {
      assertGaAdminOwnsNotice(notice, gaId)
    } catch {
      res.status(403).json({ success: false, message: '이 공지에 접근할 수 없습니다.' })
      return null
    }
    return notice
  }

  async function presignNoticeImage(req, res, { noticeId = null } = {}) {
    if (!isConsentR2Enabled()) {
      res.status(503).json({ success: false, message: '파일 저장소가 구성되지 않았습니다.' })
      return
    }
    if (noticeId != null) {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) {
        return
      }
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const fileName = String(body.fileName ?? body.file_name ?? 'image.png').trim() || 'image.png'
    const contentType = String(body.contentType ?? body.content_type ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes ?? body.size ?? 0)
    if (!ALLOWED_IMAGE_MIME.has(contentType)) {
      res.status(400).json({ success: false, message: '허용되지 않은 이미지 형식입니다.' })
      return
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) {
      res.status(400).json({ success: false, message: '이미지 크기가 허용 범위를 벗어났습니다.' })
      return
    }
    const actorUserId = String(req.user?.id ?? '').trim() || null
    const storageKey = buildInsuranceAdminNoticeImageKey({
      noticeId,
      userId: actorUserId,
      fileName,
    })
    const cacheControl = getR2InsurerAttachmentsCacheControl()
    const uploadUrl = await r2GetPresignedPutUrl(storageKey, contentType, 900, { cacheControl })
    if (!uploadUrl) {
      res.status(503).json({ success: false, message: '업로드 URL을 만들 수 없습니다.' })
      return
    }
    res.json({
      success: true,
      data: {
        uploadUrl,
        storageKey,
        publicUrl: `${getR2PublicCdnBase()}/${storageKey}`,
        contentType,
      },
    })
  }

  apiRouter.get('/ga-admin/notices', guard, async (req, res) => {
    try {
      const gaId = sessionGaId(req)
      const notices = await listAdminNotices(pool, { gaId })
      res.json({ success: true, data: notices })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices', guard, async (req, res) => {
    try {
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const notice = await createAdminNotice(pool, req.body ?? {}, actorUserId, {
        role: req.user?.role,
        sessionGaId: req.user?.gaId,
      })
      res.status(201).json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/ga-admin/notices/:id', guard, async (req, res) => {
    try {
      const notice = await loadOwnedNotice(req, res)
      if (!notice) return
      res.json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/ga-admin/notices/:id', guard, async (req, res) => {
    try {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) return
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const notice = await updateAdminNotice(pool, req.params.id, req.body ?? {}, actorUserId)
      res.json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/ga-admin/notices/:id', guard, async (req, res) => {
    try {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) return
      await deleteAdminNotice(pool, req.params.id)
      res.json({ success: true })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/:id/publish', guard, async (req, res) => {
    try {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) return
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const notice = await publishAdminNotice(pool, req.params.id, actorUserId)
      res.json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/:id/archive', guard, async (req, res) => {
    try {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) return
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const notice = await archiveAdminNotice(pool, req.params.id, actorUserId)
      res.json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/:id/set-popup', guard, async (req, res) => {
    try {
      const owned = await loadOwnedNotice(req, res)
      if (!owned) return
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const notice = await setAdminNoticePopup(pool, req.params.id, actorUserId)
      res.json({ success: true, data: notice })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/images/presign', guard, async (req, res) => {
    try {
      await presignNoticeImage(req, res)
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/:id/images/presign', guard, async (req, res) => {
    try {
      await presignNoticeImage(req, res, { noticeId: req.params.id })
    } catch (e) {
      if (mapError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/notices/link-preview', guard, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const url = String(body.url ?? '').trim()
      if (!url) {
        res.json({ success: true, data: null })
        return
      }
      const data = await resolveAdminNoticeLinkPreview(url)
      res.json({ success: true, data })
    } catch {
      res.json({ success: true, data: null })
    }
  })
}
