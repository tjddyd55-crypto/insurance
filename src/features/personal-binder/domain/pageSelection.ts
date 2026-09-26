import type {
  PersonalBinder,
  PersonalBinderViewerPage,
} from '../personalBinder.types'

export type PageRangeParseResult =
  | { ok: true; pages: number[] }
  | { ok: false; error: string }

export function normalizeSelectedPages(
  pages: Iterable<number>,
  pageCount: number,
): number[] {
  return [...new Set(pages)]
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount)
    .sort((left, right) => left - right)
}

export function parsePageRangeInput(
  input: string,
  pageCount: number,
): PageRangeParseResult {
  const source = input.trim()
  if (!source) return { ok: false, error: '페이지 범위를 입력해 주세요.' }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { ok: false, error: 'PDF 페이지 수를 확인할 수 없습니다.' }
  }

  const pages: number[] = []
  for (const rawToken of source.split(',')) {
    const token = rawToken.trim()
    if (!token) return { ok: false, error: '빈 페이지 범위가 포함되어 있습니다.' }
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      if (start < 1 || end < 1 || start > end) {
        return { ok: false, error: `${token} 범위가 올바르지 않습니다.` }
      }
      if (end > pageCount) {
        return { ok: false, error: `${pageCount}페이지를 초과할 수 없습니다.` }
      }
      for (let page = start; page <= end; page += 1) pages.push(page)
      continue
    }
    if (!/^\d+$/.test(token)) {
      return { ok: false, error: `${token} 형식이 올바르지 않습니다.` }
    }
    const page = Number(token)
    if (page < 1 || page > pageCount) {
      return { ok: false, error: `페이지는 1~${pageCount} 사이여야 합니다.` }
    }
    pages.push(page)
  }

  return { ok: true, pages: normalizeSelectedPages(pages, pageCount) }
}

export function formatSelectedPages(pages: number[]): string {
  const normalized = [...new Set(pages)].sort((left, right) => left - right)
  if (normalized.length === 0) return ''
  const chunks: string[] = []
  let start = normalized[0]
  let previous = normalized[0]
  for (let index = 1; index <= normalized.length; index += 1) {
    const current = normalized[index]
    if (current === previous + 1) {
      previous = current
      continue
    }
    chunks.push(start === previous ? String(start) : `${start}-${previous}`)
    start = current
    previous = current
  }
  return chunks.join(', ')
}

export function togglePageSelection(
  selected: number[],
  page: number,
  options: { shiftFrom?: number | null; additive?: boolean } = {},
): number[] {
  const current = new Set(options.additive ? selected : [])
  if (options.shiftFrom != null) {
    const start = Math.min(options.shiftFrom, page)
    const end = Math.max(options.shiftFrom, page)
    for (let entry = start; entry <= end; entry += 1) current.add(entry)
  } else if (current.has(page)) {
    current.delete(page)
  } else {
    current.add(page)
  }
  return [...current].sort((left, right) => left - right)
}

export function buildBinderViewerPages(
  binder: PersonalBinder,
): PersonalBinderViewerPage[] {
  return binder.sections
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((section) =>
      section.items
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .flatMap((item) => {
          const pages = item.pageSelection ??
            Array.from({ length: item.material.pageCount }, (_, index) => index + 1)
          return pages.map((pdfPageNumber) => ({
            key: `${item.id}:${pdfPageNumber}`,
            sectionId: section.id,
            sectionTitle: section.title,
            itemId: item.id,
            material: item.material,
            pdfPageNumber,
          }))
        }),
    )
}
