import { useNavigate } from 'react-router-dom'
import { FormInput } from '../../../../components/form'
import { NewsletterList } from '../../components/NewsletterList'
import type { DynamicNewsletterBoardViewProps } from './dynamicNewsletterBoardViewProps'

export default function DynamicNewsletterBoardPCView({
  board,
  items,
  error,
  loading,
  searchQuery,
  onSearchQueryChange,
  openPathPrefix,
  noSearchResults,
}: DynamicNewsletterBoardViewProps) {
  const navigate = useNavigate()
  const title = board?.label ?? '소식지'

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--pc dynamic-newsletter-board-page dynamic-newsletter-board-page--pc user-page">
      <header className="page-header page-header--has-inline-back" style={{ marginBottom: 16 }}>
        <div className="page-header__title-row">
          <h1>{title}</h1>
        </div>
        <p className="insurer-news-muted">
          {board?.isPublic ? '공용 게시판' : 'GA 전용 게시판'}
        </p>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search">
          <span className="sr-only">소식지 검색</span>
          <FormInput
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="제목, 내용, 회사명, 날짜 검색"
            aria-label="소식지 검색"
          />
        </label>
      </div>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      {!loading && !error ? (
        <NewsletterList
          items={items}
          emptyMessage="등록된 소식지가 없습니다."
          variant="pc"
          onOpenItem={(id) => navigate(`${openPathPrefix}/${id}`)}
          noSearchResults={noSearchResults}
        />
      ) : null}
    </main>
  )
}
