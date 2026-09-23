/**
 * USB ADB Android touch smoke for Coverage Simulator.
 *
 * Prerequisites:
 *   npm run dev
 *   USB device with Chrome
 *
 * Usage:
 *   COVERAGE_SIM_USER / COVERAGE_SIM_PASS
 *   node scripts/qa/coverageSimulatorAndroidTouch.mjs
 */
import { execSync, spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'android-device')
const USER = process.env.COVERAGE_SIM_USER || 'tjddyd55'
const PASS = process.env.COVERAGE_SIM_PASS || 'QaBizFire20260910!'
const BASE = 'http://localhost:3000'

function adb(cmd) {
  return execSync(`adb ${cmd}`, { encoding: 'utf8' }).trim()
}

function screencap(name) {
  const path = join(outDir, name)
  execSync(`adb exec-out screencap -p > "${path}"`, { shell: true, stdio: 'inherit' })
  return path
}

function tap(x, y) {
  adb(`shell input tap ${Math.round(x)} ${Math.round(y)}`)
}

function inputText(value) {
  const escaped = value.replace(/ /g, '%s').replace(/(['"\\$`!])/g, '\\$1')
  adb(`shell input text "${escaped}"`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const devices = adb('devices').split('\n').filter((line) => line.endsWith('\tdevice'))
  if (devices.length === 0) throw new Error('No USB adb device attached')

  adb('reverse tcp:3000 tcp:3000')
  adb(`shell am start -a android.intent.action.VIEW -d "${BASE}/login"`)
  await sleep(3500)
  screencap('01-login.png')

  const sizeLine = adb('shell wm size')
  const match = sizeLine.match(/(\d+)x(\d+)/)
  const width = Number(match?.[1] ?? 1080)
  const height = Number(match?.[2] ?? 2400)

  tap(width * 0.5, height * 0.34)
  await sleep(400)
  inputText(USER)
  await sleep(400)
  tap(width * 0.5, height * 0.42)
  await sleep(400)
  inputText(PASS)
  await sleep(400)
  tap(width * 0.5, height * 0.5)
  await sleep(6000)
  screencap('02-after-login.png')

  adb(`shell am start -a android.intent.action.VIEW -d "${BASE}/coverage-simulator/cancer"`)
  await sleep(5000)
  screencap('03-cancer.png')

  tap(width * 0.5, height * 0.55)
  await sleep(1200)
  screencap('04-after-tap-mid.png')

  adb('shell input swipe 500 1800 500 900 350')
  await sleep(1000)
  screencap('05-scrolled.png')

  const log = [
    `device=${devices[0].split('\t')[0]}`,
    `resolution=${width}x${height}`,
    'flows=login,cancer,scroll,tap',
    'checks=sheet/keyboard require visual review of 03-05 screenshots',
  ]
  await writeFile(join(outDir, 'android-touch-log.txt'), log.join('\n'), 'utf8')
  console.log('[coverageSimulatorAndroidTouch]', log.join(' | '))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
