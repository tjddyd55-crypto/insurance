import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const serial = 'R3KL202KGHF'
const tmp = os.tmpdir()
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
function dump(name) {
  sh(`adb -s ${serial} shell uiautomator dump /sdcard/${name}.xml`)
  const local = path.join(tmp, `${name}.xml`)
  sh(`adb -s ${serial} pull /sdcard/${name}.xml ${local}`)
  return fs.readFileSync(local, 'utf8')
}
function editText(xml) {
  const nodes = [...xml.matchAll(/<node [^>]*EditText[^>]*>/g)].map(m => m[0])
  return nodes.map(n => ({
    text: (n.match(/text="([^"]*)"/)||[])[1],
    bounds: (n.match(/bounds="([^"]*)"/)||[])[1],
  }))
}

async function main() {
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`)
  // clear field first
  sh(`adb -s ${serial} shell input tap 465 223`)
  await sleep(300)
  for (let i=0;i<40;i++) sh(`adb -s ${serial} shell input keyevent 67`)

  // try clipboard set-text
  try {
    const r = sh(`adb -s ${serial} shell cmd clipboard set-text --user 0 판교역로166`)
    console.log('clipboard', r)
  } catch (e) {
    console.log('clipboard fail', String(e).slice(0,300))
  }

  // try content write via service
  try {
    // Samsung?
    sh(`adb -s ${serial} shell service call clipboard 2 i32 1 i32 0 s16 com.android.shell s16 판교역로166`)
    console.log('service call tried')
  } catch (e) {
    console.log('service fail', String(e).slice(0,200))
  }

  sh(`adb -s ${serial} shell input tap 465 223`)
  await sleep(200)
  sh(`adb -s ${serial} shell input keyevent 279`) // paste
  await sleep(500)
  console.log('after paste', editText(dump('c1')))

  // B64 AdbIME
  for (let i=0;i<40;i++) sh(`adb -s ${serial} shell input keyevent 67`)
  const b64 = Buffer.from('판교역로 166', 'utf8').toString('base64')
  console.log('b64', b64)
  sh(`adb -s ${serial} shell input tap 465 223`)
  await sleep(200)
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`)
  await sleep(800)
  console.log('after b64', editText(dump('c2')))

  // ADB_INPUT_TEXT again after ensuring IME
  for (let i=0;i<40;i++) sh(`adb -s ${serial} shell input keyevent 67`)
  sh(`adb -s ${serial} shell input tap 465 223`)
  await sleep(200)
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "판교역로 166"`)
  await sleep(800)
  console.log('after text', editText(dump('c3')))

  // Try clear + type using appium settings style: input keyevent for each jamo? skip

  // Hybrid: close daum, use API to create loc3 with address, then UI for memo edit/delete?
  // Or: use RN TextInput for memo and set address via API after UI add creates empty?

  // One more: use uiautomator dump and `uiautomator runtest` - check if `cmd uiautomator` exists
  try {
    console.log(sh(`adb -s ${serial} shell cmd clipboard get-text --user 0`).slice(0,100))
  } catch(e) { console.log('get-text', String(e).slice(0,150)) }
}
main().catch(e=>{console.error(e); process.exit(1)})
