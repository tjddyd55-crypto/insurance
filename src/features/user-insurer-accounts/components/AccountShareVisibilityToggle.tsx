import type { AccountShareVisibilityViewProps } from '../hooks/useAccountShareVisibilityState'

/**
 * 계정관리 "스태프 공유" ON/OFF 토글. 소유자 본인 화면에서만 노출한다.
 * (공유된 화면을 스태프가 볼 때는 렌더하지 않는다.)
 */
export function AccountShareVisibilityToggle({
  enabled,
  loading,
  pending,
  error,
  onToggle,
}: AccountShareVisibilityViewProps) {
  const disabled = loading || pending

  return (
    <div className="account-share-visibility" aria-label="계정관리 공유 허용">
      <label
        className="account-share-visibility__control"
        title="공유를 켜면 같은 GA 스태프가 공유 계정관리에서 내 계정을 볼 수 있습니다."
      >
        <span className="account-share-visibility__label">공유 허용</span>
        <input
          type="checkbox"
          className="account-share-visibility__input"
          role="switch"
          aria-label="공유 허용"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => void onToggle(event.target.checked)}
        />
        <span className="account-share-visibility__track" aria-hidden="true">
          <span className="account-share-visibility__thumb" />
        </span>
      </label>
      {error ? (
        <p className="account-share-visibility__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
