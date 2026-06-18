import { Link, useNavigate } from 'react-router-dom'
import { FormButton, FormInput } from '../../../../components/form'
import { NewsletterList } from '../../components/NewsletterList'
import type { BoardWriterNewsListViewProps } from './boardWriterNewsListViewProps'

export default function BoardWriterNewsListMobileView({
  boardLabel,
  boardScopeLabel,
  items,
  error,
  loading,
  emptyMessage,
  listPathPrefix,
  uploadPath,
  searchQuery,
  onSearchQueryChange,
  noSearchResults,
}: BoardWriterNewsListViewProps) {
  const navigate = useNavigate()

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--mobile board-writer-news-page board-writer-news-page--mobile user-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{boardLabel}</h1>
        </div>
        <p className="insurer-news-muted">{boardScopeLabel}</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FormButton htmlType="button" variant="primary" onClick={() => navigate(uploadPath)}>
            새 소식지
          </FormButton>
          <Link to="/board-writer/workspace" className="button button--secondary">
            소식지 선택
          </Link>
        </div>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search insurer-news-searchbar">
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
          variant="mobile"
          onOpenItem={(id) => navigate(`${listPathPrefix}/${id}`)}
          noSearchResults={noSearchResults}
        />
      ) : null}
    </main>
  )
}
