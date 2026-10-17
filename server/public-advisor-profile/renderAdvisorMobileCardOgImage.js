import sharp from 'sharp'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'
import { resolveAdvisorHeroDisplayLines } from './resolveAdvisorHeroDisplayLines.js'

const W = ADVISOR_OG_IMAGE_WIDTH
const H = ADVISOR_OG_IMAGE_HEIGHT

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
 * }} input
 */
export async function renderAdvisorMobileCardOgPng(input) {
  const theme = input.theme === 'brand' || input.theme === 'premium' ? input.theme : 'classic'
  const hero = resolveAdvisorHeroDisplayLines(input)
  const eyebrow = truncate(hero.eyebrow, 32)
  const title = truncate(hero.title, 28)
  const subtitle = truncate(hero.subtitle, 42)
  const verify = truncate(input.verificationBadgeLabel, 24)

  const photo = await sharp(input.photoBuffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()

  if (theme === 'classic') {
    const photoPanel = await sharp(photo).resize(500, H, { fit: 'cover', position: 'top' }).png().toBuffer()
    let textY = 120
    const lines = []
    if (eyebrow) {
      lines.push(
        `<text x="540" y="${textY}" fill="#6b7280" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(eyebrow)}</text>`,
      )
      textY += 52
    } else {
      lines.push(
        `<text x="540" y="${textY}" fill="#6b7280" font-family="Arial, sans-serif" font-size="20" font-weight="700">ONE FC</text>`,
      )
      textY += 44
    }
    if (title) {
      lines.push(
        `<text x="540" y="${textY + 50}" fill="#111827" font-family="Arial, sans-serif" font-size="52" font-weight="800">${escapeXml(title)}</text>`,
      )
      textY += 110
    }
    if (subtitle) {
      lines.push(
        `<text x="540" y="${textY}" fill="#374151" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(subtitle)}</text>`,
      )
      textY += 44
    }
    if (verify) {
      lines.push(
        `<text x="540" y="${textY + 20}" fill="#2563eb" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(verify)}</text>`,
      )
    }
    const textSvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="500" y="0" width="${W - 500}" height="${H}" fill="#ffffff"/>
        ${lines.join('\n')}
      </svg>`
    return sharp({
      create: { width: W, height: H, channels: 4, background: '#ffffff' },
    })
      .composite([
        { input: photoPanel, left: 0, top: 0 },
        { input: Buffer.from(textSvg), left: 0, top: 0 },
      ])
      .png()
      .toBuffer()
  }

  if (theme === 'brand') {
    const circleSize = 280
    const circlePhoto = await sharp(photo)
      .resize(circleSize, circleSize, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer()
    const mask = Buffer.from(
      `<svg width="${circleSize}" height="${circleSize}"><circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="#fff"/></svg>`,
    )
    const rounded = await sharp(circlePhoto)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
    const brandLines = []
    let y = 360
    if (title) {
      brandLines.push(
        `<text x="600" y="${y}" text-anchor="middle" fill="#111827" font-family="Arial, sans-serif" font-size="48" font-weight="800">${escapeXml(title)}</text>`,
      )
      y += 56
    }
    if (subtitle) {
      brandLines.push(
        `<text x="600" y="${y}" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(subtitle)}</text>`,
      )
      y += 48
    }
    if (verify) {
      brandLines.push(
        `<text x="600" y="${y}" text-anchor="middle" fill="#2563eb" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(verify)}</text>`,
      )
    }
    const topEyebrowSvg = eyebrow
      ? `<text x="600" y="72" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="800">${escapeXml(eyebrow)}</text>`
      : `<text x="600" y="72" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="22" font-weight="800">ONE FC</text>`
    const brandSvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#1e40af"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="260" fill="url(#g)"/>
        <rect y="260" width="${W}" height="${H - 260}" fill="#ffffff"/>
        ${topEyebrowSvg}
        ${brandLines.join('\n')}
      </svg>`
    const circleLeft = Math.floor((W - circleSize) / 2)
    const circleTop = 120
    return sharp(Buffer.from(brandSvg))
      .composite([{ input: rounded, left: circleLeft, top: circleTop }])
      .png()
      .toBuffer()
  }

  const bg = await sharp(photo).resize(W, H, { fit: 'cover', position: 'top' }).png().toBuffer()
  const panelLines = []
  let py = 440
  if (eyebrow) {
    panelLines.push(
      `<text x="80" y="${py}" fill="rgba(255,255,255,0.75)" font-family="Arial, sans-serif" font-size="20" font-weight="800">${escapeXml(eyebrow)}</text>`,
    )
    py += 36
  }
  if (title) {
    panelLines.push(
      `<text x="80" y="${py + 20}" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="800">${escapeXml(title)}</text>`,
    )
    py += 58
  }
  if (subtitle) {
    panelLines.push(
      `<text x="80" y="${py}" fill="rgba(255,255,255,0.92)" font-family="Arial, sans-serif" font-size="26" font-weight="600">${escapeXml(subtitle)}</text>`,
    )
    py += 40
  }
  if (verify) {
    panelLines.push(
      `<text x="80" y="${py}" fill="rgba(255,255,255,0.88)" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(verify)}</text>`,
    )
  }
  const premiumSvg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
          <stop offset="50%" stop-color="rgba(15,23,42,0)"/>
          <stop offset="100%" stop-color="rgba(8,20,40,0.85)"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#p)"/>
      <rect x="48" y="360" width="${W - 96}" height="220" rx="20" fill="rgba(10,30,55,0.58)"/>
      ${panelLines.join('\n')}
    </svg>`
  return sharp(bg)
    .composite([{ input: Buffer.from(premiumSvg), left: 0, top: 0 }])
    .png()
    .toBuffer()
}
