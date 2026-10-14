import './newsletterCollections.css'
import { useMemo, useState } from 'react'
import { FormInput, FormSelect } from '../../../../components/form'
import { formatTimestampSearchHaystack } from '../../../../utils/displayDateTime'
import type { NewsletterItem } from '../../types'
import type { NewsletterCollections } from '../../services/newsletterCollections.service'
import { newsletterItemLabel } from './newsletterItemLabel'


function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
}

/**
 * 소식지 다중 선택 패널 — 검색 + 원수사 필터 + (전체/즐겨찾기/내 폴더) 출처.
 * 폴더의 [소식지 추가], 바인더의 [소식지] 출처 탭에서 공용으로 쓴다.
 */
export function NewsletterPickerPanel({
  items,
  collections,
  selectedIds,
  onSelectedIdsChange,
  disabledIds,
  disabledLabel = '이미 담김',
  showSourceFilter = true,
}: {
  items: NewsletterItem[]
  collections: NewsletterCollections
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  disabledIds?: Set<string>
  disabledLabel?: string
  showSourceFilter?: boolean
}) {
  const [query, setQuery] = useState('')
  const [insurer, setInsurer] = useState('')
  const [source, setSource] = useState('all')

  const insurerOptions = useMemo(() => {
    const names = [...new Set(items.map((item) => item.insurerName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
    return [{ value: '', label: '전체 원수사' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [items])

  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: '전체 소식지' },
      { value: 'favorites', label: `즐겨찾기 (${collections.favoriteNewsletterIds.length})` },
      ...collections.folders.map((folder) => ({ value: `folder:${folder.id}`, label: `📁 ${folder.name} (${folder.count})` })),
    ],
    [collections],
  )

  const rows = useMemo(() => {
    let allowed: Set<string> | null = null
    if (source === 'favorites') allowed = new Set(collections.favoriteNewsletterIds)
    if (source.startsWith('folder:')) {
      const folder = collections.folders.find((f) => `folder:${f.id}` === source)
      allowed = new Set(folder?.newsletterIds ?? [])
    }
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (allowed && !allowed.has(item.id)) return false
      if (insurer && item.insurerName !== insurer) return false
      if (!q) return true
      return [item.insurerName, item.title, item.summary, formatTimestampSearchHaystack(item.publishedAt)]
        .map((v) => String(v ?? '').toLowerCase())
        .join('\n')
        .includes(q)
    })
  }, [collections, insurer, items, query, source])

  const selected = new Set(selectedIds)
  const selectable = rows.filter((row) => !disabledIds?.has(row.id))
  const allChecked = selectable.length > 0 && selectable.every((row) => selected.has(row.id))

  const toggle = (id: string) => {
    if (disabledIds?.has(id)) return
    onSelectedIdsChange(selected.has(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id])
  }

  const toggleAll = () => {
    if (allChecked) {
      const visible = new Set(selectable.map((row) => row.id))
      onSelectedIdsChange(selectedIds.filter((id) => !visible.has(id)))
    } else {
      onSelectedIdsChange([...new Set([...selectedIds, ...selectable.map((row) => row.id)])])
    }
  }

  return (
    <div className="newsletter-picker">
      <div className="newsletter-picker__controls">
        {showSourceFilter ? (
          <FormSelect
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={sourceOptions}
            aria-label="소식지 출처"
          />
        ) : null}
        <FormSelect
          value={insurer}
          onChange={(e) => setInsurer(e.target.value)}
          options={insurerOptions}
          aria-label="원수사"
        />
        <FormInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목, 내용, 회사명, 날짜 검색"
          aria-label="소식지 검색"
        />
      </div>
      <div className="newsletter-picker__bar">
        <label className="newsletter-picker__check-all">
          <FormInput type="checkbox" checked={allChecked} onChange={toggleAll} disabled={selectable.length === 0} />
          <span>보이는 항목 전체 선택</span>
        </label>
        <span className="newsletter-picker__count">{selectedIds.length}개 선택</span>
      </div>
      <ul className="newsletter-picker__list" aria-label="소식지 목록">
        {rows.length === 0 ? <li className="newsletter-picker__empty">표시할 소식지가 없습니다.</li> : null}
        {rows.map((item) => {
          const disabled = disabledIds?.has(item.id) ?? false
          return (
            <li key={item.id}>
              <label className={`newsletter-picker__row${disabled ? ' is-disabled' : ''}`}>
                <FormInput
                  type="checkbox"
                  checked={disabled || selected.has(item.id)}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  aria-label={newsletterItemLabel(item)}
                />
                <span className="newsletter-picker__row-title">{newsletterItemLabel(item)}</span>
                <span className="newsletter-picker__row-meta">
                  {item.insurerName} · {formatDate(item.publishedAt)}
                  {disabled ? ` · ${disabledLabel}` : ''}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
