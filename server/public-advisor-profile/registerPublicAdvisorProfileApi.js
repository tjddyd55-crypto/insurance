import { randomUUID } from 'node:crypto'
import { parseGaId } from '../lib/parseGaId.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import { getR2PublicCdnBase } from '../lib/consentStorage.js'
import {
  getAdvisorProfileForOwner,
  getPublishedAdvisorBySlug,
  patchAdvisorProfileForOwner,
  recordAdvisorPublicEvent,
  searchPublishedAdvisors,
} from './publicAdvisorProfileService.js'

function publicMediaUrl(objectKey) {
  const key = String(objectKey ?? '').trim()
  if (!key) return null
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  return `${base}/${key.replace(/^\//, '')}`
}

function mapPublicProfilePayload(resolved) {
  const { profile, user, gallery, verificationBadges } = resolved
  return {
    slug: profile.slug,
    headline: profile.headline,
    bio: profile.bio,
    hashtags: profile.hashtags,
    titleLabel: profile.titleLabel,
    careerText: profile.careerText,
    officeLine: profile.officeLine,
    displayName: user.displayName,
    gaName: user.gaName,
    teamName: user.teamName,
    phoneNumber: user.phoneNumber,
    kakaoLink: user.kakaoLink,
    allowConsultation: profile.allowConsultation,
    profilePhotoUrl: publicMediaUrl(profile.profilePhotoObjectKey),
    gallery: gallery.map((g) => ({
      id: g.id,
      caption: g.caption,
      sortOrder: g.sort_order,
      imageUrl: publicMediaUrl(g.object_key),
    })),
    verificationBadges,
  }
}

function requireUserRole(req, res) {
  const role = String(req.user?.role ?? '').trim()
  if (role !== 'USER') {
    res.status(403).json({ message: '공개 프로필은 일반 설계사(USER) 계정에서만 이용할 수 있습니다.' })
    return false
  }
  return true
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerPublicAdvisorProfileApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/public/experts', async (req, res) => {
    try {
      const q = String(req.query?.q ?? '')
      const items = await searchPublishedAdvisors(pool, { q }).map((item) => ({
        ...item,
        profilePhotoUrl: publicMediaUrl(item.profilePhotoObjectKey),
        profilePhotoObjectKey: undefined,
      }))
      res.json({ items })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.get('/public/advisors/:slug', async (req, res) => {
    try {
      const resolved = await getPublishedAdvisorBySlug(pool, req.params.slug)
      if (resolved.status === 'invalid' || resolved.status === 'not_found' || resolved.status === 'private') {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      void recordAdvisorPublicEvent(pool, {
        advisorUserId: resolved.profile?.userId,
        eventType: 'profile_view',
        source: 'public',
      }).catch(() => {})
      res.json(mapPublicProfilePayload({
        profile: resolved.profile,
        user: resolved.user,
        gallery: resolved.gallery,
        verificationBadges: resolved.verificationBadges,
      }))
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.get('/me/public-profile', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const data = await getAdvisorProfileForOwner(pool, req.user.id)
      if (!data) {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`
      res.json({
        profile: data.profile,
        user: {
          displayName: data.user?.display_name,
          gaName: data.user?.ga_name,
          teamName: data.user?.team_name,
          phoneNumber: data.user?.phone_number,
        },
        gallery: data.gallery.map((g) => ({
          id: g.id,
          caption: g.caption,
          sortOrder: g.sort_order,
          objectKey: g.object_key,
          imageUrl: publicMediaUrl(g.object_key),
        })),
        verificationBadges: data.verificationBadges,
        publicUrl: `${baseUrl}/fc/${data.profile.public_slug}`,
        profilePhotoUrl: publicMediaUrl(data.profile.profile_photo_object_key),
      })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.patch('/me/public-profile', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const body = req.body ?? {}
      const result = await patchAdvisorProfileForOwner(pool, req.user.id, body)
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message ?? '저장에 실패했습니다.' })
        return
      }
      res.json({ profile: result.profile })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.post('/public/advisors/:slug/consultations', async (req, res) => {
    try {
      const resolved = await getPublishedAdvisorBySlug(pool, req.params.slug)
      if (resolved.status !== 'ok') {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      if (!resolved.profile.allowConsultation) {
        res.status(403).json({ message: '상담 신청을 받지 않는 프로필입니다.' })
        return
      }

      const body = req.body ?? {}
      const name = String(body.name ?? '').trim()
      const message = String(body.message ?? '').trim()
      const contactChannel = String(body.contactChannel ?? body.contact_channel ?? '').trim().toLowerCase()
      const privacyConsent = body.privacyConsent === true || body.privacy_consent === true
      const phoneRaw = String(body.phone ?? body.phoneNumber ?? '').trim()
      const phoneDigits = normalizeKrMobile(phoneRaw)
      const phoneCheck = validateKrMobileDigits(phoneDigits)

      if (!name || name.length < 2) {
        res.status(400).json({ message: '이름을 입력해 주세요.' })
        return
      }
      if (!phoneCheck.ok) {
        res.status(400).json({ message: phoneCheck.message ?? '연락처를 확인해 주세요.' })
        return
      }
      if (message.length < 5) {
        res.status(400).json({ message: '문의 내용을 5자 이상 입력해 주세요.' })
        return
      }
      if (!['phone', 'sms', 'kakao'].includes(contactChannel)) {
        res.status(400).json({ message: '연락 희망 방식을 선택해 주세요.' })
        return
      }
      if (!privacyConsent) {
        res.status(400).json({ message: '개인정보 제공 동의가 필요합니다.' })
        return
      }

      const advisorUserId = resolved.profile.userId

      const leadId = randomUUID()
      await systemQuery(
        pool,
        `
        INSERT INTO advisor_consultation_leads (
          id, advisor_user_id, visitor_name, phone_normalized, phone_display,
          message, contact_channel, privacy_consent, privacy_consent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        `,
        [leadId, advisorUserId, name, phoneDigits, phoneRaw, message.slice(0, 2000), contactChannel],
      )

      const gaRow = await systemQuery(pool, `SELECT ga_id FROM users WHERE id = $1`, [advisorUserId])
      const gaId = parseGaId(gaRow.rows[0]?.ga_id)
      if (gaId != null) {
        await safeQuery(
          pool,
          `
          INSERT INTO notifications (user_id, ga_id, type, reference_id, message)
          VALUES ($1, $2, 'advisor_consultation_lead', $3, $4)
          `,
          [advisorUserId, gaId, leadId, `${name}님의 상담 신청이 도착했습니다.`],
        )
      }

      void recordAdvisorPublicEvent(pool, {
        advisorUserId,
        eventType: 'consultation_submit',
        source: 'public',
      }).catch(() => {})

      res.status(201).json({ ok: true, id: leadId })
    } catch (e) {
      handleDbError(res, e)
    }
  })
}
