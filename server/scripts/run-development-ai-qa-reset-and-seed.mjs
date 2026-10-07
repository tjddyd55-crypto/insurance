/**
 * Development-only orchestrator: safety check → reset YJASSET business data → seed AI QA dataset.
 * Usage: railway run -e development -s app -- node server/scripts/run-development-ai-qa-reset-and-seed.mjs --execute
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const passthrough = process.argv.slice(2)

function run(script) {
  const args = ['node', script, ...passthrough]
  const res = spawnSync(args[0], args.slice(1), {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

run('server/scripts/reset-development-ai-qa.mjs')
run('server/scripts/seed-ai-readonly-qa-dev.mjs')
console.log('[run-development-ai-qa-reset-and-seed] complete', { args: passthrough })
