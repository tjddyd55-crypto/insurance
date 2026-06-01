import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  resolveConsultationDateForEditForm,
  resolveConsultationDateForSave,
} from '../../src/features/customers/utils/consultationBodyFormat.ts'

describe('resolveConsultationDateForSave', () => {
  it('create mode falls back to today when form date empty', () => {
    const saved = resolveConsultationDateForSave('', '', 'create')
    assert.match(saved ?? '', /^\d{4}-\d{2}-\d{2}$/)
  })

  it('edit mode keeps original when form date empty', () => {
    assert.equal(
      resolveConsultationDateForSave('', '2026-05-13', 'edit'),
      '2026-05-13',
    )
  })

  it('edit mode prefers normalized form date when user changed it', () => {
    assert.equal(
      resolveConsultationDateForSave('2026-06-01', '2026-05-13', 'edit'),
      '2026-06-01',
    )
  })

  it('edit mode returns null when both form and original invalid', () => {
    assert.equal(resolveConsultationDateForSave('', 'Wed May 13', 'edit'), null)
  })
})

describe('resolveConsultationDateForEditForm', () => {
  it('uses consultationDate column when valid', () => {
    assert.equal(
      resolveConsultationDateForEditForm('2026-05-13', '2026-04-23'),
      '2026-05-13',
    )
  })

  it('falls back to dateLabel when column broken', () => {
    assert.equal(
      resolveConsultationDateForEditForm('Wed May 13', '2026. 5. 13.'),
      '2026-05-13',
    )
  })

  it('does not invent today when both missing', () => {
    assert.equal(resolveConsultationDateForEditForm(null, ''), '')
  })
})
