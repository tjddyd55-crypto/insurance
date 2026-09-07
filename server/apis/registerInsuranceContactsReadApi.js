import {
  createInsuranceContactVCard,
  mapInsuranceContactRow,
  mapInsuranceContactUpdateRow,
} from '../lib/insuranceContactPresentation.js'

/**
 * Read-only insurance contact directory routes (agent-facing).
 *
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   safeQuery: Function,
 *   requireAuth: Function,
 *   handleDbError: Function,
 *   effectiveTenantGaId: Function,
 *   forbiddenResponse: Function,
 *   isNewsManagerRole: Function,
 *   toIsoString: Function,
 * }} deps
 */
export function registerInsuranceContactsReadApi(apiRouter, deps) {
  const {
    pool,
    safeQuery,
    requireAuth,
    handleDbError,
    effectiveTenantGaId,
    forbiddenResponse,
    isNewsManagerRole,
    toIsoString,
  } = deps

  apiRouter.get('/insurance/contacts', requireAuth, async (req, res) => {
    try {
      if (isNewsManagerRole(req.user?.role)) {
        forbiddenResponse(req, res, '채널 담당자는 이 목록에 접근할 수 없습니다.', {
          route: 'GET /insurance/contacts',
        })
        return
      }
      const gaId = effectiveTenantGaId(req)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const contactsResult = await safeQuery(
        pool,
        `
      SELECT id, category, company_name, manager_name, position, phone_number, created_at, updated_at
      FROM insurance_contacts
      WHERE ga_id = $1
      ORDER BY
        CASE category
          WHEN 'LIFE' THEN 1
          WHEN 'NON_LIFE' THEN 2
          WHEN 'GENERAL' THEN 3
          ELSE 4
        END,
        company_name ASC,
        manager_name ASC
      `,
        [gaId],
      )

      const metaResult = await safeQuery(
        pool,
        `
      SELECT meta_value, $2 AS ga_id
      FROM insurance_contact_meta
      WHERE meta_key = $1
      `,
        [`contact_last_updated_at:${gaId}`, gaId],
      )

      const fallbackUpdatedAt =
        contactsResult.rows.length > 0
          ? contactsResult.rows.reduce((latest, row) => {
              const candidate = toIsoString(row.updated_at)
              return candidate > latest ? candidate : latest
            }, '')
          : ''

      res.json({
        lastUpdatedAt: metaResult.rows[0]?.meta_value
          ? toIsoString(metaResult.rows[0].meta_value)
          : fallbackUpdatedAt,
        contacts: contactsResult.rows.map(mapInsuranceContactRow),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/insurance/updates', requireAuth, async (req, res) => {
    try {
      const gaId = effectiveTenantGaId(req)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
      SELECT
        id,
        contact_id,
        action_type,
        category,
        company_name,
        manager_name,
        position,
        old_phone_number,
        new_phone_number,
        description,
        created_at
      FROM insurance_contact_updates
      WHERE ga_id = $1
      ORDER BY created_at DESC
      `,
        [gaId],
      )

      res.json(result.rows.map(mapInsuranceContactUpdateRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/insurance/contacts/:id/vcard', requireAuth, async (req, res) => {
    try {
      const gaId = effectiveTenantGaId(req)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const result = await safeQuery(
        pool,
        `
      SELECT id, company_name, manager_name, position, phone_number
      FROM insurance_contacts
      WHERE id = $1 AND ga_id = $2
      `,
        [req.params.id, gaId],
      )

      if (result.rowCount === 0) {
        res.status(404).json({ message: '연락처를 찾을 수 없습니다.' })
        return
      }

      const contact = result.rows[0]
      const safeName = `${contact.company_name}_${contact.manager_name}`
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80)

      res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.vcf"`)
      res.send(createInsuranceContactVCard(contact))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
