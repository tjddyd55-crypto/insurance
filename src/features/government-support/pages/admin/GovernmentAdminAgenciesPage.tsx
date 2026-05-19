import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useAuth } from '../../../auth/AuthProvider'
import { createGovAgency, fetchGovAgencies } from '../../api/governmentProfilesApi'
import type { GovAgencyRow } from '../../types/governmentProfile.types'
import '../../government-support.css'

export default function GovernmentAdminAgenciesPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<GovAgencyRow[]>([])
  const [name, setName] = useState('')
  const [agencyCode, setAgencyCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setRows(await fetchGovAgencies(token))
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async () => {
    if (!token) return
    setErr(null)
    setMsg(null)
    try {
      await createGovAgency(token, { name: name.trim(), agencyCode: agencyCode.trim() })
      setName('')
      setAgencyCode('')
      setMsg('대행사를 등록하고 agencyCode 가입 코드를 발급했습니다.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '등록에 실패했습니다.')
    }
  }

  return (
    <main className="page government-page" style={{ padding: '1.5rem' }}>
      <p>
        <Link to="/government/admin" className="dark-link">
          ← 관리 허브
        </Link>
      </p>
      <h1 className="government-page__title">정부지원 대행사</h1>
      <div className="government-form-grid" style={{ maxWidth: 480, marginTop: '1rem' }}>
        <FormInput label="대행사명" value={name} onChange={(e) => setName(e.target.value)} />
        <FormInput label="agencyCode (가입 코드)" value={agencyCode} onChange={(e) => setAgencyCode(e.target.value)} />
      </div>
      <FormButton type="button" onClick={() => void onCreate()} style={{ marginTop: '0.75rem' }}>
        등록
      </FormButton>
      {msg ? <p style={{ color: '#60a5fa' }}>{msg}</p> : null}
      {err ? <p style={{ color: '#ef4444' }}>{err}</p> : null}
      <table style={{ width: '100%', marginTop: '1.5rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
            <th>코드</th>
            <th>이름</th>
            <th>상태</th>
            <th>가입 URL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #1e293b' }}>
              <td style={{ padding: '0.5rem 0' }}>{r.agencyCode}</td>
              <td>{r.name}</td>
              <td>{r.status}</td>
              <td>
                <Link to={`/government/join/${r.agencyCode}`} className="dark-link">
                  /government/join/{r.agencyCode}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
