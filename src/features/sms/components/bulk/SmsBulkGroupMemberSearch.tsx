import { useEffect, useRef, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useAuth } from '../../../auth/AuthProvider'
import { searchSmsBulkRecipients } from '../../api/smsBulkRecipientsApi'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { EMPTY_SMS_BULK_FILTERS, type SmsBulkSearchCustomer } from '../../types/smsBulkRecipient.types'
import SmsBulkPersonRow from './SmsBulkPersonRow'

export default function SmsBulkGroupMemberSearch({ bulkState, groupId, disabled, layout }: {
  bulkState: SmsBulkRecipientState
  groupId: number
  disabled: boolean
  layout: 'pc' | 'mobile'
}) {
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SmsBulkSearchCustomer[]>([])
  const [selection, setSelection] = useState<Set<number>>(() => new Set())
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const request = useRef(0)
  useEffect(() => () => { request.current += 1 }, [])
  const memberIds = new Set(bulkState.groupMembers.map((row) => row.customerId))
  const search = async () => {
    if (!token?.trim()) return
    const id = ++request.current
    setSearching(true)
    setSelection(new Set())
    setResults([])
    setSearched(true)
    try {
      const data = await searchSmsBulkRecipients(token, { ...EMPTY_SMS_BULK_FILTERS, search: query })
      if (request.current === id) setResults(data.customers)
    } catch (error) {
      if (request.current === id) bulkState.setActionNotice(error instanceof Error ? error.message : '고객 검색에 실패했습니다.')
    } finally {
      if (request.current === id) setSearching(false)
    }
  }
  const add = async () => {
    if (await bulkState.appendCustomersToGroup(groupId, [...selection])) setSelection(new Set())
  }
  return <section className="sms-bulk-groups__members sms-bulk-groups__member-search" aria-label="구성원 추가 고객 검색">
    <h4>고객 검색으로 구성원 추가</h4>
    <form className="sms-bulk-groups__detail-actions" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <FormInput aria-label="추가할 고객 이름 또는 연락처" placeholder="이름 또는 연락처" value={query} disabled={disabled || searching} onChange={(event) => setQuery(event.target.value)} />
      <FormButton htmlType="submit" disabled={disabled || searching}>검색</FormButton>
    </form>
    <div className={`sms-bulk-groups__members-list sms-bulk-person-list sms-bulk-groups__members-list--${layout}`}>
      {searching ? <p>검색 중입니다.</p> : searched && !results.length ? <p>검색 결과가 없습니다.</p> : results.map((row) => <div key={row.customerId}>
        <SmsBulkPersonRow {...row} checked={selection.has(row.customerId)} disabled={disabled || searching} onCheckChange={() => setSelection((prev) => {
          const next = new Set(prev)
          if (next.has(row.customerId)) next.delete(row.customerId)
          else next.add(row.customerId)
          return next
        })} />
        {memberIds.has(row.customerId) ? <span className="sms-module__muted">이미 그룹에 포함됨</span> : null}
      </div>)}
    </div>
    <FormButton htmlType="button" variant="primary" disabled={disabled || searching || !selection.size} onClick={() => void add()}>선택한 고객 추가</FormButton>
  </section>
}
