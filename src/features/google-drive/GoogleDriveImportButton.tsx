import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { ApiError } from '../../lib/apiClient'
import { isDesktopAppRuntime } from '../service-integrations/hooks/useServiceIntegrationsState'
import type { StorageFileRow } from '../storage/api/storageApi'
import {
  fetchGoogleDrivePicker,
  importGoogleDriveFile,
  startGoogleDriveConsent,
  type GoogleDrivePickerState,
} from './googleDriveApi'

const PICKER_MIME = 'application/pdf,image/jpeg,image/png'
const MAX_PICK = 10

type PickedDoc = { id: string; name: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & { gapi?: any; google?: any }

let gapiLoading: Promise<void> | null = null

/** Google Picker 스크립트(apis.google.com/js/api.js)를 한 번만 불러온다. */
function loadPicker(): Promise<void> {
  const w = window as AnyWindow
  if (w.google?.picker) return Promise.resolve()
  if (!gapiLoading) {
    gapiLoading = new Promise<void>((resolve, reject) => {
      const done = () => w.gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('picker_load_failed')) })
      if (w.gapi) {
        done()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.async = true
      script.onload = done
      script.onerror = () => {
        gapiLoading = null
        reject(new Error('picker_load_failed'))
      }
      document.head.appendChild(script)
    })
  }
  return gapiLoading
}

function openPicker(state: GoogleDrivePickerState, multiple: boolean): Promise<PickedDoc[]> {
  const w = window as AnyWindow
  return new Promise((resolve) => {
    const gp = w.google.picker
    const view = new gp.DocsView(gp.ViewId.DOCS).setMimeTypes(PICKER_MIME).setIncludeFolders(true).setSelectFolderEnabled(false)
    let builder = new gp.PickerBuilder()
      .addView(view)
      .setOAuthToken(state.accessToken)
      .setDeveloperKey(state.apiKey)
      .setAppId(state.appId)
      .setLocale('ko')
      .setCallback((data: Record<string, unknown>) => {
        const action = data[gp.Response.ACTION]
        if (action === gp.Action.PICKED) {
          const docs = (data[gp.Response.DOCUMENTS] as Array<Record<string, unknown>>) ?? []
          resolve(docs.slice(0, MAX_PICK).map((doc) => ({ id: String(doc[gp.Document.ID]), name: String(doc[gp.Document.NAME] ?? '') })))
        } else if (action === gp.Action.CANCEL) {
          resolve([])
        }
      })
    if (multiple) builder = builder.enableFeature(gp.Feature.MULTISELECT_ENABLED)
    builder.build().setVisible(true)
  })
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message === 'picker_load_failed') return 'Google Drive 선택 창을 불러오지 못했습니다.'
  return 'Google Drive 에서 가져오지 못했습니다.'
}

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
      const docs = await openPicker(fresh, multiple)
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
