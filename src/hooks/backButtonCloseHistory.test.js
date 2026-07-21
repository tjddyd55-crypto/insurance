/**
 * backButtonCloseHistory.ts 와 동일 계약의 순수 검증 (node:test, TS 빌드 없이 실행).
 * 구현이 바뀌면 이 파일의 기대값도 함께 갱신한다.
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

function shouldPopSyntheticEntryOnDismiss(params) {
  if (!params.pushed) return false
  if (params.historyLength <= 1) return false
  return isOwnUiLayerTop(params.top, params.layerKind, params.layerId)
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

  it('X 닫기: marker 일치 + historyLength>1 일 때만 pop 후보', () => {
    const top = buildUiLayerPushState(null, 'customer-app-link-modal', 'x')
    assert.equal(
      shouldPopSyntheticEntryOnDismiss({
        pushed: true,
        top,
        layerKind: 'customer-app-link-modal',
        layerId: 'x',
        historyLength: 2,
      }),
      true,
    )
    assert.equal(
      shouldPopSyntheticEntryOnDismiss({
        pushed: true,
        top,
        layerKind: 'customer-app-link-modal',
        layerId: 'x',
        historyLength: 1,
      }),
      false,
    )
    assert.equal(
      shouldPopSyntheticEntryOnDismiss({
        pushed: true,
        top: { __uiLayer: 'other', __uiLayerId: 'y' },
        layerKind: 'customer-app-link-modal',
        layerId: 'x',
        historyLength: 2,
      }),
      false,
    )
  })

  it('UI trap 감지: 고객앱 연결 모달 · BaseDialog · 카드 펼침', () => {
    assert.equal(hasUiLayerTrapOnTop({ __uiLayer: 'customer-app-link-modal', __uiLayerId: '1' }), true)
    assert.equal(hasUiLayerTrapOnTop({ __BASE_DIALOG_BACK_TRAP__: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ modal: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ customerListExpanded: true }), true)
    assert.equal(hasUiLayerTrapOnTop({ usr: 1 }), false)
  })
})
