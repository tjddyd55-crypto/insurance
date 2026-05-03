import { randomUUID } from 'node:crypto'

const ID_PREFIX = 'csscfv_'

/**
 * @param {import('pg').PoolClient} client
 * @param {string} sendSessionId
 * @param {string} templateId
 * @param {{ fieldKey: string, valueText: string }[]} rowsOrdered sort_order 기준으로 정렬된 행
 */
export async function insertSendSessionConfirmationFieldValues(client, sendSessionId, templateId, rowsOrdered) {
  for (const row of rowsOrdered) {
    const id = `${ID_PREFIX}${randomUUID()}`
    await client.query(
      `
      INSERT INTO contract_send_session_confirmation_field_values (
        id, send_session_id, template_id, field_key, value_text, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `,
      [id, sendSessionId, templateId, row.fieldKey, row.valueText],
    )
  }
}
