import './newsletterCollections.css'
import { useState, type ReactNode } from 'react'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton, FormSelect } from '../../../../components/form'
import {
  createNewsletterFolder,
  deleteNewsletterFolder,
  renameNewsletterFolder,
} from '../../services/newsletterCollections.service'
import { NewsletterFolderNameDialog } from './NewsletterFolderNameDialog'
import type { NewsletterCollectionsState } from './useNewsletterCollections'

export type NewsletterCollectionView = { kind: 'all' } | { kind: 'favorites' } | { kind: 'folder'; folderId: string }

/** 목록 상단: 전체 소식지 / 즐겨찾기 / 내 폴더(개수) / 새 폴더 — 폴더 선택 시 이름 변경·삭제·소식지 추가. */
export function NewsletterCollectionsNav({
  token,
  collections,
  view,
  onViewChange,
  totalCount,
  onAddItems,
  onNotice,
  layout = 'stacked',
  search,
}: {
  token: string | null | undefined
  collections: NewsletterCollectionsState
  view: NewsletterCollectionView
  onViewChange: (view: NewsletterCollectionView) => void
  totalCount: number
  onAddItems: () => void
  onNotice: (message: string) => void
  /** 'pc-row': PC 한 줄 툴바 [전체][★][내 폴더▾][+ 새 폴더][검색]. 'stacked': 기존(모바일). */
  layout?: 'stacked' | 'pc-row'
  /** pc-row 에서 맨 오른쪽에 들어갈 검색 입력 */
  search?: ReactNode
}) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [nameDialog, setNameDialog] = useState<null | { mode: 'create' } | { mode: 'rename'; folderId: string; name: string }>(null)
  const { folders, favoriteNewsletterIds } = collections.data
  const activeFolder = view.kind === 'folder' ? folders.find((f) => f.id === view.folderId) ?? null : null

  const removeFolder = async () => {
    if (!activeFolder) return
    const ok = await confirm({
      title: '폴더 삭제',
      message: `'${activeFolder.name}' 폴더를 삭제할까요?\n폴더와 담긴 연결만 지워지고 소식지 원본은 그대로 남습니다.`,
      tone: 'danger',
      confirmLabel: '삭제',
      cancelLabel: '취소',
    })
    if (!ok) return
    try {
      await deleteNewsletterFolder(token, activeFolder.id)
      onViewChange({ kind: 'all' })
      onNotice(`'${activeFolder.name}' 폴더를 삭제했습니다.`)
      await collections.refresh()
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '폴더를 삭제하지 못했습니다.')
    }
  }

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <FormButton
      key={key}
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </FormButton>
  )

  const nameDialogNode = (
    <NewsletterFolderNameDialog
      open={nameDialog != null}
      title={nameDialog?.mode === 'rename' ? '폴더 이름 변경' : '새 폴더'}
      initialName={nameDialog?.mode === 'rename' ? nameDialog.name : ''}
      confirmLabel={nameDialog?.mode === 'rename' ? '변경' : '만들기'}
      onClose={() => setNameDialog(null)}
      onSubmit={async (name) => {
        if (nameDialog?.mode === 'rename') {
          await renameNewsletterFolder(token, nameDialog.folderId, name)
          onNotice('폴더 이름을 변경했습니다.')
        } else {
          const created = await createNewsletterFolder(token, name)
          onNotice(`'${created.name}' 폴더를 만들었습니다.`)
          onViewChange({ kind: 'folder', folderId: created.id })
        }
        await collections.refresh()
      }}
    />
  )

  if (layout === 'pc-row') {
    const folderOptions = [
      { value: '', label: folders.length ? `내 폴더 (${folders.length})` : '내 폴더 없음' },
      ...folders.map((folder) => ({ value: folder.id, label: `📁 ${folder.name} (${folder.count})` })),
    ]
    return (
      <>
        <div className="newsletter-collections-toolbar" aria-label="소식지 분류">
          {chip(view.kind === 'all', `전체 소식지 ${totalCount}`, () => onViewChange({ kind: 'all' }), 'all')}
          {chip(
            view.kind === 'favorites',
            `★ 즐겨찾기 ${favoriteNewsletterIds.length}`,
            () => onViewChange({ kind: 'favorites' }),
            'fav',
          )}
          <div className="newsletter-collections-toolbar__folders">
            <FormSelect
              value={activeFolder?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value
                if (id) onViewChange({ kind: 'folder', folderId: id })
              }}
              options={folderOptions}
              disabled={folders.length === 0}
              aria-label="내 폴더"
            />
          </div>
          <FormButton variant="action" size="sm" onClick={() => setNameDialog({ mode: 'create' })}>＋ 새 폴더</FormButton>
          {search ? <div className="newsletter-collections-toolbar__search">{search}</div> : null}
        </div>
        {activeFolder ? (
          <div className="newsletter-collections-toolbar__folder-bar">
            <span className="newsletter-collections-toolbar__folder-name">📁 {activeFolder.name} · {activeFolder.count}개</span>
            <FormButton variant="primary" size="sm" onClick={onAddItems}>소식지 추가</FormButton>
            <FormButton
              variant="secondary"
              size="sm"
              onClick={() => setNameDialog({ mode: 'rename', folderId: activeFolder.id, name: activeFolder.name })}
            >
              이름 변경
            </FormButton>
            <FormButton variant="secondary" size="sm" onClick={() => void removeFolder()}>폴더 삭제</FormButton>
          </div>
        ) : null}
        {nameDialogNode}
        {confirmDialog}
      </>
    )
  }

  return (
    <div className="newsletter-collections-nav" aria-label="소식지 분류">
      <div className="newsletter-collections-nav__chips">
        {chip(view.kind === 'all', `전체 소식지 ${totalCount}`, () => onViewChange({ kind: 'all' }), 'all')}
        {chip(
          view.kind === 'favorites',
          `★ 즐겨찾기 ${favoriteNewsletterIds.length}`,
          () => onViewChange({ kind: 'favorites' }),
          'fav',
        )}
        {folders.length > 0 ? <span className="newsletter-collections-nav__label">내 폴더</span> : null}
        {folders.map((folder) =>
          chip(
            view.kind === 'folder' && view.folderId === folder.id,
            `${folder.name} ${folder.count}`,
            () => onViewChange({ kind: 'folder', folderId: folder.id }),
            `f-${folder.id}`,
          ),
        )}
        <FormButton variant="action" size="sm" onClick={() => setNameDialog({ mode: 'create' })}>+ 새 폴더</FormButton>
      </div>
      {activeFolder ? (
        <div className="newsletter-collections-nav__folder-actions">
          <FormButton variant="primary" size="sm" onClick={onAddItems}>소식지 추가</FormButton>
          <FormButton
            variant="secondary"
            size="sm"
            onClick={() => setNameDialog({ mode: 'rename', folderId: activeFolder.id, name: activeFolder.name })}
          >
            이름 변경
          </FormButton>
          <FormButton variant="secondary" size="sm" onClick={() => void removeFolder()}>폴더 삭제</FormButton>
        </div>
      ) : null}
      {nameDialogNode}
      {confirmDialog}
    </div>
  )
}
