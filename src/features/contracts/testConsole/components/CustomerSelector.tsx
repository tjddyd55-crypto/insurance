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
      <div className="contract-signature-console__search-row">
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
        <div className="contract-signature-console__selected-card">
          <div>
            선택 고객 ID: <strong>{selected.id}</strong>
          </div>
          <div>이름(마스킹): {maskCustomerNameForTestConsole(selected.name)}</div>
          <div>전화(마스킹): {maskPhoneForTestConsole(selected.phone ?? selected.phoneNumber ?? '')}</div>
          {!phoneOk(selected) ? (
            <div className="contract-signature-console__inline-warning">
              휴대폰 번호가 없거나 형식이 맞지 않으면 발송할 수 없습니다.
            </div>
          ) : null}
          <FormButton htmlType="button" variant="action" size="sm" className="p-0 mt-1" onClick={() => onSelect(null)}>
            선택 해제
          </FormButton>
        </div>
      ) : null}
      {results.length > 0 ? (
        <ul className="contract-signature-console__hit-list">
          {results.map((c) => (
            <li key={c.id} className="contract-signature-console__hit-item">
              <div style={{ fontSize: 13 }}>
                <div>
                  #{c.id} · {maskCustomerNameForTestConsole(c.name)}
                </div>
                <div className="contract-signature-console__muted">{maskPhoneForTestConsole(c.phone ?? c.phoneNumber ?? '')}</div>
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
