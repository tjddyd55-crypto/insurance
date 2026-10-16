/**
 * Development 미디어 delivery 검증 (01850d3a+).
 * Usage: node --env-file=server/.env.local scripts/qa/verify-public-advisor-media-dev.mjs
 */
const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.PUBLIC_ADVISOR_QA_SLUG ?? 'qa-public-advisor-dev'

const failures = []

function fail(msg) {
  failures.push(msg)
  console.error('FAIL', msg)
}

function pass(msg) {
  console.log('PASS', msg)
}

async function headOk(url, label, minBytes = 100) {
  const res = await fetch(url, { method: 'GET' })
  const buf = await res.arrayBuffer()
  if (!res.ok) {
    fail(`${label}: HTTP ${res.status}`)
    return false
  }
  if (buf.byteLength < minBytes) {
    fail(`${label}: body too small (${buf.byteLength} bytes) — 1×1 테스트 이미지 가능성`)
    return false
  }
  pass(`${label}: ${res.status} ${buf.byteLength} bytes`)
  return true
}

async function main() {
  const pub = await fetch(`${BASE}/api/public/advisors/${SLUG}`)
  if (!pub.ok) {
    fail(`public profile API ${pub.status}`)
    process.exit(1)
  }
  const data = await pub.json()
  const gallery = data.gallery ?? []
  if (!data.profilePhotoUrl) fail('profilePhotoUrl missing')
  else await headOk(data.profilePhotoUrl, 'profile photo delivery')

  if (gallery.length !== 6) fail(`gallery count ${gallery.length} (expected 6)`)
  else pass('gallery count 6')

  for (let i = 0; i < gallery.length; i += 1) {
    const url = gallery[i]?.imageUrl
    if (!url) {
      fail(`gallery[${i}] missing imageUrl`)
      continue
    }
    await headOk(url, `gallery[${i}] delivery`)
  }

  const sampleUrl = data.profilePhotoUrl
  if (sampleUrl?.includes('key=')) {
    const u = new URL(sampleUrl)
    const normalizedKey = u.searchParams.get('key') ?? ''
    const legacyKey = normalizedKey.startsWith('insurance/advisor-public/')
      ? normalizedKey.slice('insurance/'.length)
      : ''
    if (legacyKey) {
      const legacyUrl = `${BASE}/api/public/advisor-media?key=${encodeURIComponent(legacyKey)}`
      const legacyRes = await fetch(legacyUrl)
      if (!legacyRes.ok) fail(`legacy key variant ${legacyRes.status}`)
      else pass(`legacy key variant ${legacyRes.status}`)
    }
  }

  if (failures.length) {
    console.error('\nVerification failed:', failures.length)
    process.exit(1)
  }
  console.log('\nAll media delivery checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
