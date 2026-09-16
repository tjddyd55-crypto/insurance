const u = require("./_qaUtil.cjs");
const fs = require("fs");
(async () => {
  const report = {};
  // section order
  await u.openDetail();
  const expected = ["기본 정보","자동차 정보","연계 고객","사업자 정보","화재보험 정보","기념일","상담"];
  const found = [];
  for (let i = 0; i < 8; i++) {
    const xml = u.dump("ord" + i);
    for (const label of expected) {
      if ((xml.includes(`text="${label}"`) || xml.includes(`content-desc="${label} 펼치기"`) || xml.includes(`content-desc="${label} 접기"`)) && !found.includes(label)) found.push(label);
    }
    u.sh(`adb -s ${u.serial} shell input swipe 540 1700 540 900 400`);
    await u.sleep(500);
  }
  report.sectionOrder = { found, expected, pass: expected.every((s, i) => found.indexOf(s) === i) && found.length === expected.length };

  // accordion
  await u.openDetail();
  await u.scrollTop();
  for (const label of ["자동차 정보 접기","사업자 정보 접기","화재보험 정보 접기"]) {
    const xml = u.dump("col");
    const n = u.find(xml, (x) => x.desc === label)[0];
    if (n) { u.tap(n, label); await u.sleep(400); }
  }
  const closed = u.dump("closed");
  const defaultClosed = closed.includes("자동차 정보 펼치기") || closed.includes("사업자 정보 펼치기") || closed.includes("화재보험 정보 펼치기");
  for (const label of ["자동차 정보 펼치기","사업자 정보 펼치기","화재보험 정보 펼치기"]) {
    let xml = u.dump("op");
    let n = u.find(xml, (x) => x.desc === label)[0];
    if (!n) {
      u.sh(`adb -s ${u.serial} shell input swipe 540 1500 540 1000 280`);
      await u.sleep(300);
      xml = u.dump("op2");
      n = u.find(xml, (x) => x.desc === label)[0];
    }
    if (n) { u.tap(n, label); await u.sleep(500); }
  }
  const multi = u.dump("multi");
  const multiOpen = multi.includes("자동차 정보 접기") && multi.includes("사업자 정보 접기") && multi.includes("화재보험 정보 접기");
  report.accordion = { defaultClosed, multiOpen, pass: multiOpen };

  // driving in basic only
  await u.scrollTop();
  let xml = u.dump("drv0");
  if (xml.includes("기본 정보 펼치기")) {
    const n = u.find(xml, (x) => x.desc === "기본 정보 펼치기")[0];
    if (n) { u.tap(n); await u.sleep(500); }
    xml = u.dump("drv1");
  }
  const inBasic = xml.includes("운전 여부") || xml.includes("운전함");
  if (xml.includes("자동차 정보 펼치기")) {
    const n = u.find(xml, (x) => x.desc === "자동차 정보 펼치기")[0];
    if (n) { u.tap(n); await u.sleep(500); }
  }
  xml = u.dump("drv2");
  if (xml.includes("기본 정보 접기")) {
    const n = u.find(xml, (x) => x.desc === "기본 정보 접기")[0];
    if (n) { u.tap(n); await u.sleep(500); }
    xml = u.dump("drv3");
  }
  const driveInsideCarOnly = (xml.includes("운전 여부") || xml.includes("운전함")) && !xml.includes("고객명") && !xml.includes("기본 정보");
  report.driving = { inBasic, driveInsideCarOnly, pass: inBasic && !driveInsideCarOnly };

  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/native-part1.json", JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });