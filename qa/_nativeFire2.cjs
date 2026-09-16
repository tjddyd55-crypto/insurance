const u = require("./_qaUtil.cjs");
const fs = require("fs");
const MEMO_ADD = "Native UI 최종 QA";
const MEMO_EDIT = "Native UI 최종 QA 수정";

async function pickDaumRetry(query) {
  let edit = null;
  let xml = null;
  for (let i = 0; i < 8; i++) {
    xml = u.dump("daumW" + i);
    await u.dismissLeave(xml);
    edit = u.find(xml, (n) => n.clazz.includes("EditText"))[0];
    if (edit) break;
    await u.sleep(1000);
  }
  if (!edit) throw new Error("no daum edit after wait");
  u.tap(edit, "daum-edit");
  await u.sleep(300);
  for (let i = 0; i < 50; i++) u.sh(`adb -s ${u.serial} shell input keyevent 67`);
  u.typeB64(query);
  await u.sleep(1000);
  xml = u.dump("daumTyped");
  console.log("typed", u.find(xml, (n) => n.clazz.includes("EditText"))[0]?.text);
  const searchBtn = u.find(xml, (n) => n.text === "검색" && n.clickable === "true")[0];
  if (!searchBtn) throw new Error("no search btn");
  u.tap(searchBtn, "search");
  await u.sleep(3500);
  xml = u.dump("daumResults");
  console.log("results", [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).slice(0, 40));
  let result = u.find(xml, (n) => /로\s*\d+|길\s*\d+|세종|판교|중구|서울|성남|삼평/.test(n.text) && n.y > 350 && n.y < 1800)[0];
  if (!result) {
    result = u.find(xml, (n) => n.text && n.text.length > 8 && n.y > 400 && n.y < 1500 && !/tip|검색|Powered|조합|예시|예\)/.test(n.text))[0];
  }
  if (result) u.tap(result, "result");
  else u.sh(`adb -s ${u.serial} shell input tap 540 800`);
  await u.sleep(3000);
  xml = u.dump("daumDone");
  console.log("after pick", [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).slice(0, 25));
  if (xml.includes("우편번호 검색") || xml.includes("검색결과가")) {
    const rows = u.find(xml, (n) => n.clickable === "true" && n.y > 450 && n.y < 1500 && !/닫기|검색|취소|안내/.test(n.text + n.desc));
    if (rows[0]) { u.tap(rows[0], "row0"); await u.sleep(3000); }
    else { u.sh(`adb -s ${u.serial} shell input tap 540 700`); await u.sleep(3000); }
    xml = u.dump("daumDone2");
    console.log("after retry", [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).slice(0, 25));
  }
  return xml;
}

async function ensureLoc3AddrOpen() {
  let xml = u.dump("start");
  if (xml.includes("우편번호") || u.find(xml, (n) => n.clazz.includes("EditText")).length) return;
  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");
  for (let i = 0; i < 6; i++) {
    xml = u.dump("chk" + i);
    if (xml.includes("소재지 3")) break;
    const add = u.find(xml, (n) => (n.desc === "소재지 추가" || n.text === "소재지 추가") && n.y < 2000)[0];
    if (add) {
      if (add.y > 1750) {
        u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1200 250`);
        await u.sleep(300);
        xml = u.dump("addn");
      }
      const add2 = u.find(xml, (n) => n.desc === "소재지 추가" || n.text === "소재지 추가")[0] || add;
      u.tap(add2, "add");
      await u.sleep(900);
      break;
    }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 280`);
    await u.sleep(300);
  }
  for (let i = 0; i < 6; i++) {
    xml = u.dump("a" + i);
    const loc3 = u.find(xml, (n) => n.text === "소재지 3")[0];
    const addrs = u.find(xml, (n) => (n.desc === "주소 검색" || n.text === "주소 검색") && n.clickable === "true");
    if (loc3) {
      const addr = addrs.filter((a) => a.y > loc3.y && a.y < 1950)[0];
      if (addr) { u.tap(addr, "addr3"); await u.sleep(5500); return; }
      u.sh(`adb -s ${u.serial} shell input swipe 540 1500 540 1100 250`);
      await u.sleep(300);
      continue;
    }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1100 250`);
    await u.sleep(300);
  }
  throw new Error("could not open loc3 address search");
}

(async () => {
  u.sh(`adb -s ${u.serial} shell ime set com.android.adbkeyboard/.AdbIME`);
  await ensureLoc3AddrOpen();
  await pickDaumRetry("판교역로 166");

  let xml = u.dump("memo1");
  for (let i = 0; i < 5; i++) {
    if (xml.includes("소재지 3") || xml.includes("기본주소")) break;
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1100 250`);
    await u.sleep(300);
    xml = u.dump("ms" + i);
  }
  if (!xml.includes("소재지")) {
    await u.openEdit();
    await u.openSection("화재보험 정보 펼치기", "소재지");
    for (let i = 0; i < 5; i++) {
      xml = u.dump("ms2" + i);
      if (xml.includes("소재지 3")) break;
      u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 250`);
      await u.sleep(300);
    }
  }
  const memos = u.find(xml, (n) => n.desc === "메모" || n.text === "메모");
  const lastMemo = memos[memos.length - 1];
  if (lastMemo) {
    u.tap(lastMemo, "memo");
    await u.sleep(300);
    u.typeB64(MEMO_ADD);
    await u.sleep(600);
  }
  xml = u.dump("befSave");
  await u.ensureGender(xml);
  await u.saveForm();

  const afterAdd = await u.getCust(await u.apiLogin());
  console.log("fire after add", afterAdd.fireInsuranceLocations);
  const loc3 = (afterAdd.fireInsuranceLocations || []).find((l) => l.memo === MEMO_ADD)
    || (afterAdd.fireInsuranceLocations || []).find((l) => l.sortOrder === 2 && l.id !== 11 && l.id !== 12);
  if (!loc3) throw new Error("add failed");
  const loc3Id = loc3.id;
  const addPass = (afterAdd.fireInsuranceLocations || []).some((l) => l.id === 11)
    && (afterAdd.fireInsuranceLocations || []).some((l) => l.id === 12);

  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");
  for (let i = 0; i < 5; i++) {
    xml = u.dump("em" + i);
    if (xml.includes("소재지 3") || u.find(xml, (n) => n.desc === "메모").length >= 3) break;
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 250`);
    await u.sleep(300);
  }
  const memos2 = u.find(xml, (n) => n.desc === "메모" || n.text === "메모");
  const last2 = memos2[memos2.length - 1];
  if (last2) {
    u.tap(last2, "memo-edit");
    await u.sleep(300);
    for (let i = 0; i < 60; i++) u.sh(`adb -s ${u.serial} shell input keyevent 67`);
    u.typeB64(MEMO_EDIT);
    await u.sleep(500);
  }
  xml = u.dump("befEdit");
  await u.ensureGender(xml);
  await u.saveForm();
  const afterEdit = await u.getCust(await u.apiLogin());
  const edited = (afterEdit.fireInsuranceLocations || []).find((l) => l.id === loc3Id);
  const editPass = !!(edited && edited.memo === MEMO_EDIT);
  console.log("edited", edited);

  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");
  for (let i = 0; i < 5; i++) {
    xml = u.dump("dl" + i);
    if (u.find(xml, (n) => n.desc === "삭제" || n.text === "삭제").length >= 3 || xml.includes("소재지 3")) break;
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 250`);
    await u.sleep(300);
  }
  const dels = u.find(xml, (n) => n.desc === "삭제" || n.text === "삭제");
  const lastDel = dels[dels.length - 1];
  if (lastDel) { u.tap(lastDel, "del"); await u.sleep(600); }
  xml = u.dump("befDel");
  await u.ensureGender(xml);
  await u.saveForm();
  const afterDel = await u.getCust(await u.apiLogin());
  const still = (afterDel.fireInsuranceLocations || []).some((l) => l.id === loc3Id);
  const ids = (afterDel.fireInsuranceLocations || []).map((l) => l.id).sort();
  const delPass = !still && ids.join(",") === "11,12";

  const report = {
    loc3Id, sortOrder: loc3.sortOrder, address: loc3.address,
    addPass, editPass, idKept: edited?.id === loc3Id, delPass,
    remaining: afterDel.fireInsuranceLocations,
    pass: addPass && editPass && delPass,
  };
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/native-fire-final.json", JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(String(e));
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/native-fire-final.json", JSON.stringify({ pass: false, error: String(e) }, null, 2), "utf8");
  process.exit(1);
});
