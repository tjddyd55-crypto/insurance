import { describe, expect, it } from 'vitest'
import {
  isGaOnlyNewsletterBoard,
  isGlobalNewsletterBoard,
} from './newsletterBoardScope'

describe('newsletterBoardScope', () => {
  it('detects global boards', () => {
    expect(isGlobalNewsletterBoard({ boardScope: 'global', contentScope: 'global' })).toBe(true)
    expect(isGlobalNewsletterBoard({ boardScope: 'global', contentScope: 'ga' })).toBe(true)
  })

  it('detects ga-only boards', () => {
    expect(isGaOnlyNewsletterBoard({ boardScope: 'ga', contentScope: 'ga' })).toBe(true)
    expect(isGaOnlyNewsletterBoard({ boardScope: 'system', contentScope: 'ga' })).toBe(true)
    expect(isGaOnlyNewsletterBoard({ boardScope: 'global', contentScope: 'global' })).toBe(false)
  })
})
