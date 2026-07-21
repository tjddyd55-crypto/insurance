/**
 * backButtonCloseHistory.ts 계약 검증 (node:test).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const UI_LAYER_STATE_KEY = '__uiLayer'
const UI_LAYER_ID_STATE_KEY = '__uiLayerId'

function buildUiLayerPushState(existing, layerKind, layerId) {
  const base =
    existing != null && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {}
  return {
    ...base,
    [UI_LAYER_STATE_KEY]: layerKind,
    [UI_LAYER_ID_STATE_KEY]: layerId,
  }
}

function isOwnUiLayerTop(top, layerKind, layerId) {
  if (top == null || typeof top !== 'object') return false
  if (top[UI_LAYER_ID_STATE_KEY] == null && top[UI_LAYER_STATE_KEY] === layerId) return true
  return top[UI_LAYER_STATE_KEY] === layerKind && top[UI_LAYER_ID_STATE_KEY] === layerId
}

function shouldStripSyntheticEntryOnDismiss(params) {
  if (!params.pushed) return false
  return isOwnUiLayerTop(params.top, params.layerKind, params.layerId)
}

function stripOwnUiLayerMarker(top, layerKind, layerId) {
  const base =
    top != null && typeof top === 'object' && !Array.isArray(top) ? { ...top } : {}
  if (isOwnUiLayerTop(base, layerKind, layerId)) {
    delete base[UI_LAYER_STATE_KEY]
    delete base[UI_LAYER_ID_STATE_KEY]
  }
  return base
}

function hasUiLayerTrapOnTop(top) {
  if (top == null || typeof top !== 'object') return false
  return Boolean(
    top[UI_LAYER_STATE_KEY] ||
      top.__BASE_DIALOG_BACK_TRAP__ ||
      top.modal === true ||
      top.customerListExpanded === true,
  )
}

describe('backButtonCloseHistory', () => {
  it('open 시 existing state 를 보존하며 marker 1회 형태를 만든다', () => {
    const state = buildUiLayerPushState(
      { customerListExpanded: true, customerId: 7 },
      'customer-app-link-modal',
      'layer-1',
    )
    assert.equal(state.__uiLayer, 'customer-app-link-modal')
    assert.equal(state.__uiLayerId, 'layer-1')
    assert.equal(state.customerListExpanded, true)
    assert.equal(state.customerId, 7)
  })

  it('자신의 marker 만 own top 으로 인식한다', () => {
    const own = buildUiLayerPushState(null, 'customer-app-link-modal', 'a')
    assert.equal(isOwnUiLayerTop(own, 'customer-app-link-modal', 'a'), true)
    assert.equal(isOwnUiLayerTop(own, 'customer-app-link-modal', 'b'), false)
  })

  it('X/성공 닫기: marker 일치 시에만 strip 후보 (history.back 없음)', () => {
    const top = buildUiLayerPushState({ keep: 1 }, 'customer-relation-group-modal', 'x')
    assert.equal(
      shouldStripSyntheticEntryOnDismiss({
        pushed: true,
        top,
        layerKind: 'customer-relation-group-modal',
        layerId: 'x',
      }),
      true,
    )
    assert.equal(
      shouldStripSyntheticEntryOnDismiss({
        pushed: false,
        top,
        layerKind: 'customer-relation-group-modal',
        layerId: 'x',
      }),
      false,
    )
    assert.equal(
      shouldStripSyntheticEntryOnDismiss({
        pushed: true,
        top: { __uiLayer: 'other', __uiLayerId: 'y' },
        layerKind: 'customer-relation-group-modal',
        layerId: 'x',
      }),
      false,
    )
  })

  it('strip 은 marker 만 제거하고 기존 state·route 용 필드는 유지', () => {
    const top = buildUiLayerPushState(
      { customerListExpanded: true, customerId: 168 },
      'customer-relation-group-modal',
      'g1',
    )
    const cleaned = stripOwnUiLayerMarker(top, 'customer-relation-group-modal', 'g1')
    assert.equal(cleaned.__uiLayer, undefined)
    assert.equal(cleaned.__uiLayerId, undefined)
    assert.equal(cleaned.customerListExpanded, true)
    assert.equal(cleaned.customerId, 168)
  })

  it('UI trap 감지: 고객앱 연결 모달 · BaseDialog · 카드 펼침', () => {
    assert.equal(hasUiLayerTrapOnTop({ __uiLayer: 'customer-app-link-modal', __uiLayerId: '1' }), true)
    assert.equal(hasUiLayerTrapOnTop({ __BASE_DIALOG_BACK_TRAP__: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ modal: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ customerListExpanded: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ usr: 1 }), false)
  })
})
