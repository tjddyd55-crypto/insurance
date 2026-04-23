/**
 * 좌표 기반 PDF 자동화 엔진 — REST API.
 *
 * 아키텍처:
 *   - HTTP 입출력만 담당. 도메인 로직은 server/pdf-engine/* 에 위임한다.
 *   - 관리자 쓰기: 업로드·필드 정의 → SUPER_ADMIN 전용.
 *   - 사용자 읽기/발급: 본인 GA 또는 공용(ga_id IS NULL) 템플릿만 허용.
 *
 * 라우트 일람:
 *   POST  /admin/pdf-templates                 — 메타 생성(업로드된 storage_key 포함)
 *   POST  /admin/pdf-templates/upload          — multipart PDF 업로드 → storage_key 반환
 *   GET   /admin/pdf-templates                 — 전체 목록(관리자 뷰)
 *   GET   /admin/pdf-templates/:id             — 단건 + 필드 전체
 *   PATCH /admin/pdf-templates/:id             — 메타(title/description/isActive) 부분 수정
 *   PUT   /admin/pdf-templates/:id/fields      — 필드 + placements 일괄 저장
 *   GET   /admin/pdf-templates/:id/file        — 원본 PDF 바이너리 다운로드(에디터 미리보기)
 *   DELETE /admin/pdf-templates/:id            — 템플릿·스토리지 객체 삭제
 *
 *   GET   /pdf-templates                       — 사용자용 목록(본인 GA + 공용, 활성만)
 *   GET   /pdf-templates/:id                   — 사용자용 단건(권한 내)
 *   POST  /pdf-templates/:id/render            — 입력값 → 스탬핑 PDF 스트리밍
 *
 * 권한 체계:
 *   - requireAuth 내부에서 이미 EXPIRED 구독 차단을 수행하므로, 이 라우터는 그 이후를
 *     신뢰하고 "GA 범위" 만 추가로 체크한다.
 */

import multer from 'multer'
import { PDFDocument } from 'pdf-lib'
import {
  normalizeFieldSpec,
  normalizeFieldSpecList,
  validateRenderValues,
} from './pdf-engine/schema/fieldSpec.js'
import { createTemplateWithAutoCode } from './pdf-engine/code/templateCode.js'
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listFields,
  listTemplates,
  replaceTemplateFields,
  updateTemplateMeta,
} from './pdf-engine/repository/pdfTemplateRepo.js'
import { getCustomerProfile } from './pdf-engine/repository/userProfileRepo.js'
import { injectCustomerValues } from './pdf-engine/mapping/customerMapping.js'
import { stampPdf } from './pdf-engine/renderer/stampPdf.js'
import {
  buildTemplateStorageKey,
  deleteTemplateObject,
  getTemplateObject,
  putTemplateObject,
} from './pdf-engine/storage/pdfTemplateStorage.js'
import { canAccessTemplateForUser } from './pdf-engine/security/templateAccess.js'

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('PDF 파일만 업로드할 수 있습니다.'))
      return
    }
    cb(null, true)
  },
})

function parseTemplateId(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

function requireSuperAdmin(req, res, isSuperAdminRole) {
  if (!req.user || !isSuperAdminRole(req.user.role)) {
    res.status(403).json({ message: '전체 관리자 권한이 필요합니다.' })
    return false
  }
  return true
}

/**
 * SUPER_ADMIN 전용 라우트의 미들웨어 체인 선두에 배치.
 * multer 같은 리소스 소비형 파서가 비인가 요청을 처리하지 않도록, 권한 체크를 파싱 앞에서 수행한다.
 */
function makeRequireSuperAdminMw(isSuperAdminRole) {
  return (req, res, next) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    next()
  }
}

/* 권한 판정은 security/templateAccess.js 로 이관 — 단위 테스트 용이 + 재사용 대비. */
function canAccessTemplateForRequest(template, req, isSuperAdminRole) {
  return canAccessTemplateForUser(template, req.user ?? null, isSuperAdminRole)
}

function templateToDto(row) {
  return {
    id: row.id,
    gaId: row.ga_id,
    gaName: row.ga_name ?? null,
    gaCode: row.ga_code ?? null,
    code: row.code,
    title: row.title,
    description: row.description ?? '',
    pageCount: row.page_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function fieldRowToDto(row) {
  return {
    id: row.id,
    fieldKey: row.field_key,
    label: row.label,
    fieldType: row.field_type,
    required: row.required,
    orderIndex: row.order_index,
    customerMapping: row.customer_mapping,
    options: Array.isArray(row.options) ? row.options : null,
    placements: Array.isArray(row.placements) ? row.placements : [],
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   isSuperAdminRole: (role: unknown) => boolean,
 *   handleDbError: (res: import('express').Response, error: unknown) => void,
 * }} deps
 */
export function registerPdfTemplateApi(apiRouter, deps) {
  const { pool, requireAuth, isSuperAdminRole, handleDbError } = deps
  const requireSuperAdminMw = makeRequireSuperAdminMw(isSuperAdminRole)

  // ─── 관리자 라우트 ────────────────────────────────────────────────

  apiRouter.post(
    '/admin/pdf-templates/upload',
    requireAuth,
    /* 권한을 multer 앞에 두어 비인가 요청이 25MB 멀티파트 파싱을 강제하지 못하게 한다. */
    requireSuperAdminMw,
    (req, res, next) => {
      uploadPdf.single('pdf')(req, res, (err) => {
        if (err) {
          res.status(400).json({ message: err.message || 'PDF 업로드 실패' })
          return
        }
        next()
      })
    },
    async (req, res) => {
      const file = req.file
      if (!file || !file.buffer || file.buffer.length === 0) {
        res.status(400).json({ message: 'PDF 파일이 필요합니다.' })
        return
      }
      const gaIdRaw = req.body?.gaId
      const gaId =
        gaIdRaw == null || gaIdRaw === '' || gaIdRaw === 'null' ? null : Number(gaIdRaw)
      if (gaId != null && (!Number.isInteger(gaId) || gaId < 1)) {
        res.status(400).json({ message: 'gaId 가 올바르지 않습니다.' })
        return
      }
      /* 스토리지 키는 업로드 시점에 고정되며, UUID 접미어로 유일성이 보장된다.
         템플릿의 최종 `code` 는 등록(POST /admin/pdf-templates) 시점에 서버가
         자동 생성하므로, 업로드 단계에서는 내부 버킷 정리용 접두어만 필요하다. */
      const STORAGE_KEY_SEED = 'upload'

      try {
        /* 페이지 수 미리 계산 — 프론트에서 재요청하지 않아도 되게 서버가 고정. */
        const doc = await PDFDocument.load(file.buffer)
        const pageCount = doc.getPageCount()
        const storageKey = buildTemplateStorageKey({ gaId, code: STORAGE_KEY_SEED })
        await putTemplateObject(storageKey, file.buffer)
        res.json({ storageKey, pageCount })
      } catch (error) {
        console.error('[pdf-templates] 업로드 실패', error)
        res.status(500).json({ message: 'PDF 업로드에 실패했습니다.' })
      }
    },
  )

  apiRouter.post('/admin/pdf-templates', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const gaIdRaw = body.gaId
    const gaId =
      gaIdRaw == null || gaIdRaw === '' || gaIdRaw === 'null' ? null : Number(gaIdRaw)
    if (gaId != null && (!Number.isInteger(gaId) || gaId < 1)) {
      res.status(400).json({ message: 'gaId 가 올바르지 않습니다.' })
      return
    }
    /* `code` 는 더 이상 클라이언트에서 받지 않는다(서버가 title 로부터 자동 생성).
       기존 호출자가 code 를 보내도 무시 — 하위 호환을 위한 silent ignore. */
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      res.status(400).json({ message: 'title 이 필요합니다.' })
      return
    }
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const storageKey = typeof body.storageKey === 'string' ? body.storageKey.trim() : ''
    if (!storageKey) {
      res.status(400).json({ message: 'storageKey 가 필요합니다. 먼저 업로드를 호출하세요.' })
      return
    }
    const pageCount = Number(body.pageCount)
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      res.status(400).json({ message: 'pageCount 가 올바르지 않습니다.' })
      return
    }

    try {
      /* code 자동 생성 + 충돌 재시도는 createTemplateWithAutoCode 에 일임한다.
         라우터는 "요청을 받고 응답을 낸다" 에만 집중한다. */
      const row = await createTemplateWithAutoCode(pool, createTemplate, {
        gaId,
        title,
        description,
        storageKey,
        pageCount,
        createdByUserId: req.user?.id ?? null,
      })
      res.status(201).json({ template: templateToDto(row) })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.get('/admin/pdf-templates', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    try {
      const rows = await listTemplates(pool, { gaId: null, includeInactive: true })
      res.json({ templates: rows.map(templateToDto) })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.get('/admin/pdf-templates/:id', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    try {
      const row = await getTemplateById(pool, id)
      if (!row) {
        res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' })
        return
      }
      const fields = await listFields(pool, id)
      res.json({
        template: templateToDto(row),
        fields: fields.map(fieldRowToDto),
      })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.patch('/admin/pdf-templates/:id', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const patch = {}
    if (typeof body.title === 'string') {
      const v = body.title.trim()
      if (!v) {
        res.status(400).json({ message: 'title 은 비워둘 수 없습니다.' })
        return
      }
      patch.title = v
    }
    if (typeof body.description === 'string') {
      patch.description = body.description.trim()
    }
    if (body.isActive !== undefined) {
      patch.isActive = Boolean(body.isActive)
    }

    try {
      await updateTemplateMeta(pool, id, patch)
      const row = await getTemplateById(pool, id)
      res.json({ template: row ? templateToDto(row) : null })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.put('/admin/pdf-templates/:id/fields', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    try {
      const fields = normalizeFieldSpecList(req.body?.fields)
      const template = await getTemplateById(pool, id)
      if (!template) {
        res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' })
        return
      }
      /* placements 의 page 값이 실제 페이지 수를 넘지 않는지 재검증(스키마만으로 모자람). */
      for (const f of fields) {
        for (const p of f.placements) {
          if (p.page >= template.page_count) {
            res.status(400).json({
              message: `필드 "${f.fieldKey}" 의 placement.page(${p.page}) 가 페이지 수(${template.page_count}) 를 초과합니다.`,
            })
            return
          }
        }
      }
      await replaceTemplateFields(pool, id, fields)
      const rows = await listFields(pool, id)
      res.json({ fields: rows.map(fieldRowToDto) })
    } catch (error) {
      if (error instanceof Error && /필드|placement|허용되지|중복|배열/.test(error.message)) {
        res.status(400).json({ message: error.message })
        return
      }
      handleDbError(res, error)
    }
  })

  apiRouter.get('/admin/pdf-templates/:id/file', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.', code: 'invalid-id' })
      return
    }
    /*
     * 실패 지점을 code 로 분리해 응답한다:
     *   - template-not-found: DB 에 해당 템플릿 없음
     *   - template-lookup-failed: DB 조회 자체가 실패
     *   - storage-fetch-failed: R2 등 스토리지에서 객체를 가져오지 못함
     * 클라이언트는 logger 가 서버 message/code 를 그대로 기록한다.
     */
    let template
    try {
      template = await getTemplateById(pool, id)
    } catch (error) {
      console.error('[pdf-templates] file lookup 실패', { id, error })
      res.status(500).json({
        message: '템플릿 조회 중 오류가 발생했습니다.',
        code: 'template-lookup-failed',
      })
      return
    }
    if (!template) {
      res.status(404).json({
        message: '템플릿을 찾을 수 없습니다.',
        code: 'template-not-found',
      })
      return
    }
    try {
      const buf = await getTemplateObject(template.storage_key)
      /*
       * 진단 로깅: 클라이언트가 "0 바이트를 받았다" 고 보고했지만 원인이 서버/프록시/클라이언트
       * 중 어디인지 불명확한 상태를 해결하기 위한 최소 관찰 포인트다.
       * 여기서 기록하는 byteLength 와 클라이언트가 arrayBuffer().byteLength 로 측정한 값이
       * 다르면 그 사이 경로(Railway edge/압축/캐시) 가 범인이 된다.
       * 운영 노이즈를 줄이려 warn 이 아닌 info 로 둔다(Railway 는 info 도 수집).
       */
      console.info('[pdf-templates] file serve', {
        id,
        storageKey: template.storage_key,
        byteLength: buf?.length ?? 0,
        userAgent: req.headers['user-agent'] ?? null,
      })
      if (!buf || buf.length === 0) {
        /* 스토리지가 0 바이트 객체를 반환하면 클라이언트에 "형식 파싱 실패" 로 오인되어
           도달한다. 여기서 502 로 끊어 UX 와 책임 소재를 명확히 한다. */
        console.error('[pdf-templates] storage returned empty buffer', {
          id,
          storageKey: template.storage_key,
        })
        res.status(502).json({
          message: '원본 PDF 가 비어 있습니다. 업로드를 다시 시도해 주세요.',
          code: 'storage-empty-object',
        })
        return
      }
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', String(buf.length))
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
      res.send(buf)
    } catch (error) {
      console.error('[pdf-templates] storage fetch 실패', {
        id,
        storageKey: template.storage_key,
        error,
      })
      res.status(502).json({
        message: '원본 PDF 를 가져오지 못했습니다.',
        code: 'storage-fetch-failed',
      })
    }
  })

  apiRouter.delete('/admin/pdf-templates/:id', requireAuth, async (req, res) => {
    if (!requireSuperAdmin(req, res, isSuperAdminRole)) return
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    try {
      const template = await getTemplateById(pool, id)
      if (!template) {
        res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' })
        return
      }
      /*
       * 스토리지 먼저 지우고 DB 를 지운다.
       * 스토리지 삭제가 실패하면 DB row 를 남겨두고 에러를 반환해야 orphan 객체를 재시도로 정리할 수 있다.
       * (DB 만 날려버리면 복구 단서가 사라진다.)
       */
      try {
        await deleteTemplateObject(template.storage_key)
      } catch (storageError) {
        console.error('[pdf-templates] 스토리지 삭제 실패 — DB row 유지', storageError)
        res.status(502).json({
          message: '원본 PDF 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        })
        return
      }
      await deleteTemplate(pool, id)
      res.status(204).end()
    } catch (error) {
      handleDbError(res, error)
    }
  })

  // ─── 사용자 라우트 ────────────────────────────────────────────────

  apiRouter.get('/pdf-templates', requireAuth, async (req, res) => {
    try {
      const isSuper = isSuperAdminRole(req.user?.role)
      /* 비관리자 계정에 GA 컨텍스트가 없으면 전체 노출 위험이 있으므로 명시적으로 거절한다. */
      if (!isSuper && req.user?.gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없는 계정은 문서 목록을 조회할 수 없습니다.' })
        return
      }
      const gaIdForFilter = isSuper ? null : req.user?.gaId ?? null
      const rows = await listTemplates(pool, { gaId: gaIdForFilter, includeInactive: false })
      res.json({ templates: rows.map(templateToDto) })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.get('/pdf-templates/:id', requireAuth, async (req, res) => {
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    try {
      const template = await getTemplateById(pool, id)
      if (!canAccessTemplateForRequest(template, req, isSuperAdminRole) || !template.is_active) {
        res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' })
        return
      }
      const fields = await listFields(pool, id)
      res.json({
        template: templateToDto(template),
        fields: fields.map(fieldRowToDto),
      })
    } catch (error) {
      handleDbError(res, error)
    }
  })

  apiRouter.post('/pdf-templates/:id/render', requireAuth, async (req, res) => {
    const id = parseTemplateId(req.params.id)
    if (!id) {
      res.status(400).json({ message: 'id 가 올바르지 않습니다.' })
      return
    }
    try {
      const template = await getTemplateById(pool, id)
      if (!canAccessTemplateForRequest(template, req, isSuperAdminRole) || !template.is_active) {
        res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' })
        return
      }
      const fieldRows = await listFields(pool, id)
      const fields = fieldRows.map((row) =>
        normalizeFieldSpec(
          {
            fieldKey: row.field_key,
            label: row.label,
            fieldType: row.field_type,
            required: row.required,
            orderIndex: row.order_index,
            customerMapping: row.customer_mapping,
            options: Array.isArray(row.options) ? row.options : null,
            placements: Array.isArray(row.placements) ? row.placements : [],
          },
          row.order_index,
        ),
      )
      const valuesRaw =
        req.body && typeof req.body.values === 'object' && req.body.values !== null
          ? req.body.values
          : {}
      /*
       * 고객 자동 매핑: 사용자가 보낸 값을 기본으로 두고, 필드 정의에
       * customerMapping 이 설정되어 있으면 서버 DB 의 프로필 값으로 덮어쓴다.
       * 프로필 값이 비어 있으면 사용자가 입력한 값이 그대로 유지되므로
       * "값 없음" 인 계정도 수동 입력으로 발급을 이어갈 수 있다.
       */
      const needsMapping = fields.some((f) => f.customerMapping)
      const profile = needsMapping && req.user?.id ? await getCustomerProfile(pool, req.user.id) : null
      const valuesWithProfile = injectCustomerValues(fields, valuesRaw, profile)
      const validation = validateRenderValues(fields, valuesWithProfile)
      if (!validation.ok) {
        res.status(400).json({ message: validation.error })
        return
      }
      const templateBytes = await getTemplateObject(template.storage_key)
      const rendered = await stampPdf(templateBytes, fields, validation.normalized)

      const filename = encodeURIComponent(`${template.code}.pdf`)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="document.pdf"; filename*=UTF-8''${filename}`,
      )
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(rendered)
    } catch (error) {
      console.error('[pdf-templates] render 실패', error)
      const msg = error instanceof Error ? error.message : 'PDF 생성에 실패했습니다.'
      res.status(500).json({ message: msg })
    }
  })
}
