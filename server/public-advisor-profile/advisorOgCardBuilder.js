import { promiseWithTimeout } from '../lib/promiseWithTimeout.js'
import { readAdvisorPublicMediaBuffer } from './publicAdvisorMediaDelivery.js'
import { getPublishedAdvisorBySlug } from './publicAdvisorProfileService.js'
import { renderAdvisorMobileCardOgPng } from './renderAdvisorMobileCardOgImage.js'

const OG_RENDER_TIMEOUT_MS = 12_000
const OG_MEDIA_READ_TIMEOUT_MS = 5_000

function shouldLogOgTiming() {
  return String(process.env.ADVISOR_OG_TIMING_LOG ?? '').trim() === '1'
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} slug
 */
export async function buildAdvisorOgCardPng(pool, slug) {
  const timing = {}
  const totalStart = Date.now()

  const dbStart = Date.now()
  const resolved = await getPublishedAdvisorBySlug(pool, slug)
  timing.dbMs = Date.now() - dbStart

  if (resolved.status !== 'ok') {
    return { status: 'not_found', timing }
  }

  const photoKey = resolved.profile.profilePhotoObjectKey
  timing.photoKeyResolvedMs = Date.now() - totalStart

  let photoBuffer = null
  let usedPhotoFallback = false

  if (photoKey) {
    const mediaStart = Date.now()
    try {
      photoBuffer = await readAdvisorPublicMediaBuffer(photoKey, { timeoutMs: OG_MEDIA_READ_TIMEOUT_MS })
      timing.mediaReadMs = Date.now() - mediaStart
    } catch (e) {
      timing.mediaReadMs = Date.now() - mediaStart
      timing.mediaReadError = e instanceof Error ? e.message : String(e)
      usedPhotoFallback = true
    }
  } else {
    usedPhotoFallback = true
  }

  const renderInput = {
    theme: resolved.profile.profileTheme ?? 'classic',
    photoBuffer,
    heroDisplayEyebrow: resolved.profile.heroDisplayEyebrow,
    heroDisplayTitle: resolved.profile.heroDisplayTitle,
    heroDisplaySubtitle: resolved.profile.heroDisplaySubtitle,
    heroDisplayEyebrowVisible: resolved.profile.heroDisplayEyebrowVisible,
    heroDisplayTitleVisible: resolved.profile.heroDisplayTitleVisible,
    heroDisplaySubtitleVisible: resolved.profile.heroDisplaySubtitleVisible,
  }

  const renderStart = Date.now()
  let png
  try {
    png = await promiseWithTimeout(
      renderAdvisorMobileCardOgPng(renderInput),
      OG_RENDER_TIMEOUT_MS,
      'renderAdvisorMobileCardOgPng',
    )
    timing.renderMs = Date.now() - renderStart
  } catch (e) {
    timing.renderMs = Date.now() - renderStart
    timing.renderError = e instanceof Error ? e.message : String(e)
    const fallbackStart = Date.now()
    png = await renderAdvisorMobileCardOgPng({ ...renderInput, photoBuffer: null, forcePhotoFallback: true })
    timing.fallbackRenderMs = Date.now() - fallbackStart
    usedPhotoFallback = true
  }

  timing.totalMs = Date.now() - totalStart
  timing.usedPhotoFallback = usedPhotoFallback

  if (shouldLogOgTiming()) {
    console.info('[advisor-og-card]', { slug, timing })
  }

  return { status: 'ok', png, timing, theme: renderInput.theme }
}
