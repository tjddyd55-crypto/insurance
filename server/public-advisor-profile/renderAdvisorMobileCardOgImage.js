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

  const bgBlur = await sharp(prepared).resize(W, H, { fit: 'cover', position: 'centre' }).blur(22).png().toBuffer()

  const portraitMaxHeight = Math.round(H * 0.94)
  const portraitMaxWidth = Math.round(W * 0.72)
  const portrait = await sharp(prepared)
    .resize(portraitMaxWidth, portraitMaxHeight, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()

  const portraitMeta = await sharp(portrait).metadata()
  const portraitWidth = portraitMeta.width ?? portraitMaxWidth
  const portraitHeight = portraitMeta.height ?? portraitMaxHeight
  const portraitLeft = Math.floor((W - portraitWidth) / 2)
  const portraitTop = Math.floor((H - portraitHeight) / 2)

  return sharp(bgBlur)
    .composite([{ input: portrait, left: portraitLeft, top: portraitTop }])
    .png()
    .toBuffer()
}
