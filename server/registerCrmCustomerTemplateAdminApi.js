/**
 * 플랫폼 SUPER_ADMIN 전용 — 동적 고객관리 템플릿 CRUD + 테넌트별 템플릿 오버레이.
 */

import { normalizeCrmCustomerManagementTemplateBody } from './crm/crmCustomerManagementTemplateNormalize.js'
import { mapCrmCustomerManagementRowToIndustryTemplatePayload } from './crm/mapCrmCustomerManagementRowToIndustryTemplate.js'

/**
 * @param {import('express').Router} router
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   requireSuperAdmin: import('express').RequestHandler,
 *   handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void
 * }} deps
 */
export function registerCrmCustomerTemplateAdminApi(router, deps) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = deps

  const guard = /** @type {const} */ ([requireAuth, requireSuperAdmin])

  router.get('/admin/platform/crm-customer-management-templates', guard, async (req, res) => {
    try {
      const ind = req.query.industry_code != null ? String(req.query.industry_code).trim().toLowerCase() : ''
      let sql = `
        SELECT *
        FROM crm_customer_management_templates
        ORDER BY industry_code ASC, updated_at DESC
      `
      const vals = []
      if (ind) {
        sql = `
          SELECT *
          FROM crm_customer_management_templates
          WHERE industry_code = $1
          ORDER BY updated_at DESC
        `
        vals.push(ind)
      }
      const r = await pool.query(sql, vals)
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          ...row,
          resolved: mapCrmCustomerManagementRowToIndustryTemplatePayload(row),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/admin/platform/crm-customer-management-templates/:id', guard, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: 'invalid id' })
        return
      }
      const r = await pool.query(`SELECT * FROM crm_customer_management_templates WHERE id = $1 LIMIT 1`, [id])
      const row = r.rows[0]
      if (!row) {
        res.status(404).json({ message: 'not found' })
        return
      }
      res.json({
        success: true,
        data: {
          row,
          resolved: mapCrmCustomerManagementRowToIndustryTemplatePayload(row),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/admin/platform/crm-customer-management-templates', guard, async (req, res) => {
    try {
      const normalized = normalizeCrmCustomerManagementTemplateBody(req.body)
      if (!normalized.ok) {
        res.status(normalized.status).json({ message: normalized.message })
        return
      }
      const d = normalized.data

      const indCheck = await pool.query(`SELECT code FROM industries WHERE code = $1 LIMIT 1`, [d.industryCode])
      if (indCheck.rowCount === 0) {
        res.status(400).json({ message: `industry_code 미존재: ${d.industryCode}` })
        return
      }

      const ins = await pool.query(
        `
        INSERT INTO crm_customer_management_templates (
          name, industry_code, description, status, revision,
          form_fields, list_columns, detail_tabs, metadata,
          shared_feature_bindings, extension_feature_bindings
        ) VALUES ($1,$2,$3,$4,$5,CAST($6 AS JSONB),CAST($7 AS JSONB),CAST($8 AS JSONB),CAST($9 AS JSONB),CAST($10 AS JSONB),CAST($11 AS JSONB))
        RETURNING *
        `,
        [
          d.name,
          d.industryCode,
          d.description,
          d.status,
          1,
          JSON.stringify(d.formFields),
          JSON.stringify(d.listColumns),
          JSON.stringify(d.detailTabs),
          JSON.stringify(d.metadata),
          JSON.stringify(d.sharedFeatureBindings),
          JSON.stringify(d.extensionFeatureBindings),
        ],
      )
      const row = ins.rows[0]
      res.status(201).json({
        success: true,
        data: {
          row,
          resolved: mapCrmCustomerManagementRowToIndustryTemplatePayload(row),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.put('/admin/platform/crm-customer-management-templates/:id', guard, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: 'invalid id' })
        return
      }
      const cur = await pool.query(`SELECT id, revision FROM crm_customer_management_templates WHERE id = $1 LIMIT 1`, [
        id,
      ])
      if (cur.rowCount === 0) {
        res.status(404).json({ message: 'not found' })
        return
      }
      const prevRev =
        typeof cur.rows[0].revision === 'number' && Number.isInteger(cur.rows[0].revision)
          ? cur.rows[0].revision
          : 1

      const normalized = normalizeCrmCustomerManagementTemplateBody(req.body)
      if (!normalized.ok) {
        res.status(normalized.status).json({ message: normalized.message })
        return
      }
      const d = normalized.data

      const indCheck = await pool.query(`SELECT code FROM industries WHERE code = $1 LIMIT 1`, [d.industryCode])
      if (indCheck.rowCount === 0) {
        res.status(400).json({ message: `industry_code 미존재: ${d.industryCode}` })
        return
      }

      const upd = await pool.query(
        `
        UPDATE crm_customer_management_templates SET
          name = $2,
          industry_code = $3,
          description = $4,
          status = $5,
          revision = $6,
          form_fields = CAST($7 AS JSONB),
          list_columns = CAST($8 AS JSONB),
          detail_tabs = CAST($9 AS JSONB),
          metadata = CAST($10 AS JSONB),
          shared_feature_bindings = CAST($11 AS JSONB),
          extension_feature_bindings = CAST($12 AS JSONB),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          d.name,
          d.industryCode,
          d.description,
          d.status,
          prevRev + 1,
          JSON.stringify(d.formFields),
          JSON.stringify(d.listColumns),
          JSON.stringify(d.detailTabs),
          JSON.stringify(d.metadata),
          JSON.stringify(d.sharedFeatureBindings),
          JSON.stringify(d.extensionFeatureBindings),
        ],
      )
      const row = upd.rows[0]
      res.json({
        success: true,
        data: {
          row,
          resolved: mapCrmCustomerManagementRowToIndustryTemplatePayload(row),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  /**
   * 테넌트가 사용할 동적 템플릿 id 고정(null 이면 업종 디폴트로 복귀).
   */
  router.patch('/admin/platform/tenants/:tenantId/crm-customer-template', guard, async (req, res) => {
    try {
      const tenantId = Number(req.params.tenantId)
      if (!Number.isInteger(tenantId) || tenantId < 1) {
        res.status(400).json({ message: 'invalid tenantId' })
        return
      }
      const tplRaw = req.body?.crm_customer_template_id ?? req.body?.crmCustomerTemplateId
      let nextFk = null
      if (tplRaw !== null && tplRaw !== undefined && String(tplRaw).trim() !== '') {
        const tplId =
          typeof tplRaw === 'number' && Number.isInteger(tplRaw) && tplRaw > 0
            ? tplRaw
            : typeof tplRaw === 'string' && /^\d+$/.test(tplRaw.trim())
              ? Number(tplRaw.trim())
              : NaN

        if (!Number.isInteger(tplId)) {
          res.status(400).json({ message: 'crm_customer_template_id 형식 오류' })
          return
        }

        const tplR2 = await pool.query(
          `
          SELECT t.id, t.industry_code, ti.code AS tenant_industry_code
          FROM crm_customer_management_templates t
          INNER JOIN tenants tn ON tn.id = $2
          INNER JOIN industries ti ON ti.id = tn.industry_id
          WHERE t.id = $1 AND t.industry_code = ti.code AND t.status = 'active'
          LIMIT 1
          `,
          [tplId, tenantId],
        )
        if (tplR2.rowCount === 0) {
          res.status(400).json({ message: '템플릿이 존재하지 않거나 업종과 맞지 않거나 비활성입니다.' })
          return
        }
        nextFk = tplId
      }

      const tRow = await pool.query(`SELECT id FROM tenants WHERE id = $1 LIMIT 1`, [tenantId])
      if (tRow.rowCount === 0) {
        res.status(404).json({ message: 'tenant not found' })
        return
      }

      const u = await pool.query(
        `
        UPDATE tenants
        SET crm_customer_template_id = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, crm_customer_template_id
        `,
        [tenantId, nextFk],
      )
      res.json({ success: true, data: u.rows[0] })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
