import sharp from 'sharp'
import { promiseWithTimeout } from '../lib/promiseWithTimeout.js'
import { ADVISOR_OG_IMAGE_HEIGHT, ADVISOR_OG_IMAGE_WIDTH } from './publicAdvisorOgMeta.js'

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

const PREPARE_MAX_EDGE = 1600
/** Blur band above and below the portrait so hair is not flush with the frame. */
const CANVAS_HEADROOM_PX = 14
/** 3:4 and 4:5 headshots keep at least this much of the source, measured from the top. */
const PORTRAIT_WINDOW_FRACTION = 0.74
/** Taller than ~3:2: still start at the top, but drop more of the lower body. */
const TALL_PORTRAIT_WINDOW_FRACTION = 0.62
const TALL_PORTRAIT_ASPECT = 1.45
const PORTRAIT_WIDTH_CAP_RATIO = 0.64
const LANDSCAPE_WIDTH_CAP_RATIO = 0.88

/**
 * EXIF-orient, then cap the longest edge so later cover/blur stays inside the render timeout.
 * @param {Buffer} source
 */
async function prepareOgCoverPhoto(source) {
  return promiseWithTimeout(
    sharp(source)
      .rotate()
      .resize(PREPARE_MAX_EDGE, PREPARE_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toBuffer(),
    OG_PHOTO_PREPARE_TIMEOUT_MS,
    'ogPhotoPrepare',
  )
}

/**
 * Deterministic crop. Portraits start at the top of the source so the hair stays in frame.
 * Landscape sources stay full height and are centered horizontally.
 *
 * @param {number} sw
 * @param {number} sh
 */
export function planAdvisorOgForeground(sw, sh) {
  const safeW = Math.max(1, Math.round(sw))
  const safeH = Math.max(1, Math.round(sh))
  const outH = H - CANVAS_HEADROOM_PX * 2
  const portrait = safeH >= safeW * 1.05

  if (!portrait) {
    const naturalW = Math.round(safeW * (outH / safeH))
    const cap = Math.round(W * LANDSCAPE_WIDTH_CAP_RATIO)
    const outW = Math.max(1, Math.min(cap, naturalW))
    const windowW = Math.min(safeW, Math.max(1, Math.round(safeH * (outW / outH))))
    const left = Math.max(0, Math.floor((safeW - windowW) / 2))
    return {
      left,
      top: 0,
      width: windowW,
      height: safeH,
      outWidth: outW,
      outHeight: outH,
      canvasTop: CANVAS_HEADROOM_PX,
    }
  }

  const fraction = safeH / safeW >= TALL_PORTRAIT_ASPECT ? TALL_PORTRAIT_WINDOW_FRACTION : PORTRAIT_WINDOW_FRACTION
  let windowH = Math.min(safeH, Math.max(1, Math.round(safeH * fraction)))
  let outW = Math.round(safeW * (outH / windowH))
  const cap = Math.round(W * PORTRAIT_WIDTH_CAP_RATIO)
  if (outW > cap) {
    const fullW = Math.round(safeW * (outH / safeH))
    if (fullW <= cap) {
      windowH = safeH
      outW = Math.max(1, fullW)
    } else {
      windowH = safeH
      outW = cap
    }
  }
  const windowW = Math.min(safeW, Math.max(1, Math.round(windowH * (outW / outH))))
  const left = Math.max(0, Math.floor((safeW - windowW) / 2))
  const top = 0
  const height = Math.min(safeH - top, windowH)
  return {
    left,
    top,
    width: windowW,
    height,
    outWidth: outW,
    outHeight: outH,
    canvasTop: CANVAS_HEADROOM_PX,
  }
}

/**
 * Full-bleed cover, top-biased, blurred so it only fills the gaps around the portrait.
 * @param {Buffer} prepared
 */
async function renderSoftBackground(prepared) {
  const covered = await sharp(prepared)
    .resize(W, H, { fit: 'cover', position: 'north' })
    .blur(24)
    .modulate({ brightness: 1.05, saturation: 0.48 })
    .png()
    .toBuffer()
  const veil = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.22 },
    },
  })
    .png()
    .toBuffer()
  return sharp(covered).composite([{ input: veil, blend: 'over' }]).png().toBuffer()
}

/**
 * @param {Buffer} prepared
 */
async function renderForegroundPortrait(prepared) {
  const meta = await sharp(prepared).metadata()
  const plan = planAdvisorOgForeground(meta.width ?? W, meta.height ?? H)
  return {
    buffer: await sharp(prepared)
      .extract({ left: plan.left, top: plan.top, width: plan.width, height: plan.height })
      .resize(plan.outWidth, plan.outHeight, { fit: 'fill' })
      .png()
      .toBuffer(),
    plan,
  }
}

/**
 * Hero photo only — no theme UI, no text overlay (og:title/description carry copy).
 *
 * @param {{
 *   photoBuffer?: Buffer | null
 *   forcePhotoFallback?: boolean
 * }} input
 */
export async function renderAdvisorMobileCardOgPng(input) {
  const source = await resolveOgPhotoBuffer(input.photoBuffer, Boolean(input.forcePhotoFallback))
  const prepared = await prepareOgCoverPhoto(source)
  const background = await renderSoftBackground(prepared)
  const { buffer: portrait, plan } = await renderForegroundPortrait(prepared)
  const portraitLeft = Math.max(0, Math.floor((W - plan.outWidth) / 2))
  const portraitTop = plan.canvasTop

  return sharp(background)
    .composite([{ input: portrait, left: portraitLeft, top: portraitTop }])
    .png()
    .toBuffer()
}
