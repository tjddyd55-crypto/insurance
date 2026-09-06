/**
 * Cross-platform server test entry (CI + local).
 * Shell-expanded globs are unreliable on Linux; enumerate files explicitly.
 */
import { writeFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { relative, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const isCi = process.env.CI === 'true' || process.env.CI === '1'

// CI runners have limited memory; avoid running dozens of test modules in one process.
const BATCH_SIZE = isCi ? 1 : 40

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
const failures = []

console.error(
  `[runServerTests] node=${process.version} ci=${isCi} files=${relFiles.length} batchSize=${BATCH_SIZE}`,
)

for (let i = 0; i < relFiles.length; i += BATCH_SIZE) {
  const batch = relFiles.slice(i, i + BATCH_SIZE)
  const batchNo = Math.floor(i / BATCH_SIZE) + 1
  const batchTotal = Math.ceil(relFiles.length / BATCH_SIZE)
  console.error(`[runServerTests] batch ${batchNo}/${batchTotal} (${batch.length} files)`)

  const nodeArgs = ['--experimental-strip-types', '--test']
  if (isCi) {
    nodeArgs.push('--test-concurrency=1')
  }
  nodeArgs.push(...batch)

  const result = spawnSync(process.execPath, nodeArgs, {
    stdio: isCi ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    cwd: repoRoot,
    env: {
      ...process.env,
      TZ: process.env.TZ || 'Asia/Seoul',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })

  if (isCi) {
    if (result.stdout) {
      process.stdout.write(result.stdout)
    }
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }
  }

  if (result.error) {
    const message = `spawn failed: ${result.error.message}`
    failures.push({ batch: batchNo, files: batch, message, stdout: '', stderr: '' })
    console.error(`[runServerTests] ${message}`)
    if (isCi) {
      console.error(`::error title=runServerTests spawn::${message}`)
    }
    continue
  }

  if (result.status !== 0) {
    const tail = (result.stderr || result.stdout || '').split('\n').slice(-40).join('\n')
    failures.push({
      batch: batchNo,
      files: batch,
      exitCode: result.status,
      signal: result.signal,
      tail,
    })
    console.error(
      `[runServerTests] batch ${batchNo} failed exit=${result.status} signal=${result.signal ?? 'none'}`,
    )
    for (const file of batch) {
      console.error(`::error file=${file},title=test batch ${batchNo}::exit ${result.status}`)
    }
  }
}

if (failures.length > 0) {
  const summaryPath = join(serverRoot, '.test-ci-failures.json')
  await writeFile(summaryPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')
  console.error(`[runServerTests] wrote ${relative(repoRoot, summaryPath)} (${failures.length} failed batch(es))`)
  process.exit(1)
}

process.exit(0)
