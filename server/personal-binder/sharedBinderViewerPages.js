import { listBinderViewerPages } from './binderViewerPages.js'
import { classifyBinderSource } from './renderBinderPageImage.js'

/**
 * 공유 바인더 상세(loadSharedBinderDetail 결과)를 개인 바인더 뷰어와 같은 순서·같은 필드로 펼친다.
 * 순서 규칙은 listBinderViewerPages 하나만 쓴다(섹션 → 아이템 → pageSelection).
 * materialId·fileId 자리에는 공유 파일 id(shareFileId)가 들어간다.
 */
export function listSharedBinderViewerPages(shareDetail) {
  const detail = {
    sections: (shareDetail?.sections ?? []).map((section) => ({
      id: section.id,
      title: section.title,
      sortOrder: section.sortOrder,
      items: (section.items ?? []).map((item) => {
        const mimeType = String(item.material?.mimeType ?? 'application/pdf')
        const storedCount = Number(item.material?.pageCount) || 0
        return {
          id: item.id,
          sortOrder: item.sortOrder,
          pageSelection: item.pageSelection,
          materialId: item.shareFileId,
          material: {
            mimeType,
            fileId: Number(item.shareFileId),
            pageCount: classifyBinderSource(mimeType) === 'image' ? Math.max(storedCount, 1) : storedCount,
          },
        }
      }),
    })),
  }
  return listBinderViewerPages(detail).map((page) => ({ ...page, shareFileId: page.materialId }))
}
