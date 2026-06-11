/** PDF 템플릿 편집기 — 필드 저장 persistFields 결과 (PUT 수행 여부 구분). */
export type PersistFieldsResult = 'saved' | 'skipped' | 'failed'

export function persistFieldsSkippedToast(): string {
  return '변경된 좌표·매핑이 없습니다.'
}

export function persistFieldsSavedToast(keysNormalized: boolean): string {
  return keysNormalized
    ? '필드 식별자를 보정한 뒤 좌표·매핑이 저장되었습니다.'
    : '좌표·매핑이 저장되었습니다.'
}

/** 상단 「저장」: 메타 PATCH 후 필드 persist 결과에 따른 완료 메시지. failed 는 null(별도 오류 토스트). */
export function handleSaveCompleteToast(fieldsResult: PersistFieldsResult): string | null {
  if (fieldsResult === 'saved') {
    return '저장되었습니다.'
  }
  if (fieldsResult === 'skipped') {
    return '기본 정보가 저장되었습니다.'
  }
  return null
}
