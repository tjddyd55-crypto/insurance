import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANDROID_APP_DOWNLOAD_URL } from './platformDownloadUrls.js'

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.onefc.app'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('server ANDROID_APP_DOWNLOAD_URL is production Play Store', () => {
  assert.equal(ANDROID_APP_DOWNLOAD_URL, PLAY_STORE)
  assert.match(ANDROID_APP_DOWNLOAD_URL, /id=com\.onefc\.app/)
})

test('frontend appInstallLinks SSOT matches server Play Store URL', () => {
  const src = readFileSync(join(ROOT, 'src/features/web/constants/appInstallLinks.ts'), 'utf8')
  assert.match(
    src,
    /export const ANDROID_APP_DOWNLOAD_URL\s*=\s*\n?\s*'https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.onefc\.app'/,
  )
  assert.doesNotMatch(src, /one-fc-user\.apk/)
  assert.doesNotMatch(src, /FC-app-release\.apk/)
})

test('login and introduction Android CTAs use ANDROID_APP_DOWNLOAD_URL', () => {
  const login = readFileSync(
    join(ROOT, 'src/features/web/components/AppDownloadActions.tsx'),
    'utf8',
  )
  const intro = readFileSync(
    join(ROOT, 'src/features/web/components/OneFcMobileInstallOptions.tsx'),
    'utf8',
  )
  const install = readFileSync(
    join(ROOT, 'src/features/web/pages/IntroductionInstallPage.tsx'),
    'utf8',
  )
  const landingContent = readFileSync(
    join(ROOT, 'src/features/web/config/introductionLandingContent.ts'),
    'utf8',
  )
  assert.match(login, /href=\{ANDROID_APP_DOWNLOAD_URL\}/)
  assert.match(intro, /href=\{ANDROID_APP_DOWNLOAD_URL\}/)
  assert.match(install, /href=\{ANDROID_APP_DOWNLOAD_URL\}/)
  assert.match(landingContent, /href:\s*ANDROID_APP_DOWNLOAD_URL/)
  assert.doesNotMatch(
    login,
    /href=\{ANDROID_APP_DOWNLOAD_URL\}[^>]*\bdownload\b/,
  )
  assert.match(
    login,
    /href=\{ANDROID_APP_DOWNLOAD_URL\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
  )
})
