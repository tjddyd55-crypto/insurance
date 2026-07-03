import { describe, expect, it } from 'vitest'
import { createSearchRequestSequencer } from './searchRequestSequencer'

describe('createSearchRequestSequencer', () => {
  it('begin()은 호출마다 단조 증가하는 고유 순번을 발급한다', () => {
    const seq = createSearchRequestSequencer()
    const a = seq.begin()
    const b = seq.begin()
    const c = seq.begin()
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('isLatest()는 가장 최근에 발급된 순번에만 true를 반환한다', () => {
    const seq = createSearchRequestSequencer()
    const first = seq.begin()
    expect(seq.isLatest(first)).toBe(true)

    const second = seq.begin()
    expect(seq.isLatest(second)).toBe(true)
    expect(seq.isLatest(first)).toBe(false)
  })

  it('stale 응답 시나리오: 나중에 시작된 요청(초기화)만 최신으로 인정하고 이전 요청은 무시한다', () => {
    const seq = createSearchRequestSequencer()

    // 검색 A(느림) 시작 → 초기화 B(빠름) 시작
    const searchA = seq.begin()
    const resetB = seq.begin()

    // B 응답이 먼저 도착: B는 최신이므로 반영한다.
    expect(seq.isLatest(resetB)).toBe(true)

    // A 응답이 뒤늦게 도착: 이미 B가 최신이므로 A는 버려야 한다(이전 결과가 되살아나지 않음).
    expect(seq.isLatest(searchA)).toBe(false)
  })
})
