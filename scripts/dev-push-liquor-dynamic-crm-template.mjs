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
 *   node scripts/dev-push-liquor-dynamic-crm-template.mjs https://insurance-dev.up.railway.app [--tenant=N]
 *
 * --tenant=N 이 있으면 PATCH /backend/admin/platform/tenants/:id/crm-customer-template
 */

import process from 'node:process'

const origin = process.argv[2]?.replace(/\/$/, '')
const tokenRaw = process.env.INSURANCE_DEV_ADMIN_JWT ?? process.argv[4] ?? ''

const tenantFlag = process.argv.find((x) => x.startsWith('--tenant='))
const tenantId = tenantFlag ? Number(tenantFlag.slice('--tenant='.length).trim()) : NaN

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

const created = await fetchJson(`${base}/admin/platform/crm-customer-management-templates`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const row = created?.data?.row
const id = typeof row?.id === 'number' ? row.id : Number(row?.id)
if (!Number.isInteger(id) || id < 1) {
  console.error('응답에 템플릿 id 없음:', created)
  process.exit(2)
}

console.log('생성 완료 crm_customer_management_templates id=', id)

if (Number.isInteger(tenantId) && tenantId > 0) {
  const patched = await fetchJson(`${base}/admin/platform/tenants/${tenantId}/crm-customer-template`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm_customer_template_id: id }),
  })
  console.log('테넌트 연결:', patched?.data)
}
