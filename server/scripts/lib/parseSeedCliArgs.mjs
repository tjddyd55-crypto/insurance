export function parseTargetUsername(argv = process.argv, env = process.env) {
  const idx = argv.indexOf('--target-user')
  if (idx >= 0 && argv[idx + 1]) {
    return String(argv[idx + 1]).trim()
  }
  const fromEnv = String(env.INSURANCE_AI_QA_TARGET_USERNAME ?? '').trim()
  if (fromEnv) {
    return fromEnv
  }
  return 'tjddyd55'
}
