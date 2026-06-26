import type { StorageFileRow, StorageFolderRow } from '../api/storageApi'

export const STORAGE_ROOT_FOLDER_LABEL = '전체'

/** 탐색기 좌측 `전체` = 모든 폴더 파일. `folder` = 해당 폴더 직속 파일만. */
export type StorageExplorerSelection =
  | { mode: 'all' }
  | { mode: 'folder'; folderId: number }

export function isStorageExplorerAllView(selection: StorageExplorerSelection): boolean {
  return selection.mode === 'all'
}

export function getStorageExplorerSelectedFolderId(selection: StorageExplorerSelection): number | null {
  return selection.mode === 'folder' ? selection.folderId : null
}

/** `전체` 보기에서 업로드·폴더 생성 시 최상위(parentId/folderId null) */
export function getStorageExplorerUploadFolderId(selection: StorageExplorerSelection): number | null {
  return selection.mode === 'folder' ? selection.folderId : null
}

export type StorageFolderTreeNode = {
  folder: StorageFolderRow
  children: StorageFolderTreeNode[]
}

export function buildStorageFolderForest(folders: StorageFolderRow[]): StorageFolderTreeNode[] {
  const byId = new Map<number, StorageFolderTreeNode>()
  for (const folder of folders) {
    byId.set(folder.id, { folder, children: [] })
  }
  const roots: StorageFolderTreeNode[] = []
  for (const folder of folders) {
    const node = byId.get(folder.id)
    if (!node) {
      continue
    }
    const parentId = folder.parentId ?? null
    if (parentId != null && byId.has(parentId)) {
      byId.get(parentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNodes = (nodes: StorageFolderTreeNode[]) => {
    nodes.sort((a, b) => a.folder.name.localeCompare(b.folder.name, 'ko'))
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }
  sortNodes(roots)
  return roots
}

export function findStorageFolderById(
  folders: StorageFolderRow[],
  folderId: number | null,
): StorageFolderRow | null {
  if (folderId == null) {
    return null
  }
  return folders.find((folder) => folder.id === folderId) ?? null
}

export function buildStorageFolderBreadcrumb(
  folders: StorageFolderRow[],
  selection: StorageExplorerSelection,
): string[] {
  if (selection.mode === 'all') {
    return [STORAGE_ROOT_FOLDER_LABEL]
  }
  const selectedFolderId = selection.folderId
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const segments: string[] = []
  let currentId: number | null = selectedFolderId
  const guard = new Set<number>()
  while (currentId != null && !guard.has(currentId)) {
    guard.add(currentId)
    const folder = byId.get(currentId)
    if (!folder) {
      break
    }
    segments.unshift(folder.name)
    currentId = folder.parentId ?? null
  }
  return [STORAGE_ROOT_FOLDER_LABEL, ...segments]
}

export function buildStorageFolderPathLabel(
  folders: StorageFolderRow[],
  selection: StorageExplorerSelection,
): string {
  return buildStorageFolderBreadcrumb(folders, selection).join(' > ')
}

export function getStorageAncestorFolderIds(
  folders: StorageFolderRow[],
  folderId: number | null,
): number[] {
  if (folderId == null) {
    return []
  }
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const ancestors: number[] = []
  let currentId: number | null = folderId
  const guard = new Set<number>()
  while (currentId != null && !guard.has(currentId)) {
    guard.add(currentId)
    const folder = byId.get(currentId)
    if (!folder) {
      break
    }
    const parentId = folder.parentId ?? null
    if (parentId != null) {
      ancestors.unshift(parentId)
    }
    currentId = parentId
  }
  return ancestors
}

export function countDirectFilesInFolder(
  files: StorageFileRow[],
  folderId: number | null,
): number {
  return files.filter((file) => (file.folderId ?? null) === folderId).length
}

export function countDirectChildFolders(
  folders: StorageFolderRow[],
  parentFolderId: number | null,
): number {
  return folders.filter((folder) => (folder.parentId ?? null) === parentFolderId).length
}

export function filterFilesForExplorerFolder(
  files: StorageFileRow[],
  selection: StorageExplorerSelection,
): StorageFileRow[] {
  if (selection.mode === 'all') {
    return files
  }
  return files.filter((file) => (file.folderId ?? null) === selection.folderId)
}

export function resolveStorageFileFolderLabel(
  folders: StorageFolderRow[],
  file: StorageFileRow,
): string {
  const folderId = file.folderId ?? null
  if (folderId == null) {
    return '최상위'
  }
  return findStorageFolderById(folders, folderId)?.name ?? '폴더'
}

export function storageExplorerFolderSessionKey(customerId: number): string {
  return `storage-explorer-folder:${customerId}`
}

export function resolveExplorerSelectionAtBreadcrumbIndex(
  folders: StorageFolderRow[],
  selection: StorageExplorerSelection,
  breadcrumbIndex: number,
): StorageExplorerSelection {
  if (breadcrumbIndex <= 0) {
    return { mode: 'all' }
  }
  if (selection.mode !== 'folder') {
    return { mode: 'all' }
  }
  const selectedFolderId = selection.folderId
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const chain: number[] = []
  let currentId: number | null = selectedFolderId
  const guard = new Set<number>()
  while (currentId != null && !guard.has(currentId)) {
    guard.add(currentId)
    chain.unshift(currentId)
    currentId = byId.get(currentId)?.parentId ?? null
  }
  const folderIndex = breadcrumbIndex - 1
  const folderId = chain[folderIndex] ?? selectedFolderId
  return { mode: 'folder', folderId }
}

/** @deprecated {@link resolveExplorerSelectionAtBreadcrumbIndex} */
export function resolveFolderIdAtBreadcrumbIndex(
  folders: StorageFolderRow[],
  selectedFolderId: number | null,
  breadcrumbIndex: number,
): number | null {
  const selection: StorageExplorerSelection =
    selectedFolderId == null ? { mode: 'all' } : { mode: 'folder', folderId: selectedFolderId }
  const next = resolveExplorerSelectionAtBreadcrumbIndex(folders, selection, breadcrumbIndex)
  return getStorageExplorerSelectedFolderId(next)
}

export function readStoredExplorerSelection(customerId: number): StorageExplorerSelection {
  if (typeof sessionStorage === 'undefined') {
    return { mode: 'all' }
  }
  const raw = sessionStorage.getItem(storageExplorerFolderSessionKey(customerId))
  if (!raw || raw === 'root' || raw === 'all') {
    return { mode: 'all' }
  }
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? { mode: 'folder', folderId: id } : { mode: 'all' }
}

export function writeStoredExplorerSelection(customerId: number, selection: StorageExplorerSelection): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.setItem(
    storageExplorerFolderSessionKey(customerId),
    selection.mode === 'all' ? 'all' : String(selection.folderId),
  )
}

/** @deprecated {@link readStoredExplorerSelection} */
export function readStoredExplorerFolderId(customerId: number): number | null {
  return getStorageExplorerSelectedFolderId(readStoredExplorerSelection(customerId))
}

/** @deprecated {@link writeStoredExplorerSelection} */
export function writeStoredExplorerFolderId(customerId: number, folderId: number | null): void {
  writeStoredExplorerSelection(
    customerId,
    folderId == null ? { mode: 'all' } : { mode: 'folder', folderId },
  )
}
