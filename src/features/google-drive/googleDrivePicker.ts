import { ApiError } from '../../lib/apiClient'
import type { GoogleDrivePickerState } from './googleDriveApi'

export const PICKER_IMPORT_MIME = 'application/pdf,image/jpeg,image/png'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const MAX_PICK = 10

export type PickedDoc = { id: string; name: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & { gapi?: any; google?: any }

let gapiLoading: Promise<void> | null = null

/** Google Picker 스크립트(apis.google.com/js/api.js)를 한 번만 불러온다. */
export function loadPicker(): Promise<void> {
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

/**
 * mode 'files': PDF·JPG·PNG 파일 선택. 폴더를 열어 들어갈 수 있다(내 드라이브 폴더 탐색 보기 + 전체 보기).
 * mode 'folder': 폴더 하나 선택(setSelectFolderEnabled). 사본을 올릴 대상 폴더.
 */
export function openPicker(state: GoogleDrivePickerState, options: { mode: 'files' | 'folder'; multiple?: boolean }): Promise<PickedDoc[]> {
  const w = window as AnyWindow
  return new Promise((resolve) => {
    const gp = w.google.picker
    let builder = new gp.PickerBuilder()
      .setOAuthToken(state.accessToken)
      .setDeveloperKey(state.apiKey)
      .setAppId(state.appId)
      .setLocale('ko')
    if (options.mode === 'folder') {
      const folders = new gp.DocsView(gp.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_MIME).setParent('root')
      builder = builder.addView(folders).setTitle('사본을 올릴 Google Drive 폴더 선택')
    } else {
      const tree = new gp.DocsView(gp.ViewId.DOCS).setMimeTypes(PICKER_IMPORT_MIME).setIncludeFolders(true).setSelectFolderEnabled(false).setParent('root')
      const all = new gp.DocsView(gp.ViewId.DOCS).setMimeTypes(PICKER_IMPORT_MIME).setIncludeFolders(true).setSelectFolderEnabled(false)
      builder = builder.addView(tree).addView(all)
      if (options.multiple) builder = builder.enableFeature(gp.Feature.MULTISELECT_ENABLED)
    }
    builder
      .setCallback((data: Record<string, unknown>) => {
        const action = data[gp.Response.ACTION]
        if (action === gp.Action.PICKED) {
          const docs = (data[gp.Response.DOCUMENTS] as Array<Record<string, unknown>>) ?? []
          resolve(docs.slice(0, MAX_PICK).map((doc) => ({ id: String(doc[gp.Document.ID]), name: String(doc[gp.Document.NAME] ?? '') })))
        } else if (action === gp.Action.CANCEL) {
          resolve([])
        }
      })
      .build()
      .setVisible(true)
  })
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message === 'picker_load_failed') return 'Google Drive 선택 창을 불러오지 못했습니다.'
  return 'Google Drive 에서 가져오지 못했습니다.'
}
