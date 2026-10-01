import { describe, expect, it } from 'vitest'
import {
  isEupmyeondongFilterEnabled,
  isSigunguFilterEnabled,
  regionSelectOptions,
} from './regionFilterState'

describe('region filter cascade', () => {
  it('상위가 전체이면 아래 단계를 막는다', () => {
    expect(isSigunguFilterEnabled('')).toBe(false)
    expect(isEupmyeondongFilterEnabled('', '', 3)).toBe(false)
    expect(isEupmyeondongFilterEnabled('서울특별시', '', 1)).toBe(false)
  })

  it('시/도를 고르면 시군구가 열리고, 시군구를 고르면 읍면동이 열린다', () => {
    expect(isSigunguFilterEnabled('경기도')).toBe(true)
    expect(isEupmyeondongFilterEnabled('경기도', '성남시 분당구', 2)).toBe(true)
  })

  it('세종처럼 시군구가 없으면 읍면동을 시/도 다음에 연다', () => {
    expect(isEupmyeondongFilterEnabled('세종특별자치시', '', 0)).toBe(true)
  })

  it('선택지 앞에 전체를 둔다', () => {
    expect(regionSelectOptions(['강남구'])).toEqual([
      { value: '', label: '전체' },
      { value: '강남구', label: '강남구' },
    ])
  })
})