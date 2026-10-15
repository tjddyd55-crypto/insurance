import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { isDesktopAppRuntime } from '../service-integrations/hooks/useServiceIntegrationsState'
import type { StorageFileRow } from '../storage/api/storageApi'
import { loadPicker, messageOf, openPicker } from './googleDrivePicker'
import {
  fetchGoogleDrivePicker,
  importGoogleDriveFile,
  startGoogleDriveConsent,
  type GoogleDrivePickerState,
} from './googleDriveApi'


/**
 * t307 PR-B: Google Drive 에서 PDF·JPG·PNG 를 골라 ONE FC 로 복사해 온다(원본은 그대로).
 * 기능이 꺼져 있으면(GOOGLE_DRIVE_ENABLED) 아무것도 그리지 않는다. Picker 키가 없으면 안내만 한다.
 */
export default function GoogleDriveImportButton({
  token,
  customerId = null,
  folderId = null,
  multiple = true,
  label = 'Google Drive에서 가져오기',
  onImported,
  onError,
}: {
  token: string | null
  customerId?: number | null
  folderId?: string | number | null
  multiple?: boolean
  label?: string
  onImported: (files: StorageFileRow[], failures: string[]) => void
  onError?: (message: string) => void
}) {
  const [state, setState] = useState<GoogleDrivePickerState | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)

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

  if (!state?.enabled || !state.connected) return null

  const report = (message: string) => {
    setNotice(message)
    onError?.(message)
  }

  const run = async () => {
    if (!token?.trim() || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setNotice('')
    try {
      if (!state.driveGranted) {
        const desktop = isDesktopAppRuntime()
        const url = await startGoogleDriveConsent(token, desktop)
        if (!/^https:\/\/accounts\.google\.com\//.test(url)) throw new Error('bad_url')
        if (desktop) {
          window.open(url, '_blank', 'noopener,noreferrer')
          setNotice('브라우저에서 권한 허용을 마친 뒤 다시 눌러 주세요.')
        } else {
          window.location.assign(url)
        }
        return
      }
      // 토큰은 짧게 살아 있으므로 열 때마다 새로 받는다.
      const fresh = await load()
      if (!fresh?.accessToken || !fresh.apiKey || !fresh.appId) {
        report('Google Drive 선택 창 설정이 아직 없습니다.')
        return
      }
      await loadPicker()
      const docs = await openPicker(fresh, { mode: 'files', multiple })
      if (docs.length === 0) return
      const imported: StorageFileRow[] = []
      const failures: string[] = []
      for (const doc of docs) {
        try {
          imported.push(await importGoogleDriveFile(token, { driveFileId: doc.id, customerId, folderId }))
        } catch (error) {
          failures.push(`${doc.name || '파일'}: ${messageOf(error)}`)
        }
      }
      if (failures.length) report(failures.join(' / '))
      onImported(imported, failures)
    } catch (error) {
      report(messageOf(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const disabled = state.driveGranted && !state.pickerConfigured
  return (
    <span className="google-drive-import">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy}
        loadingText="가져오는 중…"
        disabled={disabled}
        title={state.accountEmail ? `Google 계정: ${state.accountEmail}` : undefined}
        onClick={() => void run()}
      >
        {state.driveGranted ? label : 'Google Drive 권한 허용'}
      </Button>
      {disabled ? <span className="google-drive-import__note">Google Drive 연결 준비 중</span> : null}
      {notice ? <span className="google-drive-import__note" role="status">{notice}</span> : null}
    </span>
  )
}
