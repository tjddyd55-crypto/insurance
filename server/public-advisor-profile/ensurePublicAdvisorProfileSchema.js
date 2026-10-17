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
      profile_theme TEXT NOT NULL DEFAULT 'classic',
      business_card_front_object_key TEXT,
      business_card_back_object_key TEXT,
      CONSTRAINT advisor_public_profiles_hashtags_max5
        CHECK (cardinality(hashtags) <= 5),
      CONSTRAINT advisor_public_profiles_profile_theme_check
        CHECK (profile_theme IN ('classic', 'brand', 'premium'))
    )
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS profile_theme TEXT NOT NULL DEFAULT 'classic'
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS business_card_front_object_key TEXT
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS business_card_back_object_key TEXT
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_eyebrow TEXT NOT NULL DEFAULT ''
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_title TEXT NOT NULL DEFAULT ''
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_subtitle TEXT NOT NULL DEFAULT ''
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_eyebrow DROP NOT NULL
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_title DROP NOT NULL
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_subtitle DROP NOT NULL
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN title_label DROP NOT NULL
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_eyebrow DROP DEFAULT
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_title DROP DEFAULT
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN hero_display_subtitle DROP DEFAULT
  `).catch(() => {})

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ALTER COLUMN title_label DROP DEFAULT
  `).catch(() => {})

  await executor.query(`
    UPDATE advisor_public_profiles
    SET hero_display_eyebrow = NULL
    WHERE hero_display_eyebrow IS NOT NULL AND btrim(hero_display_eyebrow) = ''
  `)

  await executor.query(`
    UPDATE advisor_public_profiles
    SET hero_display_title = NULL
    WHERE hero_display_title IS NOT NULL AND btrim(hero_display_title) = ''
  `)

  await executor.query(`
    UPDATE advisor_public_profiles
    SET hero_display_subtitle = NULL
    WHERE hero_display_subtitle IS NOT NULL AND btrim(hero_display_subtitle) = ''
  `)

  await executor.query(`
    UPDATE advisor_public_profiles
    SET title_label = NULL
    WHERE title_label IS NOT NULL AND btrim(title_label) = ''
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_eyebrow_visible BOOLEAN NOT NULL DEFAULT true
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_title_visible BOOLEAN NOT NULL DEFAULT true
  `)

  await executor.query(`
    ALTER TABLE advisor_public_profiles
    ADD COLUMN IF NOT EXISTS hero_display_subtitle_visible BOOLEAN NOT NULL DEFAULT true
  `)

  await executor.query(`
    DO $$
    BEGIN
      ALTER TABLE advisor_public_profiles
        ADD CONSTRAINT advisor_public_profiles_profile_theme_check
        CHECK (profile_theme IN ('classic', 'brand', 'premium'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
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
