import { describe, expect, it } from 'vitest'
import {
  INTRODUCTION_CANONICAL_PATH,
  INTRODUCTION_LEGACY_TYPO_PATH,
  INTRODUCTION_PUBLIC_PATHS,
  isIntroductionPublicPath,
  resolveIntroductionInstallRedirect,
} from './introductionPublicRoutes'

describe('introductionPublicRoutes', () => {
  it('exposes canonical and legacy typo paths', () => {
    expect(INTRODUCTION_PUBLIC_PATHS).toEqual(
      expect.arrayContaining([
        '/introduction',
        '/introduction/install',
        '/intodution',
        '/intodution/install',
      ]),
    )
  })

  it('recognizes introduction public paths with query or hash', () => {
    expect(isIntroductionPublicPath(INTRODUCTION_CANONICAL_PATH)).toBe(true)
    expect(isIntroductionPublicPath(`${INTRODUCTION_CANONICAL_PATH}/install`)).toBe(true)
    expect(isIntroductionPublicPath(INTRODUCTION_LEGACY_TYPO_PATH)).toBe(true)
    expect(isIntroductionPublicPath(`${INTRODUCTION_LEGACY_TYPO_PATH}/install`)).toBe(true)
    expect(isIntroductionPublicPath('/intodution#download')).toBe(true)
    expect(isIntroductionPublicPath('/introduction?ref=qr')).toBe(true)
  })

  it('rejects protected CRM paths', () => {
    expect(isIntroductionPublicPath('/customers')).toBe(false)
    expect(isIntroductionPublicPath('/dashboard')).toBe(false)
    expect(isIntroductionPublicPath('/login')).toBe(false)
  })

  it('redirects install subpaths to download hash on matching base', () => {
    expect(resolveIntroductionInstallRedirect('/introduction/install')).toBe('/introduction#download')
    expect(resolveIntroductionInstallRedirect('/intodution/install')).toBe('/intodution#download')
  })
})
