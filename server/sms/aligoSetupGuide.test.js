import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')

test('sms settings uses AligoSetupGuide with IP copy and external links', () => {
  const bodySrc = readFileSync(path.join(root, 'src/features/sms/components/SmsModuleBody.tsx'), 'utf8')
  const guideSrc = readFileSync(
    path.join(root, 'src/features/sms/components/settings/AligoSetupGuide.tsx'),
    'utf8',
  )

  assert.match(bodySrc, /AligoSetupGuide/)
  assert.doesNotMatch(bodySrc, /function GuideBox/)
  assert.match(guideSrc, /navigator\.clipboard/)
  assert.match(guideSrc, /rel="noopener noreferrer"/)
  assert.match(guideSrc, /ALIGO_SETUP_CHECKLIST/)
  assert.match(guideSrc, /자주 발생하는 오류/)
})
