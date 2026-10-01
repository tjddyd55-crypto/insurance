import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { safeApiResponse } from '../../../../lib/safeApiResponse'
import {
  readServiceIntegrationConnectResult,
  readServiceIntegrationProviders,
  type ServiceIntegrationCard,
} from '../../api/serviceIntegrationsApi'
import type { ServiceIntegrationsViewProps } from '../../hooks/useServiceIntegrationsState'
import ServiceIntegrationsPCView from './ServiceIntegrationsPCView'

/** USER 세션이 받는 목록. OAuth 클라이언트 ID가 없으면 Google/Naver는 미설정. */
const USER_ENVELOPE = {
  success: true,
  data: {
    providers: [
      {
        key: 'google_calendar',
        group: 'google',
        groupLabel: 'Google',
        name: 'Google Calendar',
        description: '일정을 Google 캘린더와 맞출 준비입니다.',
        kind: 'oauth',
        availability: 'unconfigured',
        status: 'unconfigured',
        lastSyncedAt: null,
        lastError: null,
        secretMasked: null,
        sender: '',
        accountLabel: '',
        settingsPath: null,
      },
      {
        key: 'naver_calendar',
        group: 'naver',
        groupLabel: 'Naver',
        name: 'Naver Calendar',
        description: '일정을 네이버 캘린더와 맞출 준비입니다.',
        kind: 'oauth',
        availability: 'unconfigured',
        status: 'unconfigured',
        lastSyncedAt: null,
        lastError: null,
        secretMasked: null,
        sender: '',
        accountLabel: '',
        settingsPath: null,
      },
      {
        key: 'aligo_sms',
        group: 'aligo',
        groupLabel: 'Aligo',
        name: '알리고 문자',
        description: 'CRM 단체·마케팅 문자 연동입니다.',
        kind: 'aligo',
        availability: 'ready',
        status: 'disconnected',
        lastSyncedAt: null,
        lastError: null,
        secretMasked: null,
        sender: '',
        accountLabel: '',
        settingsPath: '/sms/settings',
      },
    ] satisfies ServiceIntegrationCard[],
  },
}

const idleActions: Pick<
  ServiceIntegrationsViewProps,
  'onConnect' | 'onDisconnect' | 'onOpenSettings' | 'onRefreshBalance'
> = {
  onConnect: () => undefined,
  onDisconnect: () => undefined,
  onOpenSettings: () => undefined,
  onRefreshBalance: () => undefined,
}

describe('service integrations page for a USER session', () => {
  it('renders provider cards after the success envelope is unwrapped', () => {
    const unwrapped = safeApiResponse(USER_ENVELOPE)
    expect(unwrapped).not.toHaveProperty('data')

    const providers = readServiceIntegrationProviders(unwrapped)
    expect(providers.map((provider) => provider.key)).toEqual([
      'google_calendar',
      'naver_calendar',
      'aligo_sms',
    ])

    const html = renderToStaticMarkup(
      <ServiceIntegrationsPCView
        loading={false}
        error=""
        notice=""
        balanceText=""
        providers={providers}
        busyKey=""
        {...idleActions}
      />,
    )

    expect(html).toContain('서비스 연동')
    expect(html).toContain('Google Calendar')
    expect(html).toContain('Naver Calendar')
    expect(html).toContain('미설정')
    expect(html).toContain('알리고 문자')
    expect(html).toContain('설정')
    expect(html).not.toContain('연동 제공자 목록이 비어 있습니다.')
  })

  it('keeps the settings path when the connect body is unwrapped', () => {
    const unwrapped = safeApiResponse({
      success: true,
      data: { action: 'open_settings', path: '/sms/settings' },
    })
    expect(readServiceIntegrationConnectResult(unwrapped)).toEqual({ path: '/sms/settings' })
  })

  it('shows an empty state instead of a blank body when the list is missing', () => {
    const html = renderToStaticMarkup(
      <ServiceIntegrationsPCView
        loading={false}
        error=""
        notice=""
        balanceText=""
        providers={readServiceIntegrationProviders({ success: true })}
        busyKey=""
        {...idleActions}
      />,
    )
    expect(html).toContain('연동 제공자 목록이 비어 있습니다.')
    expect(html).not.toContain('Google Calendar')
  })

  it('shows the load error instead of a blank body', () => {
    const html = renderToStaticMarkup(
      <ServiceIntegrationsPCView
        loading={false}
        error="서비스 연동 정보를 불러오지 못했습니다."
        notice=""
        balanceText=""
        providers={[]}
        busyKey=""
        {...idleActions}
      />,
    )
    expect(html).toContain('서비스 연동 정보를 불러오지 못했습니다.')
    expect(html).toContain('role="alert"')
  })
})
