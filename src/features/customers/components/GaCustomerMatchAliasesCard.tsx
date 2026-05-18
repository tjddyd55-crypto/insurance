import { FormButton } from '../../../components/form'
import { LoadingState, StatusMessage } from '../../../components/feedback'
import { useGaCustomerMatchAliases } from '../hooks/useGaCustomerMatchAliases'

export type GaCustomerMatchAliasesCardProps = {
  customerId: number
  /** 저장 성공 후 GA 데이터 목록 재조회 등 */
  onSaved?: () => void
}

/**
 * GA 피보험자 ↔ CRM 고객명 정확 일치용 예외값 입력 카드.
 * PC/Mobile GA 데이터 보기 화면 공통.
 */
export default function GaCustomerMatchAliasesCard({ customerId, onSaved }: GaCustomerMatchAliasesCardProps) {
  const {
    loading,
    saving,
    customerName,
    inputText,
    setInputText,
    savedAliases,
    error,
    saveMessage,
    onSave,
  } = useGaCustomerMatchAliases(customerId)

  const handleSave = async () => {
    const ok = await onSave()
    if (ok) onSaved?.()
  }

  const emptyHint =
    !loading && savedAliases.length === 0 && !inputText.trim() ? '등록된 예외값 없음' : null

  return (
    <section className="ga-match-aliases-card" aria-labelledby="ga-match-aliases-title">
      <h3 id="ga-match-aliases-title" className="ga-match-aliases-card__title">
        매칭 예외값
      </h3>
      <p className="ga-match-aliases-card__desc">
        업로드 데이터의 피보험자명이 고객명과 다르게 들어온 경우 추가로 입력하세요.
      </p>

      {loading ? (
        <LoadingState message="예외값 불러오는 중…" />
      ) : (
        <>
          <p className="ga-match-aliases-card__default">
            <span className="ga-match-aliases-card__default-label">기본 매칭값</span>
            <span className="ga-match-aliases-card__default-value">
              고객명: {customerName.trim() || '—'}
            </span>
          </p>
          {emptyHint ? <p className="ga-match-aliases-card__empty">{emptyHint}</p> : null}
          <label className="ga-match-aliases-card__label" htmlFor="ga-match-aliases-input">
            예외값
          </label>
          <textarea
            id="ga-match-aliases-input"
            className="ga-match-aliases-card__textarea"
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={'이지은(S3)\n한 줄에 하나씩 입력하거나 쉼표로 구분'}
            disabled={saving}
          />
          <p className="ga-match-aliases-card__help">
            고객명은 기본으로 자동 포함됩니다. 예외값만 입력하세요.
          </p>
          <div className="ga-match-aliases-card__actions">
            <FormButton
              htmlType="button"
              variant="primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? '저장 중…' : '예외값 저장'}
            </FormButton>
          </div>
        </>
      )}

      <StatusMessage message={error} tone="error" />
      <StatusMessage message={saveMessage} tone="default" />
    </section>
  )
}
