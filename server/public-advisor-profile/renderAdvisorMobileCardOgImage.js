import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { promiseWithTimeout } from '../lib/promiseWithTimeout.js'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'

const W = ADVISOR_OG_IMAGE_WIDTH
const H = ADVISOR_OG_IMAGE_HEIGHT
const OG_CARD_META_TIMEOUT_MS = 3_000
const OG_CARD_PREPARE_TIMEOUT_MS = 8_000
const MIN_OG_CARD_BYTES = 256
const PREPARE_MAX_EDGE = 1600

/** 94% of the canvas width. Wider cards stop here so side padding remains. */
const MAX_CARD_WIDTH = W - 36 * 2
/** Height cap. A 1.75 business card then lands near 88% of the canvas width. */
const MAX_CARD_HEIGHT = H - 14 * 2

const BG = { r: 244, g: 246, b: 248 }

/** @type {Promise<Buffer> | null} */
let placeholderPromise = null

/**
 * Contain box for the business-card foreground. Aspect is preserved.
 * The box never exceeds the canvas, so the card is not cropped or covered.
 *
 * @param {number} sw
 * @param {number} sh
 */
export function planAdvisorOgCardContain(sw, sh) {
  const safeW = Math.max(1, Math.round(sw))
  const safeH = Math.max(1, Math.round(sh))
  const scale = Math.min(MAX_CARD_WIDTH / safeW, MAX_CARD_HEIGHT / safeH)
  const outWidth = Math.max(1, Math.round(safeW * scale))
  const outHeight = Math.max(1, Math.round(safeH * scale))
  return {
    outWidth: Math.min(MAX_CARD_WIDTH, outWidth),
    outHeight: Math.min(MAX_CARD_HEIGHT, outHeight),
    left: Math.floor((W - Math.min(MAX_CARD_WIDTH, outWidth)) / 2),
    top: Math.floor((H - Math.min(MAX_CARD_HEIGHT, outHeight)) / 2),
    maxWidth: MAX_CARD_WIDTH,
    maxHeight: MAX_CARD_HEIGHT,
  }
}

/**
 * @param {Buffer | null | undefined} cardBuffer
 * @param {boolean} [forcePlaceholder]
 */
async function resolveOgCardBuffer(cardBuffer, forcePlaceholder = false) {
  if (forcePlaceholder || !cardBuffer || cardBuffer.length < MIN_OG_CARD_BYTES) return null
  try {
    const meta = await promiseWithTimeout(
      sharp(cardBuffer).rotate().metadata(),
      OG_CARD_META_TIMEOUT_MS,
      'ogCardMetadata',
    )
    if (!meta.width || !meta.height || meta.width < 32 || meta.height < 32) return null
    return cardBuffer
  } catch {
    return null
  }
}

/**
 * EXIF-orient, then cap the longest edge so blur/resize stays inside the render timeout.
 * @param {Buffer} source
 */
async function prepareOgCard(source) {
  return promiseWithTimeout(
    sharp(source)
      .rotate()
      .resize(PREPARE_MAX_EDGE, PREPARE_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toBuffer(),
    OG_CARD_PREPARE_TIMEOUT_MS,
    'ogCardPrepare',
  )
}

/**
 * Light neutral field with a faint, desaturated blur of the card. The card itself is composited later with contain.
 * @param {Buffer} prepared
 */
async function renderSoftBackground(prepared) {
  const wash = await sharp(prepared)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .blur(36)
    .modulate({ brightness: 1.6, saturation: 0.12 })
    .png()
    .toBuffer()
  const veil = await sharp({
    create: { width: W, height: H, channels: 4, background: { ...BG, alpha: 0.9 } },
  })
    .png()
    .toBuffer()
  return sharp(wash).composite([{ input: veil, blend: 'over' }]).png().toBuffer()
}

/**
 * @param {number} cardLeft
 * @param {number} cardTop
 * @param {number} cardW
 * @param {number} cardH
 */
async function renderSoftShadow(cardLeft, cardTop, cardW, cardH) {
  const plate = await sharp({
    create: {
      width: cardW,
      height: cardH,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 0.18 },
    },
  })
    .png()
    .toBuffer()
  const top = Math.max(0, Math.min(H - cardH, cardTop + 6))
  const left = Math.max(0, Math.min(W - cardW, cardLeft))
  return sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: plate, left, top }])
    .blur(10)
    .png()
    .toBuffer()
}

async function loadOneFcMark() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'public/icon.png'),
    path.resolve(here, '../../public/icon.png'),
  ]
  for (const file of candidates) {
    try {
      const buf = await readFile(file)
      if (buf.length > 32) return buf
    } catch {
      /* try the next path */
    }
  }
  return null
}

async function renderPlaceholderPng() {
  const cardW = 1008
  const cardH = 470
  const cardLeft = Math.floor((W - cardW) / 2)
  const cardTop = Math.floor((H - cardH) / 2)
  const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cardLeft}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="18" fill="#ffffff"/>
  <text x="${W / 2}" y="${cardTop + 292}" text-anchor="middle" font-family="WenQuanYi Micro Hei, DejaVu Sans, sans-serif" font-size="54" font-weight="700" fill="#0f172a">ONE FC</text>
  <text x="${W / 2}" y="${cardTop + 360}" text-anchor="middle" font-family="WenQuanYi Micro Hei, DejaVu Sans, sans-serif" font-size="32" fill="#64748b">모바일 명함</text>
</svg>`
  const layers = [{ input: await sharp(Buffer.from(cardSvg)).png().toBuffer(), left: 0, top: 0 }]
  const icon = await loadOneFcMark()
  if (icon) {
    const mark = await sharp(icon).resize(120, 120, { fit: 'inside' }).png().toBuffer()
    const meta = await sharp(mark).metadata()
    const markW = meta.width ?? 120
    layers.push({
      input: mark,
      left: Math.round((W - markW) / 2),
      top: cardTop + 72,
    })
  }
  const background = await sharp({
    create: { width: W, height: H, channels: 3, background: BG },
  })
    .png()
    .toBuffer()
  const shadow = await renderSoftShadow(cardLeft, cardTop, cardW, cardH)
  return sharp(background)
    .composite([{ input: shadow, blend: 'over' }, ...layers])
    .png()
    .toBuffer()
}

function getPlaceholderPng() {
  if (!placeholderPromise) {
    placeholderPromise = renderPlaceholderPng().catch((error) => {
      placeholderPromise = null
      throw error
    })
  }
  return placeholderPromise
}

/**
 * Business-card front only. Hero/profile photos are not an input.
 * Missing or unreadable cards render the ONE FC placeholder.
 *
 * @param {{
 *   cardBuffer?: Buffer | null
 *   forcePlaceholder?: boolean
 * }} input
 */
export async function renderAdvisorMobileCardOgPng(input) {
  const source = await resolveOgCardBuffer(input.cardBuffer, Boolean(input.forcePlaceholder))
  if (!source) return getPlaceholderPng()

  const prepared = await prepareOgCard(source)
  const meta = await sharp(prepared).metadata()
  const plan = planAdvisorOgCardContain(meta.width ?? W, meta.height ?? H)
  const card = await sharp(prepared)
    .resize(plan.outWidth, plan.outHeight, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const cardMeta = await sharp(card).metadata()
  const cardW = cardMeta.width ?? plan.outWidth
  const cardH = cardMeta.height ?? plan.outHeight
  const left = Math.floor((W - cardW) / 2)
  const top = Math.floor((H - cardH) / 2)
  const background = await renderSoftBackground(prepared)
  const shadow = await renderSoftShadow(left, top, cardW, cardH)

  return sharp(background)
    .composite([
      { input: shadow, blend: 'over' },
      { input: card, left, top },
    ])
    .png()
    .toBuffer()
}
