import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(import.meta.url), '../../..')

const FORBIDDEN_PATTERNS = [
  '#020617',
  '#0f172a',
  'slate-900',
  'slate-950',
  'gray-950',
]

function collectSourceFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
      continue
    }
    if (/\.(tsx?|css)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

function extractNotificationCssBlocks(indexCss) {
  const lines = indexCss.split(/\r?\n/)
  const blocks = []
  let current = []
  let inBlock = false

  for (const line of lines) {
    if (/^\.notification-/.test(line.trim())) {
      if (inBlock && current.length > 0) {
        blocks.push(current.join('\n'))
      }
      current = [line]
      inBlock = true
      continue
    }
    if (inBlock) {
      if (line.trim() === '' && current.length > 0 && !line.startsWith(' ')) {
        blocks.push(current.join('\n'))
        current = []
        inBlock = false
        continue
      }
      if (/^[.#@]/.test(line.trim()) && !line.startsWith(' ')) {
        blocks.push(current.join('\n'))
        current = []
        inBlock = false
        continue
      }
      current.push(line)
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }

  return blocks.join('\n')
}

function findForbiddenTokens(content, label) {
  const hits = []
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.includes(pattern)) {
      hits.push(`${label}: ${pattern}`)
    }
  }
  return hits
}

test('notification UI sources do not contain forbidden dark palette tokens', () => {
  const notificationDir = join(repoRoot, 'src/features/notification')
  const files = collectSourceFiles(notificationDir)
  const hits = []

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8')
    hits.push(...findForbiddenTokens(content, relative(repoRoot, filePath)))
  }

  const indexCssPath = join(repoRoot, 'src/index.css')
  const notificationCss = extractNotificationCssBlocks(readFileSync(indexCssPath, 'utf8'))
  hits.push(...findForbiddenTokens(notificationCss, 'src/index.css (notification blocks)'))

  assert.deepEqual(hits, [])
})
