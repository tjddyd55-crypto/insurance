import { FormButton } from '../../../components/form'
import type { StorageFileRow, StorageFolderRow } from '../api/storageApi'
import {
  STORAGE_ROOT_FOLDER_LABEL,
  buildStorageFolderForest,
  countDirectChildFolders,
  countDirectFilesInFolder,
  type StorageFolderTreeNode,
} from '../utils/storageFolderTree'

type StorageFolderTreePanelProps = {
  folders: StorageFolderRow[]
  files: StorageFileRow[]
  selectedFolderId: number | null
  expandedFolderIds: Set<number>
  onSelectFolder: (folderId: number | null) => void
  onToggleExpand: (folderId: number) => void
  onRenameFolder: (folder: StorageFolderRow) => void
  onDeleteFolder: (folder: StorageFolderRow) => void
}

function renderFolderNode(
  node: StorageFolderTreeNode,
  depth: number,
  props: StorageFolderTreePanelProps,
): JSX.Element {
  const { folder, children } = node
  const {
    files,
    folders,
    selectedFolderId,
    expandedFolderIds,
    onSelectFolder,
    onToggleExpand,
    onRenameFolder,
    onDeleteFolder,
  } = props
  const expanded = expandedFolderIds.has(folder.id)
  const selected = selectedFolderId === folder.id
  const fileCount = countDirectFilesInFolder(files, folder.id)
  const childFolderCount = countDirectChildFolders(folders, folder.id)

  return (
    <div key={folder.id} className="storage-explorer-tree__branch">
      <div
        className={[
          'storage-explorer-tree__row',
          selected ? 'storage-explorer-tree__row--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <button
          type="button"
          className="storage-explorer-tree__expand"
          aria-label={expanded ? '폴더 접기' : '폴더 펼치기'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand(folder.id)
          }}
        >
          {children.length > 0 ? (expanded ? '▼' : '▶') : '•'}
        </button>
        <button
          type="button"
          className="storage-explorer-tree__select"
          onClick={() => onSelectFolder(folder.id)}
        >
          <span className="storage-explorer-tree__icon" aria-hidden="true">
            📁
          </span>
          <span className="storage-explorer-tree__name">{folder.name}</span>
          <span className="storage-explorer-tree__meta">
            {fileCount}개 · 하위 {childFolderCount}
          </span>
        </button>
        <div className="storage-explorer-tree__actions">
          <FormButton
            htmlType="button"
            variant="action"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onRenameFolder(folder)
            }}
          >
            ✏️
          </FormButton>
          <FormButton
            htmlType="button"
            variant="action"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onDeleteFolder(folder)
            }}
          >
            🗑️
          </FormButton>
        </div>
      </div>
      {expanded
        ? children.map((child) => renderFolderNode(child, depth + 1, props))
        : null}
    </div>
  )
}

export default function StorageFolderTreePanel(props: StorageFolderTreePanelProps) {
  const { folders, files, selectedFolderId, onSelectFolder } = props
  const forest = buildStorageFolderForest(folders)
  const rootSelected = selectedFolderId == null
  const rootFileCount = countDirectFilesInFolder(files, null)
  const rootChildCount = countDirectChildFolders(folders, null)

  return (
    <aside className="storage-explorer-tree" aria-label="폴더 구조">
      <div className="storage-explorer-tree__header">폴더</div>
      <div className="storage-explorer-tree__body">
        <div
          className={[
            'storage-explorer-tree__row',
            'storage-explorer-tree__row--root',
            rootSelected ? 'storage-explorer-tree__row--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="storage-explorer-tree__expand" aria-hidden="true">
            ▼
          </span>
          <button
            type="button"
            className="storage-explorer-tree__select"
            onClick={() => onSelectFolder(null)}
          >
            <span className="storage-explorer-tree__icon" aria-hidden="true">
              🏠
            </span>
            <span className="storage-explorer-tree__name">{STORAGE_ROOT_FOLDER_LABEL}</span>
            <span className="storage-explorer-tree__meta">
              {rootFileCount}개 · 하위 {rootChildCount}
            </span>
          </button>
        </div>
        {forest.length === 0 ? (
          <p className="storage-explorer-tree__empty">하위 폴더 없음</p>
        ) : (
          forest.map((node) => renderFolderNode(node, 0, props))
        )}
      </div>
    </aside>
  )
}
