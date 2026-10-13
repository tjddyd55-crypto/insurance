import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import FileUploader from '../../../components/common/FileUploader'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { GaGroupLinkGaModal } from '../components/ga-groups/GaGroupLinkGaModal'
import { downloadGaGroupExcelSample } from '../components/ga-groups/downloadGaGroupExcelSample'
import {
  buildGaGroupLandingPath,
  buildGaGroupSignupPath,
  commitGaGroupExcel,
  createGaGroup,
  linkGasToGaGroup,
  listGaGroupMembers,
  listGaGroups,
  patchGaGroup,
  presignGaGroupLogo,
  previewGaGroupExcel,
  searchGasForGaGroup,
  unlinkGaFromGaGroup,
  uploadGaGroupLogoFile,
  type GaGroupExcelPreviewRow,
  type GaGroupRow,
} from '../api/gaGroupApi'
import '../ga-group-admin.css'

const DETAIL_TABS = [
  { id: 'settings', label: '기본 설정' },
  { id: 'members', label: '연결 GA' },
  { id: 'excel', label: '엑셀 등록' },
] as const

type DetailTabId = (typeof DETAIL_TABS)[number]['id']

const MEMBERS_PAGE_SIZE = 10

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

function summarizeExcelPreview(preview: GaGroupExcelPreviewRow[]) {
  return {
    createNew: preview.filter((r) => r.status === 'create_new').length,
    linkExisting: preview.filter((r) => r.status === 'link_existing').length,
    alreadyLinked: preview.filter((r) => r.status === 'already_linked').length,
    needsConfirm: preview.filter((r) => r.status === 'needs_move_confirm').length,
    errors: preview.filter((r) => r.status === 'error').length,
  }
}

export default function GaGroupManagementPage() {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<GaGroupRow[]>([])
  const [listQuery, setListQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTabId>('settings')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saveBusy, setSaveBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [logoNotice, setLogoNotice] = useState('')

  const [members, setMembers] = useState<Awaited<ReturnType<typeof listGaGroupMembers>>>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberFilter, setMemberFilter] = useState('')
  const [memberPage, setMemberPage] = useState(0)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)

  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<GaGroupExcelPreviewRow[] | null>(null)
  const [excelFileHash, setExcelFileHash] = useState('')
  const [excelDuplicate, setExcelDuplicate] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const filteredRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) {
      return rows
    }
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q),
    )
  }, [listQuery, rows])

  const loadList = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const list = await listGaGroups(token)
      setRows(list)
      if (selectedId != null && !list.some((r) => r.id === selectedId)) {
        setSelectedId(null)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedId, token, user?.role])

  const loadMembers = useCallback(async () => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    setMembersLoading(true)
    try {
      const list = await listGaGroupMembers(token, selectedId)
      setMembers(list)
      setMemberPage(0)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [selectedId, token])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selected) {
      setEditName(selected.name)
      setEditSlug(selected.slug)
      setEditActive(selected.isActive)
      void loadMembers()
    }
  }, [loadMembers, selected])

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase()
    if (!q) {
      return members
    }
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q),
    )
  }, [memberFilter, members])

  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PAGE_SIZE))
  const memberPageRows = useMemo(() => {
    const start = memberPage * MEMBERS_PAGE_SIZE
    return filteredMembers.slice(start, start + MEMBERS_PAGE_SIZE)
  }, [filteredMembers, memberPage])

  const selectGroup = (row: GaGroupRow) => {
    setSelectedId(row.id)
    setDetailTab('settings')
    setExcelPreview(null)
    setExcelFile(null)
    setExcelFileHash('')
    setMemberFilter('')
    setLogoError('')
    setLogoNotice('')
  }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    setCreateBusy(true)
    try {
      const created = await createGaGroup(token, { name: createName.trim(), slug: createSlug.trim() })
      setCreateOpen(false)
      setCreateName('')
      setCreateSlug('')
      await loadList()
      setSelectedId(created.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally {
      setCreateBusy(false)
    }
  }

  const saveGroup = async () => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    setSaveBusy(true)
    try {
      const updated = await patchGaGroup(token, selectedId, {
        name: editName.trim(),
        slug: editSlug.trim(),
        isActive: editActive,
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaveBusy(false)
    }
  }

  const searchGas = useCallback(
    async (q: string) => {
      if (!token?.trim() || selectedId == null) {
        return []
      }
      return searchGasForGaGroup(token, q, selectedId)
    },
    [selectedId, token],
  )

  const linkGasBulk = async (gaIds: number[], confirmMove: boolean): Promise<boolean> => {
    if (!token?.trim() || selectedId == null || gaIds.length === 0) {
      return false
    }
    if (confirmMove) {
      const ok = await confirm({
        title: '다른 그룹 GA 이동',
        message: '선택한 GA 중 다른 그룹에 속한 항목이 있습니다. 이 그룹으로 이동할까요?',
        confirmLabel: '이동 후 연결',
        tone: 'danger',
      })
      if (!ok) {
        return false
      }
    }
    setLinkBusy(true)
    try {
      await linkGasToGaGroup(token, selectedId, gaIds, confirmMove)
      await loadMembers()
      await loadList()
      return true
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '연결에 실패했습니다.')
      return false
    } finally {
      setLinkBusy(false)
    }
  }

  const unlinkMember = async (gaId: number) => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    const ok = await confirm({
      title: '연결 해제',
      message: '그룹 연결만 해제합니다. GA와 사용자 데이터는 삭제되지 않습니다.',
      confirmLabel: '해제',
      tone: 'danger',
    })
    if (!ok) {
      return
    }
    await unlinkGaFromGaGroup(token, selectedId, gaId)
    await loadMembers()
    await loadList()
  }

  const onLogoFiles = async (files: File[]) => {
    const file = files[0]
    if (!file || !token?.trim() || selectedId == null) {
      return
    }
    setLogoError('')
    setLogoNotice('')
    setLogoBusy(true)
    try {
      const presign = await presignGaGroupLogo(token, selectedId, file)
      await uploadGaGroupLogoFile(presign, file, { token, groupId: selectedId })
      const updated = await patchGaGroup(token, selectedId, { logoUrl: presign.publicUrl })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      setLogoNotice('로고가 저장되었습니다. 랜딩 페이지에도 반영됩니다.')
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : '로고 업로드에 실패했습니다.')
    } finally {
      setLogoBusy(false)
    }
  }

  const runExcelPreview = async (file: File) => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    setExcelBusy(true)
    try {
      const result = await previewGaGroupExcel(token, selectedId, file)
      setExcelPreview(result.preview)
      setExcelFileHash(result.fileHash)
      setExcelDuplicate(result.duplicateFile)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '엑셀 검증에 실패했습니다.')
      setExcelPreview(null)
    } finally {
      setExcelBusy(false)
    }
  }

  const commitExcel = async () => {
    if (!token?.trim() || selectedId == null || !excelPreview) {
      return
    }
    let forceDuplicateFile = false
    if (excelDuplicate) {
      const ok = await confirm({
        title: '동일 파일 재업로드',
        message: '이전에 처리한 엑셀과 동일합니다. 다시 등록할까요?',
        confirmLabel: '계속',
      })
      if (!ok) {
        return
      }
      forceDuplicateFile = true
    }
    const needsMove = excelPreview.some((r) => r.status === 'needs_move_confirm')
    if (needsMove) {
      const ok = await confirm({
        title: '다른 그룹 GA 이동',
        message: '일부 행은 다른 그룹에서 이 그룹으로 GA를 이동합니다. 진행할까요?',
        confirmLabel: '등록',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
    }
    setExcelBusy(true)
    try {
      const result = await commitGaGroupExcel(token, selectedId, {
        preview: excelPreview,
        fileHash: excelFileHash,
        allowMoveFromOtherGroup: needsMove,
        forceDuplicateFile,
      })
      window.alert(
        `등록 완료 — 신규 ${result.summary.created ?? 0}, 연결 ${result.summary.linked ?? 0}, 건너뜀 ${result.summary.skipped ?? 0}, 오류 ${result.summary.errors ?? 0}`,
      )
      setExcelPreview(null)
      setExcelFile(null)
      await loadMembers()
      await loadList()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setExcelBusy(false)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return <StatusMessage tone="error">슈퍼관리자만 접근할 수 있습니다.</StatusMessage>
  }

  const landingPath = selected ? buildGaGroupLandingPath(selected.slug) : ''
  const signupPath = selected ? buildGaGroupSignupPath(selected.slug) : ''
  const landingUrl = selected ? `${window.location.origin}${landingPath}` : ''
  const signupUrl = selected ? `${window.location.origin}${signupPath}` : ''
  const excelSummary = excelPreview ? summarizeExcelPreview(excelPreview) : null

  return (
    <main className="page page--with-back admin-page-shell ga-group-admin">
      {confirmDialog}
      <div className="admin-page-shell__inner">
        <header className="page-header admin-page-shell__header">
          <h1>GA 그룹 관리</h1>
          <p>그룹별 랜딩·전용 가입 페이지와 GA 연결을 관리합니다.</p>
        </header>

        {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
        {isLoading ? <LoadingState message="목록 불러오는 중…" /> : null}

        <div className="ga-group-admin__layout">
          <aside className="ga-group-admin__sidebar">
            <div className="ga-group-admin__sidebar-head">
              <FieldWrapper label="그룹 검색">
                <FormInput
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="그룹명·슬러그"
                />
              </FieldWrapper>
              <FormButton type="button" onClick={() => setCreateOpen(true)}>그룹 생성</FormButton>
            </div>
            {filteredRows.length === 0 && !isLoading ?
              <EmptyState title="그룹 없음" description="검색 결과가 없거나 그룹이 없습니다." />
            : null}
            <ul className="ga-group-admin__list">
              {filteredRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`ga-group-admin__list-btn${selectedId === row.id ? ' ga-group-admin__list-btn--active' : ''}`}
                    onClick={() => selectGroup(row)}
                  >
                    <strong>{row.name}</strong>
                    <div className="ga-group-admin__list-meta">
                      /g/{row.slug} · GA {row.gaCount ?? 0}
                      {!row.isActive ? ' · 비활성' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="ga-group-admin__detail">
            {!selected ?
              <EmptyState title="그룹 선택" description="왼쪽 목록에서 그룹을 선택하세요." />
            : <>
                <div className="ga-group-admin__detail-head">
                  {selected.logoUrl ?
                    <img src={selected.logoUrl} alt="" className="ga-group-admin__logo" />
                  : null}
                  <div>
                    <h2 style={{ margin: 0 }}>{selected.name}</h2>
                    <p className="ga-group-admin__list-meta" style={{ margin: '4px 0 0' }}>
                      /g/{selected.slug}
                    </p>
                  </div>
                </div>

                <nav className="billing-admin-tabs admin-page-shell__tabs" aria-label="그룹 상세 탭">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`billing-admin-tabs__btn${detailTab === tab.id ? ' billing-admin-tabs__btn--active' : ''}`}
                      onClick={() => setDetailTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>

                {detailTab === 'settings' ?
                  <div className="ga-group-admin__form">
                    <div className="ga-group-admin__actions">
                      <FormButton type="button" variant="secondary" onClick={() => copyText(landingUrl)}>
                        랜딩 링크 복사
                      </FormButton>
                      <FormButton type="button" variant="secondary" onClick={() => copyText(signupUrl)}>
                        가입 링크 복사
                      </FormButton>
                      <FormButton
                        type="button"
                        variant="secondary"
                        onClick={() => window.open(landingPath, '_blank')}
                      >
                        랜딩 미리보기
                      </FormButton>
                    </div>
                    <FieldWrapper label="그룹명">
                      <FormInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper label="URL 슬러그">
                      <FormInput value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                    </FieldWrapper>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <FormInput
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="shrink-0"
                      />
                      활성화
                    </label>
                    <FieldWrapper label="로고">
                      <StatusMessage message={logoError} tone="error" className="m-0 mb-2" />
                      <StatusMessage message={logoNotice} tone="success" className="m-0 mb-2" />
                      <FileUploader
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple={false}
                        disabled={logoBusy}
                        statusText={logoBusy ? '업로드 중…' : undefined}
                        onFiles={(files) => void onLogoFiles(files)}
                        primaryHint="로고 이미지를 드래그하거나 클릭하여 선택"
                        hintLines={['PNG · JPEG · WebP · GIF', '실패 시 기존 로고는 유지됩니다.']}
                      />
                    </FieldWrapper>
                    <FormButton type="button" disabled={saveBusy} onClick={() => void saveGroup()}>
                      저장
                    </FormButton>
                  </div>
                : null}

                {detailTab === 'members' ?
                  <>
                    <div className="ga-group-admin__members-toolbar">
                      <FormInput
                        className="ga-group-admin__members-search admin-form-input"
                        value={memberFilter}
                        onChange={(e) => {
                          setMemberFilter(e.target.value)
                          setMemberPage(0)
                        }}
                        placeholder="연결 GA 검색"
                      />
                      <FormButton type="button" onClick={() => setLinkModalOpen(true)}>GA 연결</FormButton>
                    </div>
                    {membersLoading ?
                      <LoadingState message="연결 GA 불러오는 중…" />
                    : filteredMembers.length === 0 ?
                      <EmptyState title="연결된 GA 없음" description="GA 연결 버튼으로 지점을 추가하세요." />
                    : <>
                        <div className="admin-data-table-wrap">
                          <table className="admin-data-table" style={{ minWidth: 480 }}>
                            <thead>
                              <tr>
                                <th>지점명</th>
                                <th>GA 코드</th>
                                <th className="admin-table-cell--actions">관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {memberPageRows.map((m) => (
                                <tr key={m.id}>
                                  <td>{m.name}</td>
                                  <td>{m.code}</td>
                                  <td className="admin-table-cell--actions">
                                    <FormButton
                                      type="button"
                                      variant="secondary"
                                      onClick={() => void unlinkMember(m.id)}
                                    >
                                      연결 해제
                                    </FormButton>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {filteredMembers.length > MEMBERS_PAGE_SIZE ?
                          <div className="ga-group-admin__pager">
                            <FormButton
                              type="button"
                              variant="secondary"
                              disabled={memberPage <= 0}
                              onClick={() => setMemberPage((p) => Math.max(0, p - 1))}
                            >
                              이전
                            </FormButton>
                            <span>
                              {memberPage + 1} / {memberPageCount} ({filteredMembers.length}건)
                            </span>
                            <FormButton
                              type="button"
                              variant="secondary"
                              disabled={memberPage >= memberPageCount - 1}
                              onClick={() => setMemberPage((p) => Math.min(memberPageCount - 1, p + 1))}
                            >
                              다음
                            </FormButton>
                          </div>
                        : null}
                      </>
                    }
                  </>
                : null}

                {detailTab === 'excel' ?
                  <div className="admin-tab-panel admin-tab-panel--card">
                    <p className="ga-group-admin__list-meta" style={{ marginTop: 0 }}>
                      열: 지점명(필수), GA 코드(선택). 코드가 비어 있으면 신규 GA를 생성합니다.
                    </p>
                    <div className="ga-group-admin__actions">
                      <FormButton type="button" variant="secondary" onClick={() => downloadGaGroupExcelSample()}>
                        샘플 다운로드
                      </FormButton>
                    </div>
                    <FieldWrapper label="엑셀 파일 (.xlsx / .xls)">
                      <FileUploader
                        accept=".xlsx,.xls"
                        multiple={false}
                        disabled={excelBusy}
                        statusText={excelBusy ? '검증 중…' : undefined}
                        selectedNames={excelFile ? [excelFile.name] : []}
                        onFiles={(files) => {
                          const file = files[0]
                          if (!file) {
                            return
                          }
                          setExcelFile(file)
                          void runExcelPreview(file)
                        }}
                        primaryHint="엑셀 파일을 드래그하거나 클릭하여 선택"
                        hintLines={['업로드 후 자동으로 사전 검증 미리보기가 표시됩니다.']}
                      />
                    </FieldWrapper>
                    {excelSummary ?
                      <>
                        <div className="ga-group-admin__excel-summary">
                          <span>신규 생성 {excelSummary.createNew}</span>
                          <span>기존 연결 {excelSummary.linkExisting}</span>
                          <span>중복 {excelSummary.alreadyLinked}</span>
                          <span>확인 필요 {excelSummary.needsConfirm}</span>
                          <span>오류 {excelSummary.errors}</span>
                        </div>
                        <div className="ga-group-admin__excel-preview">
                          {excelPreview?.map((row) => (
                            <div key={row.rowNumber}>
                              {row.rowNumber}. {row.branchName} — {row.status}: {row.message}
                            </div>
                          ))}
                        </div>
                        <FormButton type="button" disabled={excelBusy} onClick={() => void commitExcel()}>
                          등록 실행
                        </FormButton>
                      </>
                    : null}
                  </div>
                : null}
              </>
            }
          </section>
        </div>
      </div>

      {selected ?
        <GaGroupLinkGaModal
          open={linkModalOpen}
          groupId={selected.id}
          groupName={selected.name}
          busy={linkBusy}
          onClose={() => setLinkModalOpen(false)}
          onSearch={searchGas}
          onLink={linkGasBulk}
        />
      : null}

      <FormDialog
        open={createOpen}
        title="GA 그룹 생성"
        onClose={() => !createBusy && setCreateOpen(false)}
      >
        <form onSubmit={(e) => void submitCreate(e)} className="ga-group-admin__form">
          <FieldWrapper label="그룹명">
            <FormInput value={createName} onChange={(e) => setCreateName(e.target.value)} required />
          </FieldWrapper>
          <FieldWrapper label="URL 슬러그 (예: yjasset)">
            <FormInput value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} required />
          </FieldWrapper>
          <FormButton htmlType="submit" disabled={createBusy}>생성</FormButton>
        </form>
      </FormDialog>
    </main>
  )
}
