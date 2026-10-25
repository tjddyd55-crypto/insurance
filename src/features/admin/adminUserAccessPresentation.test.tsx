import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminUserAccessContext, AdminUserAccessSession } from '../auth/authApi'
import {
  formatAdminUnknownHistorySummary,
  formatAdminUserAppVersion,
  formatAdminUserChannel,
  formatAdminUserDevice,
  formatAdminUserRecentAccess,
  listAdminUsedChannelLabels,
  splitAdminAccessHistory,
} from './adminUserAccessPresentation'
import { AdminUserAccessDetails } from './components/AdminUserAccessSection'

const s = (
  clientType: string | null,
  deviceModel: string | null,
  appVersion: string | null,
  createdAt = '2026-10-20T00:00:00Z',
): AdminUserAccessSession => ({ createdAt, clientType, platform: null, deviceModel, appVersion })

const base = (over: Partial<AdminUserAccessContext>): AdminUserAccessContext => ({
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: '2026-10-20T00:00:00Z',
  lastSeenAt: '2026-10-24T00:00:00Z',
  firstClientType: 'web_desktop',
  lastClientType: 'web_desktop',
  lastDeviceModel: 'Windows · Chrome',
  lastAppVersion: null,
  usedClientTypes: ['web_desktop'],
  recentSessions: [s('web_desktop', 'Windows · Chrome', null)],
  ...over,
})

const render = (d: AdminUserAccessContext) => renderToStaticMarkup(<AdminUserAccessDetails data={d} />)
const rowCount = (html: string) => (html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g) ?? []).length

describe('관리자 사용자 접속 표시 (presentation)', () => {
  it('최근 접속: last_seen 우선, 로그인 기준 fallback, 없으면 미확인', () => {
    expect(formatAdminUserRecentAccess({ last_seen_at: '2026-01-02T03:04:00Z', last_login_at: '2025-01-01T00:00:00Z' })).not.toContain('로그인 기준')
    expect(formatAdminUserRecentAccess({ last_seen_at: null, last_login_at: '2026-01-02T03:04:00Z' })).toContain('(로그인 기준)')
    expect(formatAdminUserRecentAccess({})).toBe('미확인')
  })
  it('채널/기기/버전 라벨, 빈 값은 미확인 단일 표기', () => {
    expect(formatAdminUserChannel('web_desktop')).toBe('PC 웹')
    expect(formatAdminUserChannel('web_mobile')).toBe('모바일 웹')
    expect(formatAdminUserChannel('desktop_windows')).toBe('Windows 앱')
    expect(formatAdminUserChannel('native_android')).toBe('Android 앱')
    expect(formatAdminUserChannel('native_ios')).toBe('iPhone 앱')
    expect(formatAdminUserChannel(null)).toBe('미확인')
    expect(formatAdminUserDevice('')).toBe('미확인')
    expect(formatAdminUserDevice(null, 'desktop_windows')).toBe('Windows PC')
    expect(formatAdminUserDevice('SM-S931N', 'native_android')).toBe('SM-S931N')
    expect(formatAdminUserDevice('iPhone17,1', 'native_ios')).toBe('iPhone17,1')
    expect(formatAdminUserDevice('iPhone · Safari', 'web_mobile')).toBe('iPhone · Safari')
    expect(formatAdminUserAppVersion('desktop_windows', '1.0.7')).toBe('v1.0.7')
    expect(formatAdminUserAppVersion('web_mobile', null)).toBe('웹 (해당 없음)')
    expect(formatAdminUserAppVersion(null, null)).toBe('미확인')
    expect(listAdminUsedChannelLabels(['native_ios', 'bogus', 'web_desktop', 'web_desktop'])).toEqual(['PC 웹', 'iPhone 앱'])
  })
  it('기록 분리: 알려진 채널만 표, 미확인은 개수 요약', () => {
    const { known, unknownCount } = splitAdminAccessHistory([s('web_desktop', null, null), s(null, null, null), s('x', null, null)])
    expect(known).toHaveLength(1)
    expect(unknownCount).toBe(2)
    expect(formatAdminUnknownHistorySummary(2, true)).toBe('이전 기록 2건은 접속 채널 정보가 없습니다.')
    expect(formatAdminUnknownHistorySummary(0, true)).toBe('')
  })
})

describe('AdminUserAccessDetails fixtures', () => {
  it('A: PC 웹만', () => {
    const html = render(base({}))
    expect(html).toContain('접속 정보')
    expect(html).toContain('최근 접속 기록')
    expect(html).toContain('최근 로그인')
    expect(html).toContain('로그인 기준')
    expect(html).toContain('실제 사용 기준')
    expect(html).toContain('Windows · Chrome')
    expect(html).toContain('웹 (해당 없음)')
    expect(html).toContain('<th scope="col">일시</th>')
    expect(html).toContain('<th scope="col">앱 버전</th>')
    expect(rowCount(html)).toBe(1)
    expect(html).not.toContain('>-<')
    expect(html).not.toContain('없음<')
    expect(html).not.toMatch(/IP|\d+\.\d+\.\d+\.\d+/)
  })
  it('필드 순서: 최근 로그인 → 최근 접속 → 최근 채널 → 최근 기기 → 앱 버전 → 최초 사용 채널 → 사용해 본 채널', () => {
    const html = render(base({}))
    const order = ['최근 로그인', '최근 접속<', '최근 채널', '최근 기기', '앱 버전', '최초 사용 채널', '사용해 본 채널']
    const idx = order.map((k) => html.indexOf(k))
    expect(idx.every((v) => v >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })
  it('B: PC 웹 + Android', () => {
    const html = render(
      base({
        lastClientType: 'native_android',
        lastDeviceModel: 'SM-S931N',
        lastAppVersion: '2.3.1',
        usedClientTypes: ['web_desktop', 'native_android'],
        recentSessions: [s('native_android', 'SM-S931N', '2.3.1'), s('web_desktop', 'Windows · Chrome', null)],
      }),
    )
    expect(html).toContain('admin-user-access__chip">PC 웹<')
    expect(html).toContain('admin-user-access__chip">Android 앱<')
    expect(html).toContain('SM-S931N')
    expect(html).toContain('v2.3.1')
    expect(rowCount(html)).toBe(2)
  })
  it('C: 5개 채널 모두', () => {
    const all = ['web_desktop', 'web_mobile', 'desktop_windows', 'native_android', 'native_ios']
    const html = render(
      base({
        usedClientTypes: all,
        recentSessions: [
          s('native_ios', 'iPhone17,1', '2.3.1'),
          s('native_android', 'SM-S931N', '2.3.1'),
          s('desktop_windows', null, '1.0.7'),
          s('web_mobile', 'iPhone · Safari', null),
          s('web_desktop', 'Windows · Chrome', null),
        ],
      }),
    )
    for (const l of ['PC 웹', '모바일 웹', 'Windows 앱', 'Android 앱', 'iPhone 앱']) {
      expect(html).toContain(`admin-user-access__chip">${l}<`)
    }
    expect(html).toContain('Windows PC')
    expect(html).toContain('iPhone17,1')
    expect(rowCount(html)).toBe(5)
  })
  it('D: 4건 known + 15건 unknown → 표 4행 + 요약 1줄', () => {
    const rows = [
      s('web_desktop', 'Windows · Chrome', null),
      s('native_android', 'SM-S931N', '2.3.1'),
      s('desktop_windows', null, '1.0.7'),
      s('web_mobile', 'iPhone · Safari', null),
      ...Array.from({ length: 15 }, () => s(null, null, null, '2026-01-01T00:00:00Z')),
    ]
    const html = render(base({ recentSessions: rows }))
    expect(rowCount(html)).toBe(4)
    expect(html).toContain('이전 기록 15건은 접속 채널 정보가 없습니다.')
  })
  it('E: 모두 unknown → 표 없음, 요약만', () => {
    const html = render(
      base({
        firstClientType: null,
        lastClientType: null,
        lastDeviceModel: null,
        usedClientTypes: [],
        recentSessions: Array.from({ length: 20 }, () => s(null, null, null)),
      }),
    )
    expect(html).not.toContain('<table')
    expect(html).toContain('기록 20건 모두 접속 채널 정보가 없습니다.')
    expect(html).toContain('미확인')
  })
  it('F: 긴 기기 모델 → ellipsis + title', () => {
    const long = 'Samsung Galaxy Z Fold Ultra Special Edition SM-F999XYZ-LONG-MODEL-NAME'
    const html = render(base({ lastClientType: 'native_android', lastDeviceModel: long, recentSessions: [s('native_android', long, '2.3.1')] }))
    expect(html).toContain(`admin-user-access__ellipsis" title="${long}"`)
  })
  it('G: 앱 버전 null (네이티브) → 미확인', () => {
    const html = render(base({ lastClientType: 'native_ios', lastDeviceModel: 'iPhone17,1', lastAppVersion: null, recentSessions: [s('native_ios', 'iPhone17,1', null)] }))
    expect(html).toContain('<dd>미확인</dd>')
    expect(html).toContain('<td>미확인</td>')
  })
})
