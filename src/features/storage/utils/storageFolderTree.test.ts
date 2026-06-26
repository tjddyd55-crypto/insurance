import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStorageFolderBreadcrumb,
  buildStorageFolderForest,
  buildStorageFolderPathLabel,
  countDirectChildFolders,
  countDirectFilesInFolder,
  filterFilesForExplorerFolder,
  getStorageAncestorFolderIds,
  getStorageExplorerUploadFolderId,
  readStoredExplorerSelection,
  resolveExplorerSelectionAtBreadcrumbIndex,
  resolveStorageFileFolderLabel,
  writeStoredExplorerSelection,
} from './storageFolderTree.ts'

test('buildStorageFolderForest — parent/child 계층', () => {
  const forest = buildStorageFolderForest([
    { id: 1, name: '보험청구', parentId: null, createdAt: '' },
    { id: 2, name: '진단서', parentId: 1, createdAt: '' },
    { id: 3, name: '기타', parentId: null, createdAt: '' },
  ])
  assert.equal(forest.length, 2)
  const claimNode = forest.find((node) => node.folder.id === 1)
  assert.ok(claimNode)
  assert.equal(claimNode?.children[0]?.folder.id, 2)
})

test('breadcrumb · ancestor · folder-scoped files', () => {
  const folders = [
    { id: 1, name: '보험청구', parentId: null, createdAt: '' },
    { id: 2, name: '진단서', parentId: 1, createdAt: '' },
  ]
  const folderSelection = { mode: 'folder' as const, folderId: 2 }
  assert.deepEqual(buildStorageFolderBreadcrumb(folders, folderSelection), ['전체', '보험청구', '진단서'])
  assert.equal(buildStorageFolderPathLabel(folders, folderSelection), '전체 > 보험청구 > 진단서')
  assert.deepEqual(getStorageAncestorFolderIds(folders, 2), [1])
  assert.equal(countDirectChildFolders(folders, 1), 1)
  const files = [
    { id: 10, folderId: null },
    { id: 11, folderId: 1 },
    { id: 12, folderId: 2 },
  ] as Parameters<typeof countDirectFilesInFolder>[0]
  assert.equal(countDirectFilesInFolder(files, 1), 1)
  assert.equal(filterFilesForExplorerFolder(files, { mode: 'all' }).length, 3)
  assert.equal(filterFilesForExplorerFolder(files, { mode: 'folder', folderId: 1 }).length, 1)
  assert.equal(filterFilesForExplorerFolder(files, { mode: 'folder', folderId: 2 }).length, 1)
})

test('all view shows every file; upload target stays root', () => {
  const files = [
    { id: 1, folderId: null },
    { id: 2, folderId: 10 },
    { id: 3, folderId: 20 },
  ] as Parameters<typeof filterFilesForExplorerFolder>[0]
  assert.deepEqual(
    filterFilesForExplorerFolder(files, { mode: 'all' }).map((file) => file.id),
    [1, 2, 3],
  )
  assert.equal(getStorageExplorerUploadFolderId({ mode: 'all' }), null)
  assert.equal(getStorageExplorerUploadFolderId({ mode: 'folder', folderId: 10 }), 10)
})

test('resolveStorageFileFolderLabel and breadcrumb all selection', () => {
  const folders = [
    { id: 1, name: '가입제안서', parentId: null, createdAt: '' },
    { id: 2, name: '기본정보', parentId: null, createdAt: '' },
  ]
  assert.equal(
    resolveStorageFileFolderLabel(folders, { id: 1, folderId: 1 } as Parameters<typeof resolveStorageFileFolderLabel>[1]),
    '가입제안서',
  )
  assert.equal(
    resolveStorageFileFolderLabel(folders, { id: 2, folderId: null } as Parameters<typeof resolveStorageFileFolderLabel>[1]),
    '최상위',
  )
  assert.deepEqual(buildStorageFolderBreadcrumb(folders, { mode: 'all' }), ['전체'])
  assert.deepEqual(
    resolveExplorerSelectionAtBreadcrumbIndex(folders, { mode: 'folder', folderId: 2 }, 0),
    { mode: 'all' },
  )
})

test('session storage uses all vs folder id', () => {
  const store = new Map<string, string>()
  const original = globalThis.sessionStorage
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  })
  try {
    const key = 999001
    writeStoredExplorerSelection(key, { mode: 'folder', folderId: 42 })
    assert.deepEqual(readStoredExplorerSelection(key), { mode: 'folder', folderId: 42 })
    writeStoredExplorerSelection(key, { mode: 'all' })
    assert.deepEqual(readStoredExplorerSelection(key), { mode: 'all' })
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: original,
    })
  }
})
