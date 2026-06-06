export type DownloadLinkMap = {
  pc: string
  fcMobile: string
  customerApp: string
  sampleExcel: string
}

const DEFAULT_DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: 'https://cdn.platform-assets.com/insurer/download/InsuranceApp%20Setup%201.0.7.exe',
  fcMobile: 'https://cdn.platform-assets.com/insurer/download/FC-app-release.apk',
  customerApp: 'https://cdn.platform-assets.com/insurer/download/customer-app-release.apk',
  sampleExcel: '',
})

/** 백엔드 redirect endpoint — 프론트는 실제 CDN URL을 하드코딩하지 않는다 */
export const APP_DOWNLOAD_ENDPOINTS = Object.freeze({
  desktop: '/backend/downloads/desktop/latest',
  mobile: '/backend/downloads/mobile/latest',
  status: '/backend/downloads/status',
})

function normalizeLink(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

export const DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: APP_DOWNLOAD_ENDPOINTS.desktop,
  fcMobile: APP_DOWNLOAD_ENDPOINTS.mobile,
  customerApp: normalizeLink(
    import.meta.env.VITE_DOWNLOAD_CUSTOMER_APP_URL,
    DEFAULT_DOWNLOAD_LINKS.customerApp,
  ),
  sampleExcel: normalizeLink(import.meta.env.VITE_DOWNLOAD_SAMPLE_EXCEL_URL, DEFAULT_DOWNLOAD_LINKS.sampleExcel),
})
