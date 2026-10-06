const VALID_TYPES = new Set([
  'DATA_FIELD_NOT_DEFINED',
  'TOOL_NOT_WIRED',
  'QUERY_OPERATOR_NOT_SUPPORTED',
  'PERMISSION_BLOCKED',
  'EXECUTION_FAILED',
])

const VALID_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'])

let schemaReady = null

function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeKeyPart(value) {
  return cleanText(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown'
}

export function buildImprovementCanonicalKey(input = {}) {
  const type = VALID_TYPES.has(input.issueType) ? input.issueType : 'EXECUTION_FAILED'
  const domain = normalizeKeyPart(input.domain ?? 'unknown')
  const subject = normalizeKeyPart(
    input.fieldKey ??
    input.toolKey ??
    input.requestedAction ??
    input.errorCode ??
    'unknown',
  )
  return `${type}:${domain}:${subject}`
}

export async function ensureAiImprovementSchema(pool) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_assistant_improvement_items (
          id BIGSERIAL PRIMARY KEY,
          canonical_key TEXT NOT NULL UNIQUE,
          issue_type TEXT NOT NULL,
          domain TEXT NOT NULL DEFAULT '',
          field_key TEXT,
          tool_key TEXT,
          requested_action TEXT,
          sample_request_text TEXT NOT NULL DEFAULT '',
          last_request_text TEXT NOT NULL DEFAULT '',
          occurrence_count INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'NEW',
          last_error_code TEXT,
          last_error_message TEXT,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT ai_assistant_improvement_items_type_chk
            CHECK (issue_type IN (
              'DATA_FIELD_NOT_DEFINED',
              'TOOL_NOT_WIRED',
              'QUERY_OPERATOR_NOT_SUPPORTED',
              'PERMISSION_BLOCKED',
              'EXECUTION_FAILED'
            )),
          CONSTRAINT ai_assistant_improvement_items_status_chk
            CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'))
        )
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ai_improvement_status_seen
        ON ai_assistant_improvement_items(status, last_seen_at DESC)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ai_improvement_type_count
        ON ai_assistant_improvement_items(issue_type, occurrence_count DESC)
      `)
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

export async function recordAiImprovement(pool, input = {}) {
  const issueType = VALID_TYPES.has(input.issueType) ? input.issueType : 'EXECUTION_FAILED'
  const canonicalKey = buildImprovementCanonicalKey({ ...input, issueType })
  await ensureAiImprovementSchema(pool)

  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata
      : {}

  const result = await pool.query(
    `
      INSERT INTO ai_assistant_improvement_items (
        canonical_key, issue_type, domain, field_key, tool_key, requested_action,
        sample_request_text, last_request_text, last_error_code, last_error_message, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,CAST($10 AS jsonb))
      ON CONFLICT (canonical_key)
      DO UPDATE SET
        occurrence_count = ai_assistant_improvement_items.occurrence_count + 1,
        last_request_text = EXCLUDED.last_request_text,
        last_error_code = EXCLUDED.last_error_code,
        last_error_message = EXCLUDED.last_error_message,
        metadata = ai_assistant_improvement_items.metadata || EXCLUDED.metadata,
        last_seen_at = NOW(),
        updated_at = NOW(),
        status = CASE
          WHEN ai_assistant_improvement_items.status = 'RESOLVED' THEN 'NEW'
          ELSE ai_assistant_improvement_items.status
        END,
        resolved_at = CASE
          WHEN ai_assistant_improvement_items.status = 'RESOLVED' THEN NULL
          ELSE ai_assistant_improvement_items.resolved_at
        END
      RETURNING *
    `,
    [
      canonicalKey,
      issueType,
      cleanText(input.domain, 120),
      cleanText(input.fieldKey, 200) || null,
      cleanText(input.toolKey, 200) || null,
      cleanText(input.requestedAction, 300) || null,
      cleanText(input.requestText, 1000),
      cleanText(input.errorCode, 200) || null,
      cleanText(input.errorMessage, 1000) || null,
      JSON.stringify(metadata),
    ],
  )
  return mapImprovementRow(result.rows[0])
}

export async function listAiImprovements(pool, options = {}) {
  await ensureAiImprovementSchema(pool)
  const status = cleanText(options.status, 40).toUpperCase()
  const issueType = cleanText(options.issueType, 80).toUpperCase()
  const params = []
  const where = []
  if (status && VALID_STATUSES.has(status)) {
    params.push(status)
    where.push(`status = $${params.length}`)
  }
  if (issueType && VALID_TYPES.has(issueType)) {
    params.push(issueType)
    where.push(`issue_type = $${params.length}`)
  }
  const result = await pool.query(
    `
      SELECT *
      FROM ai_assistant_improvement_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY
        CASE status WHEN 'NEW' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'RESOLVED' THEN 2 ELSE 3 END,
        occurrence_count DESC,
        last_seen_at DESC
      LIMIT 500
    `,
    params,
  )
  return result.rows.map(mapImprovementRow)
}

export async function updateAiImprovementStatus(pool, id, statusRaw) {
  await ensureAiImprovementSchema(pool)
  const status = cleanText(statusRaw, 40).toUpperCase()
  if (!VALID_STATUSES.has(status)) {
    const error = new Error('INVALID_AI_IMPROVEMENT_STATUS')
    error.status = 400
    throw error
  }
  const result = await pool.query(
    `
      UPDATE ai_assistant_improvement_items
      SET status = $2,
          resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [Number(id), status],
  )
  if (!result.rows[0]) {
    const error = new Error('AI_IMPROVEMENT_NOT_FOUND')
    error.status = 404
    throw error
  }
  return mapImprovementRow(result.rows[0])
}

function mapImprovementRow(row) {
  return {
    id: Number(row.id),
    canonicalKey: String(row.canonical_key ?? ''),
    issueType: String(row.issue_type ?? ''),
    domain: String(row.domain ?? ''),
    fieldKey: row.field_key ?? null,
    toolKey: row.tool_key ?? null,
    requestedAction: row.requested_action ?? null,
    sampleRequestText: String(row.sample_request_text ?? ''),
    lastRequestText: String(row.last_request_text ?? ''),
    occurrenceCount: Number(row.occurrence_count ?? 0),
    status: String(row.status ?? 'NEW'),
    lastErrorCode: row.last_error_code ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    metadata: row.metadata ?? {},
    firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at ?? ''),
    lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : String(row.last_seen_at ?? ''),
    resolvedAt: row.resolved_at instanceof Date ? row.resolved_at.toISOString() : row.resolved_at ?? null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}
