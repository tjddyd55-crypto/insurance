import { randomUUID } from 'node:crypto'
import { safeQuery, systemQuery } from '../utils/dbSafeQuery.js'
import { bootstrapInsuranceBillingSubscriptionOnSignup } from '../insurance-billing/subscriptionLifecycle.js'
import { ensureReferralCodeForUser } from '../referrals/referralCode.js'
import { planSignupCodes, applySignupCodesPlan } from '../signup/processSignupCodes.js'
import { applySignupAutoPromotionOnSignup } from '../signup/signupAutoPromotion.js'
import { readPolicyActive } from '../subscription/appSettings.js'
import { verifySignupPhoneProof, verifyRegistrationSignupPhoneProof } from '../lib/signupPhoneProof.js'
import { evaluateTenantMembershipLoginBlock, pickPrimaryTenantMembershipForLogin } from '../lib/tenantMembershipAuth.js'
import {
  evaluateTenantRegistrationCodeForSignup,
  incrementTenantRegistrationUsedCount,
  normalizeIndustryCodeParam,
  normalizeTenantRegistrationCodeRaw,
} from '../lib/tenantRegistrationCodes.js'
import { signInviteSignup, verifyInviteSignupSignature } from '../lib/inviteSignupSignature.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import {
  authenticateBoardWriterCredentials,
  resolveBoardWriterLandingPath,
  signBoardWriterSessionToken,
} from '../lib/boardWriterAccountService.js'
import { mapBoardWriterRow } from '../lib/boardWriterService.js'
import { parseGaId } from '../lib/parseGaId.js'
import { resolveSignupGaCompany } from '../lib/generalGa.js'
import {
  isDevSignupPhoneBypassEnabled,
  resolveDevSignupPhoneForStorage,
  shouldBypassSmsProofForSignup,
  shouldSkipSignupPhoneDuplicateCheck,
} from '../lib/devSignupPhoneBypass.js'
import { isValidSignupUsername, validateSignupUsername } from '../lib/signupUsername.js'
import { selectCrmBootstrapExtendedForLegacyGa } from '../crm/resolveLegacyGaCrmBootstrap.js'
import { recordAnalyticsEvent } from '../lib/analyticsEvents.js'
import { logSecurityEvent, writeSecurityAudit } from '../lib/securityAudit.js'
import {
  resolveMinConcurrentSessionCapForUser,
  recordSuccessfulUserLoginSession,
} from '../lib/authSessions.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerAuthApi(apiRouter, ctx) {
  const {
    pool,
    bcrypt,
    jwt,
    JWT_SECRET,
    INVITE_SIGNUP_SECRET,
    requireAuth,
    handleDbError,
    validateCredentials,
    isUsernameTakenGlobally,
    attachTenantMembershipSignup,
    normalizeUserRole,
    toIsoString,
    normalizeInviteCode,
  } = ctx

async function handleRegister(req, res) {
  try {
    const body = req.body ?? {}
    const {
      username,
      password,
      invite_code: inviteRaw,
      inviteCode: inviteAlt,
      ref_user_id: refUserSnake,
      refUserId: refUserCamel,
      name: nameRaw,
      display_name: displayNameRaw,
      phone_number: phoneSnake,
      phoneNumber: phoneCamel,
      signup_phone_proof: signupProofSnake,
      signupPhoneProof: signupProofCamel,
      invite_sig: inviteSigSnake,
      inviteSig: inviteSigCamel,
      invite_ts: inviteTsSnake,
      inviteTs: inviteTsCamel,
      sig: sigLoose,
      ts: tsLoose,
      referral_code: referralCodeSnake,
      referralCode: referralCodeCamel,
    } = body

    const displayName = String(nameRaw ?? displayNameRaw ?? '').trim()
    if (!displayName) {
      res.status(400).json({ message: '이름을 입력해 주세요.' })
      return
    }

    const phoneNorm = normalizeKrMobile(body?.phone_number ?? body?.phoneNumber)
    const phoneErr = validateKrMobileDigits(phoneNorm)
    if (phoneErr) {
      res.status(400).json({ message: phoneErr })
      return
    }
    const devPhoneBypass = isDevSignupPhoneBypassEnabled()

    const industrySignup = normalizeIndustryCodeParam(body.industry_code ?? body.industryCode ?? '')
    const regCodeNorm = normalizeTenantRegistrationCodeRaw(body.registration_code ?? body.registrationCode ?? '')
    /** 보험(legacy GA) 또는 기타 업종: industryCode + 가입 코드가 함께 오면 테넌트 코드 경로 */
    const tenantRegSignup = industrySignup.length > 0 && regCodeNorm.length >= 3

    /** @type {number | null} */
    let gaId = null
    let gaLegacyInviteCodeNormalized = ''
    /** @type {{ tenantPk: number; industryPk: number; codeRowId: number } | null} */
    let tenantRegMeta = null

    const proofRaw = String(signupProofSnake ?? signupProofCamel ?? '').trim()
    if (!proofRaw && !shouldBypassSmsProofForSignup()) {
      res.status(400).json({ message: '휴대폰 인증이 필요합니다.' })
      return
    }

    let invitedByUserId = null

    if (tenantRegSignup) {
      const refEarly = String(refUserSnake ?? refUserCamel ?? '').trim()
      if (refEarly) {
        res.status(400).json({ message: '초대 매개변수와 업종별 가입 코드를 함께 사용할 수 없습니다.' })
        return
      }

      const ev = await evaluateTenantRegistrationCodeForSignup(pool, {
        industryCodeNorm: industrySignup,
        registrationCodeNorm: regCodeNorm,
      })
      if (!ev.ok) {
        res.status(ev.status).json({ message: ev.message })
        return
      }
      gaId = ev.gaId
      tenantRegMeta = {
        tenantPk: Number(ev.row.tenant_pk),
        industryPk: Number(ev.row.tenant_industry_id),
        codeRowId: Number(ev.row.id),
      }

      let rp
      if (!shouldBypassSmsProofForSignup()) {
        try {
          rp = verifyRegistrationSignupPhoneProof(proofRaw, JWT_SECRET)
        } catch {
          rp = null
        }
        if (!rp) {
          res.status(400).json({
            message: '휴대폰 인증이 만료되었거나 유효하지 않습니다. 인증부터 다시 진행해 주세요.',
          })
          return
        }
        if (rp.phoneDigits !== phoneNorm) {
          res.status(400).json({ message: '인증된 휴대폰 번호와 가입 폼의 번호가 일치하지 않습니다.' })
          return
        }
        if (rp.industryCodeNormalized !== industrySignup) {
          res.status(400).json({ message: '인증 업종 정보가 일치하지 않습니다.' })
          return
        }
        if (rp.registrationCodeNormalized !== regCodeNorm) {
          res.status(400).json({ message: '인증 시점 가입 코드와 현재 입력이 일치하지 않습니다.' })
          return
        }
        if (gaId == null || rp.gaId !== gaId) {
          res.status(400).json({ message: '가입 코드와 소속 정보가 일치하지 않습니다.' })
          return
        }
        if (tenantRegMeta.tenantPk !== rp.tenantId) {
          res.status(400).json({ message: '가입 코드와 소속 정보가 일치하지 않습니다.' })
          return
        }
      }
      const drCheck = String(ev.row.default_role ?? 'user').trim().toLowerCase()
      const dtCheck = String(ev.row.default_membership_type ?? 'agent').trim().toLowerCase()
      const daCheck = String(ev.row.default_customer_access ?? 'own').trim().toLowerCase()
      if (!(drCheck === 'user' && dtCheck === 'agent' && daCheck === 'own')) {
        res.status(400).json({ message: '이 경로에서는 일반 agent(본인 고객) 가입만 허용됩니다.' })
        return
      }
    } else {
      const explicitInviteInput = String(inviteRaw ?? inviteAlt ?? '').trim()
      let resolvedSignupGa
      try {
        resolvedSignupGa = await resolveSignupGaCompany(pool, explicitInviteInput)
      } catch (gaResolveErr) {
        if (gaResolveErr?.code === 'inactive_ga') {
          res.status(400).json({ message: '가입할 수 없는 GA입니다' })
          return
        }
        res.status(400).json({ message: '유효하지 않은 코드입니다' })
        return
      }
      gaLegacyInviteCodeNormalized = resolvedSignupGa.codeNormalized
      gaId = resolvedSignupGa.id

      const refUserId = String(refUserSnake ?? refUserCamel ?? '').trim()
      /** 담당자 초대 링크(명시 GA + ref) — 추천인 코드만 있는 가입과 분리 */
      if (refUserId && explicitInviteInput) {
        const refUserRes = await systemQuery(
          pool,
          `
          SELECT id, role, ga_id, status, is_deleted
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [refUserId],
        )
        const refRow = refUserRes.rows[0]
        if (!refRow || refRow.is_deleted) {
          res.status(400).json({ message: '유효하지 않은 초대 링크입니다.' })
          return
        }
        if (String(refRow.status ?? '').toLowerCase() !== 'active') {
          res.status(400).json({ message: '초대를 받을 수 없는 계정 상태입니다.' })
          return
        }
        if (normalizeUserRole(refRow.role) !== 'USER') {
          res.status(400).json({ message: '일반 설계사(USER) 계정으로만 회원 초대가 가능합니다.' })
          return
        }
        const refGaId = parseGaId(refRow.ga_id)
        if (refGaId == null || gaId == null || refGaId !== gaId) {
          res.status(400).json({ message: '소속 GA가 초대 담당자와 일치하지 않습니다.' })
          return
        }

        const inviteSigRaw = String(inviteSigSnake ?? inviteSigCamel ?? sigLoose ?? '').trim()
        const inviteTsRaw = inviteTsSnake ?? inviteTsCamel ?? tsLoose
        const hasInviteSignaturePayload = Boolean(inviteSigRaw) || inviteTsRaw != null
        if (hasInviteSignaturePayload) {
          const inviteTsMs = Number(inviteTsRaw)
          const sigCheck = verifyInviteSignupSignature(INVITE_SIGNUP_SECRET, {
            gaCodeNormalized: gaLegacyInviteCodeNormalized,
            refUserId,
            tsMs: inviteTsMs,
            sig: inviteSigRaw,
          })
          if (!sigCheck.ok) {
            const msg =
              sigCheck.reason === 'expired'
                ? '초대 링크가 만료되었습니다. 담당자에게 새 링크를 요청해 주세요.'
                : '유효하지 않거나 변조된 초대 링크입니다. 담당자가 공유한 링크로 다시 시도해 주세요.'
            res.status(400).json({ message: msg })
            return
          }
        }

        invitedByUserId = refUserId
      }

      let signupProofLegacy
      if (!shouldBypassSmsProofForSignup()) {
        try {
          signupProofLegacy = verifySignupPhoneProof(proofRaw, JWT_SECRET)
        } catch {
          signupProofLegacy = null
        }
        if (!signupProofLegacy) {
          res.status(400).json({
            message: '휴대폰 인증이 만료되었거나 유효하지 않습니다. 인증부터 다시 진행해 주세요.',
          })
          return
        }
        if (signupProofLegacy.phoneDigits !== phoneNorm) {
          res.status(400).json({ message: '인증된 휴대폰 번호와 가입 폼의 번호가 일치하지 않습니다.' })
          return
        }
        if (signupProofLegacy.inviteCodeNormalized !== gaLegacyInviteCodeNormalized) {
          res.status(400).json({
            message:
              '인증 시점의 GA 코드와 현재 입력이 일치하지 않습니다. 인증을 다시 진행해 주세요.',
          })
          return
        }
        if (signupProofLegacy.gaId !== gaId) {
          res.status(400).json({ message: 'GA 정보가 일치하지 않습니다. 인증을 다시 진행해 주세요.' })
          return
        }
      }
    }

    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const signupUsernameMessage = validateSignupUsername(username)
    if (signupUsernameMessage) {
      res.status(400).json({ message: signupUsernameMessage })
      return
    }

    const normalizedUsername = username.trim()
    if (await isUsernameTakenGlobally(pool, normalizedUsername)) {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }

    if (!shouldSkipSignupPhoneDuplicateCheck()) {
      const phoneDup = await systemQuery(
        pool,
        `
        SELECT 1
        FROM users
        WHERE is_deleted = false
          AND role = 'USER'
          AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $1
        LIMIT 1
        `,
        [phoneNorm],
      )
      if (phoneDup.rowCount > 0) {
        res.status(409).json({ message: '이미 가입된 휴대폰 번호입니다.' })
        return
      }
    }

    const phoneForStorage = devPhoneBypass
      ? resolveDevSignupPhoneForStorage(phoneNorm, normalizedUsername)
      : phoneNorm

    const signupCodesPlan = await planSignupCodes(pool, req)
    if (signupCodesPlan.validationError) {
      res.status(signupCodesPlan.validationError.status).json({ message: signupCodesPlan.validationError.message })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const id = randomUUID()
    const effectiveInvitedByUserId = invitedByUserId ?? id

    const client = await pool.connect()
    let createdAtIso = ''
    try {
      await client.query('BEGIN')

      const insRow = await safeQuery(client,
        `
        INSERT INTO users (id, username, password_hash, role, ga_id, display_name, phone_number, invited_by_user_id)
        VALUES ($1, $2, $3, 'USER', $4, $5, $6, $7)
        RETURNING created_at
        `,
        [id, normalizedUsername, passwordHash, gaId, displayName, phoneForStorage, effectiveInvitedByUserId],
      )
      createdAtIso = toIsoString(insRow.rows[0].created_at)

      if (tenantRegSignup && tenantRegMeta != null) {
        const evAgain = await evaluateTenantRegistrationCodeForSignup(client, {
          industryCodeNorm: industrySignup,
          registrationCodeNorm: regCodeNorm,
        })
        if (!evAgain.ok) {
          await client.query('ROLLBACK')
          res.status(evAgain.status).json({ message: evAgain.message })
          return
        }
        const bumped = await incrementTenantRegistrationUsedCount(client, tenantRegMeta.codeRowId)
        if (!bumped.incremented) {
          await client.query('ROLLBACK')
          res.status(400).json({ message: '가입 코드를 사용할 수 없습니다. 새 코드를 받아 주세요.' })
          return
        }
        await attachTenantMembershipSignup(client, {
          userId: id,
          gaId,
          tenantDbId: tenantRegMeta.tenantPk,
          industryId: tenantRegMeta.industryPk,
          rbacRole: 'user',
          membershipType: 'agent',
          customerAccess: 'own',
        })
      } else {
        await attachTenantMembershipSignup(client, {
          userId: id,
          gaId,
          rbacRole: 'user',
          membershipType: 'agent',
          customerAccess: 'own',
        })
      }

      await ensureReferralCodeForUser(client, id)
      const policyActive = await readPolicyActive()
      try {
        await applySignupCodesPlan(client, {
          userId: id,
          gaId,
          plan: signupCodesPlan,
          policyActive,
        })
      } catch (referralErr) {
        await client.query('ROLLBACK')
        client.release()
        if (referralErr?.message === 'referral_self_not_allowed') {
          res.status(400).json({ message: '본인 추천 코드는 사용할 수 없습니다.' })
          return
        }
        if (referralErr?.message === 'referral_already_applied') {
          res.status(409).json({ message: '이미 추천 코드가 적용된 계정입니다.' })
          return
        }
        throw referralErr
      }

      const isInsuranceCrmSignup = !tenantRegSignup || industrySignup === 'insurance'
      if (isInsuranceCrmSignup) {
        await bootstrapInsuranceBillingSubscriptionOnSignup(client, { userId: id, gaId })
      }

      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      client.release()
      throw e
    }
    client.release()

    try {
      await applySignupAutoPromotionOnSignup(pool, { userId: id, gaId })
    } catch (autoPromoErr) {
      console.warn('[handleRegister] launch auto promotion skipped:', autoPromoErr?.message ?? autoPromoErr)
    }

    if (phoneNorm) {
      await pool.query(`DELETE FROM sms_verification_codes WHERE purpose = 'SIGNUP' AND phone_number = $1`, [
        phoneNorm,
      ])
    }

    const payload = { id, username: normalizedUsername, ga_id: gaId, createdAt: createdAtIso }
    if (tenantRegSignup && industrySignup) {
      payload.industry_code = industrySignup
    }

    res.status(201).json(payload)
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, req, res)
  }
}


async function auditLoginFailure(pool, username, reason) {
  try {
    await writeSecurityAudit(pool, {
      actorUserId: String(username ?? '').slice(0, 120),
      actorRole: 'anonymous',
      action: 'LOGIN_FAILED',
      targetType: 'auth',
      meta: { reason, code: reason },
    })
  } catch (e) {
    console.error('[security_audit LOGIN_FAILED]', e)
  }
}

async function handleLogin(req, res) {
  try {
    const { username, password } = req.body ?? {}
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = username.trim()
    const loginDebug = process.env.INSURANCE_LOGIN_DEBUG === 'true'

    const result = await systemQuery(pool,
      `
      SELECT *
      FROM users
      WHERE username = $1
        AND is_deleted = false
        AND LOWER(TRIM(COALESCE(status::text, 'active'))) = 'active'
      `,
      [normalizedUsername],
    )

    let user = result.rows[0]

    if (!user) {
      const managerCandidates = [
        {
          role: 'INSURER_MANAGER',
          table: 'insurer_managers',
          nameField: 'insurer_name',
          failInvalidPassword: 'invalid_password_insurer_manager',
          failInactive: 'insurer_manager_inactive',
          failMissingCompany: 'insurer_missing_company_id',
        },
        {
          role: 'LOSS_ADJUSTER',
          table: 'loss_adjusters',
          nameField: 'adjuster_name',
          failInvalidPassword: 'invalid_password_loss_adjuster',
          failInactive: 'loss_adjuster_inactive',
        },
      ]
      let manager = null
      let managerMeta = null
      for (const candidate of managerCandidates) {
        const mRes = await systemQuery(
          pool,
          `
          SELECT m.*, g.code AS ga_code, g.name AS ga_name, g.status AS ga_status, g.is_deleted AS ga_deleted
          FROM ${candidate.table} m
          INNER JOIN ga_companies g ON g.id = m.ga_id
          WHERE m.username = $1 AND m.is_deleted = false
          `,
          [normalizedUsername],
        )
        if (mRes.rows[0]) {
          manager = mRes.rows[0]
          managerMeta = candidate
          break
        }
      }
      if (!manager || !managerMeta) {
        const writerAuth = await authenticateBoardWriterCredentials(
          pool,
          normalizedUsername,
          password,
          bcrypt,
        )
        if (writerAuth.ok) {
          const redirectPath = await resolveBoardWriterLandingPath(pool, String(writerAuth.row.id))
          const writerToken = signBoardWriterSessionToken(
            writerAuth.row,
            writerAuth.allowedBoardIds,
            JWT_SECRET,
          )
          res.json({
            authKind: 'BOARD_WRITER',
            token: writerToken,
            redirectPath,
            writer: mapBoardWriterRow(writerAuth.row, writerAuth.allowedBoardIds),
          })
          return
        }
        await auditLoginFailure(pool, normalizedUsername, 'unknown_user')
        res.status(401).json({
          error: 'Invalid credentials',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        })
        return
      }
      if (loginDebug) {
        console.log('[login-debug] manager credential check', {
          username: normalizedUsername,
          role: managerMeta.role,
        })
      }
      const managerMatch = await bcrypt.compare(password, manager.password_hash)
      if (!managerMatch) {
        await auditLoginFailure(pool, normalizedUsername, managerMeta.failInvalidPassword)
        res.status(401).json({
          error: 'Invalid credentials',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        })
        return
      }
      if (String(manager.status ?? '').toUpperCase() !== 'ACTIVE') {
        await auditLoginFailure(pool, normalizedUsername, managerMeta.failInactive)
        res.status(401).json({ message: '접근이 제한된 계정입니다' })
        return
      }
      if (manager.ga_deleted === true || String(manager.ga_status ?? '').toLowerCase() !== 'active') {
        await auditLoginFailure(pool, normalizedUsername, 'ga_restricted_manager')
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      const managerCompanyIdRaw = manager.company_id != null ? Number(manager.company_id) : null
      const managerCompanyId =
        managerMeta.role === 'INSURER_MANAGER' &&
        Number.isInteger(managerCompanyIdRaw) &&
        Number(managerCompanyIdRaw) > 0
          ? Number(managerCompanyIdRaw)
          : null
      if (managerMeta.role === 'INSURER_MANAGER' && managerCompanyId == null) {
        await auditLoginFailure(pool, normalizedUsername, 'insurer_missing_company_id')
        res.status(403).json({
          error: 'FORBIDDEN',
          message: '담당자 계정에 회사(마스터)가 연결되지 않았습니다. 관리자에게 문의하세요.',
        })
        return
      }
      const managerGaCode =
        typeof manager.ga_code === 'string' && manager.ga_code.trim() ? manager.ga_code.trim().toUpperCase() : ''
      const managerGaName = typeof manager.ga_name === 'string' ? manager.ga_name.trim() : ''
      const managerGaId = parseGaId(manager.ga_id)
      const displayName = String(manager[managerMeta.nameField] ?? '').trim()
      const managerToken = jwt.sign(
        {
          userId: manager.id,
          sub: manager.id,
          username: manager.username,
          role: managerMeta.role,
          gaId: managerGaId,
          gaCode: managerGaCode,
          gaName: managerGaName,
          companyId: managerCompanyId ?? undefined,
          displayName,
          teamId: null,
        },
        JWT_SECRET,
        { expiresIn: '7d' },
      )
      void logSecurityEvent(pool, {
        actorUserId: String(manager.id),
        actorRole: managerMeta.role,
        action: 'login_success',
        targetType: 'auth',
        targetId: String(manager.id),
        gaId: Number.isInteger(managerGaId) ? managerGaId : null,
        companyId: managerCompanyId,
        meta: { username: manager.username },
      })
      void recordAnalyticsEvent(pool, {
        userId: String(manager.id),
        gaId: Number.isInteger(managerGaId) ? managerGaId : null,
        eventType: 'login',
      })
      const managerCrmBoot = await selectCrmBootstrapExtendedForLegacyGa(pool, managerGaId)
      res.json({
        token: managerToken,
        user: {
          id: String(manager.id),
          username: manager.username,
          role: managerMeta.role,
          ga_id: managerGaId,
          ga_code: managerGaCode,
          ga_name: managerGaName,
          company_id: managerCompanyId ?? undefined,
          display_name: displayName,
          team_id: null,
          crm_industry_code: managerCrmBoot.industryCode,
          tenant_crm: managerCrmBoot.tenantCrm,
          crm_dynamic_industry_template: managerCrmBoot.crmDynamicIndustryTemplate,
        },
      })
      return
    }

    if (loginDebug) {
      console.log('[login-debug] user credential check', {
        username: normalizedUsername,
      })
    }

    const match = await bcrypt.compare(password, user.password_hash)

    if (!match) {
      await auditLoginFailure(pool, normalizedUsername, 'invalid_password_user')
      res.status(401).json({
        error: 'Invalid credentials',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    if (user.is_deleted === true) {
      res.status(401).json({ message: '접근이 제한된 계정입니다' })
      return
    }
    const userStatus = String(user.status ?? 'active').toLowerCase()
    if (userStatus !== 'active') {
      res.status(401).json({ message: '접근이 제한된 계정입니다' })
      return
    }

    const uid = String(user.id)
    const role = normalizeUserRole(user.role)
    const gaId = parseGaId(user.ga_id)
    if (role !== 'SUPER_ADMIN' && gaId == null) {
      res.status(500).json({ message: '계정에 GA가 연결되지 않았습니다. 관리자에게 문의하세요.' })
      return
    }

    let gaCode = ''
    let gaName = ''
    if (gaId != null) {
      const gRow = await systemQuery(
        pool,
        `SELECT code, name, status, is_deleted FROM ga_companies WHERE id = $1`,
        [gaId],
      )
      const g0 = gRow.rows[0]
      if (!g0 || g0.is_deleted === true) {
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      if (String(g0.status ?? '').toLowerCase() !== 'active') {
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      const rawCode = g0?.code
      gaCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
      gaName = typeof g0?.name === 'string' ? g0.name.trim() : ''
    }

    const userDisplayName = String(user.display_name ?? user.username ?? '').trim()
    const userTeamId = user.team_id != null ? String(user.team_id) : null
    const gaIdIntPre = gaId != null && Number.isInteger(gaId) ? gaId : null

    let userCrmBoot = {
      industryCode: null,
      tenantCrm: null,
      crmDynamicIndustryTemplate: null,
      tenantDbId: null,
    }
    if (gaIdIntPre != null) {
      userCrmBoot = await selectCrmBootstrapExtendedForLegacyGa(pool, gaIdIntPre)
    }

    if (role !== 'SUPER_ADMIN' && gaIdIntPre != null) {
      const blk = await evaluateTenantMembershipLoginBlock(pool, uid, gaIdIntPre)
      if (blk.blocked) {
        res.status(403).json({ message: '소속 테넌트 접근이 제한되어 로그인할 수 없습니다.' })
        return
      }
    }

    /** @type {number | null} */
    let tenantDbJwt = userCrmBoot.tenantDbId
    /** @type {string | null} */
    let tenantIndustryJwt =
      typeof userCrmBoot.industryCode === 'string' && userCrmBoot.industryCode.trim()
        ? userCrmBoot.industryCode.trim().toLowerCase()
        : null
    /** @type {Record<string, unknown> | null} */
    let membershipPayload = null
    let tenantMembershipRoleJwt = ''
    let membershipTypeJwt = ''
    const roleNormJwt = normalizeUserRole(role)
    let customerAccessJwt = 'own'
    if (roleNormJwt === 'USER') {
      membershipTypeJwt = 'agent'
      customerAccessJwt = 'own'
    } else if (roleNormJwt === 'GA_STAFF') {
      membershipTypeJwt = 'staff'
      customerAccessJwt = 'tenant'
    } else if (roleNormJwt === 'GA_ADMIN') {
      membershipTypeJwt = 'admin'
      customerAccessJwt = 'tenant'
    } else if (roleNormJwt === 'SUPER_ADMIN') {
      membershipTypeJwt = 'owner'
      customerAccessJwt = 'tenant'
    } else {
      membershipTypeJwt = 'staff'
      customerAccessJwt = 'tenant'
    }

    if (gaIdIntPre != null) {
      const pick = await pickPrimaryTenantMembershipForLogin(pool, uid, gaIdIntPre)
      if (pick != null && pick.tenant_id != null) {
        tenantDbJwt = typeof pick.tenant_id === 'number' ? pick.tenant_id : Number(pick.tenant_id)
        const tic = pick.tenant_industry_code != null ? String(pick.tenant_industry_code).trim() : ''
        if (tic) {
          tenantIndustryJwt = tic.toLowerCase()
        }
        const caJwt = String(pick.customer_access ?? '').trim().toLowerCase()
        if (caJwt === 'none' || caJwt === 'own' || caJwt === 'tenant' || caJwt === 'assigned') {
          customerAccessJwt = caJwt
        }
        const mtJwt = String(pick.membership_type ?? '').trim().toLowerCase()
        if (mtJwt === 'agent' || mtJwt === 'staff' || mtJwt === 'admin' || mtJwt === 'owner') {
          membershipTypeJwt = mtJwt
        }
        tenantMembershipRoleJwt = String(pick.membership_rbac_role ?? '').trim()

        membershipPayload = {
          id: pick.membership_id != null ? String(pick.membership_id) : '',
          tenantId:
            pick.tenant_id != null
              ? String(pick.tenant_id)
              : tenantDbJwt != null
                ? String(tenantDbJwt)
                : '',
          industryCode:
            tenantIndustryJwt != null && tenantIndustryJwt !== '' ? tenantIndustryJwt : '',
          tenantCode: pick.tenant_code != null ? String(pick.tenant_code) : '',
          rbacRole:
            tenantMembershipRoleJwt || String(pick.membership_rbac_role ?? '').trim(),
          membershipType: membershipTypeJwt || String(pick.membership_type ?? '').trim(),
          customerAccess:
            ['none', 'own', 'tenant', 'assigned'].includes(customerAccessJwt) ?
              customerAccessJwt
            : 'own',
          crm_customer_template_id:
            pick.crm_customer_template_id != null ?
              typeof pick.crm_customer_template_id === 'number'
                ? pick.crm_customer_template_id
                : Number(pick.crm_customer_template_id)
            : null,
        }
      }
    }

    const token = jwt.sign(
      {
        userId: user.id,
        sub: user.id,
        username: user.username,
        role,
        gaId,
        gaCode,
        gaName,
        displayName: userDisplayName,
        teamId: userTeamId,
        tenantDbId: tenantDbJwt,
        tenant_db_id: tenantDbJwt,
        tenantIndustryCode: tenantIndustryJwt,
        tenant_industry_code: tenantIndustryJwt,
        customerAccess: customerAccessJwt,
        customer_access: customerAccessJwt,
        tenantMembershipRole: tenantMembershipRoleJwt,
        tenant_membership_role: tenantMembershipRoleJwt,
        membershipType: membershipTypeJwt,
        membership_type: membershipTypeJwt,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    const gaIdInt = gaIdIntPre
    void logSecurityEvent(pool, {
      actorUserId: uid,
      actorRole: role,
      action: 'login_success',
      targetType: 'auth',
      targetId: uid,
      gaId: gaIdInt,
      companyId: null,
      meta: { username: user.username },
    })
    void recordAnalyticsEvent(pool, { userId: uid, gaId: gaIdInt, eventType: 'login' })

    try {
      const cap = await resolveMinConcurrentSessionCapForUser(pool, uid)
      await recordSuccessfulUserLoginSession(pool, uid, req, cap)
    } catch (e) {
      console.error('[authSessions] login session audit failed', e)
    }

    res.json({
      token,
      user: {
        id: uid,
        username: user.username,
        role,
        ga_id: gaId,
        ga_code: gaCode,
        ga_name: gaName,
        display_name: userDisplayName,
        team_id: userTeamId,
        crm_industry_code: userCrmBoot.industryCode,
        tenant_crm: userCrmBoot.tenantCrm,
        crm_dynamic_industry_template: userCrmBoot.crmDynamicIndustryTemplate,
        tenant_db_id: tenantDbJwt,
        tenant_industry_code: tenantIndustryJwt,
        membership: membershipPayload,
        membership_customer_access: customerAccessJwt,
        membership_type: membershipTypeJwt,
        tenant_membership_role: tenantMembershipRoleJwt,
      },
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
}

apiRouter.post('/register', handleRegister)
apiRouter.post('/auth/register', handleRegister)
apiRouter.post('/auth/signup', handleRegister)

apiRouter.get('/auth/invite-signup-url', requireAuth, async (req, res) => {
  try {
    if (normalizeUserRole(req.user.role) !== 'USER') {
      res
        .status(403)
        .json({ message: '초대 링크는 일반 설계사(USER) 계정에서만 발급할 수 있습니다.' })
      return
    }
    let gaCode = normalizeInviteCode(req.user.gaCode ?? '')
    if (!gaCode) {
      const r = await systemQuery(
        pool,
        `
        SELECT g.code
        FROM users u
        INNER JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.id = $1
        LIMIT 1
        `,
        [req.user.id],
      )
      gaCode = normalizeInviteCode(r.rows[0]?.code ?? '')
    }
    if (!gaCode) {
      res.status(400).json({ message: 'GA 코드를 확인할 수 없습니다.' })
      return
    }
    const refUserId = String(req.user.id).trim()
    const ts = Date.now()
    let sig
    try {
      sig = signInviteSignup(INVITE_SIGNUP_SECRET, gaCode, refUserId, ts)
    } catch (e) {
      if (e?.message === 'invite_signup_missing_secret') {
        res.status(500).json({ message: '서버 설정 오류입니다.' })
        return
      }
      throw e
    }
    const q = new URLSearchParams({
      ga: gaCode,
      ref: refUserId,
      ts: String(ts),
      sig,
    })
    res.json({ path: `/register?${q.toString()}` })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/login', handleLogin)
apiRouter.post('/auth/login', handleLogin)

apiRouter.get('/auth/username-availability', async (req, res) => {
  try {
    const raw = String(req.query.username ?? '').trim()
    if (!isValidSignupUsername(raw)) {
      res.json({ available: false })
      return
    }
    const taken = await isUsernameTakenGlobally(pool, raw)
    res.json({ available: !taken })
  } catch (error) {
    handleDbError(error, req, res)
  }
})
}
