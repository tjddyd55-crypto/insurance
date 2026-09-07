import { describe, expect, it } from 'vitest'
import { isPublicGeneralAccount, isPublicGeneralGaName } from './generalGa'
import {
  applyPublicAccountMenuPathRestrictions,
  isPublicAccountGaOnlyMenuPath,
  isPublicAccountGaOnlyPath,
  toPublicAccountRestrictedPath,
} from './publicAccountRestrictedRoutes'

describe('isPublicGeneralAccount', () => {
  it('detects GENERAL gaCode', () => {
    expect(isPublicGeneralAccount({ gaCode: 'GENERAL', gaName: '공용' })).toBe(true)
    expect(isPublicGeneralAccount({ gaCode: 'general', gaName: '테스트' })).toBe(true)
  })

  it('detects 공용/GENERAL gaName without GENERAL code', () => {
    expect(isPublicGeneralGaName('박성용(공용)')).toBe(true)
    expect(isPublicGeneralGaName('GENERAL')).toBe(true)
    expect(isPublicGeneralAccount({ gaCode: 'YJASSET', gaName: '박성용(공용)' })).toBe(true)
  })

  it('does not treat normal GA users as public', () => {
    expect(isPublicGeneralAccount({ gaCode: 'YJASSET', gaName: '영진에셋' })).toBe(false)
    expect(isPublicGeneralAccount({ gaCode: 'USER', gaName: '일반 GA' })).toBe(false)
  })
})

describe('public account restricted paths', () => {
  it('blocks ga-only menu paths', () => {
    expect(isPublicAccountGaOnlyMenuPath('/application/documents')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/contracts/signatures/send')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/team/files')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/portal/newsletters')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/portal/adjuster-news')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/insurance/contacts')).toBe(true)
    expect(isPublicAccountGaOnlyMenuPath('/portal/boards/global-test')).toBe(false)
    expect(isPublicAccountGaOnlyMenuPath('/dashboard')).toBe(false)
  })

  it('blocks direct url paths including customer workspace and newsletters', () => {
    expect(isPublicAccountGaOnlyPath('/application')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/application/documents/history')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/portal/newsletters/123')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/portal/adjuster-news/recent')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/insurance/contacts')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/portal/boards/global-test')).toBe(false)
    expect(isPublicAccountGaOnlyPath('/contract-signatures')).toBe(false)
    expect(isPublicAccountGaOnlyPath('/customers/12/application-documents')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/customers/12/signatures')).toBe(true)
    expect(isPublicAccountGaOnlyPath('/customers/12/files')).toBe(false)
    expect(isPublicAccountGaOnlyPath('/public-account-restricted')).toBe(false)
  })

  it('builds restricted notice url', () => {
    expect(toPublicAccountRestrictedPath('/team/members')).toBe(
      '/public-account-restricted?from=%2Fteam%2Fmembers',
    )
  })
})
