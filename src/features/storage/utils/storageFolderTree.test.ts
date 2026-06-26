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
  assert.deepEqual(buildStorageFolderBreadcrumb(folders, 2), ['전체', '보험청구', '진단서'])
  assert.equal(buildStorageFolderPathLabel(folders, 2), '전체 > 보험청구 > 진단서')
  assert.deepEqual(getStorageAncestorFolderIds(folders, 2), [1])
  assert.equal(countDirectChildFolders(folders, 1), 1)
  const files = [
    { id: 10, folderId: null },
    { id: 11, folderId: 1 },
    { id: 12, folderId: 2 },
  ] as Parameters<typeof countDirectFilesInFolder>[0]
  assert.equal(countDirectFilesInFolder(files, 1), 1)
  assert.equal(filterFilesForExplorerFolder(files, null).length, 1)
  assert.equal(filterFilesForExplorerFolder(files, 2).length, 1)
})
