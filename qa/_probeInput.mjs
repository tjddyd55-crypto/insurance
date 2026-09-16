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
function tap(n,l=''){ log('TAP',l||n.text||n.desc||n.clazz,n.x,n.y); sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`) }

async function setClipboard(text) {
  // try several methods
  try { sh(`adb -s ${serial} shell cmd clipboard set-text --user 0 '${text}'`); log('clipboard cmd ok'); return } catch(e) { log('clipboard cmd fail', e.message) }
  try {
    const b64 = Buffer.from(text, 'utf8').toString('base64')
    sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`)
    log('adb b64 tried')
  } catch(e) { log('b64 fail', e.message) }
}

async function main() {
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`)
  let xml = dump('p0')
  log('texts', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,20))
  // ensure in daum modal
  if (!xml.includes('우편번호') && !xml.includes('주소 검색')) {
    log('not in daum - abort reopen needed')
  }
  const edit = find(xml, n => n.clazz.includes('EditText'))[0]
  log('edit', edit)
  if (!edit) throw new Error('no edittext')
  tap(edit, 'edit')
  await sleep(500)

  // Method 1: AdbIME
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "판교역로 166"`)
  await sleep(1000)
  xml = dump('p1')
  let editAfter = find(xml, n => n.clazz.includes('EditText'))[0]
  log('after adbime', editAfter && editAfter.text)

  // Method 2: clipboard + paste
  if (!editAfter?.text || editAfter.text.includes('검색할')) {
    // write text file and use service
    fs.writeFileSync(path.join(tmp, 'clip.txt'), '판교역로 166', 'utf8')
    try {
      sh(`adb -s ${serial} push ${path.join(tmp, 'clip.txt')} /sdcard/clip.txt`)
      // Android 13+ 
      const r = sh(`adb -s ${serial} shell "cmd clipboard set-text --user 0 \\$(cat /sdcard/clip.txt)"`)
      log('set-text', r)
    } catch(e) {
      log('set-text err', String(e).slice(0,200))
    }
    tap(edit, 'edit2'); await sleep(300)
    // long press paste? KEYCODE_PASTE = 279
    sh(`adb -s ${serial} shell input keyevent 279`)
    await sleep(800)
    xml = dump('p2')
    editAfter = find(xml, n => n.clazz.includes('EditText'))[0]
    log('after paste', editAfter && editAfter.text)
  }

  // Method 3: input text ascii transliteration won't work; try uiautomator run
  if (!editAfter?.text || editAfter.text.includes('검색할')) {
    // Use appium-less: espresso no. Try broadcasting ADB_EDITOR_CODE
    tap(edit, 'edit3'); await sleep(200)
    sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "pangyoyeokro166"`)
    await sleep(500)
    // clear and try with escaped
    for (let i=0;i<40;i++) sh(`adb -s ${serial} shell input keyevent 67`)
    // Use shell input text with unicode via printf in device? 
    const escaped = '판교역로\\ 166'
    try {
      sh(`adb -s ${serial} shell input text "pangyo166"`)
      log('input text ascii done')
    } catch(e) { log('input text fail', e.message) }
    xml = dump('p3')
    editAfter = find(xml, n => n.clazz.includes('EditText'))[0]
    log('after inputtext', editAfter && editAfter.text, 'all', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,15))
  }

  // press search anyway
  const searchBtn = find(dump('p4'), n => n.text === '검색' && n.clickable === 'true')[0]
  if (searchBtn) { tap(searchBtn, 'search'); await sleep(3000) }
  xml = dump('p5')
  log('results', [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]))
  fs.writeFileSync('C:/workspace/insurance-prod-push/qa/probe-input.json', JSON.stringify({editAfter, texts:[...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1])},null,2))
}
main().catch(e=>{console.error(e); process.exit(1)})
