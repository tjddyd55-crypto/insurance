/**
 * Visual baseline capture for coverage simulator (requires playwright + dev server).
 * usage:
 *   npm run dev
 *   node scripts/qa/coverageSimulatorVisual.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, devices } from 'playwright'

const baseUrl = process.env.COVERAGE_SIM_BASE_URL ?? 'http://localhost:3000'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')

const viewports = [
  { name: '360', width: 360, height: 900 },
  { name: '375', width: 375, height: 900 },
  { name: '390', width: 390, height: 900 },
  { name: '412', width: 412, height: 900 },
  { name: 'pc-1440', width: 1440, height: 1200 },
]

async function capture(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []

  for (const viewport of viewports) {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    await page.goto(`${baseUrl}/coverage-simulator/cancer`, { waitUntil: 'networkidle' })
    const file = await capture(page, `cancer-editor-${viewport.name}`)
    results.push(file)
    await context.close()
  }

  await browser.close()
  await writeFile(join(outDir, 'capture-log.txt'), results.join('\n'), 'utf8')
  console.log(`[coverageSimulatorVisual] saved ${results.length} screenshots to ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
