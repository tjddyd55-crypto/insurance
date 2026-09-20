import { describe, expect, it } from 'vitest'
import {
  getGaRestrictedFeatureCopy,
  resolveGaRestrictedFeatureFromPath,
} from './gaRestrictedFeatures'

describe('resolveGaRestrictedFeatureFromPath', () => {
  it('maps application paths', () => {
    expect(resolveGaRestrictedFeatureFromPath('/application/documents')).toBe('application')
    expect(resolveGaRestrictedFeatureFromPath('/application/documents/history')).toBe('application')
  })

  it('maps newsletter and contacts paths', () => {
    expect(resolveGaRestrictedFeatureFromPath('/portal/newsletters')).toBe('insurer-newsletter')
    expect(resolveGaRestrictedFeatureFromPath('/portal/newsletters/1')).toBe('insurer-newsletter')
    expect(resolveGaRestrictedFeatureFromPath('/portal/adjuster-news')).toBe('loss-adjuster-newsletter')
    expect(resolveGaRestrictedFeatureFromPath('/insurance/contacts')).toBe('insurance-contacts')
  })

  it('maps GA-only dynamic board paths', () => {
    expect(resolveGaRestrictedFeatureFromPath('/portal/boards/internal-news')).toBe('loss-adjuster-board')
  })

  it('does not map shared global board paths to GA-only board notice', () => {
    expect(resolveGaRestrictedFeatureFromPath('/portal/boards/shared-news')).toBe('generic')
    expect(resolveGaRestrictedFeatureFromPath('/portal/boards/%EA%B3%B5%EC%9A%A9-%EC%86%8C%EC%8B%9D%EC%A7%80')).toBe(
      'generic',
    )
  })

  it('falls back to generic for unknown paths', () => {
    expect(resolveGaRestrictedFeatureFromPath('/team/posts')).toBe('generic')
  })
})

describe('getGaRestrictedFeatureCopy', () => {
  it('returns feature-specific body copy', () => {
    expect(getGaRestrictedFeatureCopy('application').body).toContain('신청서')
    expect(getGaRestrictedFeatureCopy('insurer-newsletter').body).toContain('원수사 소식지')
    expect(getGaRestrictedFeatureCopy('loss-adjuster-newsletter').body).toContain('손해사정사 소식지')
    expect(getGaRestrictedFeatureCopy('loss-adjuster-board').body).toContain('손해사정사 게시판')
    expect(getGaRestrictedFeatureCopy('insurance-contacts').body).toContain('원수사 연락처')
  })

  it('uses shared title and helper', () => {
    const copy = getGaRestrictedFeatureCopy('application')
    expect(copy.title).toBe('GA 소속 사용자 전용 기능입니다')
    expect(copy.helper).toContain('GA 등록코드')
  })
})
