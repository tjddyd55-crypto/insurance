import ResponsiveLayout from '../../../components/ResponsiveLayout'
import PCOnlySection from '../../../components/PCOnlySection'
import PersonalBinderHomePCView from './PersonalBinderHome/PersonalBinderHomePCView'
import PersonalBinderHomeMobileView from './PersonalBinderHome/PersonalBinderHomeMobileView'
import type { PersonalBinderHomeViewProps } from './PersonalBinderHome/personalBinderHomeViewProps'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useMatch, useNavigate } from 'react-router-dom'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import FormTextarea from '../../../components/form/FormTextarea'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import {
  BinderPageSelectionEditor,
  type BinderPageSelectionEditorHandle,
} from '../components/BinderPageSelectionEditor'
import { PersonalBinderExplorerTree } from '../components/PersonalBinderExplorerTree'
import type { PageSelectionDockState } from '../components/pageSelectionDock.types'
import {
  readLastSelectedBinderId,
  writeLastSelectedBinderId,
} from '../domain/lastSelectedBinder'
import {
  createPersonalBinder,
  deletePersonalBinder,
  createPersonalBinderFolder,
  deletePersonalBinderFolder,
  duplicatePersonalBinder,
  listPersonalBinderFolders,
  listPersonalBinders,
  renamePersonalBinderFolder,
} from '../personalBinder.api'
import type { PersonalBinderFolder, PersonalBinderSummary } from '../personalBinder.types'
import PersonalBinderEditorPage from './PersonalBinderEditorPage'
import '../styles/personal-binder.css'

type BinderFormState = {
  mode: 'create' | 'duplicate'
  sourceId?: string
  title: string
  description: string
  folderId?: string
}

export default function PersonalBinderHomePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { confirm, confirmDialog } = useConfirmDialog()
  const editMatch = useMatch('/personal-binders/edit/:binderId')
  const workspaceEditBinderId = !isMobile ? editMatch?.params.binderId : undefined
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const pageSelectionEditorRef = useRef<BinderPageSelectionEditorHandle>(null)
  const [editorMetadataDirty, setEditorMetadataDirty] = useState(false)
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)
  const [pageSelectionDock, setPageSelectionDock] = useState<PageSelectionDockState | null>(null)
  const [binders, setBinders] = useState<PersonalBinderSummary[]>([])
  const [binderFolders, setBinderFolders] = useState<PersonalBinderFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [binderForm, setBinderForm] = useState<BinderFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const nestedConfirmBlockingRef = useRef(false)
  const [createBinderFolderId, setCreateBinderFolderId] = useState<string | undefined>(undefined)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [nextBinders, nextBinderFolders] = await Promise.all([
        listPersonalBinders(token, signal),
        listPersonalBinderFolders(token, 'binder', signal),
      ])
      setBinders(nextBinders)
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
    if (isMobile || loading) return
    if (location.pathname !== '/personal-binders') return
    if (binders.length === 0) return
    const lastId = readLastSelectedBinderId()
    const target =
      (lastId && binders.some((row) => row.id === lastId) ? lastId : null) ?? binders[0]?.id
    if (target) {
      navigate(`/personal-binders/edit/${target}`, { replace: true })
    }
  }, [binders, isMobile, loading, location.pathname, navigate])

  useEffect(() => {
    const binderId = editMatch?.params.binderId
    if (binderId?.trim()) {
      writeLastSelectedBinderId(binderId)
    }
  }, [editMatch?.params.binderId])

  useEffect(() => {
    const state = location.state as { restoreScrollY?: number } | null
    if (state?.restoreScrollY == null || !workspaceEditBinderId) return
    const frame = requestAnimationFrame(() => {
      editorScrollRef.current?.scrollTo({ top: state.restoreScrollY, behavior: 'auto' })
      navigate(location.pathname, { replace: true, state: {} })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.state, navigate, workspaceEditBinderId])

  const confirmLeavePageSelection = async (): Promise<boolean> => {
    if (!pageSelectionDock) return true
    return pageSelectionEditorRef.current?.requestClose() ?? true
  }

  const confirmLeaveEditor = async (): Promise<boolean> => {
    if (!(await confirmLeavePageSelection())) return false
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

  const openBinderEdit = async (binderId: string) => {
    if (workspaceEditBinderId === binderId) return
    if (!(await confirmLeaveEditor())) return
    setPreviewItemId(null)
    setPageSelectionDock(null)
    navigate(`/personal-binders/edit/${binderId}`)
  }

  if (!token) return <Navigate to="/login" replace />

  const requestCloseBinderForm = async () => {
    if (saving || nestedConfirmBlockingRef.current) return
    if (binderForm && (binderForm.title || binderForm.description)) {
      nestedConfirmBlockingRef.current = true
      try {
        const accepted = await confirm({ title: '확인',
          message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
          confirmLabel: '확인', cancelLabel: '취소' })
        if (!accepted) return
      } finally {
        nestedConfirmBlockingRef.current = false
      }
    }
    setBinderForm(null)
  }

  const saveBinderForm = async () => {
    if (!binderForm || !binderForm.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      if (binderForm.mode === 'create') {
        const created = await createPersonalBinder(token, {
          title: binderForm.title,
          description: binderForm.description,
          folderId: binderForm.folderId ?? createBinderFolderId,
        })
        setBinders((rows) => [created, ...rows])
        setBinderForm(null)
        navigate(
          isMobile ? `/personal-binders/${created.id}/edit` : `/personal-binders/edit/${created.id}`,
        )
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

  const handleCreateFolder = async (name: string) => {
    const created = await createPersonalBinderFolder(token, { type: 'binder', name })
    setBinderFolders((rows) => [...rows, created])
  }

  const handleRenameFolder = async (folderId: string, name: string) => {
    const updated = await renamePersonalBinderFolder(token, folderId, name)
    setBinderFolders((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
  }

  const handleDeleteFolder = async (folderId: string) => {
    await deletePersonalBinderFolder(token, folderId)
    setBinderFolders((rows) => rows.filter((row) => row.id !== folderId))
    setBinders((rows) =>
      rows.map((row) => (row.folderId === folderId ? { ...row, folderId: null } : row)),
    )
  }

  const handleDeleteBinder = async (binder: PersonalBinderSummary) => {
    if (saving || !(await confirmLeaveEditor())) return
    const accepted = await confirm({
      title: '이 바인더를 삭제하시겠습니까?',
      message: '바인더 구성은 삭제되지만 원본 파일은 내 파일에서 삭제되지 않습니다.',
      cancelLabel: '취소', confirmLabel: '삭제', tone: 'danger',
    })
    if (!accepted) return
    setSaving(true)
    try {
      await deletePersonalBinder(token, binder.id)
      setBinders((rows) => rows.filter((row) => row.id !== binder.id))
      if (workspaceEditBinderId === binder.id) {
        setPageSelectionDock(null)
        setPreviewItemId(null)
        navigate('/personal-binders', { replace: true })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더를 삭제하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const openCreateBinder = (folderId?: string) => {
    setCreateBinderFolderId(folderId)
    setBinderForm({
      mode: 'create',
      title: '',
      description: '',
      folderId,
    })
  }

  const previewPane = (
    <div className="personal-binder-workspace__preview-pane">
      {pageSelectionDock ? (
        <BinderPageSelectionEditor
          ref={pageSelectionEditorRef}
          active
          variant="desktop"
          presentation="panel"
          binder={pageSelectionDock.binder}
          folderLabel={pageSelectionDock.folderLabel}
          sectionTitle={pageSelectionDock.sectionTitle}
          material={pageSelectionDock.material}
          pdfUrl={pageSelectionDock.pdfUrl}
          initialSelection={pageSelectionDock.initialSelection}
          onClose={pageSelectionDock.onClose}
          onComplete={pageSelectionDock.onComplete}
        />
      ) : (
        <div className="personal-binder-workspace__preview-placeholder" aria-hidden="true" />
      )}
    </div>
  )

  const mobileContent = (
    <>
      {!loading ? (
        <section className="personal-binder-workspace__binder-nav personal-binder-workspace__binder-nav--mobile">
          {binders.map((binder) => (
            <article key={binder.id} className="personal-binder-workspace__binder-nav-item">
              <button
                type="button"
                className="personal-binder-workspace__binder-nav-button"
                onClick={() => navigate(`/personal-binders/${binder.id}/edit`)}
              >
                <strong>{binder.title}</strong>
                <small>
                  섹션 {binder.sectionCount} · 자료 {binder.materialCount}
                </small>
              </button>
              <FormButton variant="danger" size="sm" disabled={saving} onClick={() => void handleDeleteBinder(binder)}
                aria-label={`${binder.title} 삭제`}>삭제</FormButton>
            </article>
          ))}
        </section>
      ) : null}
    </>
  )

  const pcContent = (
    <>
      <PersonalBinderExplorerTree
        binders={binders}
        folders={binderFolders}
        selectedBinderId={workspaceEditBinderId}
        onSelectBinder={openBinderEdit}
        onDeleteBinder={(binder) => void handleDeleteBinder(binder)}
        onCreateBinder={() => openCreateBinder()}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        disabled={loading}
      />
      {workspaceEditBinderId ? (
        <div className="personal-binder-workspace__editor-pane" ref={editorScrollRef}>
          <PersonalBinderEditorPage
            layout="embedded"
            binderIdOverride={workspaceEditBinderId}
            editorScrollRef={editorScrollRef}
            onMetadataDirtyChange={setEditorMetadataDirty}
            pageSelectionUi="dock"
            onPageSelectionDockChange={setPageSelectionDock}
            selectedPreviewItemId={previewItemId}
            onPreviewItemChange={setPreviewItemId}
            onBinderMetadataSaved={(summary) => {
              setBinders((rows) =>
                rows.map((row) =>
                  row.id === summary.id ? { ...row, title: summary.title } : row,
                ),
              )
            }}
          />
        </div>
      ) : (
        <div
          className="personal-binder-workspace__editor-pane personal-binder-workspace__editor-pane--empty"
          ref={editorScrollRef}
        >
          <section className="personal-binder-empty personal-binder-empty--compact">
            <h2>바인더를 선택하세요</h2>
            <FormButton variant="primary" onClick={() => openCreateBinder()}>
              + 바인더 만들기
            </FormButton>
          </section>
        </div>
      )}
      {previewPane}
    </>
  )

  const dialogs = (
    <>
      <BaseDialog
        open={binderForm != null}
        onClose={() => void requestCloseBinderForm()}
        closeOnEsc={false}
        onEscapeRequest={() => void requestCloseBinderForm()}
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
              setBinderForm((form) => (form ? { ...form, title: event.target.value } : form))
            }
            placeholder="바인더 이름"
            aria-label="바인더 이름"
          />
          <FormTextarea
            value={binderForm?.description ?? ''}
            onChange={(event) =>
              setBinderForm((form) => (form ? { ...form, description: event.target.value } : form))
            }
            placeholder="설명 (선택)"
            aria-label="바인더 설명"
            rows={3}
          />
          {binderForm?.mode === 'create' && binderFolders.length > 0 ? (
            <PCOnlySection><label className="personal-binder-dialog-field">
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
            </label></PCOnlySection>
          ) : null}
        </div>
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" onClick={() => void requestCloseBinderForm()}>취소</FormButton>
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
      {confirmDialog}
    </>
  )
  return <ResponsiveLayout<PersonalBinderHomeViewProps>
    PC={PersonalBinderHomePCView} Mobile={PersonalBinderHomeMobileView}
    viewProps={{ loading, error, pcContent, mobileContent, dialogs, onCreateBinder: () => openCreateBinder() }} />
}
