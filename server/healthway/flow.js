import { randomUUID } from 'node:crypto'
import { encrypt, decrypt, newToken } from './crypto.js'
import { failure } from './config.js'
import { sourceCoverage, shiftMonths, isoDate } from './coverage.js'
import { scopeOf, scopeValues, SCOPE, transaction, requestById, transition } from './repository.js'
const nowText = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const nowDate = () => new Date().toISOString().slice(0, 10)
export const cipherContext = (s) => `healthway:v1:${s.ownerUserId}:${s.gaId}:${s.customerId}`
export async function bootstrap(adapter) {
  const [terms, unity, datasets, institutions] = await Promise.all([
    adapter.sdk('0003', [null]), adapter.sdk('0220', [null]), adapter.sdk('0005', [null]), adapter.sdk('0187', [null]),
  ])
  return { terms: terms.data, unityTerms: unity.data, datasets: datasets.data, institutions: institutions.data }
}
export function certificationCase(cert) {
  if (!cert.match) return 'CASE4'
  if (cert.joinUtilizationService === true || cert.isJoinUtilizationService === true) return 'CASE3'
  return cert.mymdResult === '200' ? 'CASE1' : 'CASE2'
}
export function termsAgreements(terms, sources, medical) {
  const selected = new Set(['10', ...(sources.includes('NHIS') ? ['31'] : []), ...(sources.includes('HIRA') ? ['30'] : []), ...(medical ? ['20'] : [])])
  return terms.map((t) => ({ termsNo: t.termsNo, termsVersionNo: t.termsVersionNo,
    agreementStatus: selected.has(t.agreementSystemDivisionCode) ? 'AGREEMENT' : 'NONE', agreementDateTime: nowText() }))
}
function institutionPlan(meta, request) {
  const publicPlans = request.sources.map((source) => {
    const wanted = source === 'NHIS' ? ['2001', '2002'] : ['2004']
    const institution = meta.institutions.find((i) => wanted.every((code) => i.publicProvideInstitutionDatasetList.some((d) => d.datasetCode === code)))
    if (!institution) throw failure(503, 'official_institution_not_available')
    return { source: source === 'NHIS' ? 'NHIS_PUBLIC' : 'HIRA_PUBLIC', institutionNo: institution.provideInstitutionNo,
      datasets: wanted, institutionName: institution.provideInstitutionName }
  })
  // The 0205 official sample does not include a usable provider Organization. For offline ONLY a marked
  // mock institution identifier is generated; approved real careInstitutionSign/provideInstitutionNo must come from configuration.
  if (request.medical) publicPlans.push({ source: 'MEDICAL_INSTITUTION', institutionNo: `MOCK-${randomUUID()}`, careInstitutionSign: `MOCK-${randomUUID()}`, datasets: ['1004', '1010'], institutionName: 'MOCK 의료기관 (공식 샘플)' })
  return publicPlans
}
export async function completeOfflineFlow(pool, adapter, config, request) {
  const scope = scopeOf(request), context = cipherContext(scope)
  let cert, certCase
  try {
    // SDK offline 0201 ignores encrypted input and returns its official static sample. Its dealings number
    // is NOT this request's binding. Node already validated OUR nonce + dealings (mock-auth) or
    // signed DEV callback + dealings (callback/cert) before claiming the request.
    const decoded = await adapter.sdk('0201', [`MOCK-${newToken()}`, `MOCK-${newToken()}`])
    cert = decoded.data; certCase = certificationCase(cert)
    if (certCase === 'CASE2' || certCase === 'CASE4') throw failure(409, 'mock_certification_failed')
    const user = await adapter.sdk('0002', [cert.utilizationUserNo, cert.connectingInformation, cert.introPath === '22' ? '40' : '30'])
    const credentials = { utilizationUserNo: cert.utilizationUserNo, connectingInformation: cert.connectingInformation, token: user.data.access_token,
      tokenExpiry: user.data.validity_date_time, mock: true, sampleDemandDealingsNo: cert.demandDealingsNo }
    if (!credentials.token) throw failure(503, 'sdk_user_token_missing')
    const meta = await bootstrap(adapter), plans = institutionPlan(meta, request)
    const selectedDatasets = new Set(plans.flatMap((p) => p.datasets))
    // PG-SDK-0012 requires ALL offered datasets in each provision division, including NONE.
    for (const group of meta.datasets) {
      await adapter.sdk('0012', [{ utilizationUserNo: credentials.utilizationUserNo, userYN: 'Y', provisionDivisionCode: group.provisionDivisionCode,
        userDatasetAgreementList: group.datasetList.map((d) => ({ agreementSystemDivisionCode: d.agreementSystemDivisionCode,
          datasetCode: d.datasetCode, agreementStatus: selectedDatasets.has(d.datasetCode) ? 'AGREEMENT' : 'NONE', agreementDateTime: nowText() })) }], credentials.token)
    }
    const collected = [], demands = []
    for (const plan of plans) {
      const consent = JSON.stringify({ label: 'MOCK 전송요구', institution: plan.institutionName, datasets: plan.datasets, regular: false, thirdParty: false })
      const signature = await adapter.signature({ consent })
      if (signature.mock !== true) throw failure(503, 'mock_signature_required')
      const demandInput = { utilizationUserNo: credentials.utilizationUserNo, agreementDate: nowDate(),
        transmissionDemandPurpose: 'MOCK 오프라인 고지 확인 후보 테스트', thirdPartyProvisionAgreementYN: 'N', regularTransferYN: 'N',
        transmissionDemandAgreementDateTime: nowText(), transmissionDemandAgreementEndDate: shiftMonths(nowDate(), 1),
        holdUtilizationPeriod: shiftMonths(nowDate(), 1), provideInstitutionNo: plan.institutionNo, datasetCodeList: plan.datasets,
        consent, utilizationUserName: cert.userName, connectingInformation: cert.connectingInformation,
        ...Object.fromEntries(['caCode', 'signClientId', 'contentId', 'signedContent', 'txId', 'siteTxId'].map((k) => [k, signature[k]])), userIp: '127.0.0.1' }
      const demand = (await adapter.sdk('0199', [demandInput], credentials.token)).data
      if (!demand.accessToken || !demand.refreshToken) throw failure(503, 'sdk_demand_token_missing')
      // Official 0199 offline sample always echoes one fixed institution/tx. Keep the response inside
      // encrypted token data; plan carries the consented institution. Do not pretend the sample is live.
      demands.push({ plan, demand })
      const search = { utilizationUserNo: credentials.utilizationUserNo, apiType: '02' }
      for (const dataset of plan.datasets) {
        if (dataset === '1010') continue // 0205 asks for both; sample contains no Procedure.
        const id = { '2001': '0206', '2002': '0207', '2004': '0219', '1004': '0205' }[dataset]
        const params = dataset === '2002' ? { ...search, beginningDate: shiftMonths(config.asOf, -14), endDate: shiftMonths(config.asOf, -2) } :
          dataset === '2004' ? { ...search, sensitiveInformationProvisionYn: request.consents.sensitiveInformation ? 'Y' : 'N' } :
            dataset === '1004' ? { ...search, careInstitutionSign: plan.careInstitutionSign, beginningDate: shiftMonths(config.asOf, -12), endDate: config.asOf, datasetCodeList: ['1004', '1010'] } : search
        const result = await adapter.sdk(id, [params], demand.accessToken)
        for (const record of result.records || []) {
          if (!plan.datasets.includes(record.datasetCode) || record.source !== plan.source) throw failure(503, 'adapter_source_mismatch')
          // Offline SDK returns static data regardless of query dates. Enforce documented public windows locally.
          const date = isoDate(record.date)
          if (record.datasetCode === '2002' && (!date || date < params.beginningDate || date > params.endDate)) continue
          if (record.datasetCode === '2001' && (!date || date < shiftMonths(config.asOf, -120) || date > config.asOf)) continue
          collected.push(record)
        }
      }
    }
    await transaction(pool, async (db) => {
      // Serialize connection replacement per owner+GA+customer, including first insert.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [context])
      const current = await requestById(db, scope, request.id, true)
      if (current.status !== 'processing' || current.cancelled_at || current.revoked_at) throw failure(409, 'request_no_longer_active')
      const existing = await db.query(`SELECT id FROM healthway_connections WHERE ${SCOPE} FOR UPDATE`, scopeValues(scope))
      const connectionId = existing.rows[0]?.id || randomUUID()
      await db.query(`INSERT INTO healthway_connections(id,owner_user_id,ga_id,customer_id,credentials_encrypted,source_status)
        VALUES($4,$1,$2,$3,$5,$6) ON CONFLICT(owner_user_id,ga_id,customer_id) DO UPDATE SET
        credentials_encrypted=EXCLUDED.credentials_encrypted,source_status=EXCLUDED.source_status,revoked_at=NULL,connected_at=NOW()`,
      [...scopeValues(scope), connectionId, encrypt(credentials, config.tokenKey, context), JSON.stringify(Object.fromEntries(plans.map((p) => [p.source, 'connected'])))])
      for (const table of ['healthway_records', 'healthway_source_coverage', 'healthway_transmission_demands']) await db.query(`DELETE FROM ${table} WHERE ${SCOPE} AND connection_id=$4`, [...scopeValues(scope), connectionId])
      for (const { plan, demand } of demands) {
        await db.query(`INSERT INTO healthway_transmission_demands(id,connection_id,owner_user_id,ga_id,customer_id,source,provide_institution_no,
          transmission_demand_id,tokens_encrypted,access_token_expires_at,refresh_token_expires_at,dataset_consents)
          VALUES($4,$5,$1,$2,$3,$6,$7,$8,$9,$10,$11,$12)`,
        [...scopeValues(scope), randomUUID(), connectionId, plan.source, plan.institutionNo, demand.transmissionDemandId,
          encrypt(demand, config.tokenKey, context), demand.accessTokenExpireDateTime, demand.refreshTokenExpireDateTime, JSON.stringify(plan.datasets)])
      }
      for (const record of collected) {
        const { rawResource, rawContext, ...normalized } = record
        // Persist a connection-specific opaque evidence ID so future snapshots never collide.
        normalized.id = randomUUID(); normalized.sourceRef = record.id
        await db.query(`INSERT INTO healthway_records(id,connection_id,owner_user_id,ga_id,customer_id,source,dataset_code,normalized,raw_encrypted)
          VALUES($4,$5,$1,$2,$3,$6,$7,$8,$9)`, [...scopeValues(scope), normalized.id, connectionId, record.source, record.datasetCode,
        JSON.stringify(normalized), encrypt({ rawResource, rawContext }, config.tokenKey, `${context}:record:${normalized.id}`)])
      }
      const coverage = sourceCoverage(collected, config.asOf).filter((c) => selectedDatasets.has(c.datasetCode))
      for (const c of coverage) await db.query(`INSERT INTO healthway_source_coverage(connection_id,owner_user_id,ga_id,customer_id,source,dataset_code,coverage)
        VALUES($4,$1,$2,$3,$5,$6,$7)`, [...scopeValues(scope), connectionId, c.source, c.datasetCode, JSON.stringify(c)])
      let state = await transition(db, current, 'authenticated')
      state = await transition(db, state, 'dataset_consented'); state = await transition(db, state, 'signed_mock')
      await transition(db, state, 'completed', { completed_at: new Date() })
    })
    return { status: 'completed', mock: true, label: 'DEV MOCK 완료 · 실제 건강정보 조회 없음' }
  } catch (err) {
    await transaction(pool, async (db) => {
      const current = await requestById(db, scope, request.id, true)
      if (current.status === 'processing') await transition(db, current, 'failed')
    })
    // CASE1 rollback hook: official PG-SDK-0051. Best effort only, never expose SDK exception details.
    if (certCase === 'CASE1' && cert?.utilizationUserNo) {
      try { await adapter.sdk('0051', [cert.utilizationUserNo, nowText()]) } catch { /* Offline failure remains retryable only via new request. */ }
    }
    throw err
  }
}
export async function revokeConnection(db, adapter, config, scope) {
  const c = (await db.query(`SELECT * FROM healthway_connections WHERE ${SCOPE} FOR UPDATE`, scopeValues(scope))).rows[0]
  if (!c || c.revoked_at) return
  const context = cipherContext(scope), credentials = decrypt(c.credentials_encrypted, config.tokenKey, context)
  const demands = (await db.query(`SELECT * FROM healthway_transmission_demands WHERE ${SCOPE} AND connection_id=$4 AND revoked_at IS NULL`, [...scopeValues(scope), c.id])).rows
  for (const demand of demands) {
    const tokens = decrypt(demand.tokens_encrypted, config.tokenKey, context)
    await adapter.sdk('0203', [{ utilizationUserNo: credentials.utilizationUserNo, txId: tokens.txId, revokeToken: tokens.refreshToken, recantationDate: nowDate() }], credentials.token)
  }
  await adapter.sdk('0008', [credentials.utilizationUserNo, nowText()], credentials.token)
  await db.query(`UPDATE healthway_transmission_demands SET revoked_at=NOW(),status='revoked' WHERE ${SCOPE} AND connection_id=$4`, [...scopeValues(scope), c.id])
  await db.query(`UPDATE healthway_connections SET revoked_at=NOW(),source_status='{}' WHERE ${SCOPE} AND id=$4`, [...scopeValues(scope), c.id])
  // Retain neither sensitive records nor reusable tokens after a full offline disconnect.
  for (const table of ['healthway_records', 'healthway_source_coverage', 'healthway_transmission_demands']) await db.query(`DELETE FROM ${table} WHERE ${SCOPE} AND connection_id=$4`, [...scopeValues(scope), c.id])
  await db.query(`DELETE FROM healthway_connections WHERE ${SCOPE} AND id=$4`, [...scopeValues(scope), c.id])
}
