import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import FormButton from '../../../components/form/FormButton'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { GOVERNMENT_APPLICATION_STATUSES } from '../constants/governmentApplicationStatuses'
import { GOVERNMENT_EDOC_TEMPLATES } from '../adapters/governmentContractAdapter'
import {
  GOVERNMENT_DOCUMENT_TYPES,
  GOVERNMENT_SCHEDULE_TYPES,
} from '../constants/governmentDocumentTypes'
import { useGovernmentAccess } from '../hooks/useGovernmentAccess'
import { useGovernmentWorkspaceState, type GovernmentWorkspaceTab } from '../hooks/useGovernmentWorkspaceState'
import '../government-support.css'

const TABS: { id: GovernmentWorkspaceTab; label: string }[] = [
  { id: 'reception', label: '접수정보' },
  { id: 'customer', label: '고객정보' },
  { id: 'business', label: '사업장정보' },
  { id: 'funding', label: '자금/신용' },
  { id: 'loans', label: '기대출' },
  { id: 'application', label: '신청/청약' },
  { id: 'edoc', label: '전자문서' },
  { id: 'documents', label: '서류관리' },
  { id: 'schedule', label: '일정관리' },
  { id: 'memo', label: '메모/특이' },
]

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export default function GovernmentWorkspacePage() {
  const { token, logout } = useAuth()
  const { summary } = useGovernmentAccess(token)
  const isMobile = useIsMobile()
  const defaultTenantId = useMemo(() => {
    if (!summary) return null
    const tid =
      summary.governmentAgencyAdminTenantIds[0] ??
      summary.governmentStaffTenantIds[0] ??
      null
    return tid
  }, [summary])

  const ws = useGovernmentWorkspaceState(token, defaultTenantId)
  const p = ws.selected

  const showList = !isMobile || !ws.selectedId
  const showDetail = !isMobile || Boolean(ws.selectedId)

  return (
    <main
      className={`page government-page government-workspace ${isMobile ? 'government-page--mobile' : 'government-page--pc'}`}
    >
      <header className="government-workspace__header">
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>정부지원 CRM</strong>
          {summary?.isGovernmentIndustryAdmin ? (
            <Link to="/government/admin" style={{ marginLeft: '0.75rem', color: 'var(--primary)' }}>
              관리
            </Link>
          ) : null}
        </div>
        <div>
          <FormButton type="button" variant="secondary" onClick={() => void ws.addProfile()}>
            + 고객/사업장
          </FormButton>
          <FormButton type="button" variant="secondary" onClick={() => logout()} style={{ marginLeft: '0.5rem' }}>
            로그아웃
          </FormButton>
        </div>
      </header>

      {ws.error ? <p style={{ color: '#ef4444', padding: '0.75rem 1rem' }}>{ws.error}</p> : null}
      {ws.feedback ? <p style={{ color: 'var(--primary)', padding: '0 1rem' }}>{ws.feedback}</p> : null}

      <div className="government-workspace__body">
        {showList ? (
          <aside className="government-workspace__list">
            {ws.loading ? (
              <p className="government-page__muted" style={{ padding: '1rem' }}>
                불러오는 중…
              </p>
            ) : (
              ws.profiles.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`government-list-item ${row.id === ws.selectedId ? 'government-list-item--active' : ''}`}
                  onClick={() => ws.setSelectedId(row.id)}
                >
                  <div className="government-list-item__title">{row.customerName || '이름 없음'}</div>
                  <div className="government-list-item__meta">
                    {row.phone} · {row.businessName || '사업장 미입력'}
                    <br />
                    {row.progressStatus} · {row.productName || '접수상품 없음'}
                    <br />
                    전자문서: {row.edocStatus || '-'} · 서류: {row.docStatus || '-'}
                  </div>
                </button>
              ))
            )}
          </aside>
        ) : null}

        {showDetail && p ? (
          <section className="government-workspace__detail">
            {isMobile ? (
              <button type="button" className="government-tabs__btn" onClick={() => ws.setSelectedId(null)}>
                ← 목록
              </button>
            ) : null}
            <h2 className="government-page__title" style={{ marginBottom: '0.5rem' }}>
              {p.customerName} · {p.businessName}
            </h2>
            <p className="government-page__muted" style={{ marginBottom: '1rem' }}>
              {p.phone} · {p.progressStatus} · {p.region}
            </p>

            <div className="government-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`government-tabs__btn ${ws.tab === t.id ? 'government-tabs__btn--active' : ''}`}
                  onClick={() => ws.setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {ws.tab === 'reception' ? (
              <div className="government-form-grid">
                <Field label="접수상품명" value={p.productName} onChange={(v) => void ws.saveProfile({ productName: v })} />
                <Field label="가능상품" value={p.availableProduct} onChange={(v) => void ws.saveProfile({ availableProduct: v })} />
                <Field label="진행상태" value={p.progressStatus} onChange={(v) => void ws.saveProfile({ progressStatus: v })} />
                <Field label="접수일정" value={p.scheduleAt} onChange={(v) => void ws.saveProfile({ scheduleAt: v })} />
                <Field label="진행기관" value={p.agencyOrg} onChange={(v) => void ws.saveProfile({ agencyOrg: v })} />
                <Field label="지역" value={p.region} onChange={(v) => void ws.saveProfile({ region: v })} />
                <Field label="비고" value={p.note} onChange={(v) => void ws.saveProfile({ note: v })} />
                <Field label="특이사항" value={p.specialNote} onChange={(v) => void ws.saveProfile({ specialNote: v })} />
              </div>
            ) : null}

            {ws.tab === 'customer' ? (
              <div className="government-form-grid">
                <Field label="성함" value={p.customerName} onChange={(v) => void ws.saveProfile({ customerName: v })} />
                <Field label="연락처" value={p.phone} onChange={(v) => void ws.saveProfile({ phone: v })} />
                <Field label="통신사" value={p.carrier} onChange={(v) => void ws.saveProfile({ carrier: v })} />
                <Field label="주민번호" value={p.ssn} onChange={(v) => void ws.saveProfile({ ssn: v })} />
                <Field label="자택주소" value={p.homeAddress} onChange={(v) => void ws.saveProfile({ homeAddress: v })} />
                <Field label="자택형태" value={p.homeType} onChange={(v) => void ws.saveProfile({ homeType: v })} />
                <Field label="보증금" value={p.deposit} onChange={(v) => void ws.saveProfile({ deposit: v })} />
                <Field label="월세" value={p.monthlyRent} onChange={(v) => void ws.saveProfile({ monthlyRent: v })} />
                <Field label="신용점수1" value={p.creditScore1} onChange={(v) => void ws.saveProfile({ creditScore1: v })} />
                <Field label="신용점수2" value={p.creditScore2} onChange={(v) => void ws.saveProfile({ creditScore2: v })} />
              </div>
            ) : null}

            {ws.tab === 'business' ? (
              <div className="government-form-grid">
                <Field label="사업장명칭" value={p.businessName} onChange={(v) => void ws.saveProfile({ businessName: v })} />
                <Field label="개업년월일" value={p.businessOpenedAt} onChange={(v) => void ws.saveProfile({ businessOpenedAt: v })} />
                <Field label="사업자등록번호" value={p.businessNumber} onChange={(v) => void ws.saveProfile({ businessNumber: v })} />
                <Field label="사업장 소재지" value={p.businessAddress} onChange={(v) => void ws.saveProfile({ businessAddress: v })} />
                <Field label="사업자 종목" value={p.businessCategory} onChange={(v) => void ws.saveProfile({ businessCategory: v })} />
                <Field label="업태" value={p.businessType} onChange={(v) => void ws.saveProfile({ businessType: v })} />
                <Field label="사업장 형태" value={p.businessForm} onChange={(v) => void ws.saveProfile({ businessForm: v })} />
                <Field label="사업장 번호" value={p.businessPhone} onChange={(v) => void ws.saveProfile({ businessPhone: v })} />
              </div>
            ) : null}

            {ws.tab === 'funding' ? (
              <div className="government-form-grid">
                <Field label="부가세 신고 유/무" value={p.vatReport} onChange={(v) => void ws.saveProfile({ vatReport: v })} />
                <Field label="연소득" value={p.annualIncome} onChange={(v) => void ws.saveProfile({ annualIncome: v })} />
                <Field label="소득금액증명원" value={p.incomeCert} onChange={(v) => void ws.saveProfile({ incomeCert: v })} />
                <Field label="세금 체납" value={p.taxArrears} onChange={(v) => void ws.saveProfile({ taxArrears: v })} />
                <Field label="필요자금" value={p.requiredFunds} onChange={(v) => void ws.saveProfile({ requiredFunds: v })} />
                <Field label="수임료" value={p.fee} onChange={(v) => void ws.saveProfile({ fee: v })} />
                <Field label="금융인증서 위임" value={p.certDelegate} onChange={(v) => void ws.saveProfile({ certDelegate: v })} />
                <Field label="인증서 종류" value={p.certType} onChange={(v) => void ws.saveProfile({ certType: v })} />
                <Field label="위임 상태" value={p.delegateStatus} onChange={(v) => void ws.saveProfile({ delegateStatus: v })} />
                <Field label="수임 메모" value={p.delegationMemo} onChange={(v) => void ws.saveProfile({ delegationMemo: v })} />
              </div>
            ) : null}

            {ws.tab === 'loans' ? (
              <div>
                <FormButton type="button" onClick={() => void ws.addPriorLoan()}>
                  + 기대출 추가
                </FormButton>
                <ul style={{ marginTop: '1rem', padding: 0, listStyle: 'none' }}>
                  {ws.priorLoans.map((loan) => (
                    <li key={loan.id} style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
                      <Field
                        label="대출 상호"
                        value={loan.lenderName}
                        onChange={(v) => void ws.updatePriorLoan(loan.id, { lenderName: v })}
                      />
                      <Field
                        label="남은 금액"
                        value={loan.remainingAmount}
                        onChange={(v) => void ws.updatePriorLoan(loan.id, { remainingAmount: v })}
                      />
                      <Field
                        label="받은 날짜"
                        value={loan.receivedAt}
                        onChange={(v) => void ws.updatePriorLoan(loan.id, { receivedAt: v })}
                      />
                      <Field
                        label="메모"
                        value={loan.memo}
                        onChange={(v) => void ws.updatePriorLoan(loan.id, { memo: v })}
                      />
                      <FormButton type="button" variant="secondary" onClick={() => void ws.removePriorLoan(loan.id)}>
                        삭제
                      </FormButton>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ws.tab === 'application' ? (
              <div>
                <FormButton type="button" onClick={() => void ws.addApplicationCase()}>
                  + 신청/청약 건
                </FormButton>
                {ws.cases.map((c) => (
                  <div key={c.id} style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-default)', borderRadius: 8 }}>
                    <Field
                      label="접수상품명"
                      value={c.productName}
                      onChange={(v) => void ws.updateCaseField(c.id, { productName: v })}
                    />
                    <select
                      value={c.progressStatus}
                      onChange={(e) => void ws.updateCaseStatus(c.id, e.target.value)}
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0.35rem' }}
                    >
                      {GOVERNMENT_APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}

            {ws.tab === 'edoc' ? (
              <div>
                <p className="government-page__muted">기존 전자문서 모듈 연동 — 발송 이력은 API로 확장됩니다.</p>
                <ul>
                  {GOVERNMENT_EDOC_TEMPLATES.map((name) => (
                    <li key={name} style={{ marginBottom: '0.35rem' }}>
                      {name}
                    </li>
                  ))}
                </ul>
                <Link to="/contracts/signatures/send" style={{ color: '#60a5fa' }}>
                  전자문서 발송 화면 열기 (기존 모듈)
                </Link>
              </div>
            ) : null}

            {ws.tab === 'documents' ? (
              <div>
                <p className="government-page__muted">
                  서류관리 — 프로필 조회 시 체크리스트가 자동 생성됩니다. 파일 업로드는 기존 R2 구조와 연동 예정.
                </p>
                <ul style={{ marginTop: '0.75rem', color: '#e5e7eb' }}>
                  {GOVERNMENT_DOCUMENT_TYPES.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ws.tab === 'schedule' ? (
              <div>
                <p className="government-page__muted">
                  일정관리 — 기존 <Link to="/todos">할일/일정</Link> 모듈과 연동 예정 (tenant·신청건 기준).
                </p>
                <ul style={{ marginTop: '0.75rem', color: '#e5e7eb' }}>
                  {GOVERNMENT_SCHEDULE_TYPES.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ws.tab === 'memo' ? (
              <Field label="메모/특이사항" value={p.specialNote} onChange={(v) => void ws.saveProfile({ specialNote: v })} />
            ) : null}
          </section>
        ) : (
          <section className="government-workspace__detail">
            <p className="government-page__muted">좌측에서 고객/사업장을 선택하거나 새로 추가하세요.</p>
          </section>
        )}
      </div>
    </main>
  )
}
