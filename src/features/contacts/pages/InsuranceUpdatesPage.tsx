import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInsuranceUpdates } from '../api/contactsApi'
import type { InsuranceContactUpdate } from '../domain/types'
import { formatPhoneNumber } from '../utils/phone'

function getActionLabel(actionType: InsuranceContactUpdate['actionType']) {
  if (actionType === 'CREATE') {
    return '등록'
  }
  if (actionType === 'UPDATE') {
    return '수정'
  }
  return '삭제'
}

export function InsuranceUpdatesPage() {
  const navigate = useNavigate()
  const [updates, setUpdates] = useState<InsuranceContactUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    let active = true

    async function loadUpdates() {
      try {
        const result = await getInsuranceUpdates()
        if (!active) {
          return
        }
        setUpdates(result)
      } catch (error) {
        if (!active) {
          return
        }
        setStatusText(error instanceof Error ? error.message : '업데이트 이력을 불러오지 못했습니다.')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadUpdates()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="page contacts-page">
      <header className="page-header">
        <h1>업데이트 현황</h1>
        <p>{statusText || '연락처 등록/수정/삭제 이력을 최신순으로 표시합니다.'}</p>
      </header>

      <section className="card contacts-toolbar">
        <div className="contacts-toolbar__actions">
          <button className="button" type="button" onClick={() => navigate('/insurance/contacts')}>
            보험사 연락처 조회
          </button>
          <button className="button" type="button" onClick={() => navigate('/menu/reinsurer-contacts')}>
            원수사 연락처
          </button>
          <button className="button" type="button" onClick={() => navigate('/dashboard')}>
            메뉴
          </button>
        </div>
      </section>

      <section className="card">
        {isLoading ? (
          <p className="dashboard-empty">업데이트 이력을 불러오는 중입니다...</p>
        ) : updates.length === 0 ? (
          <p className="dashboard-empty">업데이트 이력이 없습니다.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table contacts-updates-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>보험사</th>
                  <th>담당자</th>
                  <th>직책</th>
                  <th>변경유형</th>
                  <th>변경내용</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((update) => (
                  <tr key={update.id}>
                    <td>{new Date(update.createdAt).toLocaleString('ko-KR')}</td>
                    <td>{update.companyName}</td>
                    <td>{update.managerName}</td>
                    <td>{update.position || '-'}</td>
                    <td>{getActionLabel(update.actionType)}</td>
                    <td>
                      {formatPhoneNumber(update.oldPhoneNumber || '') || '-'} →{' '}
                      {formatPhoneNumber(update.newPhoneNumber || '') || '-'}
                    </td>
                    <td>{update.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
