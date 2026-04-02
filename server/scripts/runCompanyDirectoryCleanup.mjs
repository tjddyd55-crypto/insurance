/**
 * 1회성 데이터 정리 (메리츠 / 심플손해보험)
 *
 * - 생명(LIFE) 메리츠화재 마스터 및 종속 연락처(CASCADE) 삭제
 * - 손해(NON_LIFE) 메리츠 + 메리츠화재 동시 존재 시: 화재 행 연락처를 메리츠로 옮기고 화재 마스터 삭제 후 메리츠 이름을 메리츠화재로 변경
 * - 손해 메리츠만 있으면 이름만 메리츠화재로 변경
 * - 손해 심플손해보험 마스터 삭제 + 재보험 연락처 목록에서 동일 보험사명 행 삭제
 * - 재보험(insurance_contacts): LIFE·메리츠화재 행 삭제, NON_LIFE·메리츠 → 보험사명 메리츠화재로 통일
 * - 생명(LIFE)·이름이 DB생명(공백 무시)으로 중복된 마스터: 담당 이덕용+지점장 행이 있는 마스터만 남기고 나머지는 연락처 이전 후 삭제
 *
 * node server/scripts/runCompanyDirectoryCleanup.mjs [--dry-run]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

function loadEnvFileIfPresent(root, filename = '.env') {
  const p = path.join(root, filename)
  if (!fs.existsSync(p)) {
    return
  }
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) {
      continue
    }
    const i = t.indexOf('=')
    if (i === -1) {
      continue
    }
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

function ensureDatabaseUrl() {
  const isUsable = (v) => {
    const s = String(v ?? '').trim()
    if (!s || s.includes('user:password@host')) {
      return ''
    }
    return s
  }
  let url = isUsable(process.env.DATABASE_PUBLIC_URL)
  if (!url) url = isUsable(process.env.PUBLIC_DATABASE_URL)
  if (!url) url = isUsable(process.env.DATABASE_URL)
  if (!url) url = isUsable(process.env.POSTGRES_URL)
  if (!url) url = isUsable(process.env.POSTGRES_PRISMA_URL)
  if (!url) url = isUsable(process.env.DATABASE_PRIVATE_URL)
  if (url) {
    process.env.DATABASE_URL = url
  } else if (
    !String(process.env.DATABASE_URL ?? '').trim() ||
    String(process.env.DATABASE_URL).includes('user:password@host')
  ) {
    delete process.env.DATABASE_URL
  }
}

function exitIfRailwayInternalFromLocalMachine(url) {
  if (!url || !/\.railway\.internal\b/i.test(String(url))) {
    return
  }
  if (process.env.RAILWAY_ENVIRONMENT) {
    return
  }
  console.error('[cleanup] 로컬에서는 Public Network DATABASE URL이 필요합니다.')
  process.exit(1)
}

loadEnvFileIfPresent(projectRoot, '.env')
loadEnvFileIfPresent(projectRoot, '.env.local')
ensureDatabaseUrl()

async function touchContactLastUpdatedAt(client) {
  await client.query(`
    INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
    VALUES ('contact_last_updated_at', NOW()::text, NOW())
    ON CONFLICT (meta_key)
    DO UPDATE SET meta_value = NOW()::text, updated_at = NOW()
  `)
}

/** LIFE·DB생명(공백 무시) 마스터 중복 — 이덕용+지점장 연락처가 있는 쪽만 유지 */
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
          regexp_replace(trim(COALESCE(ic.manager_name, '')), '\\s+', '', 'g') = '이덕용'
          AND COALESCE(ic.position_or_title, '') ILIKE '%지점장%'
        )
        OR (
          ic.manager_name ILIKE '%이덕용%'
          AND (
            ic.manager_name ILIKE '%지점장%'
            OR COALESCE(ic.position_or_title, '') ILIKE '%지점장%'
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

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  ensureDatabaseUrl()
  const dbUrl = String(process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl) {
    console.error('[cleanup] DATABASE_URL 이 없습니다.')
    process.exit(1)
  }
  exitIfRailwayInternalFromLocalMachine(dbUrl)

  const { default: pool } = await import('../db.js')
  const client = await pool.connect()

  const log = (msg, ...args) => console.log('[cleanup]', msg, ...args)

  try {
    if (dryRun) {
      const peek = async (label, sql, params = []) => {
        const r = await client.query(sql, params)
        log(`${label}:`, r.rowCount, '행')
      }
      await peek(
        '대상 LIFE·메리츠화재 마스터',
        `SELECT id FROM insurance_company_master WHERE category='LIFE' AND TRIM(name) IN ('메리츠화재','메리츠 화재')`,
      )
      await peek(
        '대상 NON_LIFE·메리츠 / 메리츠화재',
        `SELECT id, name FROM insurance_company_master WHERE category='NON_LIFE' AND TRIM(name) IN ('메리츠','메리츠화재','메리츠 화재')`,
      )
      await peek(
        '대상 심플손해보험 마스터',
        `SELECT id FROM insurance_company_master WHERE category='NON_LIFE' AND TRIM(name)='심플손해보험'`,
      )
      await peek(
        'LIFE·DB생명 마스터(공백 무시)',
        `SELECT id, name FROM insurance_company_master m
         WHERE m.category='LIFE'
           AND lower(regexp_replace(trim(m.name), '\\s+', '', 'g')) = 'db생명'`,
      )
      log('dry-run — 위만 조회, DB 변경 없음 (적용: 같은 명령에서 --dry-run 제거)')
      return
    }

    await client.query('BEGIN')

    const delLifeMeritz = await client.query(`
      DELETE FROM insurance_company_master
      WHERE category = 'LIFE'
        AND TRIM(name) IN ('메리츠화재', '메리츠 화재')
      RETURNING id, name
    `)
    if (delLifeMeritz.rowCount > 0) {
      log('생명 메리츠화재 마스터 삭제:', delLifeMeritz.rowCount, delLifeMeritz.rows)
    }

    const rMeritz = await client.query(`
      SELECT id FROM insurance_company_master
      WHERE category = 'NON_LIFE' AND TRIM(name) = '메리츠'
      LIMIT 1
    `)
    const rHw = await client.query(`
      SELECT id FROM insurance_company_master
      WHERE category = 'NON_LIFE' AND TRIM(name) IN ('메리츠화재', '메리츠 화재')
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
      DELETE FROM insurance_company_master
      WHERE category = 'NON_LIFE' AND TRIM(name) = '심플손해보험'
      RETURNING id
    `)
    if (delSimple.rowCount > 0) {
      log('심플손해보험 마스터 삭제:', delSimple.rowCount)
    }

    const delSimpleIc = await client.query(`
      DELETE FROM insurance_contacts
      WHERE TRIM(company_name) = '심플손해보험'
      RETURNING id
    `)
    if (delSimpleIc.rowCount > 0) {
      log('재보험 목록 심플손해보험 행 삭제:', delSimpleIc.rowCount)
    }

    const delLifeIc = await client.query(`
      DELETE FROM insurance_contacts
      WHERE category = 'LIFE'
        AND TRIM(company_name) IN ('메리츠화재', '메리츠 화재')
      RETURNING id
    `)
    if (delLifeIc.rowCount > 0) {
      log('재보험 목록 생명·메리츠화재 삭제:', delLifeIc.rowCount)
    }

    const upIc = await client.query(`
      UPDATE insurance_contacts
      SET company_name = '메리츠화재', updated_at = NOW()
      WHERE category = 'NON_LIFE' AND TRIM(company_name) = '메리츠'
    `)
    if (upIc.rowCount > 0) {
      log('재보험 목록 손해·메리츠 → 메리츠화재 명칭 통일:', upIc.rowCount)
    }

    await mergeDuplicateDbLifeMasters(client, log)

    await touchContactLastUpdatedAt(client)

    await client.query('COMMIT')
    log('완료')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[cleanup] 오류:', e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
