import { resolveItemPages } from './exportPersonalBinderPdf.js'

function viewerPage(section, item, pdfPageNumber, index) {
  const mimeType = String(item.material?.mimeType ?? 'application/pdf')
  return {
    index,
    sectionId: String(section.id),
    sectionTitle: section.title,
    itemId: String(item.id),
    materialId: String(item.materialId),
    fileId: Number(item.material?.fileId) || 0,
    mimeType,
    kind: mimeType.toLowerCase().startsWith('image/') ? 'image' : 'pdf',
    pdfPageNumber,
  }
}

function appendSectionPages(pages, section) {
  const items = [...(section.items ?? [])].sort(
    (left, right) => Number(left.sortOrder) - Number(right.sortOrder),
  )
  for (const item of items) {
    const selected = resolveItemPages(item.pageSelection, Number(item.material?.pageCount))
    for (const pdfPageNumber of selected) {
      pages.push(viewerPage(section, item, pdfPageNumber, pages.length + 1))
    }
  }
}

/**
 * 웹 뷰어와 같은 순서: 섹션 sortOrder → 아이템 sortOrder → pageSelection.
 * index 는 1부터다. pdfPageNumber 는 원본 자료 페이지다.
 */
export function listBinderViewerPages(detail) {
  const sections = [...(detail?.sections ?? [])].sort(
    (left, right) => Number(left.sortOrder) - Number(right.sortOrder),
  )
  const pages = []
  for (const section of sections) appendSectionPages(pages, section)
  return pages
}
