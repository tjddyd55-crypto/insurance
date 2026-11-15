import { signMockCallback } from '../../server/healthway/mockCallback.js'

const [demandDealingsNo, caseCode = 'CASE1', ...extra] = process.argv.slice(2)
try {
  if (extra.length || !demandDealingsNo) throw new Error()
  const resultData = signMockCallback({ demandDealingsNo, exp: Math.floor(Date.now() / 1000) + 300, case: caseCode }, process.env.HEALTHWAY_TOKEN_SECRET_KEY)
  process.stdout.write(`/api/healthway/callback/cert?resultData=${encodeURIComponent(resultData)}\n`)
} catch {
  // Never echo args or exception details (which may contain secret material).
  process.stderr.write('Usage: HEALTHWAY_TOKEN_SECRET_KEY=<env secret> node scripts/healthway/sign-mock-callback.mjs <demandDealingsNo> [CASE1|CASE2|CASE3|CASE4]\nSigning failed: check the dedicated environment key and arguments.\n')
  process.exitCode = 1
}
