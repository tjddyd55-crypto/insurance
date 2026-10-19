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

  const cardKey = String(resolved.profile.businessCardFrontObjectKey ?? '').trim()
  timing.cardKeyResolvedMs = Date.now() - totalStart

  let cardBuffer = null
  let usedCardFallback = false

  if (cardKey) {
    const mediaStart = Date.now()
    try {
      cardBuffer = await readAdvisorPublicMediaBuffer(cardKey, { timeoutMs: OG_MEDIA_READ_TIMEOUT_MS })
      timing.mediaReadMs = Date.now() - mediaStart
    } catch (e) {
      timing.mediaReadMs = Date.now() - mediaStart
      timing.mediaReadError = e instanceof Error ? e.message : String(e)
      usedCardFallback = true
    }
  } else {
    usedCardFallback = true
  }

  const renderInput = { cardBuffer }

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
    png = await renderAdvisorMobileCardOgPng({ cardBuffer: null, forcePlaceholder: true })
    timing.fallbackRenderMs = Date.now() - fallbackStart
    usedCardFallback = true
  }

  timing.totalMs = Date.now() - totalStart
  timing.usedCardFallback = usedCardFallback

  if (shouldLogOgTiming()) {
    console.info('[advisor-og-card]', { slug, timing })
  }

  return { status: 'ok', png, timing }
}
