import { describe, expect, it } from 'vitest'
import { parseCareerDisplayLines } from './parseCareerDisplayLines'

describe('parseCareerDisplayLines', () => {
  it('removes affiliation duplicate from career segments', () => {
    const lines = parseCareerDisplayLines(
      '영진에셋 소속 · 보험설계 경력 15년 · MDRT 도전 중',
      '영진에셋',
      '테스트팀',
    )
    expect(lines).toEqual(['보험설계 경력 15년', 'MDRT 도전 중'])
  })
})
