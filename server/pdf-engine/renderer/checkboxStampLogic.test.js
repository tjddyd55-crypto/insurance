import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkboxMarkFontSizePt,
  isCheckboxPlacementChecked,
  parseCheckboxFieldValue,
} from '../renderer/checkboxStampLogic.js'

test('parseCheckboxFieldValue: boolean·문자열·배열', () => {
  assert.equal(parseCheckboxFieldValue('true'), true)
  assert.equal(parseCheckboxFieldValue('false'), false)
  assert.equal(parseCheckboxFieldValue('outpatient'), 'outpatient')
  assert.deepEqual(parseCheckboxFieldValue('["a","b"]'), ['a', 'b'])
})

test('isCheckboxPlacementChecked: boolean true (checked_value 없음)', () => {
  assert.equal(isCheckboxPlacementChecked('true', { checkedValue: null, optionValue: null }), true)
  assert.equal(isCheckboxPlacementChecked('false', { checkedValue: null, optionValue: null }), false)
})

test('isCheckboxPlacementChecked: checked_value 일치', () => {
  const p = { checkedValue: 'outpatient', optionValue: 'outpatient' }
  assert.equal(isCheckboxPlacementChecked('outpatient', p), true)
  assert.equal(isCheckboxPlacementChecked('inpatient', p), false)
})

test('isCheckboxPlacementChecked: 배열 포함', () => {
  const p = { checkedValue: 'surgery', optionValue: 'surgery' }
  assert.equal(isCheckboxPlacementChecked('["outpatient","surgery"]', p), true)
  assert.equal(isCheckboxPlacementChecked('["outpatient"]', p), false)
})

test('checkboxMarkFontSizePt: fontSize 우선, 없으면 min(w,h)*0.8', () => {
  assert.equal(checkboxMarkFontSizePt({ width: 20, height: 10, fontSize: null }), 8)
  assert.equal(checkboxMarkFontSizePt({ width: 20, height: 10, fontSize: 12 }), 12)
})
