/**
 * 데스크톱 패키징 시 Electron main 프로세스가 로드할 웹 origin 을 기록한다.
 * CI(desktop deploy)에서는 ELECTRON_WEB_ORIGIN 또는 VITE_BASE_URL 을 주입해
 * 패키지된 앱이 Railway 웹과 동일한 SPA 를 로드하게 한다.
 */
import fs from 'node:fs'
import path from 'node:path'

const raw =
  process.env.ELECTRON_WEB_ORIGIN?.trim() ||
  process.env.VITE_BASE_URL?.trim() ||
  ''

let origin = null
if (raw) {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:') {
      origin = url.origin
    } else {
      console.warn('[write-electron-packaged-origin] https origin only; ignored:', raw)
    }
  } catch {
    console.warn('[write-electron-packaged-origin] invalid origin; ignored:', raw)
  }
}

const outPath = path.join(process.cwd(), 'electron', 'packaged-web-origin.json')
fs.writeFileSync(outPath, `${JSON.stringify({ origin }, null, 2)}\n`, 'utf8')
console.log('[write-electron-packaged-origin]', origin ?? '(file:// fallback)')
