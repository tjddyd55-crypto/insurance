import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANDROID_APP_DOWNLOAD_URL,
  OFFICIAL_DESKTOP_DOWNLOAD_URL,
  resolveDesktopDownloadUrl,
  resolveMobileDownloadUrl,
  getPlatformDownloadStatus,
} from './platformDownloadUrls.js'

const ENV_KEYS = [
  'DESKTOP_DOWNLOAD_URL',
  'DESKTOP_GITHUB_RELEASE_URL',
  'ANDROID_APP_DOWNLOAD_URL',
  'MOBILE_DOWNLOAD_URL',
  'ANDROID_APK_DOWNLOAD_URL',
  'R2_PUBLIC_CDN_BASE',
]

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

test('resolveDesktopDownloadUrl prefers DESKTOP_DOWNLOAD_URL', () => {
  const prev = snapshotEnv()
  try {
    process.env.DESKTOP_DOWNLOAD_URL = 'https://example.com/desktop.exe'
    assert.equal(resolveDesktopDownloadUrl(), 'https://example.com/desktop.exe')
  } finally {
    restoreEnv(prev)
  }
})

test('resolveMobileDownloadUrl prefers ANDROID_APP_DOWNLOAD_URL then MOBILE then APK env', () => {
  const prev = snapshotEnv()
  try {
    process.env.ANDROID_APP_DOWNLOAD_URL = 'https://example.com/play'
    process.env.MOBILE_DOWNLOAD_URL = 'https://example.com/mobile.apk'
    process.env.ANDROID_APK_DOWNLOAD_URL = 'https://example.com/ignored.apk'
    assert.equal(resolveMobileDownloadUrl(), 'https://example.com/play')

    delete process.env.ANDROID_APP_DOWNLOAD_URL
    assert.equal(resolveMobileDownloadUrl(), 'https://example.com/mobile.apk')

    delete process.env.MOBILE_DOWNLOAD_URL
    assert.equal(resolveMobileDownloadUrl(), 'https://example.com/ignored.apk')
  } finally {
    restoreEnv(prev)
  }
})

test('resolveMobileDownloadUrl falls back to Google Play SSOT', () => {
  const prev = snapshotEnv()
  try {
    delete process.env.ANDROID_APP_DOWNLOAD_URL
    delete process.env.MOBILE_DOWNLOAD_URL
    delete process.env.ANDROID_APK_DOWNLOAD_URL
    delete process.env.R2_PUBLIC_CDN_BASE
    assert.equal(resolveMobileDownloadUrl(), ANDROID_APP_DOWNLOAD_URL)
    assert.match(ANDROID_APP_DOWNLOAD_URL, /id=com\.onefc\.app/)
  } finally {
    restoreEnv(prev)
  }
})

test('resolveDesktopDownloadUrl prefers official GitHub release over stale CDN latest', () => {
  const prev = snapshotEnv()
  try {
    delete process.env.DESKTOP_DOWNLOAD_URL
    delete process.env.DESKTOP_GITHUB_RELEASE_URL
    process.env.R2_PUBLIC_CDN_BASE = 'https://cdn.example.com'
    assert.equal(resolveDesktopDownloadUrl(), OFFICIAL_DESKTOP_DOWNLOAD_URL)
    assert.match(OFFICIAL_DESKTOP_DOWNLOAD_URL, /ONE-FC-Setup-1\.0\.309\.exe/)
  } finally {
    restoreEnv(prev)
  }
})

test('resolveDesktopDownloadUrl uses DESKTOP_GITHUB_RELEASE_URL before official default', () => {
  const prev = snapshotEnv()
  try {
    delete process.env.DESKTOP_DOWNLOAD_URL
    process.env.DESKTOP_GITHUB_RELEASE_URL = 'https://example.com/custom-desktop.exe'
    process.env.R2_PUBLIC_CDN_BASE = 'https://cdn.example.com'
    assert.equal(resolveDesktopDownloadUrl(), 'https://example.com/custom-desktop.exe')
  } finally {
    restoreEnv(prev)
  }
})

test('getPlatformDownloadStatus reflects resolved URLs', () => {
  const prev = snapshotEnv()
  try {
    delete process.env.DESKTOP_DOWNLOAD_URL
    delete process.env.ANDROID_APP_DOWNLOAD_URL
    delete process.env.MOBILE_DOWNLOAD_URL
    delete process.env.ANDROID_APK_DOWNLOAD_URL
    delete process.env.R2_PUBLIC_CDN_BASE
    const status = getPlatformDownloadStatus()
    assert.equal(typeof status.desktop, 'boolean')
    assert.equal(typeof status.mobile, 'boolean')
    assert.equal(status.desktop, true)
    assert.equal(status.mobile, true)
  } finally {
    restoreEnv(prev)
  }
})
