import { randomUUID } from 'node:crypto'
import { parseGaId } from '../lib/parseGaId.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import {
  addGalleryItem,
  deleteGalleryItem,
  reorderGallery,
  updateGalleryCaption,
} from './publicAdvisorGalleryService.js'
import { ADVISOR_PUBLIC_EVENT_TYPES } from './publicAdvisorEvents.js'
import {
  assertConsultationRateLimit,
  consultationRateLimitKey,
} from './publicAdvisorConsultationRateLimit.js'
import {
  ADVISOR_PROFILE_MEDIA_MAX_BYTES,
  ADVISOR_PUBLIC_MEDIA_MAX_BYTES,
  assertAdvisorPublicObjectKeyOwned,
  createAdvisorPresignedUpload,
  isAdvisorImageContentType,
  normalizeAdvisorPublicMediaKind,
} from './publicAdvisorMedia.js'
import {
  advisorPublicMediaUrl,
  assertAdvisorPublicMediaDeliverable,
  guessAdvisorPublicMediaContentType,
  readAdvisorPublicMediaBuffer,
} from './publicAdvisorMediaDelivery.js'
import { consentPutInsurerAttachment, isConsentR2Enabled } from '../lib/consentStorage.js'
import {
  getAdvisorProfileForOwner,
  getPublishedAdvisorBySlug,
  patchAdvisorProfileForOwner,
  recordAdvisorPublicEvent,
  searchPublishedAdvisors,
} from './publicAdvisorProfileService.js'
import { ADVISOR_OG_HEADLINE_FALLBACK } from './publicAdvisorOgMeta.js'
import { renderAdvisorMobileCardOgPng } from './renderAdvisorMobileCardOgImage.js'
import { resolveRequestPublicOrigin } from './requestPublicOrigin.js'

const PUBLIC_EVENT_WHITELIST = new Set(Object.values(ADVISOR_PUBLIC_EVENT_TYPES))

function publicMediaUrl(objectKey, req) {
  const origin = req ? resolveRequestPublicOrigin(req) : ''
  return advisorPublicMediaUrl(objectKey, origin)
}

function mapPublicProfilePayload(resolved, req) {
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
    profileTheme: profile.profileTheme,
    heroDisplayEyebrow: profile.heroDisplayEyebrow ?? '',
    heroDisplayTitle: profile.heroDisplayTitle ?? '',
    heroDisplaySubtitle: profile.heroDisplaySubtitle ?? '',
    profilePhotoUrl: publicMediaUrl(profile.profilePhotoObjectKey, req),
    businessCardFrontUrl: publicMediaUrl(profile.businessCardFrontObjectKey, req),
    businessCardBackUrl: null,
    gallery: gallery.map((g) => ({
      id: g.id,
      caption: g.caption,
      sortOrder: g.sort_order,
      imageUrl: publicMediaUrl(g.object_key, req),
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

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return forwarded || String(req.socket?.remoteAddress ?? 'unknown')
}

async function readRawBodyBuffer(req, maxBytes) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      const err = new Error('파일 크기가 허용 범위를 벗어났습니다.')
      err.httpStatus = 400
      throw err
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerPublicAdvisorProfileApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/public/advisor-media', async (req, res) => {
    try {
      const objectKey = String(req.query?.key ?? '').trim()
      if (!objectKey) {
        res.status(400).json({ message: 'key가 필요합니다.' })
        return
      }
      const allowed = await assertAdvisorPublicMediaDeliverable(pool, objectKey)
      if (!allowed) {
        res.status(404).end()
        return
      }
      const body = await readAdvisorPublicMediaBuffer(objectKey)
      const contentType = guessAdvisorPublicMediaContentType(objectKey)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      res.send(body)
    } catch (e) {
      res.status(404).end()
    }
  })

  apiRouter.get('/public/experts', async (req, res) => {
    try {
      const q = String(req.query?.q ?? '')
      const rows = await searchPublishedAdvisors(pool, { q })
      const items = rows.map((item) => ({
        ...item,
        profilePhotoUrl: publicMediaUrl(item.profilePhotoObjectKey, req),
        profilePhotoObjectKey: undefined,
      }))
      res.json({ items })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.get('/public/advisors/:slug/og-card.png', async (req, res) => {
    try {
      const resolved = await getPublishedAdvisorBySlug(pool, req.params.slug)
      if (resolved.status !== 'ok') {
        res.status(404).end()
        return
      }
      const photoKey = resolved.profile.profilePhotoObjectKey
      if (!photoKey) {
        res.status(404).end()
        return
      }
      let photoBuffer
      try {
        photoBuffer = await readAdvisorPublicMediaBuffer(photoKey)
      } catch {
        res.status(404).end()
        return
      }
      const affiliationLine = [resolved.user.gaName, resolved.user.teamName].filter(Boolean).join(' · ')
      const headline = String(resolved.profile.headline ?? '').trim() || ADVISOR_OG_HEADLINE_FALLBACK
      const titleSuffix = String(resolved.profile.titleLabel ?? 'FC').trim() || 'FC'
      const png = await renderAdvisorMobileCardOgPng({
        theme: resolved.profile.profileTheme ?? 'classic',
        displayName: resolved.user.displayName,
        titleSuffix,
        affiliationLine,
        headline,
        photoBuffer,
      })
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=86400')
      res.send(png)
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
        eventType: ADVISOR_PUBLIC_EVENT_TYPES.PROFILE_VIEW,
        source: 'public',
      }).catch(() => {})
      res.json(
        mapPublicProfilePayload(
          {
            profile: resolved.profile,
            user: resolved.user,
            gallery: resolved.gallery,
            verificationBadges: resolved.verificationBadges,
          },
          req,
        ),
      )
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.post('/public/advisors/:slug/events', async (req, res) => {
    try {
      const resolved = await getPublishedAdvisorBySlug(pool, req.params.slug)
      if (resolved.status !== 'ok') {
        res.status(404).json({ message: '프로필을 찾을 수 없습니다.' })
        return
      }
      const rawType = String(req.body?.eventType ?? req.body?.event_type ?? '').trim()
      const eventType = rawType.toUpperCase()
      if (!PUBLIC_EVENT_WHITELIST.has(eventType)) {
        res.status(400).json({ message: '지원하지 않는 이벤트입니다.' })
        return
      }
      void recordAdvisorPublicEvent(pool, {
        advisorUserId: resolved.profile.userId,
        eventType,
        source: 'public',
      }).catch(() => {})
      res.status(204).end()
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
          imageUrl: publicMediaUrl(g.object_key, req),
        })),
        verificationBadges: data.verificationBadges,
        publicUrl: `${baseUrl}/fc/${data.profile.public_slug}`,
        profilePhotoUrl: publicMediaUrl(data.profile.profile_photo_object_key, req),
        businessCardFrontUrl: publicMediaUrl(data.profile.business_card_front_object_key, req),
        businessCardBackUrl: null,
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

  apiRouter.post('/me/public-profile/media/presign', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const body = req.body ?? {}
      const kind = normalizeAdvisorPublicMediaKind(body.kind)
      const result = await createAdvisorPresignedUpload({
        userId: req.user.id,
        kind,
        fileName: body.fileName ?? body.file_name,
        contentType: body.contentType ?? body.content_type,
        sizeBytes: body.sizeBytes ?? body.size_bytes,
      })
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message })
        return
      }
      res.json({
        uploadUrl: result.uploadUrl,
        objectKey: result.objectKey,
        contentType: result.contentType,
        putHeaders: result.putHeaders ?? {},
        publicUrl: publicMediaUrl(result.objectKey, req),
      })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.put('/me/public-profile/media/upload-proxy', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      if (!isConsentR2Enabled()) {
        res.status(503).json({ message: '파일 저장소가 준비되지 않았습니다.' })
        return
      }
      const objectKey = String(req.query.objectKey ?? req.query.object_key ?? '').trim()
      const kind = normalizeAdvisorPublicMediaKind(req.query.kind)
      const maxBytes =
        kind === 'profile' ? ADVISOR_PROFILE_MEDIA_MAX_BYTES : ADVISOR_PUBLIC_MEDIA_MAX_BYTES
      const contentTypeRaw = String(req.query.contentType ?? req.query.content_type ?? '').trim()
      const headerType = String(req.headers['content-type'] ?? '').split(';')[0].trim()
      const contentType = (contentTypeRaw || headerType).toLowerCase()
      if (!objectKey) {
        res.status(400).json({ message: 'objectKey가 필요합니다.' })
        return
      }
      if (!assertAdvisorPublicObjectKeyOwned(req.user.id, objectKey)) {
        res.status(400).json({ message: '허용되지 않은 저장 경로입니다.' })
        return
      }
      if (!isAdvisorImageContentType(contentType)) {
        res.status(400).json({ message: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.' })
        return
      }
      const bodyBuffer = await readRawBodyBuffer(req, maxBytes)
      if (!bodyBuffer.length) {
        res.status(400).json({ message: '업로드 본문이 비어 있습니다.' })
        return
      }
      await consentPutInsurerAttachment(objectKey, bodyBuffer, contentType)
      res.status(204).end()
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({
          message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.',
        })
        return
      }
      handleDbError(res, e)
    }
  })

  apiRouter.post('/me/public-profile/gallery', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const objectKey = String(req.body?.objectKey ?? req.body?.object_key ?? '').trim()
      const caption = req.body?.caption
      const result = await addGalleryItem(pool, req.user.id, { objectKey, caption })
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message })
        return
      }
      res.status(201).json({
        item: {
          id: result.item.id,
          caption: result.item.caption,
          sortOrder: result.item.sort_order,
          objectKey: result.item.object_key,
          imageUrl: publicMediaUrl(result.item.object_key, req),
        },
      })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.put('/me/public-profile/gallery/reorder', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const orderedIds = req.body?.orderedIds ?? req.body?.ordered_ids
      const result = await reorderGallery(pool, req.user.id, orderedIds)
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message })
        return
      }
      res.json({ ok: true })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.patch('/me/public-profile/gallery/:galleryId', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const result = await updateGalleryCaption(pool, req.user.id, req.params.galleryId, req.body?.caption)
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message })
        return
      }
      res.json({
        item: {
          id: result.item.id,
          caption: result.item.caption,
          sortOrder: result.item.sort_order,
          objectKey: result.item.object_key,
          imageUrl: publicMediaUrl(result.item.object_key, req),
        },
      })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.delete('/me/public-profile/gallery/:galleryId', requireAuth, async (req, res) => {
    try {
      if (!requireUserRole(req, res)) return
      const result = await deleteGalleryItem(pool, req.user.id, req.params.galleryId)
      if (!result.ok) {
        res.status(result.status ?? 400).json({ message: result.message })
        return
      }
      res.json({ ok: true })
    } catch (e) {
      handleDbError(res, e)
    }
  })

  apiRouter.post('/public/advisors/:slug/consultations', async (req, res) => {
    try {
      const ip = clientIp(req)
      const rl = assertConsultationRateLimit(consultationRateLimitKey(ip))
      if (!rl.ok) {
        res.status(429).json({ message: '잠시 후 다시 시도해 주세요.' })
        return
      }

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
      const phoneErr = validateKrMobileDigits(phoneDigits)

      if (!name || name.length < 2) {
        res.status(400).json({ message: '이름을 입력해 주세요.' })
        return
      }
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
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
        await systemQuery(
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
        eventType: ADVISOR_PUBLIC_EVENT_TYPES.CONSULTATION_SUBMIT,
        source: 'public',
      }).catch(() => {})

      res.status(201).json({ ok: true, id: leadId })
    } catch (e) {
      handleDbError(res, e)
    }
  })
}
