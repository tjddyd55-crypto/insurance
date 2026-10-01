import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { assertCustomerRowAccessibleByVisibility } from '../lib/customerRowVisibilitySql.js'
import { formatCoverageConsultationDateYmd } from './coverageSeoulDate.js'
import { validateSimulationPayload, validateTemplatePayload } from './coverageSimulatorStorageValidation.js'

function storageHttpError(status, code, message) {
  const err = new Error(message)
  err.httpStatus = status
  err.code = code
  return err
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string; gaId: number }} owner
 * @param {string} legacyClientId
 * @param {'coverage_scenario_templates' | 'coverage_simulations'} table
 */
async function loadRowByLegacyClientId(pool, owner, legacyClientId, table) {
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM ${table}
    WHERE owner_user_id = $1 AND ga_id = $2 AND legacy_client_id = $3
    LIMIT 1
    `,
    [owner.userId, owner.gaId, legacyClientId],
  )
  return r.rows[0] ?? null
}

function isLegacyUniqueViolation(error) {
  return error?.code === '23505' && String(error?.constraint ?? '').includes('legacy')
}

/**
 * @param {import('express').Request} req
 */
export function resolveCoverageStorageOwner(req, res) {
  const userId = req.user?.id ? String(req.user.id) : ''
  if (!userId) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.gaId ?? req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 필요합니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {import('pg').Pool} pool
 */
async function assertCustomerAccessible(pool, req, gaId, customerId) {
  if (!customerId) return
  const cid = Number(customerId)
  if (!Number.isInteger(cid) || cid < 1) {
    throw storageHttpError(400, 'COVERAGE_VALIDATION_FAILED', '고객 ID 형식이 올바르지 않습니다.')
  }
  const ok = await assertCustomerRowAccessibleByVisibility(pool, safeQuery, req, cid)
  if (!ok) {
    throw storageHttpError(403, 'COVERAGE_SIMULATION_FORBIDDEN', '해당 고객에 대한 접근 권한이 없습니다.')
  }
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapTemplateRow(row) {
  return {
    id: String(row.id),
    legacyClientId: row.legacy_client_id ?? null,
    name: row.name ?? '',
    description: row.description ?? '',
    sourceType: 'user',
    diseaseType: row.disease_type ?? 'custom',
    items: row.items_json ?? [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapSimulationRow(row) {
  const consultationDate = formatCoverageConsultationDateYmd(row.consultation_date)
  return {
    id: String(row.id),
    legacyClientId: row.legacy_client_id ?? null,
    kind: 'consultation',
    title: row.title ?? '',
    diseaseType: row.disease_type ?? 'custom',
    description: row.description ?? '',
    customerId: row.customer_id ?? null,
    customerNameSnapshot: row.customer_name_snapshot ?? null,
    templateId: row.template_id ?? null,
    templateNameSnapshot: row.template_name_snapshot ?? null,
    consultationDate,
    items: row.items_json ?? [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listCoverageTemplates(pool, owner) {
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM coverage_scenario_templates
    WHERE owner_user_id = $1 AND ga_id = $2
    ORDER BY updated_at DESC
    `,
    [owner.userId, owner.gaId],
  )
  return r.rows.map(mapTemplateRow)
}

/**
 * @param {import('pg').Pool} pool
 */
export async function getCoverageTemplateById(pool, owner, id) {
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM coverage_scenario_templates
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    LIMIT 1
    `,
    [id, owner.userId, owner.gaId],
  )
  return r.rows[0] ? mapTemplateRow(r.rows[0]) : null
}

/**
 * @param {import('pg').Pool} pool
 */
export async function createCoverageTemplate(pool, req, owner, body) {
  const validated = validateTemplatePayload(body)
  if (!validated.ok) {
    throw storageHttpError(400, validated.code, validated.message)
  }
  const v = validated.value
  if (v.legacyClientId) {
    const existing = await loadRowByLegacyClientId(
      pool,
      owner,
      v.legacyClientId,
      'coverage_scenario_templates',
    )
    if (existing) return mapTemplateRow(existing)
  }
  try {
    const r = await safeQuery(
      pool,
      `
      INSERT INTO coverage_scenario_templates (
        owner_user_id, ga_id, legacy_client_id, name, description, disease_type, items_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
      `,
      [
        owner.userId,
        owner.gaId,
        v.legacyClientId,
        v.name,
        v.description,
        v.diseaseType,
        JSON.stringify(v.items),
      ],
    )
    return mapTemplateRow(r.rows[0])
  } catch (error) {
    if (v.legacyClientId && isLegacyUniqueViolation(error)) {
      const existing = await loadRowByLegacyClientId(
        pool,
        owner,
        v.legacyClientId,
        'coverage_scenario_templates',
      )
      if (existing) return mapTemplateRow(existing)
    }
    throw error
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function updateCoverageTemplate(pool, req, owner, id, body) {
  const existing = await getCoverageTemplateById(pool, owner, id)
  if (!existing) {
    throw storageHttpError(404, 'COVERAGE_TEMPLATE_NOT_FOUND', '시나리오를 찾을 수 없습니다.')
  }
  const validated = validateTemplatePayload({
    name: body?.name ?? existing.name,
    description: body?.description ?? existing.description,
    diseaseType: body?.diseaseType ?? existing.diseaseType,
    items: body?.items ?? existing.items,
  })
  if (!validated.ok) {
    throw storageHttpError(400, validated.code, validated.message)
  }
  const v = validated.value
  const r = await safeQuery(
    pool,
    `
    UPDATE coverage_scenario_templates
    SET name = $4, description = $5, disease_type = $6, items_json = $7::jsonb, updated_at = NOW()
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    RETURNING *
    `,
    [id, owner.userId, owner.gaId, v.name, v.description, v.diseaseType, JSON.stringify(v.items)],
  )
  return mapTemplateRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 */
export async function deleteCoverageTemplate(pool, owner, id) {
  const r = await safeQuery(
    pool,
    `
    DELETE FROM coverage_scenario_templates
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    RETURNING id
    `,
    [id, owner.userId, owner.gaId],
  )
  if (!r.rows[0]) {
    throw storageHttpError(404, 'COVERAGE_TEMPLATE_NOT_FOUND', '시나리오를 찾을 수 없습니다.')
  }
  return { ok: true }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function duplicateCoverageTemplate(pool, owner, id) {
  const source = await getCoverageTemplateById(pool, owner, id)
  if (!source) {
    throw storageHttpError(404, 'COVERAGE_TEMPLATE_NOT_FOUND', '시나리오를 찾을 수 없습니다.')
  }
  const validated = validateTemplatePayload({
    name: `${source.name} 복사본`,
    description: source.description,
    diseaseType: source.diseaseType,
    items: source.items,
  })
  if (!validated.ok) {
    throw storageHttpError(400, validated.code, validated.message)
  }
  const v = validated.value
  const r = await safeQuery(
    pool,
    `
    INSERT INTO coverage_scenario_templates (
      owner_user_id, ga_id, name, description, disease_type, items_json
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING *
    `,
    [owner.userId, owner.gaId, v.name, v.description, v.diseaseType, JSON.stringify(v.items)],
  )
  return mapTemplateRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listCoverageSimulations(pool, owner, query = {}) {
  const conditions = [`owner_user_id = $1`, `ga_id = $2`]
  const params = [owner.userId, owner.gaId]
  let p = 3
  if (query.customerId) {
    conditions.push(`customer_id = $${p}`)
    params.push(String(query.customerId))
    p += 1
  }
  if (query.diseaseType) {
    conditions.push(`disease_type = $${p}`)
    params.push(String(query.diseaseType))
    p += 1
  }
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM coverage_simulations
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
    `,
    params,
  )
  return r.rows.map(mapSimulationRow)
}

/**
 * @param {import('pg').Pool} pool
 */
export async function getCoverageSimulationById(pool, owner, id) {
  const r = await safeQuery(
    pool,
    `
    SELECT *
    FROM coverage_simulations
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    LIMIT 1
    `,
    [id, owner.userId, owner.gaId],
  )
  return r.rows[0] ? mapSimulationRow(r.rows[0]) : null
}

/**
 * @param {import('pg').Pool} pool
 */
export async function createCoverageSimulation(pool, req, owner, body) {
  const validated = validateSimulationPayload(body)
  if (!validated.ok) {
    throw storageHttpError(400, validated.code, validated.message)
  }
  const v = validated.value
  await assertCustomerAccessible(pool, req, owner.gaId, v.customerId)
  if (v.legacyClientId) {
    const existing = await loadRowByLegacyClientId(pool, owner, v.legacyClientId, 'coverage_simulations')
    if (existing) return mapSimulationRow(existing)
  }
  try {
    const r = await safeQuery(
      pool,
      `
      INSERT INTO coverage_simulations (
        owner_user_id, ga_id, legacy_client_id, customer_id, title, disease_type, description,
        template_id, template_name_snapshot, customer_name_snapshot, consultation_date, items_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12::jsonb)
      RETURNING *
      `,
      [
        owner.userId,
        owner.gaId,
        v.legacyClientId,
        v.customerId,
        v.title,
        v.diseaseType,
        v.description ?? '',
        v.templateId,
        v.templateNameSnapshot,
        v.customerNameSnapshot,
        v.consultationDate,
        JSON.stringify(v.items),
      ],
    )
    return mapSimulationRow(r.rows[0])
  } catch (error) {
    if (v.legacyClientId && isLegacyUniqueViolation(error)) {
      const existing = await loadRowByLegacyClientId(pool, owner, v.legacyClientId, 'coverage_simulations')
      if (existing) return mapSimulationRow(existing)
    }
    throw error
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function updateCoverageSimulation(pool, req, owner, id, body) {
  const existing = await getCoverageSimulationById(pool, owner, id)
  if (!existing) {
    throw storageHttpError(404, 'COVERAGE_SIMULATION_NOT_FOUND', '저장된 시뮬레이션을 찾을 수 없습니다.')
  }
  const validated = validateSimulationPayload(
    {
      title: body?.title ?? existing.title,
      diseaseType: body?.diseaseType ?? existing.diseaseType,
      description: body?.description ?? existing.description,
      items: body?.items ?? existing.items,
      consultationDate: body?.consultationDate ?? existing.consultationDate,
      customerId: body?.customerId !== undefined ? body.customerId : existing.customerId,
      customerNameSnapshot:
        body?.customerNameSnapshot !== undefined
          ? body.customerNameSnapshot
          : existing.customerNameSnapshot,
      templateId: body?.templateId !== undefined ? body.templateId : existing.templateId,
      templateNameSnapshot:
        body?.templateNameSnapshot !== undefined
          ? body.templateNameSnapshot
          : existing.templateNameSnapshot,
      updatedAt: body?.updatedAt,
    },
    { partial: false },
  )
  if (!validated.ok) {
    throw storageHttpError(400, validated.code, validated.message)
  }
  const v = validated.value
  await assertCustomerAccessible(pool, req, owner.gaId, v.customerId)
  const r = await safeQuery(
    pool,
    `
    UPDATE coverage_simulations
    SET
      customer_id = $4,
      title = $5,
      disease_type = $6,
      description = $7,
      template_id = $8,
      template_name_snapshot = $9,
      customer_name_snapshot = $10,
      consultation_date = $11::date,
      items_json = $12::jsonb,
      updated_at = NOW()
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    RETURNING *
    `,
    [
      id,
      owner.userId,
      owner.gaId,
      v.customerId,
      v.title,
      v.diseaseType,
      v.description ?? '',
      v.templateId,
      v.templateNameSnapshot,
      v.customerNameSnapshot,
      v.consultationDate,
      JSON.stringify(v.items),
    ],
  )
  return mapSimulationRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 */
export async function deleteCoverageSimulation(pool, owner, id) {
  const r = await safeQuery(
    pool,
    `
    DELETE FROM coverage_simulations
    WHERE id = $1::bigint AND owner_user_id = $2 AND ga_id = $3
    RETURNING id
    `,
    [id, owner.userId, owner.gaId],
  )
  if (!r.rows[0]) {
    throw storageHttpError(404, 'COVERAGE_SIMULATION_NOT_FOUND', '저장된 시뮬레이션을 찾을 수 없습니다.')
  }
  return { ok: true }
}
