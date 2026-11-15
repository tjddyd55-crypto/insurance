import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import type { HealthwayController } from '../useHealthwayController'
import { dateText, requestLabels, type HealthRecord, type Coverage, type SourceTab } from '../types'
function CoverageNotice({ rows }: { rows: Coverage[] }) {
  return <div className="hw-coverage">{rows.map((r) => <p key={r.datasetCode}><strong>{r.datasetCode} 공식 조회 가능 기간 {dateText(r.availableFrom)} ~ {dateText(r.availableTo)}</strong><br />{r.basisLabel}{!r.hasData && ' · 수신 데이터 없음'}<br /><span className="hw-badge">오프라인 샘플 기준일 {dateText(r.offlineAsOfDate)}</span></p>)}{!rows.length && <p>연결 후 출처별 조회 가능 기간이 표시됩니다.</p>}</div>
}
function displayValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map(displayValue).join(', ')
  const v = value as Record<string, unknown>
  if ('value' in v) return `${displayValue(v.value)}${v.unit ? ` ${v.unit}` : ''}`
  if ('valueString' in v) return String(v.valueString)
  if ('valueBoolean' in v) return String(v.valueBoolean)
  if ('text' in v) return String(v.text)
  if (Array.isArray(v.coding)) return v.coding.map((c) => (c as { display?: string }).display || '').join(', ')
  return '원본 값 확인 필요'
}
export function EvidenceRow({ record }: { record: HealthRecord }) {
  return <li className="hw-evidence-row"><strong>{dateText(record.date)}</strong> · {record.institution?.name || '기관 정보 미수신'}
    {record.kcdCodeRaw && <p>{record.kcd?.display || `${record.kcdCodeRaw} · ${record.sourceDisplay || '코드 확인 필요'}`} {record.kcd?.nameBasis === '원본 표시명' && <span className="hw-badge">원본 표시명</span>}</p>}
    <p>{record.visitType === 'institutional' ? '방문외래' : record.visitType === 'pharmacy' ? '처방조제' : record.encounterClass?.code || record.kind} · {record.source} / {record.datasetCode}</p>
  </li>
}
export function HealthwayWorkspace({ controller: c, variant }: { controller: HealthwayController; variant: 'pc' | 'mobile' }) {
  if (c.enabled == null) return <p role="status">건강정보 모듈 확인 중…</p>
  if (!c.enabled) return <p role="status">건강정보 모듈이 비활성화되어 있거나 오프라인 설정이 필요합니다.</p>
  const records = c.data.records, nhisCoverage = c.data.coverage.filter((r) => r.source === 'NHIS_PUBLIC'), hiraCoverage = c.data.coverage.filter((r) => r.source === 'HIRA_PUBLIC')
  const link = c.linkPath ? new URL(c.linkPath, window.location.origin).href : ''
  return <>
    <header className="hw-heading"><div><h2>건강정보</h2><p>건강정보 고속도로 · 공식 SDK 오프라인 샘플</p></div><span className="hw-badge hw-badge--mock">DEV MOCK</span></header>
    <p className="hw-notice">실제 고객의 건강정보가 아닙니다. 오프라인 샘플 기준일 {dateText(c.data.offlineAsOfDate)} · 실제 고지의무 확정 판정이 아닌 고지 확인 후보입니다.</p>
    <details className="hw-request" open={!records.length}><summary>건강정보 요청 · 연결 관리</summary>
      <div className="hw-controls"><label><FormInput type="checkbox" checked={c.nhis} onChange={(e) => c.setNhis(e.target.checked)} /> 국민건강보험공단</label><label><FormInput type="checkbox" checked={c.hira} onChange={(e) => c.setHira(e.target.checked)} /> 심사평가원</label><label><FormInput type="checkbox" checked={c.medical} onChange={(e) => c.setMedical(e.target.checked)} /> 의료기관 진단·수술 (확장)</label></div>
      <div className="hw-controls"><FormButton disabled={c.busy || !c.nhis && !c.hira} onClick={() => void c.create()}>요청 생성</FormButton><FormButton variant="secondary" disabled={c.busy} onClick={() => void c.perform(c.load)}>상태 새로고침</FormButton><FormButton variant="secondary" disabled={c.busy || !records.length} onClick={c.revoke}>연결 해제</FormButton></div>
      {link && <div className="hw-link"><a href={link} target="_blank" rel="noreferrer">고객 테스트 링크 열기</a><FormInput aria-label="고객 요청 링크" readOnly value={link} /><div className="hw-controls"><FormButton variant="secondary" onClick={() => void c.perform(async () => { await navigator.clipboard.writeText(link) })}>링크 복사</FormButton><FormButton variant="secondary" disabled={c.busy} onClick={() => void c.preview()}>SMS 미발송 미리보기</FormButton></div></div>}
      {c.sms && <pre className="hw-sms">{c.sms}</pre>}
      {c.requests.map((r) => <article className="hw-request-row" key={r.id}><div><strong>{requestLabels[r.status] || r.status}</strong> · {r.sources.join(' + ')}{r.medical && ' + 의료기관'}<p>만료 {dateText(r.expiresAt)}</p><ol className="hw-timeline">{r.timeline.map((s, i) => <li key={i}>{requestLabels[s.status] || s.status}</li>)}</ol></div>{!['completed', 'cancelled', 'revoked', 'expired'].includes(r.status) && <FormButton variant="secondary" disabled={c.busy} onClick={() => c.cancel(r.id)}>요청 취소</FormButton>}</article>)}
    </details>
    {c.error && <p role="alert" className="hw-error">{c.error}</p>}
    <nav className="hw-segments" aria-label="건강정보 출처">{([['NHIS', '국민건강보험공단'], ['HIRA', '심사평가원'], ['DISCLOSURE', '고지의무 확인']] as [SourceTab, string][]).map(([key, name]) => <FormButton key={key} variant={c.tab === key ? 'primary' : 'secondary'} aria-pressed={c.tab === key} onClick={() => c.setTab(key)}>{name}</FormButton>)}</nav>
    {c.tab === 'NHIS' && <div><CoverageNotice rows={nhisCoverage} /><h3>건강검진</h3><div className="hw-cards">{records.filter((r) => r.datasetCode === '2001').map((r) => <article className="hw-card" key={r.id}><h4>{dateText(r.date)} · {r.checkupType || '검진'}</h4><p>{r.institution?.name || '기관 정보 미수신'}</p><dl className="hw-items">{r.items?.map((item, i) => <div key={i}><dt>{item.name || item.esiCode} <small>{item.esiCode}</small></dt><dd>{displayValue(item.value)}</dd></div>)}</dl>{r.conclusion && <p>종합소견 (원본): {r.conclusion}</p>}</article>)}</div>{!records.some((r) => r.datasetCode === '2001') && <p>수신된 건강검진이 없습니다.</p>}
      <h3>진료이력</h3><p>공단 진료이력에는 진단코드·질병명·진료과가 제공되지 않습니다.</p><div className="hw-table-wrap"><table><thead><tr><th>진료개시일</th><th>요양기관</th><th>진료형태</th><th>방문입원일수</th><th>처방횟수</th><th>요양투약일수</th><th>본인 / 공단부담금</th>{records.some((r) => r.diagnosisCandidates?.length) && <th>관련 진단 후보</th>}</tr></thead><tbody>{records.filter((r) => r.datasetCode === '2002').map((r) => <tr key={r.id}><td>{dateText(r.date)}</td><td>{r.institution?.name || '미수신'}</td><td>{r.visitType === 'institutional' ? '방문외래' : r.visitType === 'pharmacy' ? '처방조제' : r.visitType}</td><td>{r.visitHospitalDays ?? '—'}</td><td>{r.prescriptionCount ?? '—'}</td><td>{r.treatmentDays ?? '—'}</td><td>{r.copay?.value?.toLocaleString() ?? '—'} / {r.benefit?.value?.toLocaleString() ?? '—'}</td>{records.some((x) => x.diagnosisCandidates?.length) && <td>{r.diagnosisCandidates?.length ? <FormButton variant="secondary" onClick={() => c.setEvidence(records.filter((x) => r.diagnosisCandidates?.some((d) => d.evidenceId === x.id)))}>관련 진단 후보 {r.diagnosisCandidates.length}건</FormButton> : '—'}</td>}</tr>)}</tbody></table></div>
      {records.some((r) => r.datasetCode === '1004') && <section><h3>의료기관 진단내역 · 별도 출처</h3><CoverageNotice rows={c.data.coverage.filter((r) => r.datasetCode === '1004')} /><ul>{records.filter((r) => r.datasetCode === '1004').map((r) => <EvidenceRow key={r.id} record={r} />)}</ul></section>}</div>}
    {c.tab === 'HIRA' && <section><CoverageNotice rows={hiraCoverage} /><h3>투약이력</h3><p>약품코드와 제품명은 원본 그대로 표시합니다. 공식 약효 마스터는 아직 적재되지 않았습니다.</p><div className="hw-cards">{records.filter((r) => r.datasetCode === '2004').map((r) => <article className="hw-card" key={r.id}><h4>{r.productName || '제품명 미수신'}</h4><p>{r.drugCodeRaw} <small>{r.drugCodeSystem}</small></p><p>조제일 {dateText(r.date)} · {r.daysSupply ?? '—'}일 · {r.institution?.name || '약국 정보 미수신'}</p><p>일일투약횟수 {r.dosesPerDay ?? '—'} · 1회 투약량 {r.dosePerAdministration ?? '—'}</p>{r.ingredients?.map((i, index) => <p key={index}>주성분 {i.code} · {i.display}</p>)}</article>)}</div>{!records.some((r) => r.datasetCode === '2004') && <p>수신된 투약이력이 없습니다.</p>}</section>}
    {c.tab === 'DISCLOSURE' && <section><h3>고지 확인 후보</h3><p>데이터가 부족한 기간을 ‘특이사항 없음’으로 판정하지 않습니다. 약관·상품별 고지사항은 별도로 확인해 주세요.</p><div className="hw-cards">{c.results.map((r) => <article className="hw-card" key={r.ruleCode}><span className={`hw-badge hw-status--${r.status}`}>{r.statusLabel}</span><h4>{r.name}</h4><p>{dateText(r.window.from)} ~ {dateText(r.window.to)}</p><p>{r.note}</p>{r.estimated && <span className="hw-badge">추정 / 가능성</span>}<p>근거 {r.evidenceIds.length}건 · 규칙 {r.ruleVersion}</p><FormButton variant="secondary" disabled={!r.evidenceIds.length} onClick={() => c.setEvidence(records.filter((e) => r.evidenceIds.includes(e.id)))}>근거 보기</FormButton></article>)}</div><h3>수술이력</h3><p>{records.some((r) => r.datasetCode === '1010') ? '1010 수술 및 처치 자료를 기반으로 규칙 평가' : '공공데이터만으로는 확인 불가'}</p></section>}
    <Modal open={c.evidence != null} onClose={() => c.setEvidence(null)} ariaLabel="고지 확인 후보 근거" panelPreset="largeForm" closeOnBackdrop={true} usePortal>
      <div className={`healthway-page--${variant} hw-evidence-shell`}><header><h3>근거 보기</h3><p>출처·일자·원본 코드를 확인해 주세요. 관련 진단 후보는 확정 연결이 아닙니다.</p></header><div className="hw-evidence-body"><ul>{c.evidence?.map((r) => <EvidenceRow key={r.id} record={r} />)}</ul></div><footer><FormButton variant="secondary" onClick={() => c.setEvidence(null)}>닫기</FormButton></footer></div>
    </Modal>
    <ConfirmDialog open={c.confirm != null} title="건강정보 연결 관리" message={c.confirm?.title || ''} confirmLabel="확인" tone="danger" busy={c.busy} onCancel={() => c.setConfirm(null)} onConfirm={() => void c.perform(async () => { await c.confirm?.action(); c.setConfirm(null) })} />
  </>
}
