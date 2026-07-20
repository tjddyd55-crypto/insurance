import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  RELATIONSHIP_LABEL_ETC,
  RELATIONSHIP_LABEL_MAX_LENGTH,
  isEtcRelationshipOption,
  resolveRelationshipLabel,
  splitRelationshipLabelForEdit,
} from '../../src/features/customers/utils/relationshipLabel.js'

describe('relationshipLabel', () => {
  it('stores preset labels as-is', () => {
    assert.equal(resolveRelationshipLabel('배우자', ''), '배우자')
    assert.equal(resolveRelationshipLabel('어머니', '무시됨'), '어머니')
  })

  it('stores custom text for 기타, not the word 기타', () => {
    assert.equal(resolveRelationshipLabel(RELATIONSHIP_LABEL_ETC, '시어머니'), '시어머니')
    assert.equal(resolveRelationshipLabel(RELATIONSHIP_LABEL_ETC, '  장모  '), '장모')
    assert.equal(resolveRelationshipLabel(RELATIONSHIP_LABEL_ETC, ''), null)
    assert.equal(resolveRelationshipLabel(RELATIONSHIP_LABEL_ETC, '   '), null)
  })

  it('trims and caps custom length', () => {
    const long = '가'.repeat(RELATIONSHIP_LABEL_MAX_LENGTH + 5)
    const resolved = resolveRelationshipLabel(RELATIONSHIP_LABEL_ETC, long)
    assert.equal(resolved?.length, RELATIONSHIP_LABEL_MAX_LENGTH)
  })

  it('splits saved labels for edit UI', () => {
    assert.deepEqual(splitRelationshipLabelForEdit('자녀'), { option: '자녀', custom: '' })
    assert.deepEqual(splitRelationshipLabelForEdit('시어머니'), {
      option: RELATIONSHIP_LABEL_ETC,
      custom: '시어머니',
    })
    assert.deepEqual(splitRelationshipLabelForEdit('기타'), {
      option: RELATIONSHIP_LABEL_ETC,
      custom: '',
    })
  })

  it('detects etc option', () => {
    assert.equal(isEtcRelationshipOption('기타'), true)
    assert.equal(isEtcRelationshipOption('배우자'), false)
  })
})
