import { deleteClaimRequestStoredFiles } from '../insurance-claim/deleteClaimRequestStoredFiles.js'
import {
  collectContractFileIdsFromRows,
  collectContractSendSessionStorageKeys,
  parseContractFileId,
} from './collectContractSendSessionStorageKeys.js'

/**
 * @param {import('pg').PoolClient} client
 * @param {string} sessionId
 */
async function loadSendSessionDeleteContext(client, sessionId) {
  /** @type {Set<string>} */
  const fileIds = new Set()

  const pushId = (value) => {
    const parsed = parseContractFileId(value)
    if (parsed) {
      fileIds.add(parsed)
    }
  }

  const attachments = await client.query(
    `SELECT file_id FROM contract_send_session_attachments WHERE send_session_id = $1`,
    [sessionId],
  )
  for (const row of attachments.rows) {
    pushId(row.file_id)
  }

  const documents = await client.query(
    `
    SELECT filled_pdf_file_id, signed_pdf_file_id
    FROM contract_document_instances
    WHERE send_session_id = $1
    `,
    [sessionId],
  )
  for (const row of documents.rows) {
    pushId(row.filled_pdf_file_id)
    pushId(row.signed_pdf_file_id)
  }

  const values = await client.query(
    `
    SELECT dv.value_file_id
    FROM contract_document_values dv
    INNER JOIN contract_document_instances di ON di.id = dv.document_instance_id
    WHERE di.send_session_id = $1
      AND dv.value_file_id IS NOT NULL
      AND TRIM(dv.value_file_id::text) <> ''
    `,
    [sessionId],
  )
  for (const row of values.rows) {
    pushId(row.value_file_id)
  }

  const evidences = await client.query(
    `
    SELECT signature_file_id, signed_pdf_file_id
    FROM signature_evidences
    WHERE send_session_id = $1
    `,
    [sessionId],
  )
  for (const row of evidences.rows) {
    pushId(row.signature_file_id)
    pushId(row.signed_pdf_file_id)
  }

  const ids = [...fileIds]
  /** @type {string[]} */
  let filePaths = []
  if (ids.length > 0) {
    const files = await client.query(
      `SELECT id, file_path FROM files WHERE id = ANY($1::bigint[])`,
      [ids],
    )
    filePaths = files.rows.map((row) => String(row.file_path ?? ''))
  }

  return {
    fileIds: ids,
    storageKeys: collectContractSendSessionStorageKeys(sessionId, filePaths),
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} sessionId
 * @param {{ userId: string | null, gaId: number | null, isSuperAdmin: boolean }} auth
 */
async function assertSendSessionDeleteAccess(client, sessionId, auth) {
  const r = await client.query(
    `
    SELECT s.id, s.sent_by_user_id, c.user_id, c.ga_id
    FROM contract_send_sessions s
    INNER JOIN customers c ON c.id = s.customer_id
    WHERE s.id = $1
    FOR UPDATE OF s
    LIMIT 1
    `,
    [sessionId],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '발송 세션을 찾을 수 없습니다.' }
  }
  const row = r.rows[0]
  if (auth.isSuperAdmin) {
    return { ok: true, row }
  }
  if (!auth.userId) {
    return { ok: false, status: 401, message: '로그인이 필요합니다.' }
  }
  if (auth.gaId == null) {
    return { ok: false, status: 400, message: 'GA 컨텍스트가 없습니다.' }
  }
  if (String(row.sent_by_user_id ?? '') !== auth.userId) {
    return { ok: false, status: 403, message: '삭제 권한이 없습니다.' }
  }
  if (String(row.user_id ?? '') !== auth.userId) {
    return { ok: false, status: 403, message: '삭제 권한이 없습니다.' }
  }
  if (Number(row.ga_id) !== auth.gaId) {
    return { ok: false, status: 403, message: '삭제 권한이 없습니다.' }
  }
  return { ok: true, row }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} sessionIdRaw
 * @param {{ userId: string | null, gaId: number | null, isSuperAdmin: boolean }} auth
 */
export async function deleteContractSendSession(pool, sessionIdRaw, auth) {
  const sessionId = String(sessionIdRaw ?? '').trim()
  if (!sessionId) {
    return { ok: false, status: 400, message: '발송 세션 id가 필요합니다.' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const access = await assertSendSessionDeleteAccess(client, sessionId, auth)
    if (!access.ok) {
      await client.query('ROLLBACK')
      return access
    }

    const { fileIds, storageKeys } = await loadSendSessionDeleteContext(client, sessionId)

    const identityRow = await client.query(
      `SELECT identity_session_id FROM contract_send_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    )
    const identitySessionId = String(identityRow.rows[0]?.identity_session_id ?? '').trim()

    await client.query(`DELETE FROM identity_verification_sessions WHERE send_session_id = $1`, [sessionId])
    if (identitySessionId) {
      await client.query(`DELETE FROM identity_verification_sessions WHERE id = $1`, [identitySessionId])
    }

    const deleted = await client.query(`DELETE FROM contract_send_sessions WHERE id = $1 RETURNING id`, [sessionId])
    if (deleted.rowCount === 0) {
      await client.query('ROLLBACK')
      return { ok: false, status: 404, message: '발송 세션을 찾을 수 없습니다.' }
    }

    if (fileIds.length > 0) {
      await client.query(`DELETE FROM files WHERE id = ANY($1::bigint[])`, [fileIds])
    }

    await client.query('COMMIT')

    await deleteClaimRequestStoredFiles(storageKeys)

    return {
      ok: true,
      status: 200,
      data: { deleted: true, id: sessionId },
      message: '전자서명 발송내역이 삭제되었습니다.',
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    throw error
  } finally {
    client.release()
  }
}

export { collectContractFileIdsFromRows, loadSendSessionDeleteContext, assertSendSessionDeleteAccess }
