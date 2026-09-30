import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from '../../dashboard/gaTenantMenu'
import {
  isInsuranceBillingEnforceAccessClient,
  isInsuranceBillingEnabledClient,
} from '../../insurance-billing/insuranceBillingConfig'
import {
  buildMenuPermissionMatrix,
  extractBuiltMenuLinkKeys,
  parseMenuEntriesForMatrix,
} from './menuPermissionMatrix'
import { MENU_PERMISSION_PREVIEW_GA_CODE } from './menuPermissionMatrix.types'

function builtLinkKeys(role: string, gaCode?: string, gaName?: string, hasActivePaidAccess = true): Set<string> {
  const entries = buildAppMenuForSession(role, gaCode, gaName, {
    hasActivePaidAccess,
    dynamicNewsletterBoards: [],
    teamMenuManageVisible: false,
  })
  return new Set(
    parseMenuEntriesForMatrix(entries).map((link) => `${link.path.split('?')[0]}::${link.label}`),
  )
}

describe('menuPermissionMatrix — SSOT sync', () => {
  it('matrix link sets match buildAppMenuForSession for each primary audience', () => {
    const matrix = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    for (const audienceId of ['GENERAL_USER', 'GA_USER', 'GA_STAFF', 'GA_ADMIN'] as const) {
      const built = extractBuiltMenuLinkKeys(audienceId, 'active')
      const fromMatrix = new Set(
        matrix.rows
          .filter((row) => {
            const status = row.cells[audienceId]?.status
            return status === 'visible' || status === 'blocked' || status === 'disabled'
          })
          .map((row) => row.rowKey),
      )
      expect(fromMatrix).toEqual(built)
    }
  })

  it('derives matrix rows from live menu build (no static MENU_PERMISSION_MATRIX object)', () => {
    const general = extractBuiltMenuLinkKeys('GENERAL_USER', 'active')
    const matrix = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    expect(general.size).toBeGreaterThan(0)
    expect(matrix.rows.length).toBeGreaterThanOrEqual(general.size)
  })
})

describe('menuPermissionMatrix — semantic policy snapshots', () => {
  it('GENERAL USER: 고객리스트 있음, 보험청구 설정 없음', () => {
    const matrix = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    const customers = matrix.rows.find((r) => r.primaryPath === '/customers')
    expect(customers?.cells.GENERAL_USER.status).not.toBe('hidden')
    const claimAdmin = matrix.rows.find((r) => r.primaryPath === '/admin/claim/insurance-companies')
    expect(claimAdmin?.cells.GENERAL_USER.status).toBe('hidden')
  })

  it('GA USER: 신청서는 GA+유료 정책으로 entitlement 평가', () => {
    const paid = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    const free = buildMenuPermissionMatrix({ paidAccessMode: 'free' })
    const appPaid = paid.rows.find((r) => r.menuLabel === '신청서 작성')
    const appFree = free.rows.find((r) => r.menuLabel === '신청서 작성')
    expect(appPaid?.cells.GA_USER.status).toBe('visible')
    const billingEnforced =
      isInsuranceBillingEnabledClient() && isInsuranceBillingEnforceAccessClient()
    if (billingEnforced) {
      expect(appFree?.cells.GA_USER.status).toBe('blocked')
    } else {
      expect(appFree?.cells.GA_USER.status).toBe('visible')
    }
  })

  it('GA_STAFF: 보험청구 설정·공유 계정관리, 고객리스트 없음', () => {
    const matrix = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    expect(
      matrix.rows.find((r) => r.menuLabel === '보험청구 설정')?.cells.GA_STAFF.status,
    ).not.toBe('hidden')
    expect(
      matrix.rows.find((r) => r.primaryPath === '/insurance/account-credentials/shared')?.cells.GA_STAFF.status,
    ).not.toBe('hidden')
    expect(matrix.rows.find((r) => r.primaryPath === '/customers')?.cells.GA_STAFF.status).toBe('hidden')
  })

  it('GA_ADMIN: GA전용 소식지·감사 로그, 고객리스트 없음', () => {
    const matrix = buildMenuPermissionMatrix({ paidAccessMode: 'active' })
    expect(
      matrix.rows.find((r) => r.primaryPath === '/admin/newsletter-boards')?.cells.GA_ADMIN.status,
    ).not.toBe('hidden')
    expect(
      matrix.rows.find((r) => r.primaryPath === '/admin/audit-logs')?.cells.GA_ADMIN.status,
    ).not.toBe('hidden')
    expect(matrix.rows.find((r) => r.primaryPath === '/customers')?.cells.GA_ADMIN.status).toBe('hidden')
  })

  it('preview GA code is used for GA member USER context', () => {
    const gaUserKeys = builtLinkKeys('USER', MENU_PERMISSION_PREVIEW_GA_CODE, 'GA 소속')
    const generalKeys = builtLinkKeys('USER', 'GENERAL', '공용')
    expect(gaUserKeys.size).toBeGreaterThan(0)
    expect(generalKeys.size).toBeGreaterThan(0)
  })
})
