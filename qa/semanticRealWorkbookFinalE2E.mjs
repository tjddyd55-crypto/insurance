/**
 * Real workbook semantic E2E — Preview only (no commit). Password via env only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.DEV_API_BASE ?? 'https://insurance-dev.up.railway.app'
const XLSX =
  process.argv[2] ??
  'N:\\개인\\동기화폴더\\01. 고객관리 성과\\편집충돌_서버_01. 고객관리.xlsx'
const COMMIT = process.argv.includes('--commit')

const NAME_LEAK = /주민번호|핸드폰|전화번호|주소:|키\/몸무게|병력|수술|질병|\d{6}[-\s]?\d{7}/
const PHONE_IN_VALUE = /01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/
const ADDRESS_LABEL_LEAK = /주민번호|핸드폰|휴대|전화|키\s*\/\s*몸무게|직업|회사|병력|보험금/

function maskName(s) {
  const t = String(s ?? '').trim()
  if (t.length <= 1) return '*'
  if (t.length === 2) return t[0] + '*'
  return t[0] + '*'.repeat(Math.min(4, t.length - 2)) + t.slice(-1)
}

function maskPhone(s) {
  const d = String(s ?? '').replace(/\D/g, '')
  if (d.length < 8) return '***'
  return `${d.slice(0, 3)}****${d.slice(-4)}`
}

function auditAutoEligible(rows, sourceByRowId) {
  const auto = rows.filter((r) => r.eligibleForCommit)
  let nameLeakage = 0
  let rawBlockName = 0
  let addressLeakage = 0
  let phoneLeakage = 0
  for (const r of auto) {
    const name = String(r.mapped?.name ?? '')
    const address = String(r.mapped?.address ?? '')
    const phone = String(r.mapped?.phone ?? '')
    const source = sourceByRowId.get(r.rowId) ?? ''
    if (NAME_LEAK.test(name) || name.includes('\n')) {
      nameLeakage += 1
    }
    if (source && name.trim() === source.trim()) {
      rawBlockName += 1
    }
    if (ADDRESS_LABEL_LEAK.test(address) || PHONE_IN_VALUE.test(address) || /\d{6}[-\s]?\d{7}/.test(address)) {
      addressLeakage += 1
    }
    if (NAME_LEAK.test(phone) || (PHONE_IN_VALUE.test(phone) === false && phone.replace(/\D/g, '').length > 11)) {
      phoneLeakage += 1
    }
  }
  return { autoTotal: auto.length, nameLeakage, rawBlockName, addressLeakage, phoneLeakage }
}

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

async function executeTool(token, toolKey, input) {
  return api(token, 'POST', '/api/ai/customer-import/tools/execute', { toolKey, input })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForImportAnalysisJob(token, jobId, { timeoutMs = 900_000 } = {}) {
  const started = Date.now()
  let last
  while (Date.now() - started < timeoutMs) {
    last = await api(token, 'GET', `/api/ai/assistant/import-analysis-jobs/${jobId}`)
    if (last.status === 'PREVIEW_READY' || last.status === 'FAILED') {
      return last
    }
    await sleep(2000)
  }
  throw new Error(`job timeout jobId=${jobId} last=${last?.status ?? 'unknown'}`)
}

async function main() {
  const health = await fetch(`${BASE}/api/health`)
  console.log('[e2e] health', health.status)

  const token = await login()
  const before = await api(token, 'GET', '/api/customers?limit=1')
  const beforeCount = before?.total ?? before?.pagination?.total ?? '?'
  console.log('[e2e] customers_before', beforeCount)

  const buf = fs.readFileSync(XLSX)
  const form = new FormData()
  form.append('file', new Blob([buf]), path.basename(XLSX))
  const analyze = await api(token, 'POST', '/api/ai/customer-import/sessions', form)
  const importSessionId = analyze.importSessionId

  const jobStartMs = Date.now()
  const jobStart = await api(token, 'POST', `/api/ai/assistant/import-sessions/${importSessionId}/analyze`, {})
  console.log('[e2e] job_create_ms', Date.now() - jobStartMs, 'jobId', jobStart.jobId)
  const job = await waitForImportAnalysisJob(token, jobStart.jobId)
  console.log('[e2e] job_total_ms', Date.now() - jobStartMs, 'status', job.status)
  if (job.status === 'FAILED') {
    throw new Error(`analysis job failed: ${job.error?.code ?? 'unknown'}`)
  }
  const stats = job.stats?.unstructured ?? {}
  const preview = await executeTool(token, 'customer.import.preview', { importSessionId })
  const summary = preview.summary ?? {}
  const rows = preview.rows ?? []

  const sourceByRowId = new Map(
    rows.map((r) => [r.rowId, r.unstructuredMeta?.sourceCellText ?? '']),
  )
  const quality = auditAutoEligible(rows, sourceByRowId)

  const report = {
    blocksTotal: stats.blocksTotal,
    extractedRecords: rows.length,
    deterministicOnlyResolved: stats.deterministicOnlyResolved,
    semanticGptEligible: stats.semanticGptEligible,
    semanticGptPlanned: stats.semanticGptPlanned,
    semanticGptAttempts: stats.semanticGptAttempts,
    semanticGptSucceeded: stats.semanticGptSucceeded,
    semanticGptFailed: stats.semanticGptFailed,
    semanticGptCalls: stats.semanticGptCalls,
    semanticGptResolved: stats.semanticGptResolved,
    semanticGptLowConfidence: stats.semanticGptLowConfidence,
    semanticGptSkippedByLimit: stats.semanticGptSkippedByLimit,
    unresolvedAfterGpt: stats.unresolvedAfterGpt,
    reviewRequired: stats.reviewRequired,
    invalid: summary.invalid,
    autoEligible: quality.autoTotal,
    plannedCreate: summary.plannedCreate,
    plannedSkip: summary.plannedSkip,
    jobWarning: job.warning,
    jobProgress: job.progress,
    fieldQuality: quality,
    commitPerformed: false,
  }

  const auto = rows.filter((r) => r.eligibleForCommit)
  const samples = auto.slice(0, 25).map((r, idx) => ({
    idx,
    sourceCell: r.unstructuredMeta?.sourceCell,
    nameMasked: maskName(r.mapped?.name),
    phoneMasked: maskPhone(r.mapped?.phone),
    addressLen: (r.mapped?.address ?? '').length,
    job: r.mapped?.job ? String(r.mapped.job).slice(0, 20) : null,
    carNumber: r.mapped?.carNumber ? '***' : null,
    semanticGptUsed: r.unstructuredMeta?.semanticGptUsed,
    reasons: (r.reasons ?? []).slice(0, 6),
    verdict: NAME_LEAK.test(r.mapped?.name ?? '') ? 'FAIL' : 'PASS',
  }))

  console.log('[e2e] semantic_report', JSON.stringify(report, null, 2))
  console.log('[e2e] auto_eligible_samples', { count: samples.length, samples })

  const afterPreview = await api(token, 'GET', '/api/customers?limit=1')
  console.log('[e2e] customers_after_preview', afterPreview?.total ?? afterPreview?.pagination?.total)

  if (COMMIT) {
    throw new Error('Commit disabled in default script — use orchestrator E2E with explicit flag after manual PASS')
  }

  const outPath = path.join(__dirname, 'semanticRealWorkbookFinalE2E.out.json')
  fs.writeFileSync(outPath, JSON.stringify({ report, samples }, null, 2))
  console.log('[e2e] wrote', outPath)

  const gateFail =
    quality.nameLeakage > 0 ||
    quality.rawBlockName > 0 ||
    quality.addressLeakage > 0 ||
    quality.phoneLeakage > 0 ||
    (report.semanticGptSucceeded ?? 0) < 1
  if (gateFail) {
    process.exit(2)
  }
}

main().catch((e) => {
  console.error('[e2e] FAIL', e.message, e.body ?? '')
  process.exit(1)
})
