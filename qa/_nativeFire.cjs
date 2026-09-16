const u = require("./_qaUtil.cjs");
const fs = require("fs");
const MEMO_ADD = "Native UI 최종 QA";
const MEMO_EDIT = "Native UI 최종 QA 수정";
(async () => {
  u.sh(`adb -s ${u.serial} shell ime set com.android.adbkeyboard/.AdbIME`);
  const token0 = await u.apiLogin();
  const baseline = await u.getCust(token0);
  const baseIds = (baseline.fireInsuranceLocations || []).map((l) => l.id).sort();
  console.log("baseline", baseIds);

  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");

  let addBtn = null;
  for (let i = 0; i < 8; i++) {
    const xml = u.dump("fa" + i);
    await u.dismissLeave(xml);
    addBtn = u.find(xml, (n) => (n.desc === "소재지 추가" || n.text === "소재지 추가") && n.y < 2100)[0];
    if (addBtn) {
      if (addBtn.y > 1750) {
        u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1200 260`);
        await u.sleep(350);
        addBtn = u.find(u.dump("fan"), (n) => n.desc === "소재지 추가" || n.text === "소재지 추가")[0];
      }
      break;
    }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 280`);
    await u.sleep(350);
  }
  if (!addBtn) throw new Error("no add btn");
  u.tap(addBtn, "add-loc");
  await u.sleep(1000);

  let addr3 = null;
  for (let i = 0; i < 6; i++) {
    const xml = u.dump("l3a" + i);
    await u.dismissLeave(xml);
    const loc3 = u.find(xml, (n) => n.text === "소재지 3")[0];
    const addrs = u.find(xml, (n) => (n.desc === "주소 검색" || n.text === "주소 검색") && n.clickable === "true");
    console.log("l3", i, !!loc3, addrs.map((a) => a.y));
    if (loc3) {
      addr3 = addrs.filter((a) => a.y > loc3.y && a.y < 1950).sort((a, b) => a.y - b.y)[0];
      if (addr3) break;
      u.sh(`adb -s ${u.serial} shell input swipe 540 1500 540 1100 260`);
      await u.sleep(350);
      continue;
    }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1100 260`);
    await u.sleep(350);
  }
  if (!addr3) throw new Error("no loc3 addr");
  u.tap(addr3, "loc3-addr");
  await u.sleep(4500);
  await u.pickDaum("판교역로 166");

  let xml = u.dump("memo1");
  for (let i = 0; i < 4; i++) {
    if (u.find(xml, (n) => n.text === "소재지 3").length) break;
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1100 260`);
    await u.sleep(300);
    xml = u.dump("memoS" + i);
  }
  const memos = u.find(xml, (n) => n.desc === "메모" || n.text === "메모");
  const lastMemo = memos[memos.length - 1];
  if (lastMemo) {
    u.tap(lastMemo, "memo");
    await u.sleep(300);
    u.typeB64(MEMO_ADD);
    await u.sleep(600);
  }
  xml = u.dump("beforeSaveFire");
  await u.ensureGender(xml);
  await u.saveForm();

  let afterAdd = await u.getCust(await u.apiLogin());
  let loc3 = (afterAdd.fireInsuranceLocations || []).find((l) => l.memo === MEMO_ADD)
    || (afterAdd.fireInsuranceLocations || []).find((l) => l.sortOrder === 2);
  console.log("afterAdd", afterAdd.fireInsuranceLocations);
  if (!loc3) throw new Error("loc3 not saved");
  const addPass = baseIds.every((id) => (afterAdd.fireInsuranceLocations || []).some((l) => l.id === id));
  const loc3Id = loc3.id;

  // edit
  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");
  for (let i = 0; i < 4; i++) {
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 280`);
    await u.sleep(300);
  }
  xml = u.dump("editm");
  const memos2 = u.find(xml, (n) => n.desc === "메모" || n.text === "메모");
  const last2 = memos2[memos2.length - 1];
  if (last2) {
    u.tap(last2, "memo-edit");
    await u.sleep(300);
    for (let i = 0; i < 50; i++) u.sh(`adb -s ${u.serial} shell input keyevent 67`);
    u.typeB64(MEMO_EDIT);
    await u.sleep(500);
  }
  xml = u.dump("beforeEditSave");
  await u.ensureGender(xml);
  await u.saveForm();
  const afterEdit = await u.getCust(await u.apiLogin());
  const edited = (afterEdit.fireInsuranceLocations || []).find((l) => l.id === loc3Id);
  const editPass = !!(edited && edited.memo === MEMO_EDIT);
  console.log("edit", edited);

  // delete
  await u.openEdit();
  await u.openSection("화재보험 정보 펼치기", "소재지");
  for (let i = 0; i < 4; i++) {
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 280`);
    await u.sleep(300);
  }
  xml = u.dump("del");
  const dels = u.find(xml, (n) => n.desc === "삭제" || n.text === "삭제");
  const lastDel = dels[dels.length - 1];
  if (lastDel) {
    u.tap(lastDel, "del-loc3");
    await u.sleep(600);
  }
  xml = u.dump("beforeDelSave");
  await u.ensureGender(xml);
  await u.saveForm();
  const afterDel = await u.getCust(await u.apiLogin());
  const still = (afterDel.fireInsuranceLocations || []).some((l) => l.id === loc3Id);
  const remain = (afterDel.fireInsuranceLocations || []).map((l) => l.id).sort();
  const delPass = !still && remain.join(",") === baseIds.join(",");

  const report = {
    loc3Id,
    sortOrder: loc3.sortOrder,
    address: loc3.address,
    addPass,
    editPass,
    delPass,
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