import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const serial = 'R3KL202KGHF'
const tmp = os.tmpdir()
const out = []
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s) }
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function dump(name) {
  sh(`adb -s ${serial} shell uiautomator dump /sdcard/${name}.xml`)
  const local = path.join(tmp, `${name}.xml`)
  sh(`adb -s ${serial} pull /sdcard/${name}.xml ${local}`)
  return fs.readFileSync(local, 'utf8')
}
function nodes(xml) {
  return [...xml.matchAll(/<node [^>]*>/g)].map(m => m[0]).map(n => {
    const text = (n.match(/text="([^"]*)"/) || [])[1] || ''
    const desc = (n.match(/content-desc="([^"]*)"/) || [])[1] || ''
    const clickable = (n.match(/clickable="([^"]*)"/) || [])[1]
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!b) return null
    const x1=+b[1], y1=+b[2], x2=+b[3], y2=+b[4]
    return { text, desc, clickable, x1,y1,x2,y2, x: Math.floor((x1+x2)/2), y: Math.floor((y1+y2)/2), valid: y1 < y2 && x1 < x2 && y2-y1 > 20 }
  }).filter(Boolean)
}
function find(xml, pred) { return nodes(xml).filter(pred) }
function tap(n) { log('TAP', n.text||n.desc, n.x, n.y, 'bounds', [n.x1,n.y1,n.x2,n.y2], 'valid', n.valid); sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`); return n }

async function dismissLeave(xml) {
  if (xml.includes('저장하지 않고 닫기') || xml.includes('변경사항이 저장되지 않았습니다')) {
    log('LEAVE DIALOG - press 취소')
    const cancel = find(xml, n => (n.text === '취소' || n.desc === '취소') && n.clickable === 'true')[0]
      || find(xml, n => n.text === '취소' || n.desc === '취소')[0]
    if (cancel) tap(cancel)
    await sleep(900)
    return true
  }
  return false
}

async function scrollTop() {
  for (let i=0;i<8;i++){ sh(`adb -s ${serial} shell input swipe 540 600 540 1800 250`); await sleep(180) }
}

async function openEditFire() {
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`)
  await sleep(3500)
  await scrollTop()
  for (let i=0;i<10;i++) {
    let xml = dump('of'+i)
    await dismissLeave(xml)
    if (xml.includes('화재보험 정보 접기') && xml.includes('소재지')) return xml
    const open = find(xml, n => n.desc === '화재보험 정보 펼치기')[0]
    if (open) { tap(open); await sleep(900); return dump('ofopen') }
    sh(`adb -s ${serial} shell input swipe 540 1600 540 900 320`); await sleep(350)
  }
  throw new Error('fire not found')
}

async function main() {
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`)
  // cancel any leftover leave dialog first
  let xml = dump('pre')
  await dismissLeave(xml)

  await openEditFire()

  // scroll to add
  let addBtn = null
  for (let i=0;i<8;i++) {
    xml = dump('as'+i)
    await dismissLeave(xml)
    addBtn = find(xml, n => (n.desc === '소재지 추가' || n.text === '소재지 추가') && n.valid)[0]
      || find(xml, n => n.desc === '소재지 추가' || n.text === '소재지 추가')[0]
    if (addBtn) break
    sh(`adb -s ${serial} shell input swipe 540 1600 540 1000 300`); await sleep(350)
  }
  if (!addBtn) throw new Error('no add')
  // if add near bottom, nudge up first so after-add loc3 fits
  if (addBtn.y > 1800) {
    sh(`adb -s ${serial} shell input swipe 540 1600 540 1200 280`); await sleep(400)
    xml = dump('asnudge')
    addBtn = find(xml, n => n.desc === '소재지 추가' || n.text === '소재지 추가')[0]
  }
  tap(addBtn); await sleep(1200)

  // bring loc3 fully on screen
  for (let i=0;i<5;i++) {
    xml = dump('l3'+i)
    await dismissLeave(xml)
    const loc3 = find(xml, n => n.text === '소재지 3')[0]
    const addrs = find(xml, n => (n.text === '주소 검색' || n.desc === '주소 검색') && n.clickable === 'true')
    log('l3', i, !!loc3, loc3 && {y:loc3.y,valid:loc3.valid}, 'addrs', addrs.map(a=>({y:a.y,valid:a.valid,y1:a.y1,y2:a.y2})))
    if (loc3) {
      let addr = addrs.filter(a => a.y > loc3.y - 20 && a.valid).sort((a,b)=>a.y-b.y)[0]
      if (!addr || addr.y > 2000 || !addr.valid) {
        // scroll up a bit to bring into safe zone
        sh(`adb -s ${serial} shell input swipe 540 1500 540 1100 280`); await sleep(400)
        continue
      }
      tap(addr); await sleep(5500)
      xml = dump('daum2')
      await dismissLeave(xml)
      const texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
      log('AFTER ADDR TAP texts', texts.slice(0,50))
      fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum2.json', JSON.stringify({texts, nodes: find(xml, n => n.text || n.desc).slice(0,100)}, null, 2), 'utf8')

      // If Daum search field visible, type and pick
      const edit = find(xml, n => /EditText|검색|search/i.test(n.desc+n.text) || (n.clickable==='true' && n.y < 800 && n.y > 200))[0]
      // try common Daum postcode webview: tap search box area then type
      if (xml.includes('주소') || xml.includes('검색') || xml.includes('닫기')) {
        // tap likely search input
        sh(`adb -s ${serial} shell input tap 540 420`); await sleep(500)
        sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "세종대로"`); await sleep(2500)
        xml = dump('daum3')
        const texts2 = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
        log('after type', texts2.slice(0,60))
        // tap a result-looking row (not 닫기)
        const result = find(xml, n => n.clickable==='true' && n.y > 500 && n.y < 1600 && !/닫기|취소/.test(n.text+n.desc))[0]
        if (result) { tap(result); await sleep(2000) }
        else {
          sh(`adb -s ${serial} shell input tap 540 700`); await sleep(2000)
        }
        xml = dump('daum4')
        log('after pick', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,40))
      }
      fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum2.txt', out.join('\n'), 'utf8')
      return
    }
    sh(`adb -s ${serial} shell input swipe 540 1600 540 1100 280`); await sleep(350)
  }
  throw new Error('loc3 addr not tappable safely')
}
main().catch(e => { log('ERR', String(e)); fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum2.txt', out.join('\n'), 'utf8'); process.exit(1) })
