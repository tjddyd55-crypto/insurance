const u = require("./_qaUtil.cjs");
const fs = require("fs");
(async () => {
  let xml = u.dump("now");
  console.log("texts", [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,40));
  console.log("edits", u.find(xml, n => n.clazz.includes("EditText")));
  console.log("nodes", u.find(xml, n => n.text || n.desc).map(n => ({t:n.text,d:n.desc,c:n.clickable,cls:n.clazz.split(".").pop(),y:n.y})).slice(0,40));
  if (xml.includes("저장하지")) {
    const c = u.find(xml, n => n.desc === "취소" || n.text === "취소")[0];
    if (c) { u.tap(c); await u.sleep(800); xml = u.dump("afterCancel"); }
  }
  // if not in daum, reopen addr on loc3
  if (!xml.includes("우편번호") && !xml.includes("닫기")) {
    console.log("not in modal, reopen");
    await u.openEdit();
    await u.openSection("화재보험 정보 펼치기", "소재지");
    for (let i=0;i<5;i++) {
      xml = u.dump("r"+i);
      const loc3 = u.find(xml, n => n.text === "소재지 3")[0];
      const addrs = u.find(xml, n => (n.desc === "주소 검색" || n.text === "주소 검색") && n.clickable === "true");
      if (loc3) {
        const addr = addrs.filter(a => a.y > loc3.y && a.y < 1950)[0];
        if (addr) { u.tap(addr, "addr"); await u.sleep(6000); break; }
      }
      u.sh(`adb -s ${u.serial} shell input swipe 540 1600 540 1100 260`);
      await u.sleep(300);
    }
  } else if (xml.includes("닫기") && !xml.includes("우편번호")) {
    console.log("header only, wait more");
    await u.sleep(4000);
  }
  xml = u.dump("daum2");
  console.log("daum2 texts", [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,40));
  console.log("edits2", u.find(xml, n => n.clazz.includes("EditText")));
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/daum-debug.json", JSON.stringify({
    texts: [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]),
    edits: u.find(xml, n => n.clazz.includes("EditText")),
  }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });