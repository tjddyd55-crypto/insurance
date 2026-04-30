import { useCallback, useEffect, useState } from 'react'
import { FormButton, FormInput } from '../../../../components/form'
import type { CustomerRecord } from '../../../customers/domain/types'
import { maskCustomerNameForTestConsole, maskPhoneForTestConsole } from '../contractSignatureTestDisplay'

type Props = {
  token: string
  disabled: boolean
  onSearch: (q: string) => Promise<CustomerRecord[]>
  selected: CustomerRecord | null
  onSelect: (c: CustomerRecord | null) => void
}

export function CustomerSelector({ token, disabled, onSearch, selected, onSelect }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(false)

  const runSearch = useCallback(async () => {
    if (!token.trim() || disabled) {
      return
    }
    setLoading(true)
    try {
      const rows = await onSearch(q)
      setResults(rows)
    } finally {
      setLoading(false)
    }
  }, [token, disabled, onSearch, q])

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
    }
  }, [q])

  const phoneOk = (c: CustomerRecord) => {
    const p = String(c.phone ?? c.phoneNumber ?? '').replace(/\D/g, '')
    return p.length >= 10
  }

  return (
    <div>
      <div className="d-flex gap-2 flex-wrap align-items-center mb-2">
        <FormInput
          className="form-control form-control-sm"
          style={{ maxWidth: 280 }}
          placeholder="이름·전화번호 일부·고객번호"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void runSearch()
            }
          }}
        />
        <FormButton htmlType="button" variant="primary" size="sm" disabled={disabled || loading} onClick={() => void runSearch()}>
          {loading ? '검색 중…' : '검색'}
        </FormButton>
      </div>
      {selected ? (
        <div className="alert alert-light border py-2 px-3" style={{ fontSize: 13 }}>
          <div>
            선택 고객 ID: <strong>{selected.id}</strong>
          </div>
          <div>이름(마스킹): {maskCustomerNameForTestConsole(selected.name)}</div>
          <div>전화(마스킹): {maskPhoneForTestConsole(selected.phone ?? selected.phoneNumber ?? '')}</div>
          {!phoneOk(selected) ? (
            <div style={{ color: '#b45309', marginTop: 6 }}>휴대폰 번호가 없거나 형식이 맞지 않으면 발송할 수 없습니다.</div>
          ) : null}
          <FormButton htmlType="button" variant="action" size="sm" className="p-0 mt-1" onClick={() => onSelect(null)}>
            선택 해제
          </FormButton>
        </div>
      ) : null}
      {results.length > 0 ? (
        <ul className="list-group list-group-flush" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {results.map((c) => (
            <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
              <div style={{ fontSize: 13 }}>
                <div>
                  #{c.id} · {maskCustomerNameForTestConsole(c.name)}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{maskPhoneForTestConsole(c.phone ?? c.phoneNumber ?? '')}</div>
              </div>
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => onSelect(c)}
              >
                선택
              </FormButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
