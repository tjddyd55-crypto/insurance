import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { StatusMessage } from '../../../components/feedback'
import StorageWorkspace from '../../storage/components/StorageWorkspace'
import { type StorageFileRow } from '../../storage/api/storageApi'
import { fetchTeamFiles, type TeamFileRow } from '../../team/api/teamApi'
import {
  createPersonalBinderMaterialFromFile,
  createPersonalBinderMaterialFromTeam,
} from '../personalBinder.api'
import type { PersonalBinderMaterial } from '../personalBinder.types'
import { NewsletterBinderSourcePanel } from './NewsletterBinderSourcePanel'
import GoogleDriveImportButton from '../../google-drive/GoogleDriveImportButton'
import { fetchGoogleDrivePicker } from '../../google-drive/googleDriveApi'

type SourceTab = 'storage' | 'team' | 'newsletter' | 'drive'

function isBinderCompatibleFile(mimeType: string, fileName: string): boolean {
  const mime = String(mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (mime === 'application/pdf' || mime === 'image/jpeg' || mime === 'image/png') return true
  const lower = String(fileName ?? '').toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png')
  )
}

export function MaterialAddSourceDialog({
  open,
  token,
  folderId = null,
  mode,
  onClose,
  onMaterialReady,
  onUploaded,
  targetSectionId = null,
  targetSectionTitle = '',
  onNewslettersImported,
}: {
  open: boolean
  token: string | null
  materials?: PersonalBinderMaterial[]
  folderId?: string | null
  mode: 'library' | 'binder'
  onClose: () => void
  onMaterialReady?: (material: PersonalBinderMaterial) => void
  onUploaded?: (material: PersonalBinderMaterial) => void
  /** 바인더 섹션에 추가할 때만: 소식지 출처 탭을 노출한다. */
  targetSectionId?: string | null
  targetSectionTitle?: string
  onNewslettersImported?: (message: string) => void
}) {
  const [tab, setTab] = useState<SourceTab>('storage')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'pdf' | 'image'>('all')
  const [teamFiles, setTeamFiles] = useState<TeamFileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [storageLinkError, setStorageLinkError] = useState('')
  const [linkingId, setLinkingId] = useState('')
  // t307 PR-B: 4번째 출처 Google Drive (GOOGLE_DRIVE_ENABLED + 연결된 계정일 때만 탭 노출)
  const [driveAvailable, setDriveAvailable] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [newsletterSelectedCount, setNewsletterSelectedCount] = useState(0)
  const [newsletterBusy, setNewsletterBusy] = useState(false)
  const newsletterSubmitRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!open || !token?.trim()) return
    let cancelled = false
    void fetchGoogleDrivePicker(token)
      .then((state) => { if (!cancelled) setDriveAvailable(state.enabled && state.connected) })
      .catch(() => { if (!cancelled) setDriveAvailable(false) })
    return () => { cancelled = true }
  }, [open, token])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      setTab('storage')
      setQuery('')
      setFilter('all')
      setTeamError('')
      setStorageLinkError('')
      setLinkingId('')
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open || !token?.trim() || tab !== 'team') return
    let cancelled = false
    setLoading(true)
    setTeamError('')
    void (async () => {
      try {
        const result = await fetchTeamFiles(token)
        if (!cancelled) setTeamFiles(result.files)
      } catch (reason) {
        if (!cancelled) {
          setTeamError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tab, token])

  const teamFileRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teamFiles.filter((file) => {
      if (!isBinderCompatibleFile('', file.fileName)) return false
      if (filter === 'pdf' && !file.fileName.toLowerCase().endsWith('.pdf')) return false
      if (filter === 'image' && !/\.(jpe?g|png)$/i.test(file.fileName)) return false
      if (!q) return true
      return (
        file.fileName.toLowerCase().includes(q) ||
        file.postTitle.toLowerCase().includes(q)
      )
    })
  }, [filter, query, teamFiles])

  const finish = useCallback(
    (material: PersonalBinderMaterial) => {
      if (mode === 'binder' && onMaterialReady) {
        onMaterialReady(material)
      } else {
        onUploaded?.(material)
      }
      onClose()
    },
    [mode, onClose, onMaterialReady, onUploaded],
  )

  const linkStorageFile = useCallback(
    async (file: StorageFileRow) => {
      if (!token?.trim() || linkingId) return
      const title = String(file.displayName ?? file.originalName ?? '자료').replace(/\.[^.]+$/, '')
      setLinkingId(String(file.id))
      setStorageLinkError('')
      try {
        const material = await createPersonalBinderMaterialFromFile(token, {
          fileId: file.id,
          title,
          folderId,
        })
        finish(material)
      } catch (reason) {
        setStorageLinkError(reason instanceof Error ? reason.message : '자료를 연결하지 못했습니다.')
      } finally {
        setLinkingId('')
      }
    },
    [finish, folderId, linkingId, token],
  )

  const linkTeamFile = async (file: TeamFileRow) => {
    if (!token?.trim() || linkingId) return
    const title = file.fileName.replace(/\.[^.]+$/, '') || file.fileName
    setLinkingId(file.id)
    setTeamError('')
    try {
      const material = await createPersonalBinderMaterialFromTeam(token, {
        teamAttachmentId: file.id,
        title,
        folderId,
      })
      finish(material)
    } catch (reason) {
      setTeamError(reason instanceof Error ? reason.message : '팀 자료를 연결하지 못했습니다.')
    } finally {
      setLinkingId('')
    }
  }

  if (!open) return null

  const showNewsletterTab = mode === 'binder' && targetSectionId != null && onNewslettersImported != null
  const tabs: { id: SourceTab; label: string }[] = [
    { id: 'storage', label: '내 저장 공간' },
    { id: 'team', label: '팀 자료실' },
    ...(showNewsletterTab ? [{ id: 'newsletter' as const, label: '소식지' }] : []),
    ...(driveAvailable ? [{ id: 'drive' as const, label: 'Google Drive' }] : []),
  ]

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      usePortal
      panelPreset="largeForm"
      panelClassName="personal-binder-material-picker-dialog personal-binder-material-picker-dialog--storage"
      ariaLabel="자료 추가"
    >
      <div className="personal-binder-material-add-modal__shell">
        <header className="personal-binder-page-dialog__header">
          <div className="personal-binder-page-dialog__header-copy">
            <h2>자료 추가</h2>
            <p>내 저장 공간의 파일을 선택하거나 팀 자료실에서 가져옵니다.</p>
          </div>
          <FormButton variant="secondary" size="sm" onClick={onClose}>닫기</FormButton>
        </header>

        <nav className="personal-binder-source-tabs" aria-label="자료 출처">
          {tabs.map((entry) => (
            <FormButton
              key={entry.id}
              variant={tab === entry.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setTab(entry.id)
                if (entry.id === 'storage') {
                  setTeamError('')
                } else {
                  setStorageLinkError('')
                }
                if (entry.id === 'newsletter') {
                  setTeamError('')
                }
              }}
            >
              {entry.label}
            </FormButton>
          ))}
        </nav>

        {tab === 'team' && teamError ? (
          <StatusMessage message={teamError} tone="error" className="m-0 personal-binder-material-add-modal__inset" />
        ) : null}
        {tab === 'storage' && storageLinkError ? (
          <StatusMessage
            message={storageLinkError}
            tone="error"
            className="m-0 personal-binder-material-add-modal__inset"
          />
        ) : null}

        {tab === 'storage' ? (
          <div className="personal-binder-storage-embed personal-binder-material-picker__stage">
            <StorageWorkspace
              token={token}
              customerId={null}
              title="내 저장 공간"
              variant="pc"
              layout="explorer"
              embedMode
              binderPickMode
              binderPickBusyFileId={linkingId ? Number(linkingId) : null}
              onAddFileToBinder={(file) => void linkStorageFile(file)}
            />
          </div>
        ) : null}

        {tab === 'newsletter' && showNewsletterTab && targetSectionId ? (
          <div className="personal-binder-material-picker__stage">
            <NewsletterBinderSourcePanel
              sectionId={targetSectionId}
              sectionTitle={targetSectionTitle}
              hideFooter
              submitActionRef={newsletterSubmitRef}
              onSelectedCountChange={setNewsletterSelectedCount}
              onBusyChange={setNewsletterBusy}
              onImported={(message) => {
                onNewslettersImported?.(message)
                onClose()
              }}
            />
          </div>
        ) : null}

        {tab === 'drive' ? (
          <div className="personal-binder-material-add-modal__inset personal-binder-material-picker__drive">
            <p>Google Drive 에서 PDF·JPG·PNG 를 골라 내 저장 공간에 복사한 뒤 자료로 추가합니다. Drive 원본은 바뀌지 않습니다.</p>
            {driveError ? <StatusMessage message={driveError} tone="error" className="m-0" /> : null}
            <GoogleDriveImportButton
              token={token}
              multiple={false}
              onError={setDriveError}
              onImported={(files) => {
                const file = files[0]
                if (file) void linkStorageFile(file)
              }}
            />
          </div>
        ) : null}
        {tab === 'team' ? (
          <>
            <div className="personal-binder-material-add-modal__controls">
              <div className="personal-binder-source-filters">
                <FormInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="파일명 검색"
                  aria-label="파일명 검색"
                />
                <div className="personal-binder-source-filters__types">
                  <FormButton variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>전체</FormButton>
                  <FormButton variant={filter === 'pdf' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('pdf')}>PDF</FormButton>
                  <FormButton variant={filter === 'image' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('image')}>이미지</FormButton>
                </div>
              </div>
            </div>
            <div
              className={[
                'personal-binder-material-picker__body',
                !loading && teamFileRows.length === 0
                  ? 'personal-binder-material-picker__body--empty-center'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {loading ? (
                <p className="personal-binder-material-picker__empty">팀 자료를 불러오는 중…</p>
              ) : teamFileRows.length === 0 ? (
                <p className="personal-binder-material-picker__empty">연결할 팀 자료가 없습니다.</p>
              ) : (
                <ul className="personal-binder-material-picker__list">
                  {teamFileRows.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className="personal-binder-material-picker__row"
                        disabled={linkingId === file.id}
                        onClick={() => void linkTeamFile(file)}
                      >
                        <span className="personal-binder-material-picker__row-title">{file.fileName}</span>
                        <span className="personal-binder-material-picker__row-meta">{file.postTitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
        <footer className="personal-binder-material-picker__footer">
          <span className="personal-binder-material-picker__footer-count">
            {tab === 'newsletter' ? newsletterSelectedCount : 0}개 선택
          </span>
          <FormButton variant="secondary" onClick={onClose}>취소</FormButton>
          <FormButton
            variant="primary"
            disabled={tab !== 'newsletter' || newsletterSelectedCount === 0 || newsletterBusy}
            loading={tab === 'newsletter' && newsletterBusy}
            onClick={() => newsletterSubmitRef.current?.()}
          >
            선택한 자료 {tab === 'newsletter' ? newsletterSelectedCount : 0}개 추가
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
