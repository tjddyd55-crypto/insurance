import { useNavigate } from 'react-router-dom'
import { FormInput } from '../../../../components/form'
import { NewsletterList } from '../../components/NewsletterList'
import type { InsurerManagerNewsListViewProps } from './insurerManagerNewsListViewProps'

/**
 * [Mobile 전용 View] 원수사 소식지 목록 — 모바일 기기.
 *
 * 책임: 목록 마크업 + 아이템 클릭 시 상세 라우트로 이동.
 *   - Mobile 은 인라인 모달을 띄우지 않는다 (좁은 화면에서 가독성 저하).
 *   - 대신 `/<prefix>/<id>` 경로로 navigate 해 전용 상세 페이지에서 본다.
 *   - 상세 조회 API 호출·zoom·모달 state 는 이 View 의 책임이 아니다.
 *
 * 규칙:
 *   - `useIsMobile` 을 호출하지 않는다 (§8-2 원칙 4).
 *   - 페이지 스코프 CSS 는 `.insurer-news-page--mobile` modifier 아래에서 작성.
 */
export default function InsurerManagerNewsListMobileView({
  items,
  error,
  title,
  emptyMessage,
  openPathPrefix,
  searchQuery,
  onSearchQueryChange,
  noSearchResults,
  deleteNotice,
}: InsurerManagerNewsListViewProps) {
  const navigate = useNavigate()

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--mobile user-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{title}</h1>
        </div>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search insurer-news-searchbar">
          <span className="sr-only">소식지 검색</span>
          <FormInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="제목, 내용, 회사명, 날짜 검색"
            aria-label="소식지 검색"
          />
        </label>
      </div>
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      {deleteNotice ? (
        <div className="insurer-news-inline-notice" role="status">
          {deleteNotice}
        </div>
      ) : null}
      <NewsletterList
        items={items}
        emptyMessage={emptyMessage}
        variant="mobile"
        onOpenItem={(id) => navigate(`${openPathPrefix}/${id}`)}
        noSearchResults={noSearchResults}
      />
    </main>
  )
}
