/**
 * 보험사 마스터·연락처 디렉터리 정리 (멱등).
 *
 * insurance_company_contacts 실제 컬럼: name, position, phone
 *
 * - 생명(LIFE)·메리츠화재(공백 무시) 마스터 삭제
 * - 손해(NON_LIFE)·메리츠 + 메리츠화재 동시 존재: 메리츠 id에 연락처 합친 뒤 화재 마스터 삭제, 메리츠 이름을 메리츠화재로
 * - 손해·메리츠만 있으면 이름을 메리츠화재로
 * - 손해·심플손해보험 삭제 + 재보험(insurance_contacts) 정리
 * - 재보험: LIFE·메리츠화재 명칭 삭제, 손해·메리츠 → 메리츠화재
 * - LIFE·DB생명(공백 무시) 중복: 이덕용+지점장 연락처(name/position) 기준 마스터만 유지
 */

/** @param {import('pg').PoolClient} client */
export async function touchContactLastUpdatedAt(client) {
  await client.query(`
    INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
    VALUES ('contact_last_updated_at', NOW()::text, NOW())
    ON CONFLICT (meta_key)
    DO UPDATE SET meta_value = NOW()::text, updated_at = NOW()
  `)
}

/** 공백 제거한 보험사명 (마스터 테이블 alias m) */
const NORM_M = `regexp_replace(trim(COALESCE(m.name, '')), '\\s+', '', 'g')`

/** insurance_contacts.company_name 정규화 */
const NORM_IC = `regexp_replace(trim(COALESCE(company_name, '')), '\\s+', '', 'g')`

/**
 * @param {import('pg').PoolClient} client
 * @param {(msg: string, ...args: unknown[]) => void} log
 */
export async function runCompanyDirectorySanitize(client, log) {
  const delLifeMeritz = await client.query(`
    DELETE FROM insurance_company_master m
    WHERE m.category = 'LIFE'
      AND ${NORM_M} = '메리츠화재'
    RETURNING m.id, m.name
  `)
  if (delLifeMeritz.rowCount > 0) {
    log('생명 메리츠화재 마스터 삭제:', delLifeMeritz.rowCount, delLifeMeritz.rows)
  }

  const rMeritz = await client.query(`
    SELECT m.id FROM insurance_company_master m
    WHERE m.category = 'NON_LIFE' AND ${NORM_M} = '메리츠'
    ORDER BY m.id ASC
    LIMIT 1
  `)
  const rHw = await client.query(`
    SELECT m.id FROM insurance_company_master m
    WHERE m.category = 'NON_LIFE' AND ${NORM_M} = '메리츠화재'
    ORDER BY m.id ASC
    LIMIT 1
  `)

  if (rMeritz.rowCount > 0 && rHw.rowCount > 0) {
    const keepId = rMeritz.rows[0].id
    const dropId = rHw.rows[0].id
    const mv = await client.query(
      `UPDATE insurance_company_contacts SET company_id = $1 WHERE company_id = $2`,
      [keepId, dropId],
    )
    log('손해 메리츠화재 → 메리츠로 연락처 이전:', mv.rowCount, '행')
    await client.query(`DELETE FROM insurance_general_request WHERE company_id = $1`, [dropId])
    await client.query(`DELETE FROM insurance_company_master WHERE id = $1`, [dropId])
    log('손해 기존 메리츠화재 마스터 삭제 id=', dropId)
    await client.query(
      `UPDATE insurance_company_master SET name = '메리츠화재', updated_at = NOW() WHERE id = $1`,
      [keepId],
    )
    log('손해 메리츠 → 이름 메리츠화재로 변경 id=', keepId)
  } else if (rMeritz.rowCount > 0) {
    const keepId = rMeritz.rows[0].id
    await client.query(
      `UPDATE insurance_company_master SET name = '메리츠화재', updated_at = NOW() WHERE id = $1`,
      [keepId],
    )
    log('손해 메리츠만 존재 → 이름 메리츠화재로 변경 id=', keepId)
  }

  const delSimple = await client.query(`
    DELETE FROM insurance_company_master m
    WHERE m.category = 'NON_LIFE' AND ${NORM_M} = '심플손해보험'
    RETURNING m.id
  `)
  if (delSimple.rowCount > 0) {
    log('심플손해보험 마스터 삭제:', delSimple.rowCount)
  }

  const delSimpleIc = await client.query(`
    DELETE FROM insurance_contacts
    WHERE ${NORM_IC} = '심플손해보험'
    RETURNING id
  `)
  if (delSimpleIc.rowCount > 0) {
    log('재보험 목록 심플손해보험 행 삭제:', delSimpleIc.rowCount)
  }

  const delLifeIc = await client.query(`
    DELETE FROM insurance_contacts
    WHERE category = 'LIFE'
      AND ${NORM_IC} = '메리츠화재'
    RETURNING id
  `)
  if (delLifeIc.rowCount > 0) {
    log('재보험 목록 생명·메리츠화재 삭제:', delLifeIc.rowCount)
  }

  const upIc = await client.query(`
    UPDATE insurance_contacts
    SET company_name = '메리츠화재', updated_at = NOW()
    WHERE category = 'NON_LIFE' AND ${NORM_IC} = '메리츠'
  `)
  if (upIc.rowCount > 0) {
    log('재보험 목록 손해·메리츠 → 메리츠화재 명칭 통일:', upIc.rowCount)
  }

  await mergeDuplicateDbLifeMasters(client, log)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {(msg: string, ...args: unknown[]) => void} log
 */
async function mergeDuplicateDbLifeMasters(client, log) {
  const masters = await client.query(`
    SELECT id, name
    FROM insurance_company_master m
    WHERE m.category = 'LIFE'
      AND lower(regexp_replace(trim(m.name), '\\s+', '', 'g')) = 'db생명'
    ORDER BY m.id
  `)
  if (masters.rowCount < 2) {
    return
  }

  const keeper = await client.query(`
    SELECT ic.company_id
    FROM insurance_company_contacts ic
    JOIN insurance_company_master m ON m.id = ic.company_id
    WHERE m.category = 'LIFE'
      AND lower(regexp_replace(trim(m.name), '\\s+', '', 'g')) = 'db생명'
      AND (
        (
          regexp_replace(trim(COALESCE(ic.name, '')), '\\s+', '', 'g') = '이덕용'
          AND COALESCE(ic.position, '') ILIKE '%지점장%'
        )
        OR (
          ic.name ILIKE '%이덕용%'
          AND (
            ic.name ILIKE '%지점장%'
            OR COALESCE(ic.position, '') ILIKE '%지점장%'
          )
        )
      )
    ORDER BY ic.company_id
    LIMIT 1
  `)
  if (keeper.rowCount === 0) {
    log(
      'DB생명 중복 마스터가 있으나 이덕용+지점장 기준 유지 행을 찾지 못해 건너뜀 (수동 확인)',
      masters.rows,
    )
    return
  }

  const keepId = keeper.rows[0].company_id
  const dropIds = masters.rows.map((r) => r.id).filter((id) => id !== keepId)
  if (dropIds.length === 0) {
    return
  }

  for (const dropId of dropIds) {
    const mv = await client.query(
      `UPDATE insurance_company_contacts SET company_id = $1 WHERE company_id = $2`,
      [keepId, dropId],
    )
    log('DB생명 중복: 마스터', dropId, '→', keepId, '로 연락처 이전', mv.rowCount, '행')
    await client.query(`DELETE FROM insurance_general_request WHERE company_id = $1`, [dropId])
    await client.query(`DELETE FROM insurance_company_master WHERE id = $1`, [dropId])
    log('DB생명 중복: 마스터 삭제 id=', dropId)
  }
}
