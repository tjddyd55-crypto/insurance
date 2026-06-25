import { FormButton, FormInput } from '../../../components/form'

type CustomerMatch = { id: number; name: string; phone?: string }

type Props = {
  query: string
  matches: CustomerMatch[]
  onQueryChange: (value: string) => void
  onSearch: () => void
  onSelect: (customerId: number) => void
  searchLabel?: string
}

export default function ClaimRequestPersonCustomerSearch({
  query,
  matches,
  onQueryChange,
  onSearch,
  onSelect,
  searchLabel = '고객 불러오기',
}: Props) {
  return (
    <>
      <div className="insurance-claim-form__customer-search">
        <FormInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="고객명 또는 연락처 검색 (선택)"
        />
        <FormButton htmlType="button" onClick={onSearch}>
          {searchLabel}
        </FormButton>
      </div>
      {matches.length > 0 ? (
        <div className="insurance-claim-form__customer-matches">
          {matches.map((match) => (
            <FormButton key={match.id} htmlType="button" variant="secondary" size="sm" onClick={() => onSelect(match.id)}>
              {match.name} {match.phone ?? ''}
            </FormButton>
          ))}
        </div>
      ) : null}
    </>
  )
}
