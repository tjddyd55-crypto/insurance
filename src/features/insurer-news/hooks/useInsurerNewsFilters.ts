import { useMemo, useState } from 'react'
import type { NewsletterItem } from '../types'

export type ContentFilter = 'all' | 'image' | 'pdf' | 'text'

export function useInsurerNewsFilters(items: NewsletterItem[]) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ContentFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((n) => {
      if (filter === 'image' && !n.hasImages) {
        return false
      }
      if (filter === 'pdf' && !n.hasPdf) {
        return false
      }
      if (filter === 'text' && !n.hasTextBody) {
        return false
      }
      if (!q) {
        return true
      }
      const hay = `${n.title} ${n.summary} ${n.insurerName}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, filter])

  return {
    query,
    setQuery,
    filter,
    setFilter,
    filtered,
  }
}
