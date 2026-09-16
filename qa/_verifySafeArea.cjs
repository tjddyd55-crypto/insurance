const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const serial = "R3KL202KGHF";
const tmp = os.tmpdir();
const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function dump(name) {
  sh(`adb -s ${serial} shell uiautomator dump /sdcard/${name}.xml`);
  const local = path.join(tmp, `${name}.xml`);
  sh(`adb -s ${serial} pull /sdcard/${name}.xml ${local}`);
  return fs.readFileSync(local, "utf8");
}
function nodes(xml) {
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => m[0]).map((n) => {
    const text = (n.match(/text="([^"]*)"/) || [])[1] || "";
    const desc = (n.match(/content-desc="([^"]*)"/) || [])[1] || "";
    const clickable = (n.match(/clickable="([^"]*)"/) || [])[1];
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) return null;
    const x1 = +b[1], y1 = +b[2], x2 = +b[3], y2 = +b[4];
    if (!(y1 < y2 && x1 < x2)) return null;
    return { text, desc, clickable, x1, y1, x2, y2, x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) };
  }).filter(Boolean);
}
function find(xml, pred) { return nodes(xml).filter(pred); }
function tap(n) { sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`); }

async function dismissLeave(xml) {
  if (xml.includes("저장하지 않고 닫기")) {
    const c = find(xml, (n) => n.desc === "취소" || n.text === "취소")[0];
    if (c) tap(c);
    await sleep(800);
    return true;
  }
  return false;
}

async function main() {
  sh(`adb -s ${serial} reverse tcp:8081 tcp:8081`);
  sh(`adb -s ${serial} reverse tcp:3001 tcp:3001`);
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`);
  // force reload JS bundle
  sh(`adb -s ${serial} shell am force-stop com.onefc.app.dev`);
  await sleep(1500);
  sh(`adb -s ${serial} shell monkey -p com.onefc.app.dev -c android.intent.category.LAUNCHER 1`);
  await sleep(6000);
  let xml = dump("boot");
  if (xml.includes("8081") || xml.includes("Development servers")) {
    const metro = find(xml, (n) => /8081/.test(n.text + n.desc))[0];
    if (metro) { tap(metro); await sleep(10000); }
  }
  xml = dump("login");
  if (xml.includes("로그인") || xml.includes("아이디")) {
    const id = find(xml, (n) => n.desc === "아이디" || n.text === "아이디")[0];
    const pw = find(xml, (n) => n.desc === "비밀번호" || n.text === "비밀번호")[0];
    const login = find(xml, (n) => n.desc === "로그인" || n.text === "로그인")[0];
    if (id) { tap(id); await sleep(200); sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "tjddyd55"`); }
    if (pw) { tap(pw); await sleep(200); sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_TEXT --es msg "QaBizFire20260910!"`); }
    if (login) { tap(login); await sleep(7000); }
  }

  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`);
  await sleep(4000);
  for (let i = 0; i < 8; i++) { sh(`adb -s ${serial} shell input swipe 540 600 540 1800 220`); await sleep(150); }

  // open business or fire address - use business first (nearer top after scroll to business)
  for (let i = 0; i < 10; i++) {
    xml = dump("seek" + i);
    await dismissLeave(xml);
    const bizOpen = find(xml, (n) => n.desc === "사업자 정보 펼치기")[0];
    const bizOpened = xml.includes("사업자 정보 접기");
    if (bizOpen) { tap(bizOpen); await sleep(800); break; }
    if (bizOpened) break;
    sh(`adb -s ${serial} shell input swipe 540 1600 540 900 300`);
    await sleep(350);
  }
  xml = dump("biz");
  let addr = find(xml, (n) => (n.desc === "주소 검색" || n.text === "주소 검색") && n.clickable === "true" && n.y < 2000)[0];
  if (!addr) {
    // scroll a bit
    sh(`adb -s ${serial} shell input swipe 540 1500 540 1000 280`);
    await sleep(400);
    xml = dump("biz2");
    addr = find(xml, (n) => (n.desc === "주소 검색" || n.text === "주소 검색") && n.clickable === "true" && n.y < 2000)[0];
  }
  if (!addr) throw new Error("no address search button");
  tap(addr);
  await sleep(4500);
  xml = dump("safeCheck");
  const header = find(xml, (n) => n.text === "주소 검색")[0];
  const close = find(xml, (n) => n.desc === "닫기" || n.text === "닫기")[0];
  const report = {
    headerY1: header && header.y1,
    headerY: header && header.y,
    closeY1: close && close.y1,
    closeY: close && close.y,
    // status bar on S25-ish ~72-100px; require header top >= ~80 after SafeArea
    clearsStatusBar: !!(header && header.y1 >= 70),
    texts: [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).slice(0, 15),
  };
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/safeArea-verify.json", JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  // close modal
  if (close) { tap(close); await sleep(800); }
  else sh(`adb -s ${serial} shell input keyevent 4`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });