import { consentGetBuffer, consentPutObject } from '../lib/consentStorage.js'

/**
 * R2 서버측 복사 (Get + Put). 원본 키는 호출측에서 권한 검증 후 전달.
 * @param {string} sourceObjectKey
 * @param {string} destObjectKey
 * @param {string} mimeType
 * @returns {Promise<{ bytes: number, checksumSha256?: string }>}
 */
export async function copyR2ObjectForBinderShare(sourceObjectKey, destObjectKey, mimeType) {
  const source = String(sourceObjectKey ?? '').trim()
  const dest = String(destObjectKey ?? '').trim()
  if (!source || !dest) {
    throw Object.assign(new Error('스토리지 키가 올바르지 않습니다.'), { httpStatus: 500 })
  }
  const buffer = await consentGetBuffer(source)
  if (!Buffer.isBuffer(buffer) || buffer.length < 1) {
    throw Object.assign(new Error('공유할 파일을 읽을 수 없습니다.'), { httpStatus: 404 })
  }
  await consentPutObject(dest, buffer, mimeType || 'application/octet-stream')
  return { bytes: buffer.length }
}
