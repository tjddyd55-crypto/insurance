import type { MouseEvent } from 'react'
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

type FolderTreeItemProps = {
  depth?: number
  selected: boolean
  expanded?: boolean
  hasChildren?: boolean
  icon: string
  name: string
  title: string
  onSelect: () => void
  onToggleExpand?: () => void
  onRename?: () => void
  onDelete?: () => void
}

function FolderTreeIconButton({
  label,
  variant,
  onClick,
}: {
  label: string
  variant: 'rename' | 'delete'
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className={[
        'storage-folder-tree-item__icon-button',
        variant === 'delete' ? 'storage-folder-tree-item__icon-button--delete' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      onClick={onClick}
    >
      {variant === 'rename' ? '✎' : '⌫'}
    </button>
  )
}

function FolderTreeItem({
  depth = 0,
  selected,
  expanded,
  hasChildren = false,
  icon,
  name,
  title,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
}: FolderTreeItemProps) {
  return (
    <div
      className={[
        'storage-folder-tree-item',
        selected ? 'storage-folder-tree-item--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      {onToggleExpand ? (
        <button
          type="button"
          className="storage-folder-tree-item__expand"
          aria-label={expanded ? '폴더 접기' : '폴더 펼치기'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand()
          }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </button>
      ) : (
        <span className="storage-folder-tree-item__expand" aria-hidden="true">
          ▼
        </span>
      )}
      <button
        type="button"
        className="storage-folder-tree-item__select"
        title={title}
        onClick={onSelect}
      >
        <span className="storage-folder-tree-item__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="storage-folder-tree-item__name">{name}</span>
      </button>
      {onRename && onDelete ? (
        <div className="storage-folder-tree-item__actions">
          <FolderTreeIconButton
            label="폴더 이름 변경"
            variant="rename"
            onClick={(event) => {
              event.stopPropagation()
              onRename()
            }}
          />
          <FolderTreeIconButton
            label="폴더 삭제"
            variant="delete"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function renderFolderNode(
  node: StorageFolderTreeNode,
  depth: number,
  props: StorageFolderTreePanelProps,
): JSX.Element {
  const { folder, children } = node
  const { files, folders, selectedFolderId, expandedFolderIds, onSelectFolder, onToggleExpand, onRenameFolder, onDeleteFolder } =
    props
  const expanded = expandedFolderIds.has(folder.id)
  const fileCount = countDirectFilesInFolder(files, folder.id)
  const childFolderCount = countDirectChildFolders(folders, folder.id)

  return (
    <div key={folder.id} className="storage-explorer-tree__branch">
      <FolderTreeItem
        depth={depth}
        selected={selectedFolderId === folder.id}
        expanded={expanded}
        hasChildren={children.length > 0}
        icon="📁"
        name={folder.name}
        title={`${folder.name} · 파일 ${fileCount}개 · 하위 폴더 ${childFolderCount}개`}
        onSelect={() => onSelectFolder(folder.id)}
        onToggleExpand={() => onToggleExpand(folder.id)}
        onRename={() => onRenameFolder(folder)}
        onDelete={() => onDeleteFolder(folder)}
      />
      {expanded ? children.map((child) => renderFolderNode(child, depth + 1, props)) : null}
    </div>
  )
}

export default function StorageFolderTreePanel(props: StorageFolderTreePanelProps) {
  const { folders, files, selectedFolderId, onSelectFolder } = props
  const forest = buildStorageFolderForest(folders)
  const rootFileCount = countDirectFilesInFolder(files, null)
  const rootChildCount = countDirectChildFolders(folders, null)

  return (
    <aside className="storage-explorer-tree" aria-label="폴더 구조">
      <div className="storage-explorer-tree__header">폴더</div>
      <div className="storage-explorer-tree__body">
        <FolderTreeItem
          selected={selectedFolderId == null}
          icon="🏠"
          name={STORAGE_ROOT_FOLDER_LABEL}
          title={`${STORAGE_ROOT_FOLDER_LABEL} · 파일 ${rootFileCount}개 · 하위 폴더 ${rootChildCount}개`}
          onSelect={() => onSelectFolder(null)}
        />
        {forest.length === 0 ? (
          <p className="storage-explorer-tree__empty">하위 폴더 없음</p>
        ) : (
          forest.map((node) => renderFolderNode(node, 0, props))
        )}
      </div>
    </aside>
  )
}
