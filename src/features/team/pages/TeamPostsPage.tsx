import { PageBackButton } from '../../../components/common/PageBackButton'

export default function TeamPostsPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 style={{ marginTop: 12 }}>팀 게시판</h1>
      <p className="text-[var(--text-secondary)]">
        팀 게시판 API 연동은 추후 단계에서 붙일 수 있습니다. 현재는 메뉴·라우트만 제공합니다.
      </p>
    </div>
  )
}
