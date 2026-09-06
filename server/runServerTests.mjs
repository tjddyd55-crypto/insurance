/**
 * Cross-platform server test entry (CI + local).
 * Shell-expanded globs are unreliable on Linux; enumerate files explicitly.
 */
import { readdir } from 'node:fs/promises'
import { relative, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const BATCH_SIZE = 40

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath)
    }
  }
  return files
}

const testFiles = (await collectTestFiles(serverRoot)).sort()
if (testFiles.length === 0) {
  console.error('[runServerTests] No server test files found')
  process.exit(1)
}

const relFiles = testFiles.map((file) => relative(repoRoot, file).replace(/\\/g, '/'))
const nodeOptions = process.env.NODE_OPTIONS?.trim()
  ? process.env.NODE_OPTIONS
  : '--experimental-strip-types'

console.error(
  `[runServerTests] node=${process.version} files=${relFiles.length} batchSize=${BATCH_SIZE}`,
)

let failed = false
for (let i = 0; i < relFiles.length; i += BATCH_SIZE) {
  const batch = relFiles.slice(i, i + BATCH_SIZE)
  const batchNo = Math.floor(i / BATCH_SIZE) + 1
  const batchTotal = Math.ceil(relFiles.length / BATCH_SIZE)
  console.error(`[runServerTests] batch ${batchNo}/${batchTotal} (${batch.length} files)`)

  const result = spawnSync(process.execPath, ['--test', ...batch], {
    stdio: 'inherit',
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      TZ: process.env.TZ || 'Asia/Seoul',
    },
  })

  if (result.error) {
    console.error(`[runServerTests] spawn failed on batch ${batchNo}:`, result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    failed = true
    console.error(`[runServerTests] batch ${batchNo} failed with exit ${result.status}`)
  }
}

process.exit(failed ? 1 : 0)
