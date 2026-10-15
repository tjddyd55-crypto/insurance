/**
 * t308: ONE FC 파일 → Google Drive 로 "사본 올리기". drive.file 범위만 쓴다.
 * - Drive 에는 새 파일 생성(POST multipart)만 한다. 기존 Drive 파일 수정·삭제 요청은 없다.
 * - 대상 폴더는 사용자가 Picker 로 고른 폴더(앱 접근 허용됨) 또는 내 드라이브 루트.
 * - ONE FC 파일은 요청한 사용자 본인(같은 GA) 개인 파일만. 고객 파일은 보내지 않는다.
 */
import { randomBytes } from 'node:crypto'
import { assertGoogleDriveReady, DRIVE_ERROR_MESSAGES, normalizeDriveFileId } from './googleDriveService.js'
import { googleError } from './googleTokenService.js'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const DRIVE_EXPORT_MAX_FILES = 10
export const DRIVE_EXPORT_MAX_BYTES = 25 * 1024 * 1024
export const DRIVE_EXPORT_MIME = Object.freeze(new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
]))

export const DRIVE_EXPORT_ERRORS = Object.freeze({
  ...DRIVE_ERROR_MESSAGES,
  export_no_files: [400, '보낼 파일을 선택해 주세요.'],
  export_too_many: [400, `한 번에 ${DRIVE_EXPORT_MAX_FILES}개까지 보낼 수 있습니다.`],
  export_folder_invalid: [400, 'Google Drive 폴더를 다시 선택해 주세요.'],
  export_folder_not_writable: [403, '이 Google Drive 폴더에는 파일을 추가할 수 없습니다. 다른 폴더를 선택해 주세요.'],
  export_in_progress: [409, '이미 Google Drive 로 보내는 중입니다.'],
})

const FILE_ERRORS = Object.freeze({
  file_invalid: '잘못된 파일입니다.',
  file_not_found: '파일을 찾을 수 없습니다.',
  file_customer: '고객 파일은 Google Drive 로 보낼 수 없습니다.',
  file_type: '이 형식은 Google Drive 로 보낼 수 없습니다(PDF·이미지·엑셀·CSV).',
  file_too_large: '25MB 이하 파일만 보낼 수 있습니다.',
  file_read: '파일을 읽지 못했습니다.',
  upload_failed: 'Google Drive 에 올리지 못했습니다.',
})

/** Drive 에 올릴 이름: 경로·제어 문자 제거, 길이 제한. */
export function driveExportName(raw) {
  const name = String(raw ?? '').replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
  return name || 'onefc-file'
}

/** @param {unknown} raw  배열 → 고유 양의 정수 id 목록 */
export function normalizeExportFileIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw googleError('export_no_files')
  const ids = [...new Set(raw.map((v) => Number(v)))]
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw googleError('export_no_files')
  if (ids.length > DRIVE_EXPORT_MAX_FILES) throw googleError('export_too_many')
  return ids
}

/** multipart/related 본문(메타 JSON + 바이트). */
export function buildMultipartBody(metadata, buffer, contentType) {
  const boundary = `onefc${randomBytes(12).toString('hex')}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf8',
  )
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8')
  return { body: Buffer.concat([head, buffer, tail]), contentType: `multipart/related; boundary=${boundary}` }
}

async function call(fetchImpl, url, init, timeoutMs = 60000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch (error) {
    throw googleError(error?.name === 'AbortError' ? 'google_timeout' : 'google_unavailable')
  } finally {
    clearTimeout(timer)
  }
}

async function reasonOf(response) {
  try {
    const body = await response.json()
    return String(body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '')
  } catch {
    return ''
  }
}

async function throwForStatus(response, notFoundCode) {
  if (response.status === 401) throw googleError('google_unauthorized')
  if (response.status === 404) throw googleError(notFoundCode)
  if (response.status === 403) {
    const reason = await reasonOf(response)
    if (/rateLimit|quota|RESOURCE_EXHAUSTED/i.test(reason)) throw googleError('google_rate_limited')
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) throw googleError('google_api_disabled')
    if (/insufficientFilePermissions|forbidden|cannotAddParent|teamDrive/i.test(reason)) throw googleError(notFoundCode === 'export_folder_invalid' ? 'export_folder_not_writable' : 'upload_failed')
    if (/insufficient|SCOPE/i.test(reason)) throw googleError('drive_scope_missing')
    if (/storageQuota/i.test(reason)) throw googleError('upload_failed')
    throw googleError(notFoundCode === 'export_folder_invalid' ? 'export_folder_not_writable' : 'upload_failed')
  }
  if (response.status === 429) throw googleError('google_rate_limited')
  if (!response.ok) throw googleError('google_unavailable')
}

/**
 * 대상 폴더 확인(GET 만). null 이면 내 드라이브 루트.
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function readDriveTargetFolder(access, folderId) {
  if (folderId == null || folderId === '' || folderId === 'root') return { id: 'root', name: '내 드라이브' }
  let id
  try {
    id = normalizeDriveFileId(folderId)
  } catch {
    throw googleError('export_folder_invalid')
  }
  const url = new URL(`${DRIVE_BASE}/${encodeURIComponent(id)}`)
  url.searchParams.set('fields', 'id,name,mimeType,trashed,capabilities(canAddChildren)')
  url.searchParams.set('supportsAllDrives', 'true')
  const response = await call(access.fetchImpl ?? fetch, url, { method: 'GET', headers: { Authorization: `Bearer ${access.accessToken}` } }, 15000)
  await throwForStatus(response, 'export_folder_invalid')
  const meta = await response.json()
  if (!meta || meta.id !== id || meta.trashed === true || meta.mimeType !== FOLDER_MIME) throw googleError('export_folder_invalid')
  if (meta.capabilities && meta.capabilities.canAddChildren === false) throw googleError('export_folder_not_writable')
  return { id, name: String(meta.name ?? '') }
}

/** 새 파일 생성(POST multipart). 기존 파일을 건드리는 요청은 만들지 않는다. */
export async function uploadDriveFile(access, { name, mimeType, buffer, parentId }) {
  const url = new URL(UPLOAD_BASE)
  url.searchParams.set('uploadType', 'multipart')
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('fields', 'id,name,mimeType,size,parents,webViewLink')
  const metadata = { name, mimeType, parents: [parentId], appProperties: { onefc: '1' } }
  const mp = buildMultipartBody(metadata, buffer, mimeType)
  const response = await call(access.fetchImpl ?? fetch, url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': mp.contentType },
    body: mp.body,
  }, 120000)
  await throwForStatus(response, 'export_folder_invalid')
  const created = await response.json()
  if (!created?.id) throw googleError('upload_failed')
  if (Number(created.size) !== buffer.length) {
    // 받은 크기가 다르면 실패로 본다(앱이 방금 만든 파일이라 남겨도 원본 훼손은 없음).
    throw googleError('upload_failed')
  }
  return { id: String(created.id), name: String(created.name ?? name), webViewLink: String(created.webViewLink ?? '') }
}

const inFlight = new Set()
export function acquireDriveExportLock(userId) {
  const key = String(userId)
  if (inFlight.has(key)) throw googleError('export_in_progress')
  inFlight.add(key)
  return () => inFlight.delete(key)
}

/**
 * @param {{
 *   pool: any,
 *   getOwnedFile: (fileId: number, userId: string, gaId: any) => Promise<any>,
 *   readBuffer: (filePath: string) => Promise<Buffer>,
 *   withAccess: (userId: string, run: (accessToken: string) => Promise<any>) => Promise<any>,
 *   fetchImpl?: typeof fetch,
 *   assertReady?: (pool: any, userId: string) => Promise<unknown>,
 * }} deps
 */
export function createDriveExport(deps) {
  return async function exportToDrive(req, input) {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) return { status: 401, body: { message: '로그인이 필요합니다.' } }
    let release = () => {}
    try {
      await (deps.assertReady ?? assertGoogleDriveReady)(deps.pool, userId)
      const ids = normalizeExportFileIds(input.fileIds)
      release = acquireDriveExportLock(userId)
      // 1) ONE FC 쪽 검사(본인 개인 파일·형식·크기) — Drive 호출 전에 모두 확인
      const prepared = []
      for (const id of ids) {
        const file = await deps.getOwnedFile(id, userId, input.gaId)
        if (!file) { prepared.push({ fileId: id, error: 'file_not_found' }); continue }
        if (file.customer_id != null) { prepared.push({ fileId: id, error: 'file_customer' }); continue }
        const mimeType = String(file.mime_type ?? '').trim().toLowerCase()
        const name = driveExportName(file.display_name || file.original_name)
        if (!DRIVE_EXPORT_MIME.has(mimeType)) { prepared.push({ fileId: id, name, error: 'file_type' }); continue }
        if (Number(file.file_size) > DRIVE_EXPORT_MAX_BYTES) { prepared.push({ fileId: id, name, error: 'file_too_large' }); continue }
        prepared.push({ fileId: id, name, mimeType, filePath: file.file_path })
      }
      // 2) Drive: 폴더 확인 후 파일마다 새로 생성
      const out = await deps.withAccess(userId, async (accessToken) => {
        const access = { accessToken, fetchImpl: deps.fetchImpl }
        const folder = await readDriveTargetFolder(access, input.driveFolderId)
        const results = []
        for (const item of prepared) {
          if (item.error) { results.push({ fileId: item.fileId, name: item.name ?? '', ok: false, code: item.error, message: FILE_ERRORS[item.error] }); continue }
          let buffer
          try {
            buffer = await deps.readBuffer(item.filePath)
          } catch {
            results.push({ fileId: item.fileId, name: item.name, ok: false, code: 'file_read', message: FILE_ERRORS.file_read })
            continue
          }
          if (buffer.length > DRIVE_EXPORT_MAX_BYTES) { results.push({ fileId: item.fileId, name: item.name, ok: false, code: 'file_too_large', message: FILE_ERRORS.file_too_large }); continue }
          try {
            const created = await uploadDriveFile(access, { name: item.name, mimeType: item.mimeType, buffer, parentId: folder.id })
            results.push({ fileId: item.fileId, name: item.name, ok: true, driveFileId: created.id, webViewLink: created.webViewLink })
          } catch (error) {
            const code = String(error?.code ?? '')
            // 연결·폴더 단위 오류는 남은 파일도 실패하므로 전체 오류로 올린다.
            if (['google_unauthorized', 'drive_scope_missing', 'export_folder_invalid', 'export_folder_not_writable', 'google_api_disabled'].includes(code)) throw error
            results.push({ fileId: item.fileId, name: item.name, ok: false, code: code || 'upload_failed', message: DRIVE_EXPORT_ERRORS[code]?.[1] ?? FILE_ERRORS[code] ?? FILE_ERRORS.upload_failed })
          }
        }
        return { folder, results }
      })
      const okCount = out.results.filter((r) => r.ok).length
      return { status: 200, body: { folder: out.folder, results: out.results, okCount, failCount: out.results.length - okCount } }
    } catch (error) {
      const code = String(error?.code ?? '')
      const known = DRIVE_EXPORT_ERRORS[code]
      if (known) return { status: known[0], body: { code: code === 'google_unauthorized' ? 'needs_reauth' : code, message: known[1] } }
      throw error
    } finally {
      release()
    }
  }
}
