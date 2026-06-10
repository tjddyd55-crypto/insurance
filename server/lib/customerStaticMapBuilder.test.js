import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNaverStaticMapMarkerParam,
  buildNaverStaticMapRequestUrl,
  canUseNumberedMarkerLabel,
  radiusKmToMapLevel,
} from './customerStaticMapBuilder.js'

test('canUseNumberedMarkerLabel allows 1-9 only', () => {
  assert.equal(canUseNumberedMarkerLabel(1), true)
  assert.equal(canUseNumberedMarkerLabel(9), true)
  assert.equal(canUseNumberedMarkerLabel(10), false)
})

test('buildNaverStaticMapMarkerParam uses type:n for 1-9', () => {
  assert.match(
    buildNaverStaticMapMarkerParam({ markerNo: 3, longitude: 127.0, latitude: 37.5 }),
    /type:n\|size:mid\|label:3\|pos:127 37\.5/,
  )
})

test('buildNaverStaticMapMarkerParam uses type:d for 10+', () => {
  const param = buildNaverStaticMapMarkerParam({ markerNo: 12, longitude: 127.1, latitude: 37.6 })
  assert.match(param, /type:d\|size:mid\|pos:127\.1 37\.6/)
  assert.doesNotMatch(param, /label:/)
})

test('buildNaverStaticMapRequestUrl caps markers at 20', () => {
  const markers = Array.from({ length: 25 }, (_, i) => ({
    markerNo: i + 1,
    longitude: 126.9 + i * 0.01,
    latitude: 37.5,
  }))
  const url = buildNaverStaticMapRequestUrl(markers)
  const count = (url.match(/markers=/g) ?? []).length
  assert.equal(count, 20)
})

test('radiusKmToMapLevel maps common radii', () => {
  assert.equal(radiusKmToMapLevel(1), 14)
  assert.equal(radiusKmToMapLevel(3), 12)
  assert.equal(radiusKmToMapLevel(10), 10)
})
