import type { PersonalBinderFolder } from '../personalBinder.types'

/** 시스템 폴더 선택: 전체 / 미분류(null folder_id) / 사용자 폴더 id */
export type PersonalBinderFolderSelection = 'all' | 'uncategorized' | string

export function filterItemsByFolderSelection<
  T extends { folderId?: string | null },
>(items: T[], selection: PersonalBinderFolderSelection): T[] {
  if (selection === 'all') {
    return items
  }
  if (selection === 'uncategorized') {
    return items.filter((item) => !item.folderId)
  }
  return items.filter((item) => item.folderId === selection)
}

export function countItemsInFolderSelection<
  T extends { folderId?: string | null },
>(items: T[], selection: PersonalBinderFolderSelection): number {
  return filterItemsByFolderSelection(items, selection).length
}

export function countItemsForUserFolder<
  T extends { folderId?: string | null },
>(items: T[], folderId: string): number {
  return items.filter((item) => item.folderId === folderId).length
}

export function folderSelectionLabel(
  selection: PersonalBinderFolderSelection,
  folders: PersonalBinderFolder[],
  allLabel: string,
): string {
  if (selection === 'all') {
    return allLabel
  }
  if (selection === 'uncategorized') {
    return '미분류'
  }
  return folders.find((folder) => folder.id === selection)?.name ?? allLabel
}

export function folderIdForUpload(
  selection: PersonalBinderFolderSelection,
): string | null | undefined {
  if (selection === 'all' || selection === 'uncategorized') {
    return null
  }
  return selection
}

export function folderIdForBinderCreate(
  selection: PersonalBinderFolderSelection,
): string | undefined {
  if (selection === 'all' || selection === 'uncategorized') {
    return undefined
  }
  return selection
}
