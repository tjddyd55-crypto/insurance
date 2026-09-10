/**
 * DEV/staging QA runner — feature branch local server against Railway development DB.
 * Usage: railway run node server/scripts/qaCustomerBusinessFireEnv.mjs [--base http://127.0.0.1:3001]
 */
import pg from 'pg'

const API_BASE = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://127.0.0.1:3001'
const API = `${API_BASE}/backend/api`

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`login failed ${res.status}: ${body.message ?? JSON.stringify(body)}`)
  }
  const token = body.token ?? body.data?.token
  if (!token) throw new Error('login: no token')
  return { token, user: body.user ?? body.data?.user }
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function verifySchema(pool) {
  const cols = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name LIKE 'business_%'
    ORDER BY column_name
  `)
  const expected = [
    'business_address',
    'business_memo',
    'business_number',
    'business_representative_name',
  ]
  const found = cols.rows.map((r) => r.column_name)
  for (const c of expected) {
    if (!found.includes(c)) throw new Error(`missing column customers.${c}`)
  }

  const tbl = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_fire_insurance_locations'
    ORDER BY ordinal_position
  `)
  if (tbl.rowCount === 0) throw new Error('missing table customer_fire_insurance_locations')
  const colNames = tbl.rows.map((r) => r.column_name)
  for (const c of ['id', 'customer_id', 'user_id', 'ga_id', 'address', 'memo', 'sort_order', 'deleted_at', 'created_at', 'updated_at']) {
    if (!colNames.includes(c)) throw new Error(`missing column customer_fire_insurance_locations.${c}`)
  }

  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'customer_fire_insurance_locations'
      AND indexname LIKE 'idx_customer_fire_insurance_locations%'
  `)
  if (idx.rowCount < 3) throw new Error(`expected >=3 indexes, got ${idx.rowCount}`)

  return { businessColumns: found, fireTableColumns: colNames, indexCount: idx.rowCount }
}

async function findQaUser(pool) {
  const r = await pool.query(`
    SELECT u.id, u.username, u.role, u.ga_id,
           (SELECT COUNT(*)::int FROM customers c WHERE c.user_id = u.id AND c.deleted_at IS NULL) AS customer_count
    FROM users u
    WHERE u.role = 'USER'
    ORDER BY customer_count DESC
    LIMIT 5
  `)
  return r.rows
}

function resolveDatabaseUrl() {
  const internal = process.env.DATABASE_URL ?? ''
  if (internal.includes('railway.internal') && process.env.DATABASE_PUBLIC_URL) {
    return process.env.DATABASE_PUBLIC_URL
  }
  return internal
}

async function main() {
  const results = []
  const dbUrl = resolveDatabaseUrl()
  if (!dbUrl) throw new Error('DATABASE_URL required')
  const pool = new pg.Pool({ connectionString: dbUrl })

  try {
    const { initDb } = await import('../initDb.js')
    console.log('[qa] initDb run 1…')
    await initDb()
    console.log('[qa] initDb run 2…')
    await initDb()
    results.push({ step: 'initDb-idempotent', ok: true })

    const schema = await verifySchema(pool)
    results.push({ step: 'schema', ok: true, schema })

    const username = process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME ?? 'admin'
    const password = process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD ?? '1234'
    let token
    let user
    try {
      const loginResult = await login(username, password)
      token = loginResult.token
      user = loginResult.user
    } catch (adminErr) {
      const candidates = await findQaUser(pool)
      console.log('[qa] admin login failed, USER candidates:', candidates.map((c) => c.username))
      throw adminErr
    }

    const listRes = await api(token, '/customers?limit=5')
    if (listRes.status !== 200) {
      throw new Error(`list customers ${listRes.status}`)
    }
    const customers = Array.isArray(listRes.body?.data) ? listRes.body.data : listRes.body?.customers ?? listRes.body
    const customerList = Array.isArray(customers) ? customers : []
    if (customerList.length === 0) {
      throw new Error('no customers in dev DB for QA')
    }

    const legacy = customerList.find((c) => !c.businessInfo && (!c.fireInsuranceLocations || c.fireInsuranceLocations.length === 0)) ?? customerList[0]
    const legacyId = legacy.id

    const legacyGet = await api(token, `/customers/${legacyId}`)
    if (legacyGet.status !== 200) throw new Error(`get legacy ${legacyGet.status}`)
    const lg = legacyGet.body
    if (lg.businessInfo != null) console.warn('[qa] legacy businessInfo not null:', lg.businessInfo)
    if (!Array.isArray(lg.fireInsuranceLocations)) throw new Error('fireInsuranceLocations not array on GET')
    results.push({
      step: 'legacy-get',
      ok: true,
      businessInfo: lg.businessInfo ?? null,
      fireCount: lg.fireInsuranceLocations.length,
    })

    const partialName = `${lg.name}`.trim()
    const partialPut = await api(token, `/customers/${legacyId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: partialName }),
    })
    if (partialPut.status !== 200) throw new Error(`partial put ${partialPut.status}`)
    results.push({ step: 'legacy-partial-put', ok: true })

    let testCustomerId = legacyId
    const businessPayload = {
      representativeName: '홍길동',
      businessNumber: '123-45-67890',
      businessAddress: '서울특별시 테스트구 테스트로 10',
      memo: '경영인 정기보험 상담 예정',
    }

    const bizPut = await api(token, `/customers/${testCustomerId}`, {
      method: 'PUT',
      body: JSON.stringify({ businessInfo: businessPayload }),
    })
    if (bizPut.status !== 200) throw new Error(`business put ${bizPut.status}`)

    const bizGet = await api(token, `/customers/${testCustomerId}`)
    const bi = bizGet.body.businessInfo
    if (!bi || bi.representativeName !== '홍길동') throw new Error('business get mismatch')
    results.push({ step: 'business-crud', ok: true, storedNumber: bi.businessNumber })

    const bizPartial = await api(token, `/customers/${testCustomerId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: partialName }),
    })
    const afterPartial = await api(token, `/customers/${testCustomerId}`)
    if (!afterPartial.body.businessInfo?.representativeName) throw new Error('business lost on partial put')
    results.push({ step: 'business-partial-preserve', ok: true })

    const loc1 = await api(token, `/customers/${testCustomerId}/fire-insurance-locations`, {
      method: 'POST',
      body: JSON.stringify({ address: '서울특별시 테스트구 화재로 1', memo: '본사' }),
    })
    if (loc1.status !== 201) throw new Error(`fire create 1 ${loc1.status}`)
    const loc1Id = loc1.body.id

    const loc2 = await api(token, `/customers/${testCustomerId}/fire-insurance-locations`, {
      method: 'POST',
      body: JSON.stringify({ address: '경기도 테스트시 창고로 20', memo: '물류창고' }),
    })
    if (loc2.status !== 201) throw new Error(`fire create 2 ${loc2.status}`)
    const loc2Id = loc2.body.id

    const listFire = await api(token, `/customers/${testCustomerId}/fire-insurance-locations`)
    const fires = listFire.body.fireInsuranceLocations ?? []
    if (fires.length < 2) throw new Error('expected 2 fire locations')
    results.push({ step: 'fire-add', ok: true, ids: [loc1Id, loc2Id], sortOrders: fires.map((f) => f.sortOrder) })

    await api(token, `/customers/${testCustomerId}/fire-insurance-locations/${loc1Id}`, {
      method: 'PATCH',
      body: JSON.stringify({ address: '서울특별시 테스트구 화재로 1 (수정)', memo: '본사 수정' }),
    })

    const afterPatch = await api(token, `/customers/${testCustomerId}/fire-insurance-locations`)
    const row1 = afterPatch.body.fireInsuranceLocations.find((f) => f.id === loc1Id)
    if (!row1 || row1.id !== loc1Id) throw new Error('loc1 id not preserved after patch')
    results.push({ step: 'fire-update-id-preserved', ok: true, loc1Id })

    await api(token, `/customers/${testCustomerId}/fire-insurance-locations/${loc2Id}`, {
      method: 'DELETE',
    })

    const afterDel = await api(token, `/customers/${testCustomerId}/fire-insurance-locations`)
    if (afterDel.body.fireInsuranceLocations.some((f) => f.id === loc2Id)) {
      throw new Error('deleted location still in GET')
    }

    const soft = await pool.query(
      `SELECT deleted_at FROM customer_fire_insurance_locations WHERE id = $1`,
      [loc2Id],
    )
    if (!soft.rows[0]?.deleted_at) throw new Error('soft delete not set')
    results.push({ step: 'fire-soft-delete', ok: true })

    console.log(JSON.stringify({ ok: true, results }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[qa] FAILED', err)
  process.exit(1)
})
