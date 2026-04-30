import { FormButton } from '../../../../components/form'
import type { SendSessionDetail } from '../contractSignatureTestConsoleClient'

type Props = {
  detail: SendSessionDetail | null
  loading: boolean
  onRefresh: () => void
}

export function EvidenceStatusPanel({ detail, loading, onRefresh }: Props) {
  return (
    <div>
      <div className="contract-signature-console__toolbar">
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={loading || !detail} onClick={onRefresh}>
          {loading ? '불러오는 중…' : '상태 새로고침'}
        </FormButton>
      </div>
      {!detail ? (
        <p className="contract-signature-console__empty-state-text">
          발송 세션을 만든 뒤 새로고침하면 문서·evidence 가 표시됩니다.
        </p>
      ) : (
        <div className="contract-signature-console__body-text">
          <h3 className="contract-signature-console__subsection-title">세션</h3>
          <ul className="contract-signature-console__unordered-list">
            <li>status: {detail.status}</li>
            <li>sentAt: {detail.sentAt ?? '—'}</li>
            <li>completedAt: {detail.completedAt ?? '—'}</li>
            <li>지정 휴대폰 인증 세션 ID: {detail.identitySessionId ?? '—'}</li>
          </ul>
          <h3 className="contract-signature-console__subsection-title">문서 / evidence</h3>
          <div className="contract-signature-console__scroll-x">
            <table className="pdf-engine-table contract-signature-console__table--compact">
              <thead>
                <tr>
                  <th>문서 ID</th>
                  <th>제목 스냅샷</th>
                  <th>문서 상태</th>
                  <th>필수(정렬)</th>
                  <th>evidenceHash(prefix)</th>
                  <th>identityProvider</th>
                  <th>identityLevel</th>
                  <th>otpVerifiedAt</th>
                  <th>signedAt</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((d) => {
                  const ev = d.evidence
                  const hashShow = ev?.evidenceHash ?? '—'
                  return (
                    <tr key={d.id}>
                      <td>
                        <code>{d.id.slice(0, 14)}…</code>
                      </td>
                      <td>{d.titleSnapshot}</td>
                      <td>{d.status}</td>
                      <td>{d.sortOrder}</td>
                      <td title={hashShow !== '—' ? `전체 해시(관리자): ${hashShow}` : undefined}>
                        {ev?.evidenceHashPrefix ?? '—'}
                      </td>
                      <td>{ev?.identityProvider ?? '—'}</td>
                      <td>{ev?.identityLevel ?? '—'}</td>
                      <td>{ev?.otpVerifiedAt ?? '—'}</td>
                      <td>{ev?.signedAt ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="contract-signature-console__footnote">
            전체 <code>evidenceHash</code>는 행에 마우스를 올리면 툴팁으로 확인할 수 있습니다.
          </p>
        </div>
      )}

      <h3 className="contract-signature-console__subsection-title">테스트 절차 안내</h3>
      <ol className="contract-signature-console__ordered-list">
        <li>고객 공개 링크를 새 탭으로 엽니다.</li>
        <li>마스킹된 번호가 맞는지 확인합니다.</li>
        <li>인증번호 받기를 누릅니다.</li>
        <li>개발 환경에서는 mock OTP 로그를 확인합니다.</li>
        <li>인증번호를 입력합니다.</li>
        <li>문서 상세에서 값을 입력합니다.</li>
        <li>손사인을 저장합니다.</li>
        <li>문서 완료를 진행합니다.</li>
        <li>이 화면에서 상태 새로고침 후 evidenceHash(prefix)를 확인합니다.</li>
      </ol>
    </div>
  )
}
