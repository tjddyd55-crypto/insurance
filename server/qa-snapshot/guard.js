import {
  classifyDbTarget,
  isDevelopmentDbTarget,
  isProductionDbTarget,
} from '../lib/dbEnvironmentGuard.js'
import { isQaSafeMode } from '../lib/qaSafeMode.js'
import { MAX_CUSTOMERS, MIN_CUSTOMERS } from './constants.js'

function valueAfter(argv, name) {
  const index = argv.indexOf(name)
  if (index < 0 || !argv[index + 1] || argv[index + 1].startsWith('--')) {
    throw new Error(`${name} 값이 필요합니다.`)
  }
  return argv[index + 1]
}

function parseLimit(raw) {
  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < MIN_CUSTOMERS || limit > MAX_CUSTOMERS) {
    throw new Error(`--limit은 ${MIN_CUSTOMERS}~${MAX_CUSTOMERS} 정수여야 합니다.`)
  }
  return limit
}

export function parseQaSnapshotArgs(argv) {
  const allowed = new Set([
    '--source-ga-code',
    '--target-user-id',
    '--limit',
    '--execute',
    '--confirm-development',
  ])
  const flags = argv.filter((arg) => arg.startsWith('--'))
  const unknown = flags.find((flag) => !allowed.has(flag))
  if (unknown) throw new Error(`지원하지 않는 인자입니다: ${unknown}`)

  return {
    sourceGaCode: valueAfter(argv, '--source-ga-code').trim(),
    targetUserId: valueAfter(argv, '--target-user-id').trim(),
    limit: parseLimit(valueAfter(argv, '--limit')),
    execute: argv.includes('--execute'),
    confirmDevelopment: argv.includes('--confirm-development'),
  }
}

function classificationEnv(label, env) {
  const explicit = env[`QA_${label}_DB_ENVIRONMENT`]
  return explicit ? { ...env, INSURANCE_DB_ENVIRONMENT: explicit } : env
}

export function assertDatabaseGuard({ sourceUrl, destinationUrl, options, env = process.env }) {
  const sourceEnv = classificationEnv('SOURCE', env)
  const destinationEnv = classificationEnv('DESTINATION', env)
  const sourceTarget = classifyDbTarget(sourceUrl, sourceEnv)
  const destinationTarget = classifyDbTarget(destinationUrl, destinationEnv)

  if (!isProductionDbTarget(sourceUrl, sourceEnv)) {
    throw new Error(`원본 DB가 production으로 분류되지 않았습니다: ${sourceTarget}`)
  }
  if (!isDevelopmentDbTarget(destinationUrl, destinationEnv)) {
    throw new Error(`대상 DB가 development로 분류되지 않았습니다: ${destinationTarget}`)
  }
  if (sourceUrl === destinationUrl) {
    throw new Error('원본 DB와 대상 DB는 같을 수 없습니다.')
  }
  const allowedGaCode = String(env.QA_SNAPSHOT_ALLOWED_SOURCE_GA_CODE ?? '').trim()
  if (!allowedGaCode || allowedGaCode.toUpperCase() !== options.sourceGaCode.toUpperCase()) {
    throw new Error('원본 GA 코드가 QA_SNAPSHOT_ALLOWED_SOURCE_GA_CODE와 일치하지 않습니다.')
  }
  if (options.execute && !options.confirmDevelopment) {
    throw new Error('실행에는 --confirm-development가 필요합니다.')
  }
  if (options.execute && !isQaSafeMode(env)) {
    throw new Error('실행에는 QA_SAFE_MODE=true가 필요합니다.')
  }
  const objectRoot = String(env.CRM_R2_OBJECT_ROOT ?? '').trim().toLowerCase()
  if (options.execute && (!objectRoot || !objectRoot.includes('development'))) {
    throw new Error('실행에는 development CRM_R2_OBJECT_ROOT가 필요합니다.')
  }
  return { sourceTarget, destinationTarget }
}
