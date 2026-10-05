/**
 * Development-only deterministic AI read-only QA dataset (synthetic data).
 * Usage: INSURANCE_DB_ENVIRONMENT=development node server/scripts/seed-ai-readonly-qa-dev.mjs --execute
 */
import { addDaysToDateOnly, getKstDateString } from '../../shared/dateTimeKst.js'
import {
  buildInsuranceUserStorageKey,
  INSURANCE_STORAGE_CATEGORY,
} from '../lib/insuranceStorageLayout.js'
import { consentPutObject } from '../lib/consentStorage.js'
import pool from '../db.js'
import { resolveTenantByAuthenticatedLegacyGaId } from '../lib/resolveTenantByAuthenticatedLegacyGaId.js'
import { assertDevelopmentDatabaseOnly } from './lib/assertDevelopmentDatabase.mjs'
import { parseTargetUsername } from './lib/parseSeedCliArgs.mjs'

const QA_PREFIX = 'AI테스트_'
const LEGACY_QA_USERNAME = String(process.env.INSURANCE_GA_QA_BOOTSTRAP_USERNAME ?? 'qa_ai_user').trim()

function todayYmd() {
  return getKstDateString(new Date())
}

function offsetYmd(days) {
  return addDaysToDateOnly(todayYmd(), days)
}

async function resolveQaContext(client, targetUsername) {
  const userRes = await client.query(
    `
    SELECT u.id, u.username, u.role, u.ga_id, g.code AS ga_code, g.name AS ga_name
    FROM users u
    INNER JOIN ga_companies g ON g.id = u.ga_id
    WHERE u.username = $1
    LIMIT 1
    `,
    [targetUsername],
  )
  const row = userRes.rows[0]
  if (!row?.id) {
    throw new Error(`Target user ${targetUsername} not found`)
  }
  const gaId = Number(row.ga_id)
  const tenantResolved = await resolveTenantByAuthenticatedLegacyGaId(client, {
    legacyGaId: gaId,
    authUser: { gaId },
  })
  if (!tenantResolved.ok) {
    throw new Error(tenantResolved.message)
  }
  return {
    gaId,
    gaCode: String(row.ga_code ?? ''),
    gaName: String(row.ga_name ?? ''),
    userId: String(row.id),
    username: String(row.username),
    role: String(row.role ?? ''),
    tenantId: tenantResolved.tenantId,
  }
}

async function purgeLegacyQaUserData(client, legacyUsername) {
  const legacy = await client.query(`SELECT id, ga_id FROM users WHERE username = $1 LIMIT 1`, [legacyUsername])
  const legacyUserId = legacy.rows[0]?.id
  const legacyGaId = legacy.rows[0]?.ga_id
  if (!legacyUserId || legacyGaId == null) {
    return { removedCustomers: 0 }
  }
  await client.query(
    `DELETE FROM customer_claim_request_files f
     USING customer_claim_requests r, customers c
     WHERE f.request_id = r.id AND r.customer_id = c.id
       AND c.user_id = $1 AND c.ga_id = $2 AND c.name LIKE 'AI테스트_%'`,
    [legacyUserId, legacyGaId],
  )
  await client.query(
    `DELETE FROM customer_claim_requests r
     USING customers c
     WHERE r.customer_id = c.id AND c.user_id = $1 AND c.ga_id = $2 AND c.name LIKE 'AI테스트_%'`,
    [legacyUserId, legacyGaId],
  )
  await client.query(
    `DELETE FROM todos WHERE ga_id = $1 AND owner_user_id = $2 AND (title LIKE 'AI테스트_%' OR title LIKE 'AI 조회%')`,
    [legacyGaId, legacyUserId],
  )
  const del = await client.query(
    `DELETE FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE 'AI테스트_%'`,
    [legacyGaId, legacyUserId],
  )
  return { removedCustomers: del.rowCount ?? 0 }
}

async function purgeExistingQaCustomers(client, gaId, userId) {
  await client.query(`DELETE FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE $3`, [
    gaId,
    userId,
    `${QA_PREFIX}%`,
  ])
}

async function insertCustomer(client, ctx, spec) {
  const notes = JSON.stringify([{ id: 'qa-note-1', text: spec.memo ?? 'QA 테스트 고객 메모', createdAt: new Date().toISOString() }])
  const ins = await client.query(
    `
    INSERT INTO customers (
      user_id, ga_id, name, ssn, phone, carrier, address, job,
      gender, birth_date, inflow_source, referrer_name,
      car_number, car_model, car_year, renewal_date, car_type, is_driver,
      business_representative_name, business_number, business_address, business_memo,
      tenant_id, owner_user_id, created_by_user_id, visibility_scope, notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,
      $19,$20,$21,$22,
      $23,$1,$1,'own',CAST($24 AS jsonb)
    )
    RETURNING id
    `,
    [
      ctx.userId,
      ctx.gaId,
      spec.name,
      spec.ssn,
      spec.phone,
      spec.carrier ?? 'SKT',
      spec.address,
      spec.job ?? '',
      spec.gender ?? 'M',
      spec.birthDate,
      spec.inflowSource ?? '소개',
      spec.referrerName ?? 'QA소개자',
      spec.carNumber ?? '',
      spec.carModel ?? '',
      spec.carYear ?? '',
      spec.renewalDate ?? null,
      spec.carType ?? '',
      spec.isDriver ?? null,
      spec.business?.representativeName ?? '',
      spec.business?.businessNumber ?? '',
      spec.business?.businessAddress ?? '',
      spec.business?.memo ?? '',
      ctx.tenantId,
      notes,
    ],
  )
  const customerId = Number(ins.rows[0].id)
  for (const [i, cf] of (spec.customFields ?? []).entries()) {
    await client.query(
      `INSERT INTO customer_custom_fields (customer_id, user_id, ga_id, label, value, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [customerId, ctx.userId, ctx.gaId, cf.label, cf.value, i],
    )
  }
  for (const [i, loc] of (spec.fireLocations ?? []).entries()) {
    await client.query(
      `INSERT INTO customer_fire_insurance_locations (customer_id, user_id, ga_id, address, memo, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [customerId, ctx.userId, ctx.gaId, loc.address, loc.memo ?? '', i],
    )
  }
  for (const c of spec.consultations ?? []) {
    await client.query(
      `INSERT INTO customer_consultations (customer_id, user_id, ga_id, body, consultation_date)
       VALUES ($1,$2,$3,$4,$5::date)`,
      [customerId, ctx.userId, ctx.gaId, c.body, c.date],
    )
  }
  for (const sd of spec.specialDates ?? []) {
    await client.query(
      `INSERT INTO customer_special_dates (customer_id, user_id, ga_id, purpose_type, title, date_value, memo)
       VALUES ($1,$2,$3,'NOTICE',$4,$5::date,$6)`,
      [customerId, ctx.userId, ctx.gaId, sd.title, sd.date, sd.memo ?? ''],
    )
  }
  for (const cl of spec.claims ?? []) {
    await client.query(
      `INSERT INTO customer_claim_requests (
        agent_id, customer_id, device_id, request_type, status, title, memo,
        requester_name, requester_phone, submitted_at
      ) VALUES ($1,$2,$3,'claim',$4,$5,$6,$7,$8,NOW())`,
      [
        ctx.userId,
        customerId,
        `qa-device-${customerId}`,
        cl.status,
        cl.title,
        cl.memo ?? '',
        spec.name,
        spec.phone,
      ],
    )
  }
  for (const file of spec.files ?? []) {
    await insertQaFile(client, ctx, customerId, file)
  }
  return customerId
}

async function insertQaFile(client, ctx, customerId, file) {
  const fileName = file.name
  const mime = file.mime ?? 'application/pdf'
  const body = file.body ?? Buffer.from(`QA file: ${fileName}\n`, 'utf8')
  const objectKey = buildInsuranceUserStorageKey({
    gaCode: ctx.gaCode,
    userId: ctx.userId,
    category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES,
    customerId,
    originalName: fileName,
    now: new Date(),
  })
  let uploaded = false
  try {
    await consentPutObject(objectKey, body, mime)
    uploaded = true
  } catch (e) {
    console.warn('[seed-ai-readonly-qa] R2 upload skipped', fileName, e instanceof Error ? e.message : e)
  }
  await client.query(
    `
    INSERT INTO files (
      user_id, ga_id, customer_id, team_id, folder_id,
      original_name, display_name, file_path, file_size, mime_type,
      content, is_confirmed, status, created_at
    ) VALUES ($1,$2,$3,NULL,NULL,$4,$4,$5,$6,$7,$8,true,'active',NOW())
    `,
    [
      ctx.userId,
      ctx.gaId,
      customerId,
      fileName,
      uploaded ? objectKey : '',
      body.length,
      mime,
      uploaded ? '' : body.toString('utf8'),
    ],
  )
}

async function insertTodos(client, ctx, todos) {
  for (const t of todos) {
    await client.query(
      `INSERT INTO todos (ga_id, owner_user_id, assignee_user_id, title, due_date, status, source_type)
       VALUES ($1,$2,$2,$3,$4::date,'pending','manual')`,
      [ctx.gaId, ctx.userId, t.title, t.dueDate],
    )
  }
}

async function countVerify(client, gaId, userId) {
  const q = async (sql, params) => Number((await client.query(sql, params)).rows[0]?.c ?? 0)
  return {
    qaCustomers: await q(
      `SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE $3`,
      [gaId, userId, `${QA_PREFIX}%`],
    ),
    consultations: await q(
      `SELECT COUNT(*)::int AS c FROM customer_consultations cc
       INNER JOIN customers c ON c.id = cc.customer_id
       WHERE c.ga_id = $1 AND c.user_id = $2 AND c.name LIKE $3`,
      [gaId, userId, `${QA_PREFIX}%`],
    ),
    files: await q(
      `SELECT COUNT(*)::int AS c FROM files f
       INNER JOIN customers c ON c.id = f.customer_id
       WHERE c.ga_id = $1 AND c.user_id = $2 AND c.name LIKE $3 AND f.status = 'active'`,
      [gaId, userId, `${QA_PREFIX}%`],
    ),
    todos: await q(`SELECT COUNT(*)::int AS c FROM todos WHERE ga_id = $1 AND owner_user_id = $2`, [
      gaId,
      userId,
    ]),
    claims: await q(
      `SELECT COUNT(*)::int AS c FROM customer_claim_requests WHERE agent_id = $1`,
      [userId],
    ),
    specialDates: await q(
      `SELECT COUNT(*)::int AS c FROM customer_special_dates sd
       INNER JOIN customers c ON c.id = sd.customer_id
       WHERE c.ga_id = $1 AND c.user_id = $2 AND c.name LIKE $3 AND sd.deleted_at IS NULL`,
      [gaId, userId, `${QA_PREFIX}%`],
    ),
  }
}

async function main() {
  const execute = process.argv.includes('--execute')
  assertDevelopmentDatabaseOnly({ scriptName: 'seed-ai-readonly-qa-dev', execute })
  if (!execute) {
    console.log('[seed-ai-readonly-qa-dev] dry-run only — pass --execute')
    process.exit(0)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const targetUsername = parseTargetUsername()
    const ctx = await resolveQaContext(client, targetUsername)
    await purgeExistingQaCustomers(client, ctx.gaId, ctx.userId)
    if (targetUsername !== LEGACY_QA_USERNAME) {
      const legacy = await purgeLegacyQaUserData(client, LEGACY_QA_USERNAME)
      console.log('[seed-ai-readonly-qa-dev] legacy qa_ai_user AI테스트 purge', legacy)
    }

    const t0 = todayYmd()
    const t1 = offsetYmd(1)
    const t2 = offsetYmd(-7)
    const t3 = offsetYmd(-30)

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}홍길동`,
      ssn: '900101-1000001',
      phone: '010-9000-1001',
      birthDate: '1990-01-01',
      address: '서울특별시 강남구 테헤란로 100 QA빌딩 501호',
      job: 'QA테스트회사 대리',
      carNumber: '12가3456',
      carModel: '소나타',
      carYear: '2022',
      renewalDate: offsetYmd(90),
      carType: '승용',
      isDriver: true,
      business: {
        representativeName: 'AI테스트대표',
        businessNumber: '123-45-67890',
        businessAddress: '서울시 영등포구 QA로 9',
        memo: '사업자 QA 메모',
      },
      fireLocations: [
        { address: '경기도 성남시 QA소재지1', memo: '화재1 메모' },
        { address: '경기도 수원시 QA소재지2', memo: '화재2 메모' },
      ],
      customFields: [
        { label: 'VIP', value: 'Y' },
        { label: '주력보험사', value: '현대해상' },
        { label: '회사명', value: 'QA테스트회사' },
      ],
      consultations: [
        { date: t0, body: '자동차보험 갱신 상담 진행' },
        { date: t2, body: '건강보험 보장내용 상담' },
        { date: t3, body: '신규 고객 기본 상담' },
      ],
      specialDates: [{ title: `${QA_PREFIX}홍길동 상담`, date: t0, memo: '오늘 일정 QA' }],
      claims: [{ status: 'requested', title: 'QA 미처리 청구', memo: 'DEV seed pending' }],
      files: [
        { name: `${QA_PREFIX}홍길동_보험증권.pdf`, mime: 'application/pdf' },
        { name: `${QA_PREFIX}홍길동_신분확인용_QA.pdf`, mime: 'application/pdf' },
        { name: `${QA_PREFIX}홍길동_상담자료.txt`, mime: 'text/plain' },
      ],
    })

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}김철수`,
      ssn: '850515-2000002',
      phone: '010-9000-1002',
      birthDate: '1985-05-15',
      address: '부산광역시 해운대구 QA로 2',
      job: '영업',
      customFields: [{ label: '주력보험사', value: 'DB손해보험' }],
      consultations: [{ date: t2, body: 'DB손해보험 갱신 문의' }],
      claims: [{ status: 'done', title: 'QA 처리완료 청구', memo: 'done seed' }],
      files: [{ name: `${QA_PREFIX}김철수_첨부.pdf`, mime: 'application/pdf' }],
      specialDates: [{ title: `${QA_PREFIX}김철수 갱신 확인`, date: t0, memo: '오늘 일정' }],
    })

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}이영희`,
      ssn: '920303-2000003',
      phone: '010-9000-1003',
      birthDate: '1992-03-03',
      address: '대구광역시 중구 QA길 3',
      customFields: [
        { label: 'VIP', value: 'Y' },
        { label: '주력보험사', value: 'KB손해보험' },
      ],
      specialDates: [{ title: `${QA_PREFIX}이영희 전화`, date: t1, memo: '내일 일정' }],
    })

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}박민수`,
      ssn: '880808-1000004',
      phone: '010-9000-1004',
      birthDate: '1988-08-08',
      address: '인천광역시 연수구 QA대로 4',
      claims: [
        { status: 'requested', title: 'QA 청구 A', memo: 'pending' },
        { status: 'processing', title: 'QA 청구 B', memo: 'processing' },
      ],
    })

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}최지우`,
      ssn: '950101-2000005',
      phone: '010-9000-1005',
      birthDate: '1995-01-01',
      address: '광주광역시 서구 QA로 5',
    })

    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}동명이인`,
      ssn: '900202-1000111',
      phone: '010-9000-1111',
      birthDate: '1990-02-02',
      address: '서울시 마포구 QA동 111',
    })
    await insertCustomer(client, ctx, {
      name: `${QA_PREFIX}동명이인`,
      ssn: '900202-2000222',
      phone: '010-9000-2222',
      birthDate: '1990-02-02',
      address: '서울시 마포구 QA동 222',
    })

    const weekEnd = addDaysToDateOnly(todayYmd(), 7)
    await insertTodos(client, ctx, [
      { title: `${QA_PREFIX}홍길동 전화하기`, dueDate: t0 },
      { title: `${QA_PREFIX}김철수 서류 확인`, dueDate: t0 },
      { title: `${QA_PREFIX}이영희 상담 준비`, dueDate: t1 },
      { title: 'AI 조회 기능 QA 점검', dueDate: weekEnd },
    ])

    const counts = await countVerify(client, ctx.gaId, ctx.userId)
    await client.query('COMMIT')
    console.log('[seed-ai-readonly-qa-dev] OK', {
      counts,
      targetUser: ctx.username,
      userId: ctx.userId,
      gaId: ctx.gaId,
      gaCode: ctx.gaCode,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  await pool.end()
}

main().catch((e) => {
  console.error('[seed-ai-readonly-qa-dev] failed', e instanceof Error ? e.message : e)
  process.exit(1)
})
