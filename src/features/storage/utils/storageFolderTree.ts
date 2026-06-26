import type { StorageFileRow, StorageFolderRow } from '../api/storageApi'

export const STORAGE_ROOT_FOLDER_LABEL = '루트'

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
  selectedFolderId: number | null,
): string[] {
  if (selectedFolderId == null) {
    return [STORAGE_ROOT_FOLDER_LABEL]
  }
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
  selectedFolderId: number | null,
): string {
  return buildStorageFolderBreadcrumb(folders, selectedFolderId).join(' > ')
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
  selectedFolderId: number | null,
): StorageFileRow[] {
  return files.filter((file) => (file.folderId ?? null) === selectedFolderId)
}

export function storageExplorerFolderSessionKey(customerId: number): string {
  return `storage-explorer-folder:${customerId}`
}

export function resolveFolderIdAtBreadcrumbIndex(
  folders: StorageFolderRow[],
  selectedFolderId: number | null,
  breadcrumbIndex: number,
): number | null {
  if (breadcrumbIndex <= 0) {
    return null
  }
  if (selectedFolderId == null) {
    return null
  }
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
  return chain[folderIndex] ?? selectedFolderId
}

export function readStoredExplorerFolderId(customerId: number): number | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  const raw = sessionStorage.getItem(storageExplorerFolderSessionKey(customerId))
  if (!raw || raw === 'root') {
    return null
  }
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function writeStoredExplorerFolderId(customerId: number, folderId: number | null): void {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.setItem(
    storageExplorerFolderSessionKey(customerId),
    folderId == null ? 'root' : String(folderId),
  )
}
