import sharp from 'sharp'
import { promiseWithTimeout } from '../lib/promiseWithTimeout.js'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'
import { resolveAdvisorHeroDisplayLines } from './resolveAdvisorHeroDisplayLines.js'

const W = ADVISOR_OG_IMAGE_WIDTH
const H = ADVISOR_OG_IMAGE_HEIGHT
const OG_PHOTO_META_TIMEOUT_MS = 3_000
const OG_PHOTO_PREPARE_TIMEOUT_MS = 8_000
const MIN_OG_PHOTO_BYTES = 256

/** @type {Promise<Buffer> | null} */
let defaultOgPhotoPromise = null

function getDefaultOgPhotoBuffer() {
  if (!defaultOgPhotoPromise) {
    defaultOgPhotoPromise = sharp({
      create: { width: 480, height: 600, channels: 3, background: { r: 148, g: 163, b: 184 } },
    })
      .png()
      .toBuffer()
  }
  return defaultOgPhotoPromise
}

/**
 * @param {Buffer | null | undefined} photoBuffer
 * @param {boolean} [forceFallback]
 */
async function resolveOgPhotoBuffer(photoBuffer, forceFallback = false) {
  if (forceFallback || !photoBuffer || photoBuffer.length < MIN_OG_PHOTO_BYTES) {
    return getDefaultOgPhotoBuffer()
  }
  try {
    const meta = await promiseWithTimeout(
      sharp(photoBuffer).rotate().metadata(),
      OG_PHOTO_META_TIMEOUT_MS,
      'ogPhotoMetadata',
    )
    if (!meta.width || !meta.height || meta.width < 32 || meta.height < 32) {
      return getDefaultOgPhotoBuffer()
    }
    return photoBuffer
  } catch {
    return getDefaultOgPhotoBuffer()
  }
}

/**
 * @param {Buffer} source
 */
async function prepareOgCoverPhoto(source) {
  return promiseWithTimeout(
    sharp(source)
      .rotate()
      .resize(1400, 1400, { fit: 'inside', withoutEnlargement: false })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer(),
    OG_PHOTO_PREPARE_TIMEOUT_MS,
    'ogPhotoPrepare',
  )
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(value, max) {
  const s = String(value ?? '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/**
 * @param {{
 *   theme: 'classic' | 'brand' | 'premium'
 *   photoBuffer: Buffer
 *   heroDisplayEyebrow?: string | null
 *   heroDisplayTitle?: string | null
 *   heroDisplaySubtitle?: string | null
 *   heroDisplayEyebrowVisible?: boolean | null
 *   heroDisplayTitleVisible?: boolean | null
 *   heroDisplaySubtitleVisible?: boolean | null
 *   verificationBadgeLabel?: string | null
 *   forcePhotoFallback?: boolean
 * }} input
 */
function buildHeroCentricOverlaySvg(theme, eyebrow, title, subtitle) {
  const isClassic = theme === 'classic'
  const titleColor = isClassic ? '#111827' : '#ffffff'
  const subColor = isClassic ? '#374151' : 'rgba(255,255,255,0.92)'
  const eyebrowColor = isClassic ? '#6b7280' : 'rgba(255,255,255,0.82)'

  let gradientStops
  if (theme === 'brand') {
    gradientStops = `
      <stop offset="35%" stop-color="rgba(37,99,235,0)"/>
      <stop offset="100%" stop-color="rgba(30,64,175,0.82)"/>`
  } else if (theme === 'premium') {
    gradientStops = `
      <stop offset="40%" stop-color="rgba(15,23,42,0)"/>
      <stop offset="100%" stop-color="rgba(8,20,40,0.88)"/>`
  } else {
    gradientStops = `
      <stop offset="45%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.9)"/>`
  }

  const lines = []
  let y = 520
  if (subtitle) {
    lines.push(
      `<text x="64" y="${y}" fill="${subColor}" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(subtitle)}</text>`,
    )
    y -= 52
  }
  if (title) {
    lines.push(
      `<text x="64" y="${y}" fill="${titleColor}" font-family="Arial, sans-serif" font-size="52" font-weight="800">${escapeXml(title)}</text>`,
    )
    y -= 44
  }
  if (eyebrow) {
    lines.push(
      `<text x="64" y="${y}" fill="${eyebrowColor}" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(eyebrow)}</text>`,
    )
  }

  return `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ogHeroGrad" x1="0" y1="0" x2="0" y2="1">
          ${gradientStops}
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#ogHeroGrad)"/>
      ${lines.join('\n')}
    </svg>`
}

export async function renderAdvisorMobileCardOgPng(input) {
  const theme = input.theme === 'brand' || input.theme === 'premium' ? input.theme : 'classic'
  const hero = resolveAdvisorHeroDisplayLines(input)
  const eyebrow = truncate(hero.eyebrow, 32)
  const title = truncate(hero.title, 28)
  const subtitle = truncate(hero.subtitle, 42)

  const source = await resolveOgPhotoBuffer(input.photoBuffer, Boolean(input.forcePhotoFallback))
  const prepared = await prepareOgCoverPhoto(source)

  const bgBlur = await sharp(prepared).resize(W, H, { fit: 'cover', position: 'centre' }).blur(18).png().toBuffer()
  const portraitHeight = Math.round(H * 0.92)
  const portraitWidth = Math.round(portraitHeight * 0.78)
  const portrait = await sharp(prepared)
    .resize(portraitWidth, portraitHeight, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  const portraitLeft = Math.floor((W - portraitWidth) / 2)
  const portraitTop = Math.floor((H - portraitHeight) / 2) - 24

  const overlaySvg = buildHeroCentricOverlaySvg(theme, eyebrow, title, subtitle)

  return sharp(bgBlur)
    .composite([
      { input: portrait, left: portraitLeft, top: Math.max(0, portraitTop) },
      { input: Buffer.from(overlaySvg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
