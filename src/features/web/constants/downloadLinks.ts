import {
  DESKTOP_DOWNLOAD_URL,
  MOBILE_DOWNLOAD_URL,
  USER_ANDROID_APK_DOWNLOAD_URL,
} from '../components/AppDownloadActions'

export type DownloadLinkMap = {
  pc: string
  fcMobile: string
  customerApp: string
  sampleExcel: string
}

const DEFAULT_DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: DESKTOP_DOWNLOAD_URL,
  fcMobile: MOBILE_DOWNLOAD_URL,
  customerApp: USER_ANDROID_APK_DOWNLOAD_URL,
  sampleExcel: '',
})

function normalizeLink(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

export const DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: DESKTOP_DOWNLOAD_URL,
  fcMobile: MOBILE_DOWNLOAD_URL,
  customerApp: normalizeLink(
    import.meta.env.VITE_DOWNLOAD_CUSTOMER_APP_URL,
    DEFAULT_DOWNLOAD_LINKS.customerApp,
  ),
  sampleExcel: normalizeLink(import.meta.env.VITE_DOWNLOAD_SAMPLE_EXCEL_URL, DEFAULT_DOWNLOAD_LINKS.sampleExcel),
})
