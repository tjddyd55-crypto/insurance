import multer from 'multer'
import {
  getR2InsurerAttachmentsCacheControl,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  r2GetPresignedPutUrl,
} from '../lib/consentStorage.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { buildGaGroupLogoStorageKey } from '../storage/insuranceStorageKeys.js'
import { normalizeGaGroupSlug, validateGaGroupSlug } from '../lib/gaGroupSlug.js'
import { parsePublicGaGroupGasPagination } from '../lib/gaGroupPublicGasQuery.js'
import { findGaGroupMembershipForGa } from '../lib/gaGroupMembership.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  commitGaGroupExcelImport,
  hashExcelBuffer,
  parseGaGroupExcelRows,
  previewGaGroupExcelImport,
} from '../lib/gaGroupExcelImport.js'

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const ALLOWED_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_LOGO_BYTES = 2 * 1024 * 1024

function parseGroupIdParam(raw) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

function mapGroupRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerGaGroupApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = ctx

  apiRouter.get('/public/ga-groups/:slug', async (req, res) => {
    try {
      const slug = normalizeGaGroupSlug(req.params.slug)
      if (!slug) {
        res.status(404).json({ message: '그룹을 찾을 수 없습니다.' })
        return
      }
      const r = await systemQuery(
        pool,
        `
        SELECT id, name, slug, logo_url, is_active
        FROM ga_groups
        WHERE slug = $1
        LIMIT 1
        `,
        [slug],
      )
      const row = r.rows[0]
      if (!row || !row.is_active) {
        res.status(404).json({ message: '그룹을 찾을 수 없습니다.' })
        return
      }
      res.json({
        success: true,
        data: {
          name: String(row.name ?? ''),
          slug: String(row.slug ?? ''),
          logoUrl: row.logo_url ? String(row.logo_url) : null,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/public/ga-groups/:slug/gas', async (req, res) => {
    try {
      const slug = normalizeGaGroupSlug(req.params.slug)
      const q = String(req.query?.q ?? '').trim()
      if (!slug) {
        res.status(404).json({ message: '그룹을 찾을 수 없습니다.' })
        return
      }
      const groupRes = await systemQuery(
        pool,
        `SELECT id FROM ga_groups WHERE slug = $1 AND is_active = true LIMIT 1`,
        [slug],
      )
      const groupId = groupRes.rows[0]?.id
      if (!groupId) {
        res.status(404).json({ message: '그룹을 찾을 수 없습니다.' })
        return
      }
      const { limit, offset } = parsePublicGaGroupGasPagination(req.query)
      const params = [groupId]
      let searchSql = ''
      if (q) {
        params.push(`%${q}%`)
        searchSql = `AND (g.name ILIKE $2 OR UPPER(TRIM(g.code)) ILIKE UPPER(TRIM($2)))`
      }
      const countRes = await systemQuery(
        pool,
        `
        SELECT COUNT(*)::int AS total
        FROM ga_group_members m
        INNER JOIN ga_companies g ON g.id = m.ga_id
        WHERE m.group_id = $1
          AND g.is_deleted = false
          AND g.status = 'active'
          ${searchSql}
        `,
        params,
      )
      const total = Number(countRes.rows[0]?.total ?? 0)
      const limitParamIndex = params.length + 1
      const offsetParamIndex = params.length + 2
      const listParams = [...params, limit, offset]
      const r = await systemQuery(
        pool,
        `
        SELECT g.id, g.name, g.code
        FROM ga_group_members m
        INNER JOIN ga_companies g ON g.id = m.ga_id
        WHERE m.group_id = $1
          AND g.is_deleted = false
          AND g.status = 'active'
          ${searchSql}
        ORDER BY g.name ASC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
        `,
        listParams,
      )
      const nextOffset = offset + r.rows.length
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: Number(row.id),
          name: String(row.name ?? ''),
          code: String(row.code ?? ''),
        })),
        total,
        limit,
        offset,
        hasMore: nextOffset < total,
        nextOffset: nextOffset < total ? nextOffset : null,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  const guard = [requireAuth, requireSuperAdmin]

  apiRouter.get('/admin/ga-groups', guard, async (req, res) => {
    try {
      const r = await systemQuery(
        pool,
        `
        SELECT g.id, g.name, g.slug, g.logo_url, g.is_active, g.created_at, g.updated_at,
               COUNT(m.ga_id)::int AS ga_count
        FROM ga_groups g
        LEFT JOIN ga_group_members m ON m.group_id = g.id
        GROUP BY g.id
        ORDER BY g.id DESC
        `,
      )
      res.json(
        r.rows.map((row) => ({
          ...mapGroupRow(row),
          gaCount: Number(row.ga_count ?? 0),
        })),
      )
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/ga-groups', guard, async (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim()
      const slugCheck = validateGaGroupSlug(req.body?.slug ?? req.body?.urlSlug ?? '')
      if (!name) {
        res.status(400).json({ message: '그룹명을 입력하세요.' })
        return
      }
      if (!slugCheck.ok) {
        res.status(400).json({ message: slugCheck.message })
        return
      }
      const ins = await systemQuery(
        pool,
        `
        INSERT INTO ga_groups (name, slug, logo_url, is_active)
        VALUES ($1, $2, NULL, true)
        RETURNING id, name, slug, logo_url, is_active, created_at, updated_at
        `,
        [name, slugCheck.slug],
      )
      res.status(201).json(mapGroupRow(ins.rows[0]))
    } catch (e) {
      if (e?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 URL 슬러그입니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/ga-groups/:groupId', guard, async (req, res) => {
    try {
      const groupId = parseGroupIdParam(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const name = req.body?.name != null ? String(req.body.name).trim() : null
      const slugRaw = req.body?.slug ?? req.body?.urlSlug
      const logoUrl = req.body?.logoUrl ?? req.body?.logo_url
      const isActive = req.body?.isActive ?? req.body?.is_active

      const sets = []
      const params = []
      if (name) {
        params.push(name)
        sets.push(`name = $${params.length}`)
      }
      if (slugRaw != null) {
        const slugCheck = validateGaGroupSlug(slugRaw)
        if (!slugCheck.ok) {
          res.status(400).json({ message: slugCheck.message })
          return
        }
        params.push(slugCheck.slug)
        sets.push(`slug = $${params.length}`)
      }
      if (logoUrl !== undefined) {
        const v = logoUrl == null || logoUrl === '' ? null : String(logoUrl).trim()
        params.push(v)
        sets.push(`logo_url = $${params.length}`)
      }
      if (isActive !== undefined) {
        params.push(Boolean(isActive))
        sets.push(`is_active = $${params.length}`)
      }
      if (sets.length === 0) {
        res.status(400).json({ message: '변경할 항목이 없습니다.' })
        return
      }
      params.push(groupId)
      sets.push('updated_at = NOW()')
      const r = await systemQuery(
        pool,
        `
        UPDATE ga_groups
        SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, name, slug, logo_url, is_active, created_at, updated_at
        `,
        params,
      )
      if (r.rowCount === 0) {
        res.status(404).json({ message: '그룹을 찾을 수 없습니다.' })
        return
      }
      res.json(mapGroupRow(r.rows[0]))
    } catch (e) {
      if (e?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 URL 슬러그입니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/ga-groups/:groupId/members', guard, async (req, res) => {
    try {
      const groupId = parseGroupIdParam(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const r = await systemQuery(
        pool,
        `
        SELECT g.id, g.name, g.code, g.status, m.created_at AS linked_at
        FROM ga_group_members m
        INNER JOIN ga_companies g ON g.id = m.ga_id
        WHERE m.group_id = $1 AND g.is_deleted = false
        ORDER BY g.name ASC
        `,
        [groupId],
      )
      res.json(
        r.rows.map((row) => ({
          id: Number(row.id),
          name: String(row.name ?? ''),
          code: String(row.code ?? ''),
          status: String(row.status ?? 'active'),
          linkedAt: row.linked_at,
        })),
      )
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/ga-groups/ga-search', guard, async (req, res) => {
    try {
      const q = String(req.query?.q ?? '').trim()
      const excludeGroupId = parseGroupIdParam(req.query?.excludeGroupId ?? req.query?.exclude_group_id)
      const params = []
      let where = `g.is_deleted = false`
      if (q) {
        params.push(`%${q}%`)
        where += ` AND (g.name ILIKE $${params.length} OR g.code ILIKE $${params.length})`
      }
      const r = await systemQuery(
        pool,
        `
        SELECT g.id, g.name, g.code, g.status, m.group_id, gg.name AS group_name, gg.slug AS group_slug
        FROM ga_companies g
        LEFT JOIN ga_group_members m ON m.ga_id = g.id
        LEFT JOIN ga_groups gg ON gg.id = m.group_id
        WHERE ${where}
        ORDER BY g.name ASC
        LIMIT 40
        `,
        params,
      )
      res.json(
        r.rows.map((row) => ({
          id: Number(row.id),
          name: String(row.name ?? ''),
          code: String(row.code ?? ''),
          status: String(row.status ?? 'active'),
          groupId: row.group_id != null ? Number(row.group_id) : null,
          groupName: row.group_name ? String(row.group_name) : null,
          groupSlug: row.group_slug ? String(row.group_slug) : null,
          inOtherGroup:
            row.group_id != null &&
            excludeGroupId != null &&
            Number(row.group_id) !== excludeGroupId,
        })),
      )
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/ga-groups/:groupId/members', guard, async (req, res) => {
    try {
      const groupId = parseGroupIdParam(req.params.groupId)
      const gaIds = Array.isArray(req.body?.gaIds)
        ? req.body.gaIds.map((v) => parseGaId(v)).filter((v) => v != null)
        : []
      const confirmMove = Boolean(req.body?.confirmMove ?? req.body?.confirm_move)
      if (groupId == null || gaIds.length === 0) {
        res.status(400).json({ message: '연결할 GA를 선택하세요.' })
        return
      }

      const blocked = []
      for (const gaId of gaIds) {
        const existing = await findGaGroupMembershipForGa(pool, gaId)
        if (existing && existing.groupId !== groupId) {
          if (!confirmMove) {
            blocked.push(existing)
            continue
          }
        }
        await systemQuery(pool, `DELETE FROM ga_group_members WHERE ga_id = $1`, [gaId])
        await systemQuery(
          pool,
          `
          INSERT INTO ga_group_members (ga_id, group_id)
          VALUES ($1, $2)
          ON CONFLICT (ga_id) DO UPDATE SET group_id = EXCLUDED.group_id
          `,
          [gaId, groupId],
        )
      }

      if (blocked.length > 0 && !confirmMove) {
        res.status(409).json({
          message: '다른 그룹에 속한 GA가 있습니다. 확인 후 다시 시도하세요.',
          blocked,
        })
        return
      }
      res.json({ ok: true, linked: gaIds.length - blocked.length })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.delete('/admin/ga-groups/:groupId/members/:gaId', guard, async (req, res) => {
    try {
      const groupId = parseGroupIdParam(req.params.groupId)
      const gaId = parseGaId(req.params.gaId)
      if (groupId == null || gaId == null) {
        res.status(400).json({ message: '잘못된 요청입니다.' })
        return
      }
      await systemQuery(
        pool,
        `DELETE FROM ga_group_members WHERE group_id = $1 AND ga_id = $2`,
        [groupId, gaId],
      )
      res.json({ ok: true })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/ga-groups/:groupId/logo/presign', guard, async (req, res) => {
    try {
      if (!isConsentR2Enabled()) {
        res.status(503).json({ message: '파일 저장소가 구성되지 않았습니다.' })
        return
      }
      const groupId = parseGroupIdParam(req.params.groupId)
      if (groupId == null) {
        res.status(400).json({ message: '잘못된 그룹 ID입니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const fileName = String(body.fileName ?? body.file_name ?? 'logo.png').trim() || 'logo.png'
      const contentType = String(body.contentType ?? body.content_type ?? 'image/png').trim()
      const sizeBytes = Number(body.sizeBytes ?? body.size ?? 0)
      if (!ALLOWED_LOGO_MIME.has(contentType)) {
        res.status(400).json({ message: '허용되지 않은 이미지 형식입니다.' })
        return
      }
      if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_LOGO_BYTES) {
        res.status(400).json({ message: '이미지 크기가 허용 범위를 벗어났습니다.' })
        return
      }
      const storageKey = buildGaGroupLogoStorageKey({ groupId, fileName })
      const cacheControl = getR2InsurerAttachmentsCacheControl()
      const uploadUrl = await r2GetPresignedPutUrl(storageKey, contentType, 900, { cacheControl })
      if (!uploadUrl) {
        res.status(503).json({ message: '업로드 URL을 만들 수 없습니다.' })
        return
      }
      res.json({
        uploadUrl,
        storageKey,
        publicUrl: `${getR2PublicCdnBase()}/${storageKey}`,
        contentType,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post(
    '/admin/ga-groups/:groupId/excel/preview',
    guard,
    uploadExcel.single('file'),
    async (req, res) => {
      try {
        const groupId = parseGroupIdParam(req.params.groupId)
        const file = req.file
        if (groupId == null || !file?.buffer) {
          res.status(400).json({ message: '엑셀 파일이 필요합니다.' })
          return
        }
        const rows = parseGaGroupExcelRows(file.buffer)
        const preview = await previewGaGroupExcelImport(pool, { groupId, rows })
        const fileHash = hashExcelBuffer(file.buffer)
        const dup = await systemQuery(
          pool,
          `SELECT id FROM ga_group_excel_upload_batches WHERE group_id = $1 AND file_hash = $2 LIMIT 1`,
          [groupId, fileHash],
        )
        res.json({
          preview,
          fileHash,
          duplicateFile: dup.rowCount > 0,
          summary: {
            createNew: preview.filter((r) => r.status === 'create_new').length,
            linkExisting: preview.filter((r) => r.status === 'link_existing').length,
            alreadyLinked: preview.filter((r) => r.status === 'already_linked').length,
            needsConfirm: preview.filter((r) => r.status === 'needs_move_confirm').length,
            errors: preview.filter((r) => r.status === 'error').length,
          },
        })
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  )

  apiRouter.post('/admin/ga-groups/:groupId/excel/commit', guard, async (req, res) => {
    try {
      const groupId = parseGroupIdParam(req.params.groupId)
      const preview = Array.isArray(req.body?.preview) ? req.body.preview : null
      const fileHash = String(req.body?.fileHash ?? req.body?.file_hash ?? '').trim()
      const allowMove = Boolean(req.body?.allowMoveFromOtherGroup ?? req.body?.allow_move)
      const forceDuplicate = Boolean(req.body?.forceDuplicateFile ?? req.body?.force_duplicate_file)
      if (groupId == null || !preview) {
        res.status(400).json({ message: '미리보기 데이터가 필요합니다.' })
        return
      }
      if (fileHash && !forceDuplicate) {
        const dup = await systemQuery(
          pool,
          `SELECT id FROM ga_group_excel_upload_batches WHERE group_id = $1 AND file_hash = $2 LIMIT 1`,
          [groupId, fileHash],
        )
        if (dup.rowCount > 0) {
          res.status(409).json({ message: '이미 처리된 엑셀 파일입니다.' })
          return
        }
      }
      const summary = await commitGaGroupExcelImport(pool, {
        groupId,
        previewRows: preview,
        allowMoveFromOtherGroup: allowMove,
      })
      if (fileHash) {
        await systemQuery(
          pool,
          `INSERT INTO ga_group_excel_upload_batches (group_id, file_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [groupId, fileHash],
        )
      }
      res.json({ ok: true, summary })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
