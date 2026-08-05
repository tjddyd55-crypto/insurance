import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

function readSrc(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

test('introduction landing imports appInstallLinks SSOT (no hardcoded store URLs in cards)', () => {
  const content = readSrc('src/features/web/config/introductionLandingContent.ts')
  assert.match(content, /from '\.\.\/constants\/appInstallLinks'/)
  assert.match(content, /href:\s*ANDROID_APP_DOWNLOAD_URL/)
  assert.match(content, /href:\s*ONE_FC_APP_STORE_URL/)
  assert.match(content, /href:\s*DESKTOP_DOWNLOAD_URL/)
  assert.doesNotMatch(content, /play\.google\.com/)
  assert.doesNotMatch(content, /apps\.apple\.com/)
  assert.doesNotMatch(content, /cdn\.platform-assets\.com/)
})

test('introduction page has no login or register routes', () => {
  const files = [
    'src/features/web/pages/IntroductionPage.tsx',
    'src/features/web/components/introduction/landing/IntroLandingHeader.tsx',
    'src/features/web/components/introduction/landing/IntroMobileMenu.tsx',
    'src/features/web/components/introduction/landing/IntroLandingSections.tsx',
    'src/features/web/components/introduction/landing/IntroContactForm.tsx',
  ]
  for (const file of files) {
    const src = readSrc(file)
    assert.doesNotMatch(src, /to=["']\/login["']/)
    assert.doesNotMatch(src, /to=["']\/register["']/)
    assert.doesNotMatch(src, /href=["']\/login["']/)
    assert.doesNotMatch(src, /href=["']\/register["']/)
  }
})

test('introduction landing exposes required section ids in content SSOT', () => {
  const content = readSrc('src/features/web/config/introductionLandingContent.ts')
  for (const id of [
    'overview',
    'problem',
    'integration',
    'fc',
    'branch',
    'insurer',
    'customer',
    'structure',
    'comparison',
    'solution',
    'sync',
    'download',
    'start',
    'contact',
  ]) {
    assert.match(content, new RegExp(`'${id}'`))
  }
})
