import type { PersonalBinder } from '../personalBinder.types'
import type { SharedPersonalBinderDetail } from '../personalBinderShare.api'

export function mapSharedDetailToPersonalBinder(detail: SharedPersonalBinderDetail): PersonalBinder {
  const binderKey = `shared:${detail.id}`
  return {
    id: binderKey,
    title: detail.title,
    description: detail.description,
    createdAt: detail.createdAt,
    updatedAt: detail.createdAt,
    sections: detail.sections.map((section) => ({
      id: section.id,
      binderId: binderKey,
      title: section.title,
      sortOrder: section.sortOrder,
      items: section.items.map((item) => ({
        id: item.id,
        sectionId: section.id,
        materialId: `share-file:${item.shareFileId}`,
        sortOrder: item.sortOrder,
        pageSelection: item.pageSelection,
        material: {
          id: `share-file:${item.shareFileId}`,
          fileId: 0,
          title: item.material.title,
          originalFileName: item.material.originalFileName,
          mimeType: item.material.mimeType,
          fileSize: item.material.fileSize,
          pageCount: item.material.pageCount,
          sourceType: 'personal',
          sourceRef: item.shareFileId,
        },
      })),
    })),
  }
}

export function resolveSharedBinderShareFileId(material: {
  sourceRef?: string | null
  id: string
}): string {
  const fromRef = String(material.sourceRef ?? '').trim()
  if (fromRef) return fromRef
  return material.id.replace(/^share-file:/, '')
}
