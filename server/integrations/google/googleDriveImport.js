/**
 * t307 PR-B: Drive 파일 → 기존 저장 경로(presign → R2 put → save)를 서버 안에서 그대로 거친다.
 * 용량 한도·고객 권한·GA 격리·object key 규칙은 기존 핸들러가 그대로 검사한다(새 규칙을 만들지 않는다).
 * 중간 실패 시 기존 revoke-staged 로 staged 행·R2 객체를 정리한다(부분 저장 없음).
 */
import {
  acquireDriveImportLock,
  assertGoogleDriveReady,
  downloadDriveFile,
  DRIVE_ERROR_MESSAGES,
  readDriveFileMeta,
} from './googleDriveService.js'

/**
 * 기존 (req, res) 핸들러를 응답 캡처로 호출한다.
 * @param {(req: any, res: any, forcedCustomerId?: any) => Promise<void>} handler
 * @param {any} req 원 요청(user·headers 는 그대로 쓴다)
 * @param {Record<string, unknown>} body
 * @param {any} forcedCustomerId
 */
export async function invokeStorageHandler(handler, req, body, forcedCustomerId) {
  const fakeReq = Object.create(req)
  Object.defineProperty(fakeReq, 'body', { value: body, enumerable: true })
  Object.defineProperty(fakeReq, 'query', { value: {}, enumerable: true })
  const out = { status: 200, body: undefined, headers: {} }
  const fakeRes = {
    status(code) {
      out.status = code
      return fakeRes
    },
    json(payload) {
      out.body = payload
      return fakeRes
    },
    end() {
      return fakeRes
    },
    setHeader(name, value) {
      out.headers[name] = value
    },
  }
  await handler(fakeReq, fakeRes, forcedCustomerId)
  return out
}

/**
 * @param {{
 *   pool: any,
 *   handlers: { presign: Function, save: Function, revoke: Function },
 *   putObject: (objectKey: string, buffer: Buffer, contentType: string) => Promise<unknown>,
 *   withAccess: (userId: string, run: (accessToken: string) => Promise<any>) => Promise<any>,
 *   fetchImpl?: typeof fetch,
 *   assertReady?: (pool: any, userId: string) => Promise<unknown>,
 * }} deps
 */
export function createDriveImport(deps) {
  /**
   * @param {any} req
   * @param {{ driveFileId: unknown, folderId?: unknown, customerId?: unknown, forcedCustomerId?: any }} input
   * @returns {Promise<{ status: number, body: any }>}
   */
  return async function importDriveFile(req, input) {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) return { status: 401, body: { message: '로그인이 필요합니다.' } }
    let release = () => {}
    let staged = null
    try {
      await (deps.assertReady ?? assertGoogleDriveReady)(deps.pool, userId)
      release = acquireDriveImportLock(userId, String(input.driveFileId ?? ''))
      const { meta, buffer } = await deps.withAccess(userId, async (accessToken) => {
        const access = { accessToken, fetchImpl: deps.fetchImpl }
        const fileMeta = await readDriveFileMeta(access, input.driveFileId)
        return { meta: fileMeta, buffer: await downloadDriveFile(access, fileMeta) }
      })
      const customerId = input.forcedCustomerId ?? input.customerId ?? null
      const presign = await invokeStorageHandler(deps.handlers.presign, req, {
        fileName: meta.name,
        contentType: meta.mimeType,
        size: meta.size,
        ...(customerId != null ? { customerId } : {}),
      }, input.forcedCustomerId ?? null)
      if (presign.status >= 400 || !presign.body?.fileId || !presign.body?.objectKey) {
        return { status: presign.status >= 400 ? presign.status : 502, body: presign.body ?? { message: '저장을 준비하지 못했습니다.' } }
      }
      staged = { fileId: presign.body.fileId, objectKey: presign.body.objectKey }
      await deps.putObject(staged.objectKey, buffer, meta.mimeType)
      const saved = await invokeStorageHandler(deps.handlers.save, req, {
        fileId: staged.fileId,
        objectKey: staged.objectKey,
        fileUrl: presign.body.fileUrl,
        fileName: meta.name,
        displayName: meta.name,
        size: meta.size,
        mimeType: meta.mimeType,
        ...(input.folderId != null && input.folderId !== '' ? { folderId: input.folderId } : {}),
        ...(customerId != null ? { customerId } : {}),
      }, input.forcedCustomerId ?? null)
      if (saved.status >= 400) {
        await cleanup(req, staged, input.forcedCustomerId ?? null)
        staged = null
        return saved
      }
      staged = null
      return { status: 200, body: { ...(saved.body ?? {}), source: 'google_drive' } }
    } catch (error) {
      if (staged) await cleanup(req, staged, input.forcedCustomerId ?? null)
      const code = String(error?.code ?? '')
      const known = DRIVE_ERROR_MESSAGES[code]
      if (known) return { status: known[0], body: { code: code === 'google_unauthorized' ? 'needs_reauth' : code, message: known[1] } }
      throw error
    } finally {
      release()
    }
  }

  async function cleanup(req, staged, forcedCustomerId) {
    try {
      await invokeStorageHandler(deps.handlers.revoke, req, { fileId: staged.fileId, objectKey: staged.objectKey }, forcedCustomerId)
    } catch {
      // 남은 staged 행은 기존 업로드 orphan 정리 작업이 치운다.
      console.warn('[google-drive] staged cleanup failed', { fileId: String(staged.fileId) })
    }
  }
}
