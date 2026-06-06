import {
  getPlatformDownloadStatus,
  resolveDesktopDownloadUrl,
  resolveMobileDownloadUrl,
} from '../lib/platformDownloadUrls.js'

const UNAVAILABLE_MESSAGE = {
  desktop: 'PC 설치 파일을 준비 중입니다. 잠시 후 다시 시도해 주세요.',
  mobile: '모바일 설치 파일을 준비 중입니다. 잠시 후 다시 시도해 주세요.',
}

function sendUnavailable(res, kind) {
  return res.status(503).json({
    ok: false,
    message: UNAVAILABLE_MESSAGE[kind],
  })
}

function redirectToLatest(res, url) {
  res.set('Cache-Control', 'public, max-age=300')
  return res.redirect(302, url)
}

export function registerDownloadRoutes(router) {
  router.get('/downloads/status', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({
      ok: true,
      ...getPlatformDownloadStatus(),
    })
  })

  router.get('/downloads/desktop/latest', (_req, res) => {
    const url = resolveDesktopDownloadUrl()
    if (!url) {
      return sendUnavailable(res, 'desktop')
    }
    return redirectToLatest(res, url)
  })

  router.get('/downloads/mobile/latest', (_req, res) => {
    const url = resolveMobileDownloadUrl()
    if (!url) {
      return sendUnavailable(res, 'mobile')
    }
    return redirectToLatest(res, url)
  })
}
