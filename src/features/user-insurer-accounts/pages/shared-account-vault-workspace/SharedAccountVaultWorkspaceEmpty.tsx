export function SharedAccountVaultWorkspaceEmpty() {
  return (
    <div className="shared-account-workspace__detail-empty" role="status">
      <p className="shared-account-workspace__detail-empty-title">사용자를 선택하세요</p>
      <p className="shared-account-workspace__detail-empty-desc">
        좌측 목록에서 이름을 선택하면 계정관리 내용을 확인할 수 있습니다.
      </p>
    </div>
  )
}
