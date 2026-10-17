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

/** Foreground width as a fraction of the 1200 canvas. Tuned on the live 689×886 portrait. */
const FOREGROUND_WIDTH_RATIO = 0.78
const PREPARE_MAX_EDGE = 1600

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
 * Full-bleed cover of the same photo, blurred and veiled so it only fills the side gaps.
 * @param {Buffer} prepared
 */
async function renderSoftBackground(prepared) {
  const covered = await sharp(prepared)
    .resize(W, H, { fit: 'cover', position: 'attention' })
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
 * Head-and-shoulders cover. `attention` keeps the face in frame instead of a center contain.
 * @param {Buffer} prepared
 */
async function renderForegroundPortrait(prepared) {
  const width = Math.round(W * FOREGROUND_WIDTH_RATIO)
  return sharp(prepared)
    .resize(width, H, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()
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
  const portrait = await renderForegroundPortrait(prepared)
  const portraitMeta = await sharp(portrait).metadata()
  const portraitWidth = portraitMeta.width ?? Math.round(W * FOREGROUND_WIDTH_RATIO)
  const portraitHeight = portraitMeta.height ?? H
  const portraitLeft = Math.max(0, Math.floor((W - portraitWidth) / 2))
  const portraitTop = Math.max(0, Math.floor((H - portraitHeight) / 2))

  return sharp(background)
    .composite([{ input: portrait, left: portraitLeft, top: portraitTop }])
    .png()
    .toBuffer()
}
