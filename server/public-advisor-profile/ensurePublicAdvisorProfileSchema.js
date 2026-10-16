/**
 * 설계사 공개 프로필·갤러리·상담 리드·이벤트 로그 (idempotent).
 *
 * @param {{ query: Function }} executor
 */
export async function ensurePublicAdvisorProfileSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS advisor_public_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      public_slug TEXT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT false,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      hashtags TEXT[] NOT NULL DEFAULT '{}',
      title_label TEXT NOT NULL DEFAULT '',
      career_text TEXT NOT NULL DEFAULT '',
      office_road_address TEXT NOT NULL DEFAULT '',
      office_address_detail TEXT NOT NULL DEFAULT '',
      office_postal_code TEXT NOT NULL DEFAULT '',
      office_address_sido TEXT NOT NULL DEFAULT '',
      office_address_sigungu TEXT NOT NULL DEFAULT '',
      profile_photo_object_key TEXT,
      show_phone BOOLEAN NOT NULL DEFAULT true,
      show_kakao BOOLEAN NOT NULL DEFAULT false,
      kakao_link TEXT NOT NULL DEFAULT '',
      allow_consultation BOOLEAN NOT NULL DEFAULT true,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT advisor_public_profiles_hashtags_max5
        CHECK (cardinality(hashtags) <= 5)
    )
  `)

  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_advisor_public_profiles_slug
    ON advisor_public_profiles (lower(public_slug))
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_advisor_public_profiles_published
    ON advisor_public_profiles (is_published, updated_at DESC)
    WHERE is_published = true
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS advisor_public_profile_gallery (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      object_key TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT advisor_public_profile_gallery_sort_order_range
        CHECK (sort_order >= 0 AND sort_order < 6)
    )
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_advisor_public_profile_gallery_user_sort
    ON advisor_public_profile_gallery (user_id, sort_order ASC, created_at ASC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS advisor_consultation_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      advisor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      visitor_name TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      phone_display TEXT NOT NULL,
      message TEXT NOT NULL,
      contact_channel TEXT NOT NULL,
      privacy_consent BOOLEAN NOT NULL,
      privacy_consent_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT advisor_consultation_leads_channel_check
        CHECK (contact_channel IN ('phone', 'sms', 'kakao'))
    )
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_advisor_consultation_leads_advisor_created
    ON advisor_consultation_leads (advisor_user_id, created_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS advisor_public_profile_events (
      id BIGSERIAL PRIMARY KEY,
      advisor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_advisor_public_profile_events_advisor_created
    ON advisor_public_profile_events (advisor_user_id, created_at DESC)
  `)
}
