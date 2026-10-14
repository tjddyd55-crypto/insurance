import './newsletterCollections.css'
import { useState } from 'react'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton } from '../../../../components/form'
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
}: {
  token: string | null | undefined
  collections: NewsletterCollectionsState
  view: NewsletterCollectionView
  onViewChange: (view: NewsletterCollectionView) => void
  totalCount: number
  onAddItems: () => void
  onNotice: (message: string) => void
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
      {confirmDialog}
    </div>
  )
}
