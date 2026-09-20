import { randomUUID } from 'node:crypto'
import {
  createInsuranceContactVCard,
  mapInsuranceContactRow,
  mapInsuranceContactUpdateRow,
  normalizeInsuranceContactPhone,
} from '../lib/insuranceContactPresentation.js'
import {
  buildInsuranceContactWhereClause,
  resolveInsuranceContactScope,
} from '../lib/insuranceContactScope.js'

function normalizeCategory(value) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'NON-LIFE' || normalized === 'NONLIFE') {
    return 'NON_LIFE'
  }
  return normalized
}

function parseUpsertBody(body) {
  const companyName = String(body?.companyName ?? body?.company_name ?? '').trim()
  const category = normalizeCategory(body?.category)
  const managerName = String(body?.managerName ?? body?.manager_name ?? '').trim()
  const position = String(body?.position ?? '').trim()
  const phoneNumber = normalizeInsuranceContactPhone(body?.phoneNumber ?? body?.phone_number ?? '')
  const description = String(body?.description ?? '').trim()
  return { companyName, category, managerName, position, phoneNumber, description }
}

function validateUpsertPayload(payload) {
  if (!['LIFE', 'NON_LIFE', 'GENERAL'].includes(payload.category)) {
    return '카테고리 값이 올바르지 않습니다.'
  }
  if (!payload.companyName || !payload.managerName || !payload.phoneNumber) {
    return '보험사명, 담당자명, 전화번호는 필수입니다.'
  }
  return null
}

async function touchContactLastUpdatedAt(client, contactScope) {
  if (contactScope.scope === 'GA') {
    await client.query(
      `
      INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
      VALUES ($1, NOW()::text, NOW())
      ON CONFLICT (meta_key) DO UPDATE
      SET meta_value = NOW()::text, updated_at = NOW()
      `,
      [`contact_last_updated_at:${contactScope.gaId}`],
    )
    return
  }
  if (contactScope.scope === 'USER') {
    await client.query(
      `
      INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
      VALUES ($1, NOW()::text, NOW())
      ON CONFLICT (meta_key) DO UPDATE
      SET meta_value = NOW()::text, updated_at = NOW()
      `,
      [`contact_last_updated_at:user:${contactScope.userId}`],
    )
  }
}

async function loadLastUpdatedAt(pool, safeQuery, contactScope, toIsoString) {
  const metaKey =
    contactScope.scope === 'GA'
      ? `contact_last_updated_at:${contactScope.gaId}`
      : `contact_last_updated_at:user:${contactScope.userId}`
  const metaResult = await safeQuery(
    pool,
    `
    SELECT meta_value
    FROM insurance_contact_meta
    WHERE meta_key = $1
    `,
    [metaKey],
  )
  return metaResult.rows[0]?.meta_value ? toIsoString(metaResult.rows[0].meta_value) : ''
}

/**
 * @param {import('express').Router} apiRouter
 */
export function registerInsuranceContactsApi(apiRouter, deps) {
  const {
    pool,
    safeQuery,
    requireAuth,
    handleDbError,
    effectiveTenantGaId,
    forbiddenResponse,
    isNewsManagerRole,
    toIsoString,
    withTransaction,
  } = deps

  const scopeDeps = { effectiveTenantGaId }

  apiRouter.get('/insurance/contacts', requireAuth, async (req, res) => {
    try {
      if (isNewsManagerRole(req.user?.role)) {
        forbiddenResponse(req, res, '채널 담당자는 이 목록에 접근할 수 없습니다.', {
          route: 'GET /insurance/contacts',
        })
        return
      }
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.reason === 'ga_context_missing') {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const where = buildInsuranceContactWhereClause(contactScope)
      if (!where) {
        res.status(401).json({ message: '인증이 필요합니다.' })
        return
      }

      const contactsResult = await safeQuery(
        pool,
        `
        SELECT id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        FROM insurance_contacts
        WHERE ${where.sql}
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
        where.params,
      )

      const fallbackUpdatedAt =
        contactsResult.rows.length > 0
          ? contactsResult.rows.reduce((latest, row) => {
              const candidate = toIsoString(row.updated_at)
              return candidate > latest ? candidate : latest
            }, '')
          : ''

      const lastUpdatedAt =
        (await loadLastUpdatedAt(pool, safeQuery, contactScope, toIsoString)) || fallbackUpdatedAt

      res.json({
        scope: contactScope.scope,
        lastUpdatedAt,
        contacts: contactsResult.rows.map(mapInsuranceContactRow),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/insurance/contacts', requireAuth, async (req, res) => {
    try {
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.scope !== 'USER') {
        res.status(403).json({ message: '개인 연락처 등록은 GENERAL 사용자만 가능합니다.' })
        return
      }
      if (req.user?.role !== 'USER') {
        res.status(403).json({ message: '권한이 없습니다.' })
        return
      }

      const payload = parseUpsertBody(req.body)
      const validationError = validateUpsertPayload(payload)
      if (validationError) {
        res.status(400).json({ message: validationError })
        return
      }

      const inserted = await withTransaction(async (client) => {
        const contactId = randomUUID()
        const contactResult = await safeQuery(
          client,
          `
          INSERT INTO insurance_contacts (
            id, owner_scope, user_id, ga_id, category, company_name, manager_name, position, phone_number, created_at, updated_at
          ) VALUES ($1, 'USER', $2, NULL, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
          `,
          [
            contactId,
            contactScope.userId,
            payload.category,
            payload.companyName,
            payload.managerName,
            payload.position,
            payload.phoneNumber,
          ],
        )
        await touchContactLastUpdatedAt(client, contactScope)
        return contactResult.rows[0]
      })

      res.status(201).json(mapInsuranceContactRow(inserted))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.put('/insurance/contacts/:id', requireAuth, async (req, res) => {
    try {
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.scope !== 'USER') {
        res.status(403).json({ message: '개인 연락처 수정은 GENERAL 사용자만 가능합니다.' })
        return
      }
      if (req.user?.role !== 'USER') {
        res.status(403).json({ message: '권한이 없습니다.' })
        return
      }

      const payload = parseUpsertBody(req.body)
      const validationError = validateUpsertPayload(payload)
      if (validationError) {
        res.status(400).json({ message: validationError })
        return
      }

      const contactId = String(req.params.id ?? '').trim()
      const updated = await withTransaction(async (client) => {
        const existing = await safeQuery(
          client,
          `
          SELECT id
          FROM insurance_contacts
          WHERE id = $1 AND owner_scope = 'USER' AND user_id = $2
          `,
          [contactId, contactScope.userId],
        )
        if (existing.rowCount === 0) {
          return null
        }

        const result = await safeQuery(
          client,
          `
          UPDATE insurance_contacts
          SET
            category = $1,
            company_name = $2,
            manager_name = $3,
            position = $4,
            phone_number = $5,
            updated_at = NOW()
          WHERE id = $6 AND owner_scope = 'USER' AND user_id = $7
          RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
          `,
          [
            payload.category,
            payload.companyName,
            payload.managerName,
            payload.position,
            payload.phoneNumber,
            contactId,
            contactScope.userId,
          ],
        )
        await touchContactLastUpdatedAt(client, contactScope)
        return result.rows[0]
      })

      if (!updated) {
        res.status(404).json({ message: '수정할 연락처를 찾을 수 없습니다.' })
        return
      }
      res.json(mapInsuranceContactRow(updated))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/insurance/contacts/:id', requireAuth, async (req, res) => {
    try {
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.scope !== 'USER') {
        res.status(403).json({ message: '개인 연락처 삭제는 GENERAL 사용자만 가능합니다.' })
        return
      }
      if (req.user?.role !== 'USER') {
        res.status(403).json({ message: '권한이 없습니다.' })
        return
      }

      const contactId = String(req.params.id ?? '').trim()
      const deleted = await withTransaction(async (client) => {
        const existing = await safeQuery(
          client,
          `
          SELECT id
          FROM insurance_contacts
          WHERE id = $1 AND owner_scope = 'USER' AND user_id = $2
          `,
          [contactId, contactScope.userId],
        )
        if (existing.rowCount === 0) {
          return false
        }
        await safeQuery(
          client,
          `DELETE FROM insurance_contacts WHERE id = $1 AND owner_scope = 'USER' AND user_id = $2`,
          [contactId, contactScope.userId],
        )
        await touchContactLastUpdatedAt(client, contactScope)
        return true
      })

      if (!deleted) {
        res.status(404).json({ message: '삭제할 연락처를 찾을 수 없습니다.' })
        return
      }
      res.status(204).send()
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/insurance/updates', requireAuth, async (req, res) => {
    try {
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.scope !== 'GA' || contactScope.gaId == null) {
        res.json([])
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
        [contactScope.gaId],
      )

      res.json(result.rows.map(mapInsuranceContactUpdateRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/insurance/contacts/:id/vcard', requireAuth, async (req, res) => {
    try {
      const contactScope = resolveInsuranceContactScope(scopeDeps, req)
      if (contactScope.reason === 'ga_context_missing') {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const where = buildInsuranceContactWhereClause(contactScope)
      if (!where) {
        res.status(401).json({ message: '인증이 필요합니다.' })
        return
      }

      const result = await safeQuery(
        pool,
        `
        SELECT id, company_name, manager_name, position, phone_number
        FROM insurance_contacts
        WHERE id = $1 AND ${where.sql}
        `,
        [req.params.id, ...where.params],
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
