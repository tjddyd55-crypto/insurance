/**
 * t307 PR-B Google Drive 가져오기. 읽기만 한다(GET 메타·alt=media). Drive 원본은 절대 바꾸지 않는다(쓰기 요청 없음).
 * 파일 id 는 화면 값을 믿지 않고 현재 사용자 자기 토큰(drive.file)으로 Google 에서 다시 확인한다.
 * drive.file 은 사용자가 Picker 로 고른 파일만 열 수 있어, 남의 파일·고르지 않은 id 는 404 가 된다.
 */
import { readUserIntegration } from '../integrationStore.js'
import { GOOGLE_ACCOUNT_PROVIDER_KEY, hasDriveFileScope, isGoogleDriveEnabled } from './googleOAuthConfig.js'
import { googleError } from './googleTokenService.js'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files'
const FILE_ID = /^[A-Za-z0-9_-]{10,200}$/
const DOWNLOAD_TIMEOUT_MS = 60 * 1000

/** 가져오기 허용 형식(바인더·저장 공간 공통 경로가 받는 PDF·JPEG·PNG). Docs/Sheets/Slides 내보내기는 보류. */
export const DRIVE_IMPORT_MIME = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
})

export const DRIVE_IMPORT_MAX_BYTES = 25 * 1024 * 1024

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {Record<string, string | undefined>} [env]
 */
export async function assertGoogleDriveReady(pool, userId, env = process.env) {
  if (!isGoogleDriveEnabled(env)) throw googleError('drive_disabled')
  const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  if (!row) throw googleError('not_connected')
  if (row.status === 'error' && row.lastError === 'needs_reauth') throw googleError('needs_reauth')
  if (!hasDriveFileScope(row.credential?.scope)) throw googleError('drive_scope_missing')
  return row
}

/** @param {unknown} raw */
export function normalizeDriveFileId(raw) {
  const id = String(raw ?? '').trim()
  if (!FILE_ID.test(id)) throw googleError('drive_file_invalid')
  return id
}

/** 파일 이름: 경로 문자 제거, 확장자는 실제 MIME 기준으로 맞춘다. */
export function driveImportFileName(name, mimeType) {
  const ext = DRIVE_IMPORT_MIME[mimeType] ?? ''
  let base = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  base = base.replace(/\.(pdf|jpe?g|png)$/i, '').slice(0, 120 - ext.length).trim() || 'google-drive'
  return `${base}${ext}`
}

async function driveFetch(fetchImpl, url, accessToken, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS)
  let response
  try {
    response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
  } catch (error) {
    clearTimeout(timer)
    throw googleError(error?.name === 'AbortError' ? 'google_timeout' : 'google_unavailable')
  }
  if (response.status === 401) {
    clearTimeout(timer)
    throw googleError('google_unauthorized')
  }
  if (response.status === 404) {
    clearTimeout(timer)
    throw googleError('drive_file_not_found')
  }
  if (response.status === 403) {
    clearTimeout(timer)
    let reason = ''
    try {
      const body = await response.json()
      reason = String(body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '')
    } catch {
      reason = ''
    }
    if (/rateLimit|quota|RESOURCE_EXHAUSTED/i.test(reason)) throw googleError('google_rate_limited')
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) throw googleError('google_api_disabled')
    if (/insufficient|SCOPE/i.test(reason)) throw googleError('drive_scope_missing')
    throw googleError('drive_file_not_found')
  }
  if (!response.ok) {
    clearTimeout(timer)
    throw googleError('google_unavailable')
  }
  return { response, done: () => clearTimeout(timer) }
}

/**
 * 메타 확인. 휴지통·폴더·허용 밖 형식·용량 초과는 거절.
 * @param {{ accessToken: string, fetchImpl?: typeof fetch }} access
 * @param {string} fileId
 */
export async function readDriveFileMeta(access, fileId) {
  const id = normalizeDriveFileId(fileId)
  const url = new URL(`${DRIVE_BASE}/${encodeURIComponent(id)}`)
  url.searchParams.set('fields', 'id,name,mimeType,size,trashed')
  url.searchParams.set('supportsAllDrives', 'true')
  const { response, done } = await driveFetch(access.fetchImpl ?? fetch, url, access.accessToken, { timeoutMs: 15000 })
  let meta
  try {
    meta = await response.json()
  } finally {
    done()
  }
  if (!meta || meta.id !== id || meta.trashed === true) throw googleError('drive_file_not_found')
  const mimeType = String(meta.mimeType ?? '').toLowerCase()
  if (!DRIVE_IMPORT_MIME[mimeType]) {
    const error = googleError('drive_file_type')
    error.mimeType = mimeType.startsWith('application/vnd.google-apps') ? 'google_doc' : 'other'
    throw error
  }
  const size = Number(meta.size)
  if (!Number.isFinite(size) || size <= 0) throw googleError('drive_file_empty')
  if (size > DRIVE_IMPORT_MAX_BYTES) throw googleError('drive_file_too_large')
  return { id, name: driveImportFileName(meta.name, mimeType), mimeType, size }
}

/** 파일 시그니처로 실제 형식 확인(확장자·MIME 위장 방지). */
export function sniffDriveMime(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  return ''
}

/**
 * 본문 다운로드(alt=media). 선언 크기를 넘으면 즉시 중단, 끝까지 받은 크기·시그니처가 메타와 같아야 한다.
 * @param {{ accessToken: string, fetchImpl?: typeof fetch }} access
 * @param {{ id: string, size: number, mimeType: string }} meta
 */
export async function downloadDriveFile(access, meta) {
  const url = new URL(`${DRIVE_BASE}/${encodeURIComponent(meta.id)}`)
  url.searchParams.set('alt', 'media')
  url.searchParams.set('supportsAllDrives', 'true')
  const { response, done } = await driveFetch(access.fetchImpl ?? fetch, url, access.accessToken)
  const chunks = []
  let total = 0
  try {
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader()
      for (;;) {
        const { value, done: end } = await reader.read()
        if (end) break
        total += value.length
        if (total > meta.size || total > DRIVE_IMPORT_MAX_BYTES) {
          await reader.cancel().catch(() => undefined)
          throw googleError('drive_file_size_mismatch')
        }
        chunks.push(Buffer.from(value))
      }
    } else {
      const buf = Buffer.from(await response.arrayBuffer())
      total = buf.length
      chunks.push(buf)
    }
  } catch (error) {
    if (error?.code) throw error
    throw googleError(error?.name === 'AbortError' ? 'google_timeout' : 'google_unavailable')
  } finally {
    done()
  }
  const buffer = Buffer.concat(chunks)
  if (buffer.length !== meta.size) throw googleError('drive_file_size_mismatch')
  if (sniffDriveMime(buffer) !== meta.mimeType) throw googleError('drive_file_type')
  return buffer
}

/** 같은 사용자·같은 Drive 파일의 동시 가져오기(중복 클릭) 차단. */
const inFlight = new Set()

export function acquireDriveImportLock(userId, fileId) {
  const key = `${String(userId)}:${String(fileId)}`
  if (inFlight.has(key)) throw googleError('drive_import_in_progress')
  inFlight.add(key)
  return () => inFlight.delete(key)
}

export const DRIVE_ERROR_MESSAGES = Object.freeze({
  drive_disabled: [403, 'Google Drive 가져오기는 아직 준비 중입니다.'],
  drive_scope_missing: [409, 'Google Drive 파일 선택 권한이 필요합니다. 권한을 허용해 주세요.'],
  drive_file_invalid: [400, 'Google Drive 파일 정보가 올바르지 않습니다.'],
  drive_file_not_found: [404, 'Google Drive 파일을 찾을 수 없거나 접근 권한이 없습니다. Drive 에서 다시 선택해 주세요.'],
  drive_file_type: [400, 'PDF, JPG, PNG 파일만 가져올 수 있습니다.'],
  drive_file_empty: [400, '빈 파일은 가져올 수 없습니다.'],
  drive_file_too_large: [400, '25MB 이하 파일만 가져올 수 있습니다.'],
  drive_file_size_mismatch: [502, 'Google Drive 에서 파일을 끝까지 받지 못했습니다. 다시 시도해 주세요.'],
  drive_import_in_progress: [409, '이미 가져오는 중인 파일입니다.'],
  not_connected: [409, 'Google 계정이 연결되어 있지 않습니다.'],
  needs_reauth: [409, 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.'],
  google_unauthorized: [409, 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.'],
  google_unavailable: [502, 'Google 응답이 없습니다. 잠시 후 다시 시도해 주세요.'],
  google_timeout: [504, 'Google 응답이 늦어 가져오지 못했습니다. 다시 시도해 주세요.'],
  google_rate_limited: [503, 'Google 요청이 많아 잠시 가져올 수 없습니다.'],
  google_api_disabled: [503, 'Google Drive 연동 서버 설정을 확인 중입니다. 관리자에게 문의해 주세요.'],
  unconfigured: [409, 'Google 연동 설정이 아직 없습니다.'],
})
