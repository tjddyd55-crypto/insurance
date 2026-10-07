import { safeQuery } from '../utils/dbSafeQuery.js'
import { resolveCustomerAddressRegion } from './addressRegion.js'
import { resolveCustomerGenderForSave } from '../lib/inferGenderFromResidentNumber.js'
import { normalizeBusinessInfoForDb } from '../lib/customerBusinessInfo.js'
import { normalizeInflowSourceForDb, normalizeReferrerNameForDb } from '../lib/customerInflowSource.js'
import { stringifyCrmExtensionForDb } from '../lib/customerCrmExtension.js'

function normalizeExpiryDate(value) {
  const s = String(value ?? '').trim()
  if (!s) {
    return ''
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`
  }
  return s.slice(0, 10)
}
import { resolveTenantByAuthenticatedLegacyGaId } from '../lib/resolveTenantByAuthenticatedLegacyGaId.js'

function calculateInsuranceInfoFromRrn(rrnRaw) {
  const digits = String(rrnRaw ?? '').replace(/\D/g, '')
  if (digits.length < 7) {
    return { age: null, nextAgeDate: null }
  }
  const yy = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const dd = Number(digits.slice(4, 6))
  const genderCode = Number(digits[6])
  const century = genderCode === 1 || genderCode === 2 || genderCode === 5 || genderCode === 6 ? 1900 : 2000
  const birthYear = century + yy
  const birth = new Date(birthYear, mm - 1, dd)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age -= 1
  }
  const nextAgeDate = new Date(birth)
  nextAgeDate.setFullYear(birth.getFullYear() + age + 1)
  return { age, nextAgeDate }
}

function nextAgeDateToSqlDate(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) {
    return null
  }
  return d.toISOString().slice(0, 10)
}

function normalizeCustomerNotesInput(raw) {
  if (raw == null) {
    return { items: [], insuranceHistory: '' }
  }
  if (typeof raw === 'object' && Array.isArray(raw.items)) {
    return {
      items: raw.items.map((n) => ({
        id: String(n.id ?? ''),
        content: String(n.content ?? ''),
        createdAt: String(n.createdAt ?? new Date().toISOString()),
      })),
      insuranceHistory: String(raw.insuranceHistory ?? ''),
    }
  }
  const memo = String(raw ?? '').trim()
  if (!memo) {
    return { items: [], insuranceHistory: '' }
  }
  return {
    items: [{ id: 'import-memo', content: memo, createdAt: new Date().toISOString() }],
    insuranceHistory: '',
  }
}

/**
 * AI Import commit — authenticated 고객 INSERT (POST /customers 와 동일 필드·권한 모델).
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function insertCustomerForImport(executor, { userId, gaId, authUser, data }) {
  const name = String(data.name ?? '').trim()
  if (!name) {
    const error = new Error('이름은 필수입니다')
    // @ts-expect-error custom
    error.httpStatus = 400
    throw error
  }

  let custTenantId = Number(authUser?.customerTenantDbId)
  if (!Number.isSafeInteger(custTenantId) || custTenantId < 1) {
    const tenantResolved = await resolveTenantByAuthenticatedLegacyGaId(executor, {
      legacyGaId: gaId,
      authUser,
    })
    if (!tenantResolved.ok) {
      const error = new Error(tenantResolved.message)
      // @ts-expect-error custom
      error.httpStatus = tenantResolved.status
      throw error
    }
    custTenantId = tenantResolved.tenantId
  }

  const ssn = String(data.ssn ?? '').trim()
  const { age: insuranceAge, nextAgeDate: nextAgeDateObj } = calculateInsuranceInfoFromRrn(ssn)
  const gender = resolveCustomerGenderForSave(data.gender, ssn)
  const notes = normalizeCustomerNotesInput(data.notes ?? data.memo)
  const addressText = String(data.address ?? '').trim()
  const addressRegion = resolveCustomerAddressRegion({ ...data, address: addressText })

  const inflowParsed = normalizeInflowSourceForDb(data.inflowSource ?? data.inflow_source ?? null)
  if (!inflowParsed.ok) {
    const error = new Error(inflowParsed.message)
    // @ts-expect-error custom
    error.httpStatus = 400
    throw error
  }
  const referrerNameSql = normalizeReferrerNameForDb(inflowParsed.value, data.referrerName ?? data.referrer_name)
  const businessInfo = normalizeBusinessInfoForDb(data.businessInfo ?? data.business_info)

  const inserted = await safeQuery(
    executor,
    `
      INSERT INTO customers (
        user_id, ga_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        gender, insurance_age, next_age_date, is_driver, car_type,
        car_number, car_model, car_year, renewal_date,
        notes,
        birth_date,
        crm_extension,
        inflow_source,
        referrer_name,
        sms_opt_out,
        business_representative_name,
        business_number,
        business_address,
        business_memo,
        tenant_id, owner_user_id, created_by_user_id, visibility_scope,
        address_sido, address_sigungu, address_eupmyeondong
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CAST($22 AS jsonb), $23, CAST($24 AS jsonb), $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)
      RETURNING id, name
      `,
    [
      userId,
      gaId,
      name,
      ssn,
      String(data.phone ?? '').trim(),
      String(data.carrier ?? '').trim(),
      addressText,
      String(data.height ?? '').trim(),
      String(data.weight ?? '').trim(),
      String(data.job ?? '').trim(),
      '',
      String(data.medical ?? '').trim(),
      gender,
      insuranceAge,
      nextAgeDateToSqlDate(nextAgeDateObj),
      null,
      String(data.carType ?? '').trim(),
      String(data.carNumber ?? '').trim(),
      String(data.carModel ?? '').trim(),
      String(data.carYear ?? '').trim(),
      normalizeExpiryDate(String(data.renewalDate ?? '')) || null,
      JSON.stringify(notes),
      null,
      stringifyCrmExtensionForDb(data.crmExtension),
      inflowParsed.value,
      referrerNameSql,
      false,
      businessInfo.representativeName,
      businessInfo.businessNumber,
      businessInfo.businessAddress,
      businessInfo.memo,
      custTenantId,
      userId,
      userId,
      String(authUser?.customerAccess ?? 'own').trim().toLowerCase() || 'own',
      addressRegion.addressSido,
      addressRegion.addressSigungu,
      addressRegion.addressEupmyeondong,
    ],
  )
  return inserted.rows[0]
}
