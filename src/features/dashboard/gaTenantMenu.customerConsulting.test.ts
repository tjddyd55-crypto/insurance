import { describe, expect, it } from 'vitest'

import { isActivePcNavigationPath } from '../../components/layout/pcNavigationUtils'
import {
  buildAppMenuForSession,
  COVERAGE_SIMULATION_MENU_ITEM,
  CUSTOMER_CONSULTING_SECTION_LABEL,
  PERSONAL_BINDER_MENU_ITEM,
  type GaTenantDashboardMenuEntry,
} from './gaTenantMenu'

function linkPaths(entries: GaTenantDashboardMenuEntry[]): string[] {
  return entries
    .filter((entry) => entry.type === 'link')
    .map((entry) => (entry.type === 'link' ? entry.path : ''))
}

function sectionLabels(entries: GaTenantDashboardMenuEntry[]): string[] {
  return entries
    .filter((entry) => entry.type === 'section')
    .map((entry) => (entry.type === 'section' ? entry.label : ''))
}

function sectionOfLink(entries: GaTenantDashboardMenuEntry[], path: string): string {
  let current = ''
  for (const entry of entries) {
    if (entry.type === 'section') {
      current = entry.label
    }
    if (entry.type === 'link' && entry.path === path) {
      return current
    }
  }
  return ''
}

function linksInSection(
  entries: GaTenantDashboardMenuEntry[],
  sectionLabel: string,
): { label: string; path: string }[] {
  let inSection = false
  const links: { label: string; path: string }[] = []
  for (const entry of entries) {
    if (entry.type === 'section') {
      if (inSection) {
        break
      }
      inSection = entry.label === sectionLabel
      continue
    }
    if (inSection && entry.type === 'link') {
      links.push({ label: entry.label, path: entry.path })
    }
  }
  return links
}

describe('buildAppMenuForSession — 고객 상담', () => {
  it('USER 메뉴의 고객 상담은 내 바인더와 시뮬레이션만 가진다', () => {
    const menu = buildAppMenuForSession('USER', 'TEST', 'Test GA')
    const sections = sectionLabels(menu)
    const customerIndex = sections.indexOf('고객관리')
    const consultingIndex = sections.indexOf(CUSTOMER_CONSULTING_SECTION_LABEL)
    const newsletterIndex = sections.indexOf('소식지')

    expect(consultingIndex).toBe(customerIndex + 1)
    expect(newsletterIndex).toBe(consultingIndex + 1)
    expect(linksInSection(menu, CUSTOMER_CONSULTING_SECTION_LABEL)).toEqual([
      { label: '내 바인더', path: PERSONAL_BINDER_MENU_ITEM.path },
      { label: '시뮬레이션', path: COVERAGE_SIMULATION_MENU_ITEM.path },
    ])
    expect(COVERAGE_SIMULATION_MENU_ITEM.path).toBe('/coverage-simulator')
    expect(sectionOfLink(menu, PERSONAL_BINDER_MENU_ITEM.path)).toBe(CUSTOMER_CONSULTING_SECTION_LABEL)
    expect(sectionOfLink(menu, COVERAGE_SIMULATION_MENU_ITEM.path)).toBe(
      CUSTOMER_CONSULTING_SECTION_LABEL,
    )
    expect(sectionOfLink(menu, '/sms/settings')).toBe('업무편의')
    expect(linkPaths(menu).filter((path) => path === PERSONAL_BINDER_MENU_ITEM.path)).toHaveLength(1)
    expect(menu.some((entry) => entry.type === 'link' && entry.label === '보장 분석')).toBe(false)
  })

  it('USER 가 아닌 역할 메뉴에는 고객 상담을 넣지 않는다', () => {
    for (const role of ['GA_ADMIN', 'GA_STAFF', 'SUPER_ADMIN', 'INSURER_MANAGER', 'LOSS_ADJUSTER']) {
      const menu = buildAppMenuForSession(role, 'TEST', 'Test GA')
      expect(sectionLabels(menu)).not.toContain(CUSTOMER_CONSULTING_SECTION_LABEL)
      expect(linkPaths(menu)).not.toContain(COVERAGE_SIMULATION_MENU_ITEM.path)
      expect(linkPaths(menu)).not.toContain(PERSONAL_BINDER_MENU_ITEM.path)
    }
  })

  it('구독 만료 USER 에게는 고객 상담 메뉴를 숨긴다', () => {
    const menu = buildAppMenuForSession('USER', 'TEST', 'Test GA', { subscriptionExpired: true })
    expect(sectionLabels(menu)).not.toContain(CUSTOMER_CONSULTING_SECTION_LABEL)
    expect(linkPaths(menu)).not.toContain(COVERAGE_SIMULATION_MENU_ITEM.path)
    expect(linkPaths(menu)).not.toContain(PERSONAL_BINDER_MENU_ITEM.path)
    expect(linkPaths(menu)).toContain('/profile')
  })
})

describe('isActivePcNavigationPath — 보장 시뮬레이션', () => {
  it('시뮬레이터 하위 경로를 메뉴 활성으로 보고 미리보기 경로는 구분한다', () => {
    expect(isActivePcNavigationPath('/coverage-simulator', COVERAGE_SIMULATION_MENU_ITEM.path)).toBe(true)
    expect(
      isActivePcNavigationPath('/coverage-simulator/cancer', COVERAGE_SIMULATION_MENU_ITEM.path),
    ).toBe(true)
    expect(
      isActivePcNavigationPath(
        '/coverage-simulator/scenarios/abc',
        COVERAGE_SIMULATION_MENU_ITEM.path,
      ),
    ).toBe(true)
    expect(
      isActivePcNavigationPath('/coverage-simulator-preview/pc', COVERAGE_SIMULATION_MENU_ITEM.path),
    ).toBe(false)
    expect(isActivePcNavigationPath('/customers', COVERAGE_SIMULATION_MENU_ITEM.path)).toBe(false)
  })

  it('내 바인더 하위 경로를 메뉴 활성으로 본다', () => {
    expect(isActivePcNavigationPath('/personal-binders', PERSONAL_BINDER_MENU_ITEM.path)).toBe(true)
    expect(
      isActivePcNavigationPath('/personal-binders/materials', PERSONAL_BINDER_MENU_ITEM.path),
    ).toBe(true)
    expect(
      isActivePcNavigationPath('/personal-binders/binder-1/edit', PERSONAL_BINDER_MENU_ITEM.path),
    ).toBe(true)
    expect(isActivePcNavigationPath('/customers', PERSONAL_BINDER_MENU_ITEM.path)).toBe(false)
  })
})
