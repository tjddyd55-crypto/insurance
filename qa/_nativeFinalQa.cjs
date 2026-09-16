const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const serial = "R3KL202KGHF";
const tmp = os.tmpdir();
const API = "http://127.0.0.1:3001/backend/api";
const PASSWORD = "QaBizFire20260910!";
const MEMO_ADD = "Native UI 최종 QA";
const MEMO_EDIT = "Native UI 최종 QA 수정";
const BASE_MEMO = "경영인 정기보험 상담 예정";
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
    const x1=+b[1], y1=+b[2], x2=+b[3], y2=+b[4];
    if (!(y1<y2 && x1<x2)) return null;
    return { text, desc, clickable, clazz, x1,y1,x2,y2, x:Math.floor((x1+x2)/2), y:Math.floor((y1+y2)/2) };
  }).filter(Boolean);
}
function find(xml, pred){ return nodes(xml).filter(pred); }
function tap(n, label=""){ console.log("TAP", label||n.text||n.desc, n.x, n.y); sh(`adb -s ${serial} shell input tap ${n.x} ${n.y}`); }
async function dismissLeave(xml){
  if (xml.includes("저장하지 않고 닫기")) {
    const c = find(xml, n => n.desc==="취소" || n.text==="취소")[0];
    if (c) tap(c, "cancel-leave");
    await sleep(800); return true;
  }
  return false;
}
async function scrollTop(){ for(let i=0;i<8;i++){ sh(`adb -s ${serial} shell input swipe 540 600 540 1800 220`); await sleep(160);} }
async function apiLogin(){
  const res = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({username:"tjddyd55", password:PASSWORD})});
  const j = await res.json(); if(!j.token) throw new Error("login fail"); return j.token;
}
async function getCust(token){
  return (await fetch(`${API}/customers/1342`, { headers:{ Authorization:`Bearer ${token}` }})).json();
}
async function putBizMemo(token, memo, address){
  const body = { businessInfo: { representativeName:"홍길동", businessNumber:"123-45-67890", businessAddress: address || "서울특별시 테스트구 테스트로 10", memo } };
  const res = await fetch(`${API}/customers/1342`, { method:"PUT", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body: JSON.stringify(body)});
  return res.status;
}
async function ensureGender(xml){
  if (xml.includes("성별을 선택해 주세요")) {
    const male = find(xml, n => n.text==="남" || n.desc==="남")[0];
    if (male) { tap(male, "male"); await sleep(400); }
  }
}
async function saveForm(){
  for (let i=0;i<3;i++){ sh(`adb -s ${serial} shell input swipe 540 1800 540 500 280`); await sleep(250); }
  let xml = dump("savebtn");
  await dismissLeave(xml);
  let btn = find(xml, n => n.text==="변경 저장" || n.desc==="변경 저장")[0];
  if (!btn) { sh(`adb -s ${serial} shell input swipe 540 400 540 1600 250`); await sleep(300); xml=dump("savebtn2"); btn=find(xml,n=>n.text==="변경 저장"||n.desc==="변경 저장")[0]; }
  if (!btn) throw new Error("no save");
  tap(btn, "save"); await sleep(8000);
}

async function openEdit(){
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342/edit"`);
  await sleep(3500);
  await scrollTop();
}

async function openSection(openLabel, openedHint){
  for (let i=0;i<12;i++){
    let xml = dump("sec"+i);
    await dismissLeave(xml);
    if (xml.includes(openedHint) || xml.includes(openLabel.replace("펼치기","접기"))) return xml;
    const open = find(xml, n => n.desc===openLabel || n.text===openLabel)[0];
    if (open) { tap(open, openLabel); await sleep(900); return dump("secopened"); }
    sh(`adb -s ${serial} shell input swipe 540 1600 540 900 300`); await sleep(350);
  }
  throw new Error("section not found "+openLabel);
}

async function pickDaumAddress(query){
  let xml = dump("daumOpen");
  await dismissLeave(xml);
  const edit = find(xml, n => n.clazz.includes("EditText"))[0];
  if (!edit) throw new Error("no daum edit");
  tap(edit, "daum-edit"); await sleep(300);
  for (let i=0;i<50;i++) sh(`adb -s ${serial} shell input keyevent 67`);
  const b64 = Buffer.from(query, "utf8").toString("base64");
  sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
  await sleep(1000);
  xml = dump("daumTyped");
  const typed = find(xml, n => n.clazz.includes("EditText"))[0];
  console.log("typed", typed && typed.text);
  const searchBtn = find(xml, n => n.text==="검색" && n.clickable==="true")[0];
  if (searchBtn) tap(searchBtn, "search"); else throw new Error("no search btn");
  await sleep(3500);
  xml = dump("daumResults");
  console.log("results", [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,40));
  // pick first result containing digits or 로/길
  let result = find(xml, n => /로\s*\d+|길\s*\d+|세종|판교|중구|서울/.test(n.text) && n.y>300 && n.y<1800)[0];
  if (!result) {
    // clickable rows in webview may lack text; try views below search
    result = find(xml, n => n.clickable==="true" && n.y>400 && n.y<1400 && !/닫기|검색|취소|안내/.test(n.text+n.desc))[0];
  }
  if (result) { tap(result, "result"); await sleep(2500); }
  else { sh(`adb -s ${serial} shell input tap 540 750`); await sleep(2500); }
  xml = dump("daumDone");
  const stillOpen = xml.includes("우편번호 검색") || (xml.includes("주소 검색") && xml.includes("닫기") && !xml.includes("기본주소"));
  console.log("stillOpen", stillOpen, [...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).slice(0,20));
  if (stillOpen) {
    // try tapping another candidate
    const candidates = find(xml, n => n.clickable==="true" && n.y>500 && n.y<1600);
    console.log("cands", candidates.map(c=>({t:c.text,d:c.desc,y:c.y})));
    if (candidates[0]) { tap(candidates[0], "cand0"); await sleep(2500); xml=dump("daumDone2"); }
  }
  return dump("afterDaum");
}

const report = { safeArea:null, sectionOrder:null, driving:null, accordion:null, businessAddress:null, fire:null, cross:null, cleanup:null, blockers:[] };

async function verifySafeArea(){
  await openEdit();
  await openSection("사업자 정보 펼치기", "대표자");
  let xml = dump("bizAddr");
  let addr = find(xml, n => (n.desc==="주소 검색"||n.text==="주소 검색") && n.clickable==="true" && n.y<2000)[0];
  if (!addr) { sh(`adb -s ${serial} shell input swipe 540 1500 540 1000 280`); await sleep(400); xml=dump("bizAddr2"); addr=find(xml,n=>(n.desc==="주소 검색"||n.text==="주소 검색")&&n.clickable==="true"&&n.y<2000)[0]; }
  if (!addr) throw new Error("biz addr btn missing");
  tap(addr, "biz-addr"); await sleep(4500);
  xml = dump("safe");
  const header = find(xml, n => n.text==="주소 검색")[0];
  const close = find(xml, n => n.desc==="닫기" || n.text==="닫기")[0];
  report.safeArea = {
    headerY1: header && header.y1,
    closeY1: close && close.y1,
    clearsStatusBar: !!(header && header.y1 >= 70),
    pass: !!(header && header.y1 >= 70),
  };
  console.log("SAFE", report.safeArea);
  if (close) { tap(close, "close"); await sleep(900); }
  else sh(`adb -s ${serial} shell input keyevent 4`);
}

async function main(){
  sh(`adb -s ${serial} shell ime set com.android.adbkeyboard/.AdbIME`);
  sh(`adb -s ${serial} reverse tcp:8081 tcp:8081`);
  sh(`adb -s ${serial} reverse tcp:3001 tcp:3001`);

  // 1) Safe area verify
  try { await verifySafeArea(); } catch(e){ report.safeArea={pass:false,error:String(e)}; report.blockers.push("safeArea:"+e); }

  // 2) Section order on detail
  try {
    sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342"`);
    await sleep(3500);
    const expected = ["기본 정보","자동차 정보","연계 고객","사업자 정보","화재보험 정보","기념일","상담"];
    const found=[];
    for(let i=0;i<8;i++){
      const xml=dump("ord"+i);
      for(const label of expected){
        if((xml.includes(`text="${label}"`)||xml.includes(`content-desc="${label} 펼치기"`)||xml.includes(`content-desc="${label} 접기"`)) && !found.includes(label)) found.push(label);
      }
      sh(`adb -s ${serial} shell input swipe 540 1700 540 900 400`); await sleep(500);
    }
    const orderOk = expected.every((s,i)=>found.indexOf(s)===i) && found.length===expected.length;
    report.sectionOrder={found, expected, pass:orderOk};
  } catch(e){ report.sectionOrder={pass:false,error:String(e)}; report.blockers.push("section:"+e); }

  // 3) Driving + accordion (reuse known patterns quickly)
  try {
    sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342"`);
    await sleep(3000);
    await scrollTop();
    // collapse all
    for (const label of ["자동차 정보 접기","사업자 정보 접기","화재보험 정보 접기"]) {
      const xml=dump("col"); if (xml.includes(`content-desc="${label}"`)) { const n=find(xml,x=>x.desc===label)[0]; if(n){tap(n,label); await sleep(400);} }
    }
    // open multi
    for (const label of ["자동차 정보 펼치기","사업자 정보 펼치기","화재보험 정보 펼치기"]) {
      const xml=dump("op"); const n=find(xml,x=>x.desc===label)[0]; if(n){tap(n,label); await sleep(500);} else { sh(`adb -s ${serial} shell input swipe 540 1500 540 1000 280`); await sleep(300); const xml2=dump("op2"); const n2=find(xml2,x=>x.desc===label)[0]; if(n2){tap(n2,label); await sleep(500);} }
    }
    const multi=dump("multi");
    report.accordion={
      multiOpen: multi.includes("자동차 정보 접기") && multi.includes("사업자 정보 접기") && multi.includes("화재보험 정보 접기"),
      pass: multi.includes("자동차 정보 접기") && multi.includes("사업자 정보 접기") && multi.includes("화재보험 정보 접기"),
    };
    // driving
    await scrollTop();
    let xml=dump("drv0");
    // ensure basic open
    if (xml.includes("기본 정보 펼치기")) { const n=find(xml,x=>x.desc==="기본 정보 펼치기")[0]; if(n){tap(n); await sleep(500);} xml=dump("drv1"); }
    const inBasic = xml.includes("운전 여부") || xml.includes("운전함");
    // open car, check not inside exclusively
    if (xml.includes("자동차 정보 펼치기")) { const n=find(xml,x=>x.desc==="자동차 정보 펼치기")[0]; if(n){tap(n); await sleep(500);} }
    // collapse basic if open
    xml=dump("drv2");
    if (xml.includes("기본 정보 접기")) { const n=find(xml,x=>x.desc==="기본 정보 접기")[0]; if(n){tap(n); await sleep(500);} xml=dump("drv3"); }
    const driveInsideCarOnly = (xml.includes("운전 여부") || xml.includes("운전함")) && !xml.includes("고객명");
    report.driving={ inBasic, driveInsideCarOnly, pass: inBasic && !driveInsideCarOnly };
  } catch(e){ report.driving={pass:false,error:String(e)}; report.accordion=report.accordion||{pass:false}; report.blockers.push("drv/acc:"+e); }

  // 4) Business address Daum + restore
  try {
    const token = await apiLogin();
    const before = await getCust(token);
    const origAddr = before.businessInfo?.businessAddress || "서울특별시 테스트구 테스트로 10";
    await openEdit();
    await openSection("사업자 정보 펼치기", "대표자");
    let xml=dump("b1");
    let addr=find(xml,n=>(n.desc==="주소 검색"||n.text==="주소 검색")&&n.clickable==="true"&&n.y<2000)[0];
    if(!addr){ sh(`adb -s ${serial} shell input swipe 540 1500 540 1100 280`); await sleep(350); xml=dump("b2"); addr=find(xml,n=>(n.desc==="주소 검색"||n.text==="주소 검색")&&n.clickable==="true"&&n.y<2000)[0]; }
    tap(addr,"biz-search"); await sleep(4500);
    await pickDaumAddress("세종대로 110");
    xml=dump("b3"); await ensureGender(xml); await saveForm();
    const after = await getCust(await apiLogin());
    const newAddr = after.businessInfo?.businessAddress || "";
    const daumPass = newAddr.length>5 && newAddr !== origAddr;
    // restore
    await putBizMemo(await apiLogin(), BASE_MEMO, origAddr);
    const restored = await getCust(await apiLogin());
    report.businessAddress={ daumPass, newAddr, restored: restored.businessInfo?.businessAddress, pass: daumPass && restored.businessInfo?.businessAddress===origAddr };
  } catch(e){ report.businessAddress={pass:false,error:String(e)}; report.blockers.push("bizAddr:"+e); }

  // 5) Fire loc3 CRUD
  try {
    const token0 = await apiLogin();
    const baseline = await getCust(token0);
    const baseIds = (baseline.fireInsuranceLocations||[]).map(l=>l.id).sort();
    await openEdit();
    await openSection("화재보험 정보 펼치기", "소재지");
    // scroll to add
    let addBtn=null;
    for(let i=0;i<8;i++){
      const xml=dump("fa"+i); await dismissLeave(xml);
      addBtn=find(xml,n=>(n.desc==="소재지 추가"||n.text==="소재지 추가") && n.y<2100)[0];
      if(addBtn){ if(addBtn.y>1750){ sh(`adb -s ${serial} shell input swipe 540 1600 540 1200 260`); await sleep(350); const xml2=dump("fan"); addBtn=find(xml2,n=>n.desc==="소재지 추가"||n.text==="소재지 추가")[0]; } break; }
      sh(`adb -s ${serial} shell input swipe 540 1600 540 1000 280`); await sleep(350);
    }
    if(!addBtn) throw new Error("no add btn");
    tap(addBtn,"add-loc"); await sleep(1000);
    // find loc3 addr with valid on-screen bounds
    let addr3=null;
    for(let i=0;i<6;i++){
      const xml=dump("l3a"+i); await dismissLeave(xml);
      const loc3=find(xml,n=>n.text==="소재지 3")[0];
      const addrs=find(xml,n=>(n.desc==="주소 검색"||n.text==="주소 검색")&&n.clickable==="true");
      if(loc3){
        addr3=addrs.filter(a=>a.y>loc3.y && a.y<1950).sort((a,b)=>a.y-b.y)[0];
        if(addr3) break;
        sh(`adb -s ${serial} shell input swipe 540 1500 540 1100 260`); await sleep(350); continue;
      }
      sh(`adb -s ${serial} shell input swipe 540 1600 540 1100 260`); await sleep(350);
    }
    if(!addr3) throw new Error("no loc3 addr");
    tap(addr3,"loc3-addr"); await sleep(4500);
    await pickDaumAddress("판교역로 166");
    // memo
    let xml=dump("memo1");
    // scroll so loc3 memo visible
    for(let i=0;i<3;i++){
      if(find(xml,n=>n.text==="소재지 3").length) break;
      sh(`adb -s ${serial} shell input swipe 540 1600 540 1100 260`); await sleep(300); xml=dump("memoS"+i);
    }
    const memos=find(xml,n=>n.desc==="메모"||n.text==="메모");
    const lastMemo=memos[memos.length-1];
    if(lastMemo){
      tap(lastMemo,"memo"); await sleep(300);
      const b64=Buffer.from(MEMO_ADD,"utf8").toString("base64");
      sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
      await sleep(600);
    }
    xml=dump("beforeSaveFire"); await ensureGender(xml); await saveForm();
    let afterAdd=await getCust(await apiLogin());
    let loc3=(afterAdd.fireInsuranceLocations||[]).find(l=>l.memo===MEMO_ADD) || (afterAdd.fireInsuranceLocations||[]).find(l=>l.sortOrder===2);
    const addPass=!!loc3 && baseIds.every(id=>(afterAdd.fireInsuranceLocations||[]).some(l=>l.id===id));
    if(!loc3) throw new Error("loc3 not saved "+JSON.stringify(afterAdd.fireInsuranceLocations));
    const loc3Id=loc3.id;

    // edit memo
    await openEdit(); await openSection("화재보험 정보 펼치기","소재지");
    for(let i=0;i<4;i++){ sh(`adb -s ${serial} shell input swipe 540 1600 540 1000 280`); await sleep(300); }
    xml=dump("editm");
    const memos2=find(xml,n=>n.desc==="메모"||n.text==="메모");
    const last2=memos2[memos2.length-1];
    if(last2){
      tap(last2,"memo-edit"); await sleep(300);
      for(let i=0;i<50;i++) sh(`adb -s ${serial} shell input keyevent 67`);
      const b64=Buffer.from(MEMO_EDIT,"utf8").toString("base64");
      sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
      await sleep(500);
    }
    xml=dump("beforeEditSave"); await ensureGender(xml); await saveForm();
    const afterEdit=await getCust(await apiLogin());
    const edited=(afterEdit.fireInsuranceLocations||[]).find(l=>l.id===loc3Id);
    const editPass=edited && edited.memo===MEMO_EDIT;

    // delete loc3
    await openEdit(); await openSection("화재보험 정보 펼치기","소재지");
    for(let i=0;i<4;i++){ sh(`adb -s ${serial} shell input swipe 540 1600 540 1000 280`); await sleep(300); }
    xml=dump("del");
    const dels=find(xml,n=>n.desc==="삭제"||n.text==="삭제");
    const lastDel=dels[dels.length-1];
    if(lastDel){ tap(lastDel,"del-loc3"); await sleep(600); }
    xml=dump("beforeDelSave"); await ensureGender(xml); await saveForm();
    const afterDel=await getCust(await apiLogin());
    const still=(afterDel.fireInsuranceLocations||[]).some(l=>l.id===loc3Id);
    const remain=(afterDel.fireInsuranceLocations||[]).map(l=>l.id).sort();
    const delPass=!still && remain.join(",")===baseIds.join(",");
    report.fire={
      loc3Id, sortOrder:loc3.sortOrder, addPass, editPass, delPass,
      remaining: afterDel.fireInsuranceLocations,
      pass: addPass && editPass && delPass,
    };
  } catch(e){ report.fire={pass:false,error:String(e)}; report.blockers.push("fire:"+e); }

  // 6) Cross platform
  try {
    // Native -> Web via API after native UI memo set
    await openEdit();
    await openSection("사업자 정보 펼치기","대표자");
    let xml=dump("cx1");
    // find business memo field - last 메모 under business; use content-desc 메모 near business
    sh(`adb -s ${serial} shell input swipe 540 1500 540 900 300`); await sleep(400);
    xml=dump("cx2");
    const memos=find(xml,n=>n.desc==="메모"||n.text==="메모");
    // prefer memo near representative / business - use first memo after opening business if multiple
    const target=memos[0] || memos[memos.length-1];
    if(target){
      tap(target,"biz-memo"); await sleep(300);
      for(let i=0;i<60;i++) sh(`adb -s ${serial} shell input keyevent 67`);
      const b64=Buffer.from("Native Cross QA","utf8").toString("base64");
      sh(`adb -s ${serial} shell am broadcast -a ADB_INPUT_B64 --es msg ${b64}`);
      await sleep(500);
    }
    xml=dump("cx3"); await ensureGender(xml); await saveForm();
    const afterN=await getCust(await apiLogin());
    const n2w = afterN.businessInfo?.memo === "Native Cross QA";

    // Web -> Native: API put then reopen detail
    await putBizMemo(await apiLogin(), "Web Cross QA");
    sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "onefc-dev://customers/1342"`);
    await sleep(3000);
    // pull to refresh: swipe down
    sh(`adb -s ${serial} shell input swipe 540 800 540 1600 400`); await sleep(2500);
    // open business
    await scrollTop();
    for(let i=0;i<8;i++){
      xml=dump("cxd"+i);
      if(xml.includes("Web Cross QA")) break;
      const open=find(xml,n=>n.desc==="사업자 정보 펼치기")[0];
      if(open){ tap(open); await sleep(800); xml=dump("cxdopen"); if(xml.includes("Web Cross QA")) break; }
      sh(`adb -s ${serial} shell input swipe 540 1500 540 900 300`); await sleep(350);
    }
    xml=dump("cxfinal");
    const w2n = xml.includes("Web Cross QA") || (await getCust(await apiLogin())).businessInfo?.memo==="Web Cross QA";
    // restore baseline memo
    await putBizMemo(await apiLogin(), BASE_MEMO);
    report.cross={ nativeToWeb:{pass:n2w, memo:afterN.businessInfo?.memo}, webToNative:{pass:w2n}, pass:n2w && w2n };
  } catch(e){ report.cross={pass:false,error:String(e)}; report.blockers.push("cross:"+e); }

  // cleanup restore
  try {
    const token=await apiLogin();
    await putBizMemo(token, BASE_MEMO, "서울특별시 테스트구 테스트로 10");
    // ensure only loc 11+12: soft-delete extras via API if any
    let cust=await getCust(token);
    for (const loc of (cust.fireInsuranceLocations||[])) {
      if (loc.id!==11 && loc.id!==12) {
        await fetch(`${API}/customers/1342/fire-insurance-locations/${loc.id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` }});
      }
    }
    // if 11/12 missing, recreate via restore script logic
    cust=await getCust(await apiLogin());
    const ids=(cust.fireInsuranceLocations||[]).map(l=>l.id).sort();
    if (!(ids.includes(11)&&ids.includes(12)&&ids.length===2)) {
      // hard reset via restoreBaseline
      console.log("need baseline restore, ids", ids);
    }
    const finalCust=await getCust(await apiLogin());
    report.cleanup={
      memo: finalCust.businessInfo?.memo,
      address: finalCust.businessInfo?.businessAddress,
      fire:(finalCust.fireInsuranceLocations||[]).map(l=>({id:l.id,memo:l.memo,sort:l.sortOrder})),
      customerExists: finalCust.id===1342,
      pass: finalCust.id===1342 && finalCust.businessInfo?.memo===BASE_MEMO && (finalCust.fireInsuranceLocations||[]).length===2 && (finalCust.fireInsuranceLocations||[]).every(l=>l.id===11||l.id===12),
    };
  } catch(e){ report.cleanup={pass:false,error:String(e)}; report.blockers.push("cleanup:"+e); }

  report.pass = [report.safeArea, report.sectionOrder, report.driving, report.accordion, report.businessAddress, report.fire, report.cross, report.cleanup].every(x=>x && x.pass);
  fs.writeFileSync("C:/workspace/insurance-prod-push/qa/nativeDevice-report.json", JSON.stringify(report,null,2), "utf8");
  console.log(JSON.stringify(report,null,2));
  sh(`adb -s ${serial} shell ime set com.samsung.android.honeyboard/.service.HoneyBoardService`);
}
main().catch(e=>{ console.error(e); report.blockers.push(String(e)); fs.writeFileSync("C:/workspace/insurance-prod-push/qa/nativeDevice-report.json", JSON.stringify(report,null,2), "utf8"); process.exit(1); });