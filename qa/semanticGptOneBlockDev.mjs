/**
 * DEV: single synthetic unstructured cell → unstructured-extract (GPT diagnostic).
 */
import XLSX from 'xlsx'

const BASE = process.env.DEV_API_BASE ?? 'https://insurance-dev.up.railway.app'

async function login() {
  const password = process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD
  if (!password) throw new Error('INSURANCE_GA_QA_BOOTSTRAP_PASSWORD missing')
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'qa_ai_user', password }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`login ${res.status}`)
  return body.token
}

async function api(token, method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(`${method} ${urlPath} ${res.status}`), { body: json })
  return json
}

function buildSyntheticXlsx() {
  const cell =
    '홍길동\n핸드폰번호: 010-5555-6666\n주소: 서울 마포구 합정동\n직업: 회사원\n메모: 소개받음\n삼성전자 근무 (미분류)'
  const row = new Array(85).fill('')
  row[0] = cell
  const ws = XLSX.utils.aoa_to_sheet([row])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '고객정보')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

async function main() {
  const token = await login()
  const buf = buildSyntheticXlsx()
  const form = new FormData()
  form.append('file', new Blob([buf]), 'semantic-gpt-smoke.xlsx')
  const analyze = await api(token, 'POST', '/api/ai/customer-import/sessions', form)
  const sid = analyze.importSessionId
  const extract = await api(token, 'POST', '/api/ai/customer-import/tools/execute', {
    toolKey: 'customer.import.unstructured-extract',
    input: { importSessionId: sid },
  })
  await api(token, 'POST', '/api/ai/customer-import/tools/execute', {
    toolKey: 'customer.import.normalize',
    input: { importSessionId: sid },
  })
  await api(token, 'POST', '/api/ai/customer-import/tools/execute', {
    toolKey: 'customer.import.duplicate-check',
    input: { importSessionId: sid },
  })
  await api(token, 'POST', '/api/ai/customer-import/tools/execute', {
    toolKey: 'customer.import.validation',
    input: { importSessionId: sid },
  })
  const preview = await api(token, 'POST', '/api/ai/customer-import/tools/execute', {
    toolKey: 'customer.import.preview',
    input: { importSessionId: sid },
  })
  const row = preview.rows?.[0]
  console.log(
    JSON.stringify(
      {
        stats: extract.stats,
        gptUsed: extract.gptUsed,
        openAiCalls: extract.openAiCalls,
        reasons: row?.reasons,
        warningsOnly: (row?.reasons ?? []).filter((r) => String(r).includes('OPENAI')),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e.message, e.body ?? '')
  process.exit(1)
})
