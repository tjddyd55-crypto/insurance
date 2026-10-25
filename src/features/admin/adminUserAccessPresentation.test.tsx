import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  formatAdminUserAppVersion,
  formatAdminUserChannel,
  formatAdminUserDevice,
  formatAdminUserRecentAccess,
} from './adminUserAccessPresentation'
import { AdminUserAccessDetails } from './components/AdminUserAccessSection'

describe('관리자 사용자 접속 채널 표시', () => {
  it('최근 접속: last_seen 우선, 없으면 로그인 기준 표기, 둘 다 없으면 기록 없음', () => {
    expect(formatAdminUserRecentAccess({ last_seen_at: '2026-01-02T03:04:00Z', last_login_at: '2025-01-01T00:00:00Z' })).not.toContain('로그인 기준')
    expect(formatAdminUserRecentAccess({ last_seen_at: null, last_login_at: '2026-01-02T03:04:00Z' })).toContain('(로그인 기준)')
    expect(formatAdminUserRecentAccess({})).toBe('접속 기록 없음')
  })
  it('채널/기기/버전 라벨, null=미확인', () => {
    expect(formatAdminUserChannel('web_desktop')).toBe('PC 웹')
    expect(formatAdminUserChannel('web_mobile')).toBe('모바일 웹')
    expect(formatAdminUserChannel('desktop_windows')).toBe('Windows 앱')
    expect(formatAdminUserChannel('native_android')).toBe('Android 앱')
    expect(formatAdminUserChannel('native_ios')).toBe('iPhone 앱')
    expect(formatAdminUserChannel(null)).toBe('미확인')
    expect(formatAdminUserDevice('')).toBe('미확인')
    expect(formatAdminUserAppVersion('desktop_windows', '1.0.7')).toBe('v1.0.7')
    expect(formatAdminUserAppVersion('web_mobile', null)).toBe('웹 (해당 없음)')
    expect(formatAdminUserAppVersion(null, null)).toBe('미확인')
  })
  it('상세: 최초/최근/사용해 본 채널 + 로그인 기록, IP 미표시', () => {
    const html = renderToStaticMarkup(
      <AdminUserAccessDetails
        data={{
          userId: 'u1',
          createdAt: '2026-01-01T00:00:00Z',
          lastLoginAt: '2026-10-20T00:00:00Z',
          lastSeenAt: '2026-10-24T00:00:00Z',
          firstClientType: null,
          lastClientType: 'native_android',
          lastDeviceModel: 'SM-S931N',
          lastAppVersion: '2.3.1',
          usedClientTypes: ['web_desktop', 'native_android'],
          recentSessions: [
            { createdAt: '2026-10-20T00:00:00Z', clientType: 'desktop_windows', platform: 'windows', deviceModel: 'Windows PC', appVersion: '1.0.7' },
          ],
        }}
      />,
    )
    expect(html).toContain('최초 사용 채널')
    expect(html).toContain('미확인')
    expect(html).toContain('Android 앱')
    expect(html).toContain('PC 웹, Android 앱')
    expect(html).toContain('Windows 앱')
    expect(html).toContain('v1.0.7')
    expect(html).toContain('최근 로그인 기록')
    expect(html).not.toMatch(/IP|\d+\.\d+\.\d+\.\d+/)
  })
})
