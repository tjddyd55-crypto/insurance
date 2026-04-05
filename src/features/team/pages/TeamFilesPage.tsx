import { PageBackButton } from '../../../components/common/PageBackButton'

export default function TeamFilesPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <PageBackButton />
      <h1 style={{ marginTop: 12 }}>팀 자료</h1>
      <p style={{ color: '#555' }}>
        팀 자료실 API·스토리지 연동은 추후 단계에서 확장할 수 있습니다. 현재는 메뉴·라우트만 제공합니다.
      </p>
    </div>
  )
}
