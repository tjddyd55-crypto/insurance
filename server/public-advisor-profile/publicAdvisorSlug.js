const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/

const RESERVED_SLUGS = new Set([
  'experts',
  'fc',
  'api',
  'admin',
  'login',
  'register',
  'introduction',
  'facebook',
  'dashboard',
  'profile',
])

export function normalizeAdvisorPublicSlug(raw) {
  const base = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base.slice(0, 50)
}

export function isAdvisorPublicSlugValid(slug) {
  const s = normalizeAdvisorPublicSlug(slug)
  if (s.length < 3 || s.length > 50) return false
  if (!SLUG_PATTERN.test(s)) return false
  if (RESERVED_SLUGS.has(s)) return false
  return true
}

export function buildDefaultAdvisorSlug({ username, displayName, userId }) {
  const fromName = normalizeAdvisorPublicSlug(displayName)
  if (isAdvisorPublicSlugValid(fromName)) return fromName
  const fromUsername = normalizeAdvisorPublicSlug(username)
  if (isAdvisorPublicSlugValid(fromUsername)) return fromUsername
  const suffix = String(userId ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLowerCase()
  const fallback = normalizeAdvisorPublicSlug(`fc-${suffix || 'profile'}`)
  return isAdvisorPublicSlugValid(fallback) ? fallback : `fc-${suffix || 'user'}`.slice(0, 50)
}
