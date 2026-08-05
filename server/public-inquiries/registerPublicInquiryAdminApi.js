/**
 * SUPER_ADMIN — 공개 프로그램 문의 관리 API.
 * 가드: requireAuth + requireSuperAdmin (feature-requests 관리와 동일).
 */

import { systemQuery } from '../utils/dbSafeQuery.js'
import { logSecurityEvent } from '../lib/securityAudit.js'
import {
  isUuid,
  mapPublicInquiryAdminRow,
  parsePublicInquiryAdminListQuery,
  parsePublicInquiryAdminPatchBody,
  resolveInquiryResolvedAt,
} from './publicInquiryAdminValidation.js'

const LIST_SELECT = `
  psi.id,
  psi.inquiry_type,
  psi.name,
  psi.phone_normalized,
  psi.phone_display,
  psi.organization_name,
  psi.email,
  psi.preferred_contact_time,
  psi.message,
  psi.privacy_consent,
  psi.privacy_consent_at,
  psi.status,
  psi.admin_memo,
  psi.assigned_admin_id,
  psi.source,
  psi.created_at,
  psi.updated_at,
  psi.resolved_at,
  psi.deleted_at,
  COALESCE(
    NULLIF(TRIM(u.display_name), ''),
    NULLIF(TRIM(u.name), ''),
    NULLIF(TRIM(u.username), ''),
    psi.assigned_admin_id
  ) AS assigned_admin_name
`

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} message
 */
function jsonError(res, status, message) {
  res.status(status).json({
    success: false,
    error: { message },
    message,
  })
}

/**
 * @param {import('pg').Pool} pool
 */
async function countNewInquiries(pool) {
  const r = await systemQuery(
    pool,
    `
    SELECT COUNT(*)::int AS c
    FROM public_service_inquiries
    WHERE status = 'NEW' AND deleted_at IS NULL
    `,
    [],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.requireSuperAdmin
 * @param {Function} ctx.handleDbError
 */
export function registerPublicInquiryAdminApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = ctx
  const guard = [requireAuth, requireSuperAdmin]

  apiRouter.get('/admin/public-inquiries/new-count', ...guard, async (req, res) => {
    try {
      const newCount = await countNewInquiries(pool)
      res.json({ success: true, data: { newCount } })
    } catch (error) {
      if (typeof handleDbError === 'function') {
        handleDbError(error, req, res)
      }
      if (!res.headersSent) {
        jsonError(res, 500, '신규 문의 수를 조회하지 못했습니다.')
      }
    }
  })

  apiRouter.get('/admin/public-inquiries', ...guard, async (req, res) => {
    try {
      const parsed = parsePublicInquiryAdminListQuery(req.query)
      if (!parsed.ok) {
        jsonError(res, 400, parsed.message)
        return
      }
      const { status, inquiryType, q, from, to, page, pageSize } = parsed.value

      /** @type {unknown[]} */
      const params = []
      const where = ['psi.deleted_at IS NULL']

      if (status) {
        params.push(status)
        where.push(`psi.status = $${params.length}`)
      }
      if (inquiryType) {
        params.push(inquiryType)
        where.push(`psi.inquiry_type = $${params.length}`)
      }
      if (q) {
        params.push(`%${q}%`)
        const p = `$${params.length}`
        where.push(
          `(psi.name ILIKE ${p} OR psi.phone_display ILIKE ${p} OR psi.phone_normalized ILIKE ${p} OR COALESCE(psi.organization_name, '') ILIKE ${p})`,
        )
      }
      if (from) {
        params.push(from)
        where.push(`psi.created_at >= $${params.length}`)
      }
      if (to) {
        params.push(to)
        where.push(`psi.created_at <= $${params.length}`)
      }

      const whereSql = where.join(' AND ')
      const offset = (page - 1) * pageSize

      const countRes = await systemQuery(
        pool,
        `SELECT COUNT(*)::int AS c FROM public_service_inquiries psi WHERE ${whereSql}`,
        params,
      )
      const total = Number(countRes.rows[0]?.c ?? 0)

      const listParams = [...params, pageSize, offset]
      const listRes = await systemQuery(
        pool,
        `
        SELECT ${LIST_SELECT}
        FROM public_service_inquiries psi
        LEFT JOIN users u ON u.id = psi.assigned_admin_id
        WHERE ${whereSql}
        ORDER BY psi.created_at DESC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
        `,
        listParams,
      )

      const newCount = await countNewInquiries(pool)
      const items = listRes.rows.map((row) => mapPublicInquiryAdminRow(row))

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          newCount,
        },
      })
    } catch (error) {
      if (typeof handleDbError === 'function') {
        handleDbError(error, req, res)
      }
      if (!res.headersSent) {
        jsonError(res, 500, '문의 목록을 조회하지 못했습니다.')
      }
    }
  })

  apiRouter.get('/admin/public-inquiries/:id', ...guard, async (req, res) => {
    try {
      const id = String(req.params.id ?? '').trim()
      if (!isUuid(id)) {
        jsonError(res, 400, '잘못된 ID입니다.')
        return
      }

      const r = await systemQuery(
        pool,
        `
        SELECT ${LIST_SELECT}
        FROM public_service_inquiries psi
        LEFT JOIN users u ON u.id = psi.assigned_admin_id
        WHERE psi.id = $1 AND psi.deleted_at IS NULL
        LIMIT 1
        `,
        [id],
      )

      if (!r.rows[0]) {
        jsonError(res, 404, '문의를 찾을 수 없습니다.')
        return
      }

      res.json({ success: true, data: mapPublicInquiryAdminRow(r.rows[0]) })
    } catch (error) {
      if (typeof handleDbError === 'function') {
        handleDbError(error, req, res)
      }
      if (!res.headersSent) {
        jsonError(res, 500, '문의를 조회하지 못했습니다.')
      }
    }
  })

  apiRouter.patch('/admin/public-inquiries/:id', ...guard, async (req, res) => {
    try {
      const id = String(req.params.id ?? '').trim()
      if (!isUuid(id)) {
        jsonError(res, 400, '잘못된 ID입니다.')
        return
      }

      const parsed = parsePublicInquiryAdminPatchBody(req.body)
      if (!parsed.ok) {
        jsonError(res, 400, parsed.message)
        return
      }
      const patch = parsed.value

      const existing = await systemQuery(
        pool,
        `
        SELECT id, status, admin_memo, assigned_admin_id, resolved_at, deleted_at
        FROM public_service_inquiries
        WHERE id = $1
        LIMIT 1
        `,
        [id],
      )
      const prev = existing.rows[0]
      if (!prev || prev.deleted_at != null) {
        jsonError(res, 404, '문의를 찾을 수 없습니다.')
        return
      }

      if (patch.assignedAdminId) {
        const userCheck = await systemQuery(
          pool,
          `SELECT id FROM users WHERE id = $1 LIMIT 1`,
          [patch.assignedAdminId],
        )
        if (!userCheck.rows[0]) {
          jsonError(res, 400, '배정할 관리자를 찾을 수 없습니다.')
          return
        }
      }

      const actorUserId = String(req.user?.id ?? '')
      const actorRole = String(req.user?.role ?? 'SUPER_ADMIN')
      const auditBase = {
        actorUserId,
        actorRole,
        targetType: 'public_service_inquiry',
        targetId: id,
      }

      /** @type {string[]} */
      const sets = ['updated_at = NOW()']
      /** @type {unknown[]} */
      const params = []

      if (patch.status != null) {
        const prevStatus = String(prev.status)
        const nextStatus = patch.status
        params.push(nextStatus)
        sets.push(`status = $${params.length}`)

        const resolved = resolveInquiryResolvedAt(prevStatus, nextStatus, prev.resolved_at)
        if (resolved.setResolvedAtNow) {
          sets.push('resolved_at = NOW()')
        } else if (resolved.clearResolvedAt) {
          sets.push('resolved_at = NULL')
        }

        if (prevStatus !== nextStatus) {
          void logSecurityEvent(pool, {
            ...auditBase,
            action: 'public_inquiry_status_changed',
            meta: { from: prevStatus, to: nextStatus },
          })
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'adminMemo')) {
        params.push(patch.adminMemo)
        sets.push(`admin_memo = $${params.length}`)
        const prevMemo = prev.admin_memo != null ? String(prev.admin_memo) : null
        if (prevMemo !== (patch.adminMemo ?? null)) {
          void logSecurityEvent(pool, {
            ...auditBase,
            action: 'public_inquiry_memo_updated',
            meta: { memoLength: patch.adminMemo != null ? String(patch.adminMemo).length : 0 },
          })
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'assignedAdminId')) {
        params.push(patch.assignedAdminId)
        sets.push(`assigned_admin_id = $${params.length}`)
        const prevAssignee = prev.assigned_admin_id != null ? String(prev.assigned_admin_id) : null
        if (prevAssignee !== (patch.assignedAdminId ?? null)) {
          void logSecurityEvent(pool, {
            ...auditBase,
            action: 'public_inquiry_assigned',
            meta: {
              fromAssigned: Boolean(prevAssignee),
              toAssigned: Boolean(patch.assignedAdminId),
            },
          })
        }
      }

      if (patch.softDelete === true) {
        sets.push('deleted_at = NOW()')
        void logSecurityEvent(pool, {
          ...auditBase,
          action: 'public_inquiry_deleted',
          meta: { soft: true },
        })
      }

      params.push(id)
      const upd = await systemQuery(
        pool,
        `
        UPDATE public_service_inquiries
        SET ${sets.join(', ')}
        WHERE id = $${params.length} AND deleted_at IS NULL
        RETURNING id
        `,
        params,
      )

      if (!upd.rows[0]) {
        jsonError(res, 404, '문의를 찾을 수 없습니다.')
        return
      }

      if (patch.softDelete === true) {
        res.json({ success: true, data: { id, deleted: true } })
        return
      }

      const detail = await systemQuery(
        pool,
        `
        SELECT ${LIST_SELECT}
        FROM public_service_inquiries psi
        LEFT JOIN users u ON u.id = psi.assigned_admin_id
        WHERE psi.id = $1
        LIMIT 1
        `,
        [id],
      )

      res.json({ success: true, data: mapPublicInquiryAdminRow(detail.rows[0]) })
    } catch (error) {
      if (typeof handleDbError === 'function') {
        handleDbError(error, req, res)
      }
      if (!res.headersSent) {
        jsonError(res, 500, '문의 수정에 실패했습니다.')
      }
    }
  })
}
