const u = require("./_qaUtil.cjs");
const fs = require("fs");
(async () => {
  await u.openDetail();
  await u.scrollTop();
  const labels = [];
  for (let i = 0; i < 12; i++) {
    const xml = u.dump("so" + i);
    const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]);
    const descs = [...xml.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1]);
    const interesting = [...texts, ...descs].filter((t) => /기본|자동차|연계|사업자|화재|기념|상담|계좌|운전/.test(t));
    console.log("i", i, interesting.slice(0, 20));
    for (const t of interesting) if (!labels.includes(t)) labels.push(t);
    u.sh(`adb -s ${u.serial} shell input swipe 540 1700 540 850 380`);
    await u.sleep(450);
  }
  // driving focused
  await u.scrollTop();
  let xml = u.dump("d0");
  // open basic if needed
  const openBasic = u.find(xml, (n) => n.desc === "기본 정보 펼치기")[0];
  if (openBasic) { u.tap(openBasic); await u.sleep(700); }
  // scroll inside to find 운전
  let sawDrive = false, driveY = null, basicOpen = false;
  for (let i = 0; i < 6; i++) {
    xml = u.dump("dd" + i);
    basicOpen = xml.includes("기본 정보 접기") || xml.includes("고객명");
    const d = u.find(xml, (n) => n.text === "운전 여부" || n.desc.includes("운전"))[0];
    if (d) { sawDrive = true; driveY = d.y; break; }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 300`);
    await u.sleep(350);
  }
  // collapse basic, open car only
  xml = u.dump("dc");
  const closeBasic = u.find(xml, (n) => n.desc === "기본 정보 접기")[0];
  if (closeBasic) { u.tap(closeBasic); await u.sleep(500); }
  await u.scrollTop();
  xml = u.dump("car0");
  const openCar = u.find(xml, (n) => n.desc === "자동차 정보 펼치기")[0];
  if (openCar) { u.tap(openCar); await u.sleep(700); }
  let driveInCar = false;
  for (let i = 0; i < 5; i++) {
    xml = u.dump("car" + i);
    if (xml.includes("운전 여부") || /운전함|안 함/.test(xml)) { driveInCar = true; break; }
    if (!xml.includes("자동차")) break;
    u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1000 300`);
    await u.sleep(300);
  }
  const out = { labels, sawDrive, driveY, basicOpen, driveInCar, drivingPass: sawDrive && !driveInCar };
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/native-part1b.json", JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });