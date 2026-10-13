import { joinR2Key, withR2ObjectRoot } from '../lib/r2KeyPolicy.js'
import {
  buildInsuranceTimestampedFileSegment,
  normalizeInsuranceGaCode,
} from '../lib/insuranceStorageLayout.js'
import { sanitizeStorageFileNameForObjectKey } from '../lib/storageFileNameValidation.js'

/**
 * GA 지점 공유 바인더 스냅샷 파일 (비공개 shared 영역, 사용자 personal-files 아님).
 * @param {{ gaCode: string, shareId: number | string, originalName: string, now?: Date }} params
 */
export function buildPersonalBinderGaShareSnapshotObjectKey(params) {
  const gaCode = normalizeInsuranceGaCode(params.gaCode)
  const shareId = String(params.shareId ?? '').trim()
  if (!gaCode || !shareId) {
    throw new Error('invalid personal binder share snapshot key parameters')
  }
  const fileSeg = buildInsuranceTimestampedFileSegment(
    sanitizeStorageFileNameForObjectKey(params.originalName),
    params.now,
  )
  const parts = ['insurance', gaCode, 'shared', 'personal-binder-shares', shareId, fileSeg]
  return withR2ObjectRoot(joinR2Key(...parts))
}
