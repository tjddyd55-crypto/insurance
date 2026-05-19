/**
 * government-support CRM API (보험 CRM / 플랫폼 관리와 분리).
 */
import {
  canAccessGovernmentTenant,
  createGovernmentSupportGuards,
  isGovernmentIndustryAdmin,
  isGovernmentSuperAdmin,
  isGovernmentTenantMember,
  resolveGovernmentIndustryId,
  resolveGovernmentTenantScopeForQuery,
} from './lib/governmentSupport/governmentAccess.js'
import { GOVERNMENT_INDUSTRY_CODE } from './lib/governmentSupport/constants.js'
import { mapGovSupportProfileRow, profilePatchFromBody } from './lib/governmentSupport/profileMapper.js'
import { normalizeTenantRegistrationCodeRaw } from './lib/tenantRegistrationCodes.js'

/**
 * @param {import('express').Router} router
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} deps
 */
export function registerGovernmentSupportApi(router, deps) {
  const { pool, requireAuth, handleDbError } = deps
  const { requireGovernmentMember, requireGovernmentIndustryAdmin, attach } = createGovernmentSupportGuards(pool, {
    requireAuth,
    handleDbError,
  })

  router.get('/government-support/me/access', requireAuth, attach, (req, res) => {
    try {
      const ctx = req.platformContext
      if (!ctx) {
        res.status(500).json({ message: 'platformContext missing' })
        return
      }
      res.json({
        success: true,
        data: {
          userId: ctx.userId,
          isSuperAdmin: isGovernmentSuperAdmin(ctx),
          isGovernmentIndustryAdmin: isGovernmentIndustryAdmin(ctx),
          isGovernmentTenantMember: isGovernmentTenantMember(ctx),
          governmentIndustryAdminIndustryIds: [...(ctx.governmentIndustryAdminIndustryIds ?? [])],
          governmentAgencyAdminTenantIds: [...(ctx.governmentAgencyAdminTenantIds ?? [])],
          governmentStaffTenantIds: [...(ctx.governmentStaffTenantIds ?? [])],
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/admin/agencies', ...requireGovernmentIndustryAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `
        SELECT t.id::text AS id, t.code, t.name, t.status, t.created_at, t.updated_at
        FROM tenants t
        INNER JOIN industries i ON i.id = t.industry_id
        WHERE LOWER(TRIM(i.code)) = $1
        ORDER BY t.id ASC
        `,
        [GOVERNMENT_INDUSTRY_CODE],
      )
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: String(row.id),
          agencyCode: String(row.code ?? ''),
          name: String(row.name ?? ''),
          status: String(row.status ?? ''),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/government-support/admin/agencies', ...requireGovernmentIndustryAdmin, async (req, res) => {
    try {
      const body = req.body ?? {}
      const name = String(body.name ?? '').trim()
      const agencyCode = normalizeTenantRegistrationCodeRaw(body.agencyCode ?? body.code)
      const status = String(body.status ?? 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active'
      if (!name) {
        res.status(400).json({ message: '대행사명이 필요합니다.' })
        return
      }
      if (!agencyCode || agencyCode.length < 3) {
        res.status(400).json({ message: 'agencyCode는 3자 이상이어야 합니다.' })
        return
      }
      const industryId = await resolveGovernmentIndustryId(pool)
      if (!industryId) {
        res.status(500).json({ message: 'government 업종이 설정되지 않았습니다.' })
        return
      }
      const dup = await pool.query(`SELECT id FROM tenants WHERE code = $1 LIMIT 1`, [agencyCode])
      if ((dup.rowCount ?? 0) > 0) {
        res.status(409).json({ message: '이미 사용 중인 agencyCode 입니다.' })
        return
      }
      const ins = await pool.query(
        `
        INSERT INTO tenants (industry_id, code, name, status, config)
        VALUES ($1::bigint, $2, $3, $4, '{}'::jsonb)
        RETURNING id::text AS id, code, name, status
        `,
        [industryId, agencyCode, name, status],
      )
      const tenant = ins.rows[0]
      await pool.query(
        `
        INSERT INTO tenant_registration_codes (
          code, tenant_id, industry_code, default_membership_type, default_customer_access,
          default_role, status
        )
        VALUES ($1, $2::bigint, $3, 'staff', 'tenant', 'government_staff', 'active')
        ON CONFLICT DO NOTHING
        `,
        [agencyCode, tenant.id, GOVERNMENT_INDUSTRY_CODE],
      )
      res.status(201).json({
        success: true,
        data: {
          id: String(tenant.id),
          agencyCode: String(tenant.code),
          name: String(tenant.name),
          status: String(tenant.status),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const scope = await resolveGovernmentTenantScopeForQuery(pool, ctx)
      if (!scope.ok) {
        res.status(scope.status).json({ message: scope.message })
        return
      }
      if (scope.tenantIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }
      const r = await pool.query(
        `
        SELECT * FROM gov_support_profiles
        WHERE tenant_id = ANY($1::bigint[])
        ORDER BY updated_at DESC, id DESC
        `,
        [scope.tenantIds],
      )
      res.json({ success: true, data: r.rows.map(mapGovSupportProfileRow) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/government-support/profiles', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const body = req.body ?? {}
      const tenantId = String(body.tenantId ?? body.tenant_id ?? '').trim()
      if (!tenantId || !canAccessGovernmentTenant(ctx, tenantId)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const pairs = profilePatchFromBody(body)
      const cols = ['tenant_id', ...pairs.map((p) => p[0])]
      const vals = [tenantId, ...pairs.map((p) => p[1])]
      const placeholders = vals.map((_, i) => `$${i + 1}`)
      const r = await pool.query(
        `INSERT INTO gov_support_profiles (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals,
      )
      res.status(201).json({ success: true, data: mapGovSupportProfileRow(r.rows[0]) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const id = String(req.params.profileId ?? '').trim()
      const r = await pool.query(`SELECT * FROM gov_support_profiles WHERE id = $1::bigint LIMIT 1`, [id])
      if ((r.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const row = r.rows[0]
      if (!canAccessGovernmentTenant(ctx, row.tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      res.json({ success: true, data: mapGovSupportProfileRow(row) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.patch('/government-support/profiles/:profileId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const id = String(req.params.profileId ?? '').trim()
      const existing = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [id])
      if ((existing.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, existing.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const pairs = profilePatchFromBody(req.body ?? {})
      if (pairs.length === 0) {
        res.status(400).json({ message: '수정할 필드가 없습니다.' })
        return
      }
      const sets = pairs.map((p, i) => `${p[0]} = $${i + 2}`)
      const vals = pairs.map((p) => p[1])
      const r = await pool.query(
        `UPDATE gov_support_profiles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1::bigint RETURNING *`,
        [id, ...vals],
      )
      res.json({ success: true, data: mapGovSupportProfileRow(r.rows[0]) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId/prior-loans', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, pr.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `SELECT * FROM gov_support_prior_loans WHERE profile_id = $1::bigint ORDER BY id ASC`,
        [profileId],
      )
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: String(row.id),
          profileId: String(row.profile_id),
          tenantId: String(row.tenant_id),
          hasPrior: String(row.has_prior ?? ''),
          lenderName: String(row.lender_name ?? ''),
          remainingAmount: String(row.remaining_amount ?? ''),
          receivedAt: String(row.received_at ?? ''),
          policyIncluded: String(row.policy_included ?? ''),
          memo: String(row.memo ?? ''),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/government-support/profiles/:profileId/prior-loans', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const b = req.body ?? {}
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const tenantId = pr.rows[0].tenant_id
      if (!canAccessGovernmentTenant(ctx, tenantId)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        INSERT INTO gov_support_prior_loans (
          tenant_id, profile_id, has_prior, lender_name, remaining_amount, received_at, policy_included, memo
        ) VALUES ($1::bigint, $2::bigint, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          tenantId,
          profileId,
          String(b.hasPrior ?? b.has_prior ?? ''),
          String(b.lenderName ?? b.lender_name ?? ''),
          String(b.remainingAmount ?? b.remaining_amount ?? ''),
          String(b.receivedAt ?? b.received_at ?? ''),
          String(b.policyIncluded ?? b.policy_included ?? ''),
          String(b.memo ?? ''),
        ],
      )
      res.status(201).json({ success: true, data: { id: String(r.rows[0].id) } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.patch('/government-support/prior-loans/:loanId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const loanId = String(req.params.loanId ?? '').trim()
      const b = req.body ?? {}
      const ex = await pool.query(`SELECT tenant_id FROM gov_support_prior_loans WHERE id = $1::bigint`, [loanId])
      if ((ex.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '기대출 항목을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, ex.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        UPDATE gov_support_prior_loans SET
          has_prior = COALESCE($2, has_prior),
          lender_name = COALESCE($3, lender_name),
          remaining_amount = COALESCE($4, remaining_amount),
          received_at = COALESCE($5, received_at),
          policy_included = COALESCE($6, policy_included),
          memo = COALESCE($7, memo),
          updated_at = NOW()
        WHERE id = $1::bigint
        RETURNING *
        `,
        [
          loanId,
          b.hasPrior != null ? String(b.hasPrior) : null,
          b.lenderName != null ? String(b.lenderName) : null,
          b.remainingAmount != null ? String(b.remainingAmount) : null,
          b.receivedAt != null ? String(b.receivedAt) : null,
          b.policyIncluded != null ? String(b.policyIncluded) : null,
          b.memo != null ? String(b.memo) : null,
        ],
      )
      const row = r.rows[0]
      res.json({
        success: true,
        data: {
          id: String(row.id),
          lenderName: String(row.lender_name ?? ''),
          remainingAmount: String(row.remaining_amount ?? ''),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.delete('/government-support/prior-loans/:loanId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const loanId = String(req.params.loanId ?? '').trim()
      const ex = await pool.query(`SELECT tenant_id FROM gov_support_prior_loans WHERE id = $1::bigint`, [loanId])
      if ((ex.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '기대출 항목을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, ex.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      await pool.query(`DELETE FROM gov_support_prior_loans WHERE id = $1::bigint`, [loanId])
      res.status(204).send()
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId/application-cases', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, pr.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `SELECT * FROM gov_support_application_cases WHERE profile_id = $1::bigint ORDER BY id DESC`,
        [profileId],
      )
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: String(row.id),
          profileId: String(row.profile_id),
          tenantId: String(row.tenant_id),
          productName: String(row.product_name ?? ''),
          availableProduct: String(row.available_product ?? ''),
          progressStatus: String(row.progress_status ?? ''),
          scheduleAt: String(row.schedule_at ?? ''),
          agencyOrg: String(row.agency_org ?? ''),
          assigneeUserId: row.assignee_user_id != null ? String(row.assignee_user_id) : null,
          requiredFunds: String(row.required_funds ?? ''),
          fee: String(row.fee ?? ''),
          certDelegate: String(row.cert_delegate ?? ''),
          specialNote: String(row.special_note ?? ''),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/government-support/profiles/:profileId/application-cases', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const b = req.body ?? {}
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const tenantId = pr.rows[0].tenant_id
      if (!canAccessGovernmentTenant(ctx, tenantId)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        INSERT INTO gov_support_application_cases (
          tenant_id, profile_id, product_name, available_product, progress_status,
          schedule_at, agency_org, assignee_user_id, required_funds, fee, cert_delegate, special_note
        ) VALUES ($1::bigint,$2::bigint,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
        `,
        [
          tenantId,
          profileId,
          String(b.productName ?? b.product_name ?? ''),
          String(b.availableProduct ?? b.available_product ?? ''),
          String(b.progressStatus ?? b.progress_status ?? '상담 접수'),
          String(b.scheduleAt ?? b.schedule_at ?? ''),
          String(b.agencyOrg ?? b.agency_org ?? ''),
          b.assigneeUserId ?? b.assignee_user_id ?? null,
          String(b.requiredFunds ?? b.required_funds ?? ''),
          String(b.fee ?? ''),
          String(b.certDelegate ?? b.cert_delegate ?? ''),
          String(b.specialNote ?? b.special_note ?? ''),
        ],
      )
      res.status(201).json({ success: true, data: { id: String(r.rows[0].id), progressStatus: String(r.rows[0].progress_status) } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.patch('/government-support/application-cases/:caseId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const caseId = String(req.params.caseId ?? '').trim()
      const b = req.body ?? {}
      const ex = await pool.query(`SELECT tenant_id FROM gov_support_application_cases WHERE id = $1::bigint`, [caseId])
      if ((ex.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '신청/청약 건을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, ex.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        UPDATE gov_support_application_cases SET
          product_name = COALESCE($2, product_name),
          available_product = COALESCE($3, available_product),
          progress_status = COALESCE($4, progress_status),
          schedule_at = COALESCE($5, schedule_at),
          agency_org = COALESCE($6, agency_org),
          required_funds = COALESCE($7, required_funds),
          fee = COALESCE($8, fee),
          cert_delegate = COALESCE($9, cert_delegate),
          special_note = COALESCE($10, special_note),
          updated_at = NOW()
        WHERE id = $1::bigint
        RETURNING *
        `,
        [
          caseId,
          b.productName ?? b.product_name ?? null,
          b.availableProduct ?? b.available_product ?? null,
          b.progressStatus ?? b.progress_status ?? null,
          b.scheduleAt ?? b.schedule_at ?? null,
          b.agencyOrg ?? b.agency_org ?? null,
          b.requiredFunds ?? b.required_funds ?? null,
          b.fee ?? null,
          b.certDelegate ?? b.cert_delegate ?? null,
          b.specialNote ?? b.special_note ?? null,
        ],
      )
      res.json({ success: true, data: { id: String(r.rows[0].id), progressStatus: String(r.rows[0].progress_status) } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId/edoc-links', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, pr.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `SELECT * FROM gov_support_edoc_links WHERE profile_id = $1::bigint ORDER BY id DESC`,
        [profileId],
      )
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: String(row.id),
          documentName: String(row.document_name ?? ''),
          sentAt: row.sent_at,
          recipient: String(row.recipient ?? ''),
          signStatus: String(row.sign_status ?? ''),
          completedAt: row.completed_at,
          applicationCaseId: row.application_case_id != null ? String(row.application_case_id) : null,
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.post('/government-support/profiles/:profileId/edoc-links', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const b = req.body ?? {}
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const tenantId = pr.rows[0].tenant_id
      if (!canAccessGovernmentTenant(ctx, tenantId)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const rawCaseId = b.applicationCaseId ?? b.application_case_id ?? null
      let applicationCaseId = null
      if (rawCaseId != null && String(rawCaseId).trim() !== '') {
        const caseId = String(rawCaseId).trim()
        const ac = await pool.query(
          `SELECT id FROM gov_support_application_cases WHERE id = $1::bigint AND profile_id = $2::bigint LIMIT 1`,
          [caseId, profileId],
        )
        if ((ac.rowCount ?? 0) === 0) {
          res.status(400).json({ message: '신청/청약 건이 프로필과 일치하지 않습니다.' })
          return
        }
        applicationCaseId = caseId
      }
      const r = await pool.query(
        `
        INSERT INTO gov_support_edoc_links (
          tenant_id, profile_id, application_case_id, document_name, recipient, sign_status
        ) VALUES ($1::bigint, $2::bigint, $3::bigint, $4, $5, $6)
        RETURNING *
        `,
        [
          tenantId,
          profileId,
          applicationCaseId,
          String(b.documentName ?? b.document_name ?? '정부지원 전자문서'),
          String(b.recipient ?? ''),
          String(b.signStatus ?? b.sign_status ?? '대기'),
        ],
      )
      res.status(201).json({ success: true, data: { id: String(r.rows[0].id) } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId/documents', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const pr = await pool.query(`SELECT tenant_id FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, pr.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      let r = await pool.query(
        `SELECT * FROM gov_support_document_items WHERE profile_id = $1::bigint ORDER BY id ASC`,
        [profileId],
      )
      if ((r.rowCount ?? 0) === 0) {
        for (const docType of [
          '사업자등록증',
          '부가세 신고자료',
          '소득금액증명원',
          '국세 완납증명서',
          '지방세 완납증명서',
          '통장 사본',
          '임대차계약서',
          '기타 서류',
        ]) {
          await pool.query(
            `INSERT INTO gov_support_document_items (tenant_id, profile_id, doc_type, status)
             VALUES ($1::bigint, $2::bigint, $3, '요청 전')`,
            [pr.rows[0].tenant_id, profileId, docType],
          )
        }
        r = await pool.query(
          `SELECT * FROM gov_support_document_items WHERE profile_id = $1::bigint ORDER BY id ASC`,
          [profileId],
        )
      }
      res.json({
        success: true,
        data: r.rows.map((row) => ({
          id: String(row.id),
          docType: String(row.doc_type ?? ''),
          status: String(row.status ?? ''),
          storageKey: row.storage_key != null ? String(row.storage_key) : null,
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.patch('/government-support/documents/:docId', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const docId = String(req.params.docId ?? '').trim()
      const b = req.body ?? {}
      const ex = await pool.query(`SELECT tenant_id FROM gov_support_document_items WHERE id = $1::bigint`, [docId])
      if ((ex.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '서류 항목을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, ex.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      const r = await pool.query(
        `UPDATE gov_support_document_items SET status = COALESCE($2, status), storage_key = COALESCE($3, storage_key), updated_at = NOW() WHERE id = $1::bigint RETURNING *`,
        [docId, b.status ?? null, b.storageKey ?? b.storage_key ?? null],
      )
      res.json({ success: true, data: { id: String(r.rows[0].id), status: String(r.rows[0].status) } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  router.get('/government-support/profiles/:profileId/pdf-mapping', ...requireGovernmentMember, async (req, res) => {
    try {
      const ctx = req.platformContext
      const profileId = String(req.params.profileId ?? '').trim()
      const caseId = req.query.applicationCaseId != null ? String(req.query.applicationCaseId) : null
      const pr = await pool.query(`SELECT * FROM gov_support_profiles WHERE id = $1::bigint`, [profileId])
      if ((pr.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!canAccessGovernmentTenant(ctx, pr.rows[0].tenant_id)) {
        res.status(403).json({ message: 'tenant 접근 권한이 없습니다.' })
        return
      }
      let caseRow = null
      if (caseId) {
        const cr = await pool.query(
          `SELECT * FROM gov_support_application_cases WHERE id = $1::bigint AND profile_id = $2::bigint LIMIT 1`,
          [caseId, profileId],
        )
        if ((cr.rowCount ?? 0) === 0) {
          res.status(404).json({ message: '신청/청약 건을 찾을 수 없습니다.' })
          return
        }
        caseRow = cr.rows[0]
      }
      const p = mapGovSupportProfileRow(pr.rows[0])
      const mapping = buildGovernmentPdfFieldMapping(p, caseRow)
      res.json({ success: true, data: { mapping } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}

/** @param {ReturnType<typeof mapGovSupportProfileRow>} profile @param {Record<string, unknown>|null} caseRow */
function buildGovernmentPdfFieldMapping(profile, caseRow) {
  const c = caseRow ?? {}
  return {
    'gov.customer.name': profile.customerName,
    'gov.customer.phone': profile.phone,
    'gov.customer.carrier': profile.carrier,
    'gov.customer.ssn': profile.ssn,
    'gov.customer.address': profile.homeAddress,
    'gov.customer.homeType': profile.homeType,
    'gov.customer.deposit': profile.deposit,
    'gov.customer.monthlyRent': profile.monthlyRent,
    'gov.customer.creditScore1': profile.creditScore1,
    'gov.customer.creditScore2': profile.creditScore2,
    'gov.business.name': profile.businessName,
    'gov.business.openedAt': profile.businessOpenedAt,
    'gov.business.number': profile.businessNumber,
    'gov.business.address': profile.businessAddress,
    'gov.business.category': profile.businessCategory,
    'gov.business.type': profile.businessType,
    'gov.business.form': profile.businessForm,
    'gov.business.phone': profile.businessPhone,
    'gov.funding.vatReport': profile.vatReport,
    'gov.funding.annualIncome': profile.annualIncome,
    'gov.funding.incomeCert': profile.incomeCert,
    'gov.funding.taxArrears': profile.taxArrears,
    'gov.funding.requiredFunds': profile.requiredFunds,
    'gov.case.productName': String(c.product_name ?? profile.productName),
    'gov.case.agencyOrg': String(c.agency_org ?? profile.agencyOrg),
    'gov.case.fee': String(c.fee ?? profile.fee),
    'gov.case.specialNote': String(c.special_note ?? profile.specialNote),
    'gov.case.progressStatus': String(c.progress_status ?? profile.progressStatus),
  }
}
