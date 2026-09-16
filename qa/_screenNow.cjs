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
    const x1=+b[1], y1=+b[2], x2=+b[3], y2=+b[4];
    if (!(y1<y2 && x1<x2)) return null;
    return { text, desc, clickable, x1,y1,x2,y2, x:Math.floor((x1+x2)/2), y:Math.floor((y1+y2)/2) };
  }).filter(Boolean);
}
function find(xml, pred){ return nodes(xml).filter(pred); }
function tap(n){ sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`); }

(async () => {
  sh(`adb -s ${serial} reverse tcp:8081 tcp:8081`);
  sh(`adb -s ${serial} reverse tcp:3001 tcp:3001`);
  let xml = dump("now");
  const texts = [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]);
  const descs = [...xml.matchAll(/content-desc="([^"]+)"/g)].map(m=>m[1]);
  console.log("TEXTS", texts.slice(0,40));
  console.log("DESCS", descs.filter(d=>d).slice(0,40));
  // if stuck on leave dialog
  if (xml.includes("저장하지")) {
    const c = find(xml, n => n.desc==="취소"||n.text==="취소")[0];
    if (c) { tap(c); await sleep(800); }
  }
  // if metro picker
  const metro = find(xml, n => /8081/.test(n.text+n.desc))[0];
  if (metro) { console.log("tap metro", metro); tap(metro); await sleep(12000); xml=dump("aftermetro"); console.log([...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,30)); }
  // RR reload via adb
  sh(`adb -s ${serial} shell input text "RR"`);
  await sleep(2000);
  // open deep link again
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`);
  await sleep(5000);
  xml = dump("edit");
  console.log("EDIT", [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,40));
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/screen-now.json", JSON.stringify({texts:[...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]), descs:[...xml.matchAll(/content-desc="([^"]+)"/g)].map(m=>m[1]).filter(Boolean)},null,2));
})().catch(e=>{console.error(e); process.exit(1);});