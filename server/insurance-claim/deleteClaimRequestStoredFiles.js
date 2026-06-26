import { r2DeleteStorageObjectOrThrow } from '../lib/consentStorage.js'

/**
 * 청구 연관 storage 파일을 best-effort 로 삭제한다.
 * 개별 파일 실패는 로그만 남기고 전체 요청은 계속 진행한다.
 *
 * @param {string[]} storageKeys
 * @param {{ warn?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void }} [logger]
 * @param {(key: string) => Promise<void>} [deleteImpl]
 * @returns {Promise<{ deleted: string[], failed: Array<{ key: string, message: string }> }>}
 */
export async function deleteClaimRequestStoredFiles(
  storageKeys,
  logger = console,
  deleteImpl = r2DeleteStorageObjectOrThrow,
) {
  /** @type {string[]} */
  const deleted = []
  /** @type {Array<{ key: string, message: string }>} */
  const failed = []

  for (const key of storageKeys) {
    const trimmed = String(key ?? '').trim()
    if (!trimmed) {
      continue
    }
    try {
      await deleteImpl(trimmed)
      deleted.push(trimmed)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed.push({ key: trimmed, message })
      const logFn = logger.warn ?? logger.error ?? (() => {})
      logFn('[insurance-claim] storage delete failed', trimmed, message)
    }
  }

  return { deleted, failed }
}
