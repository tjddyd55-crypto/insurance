import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  findGaCompanyByNormalizedCode,
  normalizeGaCompanyCode,
} from './generalGa.js'
import {
  insertGaCompanyRecord,
  proposeUniqueGaCodeForBranchName,
} from './createGaCompanyService.js'
import { parseGaId } from './parseGaId.js'

function cellToString(v) {
  if (v == null) {
    return ''
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10)
  }
  return String(v).trim()
}

/**
 * @param {Record<string, unknown>} row
 */
function pickBranchName(row) {
  const keys = Object.keys(row)
  for (const k of keys) {
    const nk = k.replace(/\s/g, '')
    if (nk.includes('지점명') || nk.toLowerCase() === 'name' || nk === '지점') {
      return cellToString(row[k])
    }
  }
  const firstKey = keys[0]
  return firstKey ? cellToString(row[firstKey]) : ''
}

/**
 * @param {Record<string, unknown>} row
 */
function pickGaCode(row) {
  const keys = Object.keys(row)
  for (const k of keys) {
    const nk = k.replace(/\s/g, '')
    if (nk.includes('GA코드') || nk.includes('GA코드') || nk.toLowerCase().includes('ga')) {
      return normalizeGaCompanyCode(row[k])
    }
  }
  for (const k of keys) {
    if (k.replace(/\s/g, '').includes('코드')) {
      return normalizeGaCompanyCode(row[k])
    }
  }
  return ''
}

/**
 * @param {Buffer} fileBuffer
 */
export function parseGaGroupExcelRows(fileBuffer) {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return []
  }
  const sheet = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return json.map((row, index) => ({
    rowNumber: index + 2,
    branchName: pickBranchName(row),
    gaCode: pickGaCode(row),
  }))
}

export function hashExcelBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ groupId: number; rows: ReturnType<typeof parseGaGroupExcelRows> }} p
 */
export async function previewGaGroupExcelImport(pool, p) {
  const results = []
  const nameSeen = new Map()

  for (const row of p.rows) {
    const branchName = String(row.branchName ?? '').trim()
    const gaCode = String(row.gaCode ?? '').trim()

    if (!branchName) {
      results.push({
        ...row,
        status: 'error',
        message: '지점명이 비어 있습니다.',
      })
      continue
    }

    const nameKey = branchName.toLowerCase()
    if (nameSeen.has(nameKey)) {
      results.push({
        ...row,
        status: 'duplicate_name',
        message: '동일 파일 내 동일 지점명',
      })
      continue
    }
    nameSeen.set(nameKey, true)

    const similar = await systemQuery(
      pool,
      `
      SELECT id, name, code
      FROM ga_companies
      WHERE is_deleted = false AND LOWER(TRIM(name)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [branchName],
    )
    const similarRow = similar.rows[0]

    if (gaCode) {
      const existing = await findGaCompanyByNormalizedCode(pool, gaCode)
      if (!existing) {
        results.push({
          ...row,
          status: 'error',
          message: '존재하지 않는 GA 코드입니다.',
        })
        continue
      }
      const membership = await systemQuery(
        pool,
        `SELECT group_id FROM ga_group_members WHERE ga_id = $1`,
        [existing.id],
      )
      const otherGroupId = membership.rows[0]?.group_id
      if (otherGroupId != null && Number(otherGroupId) !== p.groupId) {
        const g = await systemQuery(pool, `SELECT name, slug FROM ga_groups WHERE id = $1`, [otherGroupId])
        const gRow = g.rows[0]
        results.push({
          ...row,
          status: 'needs_move_confirm',
          gaId: existing.id,
          gaName: existing.name,
          gaCode: existing.code,
          currentGroupName: gRow?.name ?? '',
          currentGroupSlug: gRow?.slug ?? '',
          message: '다른 그룹에 연결된 GA',
        })
        continue
      }
      if (otherGroupId != null && Number(otherGroupId) === p.groupId) {
        results.push({
          ...row,
          status: 'already_linked',
          gaId: existing.id,
          gaName: existing.name,
          gaCode: existing.code,
          message: '이미 이 그룹에 연결됨',
        })
        continue
      }
      results.push({
        ...row,
        status: 'link_existing',
        gaId: existing.id,
        gaName: existing.name,
        gaCode: existing.code,
        message: similarRow ? '기존 GA 연결 (지점명 일치)' : '기존 GA 연결',
        needsNameConfirm: Boolean(similarRow && String(similarRow.name).trim() !== branchName),
      })
      continue
    }

    if (similarRow) {
      const membership = await systemQuery(
        pool,
        `SELECT group_id FROM ga_group_members WHERE ga_id = $1`,
        [similarRow.id],
      )
      const otherGroupId = membership.rows[0]?.group_id
      if (otherGroupId != null && Number(otherGroupId) !== p.groupId) {
        const g = await systemQuery(pool, `SELECT name, slug FROM ga_groups WHERE id = $1`, [otherGroupId])
        const gRow = g.rows[0]
        results.push({
          ...row,
          status: 'needs_move_confirm',
          gaId: Number(similarRow.id),
          gaName: similarRow.name,
          gaCode: similarRow.code,
          currentGroupName: gRow?.name ?? '',
          currentGroupSlug: gRow?.slug ?? '',
          message: '동일 지점명 GA가 다른 그룹에 있음',
        })
        continue
      }
      if (otherGroupId != null && Number(otherGroupId) === p.groupId) {
        results.push({
          ...row,
          status: 'already_linked',
          gaId: Number(similarRow.id),
          gaName: similarRow.name,
          gaCode: similarRow.code,
          message: '이미 이 그룹에 연결됨',
        })
        continue
      }
      results.push({
        ...row,
        status: 'link_existing',
        gaId: Number(similarRow.id),
        gaName: similarRow.name,
        gaCode: similarRow.code,
        message: '동일 지점명으로 기존 GA 연결 제안',
        needsNameConfirm: true,
      })
      continue
    }

    const proposedCode = await proposeUniqueGaCodeForBranchName(pool, branchName)
    results.push({
      ...row,
      status: 'create_new',
      proposedCode,
      message: '신규 GA 생성 예정',
    })
  }

  return results
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ groupId: number; previewRows: Array<Record<string, unknown>>; allowMoveFromOtherGroup?: boolean; confirmSimilarNames?: boolean }} p
 */
export async function commitGaGroupExcelImport(pool, p) {
  const summary = {
    created: 0,
    linked: 0,
    skipped: 0,
    errors: 0,
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const row of p.previewRows) {
      const status = String(row.status ?? '')
      if (status === 'error' || status === 'duplicate_name') {
        summary.errors += 1
        continue
      }
      if (status === 'already_linked') {
        summary.skipped += 1
        continue
      }
      if (status === 'needs_move_confirm') {
        if (!p.allowMoveFromOtherGroup) {
          summary.errors += 1
          continue
        }
      }
      if (row.needsNameConfirm && !p.confirmSimilarNames) {
        summary.errors += 1
        continue
      }

      let gaId = parseGaId(row.gaId)
      if (status === 'create_new') {
        const code = String(row.proposedCode ?? '').trim()
        const created = await insertGaCompanyRecord(client, {
          name: String(row.branchName ?? '').trim(),
          code,
        })
        gaId = parseGaId(created.id)
        summary.created += 1
      } else if (status === 'link_existing' || status === 'needs_move_confirm') {
        if (gaId == null) {
          summary.errors += 1
          continue
        }
        summary.linked += 1
      } else {
        summary.errors += 1
        continue
      }

      if (gaId == null) {
        summary.errors += 1
        continue
      }

      await client.query(`DELETE FROM ga_group_members WHERE ga_id = $1`, [gaId])
      await client.query(
        `
        INSERT INTO ga_group_members (ga_id, group_id)
        VALUES ($1, $2)
        ON CONFLICT (ga_id) DO UPDATE SET group_id = EXCLUDED.group_id
        `,
        [gaId, p.groupId],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return summary
}
