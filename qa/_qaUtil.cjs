const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const serial = "R3KL202KGHF";
const tmp = os.tmpdir();
const API = "http://127.0.0.1:3001/backend/api";
const PASSWORD = "QaBizFire20260910!";
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
    const clazz = (n.match(/class="([^"]*)"/) || [])[1] || "";
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) return null;
    const x1 = +b[1], y1 = +b[2], x2 = +b[3], y2 = +b[4];
    if (!(y1 < y2 && x1 < x2)) return null;
    return { text, desc, clickable, clazz, x1, y1, x2, y2, x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) };
  }).filter(Boolean);
}
function find(xml, pred) { return nodes(xml).filter(pred); }
function tap(n, label = "") {
  console.log("TAP", label || n.text || n.desc, n.x, n.y);
  sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`);
}
async function dismissLeave(xml) {
  if (xml.includes("저장하지 않고 닫기")) {
    const c = find(xml, (n) => n.desc === "취소" || n.text === "취소")[0];
    if (c) tap(c, "cancel-leave");
    await sleep(800);
    return true;
  }
  return false;
}
async function scrollTop() {
  for (let i = 0; i < 8; i++) {
    sh(`adb -s ${serial} shell input swipe 540 600 540 1800 220`);
    await sleep(150);
  }
}
async function apiLogin() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "tjddyd55", password: PASSWORD }),
  });
  const j = await res.json();
  if (!j.token) throw new Error("login fail");
  return j.token;
}
async function getCust(token) {
  return (await fetch(`${API}/customers/1342`, { headers: { Authorization: `Bearer ${token}` } })).json();
}
async function putBiz(token, memo, address) {
  const body = {
    businessInfo: {
      representativeName: "홍길동",
      businessNumber: "123-45-67890",
      businessAddress: address || "서울특별시 테스트구 테스트로 10",
      memo,
    },
  };
  return fetch(`${API}/customers/1342`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function openEdit() {
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`);
  await sleep(3500);
  await scrollTop();
}
async function openDetail() {
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342"`);
  await sleep(3500);
}
async function openSection(openLabel, openedHint) {
  for (let i = 0; i < 12; i++) {
    let xml = dump("sec" + i);
    await dismissLeave(xml);
    if (xml.includes(openedHint) || xml.includes(openLabel.replace("펼치기", "접기"))) return xml;
    const open = find(xml, (n) => n.desc === openLabel || n.text === openLabel)[0];
    if (open) {
      tap(open, openLabel);
      await sleep(900);
      return dump("secopened");
    }
    sh(`adb -s ${serial} shell input swipe 540 1600 540 900 300`);
    await sleep(350);
  }
  throw new Error("section not found " + openLabel);
}
async function ensureGender(xml) {
  if (xml.includes("성별을 선택해 주세요")) {
    const male = find(xml, (n) => n.text === "남" || n.desc === "남")[0];
    if (male) {
      tap(male, "male");
      await sleep(400);
    }
  }
}
async function saveForm() {
  for (let i = 0; i < 3; i++) {
    sh(`adb -s ${serial} shell input swipe 540 1800 540 500 280`);
    await sleep(250);
  }
  let xml = dump("savebtn");
  await dismissLeave(xml);
  let btn = find(xml, (n) => n.text === "변경 저장" || n.desc === "변경 저장")[0];
  if (!btn) {
    sh(`adb -s ${serial} shell input swipe 540 400 540 1600 250`);
    await sleep(300);
    xml = dump("savebtn2");
    btn = find(xml, (n) => n.text === "변경 저장" || n.desc === "변경 저장")[0];
  }
  if (!btn) throw new Error("no save");
  tap(btn, "save");
  await sleep(8000);
}
async function pickDaum(query) {
  let xml = dump("daumOpen");
  await dismissLeave(xml);
  const edit = find(xml, (n) => n.clazz.includes("EditText"))[0];
  if (!edit) throw new Error("no daum edit");
  tap(edit, "daum-edit");
  await sleep(300);
  for (let i = 0; i < 50; i++) sh(`adb -s ${serial} shell input keyevent 67`);
  const b64 = Buffer.from(query, "utf8").toString("base64");
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
  await sleep(1000);
  xml = dump("daumTyped");
  console.log("typed", find(xml, (n) => n.clazz.includes("EditText"))[0]?.text);
  const searchBtn = find(xml, (n) => n.text === "검색" && n.clickable === "true")[0];
  if (!searchBtn) throw new Error("no search btn");
  tap(searchBtn, "search");
  await sleep(3500);
  xml = dump("daumResults");
  console.log("results", [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).slice(0, 30));
  let result = find(xml, (n) => /로\s*\d+|길\s*\d+|세종|판교|중구|서울|성남/.test(n.text) && n.y > 300 && n.y < 1800)[0];
  if (!result) result = find(xml, (n) => n.clickable === "true" && n.y > 400 && n.y < 1400 && !/닫기|검색|취소|안내/.test(n.text + n.desc))[0];
  if (result) tap(result, "result");
  else sh(`adb -s ${serial} shell input tap 540 750`);
  await sleep(2500);
  xml = dump("daumDone");
  if (xml.includes("우편번호 검색")) {
    const cands = find(xml, (n) => n.clickable === "true" && n.y > 500 && n.y < 1600);
    if (cands[0]) {
      tap(cands[0], "cand");
      await sleep(2500);
    }
  }
  return dump("afterDaum");
}
function typeB64(text) {
  const b64 = Buffer.from(text, "utf8").toString("base64");
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
}
module.exports = {
  serial, API, PASSWORD, sh, sleep, dump, nodes, find, tap, dismissLeave, scrollTop,
  apiLogin, getCust, putBiz, openEdit, openDetail, openSection, ensureGender, saveForm, pickDaum, typeB64,
};