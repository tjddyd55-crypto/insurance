import { useNavigate } from 'react-router-dom'
import { FormInput } from '../../../../components/form'
import { NewsletterList } from '../../components/NewsletterList'
import type { BoardWriterNewsListViewProps } from './boardWriterNewsListViewProps'

export default function BoardWriterNewsListPCView({
  pageTitle,
  items,
  error,
  loading,
  emptyMessage,
  listPathPrefix,
  searchQuery,
  onSearchQueryChange,
  noSearchResults,
}: BoardWriterNewsListViewProps) {
  const navigate = useNavigate()

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--pc board-writer-news-page board-writer-news-page--pc user-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{pageTitle}</h1>
        </div>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search">
          <span className="sr-only">소식지 검색</span>
          <FormInput
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="제목, 내용, 날짜 검색"
            aria-label="소식지 검색"
          />
        </label>
      </div>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      {!loading && !error ? (
        <NewsletterList
          items={items}
          emptyMessage={emptyMessage}
          variant="pc"
          onOpenItem={(id) => navigate(`${listPathPrefix}/${id}`)}
          noSearchResults={noSearchResults}
        />
      ) : null}
    </main>
  )
}
