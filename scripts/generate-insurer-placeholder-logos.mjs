/**
 * insurerSitesSeedData의 logoFile 목록에 맞춰 public/assets/insurers/*.png 생성.
 * 운영 전 실제 로고로 교체하거나 수퍼관리자 업로드로 대체할 것.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INSURER_SITES_SEED } from '../server/insurerSitesSeedData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** 1×1 투명 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const dir = path.join(__dirname, '..', 'public', 'assets', 'insurers')
fs.mkdirSync(dir, { recursive: true })
const names = new Set(INSURER_SITES_SEED.map((r) => r.logoFile))
for (const name of names) {
  fs.writeFileSync(path.join(dir, `${name}.png`), PNG_1X1)
}
console.log('[generate-insurer-placeholder-logos]', names.size, 'files →', dir)
