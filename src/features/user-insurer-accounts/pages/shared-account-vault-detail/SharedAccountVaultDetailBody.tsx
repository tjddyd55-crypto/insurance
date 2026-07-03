import { AccountVaultManager } from '../../components/AccountVaultManager'
import type { SharedAccountVaultDetailViewProps } from '../SharedAccountVaultDetailPage'

type Props = SharedAccountVaultDetailViewProps & {
  layout: 'dual-column' | 'stacked'
}

/**
 * 스태프 계정관리 상세 본문. 기존 공유 링크 화면과 동일하게 AccountVaultManager 를
 * 재사용하고, 상단에 "누구의 계정관리를 보는지" 배너만 추가한다.
 */
export function SharedAccountVaultDetailBody({ adapter, ownerName, metaLoading, accessError, layout }: Props) {
  const bannerName = ownerName.trim() || '사용자'

  return (
    <>
      <header className="user-insurer-accounts-page__header external-account-vault-page__header">
        <h1>{bannerName} 계정관리</h1>
      </header>

      {accessError ? (
        <p className="user-insurer-accounts-page__error" role="alert">
          {accessError}
        </p>
      ) : (
        <>
          <p className="shared-account-list__banner">
            {bannerName}님의 계정관리 화면을 공유 권한으로 보고 있습니다.
          </p>
          {metaLoading ? (
            <p className="shared-account-list__muted">불러오는 중…</p>
          ) : (
            <AccountVaultManager mode="external" layout={layout} adapter={adapter} />
          )}
        </>
      )}
    </>
  )
}
