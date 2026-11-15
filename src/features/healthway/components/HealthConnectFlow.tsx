import { FormButton, FormInput } from '../../../components/form'
import type { PublicController } from '../pages/HealthConnectPage'
import { dateText } from '../types'
export function HealthConnectFlow({ controller: c }: { controller: PublicController }) {
  if (!c.info) return <><h1>건강정보 연결</h1><p role={c.error ? 'alert' : 'status'}>{c.error || '테스트 요청을 확인하고 있습니다…'}</p></>
  const done = c.info.request.status === 'completed'
  return <>
    <header className="hw-heading"><div><p className="hw-brand">ONE FC</p><h1>건강정보 연결</h1></div><span className="hw-badge hw-badge--mock">DEV MOCK</span></header>
    <p className="hw-notice">이 화면은 개발용 오프라인 테스트입니다. 실제 본인인증이나 건강정보 조회를 하지 않습니다. 주민등록번호·인증서·비밀번호를 입력하지 마세요.</p>
    <p>{c.info.maskedName} 님의 테스트 요청 · 오프라인 샘플 기준일 {dateText(c.info.offlineAsOfDate)}</p>
    <ol className="hw-steps"><li>약관·기관 동의</li><li>MOCK 인증</li><li>공식 샘플 연결</li></ol>
    {done ? <section className="hw-card" role="status"><h2>테스트 연결 완료</h2><p>공식 SDK 샘플이 연결되었습니다. 담당자 건강정보 화면에서 결과와 근거를 확인할 수 있습니다.</p><p>실제 고객 건강정보·전자서명·문자 발송은 발생하지 않았습니다.</p></section> : c.auth ? <section className="hw-card"><h2>DEV 전용 MOCK 본인인증</h2><p>본인 여부를 검증하지 않는 테스트입니다. 다음 버튼은 공식 0201·0199 및 데이터 조회 오프라인 샘플을 실행합니다.</p>{!c.hasBinding && <p role="alert">인증 요청 정보가 없습니다. 담당자에게 새 테스트 링크를 받아 주세요.</p>}<FormButton disabled={c.busy || !c.hasBinding} onClick={() => void c.complete()}>{c.busy ? '공식 샘플 연결 중…' : 'MOCK 인증·전송요구 완료'}</FormButton></section> : <form className="hw-consents" onSubmit={(e) => { e.preventDefault(); void c.start() }}>
      <h2>약관 및 안내</h2>
      {c.info.terms?.map((t) => <details key={t.termsNo}><summary>{t.termsName}</summary><p className="hw-terms">{t.termsContents}</p></details>)}
      <label><FormInput type="checkbox" checked={c.terms} onChange={(e) => c.setTerms(e.target.checked)} /> 필수 이용약관 및 개인정보 처리 안내를 확인하고 테스트에 동의합니다.</label>
      <h2>기관별 데이터 제공요청 동의</h2>
      {c.info.request.sources.includes('NHIS') && <label><FormInput type="checkbox" checked={c.nhis} onChange={(e) => c.setNhis(e.target.checked)} /> 국민건강보험공단 · 건강검진 / 진료이력</label>}
      {c.info.request.sources.includes('HIRA') && <><label><FormInput type="checkbox" checked={c.hira} onChange={(e) => c.setHira(e.target.checked)} /> 심사평가원 · 투약이력</label><label><FormInput type="checkbox" checked={c.sensitiveInformation} onChange={(e) => c.setSensitive(e.target.checked)} /> 심사평가원 민감정보 제공 (선택)</label></>}
      {c.info.request.medical && <label><FormInput type="checkbox" checked={c.medical} onChange={(e) => c.setMedical(e.target.checked)} /> 의료기관 진단 / 수술·처치 데이터 (공식 샘플)</label>}
      <h2>통합 가입 안내 · 선택</h2>{c.info.unityTerms?.map((t) => <details key={t.serviceCode}><summary>{t.termsName}</summary><p className="hw-terms">{t.termsContents}</p></details>)}
      <label><FormInput type="checkbox" checked={c.isJoinPhr} onChange={(e) => c.setJoinPhr(e.target.checked)} /> 나의건강기록 앱 통합 가입 (MOCK)</label><label><FormInput type="checkbox" checked={c.isJoinPortal} onChange={(e) => c.setJoinPortal(e.target.checked)} /> 건강정보 고속도로 누리집 통합 가입 (MOCK)</label>
      <footer className="hw-public-footer"><FormButton htmlType="submit" disabled={c.busy || !c.valid}>{c.busy ? '인증 준비 중…' : '동의하고 MOCK 인증 시작'}</FormButton><p>유효기간 {dateText(c.info.request.expiresAt)} · 완료 후 재사용 불가</p></footer>
    </form>}
    {c.error && <p role="alert" className="hw-error">{c.error}</p>}
  </>
}
