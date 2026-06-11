import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * PdfTemplateEditorPage persist 정책 — client `pdfTemplateEditorPersistPolicy.ts` 와 동기화.
 * (프론트는 vitest 미연동이므로 node:test 로 메시지·결과 분기를 검증한다.)
 */

/** @param {'saved' | 'skipped' | 'failed'} fieldsResult */
function handleSaveCompleteToast(fieldsResult) {
  if (fieldsResult === 'saved') {
    return '저장되었습니다.'
  }
  if (fieldsResult === 'skipped') {
    return '기본 정보가 저장되었습니다.'
  }
  return null
}

function persistFieldsSkippedToast() {
  return '변경된 좌표·매핑이 없습니다.'
}

test('handleSaveCompleteToast: saved vs skipped vs failed', () => {
  assert.equal(handleSaveCompleteToast('saved'), '저장되었습니다.')
  assert.equal(handleSaveCompleteToast('skipped'), '기본 정보가 저장되었습니다.')
  assert.equal(handleSaveCompleteToast('failed'), null)
})

test('persistFields skipped must not read as full template save', () => {
  assert.notEqual(persistFieldsSkippedToast(), handleSaveCompleteToast('saved'))
  assert.notEqual(handleSaveCompleteToast('skipped'), handleSaveCompleteToast('saved'))
})
