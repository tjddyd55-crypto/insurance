import { r2StorageObjectExists } from '../lib/consentStorage.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { isGeneralGaCompanyCode } from '../lib/generalGa.js'
import {
  buildDefaultAdvisorSlug,
  isAdvisorPublicSlugValid,
  normalizeAdvisorPublicSlug,
} from './publicAdvisorSlug.js'
import { assertAdvisorPublicObjectKeyOwned } from './publicAdvisorMedia.js'
import { normalizeAdvisorProfileTheme } from './publicAdvisorProfileTheme.js'
import {
  buildAdvisorOgCardCacheVersion,
  buildAdvisorOgDescription,
  buildAdvisorOgTitle,
} from './publicAdvisorOgMeta.js'
import { loadCustomContacts, loadVisibleCustomContacts, syncCustomContacts } from './advisorPublicProfileContacts.js'
import { resolveAdvisorPublicPhone } from './resolveAdvisorPublicPhone.js'

const GALLERY_MAX = 6
const HASHTAG_MAX = 5

export function normalizeHashtags(raw) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  const seen = new Set()
  for (const item of list) {
    const tag = String(item ?? '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, '')
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag.slice(0, 40))
    if (out.length >= HASHTAG_MAX) break
  }
  return out
}

async function loadUserContext(pool, userId) {
  const r = await systemQuery(
    pool,
    `
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.phone_number,
      u.role,
      u.status,
      u.is_deleted,
      u.ga_id,
      u.team_id,
      g.name AS ga_name,
      g.code AS ga_code,
      t.name AS team_name
    FROM users u
    LEFT JOIN ga_companies g ON g.id = u.ga_id AND g.is_deleted = false
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId],
  )
  return r.rows[0] ?? null
}

export async function ensureAdvisorProfileRow(pool, userId) {
  const user = await loadUserContext(pool, userId)
  if (!user || user.is_deleted) return null

  const existing = await systemQuery(
    pool,
    `SELECT * FROM advisor_public_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  if (existing.rowCount > 0) return existing.rows[0]

  let slug = buildDefaultAdvisorSlug({
    username: user.username,
    displayName: user.display_name,
    userId: user.id,
  })
  for (let i = 0; i < 8; i += 1) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const dup = await systemQuery(
      pool,
      `SELECT 1 FROM advisor_public_profiles WHERE lower(public_slug) = lower($1) LIMIT 1`,
      [candidate],
    )
    if (dup.rowCount === 0) {
      slug = candidate
      break
    }
  }

  const ins = await systemQuery(
    pool,
    `
    INSERT INTO advisor_public_profiles (
      user_id,
      public_slug,
      hero_display_eyebrow,
      hero_display_title,
      hero_display_subtitle,
      hero_display_eyebrow_visible,
      hero_display_title_visible,
      hero_display_subtitle_visible
    )
    VALUES ($1, $2, 'ONE FC', '홍길동 FC', '영진에셋 · 팀장', true, true, true)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING *
    `,
    [userId, slug],
  )
  if (ins.rowCount > 0) return ins.rows[0]

  const again = await systemQuery(
    pool,
    `SELECT * FROM advisor_public_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  return again.rows[0] ?? null
}

export async function resolveVerificationBadges(pool, user) {
  const badges = []
  const userId = String(user?.id ?? user?.user_id ?? '').trim()
  if (user?.role === 'USER' && user?.status === 'active' && !user?.is_deleted) {
    badges.push({ id: 'onefc_active', label: 'ONE FC 확인' })
  }
  const gaId = parseGaId(user?.ga_id)
  const gaCode = String(user?.ga_code ?? '').trim()
  if (gaId != null && gaCode && !isGeneralGaCompanyCode(gaCode)) {
    badges.push({ id: 'ga_affiliation', label: '소속 GA 확인' })
  }
  if (user?.team_id) {
    badges.push({ id: 'team_linked', label: '지점 연결' })
  }
  if (userId) {
    const appr = await systemQuery(
      pool,
      `
      SELECT 1 FROM ga_membership_approval_requests
      WHERE applicant_user_id = $1 AND status = 'APPROVED'
      LIMIT 1
      `,
      [userId],
    )
    if (appr.rowCount > 0) {
      badges.push({ id: 'ga_approval', label: 'GA 가입 승인' })
    }
  }
  return badges
}

/** 공개 페이지·검색 카드에 노출할 인증 배지(고객용 1개만). */
export function resolvePublicFacingVerificationBadges(badges) {
  const list = Array.isArray(badges) ? badges : []
  const oneFc = list.find((b) => b?.id === 'onefc_active')
  if (!oneFc) return []
  const label = String(oneFc.label ?? 'ONE FC 확인').trim()
  return [{ id: oneFc.id, label: label.startsWith('✓') ? label : `✓ ${label}` }]
}

function buildOfficeLine(profile) {
  const road = String(profile?.office_road_address ?? '').trim()
  const detail = String(profile?.office_address_detail ?? '').trim()
  if (!road && !detail) return ''
  return [road, detail].filter(Boolean).join(' ')
}

async function loadGallery(pool, userId) {
  const r = await systemQuery(
    pool,
    `
    SELECT id, object_key, caption, sort_order
    FROM advisor_public_profile_gallery
    WHERE user_id = $1
    ORDER BY sort_order ASC, created_at ASC
    LIMIT $2
    `,
    [userId, GALLERY_MAX],
  )
  return r.rows
}

export async function getAdvisorProfileForOwner(pool, userId) {
  const row = await ensureAdvisorProfileRow(pool, userId)
  if (!row) return null
  const user = await loadUserContext(pool, userId)
  const gallery = await loadGallery(pool, userId)
  const verificationBadges = await resolveVerificationBadges(pool, user)
  const customContacts = await loadCustomContacts(pool, userId)
  return { profile: row, user, gallery, verificationBadges, customContacts }
}

export async function getPublishedAdvisorBySlug(pool, slug) {
  const normalized = normalizeAdvisorPublicSlug(slug)
  if (!isAdvisorPublicSlugValid(normalized)) return { status: 'invalid' }

  const r = await systemQuery(
    pool,
    `
    SELECT p.*, u.display_name, u.phone_number, u.role, u.status, u.is_deleted, u.ga_id, u.team_id,
           g.name AS ga_name, g.code AS ga_code, t.name AS team_name
    FROM advisor_public_profiles p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN ga_companies g ON g.id = u.ga_id AND g.is_deleted = false
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE lower(p.public_slug) = lower($1)
    LIMIT 1
    `,
    [normalized],
  )
  if (r.rowCount === 0) return { status: 'not_found' }
  const row = r.rows[0]
  if (!row.is_published || row.is_deleted || row.role !== 'USER' || row.status !== 'active') {
    return { status: 'private' }
  }
  const gallery = await loadGallery(pool, row.user_id)
  const customContacts = await loadVisibleCustomContacts(pool, row.user_id)
  const publicUser = {
    displayName: String(row.display_name ?? '').trim(),
    gaName: String(row.ga_name ?? '').trim(),
    teamName: String(row.team_name ?? '').trim(),
    phoneNumber: resolveAdvisorPublicPhone(row),
    kakaoLink: row.show_kakao ? String(row.kakao_link ?? '').trim() : '',
  }
  return {
    status: 'ok',
    profile: {
      userId: row.user_id,
      slug: row.public_slug,
      headline: row.headline,
      bio: row.bio,
      hashtags: row.hashtags ?? [],
      titleLabel: row.title_label == null ? null : String(row.title_label),
      careerText: row.career_text,
      officeLine: buildOfficeLine(row),
      officeRoadAddress: row.office_road_address,
      officeAddressDetail: row.office_address_detail,
      officePostalCode: row.office_postal_code,
      profilePhotoObjectKey: row.profile_photo_object_key,
      businessCardFrontObjectKey: row.business_card_front_object_key,
      businessCardBackObjectKey: row.business_card_back_object_key,
      allowConsultation: row.allow_consultation,
      profileTheme: normalizeAdvisorProfileTheme(row.profile_theme),
      heroDisplayEyebrow:
        row.hero_display_eyebrow == null ? null : String(row.hero_display_eyebrow).trim(),
      heroDisplayTitle: row.hero_display_title == null ? null : String(row.hero_display_title).trim(),
      heroDisplaySubtitle:
        row.hero_display_subtitle == null ? null : String(row.hero_display_subtitle).trim(),
      heroDisplayEyebrowVisible: row.hero_display_eyebrow_visible !== false,
      heroDisplayTitleVisible: row.hero_display_title_visible !== false,
      heroDisplaySubtitleVisible: row.hero_display_subtitle_visible !== false,
      publicPhone: String(row.public_phone ?? '').trim(),
      publicFax: String(row.public_fax ?? '').trim(),
      publicEmail: String(row.public_email ?? '').trim(),
      showPublicPhone: row.show_public_phone !== false,
      showPublicFax: row.show_public_fax === true,
      showPublicEmail: row.show_public_email === true,
      customContacts: customContacts.map((c) => ({
        id: c.id,
        label: String(c.label ?? '').trim(),
        value: String(c.value ?? '').trim(),
        contactType: String(c.contact_type ?? 'text'),
      })),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    },
    user: publicUser,
    gallery,
    verificationBadges: resolvePublicFacingVerificationBadges(
      await resolveVerificationBadges(pool, row),
    ),
  }
}

export async function getAdvisorPublicMetaBySlug(pool, slug) {
  const resolved = await getPublishedAdvisorBySlug(pool, slug)
  if (resolved.status !== 'ok') {
    return { indexable: false, slug: normalizeAdvisorPublicSlug(slug) }
  }
  const title = buildAdvisorOgTitle({
    displayName: resolved.user.displayName,
    heroDisplayTitle: resolved.profile.heroDisplayTitle,
    heroDisplayTitleVisible: resolved.profile.heroDisplayTitleVisible,
  })
  const description = buildAdvisorOgDescription({
    headline: resolved.profile.headline,
  })
  return {
    indexable: true,
    slug: resolved.profile.slug,
    title,
    description,
    profilePhotoObjectKey: resolved.profile.profilePhotoObjectKey,
    // 명함 앞면 patch는 updated_at = NOW()를 같이 기록한다.
    // ?v= 는 그 시각과 business_card_front_object_key 지문을 함께 쓰고,
    // 미디어 updatedAt이 더 새로우면 그 시각을 쓴다.
    ogImageCacheVersion: buildAdvisorOgCardCacheVersion({
      profileUpdatedAt: resolved.profile.updatedAt,
      businessCardFrontObjectKey: resolved.profile.businessCardFrontObjectKey,
    }),
  }
}

export async function searchPublishedAdvisors(pool, { q, limit = 24, offset = 0 }) {
  const term = String(q ?? '').trim()
  const lim = Math.min(Math.max(Number(limit) || 24, 1), 50)
  const off = Math.max(Number(offset) || 0, 0)

  const params = []
  let where = `
    p.is_published = true
    AND u.is_deleted = false
    AND u.role = 'USER'
    AND u.status = 'active'
  `
  if (term) {
    params.push(`%${term}%`)
    where += `
      AND (
        u.display_name ILIKE $1
        OR g.name ILIKE $1
        OR t.name ILIKE $1
        OR p.office_road_address ILIKE $1
        OR p.office_address_sido ILIKE $1
        OR p.office_address_sigungu ILIKE $1
        OR p.headline ILIKE $1
        OR p.bio ILIKE $1
        OR EXISTS (
          SELECT 1 FROM unnest(p.hashtags) AS tag WHERE tag ILIKE $1
        )
      )
    `
  }
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  params.push(lim, off)

  const r = await systemQuery(
    pool,
    `
    SELECT
      p.public_slug,
      p.headline,
      p.hashtags,
      p.profile_photo_object_key,
      u.id,
      u.display_name,
      u.role,
      u.status,
      u.is_deleted,
      u.ga_id,
      u.team_id,
      g.name AS ga_name,
      g.code AS ga_code,
      t.name AS team_name,
      p.office_road_address,
      p.office_address_detail
    FROM advisor_public_profiles p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN ga_companies g ON g.id = u.ga_id AND g.is_deleted = false
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE ${where}
    ORDER BY p.updated_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    params,
  )

  const items = []
  for (const row of r.rows) {
    const verificationBadges = resolvePublicFacingVerificationBadges(
      await resolveVerificationBadges(pool, row),
    )
    items.push({
      slug: row.public_slug,
      displayName: row.display_name,
      gaName: row.ga_name,
      teamName: row.team_name,
      headline: row.headline,
      hashtags: row.hashtags ?? [],
      profilePhotoObjectKey: row.profile_photo_object_key,
      officeLine: buildOfficeLine(row),
      verificationBadges,
    })
  }
  return items
}

export async function patchAdvisorProfileForOwner(pool, userId, patch) {
  const current = await ensureAdvisorProfileRow(pool, userId)
  if (!current) return { ok: false, status: 404, message: '프로필을 찾을 수 없습니다.' }

  const sets = []
  const values = []
  let n = 1

  if (patch.public_slug != null) {
    const slug = normalizeAdvisorPublicSlug(patch.public_slug)
    if (!isAdvisorPublicSlugValid(slug)) {
      return { ok: false, status: 400, message: '공개 주소(slug) 형식이 올바르지 않습니다.' }
    }
    const dup = await systemQuery(
      pool,
      `SELECT 1 FROM advisor_public_profiles WHERE lower(public_slug) = lower($1) AND user_id <> $2 LIMIT 1`,
      [slug, userId],
    )
    if (dup.rowCount > 0) {
      return { ok: false, status: 409, message: '이미 사용 중인 공개 주소입니다.' }
    }
    sets.push(`public_slug = $${n++}`)
    values.push(slug)
  }

  const objectKeyPatchFields = [
    { patchKey: 'profile_photo_object_key', column: 'profile_photo_object_key', label: '대표사진' },
    { patchKey: 'business_card_front_object_key', column: 'business_card_front_object_key', label: '명함 앞면' },
    { patchKey: 'business_card_back_object_key', column: 'business_card_back_object_key', label: '명함 뒷면' },
  ]
  for (const { patchKey, column, label } of objectKeyPatchFields) {
    if (patch[patchKey] == null) continue
    const mediaKey = String(patch[patchKey] ?? '').trim()
    if (!mediaKey) {
      sets.push(`${column} = $${n++}`)
      values.push(null)
    } else if (!assertAdvisorPublicObjectKeyOwned(userId, mediaKey)) {
      return { ok: false, status: 400, message: `${label} 경로가 올바르지 않습니다.` }
    } else if (!(await r2StorageObjectExists(mediaKey))) {
      return { ok: false, status: 400, message: `${label} 업로드가 완료되지 않았습니다. 다시 시도해 주세요.` }
    } else {
      sets.push(`${column} = $${n++}`)
      values.push(mediaKey)
    }
  }

  const textFields = [
    'headline',
    'bio',
    'title_label',
    'career_text',
    'office_road_address',
    'office_address_detail',
    'office_postal_code',
    'office_address_sido',
    'office_address_sigungu',
    'kakao_link',
    'hero_display_eyebrow',
    'hero_display_title',
    'hero_display_subtitle',
    'public_phone',
    'public_fax',
    'public_email',
  ]
  for (const key of textFields) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    if (patch[key] === null) {
      sets.push(`${key} = $${n++}`)
      values.push(null)
      continue
    }
    sets.push(`${key} = $${n++}`)
    values.push(String(patch[key] ?? '').slice(0, key === 'bio' ? 8000 : 500))
  }

  if (patch.hashtags != null) {
    sets.push(`hashtags = $${n++}`)
    values.push(normalizeHashtags(patch.hashtags))
  }

  if (patch.profile_theme != null) {
    sets.push(`profile_theme = $${n++}`)
    values.push(normalizeAdvisorProfileTheme(patch.profile_theme))
  }

  const boolFields = [
    'is_published',
    'show_phone',
    'show_kakao',
    'allow_consultation',
    'hero_display_eyebrow_visible',
    'hero_display_title_visible',
    'hero_display_subtitle_visible',
    'show_public_phone',
    'show_public_fax',
    'show_public_email',
  ]
  for (const key of boolFields) {
    if (patch[key] != null) {
      sets.push(`${key} = $${n++}`)
      values.push(Boolean(patch[key]))
    }
  }

  if (patch.custom_contacts != null) {
    await syncCustomContacts(pool, userId, patch.custom_contacts)
  }

  if (sets.length === 0) {
    const refreshed = await systemQuery(
      pool,
      `SELECT * FROM advisor_public_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    )
    return { ok: true, profile: refreshed.rows[0] ?? current }
  }

  if (patch.is_published === true) {
    sets.push(`published_at = COALESCE(published_at, NOW())`)
  }
  if (patch.is_published === false) {
    sets.push(`published_at = NULL`)
  }

  sets.push(`updated_at = NOW()`)
  values.push(userId)

  const r = await systemQuery(
    pool,
    `
    UPDATE advisor_public_profiles
    SET ${sets.join(', ')}
    WHERE user_id = $${n}
    RETURNING *
    `,
    values,
  )
  return { ok: true, profile: r.rows[0] }
}

export async function recordAdvisorPublicEvent(pool, { advisorUserId, eventType, source }) {
  const uid = String(advisorUserId ?? '').trim()
  const type = String(eventType ?? '').trim()
  if (!uid || !type) return
  await systemQuery(
    pool,
    `
    INSERT INTO advisor_public_profile_events (advisor_user_id, event_type, source)
    VALUES ($1, $2, $3)
    `,
    [uid, type.slice(0, 64), source ? String(source).slice(0, 64) : null],
  )
}

export { GALLERY_MAX, HASHTAG_MAX }
