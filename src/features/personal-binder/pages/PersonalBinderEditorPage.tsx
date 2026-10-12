import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import FormTextarea from '../../../components/form/FormTextarea'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { createStorageFilePreviewUrl } from '../../storage/api/storageApi'
import { BinderPageSelectionDialog } from '../components/BinderPageSelectionDialog'
import type { PageSelectionDockState } from '../components/pageSelectionDock.types'
import { splitBinderFileDisplayName } from '../utils/binderFileDisplay'
import { MaterialAddSourceDialog } from '../components/MaterialAddSourceDialog'
import { formatSelectedPages } from '../domain/pageSelection'
import {
  downloadPersonalBinderPdf,
  printPersonalBinderPdf,
} from '../personalBinderPdf'
import {
  addPersonalBinderItem,
  createPersonalBinderSection,
  deletePersonalBinderItem,
  deletePersonalBinderSection,
  getPersonalBinder,
  listPersonalBinderFolders,
  listPersonalBinderMaterials,
  listPersonalBinders,
  renamePersonalBinderSection,
  reorderPersonalBinderItems,
  reorderPersonalBinderSections,
  updatePersonalBinder,
  updatePersonalBinderItemPages,
} from '../personalBinder.api'
import type {
  PersonalBinder,
  PersonalBinderItem,
  PersonalBinderMaterial,
  PersonalBinderSection,
} from '../personalBinder.types'
import '../styles/personal-binder.css'

type PageSelectionTarget = {
  sectionId: string
  itemId?: string
  material: PersonalBinderMaterial
  initialSelection: number[] | null
}

function move<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows
  }
  const next = [...rows]
  const [entry] = next.splice(from, 1)
  next.splice(to, 0, entry)
  return next
}

export type PersonalBinderEditorPageProps = {
  layout?: 'page' | 'embedded'
  binderIdOverride?: string
  onMetadataDirtyChange?: (dirty: boolean) => void
  editorScrollRef?: RefObject<HTMLDivElement | null>
  pageSelectionUi?: 'modal' | 'dock'
  onPageSelectionDockChange?: (state: PageSelectionDockState | null) => void
  selectedPreviewItemId?: string | null
  onPreviewItemChange?: (itemId: string | null) => void
}

export default function PersonalBinderEditorPage({
  layout = 'page',
  binderIdOverride,
  onMetadataDirtyChange,
  editorScrollRef,
  pageSelectionUi = 'modal',
  onPageSelectionDockChange,
  selectedPreviewItemId,
  onPreviewItemChange,
}: PersonalBinderEditorPageProps = {}) {
  const { binderId: routeBinderId = '' } = useParams()
  const binderId = binderIdOverride ?? routeBinderId
  const { token } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [binder, setBinder] = useState<PersonalBinder | null>(null)
  const [materials, setMaterials] = useState<PersonalBinderMaterial[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sectionDialog, setSectionDialog] = useState<{
    mode: 'create' | 'rename'
    section?: PersonalBinderSection
    title: string
  } | null>(null)
  const [materialSectionId, setMaterialSectionId] = useState<string | null>(null)
  const [pageTarget, setPageTarget] = useState<PageSelectionTarget | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [dragSectionId, setDragSectionId] = useState<string | null>(null)
  const [dragItem, setDragItem] = useState<{ sectionId: string; itemId: string } | null>(null)
  const [binderFolderLabel, setBinderFolderLabel] = useState('미분류')

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token || !binderId) return
    setLoading(true)
    setError('')
    try {
      const [nextBinder, nextMaterials, binderSummaries, binderFolders] = await Promise.all([
        getPersonalBinder(token, binderId, signal),
        listPersonalBinderMaterials(token, signal),
        listPersonalBinders(token, signal),
        listPersonalBinderFolders(token, 'binder', signal),
      ])
      const summary = binderSummaries.find((row) => row.id === binderId)
      const folderId = summary?.folderId ?? null
      const folderName = folderId
        ? binderFolders.find((folder) => folder.id === folderId)?.name ?? '미분류'
        : '미분류'
      setBinder(nextBinder)
      setMaterials(nextMaterials)
      setBinderFolderLabel(folderName)
      setTitle(nextBinder.title)
      setDescription(nextBinder.description)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : '바인더를 불러오지 못했습니다.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [binderId, token])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (layout !== 'page' || isMobile || !binderId) return
    navigate(`/personal-binders/edit/${binderId}`, { replace: true })
  }, [binderId, isMobile, layout, navigate])

  const metadataDirty = useMemo(() => {
    if (!binder) return false
    return title !== binder.title || description !== binder.description
  }, [binder, description, title])

  useEffect(() => {
    onMetadataDirtyChange?.(metadataDirty)
  }, [metadataDirty, onMetadataDirtyChange])

  useEffect(() => {
    setPageTarget(null)
    setPdfUrl(null)
    onPreviewItemChange?.(null)
  }, [binderId, onPreviewItemChange])

  const pageSelectionDock = pageSelectionUi === 'dock' && layout === 'embedded'

  const completeSelection = useCallback(
    async (selection: number[] | null) => {
      if (!pageTarget || !token || !binder) return
      setSaving(true)
      try {
        if (pageTarget.itemId) {
          await updatePersonalBinderItemPages(token, pageTarget.itemId, selection)
        } else {
          await addPersonalBinderItem(token, pageTarget.sectionId, {
            materialId: pageTarget.material.id,
            pageSelection: selection,
          })
        }
        setPageTarget(null)
        setPdfUrl(null)
        onPreviewItemChange?.(null)
        const next = await getPersonalBinder(token, binder.id)
        setBinder(next)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '자료 구성을 저장하지 못했습니다.')
      } finally {
        setSaving(false)
      }
    },
    [binder, onPreviewItemChange, pageTarget, token],
  )

  const closePageSelection = useCallback(() => {
    setPageTarget(null)
    setPdfUrl(null)
    onPreviewItemChange?.(null)
  }, [onPreviewItemChange])

  useEffect(() => {
    if (!pageSelectionDock || !onPageSelectionDockChange) return
    if (!pageTarget || !binder) {
      onPageSelectionDockChange(null)
      return
    }
    const sectionTitle =
      binder.sections.find((section) => section.id === pageTarget.sectionId)?.title ?? ''
    onPageSelectionDockChange({
      binder,
      folderLabel: binderFolderLabel,
      sectionTitle,
      material: pageTarget.material,
      pdfUrl,
      initialSelection: pageTarget.initialSelection,
      onClose: closePageSelection,
      onComplete: (selection) => {
        void completeSelection(selection)
      },
    })
  }, [
    binder,
    binderFolderLabel,
    closePageSelection,
    completeSelection,
    onPageSelectionDockChange,
    pageSelectionDock,
    pageTarget,
    pdfUrl,
  ])

  const orderedSections = useMemo(
    () => binder?.sections.slice().sort((left, right) => left.sortOrder - right.sortOrder) ?? [],
    [binder],
  )

  const isImageMaterial = (material: PersonalBinderMaterial) =>
    material.mimeType.toLowerCase().startsWith('image/')

  if (!token) return <Navigate to="/login" replace />
  if (layout === 'page' && !isMobile) {
    return <main className="page personal-binder-status">바인더 편집 화면으로 이동하는 중…</main>
  }
  if (loading) {
    const loadingClass =
      layout === 'embedded' ? 'personal-binder-status' : 'page personal-binder-status'
    return <main className={loadingClass}>바인더를 불러오는 중…</main>
  }
  if (!binder) {
    return (
      <main className="page personal-binder-status">
        <p>{error || '바인더를 찾을 수 없습니다.'}</p>
        <FormButton variant="secondary" onClick={() => navigate('/personal-binders')}>목록으로</FormButton>
      </main>
    )
  }

  const refresh = async () => {
    const next = await getPersonalBinder(token, binder.id)
    setBinder(next)
  }
  const saveBinder = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const next = await updatePersonalBinder(token, binder.id, {
        title,
        description,
      })
      setBinder(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }
  const saveSection = async () => {
    if (!sectionDialog?.title.trim() || saving) return
    setSaving(true)
    try {
      if (sectionDialog.mode === 'create') {
        await createPersonalBinderSection(token, binder.id, sectionDialog.title)
      } else if (sectionDialog.section) {
        await renamePersonalBinderSection(
          token,
          sectionDialog.section.id,
          sectionDialog.title,
        )
      }
      setSectionDialog(null)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '섹션을 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }
  const removeSection = async (section: PersonalBinderSection) => {
    const accepted = await confirm({
      title: '섹션을 삭제할까요?',
      message: `${section.title} 안의 자료 연결도 함께 삭제됩니다. 원본 PDF는 유지됩니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    await deletePersonalBinderSection(token, section.id)
    await refresh()
  }
  const reorderSections = async (fromId: string, toId: string) => {
    const from = orderedSections.findIndex((section) => section.id === fromId)
    const to = orderedSections.findIndex((section) => section.id === toId)
    const next = move(orderedSections, from, to)
    setBinder({ ...binder, sections: next.map((section, index) => ({ ...section, sortOrder: index })) })
    await reorderPersonalBinderSections(token, binder.id, next.map((section) => section.id))
    await refresh()
  }
  const reorderItems = async (
    section: PersonalBinderSection,
    fromId: string,
    toId: string,
  ) => {
    const ordered = section.items.slice().sort((left, right) => left.sortOrder - right.sortOrder)
    const next = move(
      ordered,
      ordered.findIndex((item) => item.id === fromId),
      ordered.findIndex((item) => item.id === toId),
    )
    setBinder({
      ...binder,
      sections: binder.sections.map((entry) =>
        entry.id === section.id
          ? { ...entry, items: next.map((item, index) => ({ ...item, sortOrder: index })) }
          : entry,
      ),
    })
    await reorderPersonalBinderItems(token, section.id, next.map((item) => item.id))
    await refresh()
  }
  const moveSectionBy = (section: PersonalBinderSection, direction: -1 | 1) => {
    const index = orderedSections.findIndex((entry) => entry.id === section.id)
    const target = orderedSections[index + direction]
    if (target) void reorderSections(section.id, target.id)
  }
  const moveItemBy = (
    section: PersonalBinderSection,
    item: PersonalBinderItem,
    direction: -1 | 1,
  ) => {
    const ordered = section.items.slice().sort((left, right) => left.sortOrder - right.sortOrder)
    const index = ordered.findIndex((entry) => entry.id === item.id)
    const target = ordered[index + direction]
    if (target) void reorderItems(section, item.id, target.id)
  }
  const selectMaterial = async (
    sectionId: string,
    material: PersonalBinderMaterial,
    initialSelection: number[] | null = null,
    itemId?: string,
  ) => {
    setError('')
    try {
      if (isImageMaterial(material) && material.pageCount === 1 && !itemId) {
        await addPersonalBinderItem(token, sectionId, {
          materialId: material.id,
          pageSelection: [1],
        })
        setMaterialSectionId(null)
        await refresh()
        return
      }
      const url = await createStorageFilePreviewUrl(token, material.fileId)
      setPdfUrl(url)
      setPageTarget({ sectionId, itemId, material, initialSelection })
      onPreviewItemChange?.(itemId ?? null)
      setMaterialSectionId(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '미리보기를 준비하지 못했습니다.')
    }
  }
  const pickMaterialFromSource = (material: PersonalBinderMaterial) => {
    if (!materialSectionId) return
    void selectMaterial(materialSectionId, material)
  }
  const exportBinder = async (mode: 'download' | 'print') => {
    if (exporting) return
    setExporting(true)
    setError('')
    try {
      if (mode === 'download') {
        await downloadPersonalBinderPdf(token, binder.id, binder.title)
      } else {
        await printPersonalBinderPdf(token, binder.id)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더 PDF를 만들지 못했습니다.')
    } finally {
      setExporting(false)
    }
  }
  const startConsultation = () => {
    const returnTo =
      layout === 'embedded'
        ? `/personal-binders/edit/${binder.id}`
        : `/personal-binders/${binder.id}/edit`
    const scrollY = editorScrollRef?.current?.scrollTop ?? 0
    navigate(`/personal-binders/${binder.id}/view`, {
      state: { returnTo, scrollY },
    })
  }

  const removeItem = async (item: PersonalBinderItem) => {
    const accepted = await confirm({
      title: '바인더에서 자료를 뺄까요?',
      message: '원본 PDF는 자료 보관함에 유지됩니다.',
      confirmLabel: '연결 해제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!accepted) return
    await deletePersonalBinderItem(token, item.id)
    await refresh()
  }

  const rootClass =
    layout === 'embedded'
      ? 'personal-binder-editor personal-binder-editor--embedded personal-binder-editor--toc'
      : 'page personal-binder-page personal-binder-page--editor personal-binder-editor'

  return (
    <main className={rootClass}>
      <header className="personal-binder-editor-header">
        {layout === 'embedded' ? null : (
          <FormButton variant="action" onClick={() => navigate('/personal-binders')}>
            ← 목록
          </FormButton>
        )}
        <div>
          <h1>{layout === 'embedded' ? '편집' : '바인더 편집'}</h1>
          {layout === 'embedded' ? null : (
            <p>섹션과 자료 순서를 상담 흐름에 맞게 구성하세요.</p>
          )}
        </div>
        <div className="personal-binder-editor-header__actions">
          <FormButton variant="secondary" size="sm" onClick={() => startConsultation()}>
            상담
          </FormButton>
          <FormButton
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void exportBinder('download')}
          >
            PDF
          </FormButton>
          <FormButton
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void exportBinder('print')}
          >
            출력
          </FormButton>
          <FormButton variant="primary" size="sm" loading={saving} onClick={() => void saveBinder()}>
            저장
          </FormButton>
        </div>
      </header>

      {error ? <p className="personal-binder-error">{error}</p> : null}

      <section className="personal-binder-settings personal-binder-settings--compact">
        <FormInput
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="바인더 제목"
          aria-label="바인더 제목"
        />
        {layout === 'embedded' ? null : (
          <FormTextarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="바인더 설명"
            aria-label="바인더 설명"
            rows={2}
          />
        )}
      </section>

      <div className="personal-binder-editor__section-toolbar">
        <h2>상담 섹션</h2>
        <FormButton
          variant="primary"
          onClick={() => setSectionDialog({ mode: 'create', title: '' })}
        >
          섹션 추가
        </FormButton>
      </div>

      {orderedSections.length === 0 ? (
        <section className="personal-binder-empty">
          <h2>첫 번째 상담 섹션을 추가하세요.</h2>
          <p>섹션 이름은 상담 흐름에 맞게 자유롭게 만들 수 있습니다.</p>
        </section>
      ) : null}

      <section className="personal-binder-section-list">
        {orderedSections.map((section, sectionIndex) => {
          const sectionCollapsed = collapsed.has(section.id)
          const orderedItems = section.items.slice().sort((left, right) => left.sortOrder - right.sortOrder)
          return (
            <article
              key={section.id}
              className={[
                'personal-binder-section-card',
                layout === 'embedded' ? 'personal-binder-toc__section' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!isMobile}
              onDragStart={() => setDragSectionId(section.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragSectionId) void reorderSections(dragSectionId, section.id)
                setDragSectionId(null)
              }}
            >
              <header>
                <FormButton
                  variant="action"
                  className="personal-binder-section-card__toggle"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(section.id)) next.delete(section.id)
                      else next.add(section.id)
                      return next
                    })
                  }
                >
                  <span className="personal-binder-toc__section-index" aria-hidden="true">
                    {sectionIndex + 1}.
                  </span>
                  <strong>{section.title}</strong>
                  {layout !== 'embedded' ? <small>{orderedItems.length}개 자료</small> : null}
                </FormButton>
                <div className="personal-binder-section-card__actions">
                  <FormButton variant="action" size="sm" disabled={sectionIndex === 0} onClick={() => moveSectionBy(section, -1)} aria-label="섹션 위로">↑</FormButton>
                  <FormButton variant="action" size="sm" disabled={sectionIndex === orderedSections.length - 1} onClick={() => moveSectionBy(section, 1)} aria-label="섹션 아래로">↓</FormButton>
                  <FormButton variant="action" size="sm" onClick={() => setSectionDialog({ mode: 'rename', section, title: section.title })} aria-label="섹션 이름 변경">이름</FormButton>
                  <FormButton variant="danger" size="sm" onClick={() => void removeSection(section)} aria-label="섹션 삭제">삭제</FormButton>
                </div>
              </header>
              {!sectionCollapsed ? (
                <div className="personal-binder-section-card__body personal-binder-toc__items">
                  {orderedItems.map((item, itemIndex) => {
                    const fileDisplay = splitBinderFileDisplayName(item.material)
                    const pageLabel = item.pageSelection
                      ? `${formatSelectedPages(item.pageSelection)}p`
                      : `전체 ${item.material.pageCount}p`
                    const previewSelected =
                      selectedPreviewItemId === item.id ||
                      (pageTarget?.itemId === item.id && pageSelectionDock)
                    return (
                      <div
                        key={item.id}
                        className={[
                          'personal-binder-item-row',
                          layout === 'embedded' ? 'personal-binder-toc__item' : '',
                          previewSelected ? 'personal-binder-item-row--selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        draggable={!isMobile}
                        onDragStart={() => setDragItem({ sectionId: section.id, itemId: item.id })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragItem?.sectionId === section.id) {
                            void reorderItems(section, dragItem.itemId, item.id)
                          }
                          setDragItem(null)
                        }}
                      >
                        <span className="personal-binder-drag-handle personal-binder-toc__bullet" aria-hidden="true">
                          {layout === 'embedded' ? '–' : '⋮⋮'}
                        </span>
                        <button
                          type="button"
                          className="personal-binder-item-row__main"
                          onClick={() =>
                            void selectMaterial(
                              section.id,
                              item.material,
                              item.pageSelection,
                              item.id,
                            )
                          }
                        >
                          <span className="personal-binder-item-row__name" title={fileDisplay.baseName}>
                            <span className="personal-binder-item-row__basename">{fileDisplay.baseName}</span>
                            <span className="personal-binder-item-row__ext">.{fileDisplay.extension}</span>
                          </span>
                          <small className="personal-binder-toc__page-meta">{pageLabel}</small>
                        </button>
                        <div className="personal-binder-item-row__actions">
                          <FormButton variant="action" size="sm" disabled={itemIndex === 0} onClick={() => moveItemBy(section, item, -1)} aria-label="자료 위로">↑</FormButton>
                          <FormButton variant="action" size="sm" disabled={itemIndex === orderedItems.length - 1} onClick={() => moveItemBy(section, item, 1)} aria-label="자료 아래로">↓</FormButton>
                          {!pageSelectionDock ? (
                            <FormButton
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void selectMaterial(
                                  section.id,
                                  item.material,
                                  item.pageSelection,
                                  item.id,
                                )
                              }
                            >
                              페이지
                            </FormButton>
                          ) : (
                            <FormButton
                              variant="action"
                              size="sm"
                              onClick={() =>
                                void selectMaterial(
                                  section.id,
                                  item.material,
                                  item.pageSelection,
                                  item.id,
                                )
                              }
                              aria-label="페이지 편집"
                            >
                              페이지
                            </FormButton>
                          )}
                          <FormButton variant="danger" size="sm" onClick={() => void removeItem(item)} aria-label="바인더에서 자료 제거">빼기</FormButton>
                        </div>
                      </div>
                    )
                  })}
                  <FormButton
                    variant="secondary"
                    className="personal-binder-section-card__add-material"
                    onClick={() => setMaterialSectionId(section.id)}
                  >
                    + 자료 추가
                  </FormButton>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>

      <BaseDialog
        open={sectionDialog != null}
        onClose={() => setSectionDialog(null)}
        closeOnBackdrop={false}
        ariaLabel="바인더 섹션"
      >
        <h2 className="personal-binder-dialog-title">
          {sectionDialog?.mode === 'create' ? '섹션 추가' : '섹션 이름 변경'}
        </h2>
        <FormInput
          value={sectionDialog?.title ?? ''}
          onChange={(event) =>
            setSectionDialog((dialog) =>
              dialog ? { ...dialog, title: event.target.value } : dialog,
            )
          }
          placeholder="예: 비급여 치료"
          aria-label="섹션 이름"
        />
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" onClick={() => setSectionDialog(null)}>취소</FormButton>
          <FormButton variant="primary" loading={saving} onClick={() => void saveSection()}>저장</FormButton>
        </div>
      </BaseDialog>

      <MaterialAddSourceDialog
        open={materialSectionId != null}
        token={token}
        materials={materials}
        mode="binder"
        onClose={() => setMaterialSectionId(null)}
        onMaterialReady={pickMaterialFromSource}
      />

      {!pageSelectionDock ? (
        <BinderPageSelectionDialog
          open={pageTarget != null}
          variant={isMobile ? 'mobile' : 'desktop'}
          binder={binder}
          folderLabel={binderFolderLabel}
          sectionTitle={
            pageTarget
              ? binder.sections.find((section) => section.id === pageTarget.sectionId)?.title ?? ''
              : ''
          }
          material={pageTarget?.material ?? null}
          pdfUrl={pdfUrl}
          initialSelection={pageTarget?.initialSelection ?? null}
          onClose={closePageSelection}
          onComplete={(selection) => void completeSelection(selection)}
        />
      ) : null}
      {confirmDialog}
    </main>
  )
}
