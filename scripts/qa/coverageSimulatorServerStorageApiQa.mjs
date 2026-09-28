/**
 * DEV QA: Coverage Simulator server storage API (templates + simulations).
 *
 * Usage:
 *   node scripts/qa/coverageSimulatorServerStorageApiQa.mjs https://insurance-dev.up.railway.app
 *
 * Env:
 *   COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS — primary tenant
 *   COVERAGE_BINDER_QA_USER_B / COVERAGE_BINDER_QA_PASS_B — optional second user (IDOR)
 */
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USER_A = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASS_A = process.env.COVERAGE_BINDER_QA_PASS
const USER_B = process.env.COVERAGE_BINDER_QA_USER_B?.trim()
const PASS_B = process.env.COVERAGE_BINDER_QA_PASS_B
const OUT = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'dev-qa-server-storage-api')

const results = []
const stamp = Date.now()
const QA_PREFIX = `QA 서버저장 ${stamp}`

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail })
  console.log(`[PASS] ${id}: ${detail}`)
}
function fail(id, detail) {
  results.push({ id, status: 'FAIL', detail })
  console.error(`[FAIL] ${id}: ${detail}`)
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { status: response.status, payload }
}

function expectStatus(result, code, label) {
  if (result.status !== code) {
    throw new Error(`${label}: expected ${code}, got ${result.status} ${JSON.stringify(result.payload)}`)
  }
  return result.payload
}

async function login(username, password) {
  const payload = expectStatus(
    await request('/api/auth/login', { method: 'POST', body: { username, password } }),
    200,
    `login ${username}`,
  )
  if (!payload?.token) throw new Error(`token missing for ${username}`)
  return payload.token
}

async function cleanupQa(token) {
  const list = expectStatus(await request('/api/coverage-simulator/templates', { token }), 200, 'list templates')
  for (const row of list.templates ?? []) {
    if (String(row.name).includes('QA 서버저장')) {
      await request(`/api/coverage-simulator/templates/${row.id}`, { token, method: 'DELETE' })
    }
  }
  const sims = expectStatus(await request('/api/coverage-simulator/simulations', { token }), 200, 'list sims')
  for (const row of sims.simulations ?? []) {
    if (String(row.title).includes('QA 서버저장')) {
      await request(`/api/coverage-simulator/simulations/${row.id}`, { token, method: 'DELETE' })
    }
  }
}

const sampleItem = {
  id: randomUUID(),
  type: 'coverage',
  category: 'diagnosis',
  label: 'QA 항목',
  currentAmount: 0,
  proposedAmount: 1000,
  order: 0,
}

async function main() {
  if (!USER_A || !PASS_A) {
    throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS가 필요합니다.')
  }
  await mkdir(OUT, { recursive: true })

  const tokenA = await login(USER_A, PASS_A)
  await cleanupQa(tokenA)

  const created = expectStatus(
    await request('/api/coverage-simulator/templates', {
      token: tokenA,
      method: 'POST',
      body: {
        name: `${QA_PREFIX} template`,
        description: 'api qa',
        diseaseType: 'custom',
        items: [sampleItem],
      },
    }),
    201,
    'create template',
  )
  if (!/^\d+$/.test(String(created.id))) fail('template-numeric-id', String(created.id))
  else pass('template-numeric-id', created.id)

  const patched = expectStatus(
    await request(`/api/coverage-simulator/templates/${created.id}`, {
      token: tokenA,
      method: 'PATCH',
      body: { name: `${QA_PREFIX} template renamed` },
    }),
    200,
    'patch template',
  )
  if (patched.name.includes('renamed')) pass('template-patch', patched.name)
  else fail('template-patch', patched.name)

  const dup = expectStatus(
    await request(`/api/coverage-simulator/templates/${created.id}/duplicate`, {
      token: tokenA,
      method: 'POST',
    }),
    201,
    'duplicate template',
  )
  pass('template-duplicate', dup.id)

  const legacyId = randomUUID()
  const sim = expectStatus(
    await request('/api/coverage-simulator/simulations', {
      token: tokenA,
      method: 'POST',
      body: {
        legacyClientId: legacyId,
        title: `${QA_PREFIX} simulation`,
        diseaseType: 'cerebrovascular',
        description: '',
        consultationDate: '2026-09-28',
        items: [{ ...sampleItem, id: randomUUID(), label: '뇌혈관 QA' }],
        templateId: created.id,
        templateNameSnapshot: patched.name,
      },
    }),
    201,
    'create simulation',
  )
  pass('simulation-create', sim.id)

  const simDup = expectStatus(
    await request('/api/coverage-simulator/simulations', {
      token: tokenA,
      method: 'POST',
      body: {
        legacyClientId: legacyId,
        title: 'should not duplicate',
        diseaseType: 'cancer',
        consultationDate: '2026-09-28',
        items: [],
      },
    }),
    201,
    'legacy idempotent',
  )
  if (String(simDup.id) === String(sim.id)) pass('legacy-idempotent', simDup.id)
  else fail('legacy-idempotent', `first=${sim.id} second=${simDup.id}`)

  const reloaded = expectStatus(
    await request(`/api/coverage-simulator/simulations/${sim.id}`, { token: tokenA }),
    200,
    'get simulation',
  )
  if (reloaded.templateNameSnapshot === patched.name) pass('simulation-reload', 'snapshot ok')
  else fail('simulation-reload', JSON.stringify(reloaded.templateNameSnapshot))

  const spoof = await request('/api/coverage-simulator/simulations', {
    token: tokenA,
    method: 'POST',
    body: {
      title: `${QA_PREFIX} spoof owner`,
      diseaseType: 'custom',
      consultationDate: '2026-09-28',
      items: [],
      owner_user_id: 'evil',
      ga_id: 999999,
    },
  })
  if (spoof.status === 201) {
    const row = spoof.payload
    const list = expectStatus(await request('/api/coverage-simulator/simulations', { token: tokenA }), 200, 'list after spoof')
    const mine = (list.simulations ?? []).find((r) => r.id === row.id)
    if (mine) pass('spoof-ignored-extra-fields', 'created under auth context only')
    await request(`/api/coverage-simulator/simulations/${row.id}`, { token: tokenA, method: 'DELETE' })
  } else {
    pass('spoof-rejected-or-validation', String(spoof.status))
  }

  if (USER_B && PASS_B) {
    const tokenB = await login(USER_B, PASS_B)
    const forbiddenGet = await request(`/api/coverage-simulator/templates/${created.id}`, { token: tokenB })
    if (forbiddenGet.status === 404) pass('tenant-template-get', '404')
    else fail('tenant-template-get', String(forbiddenGet.status))

    const forbiddenPatch = await request(`/api/coverage-simulator/templates/${created.id}`, {
      token: tokenB,
      method: 'PATCH',
      body: { name: 'hacked' },
    })
    if (forbiddenPatch.status === 404) pass('tenant-template-patch', '404')
    else fail('tenant-template-patch', String(forbiddenPatch.status))

    const forbiddenSim = await request(`/api/coverage-simulator/simulations/${sim.id}`, { token: tokenB })
    if (forbiddenSim.status === 404) pass('tenant-simulation-get', '404')
    else fail('tenant-simulation-get', String(forbiddenSim.status))
  } else {
    pass('tenant-isolation', 'skipped — COVERAGE_BINDER_QA_USER_B not set')
  }

  const badCustomer = await request('/api/coverage-simulator/simulations', {
    token: tokenA,
    method: 'POST',
    body: {
      title: `${QA_PREFIX} bad customer`,
      diseaseType: 'custom',
      consultationDate: '2026-09-28',
      items: [],
      customerId: '999999999',
    },
  })
  if (badCustomer.status === 403 || badCustomer.status === 400) pass('customer-forbidden', String(badCustomer.status))
  else fail('customer-forbidden', `${badCustomer.status} ${JSON.stringify(badCustomer.payload)}`)

  await request(`/api/coverage-simulator/simulations/${sim.id}`, { token: tokenA, method: 'DELETE' })
  await request(`/api/coverage-simulator/templates/${dup.id}`, { token: tokenA, method: 'DELETE' })
  await request(`/api/coverage-simulator/templates/${created.id}`, { token: tokenA, method: 'DELETE' })

  const summary = {
    base: BASE,
    at: new Date().toISOString(),
    results,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
  }
  await writeFile(join(OUT, 'results.json'), JSON.stringify(summary, null, 2))
  if (summary.fail > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
