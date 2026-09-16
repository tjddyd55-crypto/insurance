import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const serial = 'R3KL202KGHF'
const tmp = os.tmpdir()
const log = (...a) => console.log(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '))
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
    const clazz = (n.match(/class="([^"]*)"/) || [])[1] || ''
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!b) return null
    const x1=+b[1], y1=+b[2], x2=+b[3], y2=+b[4]
    if (!(y1 < y2 && x1 < x2)) return null
    return { text, desc, clickable, clazz, x1,y1,x2,y2, x: Math.floor((x1+x2)/2), y: Math.floor((y1+y2)/2) }
  }).filter(Boolean)
}
function find(xml, pred) { return nodes(xml).filter(pred) }
function tap(n, label='') { log('TAP', label||n.text||n.desc, n.x, n.y); sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`) }

async function dismissLeave(xml) {
  if (xml.includes('저장하지 않고 닫기')) {
    const c = find(xml, n => n.desc === '취소' || n.text === '취소')[0]
    if (c) tap(c, 'cancel-leave')
    await sleep(800)
    return true
  }
  return false
}

async function main() {
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`)
  let xml = dump('d0')
  await dismissLeave(xml)
  // if on guide page, close
  xml = dump('d1')
  log('start texts', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,30))
  const close = find(xml, n => n.text === '닫기' || n.desc === '닫기')[0]
  if (close) { tap(close, 'close'); await sleep(1000) }
  // back if needed
  xml = dump('d2')
  if (xml.includes('postcode') || xml.includes('guide')) {
    sh(`adb -s ${serial} shell input keyevent 4`); await sleep(1000)
  }
  xml = dump('d3')
  log('now', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,30))

  // If still in daum modal with just 닫기, try reopen search from edit
  if (!xml.includes('소재지') && xml.includes('닫기')) {
    // already in address modal - good
  } else if (xml.includes('소재지')) {
    // need to open addr search again
    const loc3 = find(xml, n => n.text === '소재지 3')[0]
    const addrs = find(xml, n => (n.desc === '주소 검색' || n.text === '주소 검색') && n.clickable==='true')
    let addr = loc3 ? addrs.filter(a => a.y > loc3.y).sort((a,b)=>a.y-b.y)[0] : null
    if (!addr) addr = addrs.sort((a,b)=>b.y-a.y)[0]
    if (addr && addr.y < 2000) { tap(addr, 'addr'); await sleep(4500) }
    else {
      sh(`adb -s ${serial} shell input swipe 540 1500 540 1100 250`); await sleep(400)
      xml = dump('d3b')
      const loc3b = find(xml, n => n.text === '소재지 3')[0]
      const addrsb = find(xml, n => (n.desc === '주소 검색' || n.text === '주소 검색') && n.clickable==='true')
      addr = loc3b ? addrsb.filter(a => a.y > loc3b.y).sort((a,b)=>a.y-b.y)[0] : addrsb.sort((a,b)=>b.y-a.y)[0]
      tap(addr, 'addr2'); await sleep(4500)
    }
  }

  xml = dump('daumA')
  let texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
  log('daumA', texts.slice(0,40))
  log('nodes', find(xml, n => n.text || n.desc).map(n => ({t:n.text,d:n.desc,c:n.clickable,cls:n.clazz.split('.').pop(),y:n.y,x:n.x})).slice(0,60))

  // Focus input: look for EditText or "우편번호 검색 입력폼"
  const input = find(xml, n => n.text.includes('입력폼') || n.desc.includes('입력') || n.clazz.includes('EditText'))[0]
    || find(xml, n => n.text.includes('검색할 도로명'))[0]
  if (input) tap(input, 'input')
  else sh(`adb -s ${serial} shell input tap 540 380`)
  await sleep(400)
  // clear and type
  for (let i=0;i<30;i++) sh(`adb -s ${serial} shell input keyevent 67`)
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "세종대로 110"`)
  await sleep(1500)

  xml = dump('daumB')
  texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
  log('daumB', texts.slice(0,50))
  const searchBtn = find(xml, n => (n.text === '검색' || n.desc === '검색') && n.clickable !== 'false')[0]
  log('searchBtn', searchBtn)
  if (searchBtn) tap(searchBtn, 'search')
  else {
    // try find clickable near text 검색
    const s = find(xml, n => n.text === '검색')[0]
    if (s) tap(s, 'search-text')
  }
  await sleep(3000)

  xml = dump('daumC')
  texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
  log('daumC', texts)
  log('clickables', find(xml, n => n.clickable==='true').map(n => ({t:n.text,d:n.desc,y:n.y,x:n.x,cls:n.clazz.split('.').pop()})))
  // pick result containing 세종
  let result = find(xml, n => /세종/.test(n.text) && n.clickable==='true')[0]
    || find(xml, n => /세종/.test(n.text))[0]
    || find(xml, n => /서울/.test(n.text) && n.y > 500)[0]
  if (result) {
    tap(result, 'result')
    await sleep(2500)
  } else {
    // tap first list-ish area
    sh(`adb -s ${serial} shell input tap 540 900`); await sleep(2500)
  }
  xml = dump('daumD')
  texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
  log('daumD', texts.slice(0,40))
  fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum-pick.json', JSON.stringify({texts, nodes: find(xml, n=>n.text||n.desc).slice(0,80)}, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
