import { useEffect, useMemo, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { listStorageFiles, type StorageFileRow } from '../../storage/api/storageApi'
import { fetchTeamFiles, type TeamFileRow } from '../../team/api/teamApi'
import {
  createPersonalBinderMaterialFromFile,
  createPersonalBinderMaterialFromTeam,
} from '../personalBinder.api'
import type { PersonalBinderMaterial } from '../personalBinder.types'
import { MaterialUploadDialog } from './MaterialUploadDialog'

type SourceTab = 'library' | 'my-file' | 'team' | 'upload'

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

function isBinderMaterial(material: PersonalBinderMaterial): boolean {
  return isBinderCompatibleFile(material.mimeType, material.originalFileName)
}

export function MaterialAddSourceDialog({
  open,
  token,
  materials,
  folderId = null,
  mode,
  onClose,
  onMaterialReady,
  onUploaded,
}: {
  open: boolean
  token: string | null
  materials: PersonalBinderMaterial[]
  folderId?: string | null
  mode: 'library' | 'binder'
  onClose: () => void
  /** 바인더 편집: 자료 선택 후 페이지 선택으로 진행 */
  onMaterialReady?: (material: PersonalBinderMaterial) => void
  /** 자료 보관함: 목록에 추가 */
  onUploaded?: (material: PersonalBinderMaterial) => void
}) {
  const [tab, setTab] = useState<SourceTab>('library')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'pdf' | 'image'>('all')
  const [myFiles, setMyFiles] = useState<StorageFileRow[]>([])
  const [teamFiles, setTeamFiles] = useState<TeamFileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkingId, setLinkingId] = useState('')

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      setTab('library')
      setQuery('')
      setFilter('all')
      setError('')
      setLinkingId('')
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open || !token?.trim()) return
    if (tab !== 'my-file' && tab !== 'team') return
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        if (tab === 'my-file') {
          const rows = await listStorageFiles(token, { customerId: null })
          if (!cancelled) setMyFiles(rows)
        } else {
          const result = await fetchTeamFiles(token)
          if (!cancelled) setTeamFiles(result.files)
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tab, token])

  const libraryRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((material) => {
      if (!isBinderMaterial(material)) return false
      if (filter === 'pdf' && material.mimeType !== 'application/pdf') return false
      if (filter === 'image' && !material.mimeType.startsWith('image/')) return false
      if (!q) return true
      return (
        material.title.toLowerCase().includes(q) ||
        material.originalFileName.toLowerCase().includes(q)
      )
    })
  }, [filter, materials, query])

  const myFileRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return myFiles.filter((file) => {
      const mime = String(file.mimeType ?? '')
      if (!isBinderCompatibleFile(mime, file.displayName ?? file.originalName)) return false
      if (filter === 'pdf' && mime !== 'application/pdf') return false
      if (filter === 'image' && !mime.startsWith('image/')) return false
      const name = String(file.displayName ?? file.originalName ?? '')
      if (!q) return true
      return name.toLowerCase().includes(q)
    })
  }, [filter, myFiles, query])

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

  if (!open) return null

  const finish = (material: PersonalBinderMaterial) => {
    if (mode === 'binder' && onMaterialReady) {
      onMaterialReady(material)
    } else {
      onUploaded?.(material)
    }
    onClose()
  }

  const linkMyFile = async (file: StorageFileRow) => {
    if (!token?.trim() || linkingId) return
    const title = String(file.displayName ?? file.originalName ?? '자료').replace(/\.[^.]+$/, '')
    setLinkingId(String(file.id))
    setError('')
    try {
      const material = await createPersonalBinderMaterialFromFile(token, {
        fileId: file.id,
        title,
        folderId,
      })
      finish(material)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 연결하지 못했습니다.')
    } finally {
      setLinkingId('')
    }
  }

  const linkTeamFile = async (file: TeamFileRow) => {
    if (!token?.trim() || linkingId) return
    const title = file.fileName.replace(/\.[^.]+$/, '') || file.fileName
    setLinkingId(file.id)
    setError('')
    try {
      const material = await createPersonalBinderMaterialFromTeam(token, {
        teamAttachmentId: file.id,
        title,
        folderId,
      })
      finish(material)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '팀 자료를 연결하지 못했습니다.')
    } finally {
      setLinkingId('')
    }
  }

  const tabs: { id: SourceTab; label: string }[] = [
    { id: 'library', label: '내 자료 보관함' },
    { id: 'my-file', label: '내 파일' },
    { id: 'team', label: '팀 자료실' },
    { id: 'upload', label: '새 파일 업로드' },
  ]

  return (
    <>
      <BaseDialog
        open={open && !uploadOpen}
        onClose={onClose}
        closeOnBackdrop={false}
        usePortal
        panelPreset="largeForm"
        panelClassName="personal-binder-material-picker-dialog"
        ariaLabel="자료 추가"
      >
        <header className="personal-binder-page-dialog__header">
          <div className="personal-binder-page-dialog__header-copy">
            <h2>자료 추가</h2>
            <p>보관함, 내 파일, 팀 자료실 또는 새 업로드에서 자료를 고릅니다.</p>
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
                if (entry.id === 'upload') {
                  setUploadOpen(true)
                  return
                }
                setTab(entry.id)
              }}
            >
              {entry.label}
            </FormButton>
          ))}
        </nav>

        {tab !== 'upload' ? (
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
        ) : null}

        {error ? <p className="personal-binder-error">{error}</p> : null}

        <div className="personal-binder-material-picker__body">
          {tab === 'library' ? (
            libraryRows.length === 0 ? (
              <p className="personal-binder-material-picker__empty">조건에 맞는 자료가 없습니다.</p>
            ) : (
              <ul className="personal-binder-material-picker__list">
                {libraryRows.map((material) => (
                  <li key={material.id}>
                    <button
                      type="button"
                      className="personal-binder-material-picker__row"
                      onClick={() => finish(material)}
                    >
                      <span className="personal-binder-material-picker__row-title">{material.title}</span>
                      <span className="personal-binder-material-picker__row-meta">
                        <span className="personal-binder-material-picker__row-filename">{material.originalFileName}</span>
                        <span className="personal-binder-material-picker__row-pages">· {material.pageCount}페이지</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'my-file' ? (
            loading ? (
              <p className="personal-binder-material-picker__empty">내 파일을 불러오는 중…</p>
            ) : myFileRows.length === 0 ? (
              <p className="personal-binder-material-picker__empty">연결할 PDF·이미지 파일이 없습니다.</p>
            ) : (
              <ul className="personal-binder-material-picker__list">
                {myFileRows.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="personal-binder-material-picker__row"
                      disabled={linkingId === String(file.id)}
                      onClick={() => void linkMyFile(file)}
                    >
                      <span className="personal-binder-material-picker__row-title">
                        {file.displayName ?? file.originalName}
                      </span>
                      <span className="personal-binder-material-picker__row-meta">
                        {file.mimeType} · {new Date(file.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'team' ? (
            loading ? (
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
                      <span className="personal-binder-material-picker__row-meta">
                        {file.postTitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </BaseDialog>

      <MaterialUploadDialog
        open={uploadOpen}
        token={token}
        folderId={folderId}
        onClose={() => setUploadOpen(false)}
        onUploaded={(material) => {
          setUploadOpen(false)
          finish(material)
        }}
      />
    </>
  )
}
