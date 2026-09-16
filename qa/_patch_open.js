const fs = require('fs')
const path = 'qa/verifyPolishNow.mjs'
let s = fs.readFileSync(path, 'utf8')
if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)

const newOpen = `async function openCustomer(page) {
  await page.goto(WEB + '/customers?customerId=' + CID, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(900)
  const search = page.getByPlaceholder('이름 / 전화번호 검색')
  if (await search.count()) {
    await search.fill('01099090910')
    await page.waitForTimeout(900)
  }
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 45000 })
  await card.click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(700)
  const expand = page.getByText('상세 정보 펼치기', { exact: false }).first()
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
    await page.waitForTimeout(500)
  }
  await page.waitForFunction(() => {
    const el = document.querySelector('#customer-1342 .customer-expand-detail:not([hidden]), #customer-detail-read-basic-info')
    if (!el) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  }, null, { timeout: 25000 })
}`

s = s.replace(/async function openCustomer\(page\) \{[\s\S]*?\n\}/, newOpen)
fs.writeFileSync(path, s)
console.log('patched openCustomer')
