/**
 * 구분·보험사명·인콜·전산문의·담당자·연락처 표 엑셀 → DB 반영
 *
 * node server/scripts/runCleanedExcelImport.mjs [엑셀경로] [--dry-run] [--sheet=시트명]
 *
 * 환경: 프로젝트 루트 .env 의 DATABASE_URL (또는 이미 설정된 환경변수)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { cleanPhone } from '../lib/partnerExcelParse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

function loadEnvFileIfPresent(root) {
  const p = path.join(root, '.env')
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

loadEnvFileIfPresent(projectRoot)

/** @param {unknown} value */
function normalizeInsuranceCompanyCategory(value) {
  const s = String(value ?? '').trim()
  if (!s) {
    return ''
  }
  const u = s.toUpperCase().replace(/-/g, '_')
  if (u === 'NONLIFE') {
    return 'NON_LIFE'
  }
  if (u === 'LIFE' || u === 'NON_LIFE' || u === 'GENERAL') {
    return u
  }
  const lower = s.toLowerCase()
  if (lower === 'life') {
    return 'LIFE'
  }
  if (lower === 'nonlife') {
    return 'NON_LIFE'
  }
  const ko = s.replace(/\s+/g, '')
  if (/^(생명|생명보험|생보)$/.test(ko) || ko === '생명보험') {
    return 'LIFE'
  }
  if (
    /^(손해|손해보험|손보|재산|화재)$/.test(ko) ||
    ko === '손해보험' ||
    ko === '손해보험사'
  ) {
    return 'NON_LIFE'
  }
  if (/^(일반|일반보험)$/.test(ko) || ko === '일반보험') {
    return 'GENERAL'
  }
  return ''
}

/**
 * ~ 범위·콤마 뒤 내선 등: 앞쪽 구간만 잘라 전화 정규화. 휴대폰 외 유선·대표번호도 숫자만 저장.
 * 숫자 추출이 신뢰할 수 없으면 원문(trim) 유지.
 * @param {unknown} raw
 */
function normalizeStoredPhone(raw) {
  const orig = String(raw ?? '').trim()
  if (!orig) {
    return ''
  }
  const beforeWave = orig.split(/[~～]/)[0].trim()
  const firstSeg = beforeWave.split(/[,，]/)[0].trim()
  const d = cleanPhone(firstSeg)
  if (d.length >= 8 && d.length <= 11) {
    return d
  }
  if (d.length >= 5 && d.length <= 7) {
    return d
  }
  const d2 = cleanPhone(orig)
  if (d2.length >= 8 && d2.length <= 11) {
    return d2
  }
  if (d2.length >= 5 && d2.length <= 7) {
    return d2
  }
  return orig
}

function parseArgs(argv) {
  const args = { paths: [], dryRun: false, sheet: '' }
  for (const a of argv) {
    if (a === '--dry-run') {
      args.dryRun = true
    } else if (a.startsWith('--sheet=')) {
      args.sheet = a.slice('--sheet='.length)
    } else if (!a.startsWith('-')) {
      args.paths.push(a)
    }
  }
  return args
}

const EDITOR = 'excel-cleaned-import'

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const defaultLocalPath = path.join('n:', '개인', 'insurance_cleaned_upload_v2.xlsx')
  const excelPath =
    args.paths[0] ||
    process.env.CLEANED_INSURANCE_EXCEL_PATH ||
    (fs.existsSync(defaultLocalPath) ? defaultLocalPath : '')

  if (!excelPath || !fs.existsSync(excelPath)) {
    console.error(
      '엑셀 경로가 필요합니다. 인자나 CLEANED_INSURANCE_EXCEL_PATH를 지정하세요.',
    )
    process.exit(1)
  }

  const workbook = XLSX.readFile(excelPath, { cellNF: false, sheetStubs: true })
  const sheetName = args.sheet || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    console.error('시트 없음:', sheetName)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const COL_GUBUN = '구분'
  const COL_NAME = '보험사명'
  const COL_INCALL = '인콜'
  const COL_SYSTEM = '전산문의'
  const COL_MANAGER = '담당자'
  const COL_PHONE = '연락처'

  /** @type {Map<string, { category: string, name: string, userRows: object[] }>} */
  const groups = new Map()

  for (const row of rows) {
    const category = normalizeInsuranceCompanyCategory(row[COL_GUBUN])
    const name = String(row[COL_NAME] ?? '').trim()
    if (!category || !name) {
      console.warn('[skip] 구분/보험사명 없음:', row)
      continue
    }
    const key = `${category}\0${name}`
    if (!groups.has(key)) {
      groups.set(key, { category, name, userRows: [] })
    }
    groups.get(key).userRows.push(row)
  }

  /** @type {Array<{ category: string, name: string, incall_number: string, system_phone: string, contacts: { name: string, position: string, phone: string }[] }>} */
  const companies = []

  for (const g of groups.values()) {
    const first = g.userRows[0]
    const incallRaw = String(first[COL_INCALL] ?? '').trim()
    const systemRaw = String(first[COL_SYSTEM] ?? '').trim()

    for (const row of g.userRows) {
      const ir = String(row[COL_INCALL] ?? '').trim()
      const sr = String(row[COL_SYSTEM] ?? '').trim()
      if (ir !== incallRaw || sr !== systemRaw) {
        console.warn(
          `[warn] 동일 보험사 "${g.name}" 인콜/전산 불일치(마스터는 첫 행 기준):`,
          { expectIncall: incallRaw, expectSystem: systemRaw, rowIncall: ir, rowSystem: sr },
        )
        break
      }
    }

    const contacts = []
    for (const row of g.userRows) {
      const nameCell = String(row[COL_MANAGER] ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      const phoneRaw = String(row[COL_PHONE] ?? '').trim()
      const phone = normalizeStoredPhone(phoneRaw)
      if (!nameCell && !phone) {
        continue
      }
      contacts.push({ name: nameCell || '담당자', position: '', phone })
    }

    companies.push({
      category: g.category,
      name: g.name,
      incall_number: normalizeStoredPhone(incallRaw),
      system_phone: normalizeStoredPhone(systemRaw),
      contacts,
    })
  }

  console.log('[cleaned-import] file:', excelPath)
  console.log('[cleaned-import] sheet:', sheetName)
  console.log('[cleaned-import] source rows:', rows.length)
  console.log('[cleaned-import] companies:', companies.length)
  console.log(
    '[cleaned-import] contacts:',
    companies.reduce((n, c) => n + c.contacts.length, 0),
  )

  if (args.dryRun) {
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL 이 없습니다. .env 또는 환경변수를 설정하세요.')
    process.exit(1)
  }

  const { default: pool } = await import('../db.js')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const co of companies) {
      const ins = await client.query(
        `
        INSERT INTO insurance_company_master (
          category, name, customer_center, system_phone, incall_number, visit_info,
          updated_at, updated_by_username
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT (category, name) DO UPDATE SET
          customer_center = EXCLUDED.customer_center,
          system_phone = EXCLUDED.system_phone,
          incall_number = EXCLUDED.incall_number,
          visit_info = EXCLUDED.visit_info,
          updated_at = NOW(),
          updated_by_username = EXCLUDED.updated_by_username
        RETURNING id
        `,
        [
          co.category,
          co.name,
          '',
          co.system_phone,
          co.incall_number,
          '',
          EDITOR,
        ],
      )
      const companyId = ins.rows[0].id

      await client.query(`DELETE FROM insurance_company_contacts WHERE company_id = $1`, [companyId])

      for (const ct of co.contacts) {
        await client.query(
          `
          INSERT INTO insurance_company_contacts (company_id, name, position, phone)
          VALUES ($1, $2, $3, $4)
          `,
          [companyId, ct.name || '담당자', ct.position, ct.phone],
        )
      }
    }
    await client.query('COMMIT')
    console.log('[cleaned-import] DB 반영 완료')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[cleaned-import] DB 오류:', e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
