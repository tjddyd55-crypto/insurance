import sharp from 'sharp'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'

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
 *   displayName: string
 *   titleSuffix: string
 *   affiliationLine: string
 *   headline: string
 *   photoBuffer: Buffer
 * }} input
 */
export async function renderAdvisorMobileCardOgPng(input) {
  const theme = input.theme === 'brand' || input.theme === 'premium' ? input.theme : 'classic'
  const nameLine = truncate(`${input.displayName} ${input.titleSuffix}`.trim(), 28)
  const affiliation = truncate(input.affiliationLine, 42)
  const headline = truncate(input.headline, 72)

  const photo = await sharp(input.photoBuffer)
    .rotate()
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()

  if (theme === 'classic') {
    const photoPanel = await sharp(photo).resize(500, H, { fit: 'cover', position: 'top' }).png().toBuffer()
    const textSvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="500" y="0" width="${W - 500}" height="${H}" fill="#ffffff"/>
        <text x="540" y="120" fill="#6b7280" font-family="Arial, sans-serif" font-size="22" font-weight="700">ONE FC</text>
        <text x="540" y="190" fill="#111827" font-family="Arial, sans-serif" font-size="52" font-weight="800">${escapeXml(nameLine)}</text>
        <text x="540" y="250" fill="#374151" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(affiliation)}</text>
        <text x="540" y="330" fill="#4b5563" font-family="Arial, sans-serif" font-size="26">${escapeXml(headline)}</text>
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
    const circleSize = 260
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
    const brandSvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#1e40af"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="240" fill="url(#g)"/>
        <rect y="240" width="${W}" height="${H - 240}" fill="#ffffff"/>
        <text x="600" y="72" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="800">ONE FC</text>
        <text x="600" y="360" text-anchor="middle" fill="#111827" font-family="Arial, sans-serif" font-size="48" font-weight="800">${escapeXml(nameLine)}</text>
        <text x="600" y="420" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(affiliation)}</text>
        <text x="600" y="490" text-anchor="middle" fill="#4b5563" font-family="Arial, sans-serif" font-size="26">${escapeXml(headline)}</text>
      </svg>`
    const circleLeft = Math.floor((W - circleSize) / 2)
    const circleTop = 130
    return sharp(Buffer.from(brandSvg))
      .composite([{ input: rounded, left: circleLeft, top: circleTop }])
      .png()
      .toBuffer()
  }

  // premium
  const bg = await sharp(photo).resize(W, H, { fit: 'cover', position: 'top' }).png().toBuffer()
  const premiumSvg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
          <stop offset="55%" stop-color="rgba(15,23,42,0)"/>
          <stop offset="100%" stop-color="rgba(8,20,40,0.82)"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#p)"/>
      <rect x="48" y="390" width="${W - 96}" height="200" rx="20" fill="rgba(10,30,55,0.58)"/>
      <text x="80" y="440" fill="rgba(255,255,255,0.75)" font-family="Arial, sans-serif" font-size="20" font-weight="800">ONE FC</text>
      <text x="80" y="490" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="800">${escapeXml(nameLine)}</text>
      <text x="80" y="535" fill="rgba(255,255,255,0.92)" font-family="Arial, sans-serif" font-size="26" font-weight="600">${escapeXml(affiliation)}</text>
      <text x="80" y="575" fill="rgba(255,255,255,0.88)" font-family="Arial, sans-serif" font-size="24">${escapeXml(headline)}</text>
    </svg>`
  return sharp(bg)
    .composite([{ input: Buffer.from(premiumSvg), left: 0, top: 0 }])
    .png()
    .toBuffer()
}
