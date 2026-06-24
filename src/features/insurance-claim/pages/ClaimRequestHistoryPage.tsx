import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { duplicateClaimRequest, listClaimRequests, type ClaimRequestDraft } from '../api/claimRequestsApi'

export default function ClaimRequestHistoryPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ClaimRequestDraft[]>([])
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const load = useCallback(async () => {
    if (!token) return
    try { setRows((await listClaimRequests(token)).requests) } catch (e) { setMessage(e instanceof Error ? e.message : '청구 내역을 불러오지 못했습니다.') }
  }, [token])
  useEffect(() => { void load() }, [load])
  const duplicate = async (id: number) => {
    if (!token) return
    setBusyId(id)
    try { const { request } = await duplicateClaimRequest(token, id); navigate(`/insurance-claim/requests/${request.id}`) }
    catch (e) { setMessage(e instanceof Error ? e.message : '다시 청구하기에 실패했습니다.') } finally { setBusyId(null) }
  }
  return <main className="page insurance-claim-history"><header className="page-header"><h1>청구 내역</h1><p>피보험자 snapshot 기준으로 표시됩니다.</p></header><Link className="button button--primary" to="/insurance-claim/new">새 청구</Link>{message ? <p role="alert">{message}</p> : null}<table className="insurance-claim-admin-table"><thead><tr><th>청구일</th><th>피보험자</th><th>보험회사</th><th>청구유형</th><th>상태</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{String(row.createdAt ?? '').slice(0, 10)}</td><td>{row.insuredSnapshot?.name || '수동 입력'}</td><td>{row.insuranceCompanyName ?? row.insuranceCompanyId}</td><td>{row.claimData?.claimType || '—'}</td><td>{row.status}</td><td><Link to={`/insurance-claim/requests/${row.id}`}>상세</Link> <FormButton htmlType="button" disabled={busyId === row.id} onClick={() => void duplicate(row.id)}>다시 청구하기</FormButton></td></tr>)}</tbody></table></main>
}
