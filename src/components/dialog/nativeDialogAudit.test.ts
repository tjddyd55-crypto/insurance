import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src', 'electron', 'shared']

function walk(dir: string, acc: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, acc)
      continue
    }
    if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(name)) acc.push(full)
  }
  return acc
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('native dialog replacement', () => {
  it('keeps user-facing window/globalThis alert confirm prompt at zero', () => {
    const hits: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const text = stripComments(readFileSync(file, 'utf8'))
        if (/\b(?:window|globalThis)\.(?:alert|confirm|prompt)\s*\(/.test(text)) {
          hits.push(file)
        }
        if (/\bshowMessageBox\s*\(/.test(text)) {
          hits.push(`${file} showMessageBox`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('leaves the browser beforeunload guard as the only unload dialog', () => {
    const hits: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const text = stripComments(readFileSync(file, 'utf8'))
        if (/\bbeforeunload\b/.test(text) && !file.endsWith('.test.ts')) hits.push(file)
      }
    }
    expect(hits).toEqual(['src/features/profile/components/UserGaExcelManagePanel.tsx'])
  })
})
