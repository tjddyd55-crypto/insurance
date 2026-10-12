import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
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
  type GaGroupSearchGaRow,
} from '../api/gaGroupApi'

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

export default function GaGroupManagementPage() {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<GaGroupRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
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

  const [members, setMembers] = useState<Awaited<ReturnType<typeof listGaGroupMembers>>>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [gaSearchQ, setGaSearchQ] = useState('')
  const [gaSearchRows, setGaSearchRows] = useState<GaGroupSearchGaRow[]>([])
  const [gaSearchBusy, setGaSearchBusy] = useState(false)

  const [excelPreview, setExcelPreview] = useState<GaGroupExcelPreviewRow[] | null>(null)
  const [excelFileHash, setExcelFileHash] = useState('')
  const [excelDuplicate, setExcelDuplicate] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

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

  const selectGroup = (row: GaGroupRow) => {
    setSelectedId(row.id)
    setExcelPreview(null)
    setExcelFileHash('')
    setGaSearchRows([])
    setGaSearchQ('')
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

  const runGaSearch = async () => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    setGaSearchBusy(true)
    try {
      const list = await searchGasForGaGroup(token, gaSearchQ, selectedId)
      setGaSearchRows(list)
    } finally {
      setGaSearchBusy(false)
    }
  }

  const linkGa = async (row: GaGroupSearchGaRow) => {
    if (!token?.trim() || selectedId == null) {
      return
    }
    if (row.inOtherGroup && row.groupName) {
      const ok = await confirm({
        title: '다른 그룹 GA 이동',
        message: `「${row.name}」은 현재 「${row.groupName}」 그룹에 연결되어 있습니다. 이 그룹으로 이동할까요?`,
        confirmLabel: '이동',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      try {
        await linkGasToGaGroup(token, selectedId, [row.id], true)
        await loadMembers()
        await loadList()
        await runGaSearch()
      } catch (err) {
        window.alert(err instanceof Error ? err.message : '연결에 실패했습니다.')
      }
      return
    }
    try {
      await linkGasToGaGroup(token, selectedId, [row.id], false)
      await loadMembers()
      await loadList()
      await runGaSearch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '연결에 실패했습니다.')
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

  const onLogoFile = async (file: File | null) => {
    if (!file || !token?.trim() || selectedId == null) {
      return
    }
    try {
      const presign = await presignGaGroupLogo(token, selectedId, file)
      await uploadGaGroupLogoFile(presign, file)
      const updated = await patchGaGroup(token, selectedId, { logoUrl: presign.publicUrl })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '로고 업로드에 실패했습니다.')
    }
  }

  const onExcelPick = async (file: File | null) => {
    if (!file || !token?.trim() || selectedId == null) {
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
    const needsName = excelPreview.some((r) => r.needsNameConfirm)
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
    if (needsName) {
      const ok = await confirm({
        title: '지점명 확인',
        message: '유사·동일 지점명이 있는 행이 있습니다. 확인 후 등록합니다.',
        confirmLabel: '등록',
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
        confirmSimilarNames: needsName,
        forceDuplicateFile,
      })
      window.alert(
        `등록 완료 — 신규 ${result.summary.created ?? 0}, 연결 ${result.summary.linked ?? 0}, 건너뜀 ${result.summary.skipped ?? 0}, 오류 ${result.summary.errors ?? 0}`,
      )
      setExcelPreview(null)
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

  const landingUrl = selected ? buildGaGroupLandingPath(selected.slug) : ''
  const signupUrl = selected ? buildGaGroupSignupPath(selected.slug) : ''

  return (
    <div className="admin-page" style={{ display: 'grid', gap: 16 }}>
      {confirmDialog}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>GA 그룹 관리</h1>
        <FormButton type="button" onClick={() => setCreateOpen(true)}>그룹 생성</FormButton>
      </header>

      {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
      {isLoading ? <LoadingState label="목록 불러오는 중…" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 2fr)', gap: 16 }}>
        <section className="card" style={{ padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>그룹 목록</h2>
          {rows.length === 0 && !isLoading ?
            <EmptyState title="그룹 없음" description="새 그룹을 생성하세요." />
          : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => selectGroup(row)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 8px',
                    border: 'none',
                    borderRadius: 8,
                    background: selectedId === row.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <strong>{row.name}</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    /g/{row.slug} · GA {row.gaCount ?? 0}
                    {!row.isActive ? ' · 비활성' : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" style={{ padding: 16 }}>
          {!selected ?
            <EmptyState title="그룹 선택" description="왼쪽에서 그룹을 선택하세요." />
          : <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                {selected.logoUrl ?
                  <img src={selected.logoUrl} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                : null}
                <div>
                  <h2 style={{ margin: 0 }}>{selected.name}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    랜딩 {landingUrl} · 가입 {signupUrl}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <FormButton type="button" variant="secondary" onClick={() => copyText(landingUrl)}>
                  랜딩 링크 복사
                </FormButton>
                <FormButton type="button" variant="secondary" onClick={() => copyText(signupUrl)}>
                  가입 링크 복사
                </FormButton>
                <FormButton type="button" variant="secondary" onClick={() => window.open(landingUrl, '_blank')}>
                  랜딩 미리보기
                </FormButton>
              </div>

              <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                <FieldWrapper label="그룹명">
                  <FormInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                </FieldWrapper>
                <FieldWrapper label="URL 슬러그">
                  <FormInput value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                </FieldWrapper>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  활성화
                </label>
                <FieldWrapper label="로고">
                  <input type="file" accept="image/*" onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)} />
                </FieldWrapper>
                <FormButton type="button" disabled={saveBusy} onClick={() => void saveGroup()}>
                  저장
                </FormButton>
              </div>

              <h3>연결 GA</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <FormInput
                  value={gaSearchQ}
                  onChange={(e) => setGaSearchQ(e.target.value)}
                  placeholder="GA 이름·코드 검색"
                />
                <FormButton type="button" disabled={gaSearchBusy} onClick={() => void runGaSearch()}>
                  검색
                </FormButton>
              </div>
              {gaSearchRows.length > 0 ?
                <ul style={{ fontSize: 14, marginBottom: 16 }}>
                  {gaSearchRows.map((g) => (
                    <li key={g.id} style={{ marginBottom: 6 }}>
                      {g.name} ({g.code})
                      {g.groupName ? ` — ${g.groupName}` : ''}
                      <FormButton
                        type="button"
                        variant="secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => void linkGa(g)}
                      >
                        연결
                      </FormButton>
                    </li>
                  ))}
                </ul>
              : null}

              {membersLoading ?
                <LoadingState label="연결 GA 불러오는 중…" />
              : <ul style={{ fontSize: 14 }}>
                  {members.map((m) => (
                    <li key={m.id} style={{ marginBottom: 6 }}>
                      {m.name} ({m.code})
                      <FormButton
                        type="button"
                        variant="secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => void unlinkMember(m.id)}
                      >
                        연결 해제
                      </FormButton>
                    </li>
                  ))}
                </ul>
              }

              <h3>엑셀 대량 등록</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                열: 지점명, GA 코드(선택). 공란 시 신규 GA 생성·자동 코드 발급.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={excelBusy}
                onChange={(e) => void onExcelPick(e.target.files?.[0] ?? null)}
              />
              {excelPreview ?
                <>
                  <p style={{ fontSize: 13 }}>미리보기 {excelPreview.length}행</p>
                  <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12, marginBottom: 8 }}>
                    {excelPreview.map((row) => (
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
            </>
          }
        </section>
      </div>

      <FormDialog
        open={createOpen}
        title="GA 그룹 생성"
        onClose={() => !createBusy && setCreateOpen(false)}
      >
        <form onSubmit={(e) => void submitCreate(e)}>
          <FieldWrapper label="그룹명">
            <FormInput value={createName} onChange={(e) => setCreateName(e.target.value)} required />
          </FieldWrapper>
          <FieldWrapper label="URL 슬러그 (예: yjasset)">
            <FormInput value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} required />
          </FieldWrapper>
          <FormButton htmlType="submit" disabled={createBusy}>생성</FormButton>
        </form>
      </FormDialog>
    </div>
  )
}
