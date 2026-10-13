import { describe, expect, it } from 'vitest'
import type { InsurerSite } from '../../insurer-sites/api/insurerSitesApi'
import type { CompanyDirectoryEntry } from './types'
import {
  buildInsuranceCompanyPickerOptions,
  resolveCatalogSiteDirectoryBinding,
} from './insuranceCompanyCatalogOptions'

function site(name: string, category: 'life' | 'non_life'): InsurerSite {
  return {
    id: 1,
    category,
    name,
    logoPath: '',
    salesUrl: '',
    homepageUrl: '',
    disclosureUrl: '',
    claimUrl: '',
    sortOrder: 1,
    isActive: true,
  }
}

function dirEntry(name: string, companyCode: string): CompanyDirectoryEntry {
  return {
    id: 99,
    companyCode,
    category: 'LIFE',
    name,
    customerCenter: '1588-0000',
    systemPhone: '',
    incallNumber: '',
    visitInfo: '',
    contacts: [],
    general: null,
  }
}

describe('buildInsuranceCompanyPickerOptions', () => {
  it('설계사이트 카탈로그 전체를 노출하고 디렉터리에 있으면 companyCode를 쓴다', () => {
    const catalog = [site('삼성생명', 'life'), site('한화생명', 'life')]
    const directory = [dirEntry('푸본현대생명', 'INS_SEED_011')]
    const options = buildInsuranceCompanyPickerOptions(directory, catalog, 'LIFE')
    expect(options.map((row) => row.name).sort((a, b) => a.localeCompare(b, 'ko'))).toEqual(
      ['삼성생명', '한화생명', '푸본현대생명'].sort((a, b) => a.localeCompare(b, 'ko')),
    )
    const fubon = options.find((row) => row.name === '푸본현대생명')
    expect(fubon?.companyCode).toBe('INS_SEED_011')
    expect(fubon?.tel).toBe('1588-0000')
    const samsung = options.find((row) => row.name === '삼성생명')
    expect(samsung?.companyCode.startsWith('STATIC:')).toBe(true)
  })

  it('동일 이름 마스터가 2건이면 STATIC 코드로 신규 저장 경로를 쓴다', () => {
    const directory = [
      { ...dirEntry('하나손해보험', 'INS_A'), id: 1, category: 'NON_LIFE' as const },
      { ...dirEntry('하나손해보험', 'INS_B'), id: 100, category: 'NON_LIFE' as const },
    ]
    const binding = resolveCatalogSiteDirectoryBinding(directory, 'NON_LIFE', '하나손해보험')
    expect(binding.ambiguousDirectoryMatches).toBe(2)
    expect(binding.companyCode.startsWith('STATIC:')).toBe(true)
    expect(binding.companyId).toBeNull()
  })

  it('이름·종류가 일치하는 마스터가 1건이면 persisted companyCode를 쓴다', () => {
    const directory = [{ ...dirEntry('농협손해보험', 'INS_NH'), id: 5, category: 'NON_LIFE' }]
    const binding = resolveCatalogSiteDirectoryBinding(directory, 'NON_LIFE', '농협손해보험')
    expect(binding.companyCode).toBe('INS_NH')
    expect(binding.companyId).toBe(5)
  })

  it('GENERAL은 디렉터리 목록만 사용한다', () => {
    const catalog = [site('삼성생명', 'life')]
    const directory = [
      {
        ...dirEntry('일반보험A', 'INS_GEN_1'),
        category: 'GENERAL',
      },
    ]
    const options = buildInsuranceCompanyPickerOptions(directory, catalog, 'GENERAL')
    expect(options).toHaveLength(1)
    expect(options[0].name).toBe('일반보험A')
  })
})
