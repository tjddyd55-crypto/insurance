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
    return { text, desc, clickable, x: Math.floor((+b[1]+ +b[3])/2), y: Math.floor((+b[2]+ +b[4])/2), y1:+b[2], y2:+b[4], x1:+b[1], x2:+b[3] }
  }).filter(Boolean)
}

function find(xml, pred) { return nodes(xml).filter(pred) }
function tap(n) { sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`); return n }

async function dismissLeaveIfAny(xml) {
  if (xml.includes('저장하지 않고 닫기') || xml.includes('변경사항이 저장되지 않았습니다')) {
    log('LEAVE DIALOG - cancel')
    const cancel = find(xml, n => n.text === '취소' || n.desc === '취소')[0]
    if (cancel) tap(cancel)
    await sleep(800)
    return true
  }
  return false
}

async function scrollTop() {
  for (let i=0;i<8;i++){ sh(`adb -s ${serial} shell input swipe 540 600 540 1800 250`); await sleep(200) }
}

async function main() {
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`)
  sh(`adb -s ${serial} shell am force-stop com.onefc.app.dev`)
  await sleep(1200)
  sh(`adb -s ${serial} shell monkey -p com.onefc.app.dev -c android.intent.category.LAUNCHER 1`)
  await sleep(5000)
  let xml = dump('probe0')
  if (xml.includes('Development servers') || xml.includes('http://')) {
    const metro = find(xml, n => /8081/.test(n.text) || /8081/.test(n.desc))[0]
    if (metro) { tap(metro); await sleep(9000) }
  }
  xml = dump('probe1')
  if (xml.includes('로그인') || xml.includes('아이디')) {
    const id = find(xml, n => n.desc === '아이디' || n.text === '아이디')[0]
    const pw = find(xml, n => n.desc === '비밀번호' || n.text === '비밀번호')[0]
    const login = find(xml, n => n.desc === '로그인' || n.text === '로그인')[0]
    if (id) { tap(id); await sleep(300); sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "tjddyd55"`) }
    if (pw) { tap(pw); await sleep(300); sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "QaBizFire20260910!"`) }
    if (login) { tap(login); await sleep(7000) }
  }

  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`)
  await sleep(4000)
  await scrollTop()

  // find and open fire
  for (let i=0;i<10;i++) {
    xml = dump('seek'+i)
    await dismissLeaveIfAny(xml)
    const open = find(xml, n => n.desc === '화재보험 정보 펼치기' || n.text === '화재보험 정보 펼치기')[0]
    const opened = find(xml, n => n.desc === '화재보험 정보 접기' || n.text.includes('소재지'))[0]
    if (opened && xml.includes('소재지')) { log('fire already open at', i); break }
    if (open) { log('open fire', open); tap(open); await sleep(900); break }
    sh(`adb -s ${serial} shell input swipe 540 1600 540 900 320`); await sleep(400)
  }

  // scroll to 소재지 추가
  let addBtn = null
  for (let i=0;i<8;i++) {
    xml = dump('addseek'+i)
    await dismissLeaveIfAny(xml)
    addBtn = find(xml, n => n.text === '소재지 추가' || n.desc === '소재지 추가')[0]
    log('addseek', i, !!addBtn, find(xml, n => /소재지|추가/.test(n.text+n.desc)).map(n => ({t:n.text,d:n.desc,y:n.y})))
    if (addBtn) break
    sh(`adb -s ${serial} shell input swipe 540 1600 540 1000 300`); await sleep(400)
  }
  if (!addBtn) throw new Error('no add btn')
  tap(addBtn); await sleep(1000)

  // find 주소 검색 under 소재지 3
  let addr3 = null
  for (let i=0;i<6;i++) {
    xml = dump('addr'+i)
    await dismissLeaveIfAny(xml)
    const locs = find(xml, n => /^소재지 \d+$/.test(n.text))
    const addrs = find(xml, n => n.text === '주소 검색' || n.desc === '주소 검색')
    log('addr', i, 'locs', locs.map(n=>({t:n.text,y:n.y})), 'addrs', addrs.map(n=>({y:n.y,x:n.x})))
    const loc3 = locs.find(n => n.text === '소재지 3')
    if (loc3) {
      addr3 = addrs.filter(a => a.y > loc3.y).sort((a,b)=>a.y-b.y)[0]
      if (addr3) { log('addr3', addr3); break }
    }
    // fallback: lowest addr button
    if (!addr3 && addrs.length >= 3) addr3 = addrs.sort((a,b)=>b.y-a.y)[0]
    if (addr3 && loc3) break
    sh(`adb -s ${serial} shell input swipe 540 1600 540 1100 280`); await sleep(350)
  }
  if (!addr3) throw new Error('no addr3')
  tap(addr3); await sleep(5000)
  xml = dump('daum')
  const texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])
  const descs = [...xml.matchAll(/content-desc="([^"]+)"/g)].map(m=>m[1])
  log('daum texts', texts.slice(0,40))
  log('daum descs', descs.slice(0,40))
  log('daum interesting', find(xml, n => /검색|닫기|주소|취소|저장|WebView|EditText|입력/.test(n.text+n.desc) || n.clickable==='true').slice(0,30))
  fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum-live.json', JSON.stringify({texts, descs, nodes: find(xml, ()=>true).filter(n=>n.text||n.desc).slice(0,80)}, null, 2), 'utf8')
  fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum-live.txt', out.join('\n'), 'utf8')
}
main().catch(e => { log('ERR', String(e)); fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-daum-live.txt', out.join('\n'), 'utf8'); process.exit(1) })
