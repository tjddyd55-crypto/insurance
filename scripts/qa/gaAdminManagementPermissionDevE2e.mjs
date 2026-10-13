/**
 * GA_ADMIN management / STEP permission DEV API E2E.
 * Usage:
 *   node --env-file=server/.env.local scripts/qa/gaAdminManagementPermissionDevE2e.mjs [baseUrl]
 *
 * Env (optional overrides):
 *   GA_ADMIN_E2E_USERNAME (default: yjadmin — DEV GA_ADMIN QA)
 *   GA_ADMIN_E2E_PASSWORD (default: 1111)
 *   INSURANCE_ADMIN_BOOTSTRAP_USERNAME / INSURANCE_ADMIN_BOOTSTRAP_PASSWORD — super + cross-GA
 */
const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const API = `${BASE}/backend/api`

const GA_ADMIN_USER = String(process.env.GA_ADMIN_E2E_USERNAME ?? 'yjadmin').trim()
const GA_ADMIN_PASS = String(process.env.GA_ADMIN_E2E_PASSWORD ?? '1111')
const SUPER_USER = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME ?? 'admin').trim()
const SUPER_PASS = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD ?? '').trim()

const SUFFIX = String(Date.now()).slice(-6)

async function login(username, password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const json = await res.json().catch(() => ({}))
  const token = json.token
  if (!res.ok || !token) {
    throw new Error(`login failed ${username}: ${res.status} ${JSON.stringify(json)}`)
  }
  const user = json.user ?? {}
  return {
    token,
    role: user.role,
    gaId: user.ga_id ?? user.gaId,
    id: user.id,
  }
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
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function assertStatus(label, got, expected) {
  const ok = Array.isArray(expected) ? expected.includes(got) : got === expected
  if (!ok) {
    throw new Error(`${label}: expected ${expected}, got ${got}`)
  }
}

async function main() {
  const report = { base: BASE, ok: true, steps: [], errors: [], created: {} }
  if (!SUPER_PASS) {
    throw new Error('INSURANCE_ADMIN_BOOTSTRAP_PASSWORD required (use server/.env.local)')
  }

  try {
    const gaAdmin = await login(GA_ADMIN_USER, GA_ADMIN_PASS)
    if (gaAdmin.role !== 'GA_ADMIN') {
      throw new Error(`GA_ADMIN_E2E user role is ${gaAdmin.role}, expected GA_ADMIN`)
    }
    report.gaAdmin = { username: GA_ADMIN_USER, gaId: gaAdmin.gaId }
    report.steps.push('ga_admin_login')

    const delegatesBefore = await api(gaAdmin.token, '/ga-admin/delegates')
    assertStatus('GET ga-admin/delegates', delegatesBefore.status, 200)
    report.steps.push('ga_admin_list_delegates')

    const stepUsername = `step_e2e_${SUFFIX}`
    const stepPassword = `pw_${SUFFIX}_x`
    const createStep = await api(gaAdmin.token, '/ga-admin/delegates', {
      method: 'POST',
      body: JSON.stringify({
        username: stepUsername,
        password: stepPassword,
        name: `E2E STEP ${SUFFIX}`,
        ga_id: 999999,
        gaId: 999999,
        role: 'GA_ADMIN',
      }),
    })
    assertStatus('POST ga-admin/delegates', createStep.status, 201)
    const created = createStep.json
    if (Number(created.ga_id) !== Number(gaAdmin.gaId)) {
      throw new Error(`STEP ga_id mismatch: ${created.ga_id} vs ${gaAdmin.gaId}`)
    }
    if (created.role !== 'GA_STAFF') {
      throw new Error(`STEP role expected GA_STAFF, got ${created.role}`)
    }
    report.created.stepId = created.id
    report.created.stepUsername = stepUsername
    report.steps.push('ga_admin_create_step')

    const stepSession = await login(stepUsername, stepPassword)
    if (stepSession.role !== 'GA_STAFF') {
      throw new Error(`STEP login role ${stepSession.role}`)
    }
    report.steps.push('step_login')

    const staffBlocked = [['/ga-admin/delegates', 403], ['/admin/delegates', 403]]
    for (const [path, expectStatus] of staffBlocked) {
      const r = await api(stepSession.token, path)
      assertStatus(`GA_STAFF blocked ${path}`, r.status, expectStatus)
    }
    const staffClaim = await api(stepSession.token, '/admin/claim/insurance-companies')
    assertStatus('GA_STAFF claim admin', staffClaim.status, [403, 404])
    const staffPdf = await api(stepSession.token, '/admin/pdf-templates')
    assertStatus('GA_STAFF pdf admin', staffPdf.status, [403, 404])
    report.steps.push('ga_staff_api_blocked')

    const staffCreateDelegate = await api(stepSession.token, '/ga-admin/delegates', {
      method: 'POST',
      body: JSON.stringify({ username: `x_${SUFFIX}`, password: '12345678', role: 'GA_STAFF' }),
    })
    assertStatus('GA_STAFF create delegate', staffCreateDelegate.status, 403)
    report.steps.push('ga_staff_create_delegate_blocked')

    const insurerCreate = await api(gaAdmin.token, '/user-insurer-accounts', {
      method: 'POST',
      body: JSON.stringify({
        category: 'LIFE',
        companyName: `E2E Insurer ${SUFFIX}`,
        loginId: `e2e_${SUFFIX}`,
        loginPassword: `secret_${SUFFIX}`,
      }),
    })
    assertStatus('insurer create', insurerCreate.status, 201)
    report.created.insurerAccountId = insurerCreate.json?.account?.id
    report.steps.push('ga_admin_insurer_create')

    const shareVis = await api(gaAdmin.token, '/user-insurer-accounts/share-visibility')
    assertStatus('share visibility get', shareVis.status, 200)
    if (!shareVis.json?.enabled && shareVis.json?.isEnabled !== true) {
      const enabled = shareVis.json?.enabled ?? shareVis.json?.isEnabled
      if (enabled !== true) {
        report.steps.push('share_visibility_check_warn')
      }
    }
    report.steps.push('ga_admin_share_visibility')

    const sharedUsers = await api(stepSession.token, '/user-insurer-accounts/shared-users')
    assertStatus('staff shared users', sharedUsers.status, 200)
    const owners = Array.isArray(sharedUsers.json?.data)
      ? sharedUsers.json.data
      : Array.isArray(sharedUsers.json)
        ? sharedUsers.json
        : sharedUsers.json?.users ?? []
    const hasGaAdminOwner = owners.some((o) => String(o.userId) === String(gaAdmin.id))
    if (!hasGaAdminOwner) {
      throw new Error('GA_ADMIN owner not in shared-users list for STEP')
    }
    report.steps.push('step_sees_ga_admin_shared_owner')

    const boards = await api(gaAdmin.token, '/ga-admin/newsletter-boards')
    assertStatus('ga boards', boards.status, 200)
    const boardList = Array.isArray(boards.json) ? boards.json : []
    let boardId = boardList[0]?.id
    if (!boardId) {
      const createdBoard = await api(gaAdmin.token, '/ga-admin/newsletter-boards', {
        method: 'POST',
        body: JSON.stringify({ label: `E2E Board ${SUFFIX}`, description: 'e2e' }),
      })
      assertStatus('create board', createdBoard.status, 201)
      boardId = createdBoard.json?.id
    }
    const writerLogin = `wr_e2e_${SUFFIX}`
    const writerPass = `WrPass_${SUFFIX}!`
    const writerCreate = await api(gaAdmin.token, '/ga-admin/board-writers', {
      method: 'POST',
      body: JSON.stringify({
        loginId: writerLogin,
        password: writerPass,
        name: `Writer ${SUFFIX}`,
        allowedBoardIds: [boardId],
      }),
    })
    assertStatus('writer create', writerCreate.status, 201)
    report.created.writerId = writerCreate.json?.id
    report.steps.push('ga_admin_writer_create')

    const superSession = await login(SUPER_USER, SUPER_PASS)
    const crossPatch = await api(gaAdmin.token, `/ga-admin/delegates/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'inactive' }),
    })
    assertStatus('patch own step', crossPatch.status, 200)

    const otherDelegates = await api(superSession.token, '/admin/delegates')
    const otherGaStaff = (Array.isArray(otherDelegates.json) ? otherDelegates.json : []).find(
      (d) => d.role === 'GA_STAFF' && Number(d.ga_id) !== Number(gaAdmin.gaId),
    )
    if (otherGaStaff) {
      const crossList = await api(gaAdmin.token, '/ga-admin/delegates')
      const ids = (Array.isArray(crossList.json) ? crossList.json : []).map((d) => String(d.id))
      if (ids.includes(String(otherGaStaff.id))) {
        throw new Error('cross-GA delegate visible in ga-admin list')
      }
      const crossPatchOther = await api(gaAdmin.token, `/ga-admin/delegates/${encodeURIComponent(otherGaStaff.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'inactive' }),
      })
      assertStatus('cross-GA patch delegate', crossPatchOther.status, [403, 404])
      report.steps.push('cross_ga_delegate_blocked')
    } else {
      report.steps.push('cross_ga_delegate_skipped_no_other_ga')
    }

    report.steps.push('complete')
  } catch (e) {
    report.ok = false
    report.errors.push(e instanceof Error ? e.message : String(e))
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main()
