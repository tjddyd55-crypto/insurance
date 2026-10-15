import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FormDialog } from '../../components/dialog'
import FormSelect from '../../components/form/FormSelect'
import { Button } from '../../components/ui'
import type { StorageFileRow, StorageFolderRow } from '../storage/api/storageApi'
import GoogleDriveImportButton from './GoogleDriveImportButton'
import { exportToGoogleDrive, fetchGoogleDrivePicker, type GoogleDrivePickerState } from './googleDriveApi'
import { loadPicker, MAX_PICK, messageOf, openPicker } from './googleDrivePicker'

const ROOT = '__root__'

/**
 * t308: 내 저장 공간 폴더 영역 아래 'Google Drive' 섹션.
 * - 가져오기: ONE FC 저장 폴더를 고른 뒤 Picker(폴더 탐색)로 PDF·JPG·PNG 선택 → 서버가 기존 저장 경로로 복사.
 * - 보내기: ONE FC 파일 선택 + Drive 폴더(Picker 폴더 선택) → 서버가 사본을 새로 올린다(기존 Drive 파일 무변경).
 * GOOGLE_DRIVE_ENABLED 이 꺼져 있거나 Google 미연결이면 아무것도 그리지 않는다.
 */
export default function GoogleDriveStoragePanel({
  token,
  folders,
  files,
  currentFolderId,
  onImported,
  onError,
}: {
  token: string | null
  folders: StorageFolderRow[]
  files: StorageFileRow[]
  currentFolderId: number | null
  onImported: () => void
  onError: (message: string) => void
}) {
  const [state, setState] = useState<GoogleDrivePickerState | null>(null)
  const [destFolder, setDestFolder] = useState<string>(currentFolderId == null ? ROOT : String(currentFolderId))
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [driveFolder, setDriveFolder] = useState<{ id: string | null; name: string }>({ id: null, name: '내 드라이브' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const busyRef = useRef(false)

  useEffect(() => {
    setDestFolder(currentFolderId == null ? ROOT : String(currentFolderId))
  }, [currentFolderId])

  const load = useCallback(async () => {
    if (!token?.trim()) return null
    try {
      const next = await fetchGoogleDrivePicker(token)
      setState(next)
      return next
    } catch {
      setState(null)
      return null
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const folderOptions = useMemo(
    () => [{ value: ROOT, label: '전체(폴더 없음)' }, ...folders.map((f) => ({ value: String(f.id), label: f.name }))],
    [folders],
  )

  if (!state?.enabled || !state.connected) return null

  const ready = state.driveGranted && state.pickerConfigured

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_PICK ? prev : [...prev, id]))
  }

  const chooseDriveFolder = async () => {
    try {
      const fresh = await load()
      if (!fresh?.accessToken || !fresh.apiKey || !fresh.appId) {
        setResult('Google Drive 선택 창 설정이 아직 없습니다.')
        return
      }
      await loadPicker()
      const picked = await openPicker(fresh, { mode: 'folder' })
      if (picked[0]) setDriveFolder({ id: picked[0].id, name: picked[0].name || 'Google Drive 폴더' })
    } catch (error) {
      setResult(messageOf(error))
    }
  }

  const send = async () => {
    if (!token?.trim() || busyRef.current || selected.length === 0) return
    busyRef.current = true
    setBusy(true)
    setResult('')
    try {
      const out = await exportToGoogleDrive(token, { fileIds: selected, driveFolderId: driveFolder.id })
      const failed = out.results.filter((r) => !r.ok)
      const head = `Google Drive '${out.folder.name || driveFolder.name}' 폴더에 ${out.okCount}개를 보냈습니다.`
      setResult(failed.length ? `${head} 실패 ${failed.length}개: ${failed.map((r) => `${r.name || r.fileId} (${r.message ?? '실패'})`).join(' / ')}` : head)
      if (out.okCount > 0) setSelected([])
    } catch (error) {
      setResult(messageOf(error).replace('가져오지', '보내지'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const closeExport = () => {
    if (busyRef.current) return
    setExportOpen(false)
    setResult('')
  }

  return (
    <section className="storage-drive-panel" aria-label="Google Drive">
      <div className="storage-drive-panel__head">
        <span className="storage-drive-panel__title">Google Drive</span>
        {state.accountEmail ? <span className="storage-drive-panel__account">{state.accountEmail}</span> : null}
      </div>
      {ready ? (
        <label className="storage-drive-panel__field">
          <span>가져올 위치</span>
          <FormSelect
            value={destFolder}
            options={folderOptions}
            aria-label="가져올 ONE FC 폴더"
            onChange={(event) => setDestFolder(event.target.value)}
          />
        </label>
      ) : null}
      <div className="storage-drive-panel__actions">
        <GoogleDriveImportButton
          token={token}
          folderId={destFolder === ROOT ? null : destFolder}
          label="Drive에서 가져오기"
          onImported={(imported) => {
            if (imported.length) onImported()
          }}
          onError={onError}
        />
        {ready ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
            Drive로 보내기
          </Button>
        ) : null}
      </div>

      {exportOpen ? (
        <FormDialog
          open
          title="Google Drive로 보내기"
          disableClose={busy}
          onClose={closeExport}
          footer={(
            <>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={closeExport}>닫기</Button>
              <Button
                type="button"
                size="sm"
                loading={busy}
                loadingText="보내는 중…"
                disabled={selected.length === 0}
                onClick={() => void send()}
              >
                {selected.length ? `${selected.length}개 보내기` : '보내기'}
              </Button>
            </>
          )}
        >
          <p className="storage-drive-panel__hint">선택한 파일의 사본을 Google Drive 에 새로 만듭니다. Drive 에 있던 파일은 바꾸거나 지우지 않습니다. (최대 {MAX_PICK}개, 25MB 이하, 고객 파일 제외)</p>
          <div className="storage-drive-panel__target">
            <span>보낼 폴더: <strong>{driveFolder.name}</strong></span>
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void chooseDriveFolder()}>Drive 폴더 선택</Button>
          </div>
          <ul className="storage-drive-panel__files">
            {files.length === 0 ? <li className="storage-drive-panel__empty">보낼 수 있는 파일이 없습니다.</li> : null}
            {files.map((file) => {
              const on = selected.includes(file.id)
              return (
                <li key={file.id}>
                  <Button
                    type="button"
                    variant={on ? 'primary' : 'secondary'}
                    size="sm"
                    aria-pressed={on}
                    disabled={busy}
                    className="storage-drive-panel__file"
                    onClick={() => toggle(file.id)}
                  >
                    {on ? '✓ ' : ''}{file.displayName || file.originalName || file.fileName}
                  </Button>
                </li>
              )
            })}
          </ul>
          {result ? <p className="storage-drive-panel__result" role="status">{result}</p> : null}
        </FormDialog>
      ) : null}
    </section>
  )
}
