/**
 * Store review account provisioning CLI.
 *
 * Usage:
 *   node server/scripts/provision-store-review-account.mjs --profile apple --dry-run
 *   (password via stdin) ... --execute --password-stdin --login-test
 *
 * Production execute requires:
 *   INSURANCE_ALLOW_PRODUCTION_STORE_REVIEW=I_UNDERSTAND
 */
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import pool from '../db.js'
import {
  assertStoreReviewProductionGuard,
  provisionStoreReviewAccount,
  resolveStoreReviewProfile,
  testStoreReviewLoginAndAccess,
  verifyStoreReviewAccount,
} from './provisionStoreReviewAccount.js'

function parseArgs(argv) {
  const args = argv.slice(2)
  let profile = 'apple'
  let baseUrl = 'https://insurance-production-7bd8.up.railway.app'
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1]
      i += 1
      continue
    }
    if (args[i] === '--base-url' && args[i + 1]) {
      baseUrl = args[i + 1]
      i += 1
    }
  }
  return {
    profile,
    execute: args.includes('--execute'),
    loginTest: args.includes('--login-test'),
    passwordStdin: args.includes('--password-stdin'),
    promptPassword: args.includes('--prompt-password'),
    baseUrl,
  }
}

async function readPasswordFromStdin() {
  const chunks = []
  for await (const chunk of input) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

async function readPasswordFromPrompt() {
  const rl = readline.createInterface({ input, output })
  try {
    const password = await rl.question('Review account password: ')
    return String(password).trim()
  } finally {
    rl.close()
  }
}

async function resolvePassword(flags) {
  if (flags.passwordStdin) {
    return readPasswordFromStdin()
  }
  if (flags.promptPassword || process.stdin.isTTY) {
    return readPasswordFromPrompt()
  }
  throw new Error('Password required: use --password-stdin or --prompt-password')
}

async function main() {
  const flags = parseArgs(process.argv)
  const profile = resolveStoreReviewProfile(flags.profile)

  assertStoreReviewProductionGuard({
    execute: flags.execute,
    scriptName: `provision-store-review-account:${profile.key}`,
  })

  let password = ''
  if (flags.execute || flags.loginTest) {
    password = await resolvePassword(flags)
    if (!password) {
      throw new Error('Empty password')
    }
  }

  try {
    const result = await provisionStoreReviewAccount(pool, {
      profile: profile.key,
      password,
      execute: flags.execute,
    })

    console.log('[store-review] provision result:')
    console.log(JSON.stringify(result, null, 2))

    if (flags.execute && result.userId) {
      const verified = await verifyStoreReviewAccount(pool, result.userId, profile)
      console.log('[store-review] verify result:')
      console.log(JSON.stringify(verified, null, 2))
    }

    if (flags.loginTest) {
      const login = await testStoreReviewLoginAndAccess({
        baseUrl: flags.baseUrl,
        username: profile.username,
        password,
      })
      console.log('[store-review] login/access test:')
      console.log(JSON.stringify(login, null, 2))
      if (!login.loginOk) {
        process.exitCode = 1
      }
    }
  } finally {
    await pool.end()
  }
}

await main()
