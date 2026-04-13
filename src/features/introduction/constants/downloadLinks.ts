export type DownloadLinkMap = {
  pc: string
  apk: string
}

const DEFAULT_DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: 'https://cdn.platform-assets.com/insurer/download/InsuranceApp%20Setup%201.0.25.exe',
  apk: 'https://cdn.platform-assets.com/insurer/download/fc-helper-preview-1.0.0.apk',
})

function normalizeLink(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

export const DOWNLOAD_LINKS: DownloadLinkMap = Object.freeze({
  pc: normalizeLink(import.meta.env.VITE_DOWNLOAD_PC_URL, DEFAULT_DOWNLOAD_LINKS.pc),
  apk: normalizeLink(import.meta.env.VITE_DOWNLOAD_APK_URL, DEFAULT_DOWNLOAD_LINKS.apk),
})
