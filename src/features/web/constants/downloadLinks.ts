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

function normalizeLink(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

function firstNonEmptyLink(...candidates: unknown[]): string {
  for (const c of candidates) {
    const text = String(c ?? '').trim()
    if (text) {
      return text
    }
  }
  return ''
}

/** 가입 화면용 PC·모바일 다운로드 URL (env 별칭 지원) */
export const SIGNUP_APP_DOWNLOAD_LINKS = Object.freeze({
  desktop: firstNonEmptyLink(
    import.meta.env.VITE_DESKTOP_APP_DOWNLOAD_URL,
    import.meta.env.VITE_DOWNLOAD_PC_URL,
  ),
  mobile: firstNonEmptyLink(
    import.meta.env.VITE_MOBILE_APP_DOWNLOAD_URL,
    import.meta.env.VITE_DOWNLOAD_FC_MOBILE_URL,
  ),
})

export const DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: normalizeLink(import.meta.env.VITE_DOWNLOAD_PC_URL, DEFAULT_DOWNLOAD_LINKS.pc),
  fcMobile: normalizeLink(import.meta.env.VITE_DOWNLOAD_FC_MOBILE_URL, DEFAULT_DOWNLOAD_LINKS.fcMobile),
  customerApp: normalizeLink(import.meta.env.VITE_DOWNLOAD_CUSTOMER_APP_URL, DEFAULT_DOWNLOAD_LINKS.customerApp),
  sampleExcel: normalizeLink(import.meta.env.VITE_DOWNLOAD_SAMPLE_EXCEL_URL, DEFAULT_DOWNLOAD_LINKS.sampleExcel),
})
