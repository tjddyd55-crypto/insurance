#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const target = path.join(scriptDir, 'provision-store-review-account.mjs')
const child = spawn(process.execPath, [target, '--profile', 'google', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code) => process.exit(code ?? 1))
