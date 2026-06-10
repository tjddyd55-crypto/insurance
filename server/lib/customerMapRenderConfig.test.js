import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CUSTOMER_MAP_DYNAMIC_MAX_MARKERS,
  CUSTOMER_MAP_MAX_MARKERS,
  resolveMapRenderMode,
  resolveMaxMarkersForRenderMode,
} from './customerMapRenderConfig.js'

test('resolveMapRenderMode defaults to dynamic when env unset', (t) => {
  const prev = process.env.MAP_RENDER_MODE
  delete process.env.MAP_RENDER_MODE
  t.after(() => {
    if (prev === undefined) delete process.env.MAP_RENDER_MODE
    else process.env.MAP_RENDER_MODE = prev
  })
  assert.equal(resolveMapRenderMode(), 'dynamic')
})

test('resolveMaxMarkersForRenderMode uses 100 for dynamic and 20 for static', () => {
  assert.equal(resolveMaxMarkersForRenderMode('dynamic'), CUSTOMER_MAP_DYNAMIC_MAX_MARKERS)
  assert.equal(resolveMaxMarkersForRenderMode('static'), CUSTOMER_MAP_MAX_MARKERS)
})
