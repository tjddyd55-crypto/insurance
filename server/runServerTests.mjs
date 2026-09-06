/**
 * Cross-platform server test entry (CI + local).
 * Shell-expanded globs are unreliable on Linux; enumerate files explicitly.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(serverRoot, '..')

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

const testFiles = await collectTestFiles(serverRoot)
if (testFiles.length === 0) {
  console.error('[runServerTests] No server/**/*.test.js files found')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: repoRoot,
})

process.exit(result.status ?? 1)
