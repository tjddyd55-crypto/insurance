/**
 * Frontend test runner: vitest (.ts/.tsx) + node:test (.test.js and wiring .test.ts under src/).
 */
import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const srcRoot = join(repoRoot, 'src')

const NODE_TEST_TS = new Set([
  'src/features/billing/storeReviewBillingAccess.test.ts',
  'src/features/customer-app/pages/CustomerAppRequestComposePage.test.ts',
  'src/features/customers/config/customerInflowSource.config.test.ts',
  'src/features/customers/utils/customerSpecialDateFormUtils.test.ts',
  'src/features/insurer-news/utils/resolveNewsletterPostAuthorLabel.test.ts',
  'src/features/storage/utils/storageFolderTree.test.ts',
])

async function collectNodeTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectNodeTestFiles(fullPath)))
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const rel = relative(repoRoot, fullPath).replace(/\\/g, '/')
    if (entry.name.endsWith('.test.js')) {
      files.push(fullPath)
      continue
    }
    if (entry.name.endsWith('.test.ts') && NODE_TEST_TS.has(rel)) {
      files.push(fullPath)
    }
  }
  return files
}

console.error('[runWebTests] vitest (src vitest suites)')
const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')
const vitest = spawnSync(process.execPath, [vitestBin, 'run'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    TZ: process.env.TZ || 'Asia/Seoul',
  },
})

if (vitest.error) {
  console.error('[runWebTests] vitest spawn failed:', vitest.error.message)
  process.exit(1)
}
if (vitest.status !== 0) {
  process.exit(vitest.status ?? 1)
}

const nodeTestFiles = (await collectNodeTestFiles(srcRoot)).sort()
const relFiles = nodeTestFiles.map((file) => relative(repoRoot, file).replace(/\\/g, '/'))
console.error(`[runWebTests] node:test files=${relFiles.length}`)

if (relFiles.length > 0) {
  const nodeBatch = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...relFiles], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TZ: process.env.TZ || 'Asia/Seoul',
    },
  })

  if (nodeBatch.error) {
    console.error('[runWebTests] node:test spawn failed:', nodeBatch.error.message)
    process.exit(1)
  }
  if (nodeBatch.status !== 0) {
    process.exit(nodeBatch.status ?? 1)
  }
}

process.exit(0)
