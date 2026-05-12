#!/usr/bin/env node
/**
 * 슈퍼관리 Bearer JWT 로 dev/prod 같은-origin API에 주류 동적 고객 템플릿을 생성·(선택) 테넌트 연결합니다.
 *
 * 비밀번호·토큰은 파일로 저장하지 않습니다. 다음 중 하나만 사용하세요:
 * - 환경변수 INSURANCE_DEV_ADMIN_JWT
 * - argv[4] 에 일회 문자열(JWT). 셸 히스토리 위험이 있으면 환경변수 우선을 권장합니다.
 *
 * 사용:
 *   $env:INSURANCE_DEV_ADMIN_JWT="<jwt>"
 *   node scripts/dev-push-liquor-dynamic-crm-template.mjs https://insurance-dev.up.railway.app [--tenant=id] [--force-new]
 *
 * 기본 동작: 같은 industry_code 에 동일 이름(주류회사 고객관리 템플릿)의 active 행이 있으면 POST 하지 않고 그 id 로 종료합니다.
 * --force-new 가 있으면 항상 POST 로 신규 행을 추가합니다.
 */

import process from 'node:process'

const origin = process.argv[2]?.replace(/\/$/, '')
const tokenRaw = process.env.INSURANCE_DEV_ADMIN_JWT ?? process.argv[4] ?? ''

const tenantFlag = process.argv.find((x) => x.startsWith('--tenant='))
const tenantId = tenantFlag ? Number(tenantFlag.slice('--tenant='.length).trim()) : NaN
const forceNew = process.argv.includes('--force-new')

if (!origin?.startsWith('http')) {
  console.error('사용법: node scripts/dev-push-liquor-dynamic-crm-template.mjs <origin> [--tenant=id]')
  console.error('  예: https://insurance-dev.up.railway.app')
  process.exit(1)
}

const token = String(tokenRaw ?? '').trim()
if (!token) {
  console.error('INSURANCE_DEV_ADMIN_JWT 환경변수 또는 argv[4] 에 JWT 필요')
  process.exit(1)
}

const base = `${origin.replace(/\/$/, '')}/backend`

const fixtureMod = await import('../server/crm/fixtures/liquorCompanyDynamicCrmTemplateBody.js')
const body = fixtureMod.buildLiquorCompanyDynamicCrmTemplateBody()
const wantName = String(body.name ?? '').trim()
const wantIc = String(body.industry_code ?? '').trim().toLowerCase()

async function fetchJson(url, init) {
  const method = init?.method ?? 'GET'
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(init.headers && typeof init.headers === 'object' ? init.headers : {}),
  }
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = typeof json?.message === 'string' ? json.message : res.statusText
    throw new Error(`${method} ${url} failed: ${res.status} ${msg}`)
  }
  return json
}

/** @returns {unknown[]|null} */
function extractList(payload) {
  const d = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.data : payload
  return Array.isArray(d) ? d : null
}

let id /** @type {number} */

if (!forceNew) {
  const listUrl = `${base}/admin/platform/crm-customer-management-templates?industry_code=${encodeURIComponent(wantIc)}`
  const listed = await fetchJson(listUrl, { method: 'GET' })
  const rows = extractList(listed) ?? []
  const hit = rows.find((r) => {
    if (!r || typeof r !== 'object') return false
    const o = /** @type {Record<string, unknown>} */ (r)
    const nm = String(o.name ?? '').trim()
    const ic = String(o.industry_code ?? o.industryCode ?? '').trim().toLowerCase()
    const st = String(o.status ?? '').trim().toLowerCase()
    return nm === wantName && ic === wantIc && st === 'active'
  })
  if (hit && typeof hit === 'object') {
    const rawId = /** @type {Record<string, unknown>} */ (hit).id
    const n = typeof rawId === 'number' ? rawId : Number(rawId)
    if (Number.isInteger(n) && n > 0) {
      id = n
      console.log('기존 활성 템플릿 재사용 — id=', id)
    }
  }
}

if (id === undefined) {
  const created = await fetchJson(`${base}/admin/platform/crm-customer-management-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const row = created?.data?.row
  const nid = typeof row?.id === 'number' ? row.id : Number(row?.id)
  if (!Number.isInteger(nid) || nid < 1) {
    console.error('응답에 템플릿 id 없음:', created)
    process.exit(2)
  }
  id = nid
  console.log('생성 완료 crm_customer_management_templates id=', id)
}

if (!(Number.isInteger(id) && id > 0)) {
  console.error('템플릿 id 를 결정하지 못했습니다.')
  process.exit(2)
}

if (Number.isInteger(tenantId) && tenantId > 0) {
  const patched = await fetchJson(`${base}/admin/platform/tenants/${tenantId}/crm-customer-template`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm_customer_template_id: id }),
  })
  console.log('테넌트 연결:', patched?.data)
}
