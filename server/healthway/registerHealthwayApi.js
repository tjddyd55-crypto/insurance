import express from 'express'
import { randomUUID } from 'node:crypto'
import { healthwayConfig, assertConfigured, failure } from './config.js'
import { newToken, tokenHash } from './crypto.js'
import { createAdapterClient } from './adapterClient.js'
import { assertCustomerOwnedByScope, resolveSmsAuthContext } from '../sms/smsScope.js'
import { scopeValues, SCOPE, scopeOf, transaction, byToken, requestById, checkLink, checkCallback, transition, publicRequest } from './repository.js'
import { bootstrap, completeOfflineFlow, revokeConnection, termsAgreements } from './flow.js'
import { healthwaySmsPreview } from './smsAdapter.js'
import { analyze } from './rules.js'
import { lookupKcd, searchKcd, diagnosisCandidates } from './kcd.js'
import { createCertificationCallback } from './callback.js'

/** No payloads, URLs, PII or secrets are logged by this module, including on unexpected DB/SDK errors. */
export function registerHealthwayApi(apiRouter, { pool, requireAuth, config = healthwayConfig(), adapter = createAdapterClient(config) }) {
  const router = express.Router(), buckets = new Map()
  // Public browser redirect, ahead of JSON parsing/auth/rate-limit middleware. The callback owns
  // its configuration gate, HTML errors, rate limit and bounded access/error logs.
  router.all('/callback/cert', createCertificationCallback({ pool, adapter, config }))
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
    if (!config.enabled) return res.status(404).json({ code: 'module_disabled' })
    try { assertConfigured(config) } catch (err) { return res.status(err.status || 503).json({ code: err.code, message: '건강정보 오프라인 모듈 설정이 필요합니다.' }) }
    // Single-process limit; shared DB attempt caps below also protect callback/start across instances.
    const key = tokenHash(req.ip || req.socket.remoteAddress || 'unknown'), now = Date.now()
    for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k)
    if (buckets.size > 10000) return res.status(429).json({ code: 'rate_limited' })
    const b = buckets.get(key) || { count: 0, until: now + 60000 }; b.count++; buckets.set(key, b)
    if (b.count > 90) return res.status(429).json({ code: 'rate_limited' })
    next()
  })
  router.use(express.json({ limit: '64kb' }))
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res) } catch (err) {
      const known = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
      res.status(known ? err.status : 500).json({ code: known ? (err.code || 'scope_denied') : 'healthway_request_failed',
        message: known && err.status === 410 ? '만료되거나 취소된 요청입니다.' : '건강정보 요청을 처리할 수 없습니다. 요청 상태를 확인해 주세요.' })
    }
  }
  const scope = async (req) => {
    if (!['USER', 'GA_ADMIN', 'GA_STAFF', 'SUPER_ADMIN'].includes(req.user?.role)) throw failure(403, 'fc_access_required')
    const customerId = Number(req.params.customerId)
    const s = await resolveSmsAuthContext(pool, req)
    await assertCustomerOwnedByScope(pool, { ...s, customerId })
    // Resolve GA from the authenticated owner's DB row; never trust customer/GA from request body.
    const user = (await pool.query('SELECT ga_id FROM users WHERE id=$1', [s.userId])).rows[0]
    if (!user?.ga_id || (s.gaId != null && String(user.ga_id) !== String(s.gaId))) throw failure(403, 'ga_scope_mismatch')
    return { ownerUserId: s.userId, gaId: user.ga_id, customerId }
  }
  const fc = '/customers/:customerId'
  router.get('/availability', requireAuth, wrap(async (_req, res) => { res.json({ enabled: true, provider: config.provider, mock: true, offlineAsOfDate: config.asOf }) }))
  router.post(`${fc}/requests`, requireAuth, wrap(async (req, res) => {
    const s = await scope(req), sources = req.body.sources
    if (!Array.isArray(sources) || !sources.length || sources.some((x) => !['NHIS', 'HIRA'].includes(x)) || new Set(sources).size !== sources.length || typeof req.body.medical !== 'boolean') throw failure(400, 'invalid_sources')
    const token = newToken(), id = randomUUID(), expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const timeline = [{ status: 'created', at: new Date().toISOString() }]
    await pool.query(`INSERT INTO healthway_requests(id,owner_user_id,ga_id,customer_id,token_hash,expires_at,sources,medical,timeline)
      VALUES($4,$1,$2,$3,$5,$6,$7,$8,$9)`, [...scopeValues(s), id, tokenHash(token), expiresAt, JSON.stringify(sources), req.body.medical, JSON.stringify(timeline)])
    res.status(201).json({ request: { id, status: 'created', sources, medical: req.body.medical, expiresAt, timeline },
      linkPath: `/health-connect/${token}`, mock: true })
  }))
  router.get(`${fc}/requests`, requireAuth, wrap(async (req, res) => {
    const s = await scope(req), result = await pool.query(`SELECT * FROM healthway_requests WHERE ${SCOPE} ORDER BY created_at DESC LIMIT 30`, scopeValues(s))
    res.json({ requests: result.rows.map(publicRequest), offlineAsOfDate: config.asOf, mock: true })
  }))
  router.get(`${fc}/requests/:id`, requireAuth, wrap(async (req, res) => { res.json({ request: publicRequest(await requestById(pool, await scope(req), req.params.id)) }) }))
  router.post(`${fc}/requests/:id/cancel`, requireAuth, wrap(async (req, res) => {
    const s = await scope(req)
    await transaction(pool, async (db) => {
      const row = await requestById(db, s, req.params.id, true)
      if (row.status === 'completed') throw failure(409, 'completed_use_revoke')
      if (row.status !== 'cancelled') await transition(db, row, 'cancelled', { cancelled_at: new Date() })
    }); res.json({ status: 'cancelled' })
  }))
  router.post(`${fc}/revoke`, requireAuth, wrap(async (req, res) => {
    const s = await scope(req)
    await transaction(pool, async (db) => {
      // Revoke outstanding links as well; a processing callback cannot restore the connection afterward.
      const rows = await db.query(`SELECT * FROM healthway_requests WHERE ${SCOPE} ORDER BY id FOR UPDATE`, scopeValues(s))
      for (const row of rows.rows) await transition(db, row, 'revoked', { revoked_at: new Date() })
      await revokeConnection(db, adapter, config, s)
    }); res.json({ status: 'revoked' })
  }))
  router.post(`${fc}/requests/:id/sms-preview`, requireAuth, wrap(async (req, res) => {
    const s = await scope(req), row = await requestById(pool, s, req.params.id)
    checkLink(row)
    const path = req.body.linkPath
    if (typeof path !== 'string' || !/^\/health-connect\/[A-Za-z0-9_-]{43}$/.test(path) || tokenHash(path.split('/').at(-1)) !== row.token_hash) throw failure(403, 'link_binding_mismatch')
    // Return a relative-link preview; browser adds its same-origin public host. Never accept an arbitrary destination URL.
    res.json(healthwaySmsPreview(path))
  }))
  async function snapshot(s) {
    const [rows, coverage, master, groups] = await Promise.all([
      pool.query(`SELECT normalized FROM healthway_records WHERE ${SCOPE} ORDER BY fetched_at,id`, scopeValues(s)),
      pool.query(`SELECT coverage FROM healthway_source_coverage WHERE ${SCOPE}`, scopeValues(s)),
      pool.query('SELECT * FROM disease_code_master WHERE active=true ORDER BY version DESC'),
      pool.query('SELECT * FROM healthway_disease_groups WHERE active=true'),
    ])
    const records = rows.rows.map((r) => r.normalized)
    for (const r of records) {
      if (r.kcdCodeRaw) r.kcd = lookupKcd(r.kcdCodeRaw, r.sourceDisplay, master.rows)
      if (r.kind === 'visit') r.diagnosisCandidates = diagnosisCandidates(r, records.filter((r) => r.datasetCode === '1004'))
    }
    return { records, coverage: coverage.rows.map((r) => r.coverage), kcdMaster: master.rows, diseaseGroups: groups.rows }
  }
  router.get(`${fc}/records`, requireAuth, wrap(async (req, res) => {
    const data = await snapshot(await scope(req))
    if (req.query.source && !['NHIS_PUBLIC', 'HIRA_PUBLIC', 'MEDICAL_INSTITUTION'].includes(req.query.source)) throw failure(400, 'invalid_source')
    res.json({ records: req.query.source ? data.records.filter((r) => r.source === req.query.source) : data.records,
      coverage: req.query.source ? data.coverage.filter((r) => r.source === req.query.source) : data.coverage,
      mock: true, offlineAsOfDate: config.asOf })
  }))
  router.get(`${fc}/analysis`, requireAuth, wrap(async (req, res) => {
    const data = await snapshot(await scope(req)), rules = (await pool.query('SELECT * FROM disclosure_rules WHERE enabled=true ORDER BY rule_code')).rows
    res.json({ results: analyze({ ...data, rules, asOf: config.asOf }), evidence: data.records, mock: true, offlineAsOfDate: config.asOf, label: '고지 확인 후보 · 실제 고지의무 확정 판정 아님' })
  }))
  router.get(`${fc}/kcd-search`, requireAuth, wrap(async (req, res) => {
    await scope(req); const query = String(req.query.q || '').slice(0, 100)
    const rows = (await pool.query('SELECT * FROM disease_code_master WHERE active=true ORDER BY version DESC')).rows
    res.json({ matches: query ? searchKcd(rows, query).slice(0, 50) : [] })
  }))
  router.get('/public/:token', wrap(async (req, res) => {
    let request
    await transaction(pool, async (db) => {
      request = checkLink(await byToken(db, req.params.token, true), { allowCompleted: true })
      if (request.status === 'created') request = await transition(db, request, 'opened')
    })
    // Only masked name is sent to the bearer-link page. No DOB, CI, user numbers, tokens, records.
    const s = scopeOf(request)
    const customer = (await pool.query('SELECT name FROM customers WHERE id=$1 AND user_id=$2 AND EXISTS(SELECT 1 FROM users WHERE id=$2 AND ga_id=$3)', [s.customerId, s.ownerUserId, s.gaId])).rows[0]
    if (!customer) throw failure(404, 'customer_not_found')
    const name = String(customer.name || '고객'), maskedName = name.length > 1 ? name[0] + '*'.repeat(name.length - 1) : '*'
    const metadata = request.status === 'completed' ? {} : await bootstrap(adapter)
    res.json({ request: publicRequest(request), maskedName, ...metadata, mock: true, offlineAsOfDate: config.asOf, label: 'DEV MOCK · 실제 본인인증·건강정보 조회 없음' })
  }))
  router.post('/public/:token/start', wrap(async (req, res) => {
    const consent = req.body
    if (consent.terms !== true || !Array.isArray(consent.institutions) || typeof consent.isJoinPhr !== 'boolean' || typeof consent.isJoinPortal !== 'boolean') throw failure(400, 'consent_required')
    const meta = await bootstrap(adapter)
    let result
    await transaction(pool, async (db) => {
      let row = checkLink(await byToken(db, req.params.token, true))
      if (!['opened', 'auth_pending'].includes(row.status) || row.attempt_count >= 3) throw failure(409, 'start_not_allowed')
      if (row.sources.some((s) => !consent.institutions.includes(s)) || consent.institutions.some((s) => !row.sources.includes(s)) || (row.medical && consent.medical !== true)) throw failure(400, 'institution_consent_required')
      if (row.sources.includes('HIRA') && typeof consent.sensitiveInformation !== 'boolean') throw failure(400, 'sensitive_information_choice_required')
      const nonce = newToken(), dealings = randomUUID()
      const certification = await adapter.certification({ mockAuthPath: `/health-connect/${req.params.token}/mock-auth`, demandDealingsNo: dealings,
        unitySubscription: { demandDealingsNo: dealings, userTermsAgreementList: termsAgreements(meta.terms, row.sources, row.medical), joinPhr: consent.isJoinPhr, joinPortal: consent.isJoinPortal } })
      row = await transition(db, row, 'consented', { consents: { institutions: consent.institutions, terms: true, medical: row.medical,
        sensitiveInformation: consent.sensitiveInformation === true, isJoinPhr: consent.isJoinPhr, isJoinPortal: consent.isJoinPortal } })
      await transition(db, row, 'auth_pending', { binding_nonce_hash: tokenHash(nonce), demand_dealings_no: dealings, attempt_count: row.attempt_count + 1 })
      result = { mockAuthPath: certification.apiUrl, nonce, demandDealingsNo: dealings, mock: true }
    }); res.json(result)
  }))
  router.post('/public/:token/mock-auth', wrap(async (req, res) => {
    // This route is mounted only behind assertConfigured(offline && !production).
    let claimed
    await transaction(pool, async (db) => {
      const row = await byToken(db, req.params.token, true)
      checkCallback(row, req.body.nonce, req.body.demandDealingsNo)
      claimed = await transition(db, row, 'processing', { callback_used_at: new Date() })
    })
    res.json(await completeOfflineFlow(pool, adapter, config, claimed))
  }))
  // Parse errors are sanitized here instead of reaching the application's generic logger.
  router.use((_err, _req, res, _next) => res.status(400).json({ code: 'invalid_healthway_request' }))
  apiRouter.use('/healthway', router)
}
