import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useMatch, useNavigate } from 'react-router-dom'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import FormTextarea from '../../../components/form/FormTextarea'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import {
  createStorageFileDownloadUrl,
  createStorageFilePreviewUrl,
  deleteStorageFile,
} from '../../storage/api/storageApi'
import { PersonalBinderFolderSidebar } from '../components/PersonalBinderFolderSidebar'
import { MaterialAddSourceDialog } from '../components/MaterialAddSourceDialog'
import {
  countItemsForUserFolder,
  countItemsInFolderSelection,
  filterItemsByFolderSelection,
  folderIdForBinderCreate,
  folderIdForUpload,
  folderSelectionLabel,
  type PersonalBinderFolderSelection,
} from '../domain/personalBinderFolderFilter'
import {
  createPersonalBinder,
  createPersonalBinderFolder,
  deletePersonalBinder,
  deletePersonalBinderFolder,
  deletePersonalBinderMaterial,
  duplicatePersonalBinder,
  listPersonalBinderFolders,
  listPersonalBinderMaterials,
  listPersonalBinders,
  renamePersonalBinderFolder,
  renamePersonalBinderMaterial,
} from '../personalBinder.api'
import type {
  PersonalBinderFolder,
  PersonalBinderMaterial,
  PersonalBinderSummary,
} from '../personalBinder.types'
import PersonalBinderEditorPage from './PersonalBinderEditorPage'
import '../styles/personal-binder.css'

type BinderFormState = {
  mode: 'create' | 'duplicate'
  sourceId?: string
  title: string
  description: string
  folderId?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function PersonalBinderHomePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { confirm, confirmDialog } = useConfirmDialog()
  const materialTab = location.pathname.endsWith('/materials')
  const editMatch = useMatch('/personal-binders/edit/:binderId')
  const workspaceEditBinderId =
    !isMobile && !materialTab ? editMatch?.params.binderId : undefined
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const [editorMetadataDirty, setEditorMetadataDirty] = useState(false)
  const [binders, setBinders] = useState<PersonalBinderSummary[]>([])
  const [materials, setMaterials] = useState<PersonalBinderMaterial[]>([])
  const [materialFolders, setMaterialFolders] = useState<PersonalBinderFolder[]>([])
  const [binderFolders, setBinderFolders] = useState<PersonalBinderFolder[]>([])
  const [materialFolderSelection, setMaterialFolderSelection] =
    useState<PersonalBinderFolderSelection>('all')
  const [binderFolderSelection, setBinderFolderSelection] =
    useState<PersonalBinderFolderSelection>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [binderForm, setBinderForm] = useState<BinderFormState | null>(null)
  const [materialRename, setMaterialRename] = useState<PersonalBinderMaterial | null>(null)
  const [materialTitle, setMaterialTitle] = useState('')
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeFolders = materialTab ? materialFolders : binderFolders
  const folderSelection = materialTab ? materialFolderSelection : binderFolderSelection
  const setFolderSelection = materialTab ? setMaterialFolderSelection : setBinderFolderSelection

  const visibleBinders = useMemo(
    () => filterItemsByFolderSelection(binders, binderFolderSelection),
    [binders, binderFolderSelection],
  )
  const visibleMaterials = useMemo(
    () => filterItemsByFolderSelection(materials, materialFolderSelection),
    [materials, materialFolderSelection],
  )

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [nextBinders, nextMaterials, nextMaterialFolders, nextBinderFolders] =
        await Promise.all([
          listPersonalBinders(token, signal),
          listPersonalBinderMaterials(token, signal),
          listPersonalBinderFolders(token, 'material', signal),
          listPersonalBinderFolders(token, 'binder', signal),
        ])
      setBinders(nextBinders)
      setMaterials(nextMaterials)
      setMaterialFolders(nextMaterialFolders)
      setBinderFolders(nextBinderFolders)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : '내 바인더를 불러오지 못했습니다.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const state = location.state as { restoreScrollY?: number } | null
    if (state?.restoreScrollY == null || !workspaceEditBinderId) return
    const frame = requestAnimationFrame(() => {
      editorScrollRef.current?.scrollTo({ top: state.restoreScrollY, behavior: 'auto' })
      navigate(location.pathname, { replace: true, state: {} })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.state, navigate, workspaceEditBinderId])

  const openBinderEdit = async (binderId: string) => {
    if (
      workspaceEditBinderId &&
      workspaceEditBinderId !== binderId &&
      editorMetadataDirty
    ) {
      const accepted = await confirm({
        title: '저장하지 않은 변경이 있습니다',
        message: '바인더 제목·설명 변경을 저장하지 않았습니다. 다른 바인더로 이동할까요?',
        confirmLabel: '이동',
        cancelLabel: '취소',
        tone: 'danger',
      })
      if (!accepted) return
      setEditorMetadataDirty(false)
    }
    navigate(`/personal-binders/edit/${binderId}`)
  }

  const confirmLeaveEditor = async (): Promise<boolean> => {
    if (!workspaceEditBinderId || !editorMetadataDirty) return true
    const accepted = await confirm({
      title: '저장하지 않은 변경이 있습니다',
      message: '바인더 제목·설명 변경을 저장하지 않았습니다. 이동할까요?',
      confirmLabel: '이동',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (accepted) setEditorMetadataDirty(false)
    return accepted
  }

  const selectBinderFolder = async (selection: PersonalBinderFolderSelection) => {
    if (materialTab) {
      setMaterialFolderSelection(selection)
      return
    }
    if (!(await confirmLeaveEditor())) return
    setBinderFolderSelection(selection)
  }

  const openBinderConsultation = (binderId: string) => {
    navigate(`/personal-binders/${binderId}/view`, {
      state: {
        returnTo: workspaceEditBinderId
          ? `/personal-binders/edit/${workspaceEditBinderId}`
          : undefined,
        scrollY: workspaceEditBinderId ? editorScrollRef.current?.scrollTop ?? 0 : undefined,
      },
    })
  }

  if (!token) return <Navigate to="/login" replace />

  const saveBinderForm = async () => {
    if (!binderForm || !binderForm.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      if (binderForm.mode === 'create') {
        const created = await createPersonalBinder(token, {
          title: binderForm.title,
          description: binderForm.description,
          folderId: binderForm.folderId ?? folderIdForBinderCreate(binderFolderSelection),
        })
        setBinders((rows) => [created, ...rows])
        setBinderForm(null)
        navigate(isMobile ? `/personal-binders/${created.id}/edit` : `/personal-binders/edit/${created.id}`)
      } else if (binderForm.sourceId) {
        const duplicated = await duplicatePersonalBinder(
          token,
          binderForm.sourceId,
          binderForm.title,
        )
        const refreshed = await listPersonalBinders(token)
        setBinders(refreshed)
        setBinderForm(null)
        navigate(
          isMobile
            ? `/personal-binders/${duplicated.id}/edit`
            : `/personal-binders/edit/${duplicated.id}`,
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const removeBinder = async (binder: PersonalBinderSummary) => {
    const accepted = await confirm({
      title: '바인더를 삭제할까요?',
      message: `${binder.title}의 섹션과 상담 구성이 삭제됩니다. 원본 PDF는 자료 보관함에 유지됩니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    try {
      await deletePersonalBinder(token, binder.id)
      setBinders((rows) => rows.filter((row) => row.id !== binder.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더를 삭제하지 못했습니다.')
    }
  }

  const previewMaterial = async (material: PersonalBinderMaterial) => {
    try {
      const url = await createStorageFilePreviewUrl(token, material.fileId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 열지 못했습니다.')
    }
  }

  const downloadMaterial = async (material: PersonalBinderMaterial) => {
    try {
      const url = await createStorageFileDownloadUrl(token, material.fileId)
      window.location.assign(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 다운로드하지 못했습니다.')
    }
  }

  const removeMaterial = async (material: PersonalBinderMaterial) => {
    const accepted = await confirm({
      title: '자료를 삭제할까요?',
      message:
        material.binderCount && material.binderCount > 0
          ? `이 자료는 ${material.binderCount}개의 바인더에서 사용 중이므로 삭제할 수 없습니다.`
          : `${material.title} 원본 PDF도 함께 삭제됩니다.`,
      confirmLabel: material.binderCount ? '확인' : '삭제',
      cancelLabel: '취소',
      tone: material.binderCount ? 'default' : 'danger',
    })
    if (!accepted || (material.binderCount ?? 0) > 0) return
    try {
      const result = await deletePersonalBinderMaterial(token, material.id)
      await deleteStorageFile(token, result.fileId)
      setMaterials((rows) => rows.filter((row) => row.id !== material.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 삭제하지 못했습니다.')
    }
  }

  const submitRename = async () => {
    if (!materialRename || !materialTitle.trim() || saving) return
    setSaving(true)
    try {
      const updated = await renamePersonalBinderMaterial(
        token,
        materialRename.id,
        materialTitle,
      )
      setMaterials((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      )
      setMaterialRename(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료 이름을 변경하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const folderType = materialTab ? 'material' : 'binder'
  const allFolderLabel = materialTab ? '전체 자료' : '전체 바인더'
  const paneTitle = folderSelectionLabel(folderSelection, activeFolders, allFolderLabel)

  const countForSelection = (selection: PersonalBinderFolderSelection) =>
    countItemsInFolderSelection(materialTab ? materials : binders, selection)

  const countForFolder = (folderId: string) =>
    countItemsForUserFolder(materialTab ? materials : binders, folderId)

  const handleCreateFolder = async (name: string) => {
    const created = await createPersonalBinderFolder(token, { type: folderType, name })
    if (materialTab) {
      setMaterialFolders((rows) => [...rows, created])
    } else {
      setBinderFolders((rows) => [...rows, created])
    }
  }

  const handleRenameFolder = async (folderId: string, name: string) => {
    const updated = await renamePersonalBinderFolder(token, folderId, name)
    if (materialTab) {
      setMaterialFolders((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
    } else {
      setBinderFolders((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    await deletePersonalBinderFolder(token, folderId)
    if (materialTab) {
      setMaterialFolders((rows) => rows.filter((row) => row.id !== folderId))
      setMaterials((rows) =>
        rows.map((row) => (row.folderId === folderId ? { ...row, folderId: null } : row)),
      )
    } else {
      setBinderFolders((rows) => rows.filter((row) => row.id !== folderId))
      setBinders((rows) =>
        rows.map((row) => (row.folderId === folderId ? { ...row, folderId: null } : row)),
      )
    }
  }

  const primaryAction = materialTab ? (
    <FormButton variant="primary" size="sm" onClick={() => setAddSourceOpen(true)}>
      자료 추가
    </FormButton>
  ) : (
    <FormButton
      variant="primary"
      size="sm"
      onClick={() =>
        setBinderForm({
          mode: 'create',
          title: '',
          description: '',
          folderId: folderIdForBinderCreate(binderFolderSelection),
        })
      }
    >
      + 바인더 만들기
    </FormButton>
  )

  const binderListPane = !materialTab ? (
    <div className="personal-binder-workspace__list-pane">
      <div className="personal-binder-workspace__pane-header">
        <h2 className="personal-binder-workspace__pane-title">{paneTitle}</h2>
        <div className="personal-binder-workspace__pane-actions">{primaryAction}</div>
      </div>
      {!loading && visibleBinders.length === 0 ? (
        <section className="personal-binder-empty personal-binder-empty--compact">
          <h2>이 폴더에 바인더가 없습니다.</h2>
          <p>상담 목적에 맞는 바인더를 만들어 보세요.</p>
        </section>
      ) : null}
      {!loading ? (
        <section className="personal-binder-workspace__binder-nav" aria-label="바인더 목록">
          {visibleBinders.map((binder) => {
            const selected = workspaceEditBinderId === binder.id
            return (
              <article
                key={binder.id}
                className={[
                  'personal-binder-workspace__binder-nav-item',
                  selected ? 'personal-binder-workspace__binder-nav-item--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="personal-binder-workspace__binder-nav-button"
                  onClick={() => void openBinderEdit(binder.id)}
                >
                  <strong>{binder.title}</strong>
                  <small>
                    섹션 {binder.sectionCount} · 자료 {binder.materialCount}
                  </small>
                </button>
              </article>
            )
          })}
        </section>
      ) : null}
    </div>
  ) : null

  const workspaceBody = (
    <>
      {!isMobile ? (
        <PersonalBinderFolderSidebar
          heading={materialTab ? '자료 폴더' : '바인더 폴더'}
          allLabel={allFolderLabel}
          folders={activeFolders}
          selection={folderSelection}
          onSelect={(selection) => void selectBinderFolder(selection)}
          countForSelection={countForSelection}
          countForFolder={countForFolder}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          disabled={loading}
        />
      ) : null}

      <div className="personal-binder-workspace__main">
        {!isMobile && workspaceEditBinderId && binderListPane ? binderListPane : null}

        {!isMobile && !workspaceEditBinderId ? (
          <div className="personal-binder-workspace__pane-header">
            <h2 className="personal-binder-workspace__pane-title">{paneTitle}</h2>
            <div className="personal-binder-workspace__pane-actions">{primaryAction}</div>
          </div>
        ) : null}

        {!loading && !materialTab && visibleBinders.length === 0 && (isMobile || !workspaceEditBinderId) ? (
          <section className="personal-binder-empty">
            <h2>이 폴더에 바인더가 없습니다.</h2>
            <p>상담 목적에 맞는 바인더를 만들어 보세요.</p>
          </section>
        ) : null}

        {!loading && !materialTab && (isMobile || !workspaceEditBinderId) ? (
          <section className="personal-binder-card-grid">
            {visibleBinders.map((binder) => (
              <article key={binder.id} className="personal-binder-card">
                <div>
                  <h2>{binder.title}</h2>
                  <p>{binder.description || '설명 없음'}</p>
                  <dl>
                    <div><dt>섹션</dt><dd>{binder.sectionCount}</dd></div>
                    <div><dt>자료</dt><dd>{binder.materialCount}</dd></div>
                    <div><dt>상담 페이지</dt><dd>{binder.pageCount}</dd></div>
                  </dl>
                  <small>수정 {new Date(binder.updatedAt).toLocaleString('ko-KR')}</small>
                </div>
                <div className="personal-binder-card__actions">
                  <FormButton
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      isMobile
                        ? navigate(`/personal-binders/${binder.id}/view`)
                        : openBinderConsultation(binder.id)
                    }
                  >
                    상담 시작
                  </FormButton>
                  <FormButton
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      isMobile
                        ? navigate(`/personal-binders/${binder.id}/edit`)
                        : void openBinderEdit(binder.id)
                    }
                  >
                    편집
                  </FormButton>
                  <FormButton
                    variant="action"
                    size="sm"
                    onClick={() =>
                      setBinderForm({
                        mode: 'duplicate',
                        sourceId: binder.id,
                        title: `${binder.title} 복사본`,
                        description: binder.description,
                      })
                    }
                  >
                    복제
                  </FormButton>
                  <FormButton variant="danger" size="sm" onClick={() => void removeBinder(binder)}>
                    삭제
                  </FormButton>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!loading && materialTab && visibleMaterials.length === 0 ? (
          <section className="personal-binder-empty">
            <h2>이 폴더에 자료가 없습니다.</h2>
            <p>PDF·이미지를 추가하면 여러 바인더에서 재사용할 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && materialTab ? (
          <section className="personal-binder-material-list">
            {visibleMaterials.map((material) => (
              <article key={material.id} className="personal-binder-material-row">
                <div>
                  <h2>{material.title}</h2>
                  <p>{material.originalFileName}</p>
                  <small>
                    {material.pageCount}페이지 · {formatFileSize(material.fileSize)}
                    {material.createdAt
                      ? ` · ${new Date(material.createdAt).toLocaleDateString('ko-KR')} 업로드`
                      : ''}
                    {' · '}바인더 {material.binderCount ?? 0}개
                  </small>
                </div>
                <div className="personal-binder-material-row__actions">
                  <FormButton variant="secondary" size="sm" onClick={() => void previewMaterial(material)}>미리보기</FormButton>
                  <FormButton variant="secondary" size="sm" onClick={() => void downloadMaterial(material)}>다운로드</FormButton>
                  <FormButton
                    variant="action"
                    size="sm"
                    onClick={() => {
                      setMaterialRename(material)
                      setMaterialTitle(material.title)
                    }}
                  >
                    제목 변경
                  </FormButton>
                  <FormButton variant="danger" size="sm" onClick={() => void removeMaterial(material)}>삭제</FormButton>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!isMobile && workspaceEditBinderId ? (
          <div className="personal-binder-workspace__editor-pane" ref={editorScrollRef}>
            <PersonalBinderEditorPage
              layout="embedded"
              binderIdOverride={workspaceEditBinderId}
              editorScrollRef={editorScrollRef}
              onMetadataDirtyChange={setEditorMetadataDirty}
            />
          </div>
        ) : null}
      </div>
    </>
  )

  return (
    <main className={`page personal-binder-page${!isMobile ? ' personal-binder-page--workspace' : ''}`}>
      <header className="personal-binder-page-header">
        <div>
          <h1>내 바인더</h1>
          <p>상담 자료를 조합해 나만의 디지털 상담 책자를 만드세요.</p>
        </div>
        {isMobile ? primaryAction : null}
      </header>

      <nav className="personal-binder-tabs" aria-label="내 바인더 메뉴">
        <FormButton
          variant={!materialTab ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            if (materialTab) return
            void (async () => {
              if (!(await confirmLeaveEditor())) return
              navigate('/personal-binders')
            })()
          }}
        >
          바인더
        </FormButton>
        <FormButton
          variant={materialTab ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            if (materialTab) return
            void (async () => {
              if (!(await confirmLeaveEditor())) return
              navigate('/personal-binders/materials')
            })()
          }}
        >
          자료 보관함
        </FormButton>
      </nav>

      {error ? <p className="personal-binder-error">{error}</p> : null}
      {loading ? <div className="personal-binder-status">불러오는 중…</div> : null}

      {!loading ? (
        isMobile ? (
          workspaceBody
        ) : (
          <div
            className={[
              'personal-binder-workspace__body',
              workspaceEditBinderId ? 'personal-binder-workspace__body--split' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {workspaceBody}
          </div>
        )
      ) : null}

      <MaterialAddSourceDialog
        open={addSourceOpen}
        token={token}
        materials={materials}
        folderId={folderIdForUpload(materialFolderSelection)}
        mode="library"
        onClose={() => setAddSourceOpen(false)}
        onUploaded={(material) => setMaterials((rows) => [material, ...rows])}
      />

      <BaseDialog
        open={binderForm != null}
        onClose={() => setBinderForm(null)}
        closeOnBackdrop={false}
        ariaLabel={binderForm?.mode === 'duplicate' ? '바인더 복제' : '새 바인더'}
      >
        <h2 className="personal-binder-dialog-title">
          {binderForm?.mode === 'duplicate' ? '바인더 복제' : '새 바인더 만들기'}
        </h2>
        <div className="personal-binder-dialog-fields">
          <FormInput
            value={binderForm?.title ?? ''}
            onChange={(event) =>
              setBinderForm((form) => form ? { ...form, title: event.target.value } : form)
            }
            placeholder="바인더 이름"
            aria-label="바인더 이름"
          />
          <FormTextarea
            value={binderForm?.description ?? ''}
            onChange={(event) =>
              setBinderForm((form) => form ? { ...form, description: event.target.value } : form)
            }
            placeholder="설명 (선택)"
            aria-label="바인더 설명"
            rows={4}
          />
          {binderForm?.mode === 'create' && !isMobile && binderFolders.length > 0 ? (
            <label className="personal-binder-dialog-field">
              <span className="personal-binder-dialog-field__label">저장 폴더</span>
              <select
                className="field__control"
                value={binderForm.folderId ?? ''}
                onChange={(event) =>
                  setBinderForm((form) =>
                    form
                      ? {
                          ...form,
                          folderId: event.target.value || undefined,
                        }
                      : form,
                  )
                }
              >
                <option value="">미분류</option>
                {binderFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" onClick={() => setBinderForm(null)}>취소</FormButton>
          <FormButton
            variant="primary"
            disabled={!binderForm?.title.trim() || saving}
            loading={saving}
            onClick={() => void saveBinderForm()}
          >
            {binderForm?.mode === 'duplicate' ? '복제' : '만들기'}
          </FormButton>
        </div>
      </BaseDialog>

      <BaseDialog
        open={materialRename != null}
        onClose={() => setMaterialRename(null)}
        closeOnBackdrop={false}
        ariaLabel="자료 제목 변경"
      >
        <h2 className="personal-binder-dialog-title">자료 제목 변경</h2>
        <FormInput
          value={materialTitle}
          onChange={(event) => setMaterialTitle(event.target.value)}
          aria-label="자료 제목"
        />
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" onClick={() => setMaterialRename(null)}>취소</FormButton>
          <FormButton variant="primary" loading={saving} onClick={() => void submitRename()}>저장</FormButton>
        </div>
      </BaseDialog>
      {confirmDialog}
    </main>
  )
}
