import { useEffect, useMemo } from 'react'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { useAuth } from '../../auth/AuthProvider'
import SmsBulkRecipientWorkspace from './bulk/SmsBulkRecipientWorkspace'
import SmsSendWorkspace from './send/SmsSendWorkspace'
import SmsHistoryWorkspace from './history/SmsHistoryWorkspace'
import SmsTemplatesWorkspace from './templates/SmsTemplatesWorkspace'
import { useSmsBulkRecipientState } from '../hooks/useSmsBulkRecipientState'
import type { SmsModuleViewProps } from '../hooks/useSmsModuleState'
import { ALIGO_API_SETTINGS_URL, formatKrMobileDisplay } from '../smsDisplayUtils'
import { resolveSmsAdDisplayName } from '../utils/smsMessageMeta'
import type { SmsModuleTab } from '../types/sms.types'

const TABS: { id: SmsModuleTab; label: string }[] = [
  { id: 'settings', label: '문자설정' },
  { id: 'groups', label: '그룹설정' },
  { id: 'send', label: '문자발송' },
  { id: 'templates', label: '템플릿관리' },
  { id: 'history', label: '발송내역' },
]

type Props = SmsModuleViewProps & {
  variant: 'pc' | 'mobile'
}

function NoticeBox({ error, notice }: { error: string | null; notice: string | null }) {
  if (error) {
    return <div className="sms-module__alert sms-module__alert--error">{error}</div>
  }
  if (notice) {
    return <div className="sms-module__alert sms-module__alert--success">{notice}</div>
  }
  return null
}

function ModuleDisabledNotice({ visible }: { visible: boolean }) {
  if (!visible) {
    return null
  }
  return (
    <div className="sms-module__alert sms-module__alert--error">
      문자 모듈이 비활성화되어 있습니다. 관리자에게 SMS_MODULE_ENABLED 설정을 확인해 주세요.
    </div>
  )
}

function EmptySettingsNotice({
  visible,
  loading,
}: {
  visible: boolean
  loading: boolean
}) {
  if (!visible || loading) {
    return null
  }
  return (
    <div className="sms-module__guide sms-module__guide--empty">
      <p>아직 알리고 연동 설정이 없습니다. 아래에서 알리고 아이디와 API Key를 입력해 저장해 주세요.</p>
    </div>
  )
}

function ProviderNotice({
  settings,
  settingsLoaded,
}: {
  settings: SmsModuleViewProps['settings']
  settingsLoaded: boolean
}) {
  if (!settingsLoaded || !settings) {
    return null
  }
  const hasCriticalNotice =
    !settings.moduleEnabled ||
    settings.providerIsMock ||
    settings.providerMode === 'mock' ||
    settings.providerMisconfigured ||
    settings.aligoTestMode
  if (!hasCriticalNotice) {
    return null
  }
  return (
    <div className="sms-module__guide">
      {!settings.moduleEnabled ? (
        <p>문자 발송 기능(SMS_MODULE_ENABLED)이 비활성화되어 있습니다.</p>
      ) : null}
      {settings.providerIsMock || settings.providerMode === 'mock' ? (
        <p>현재 provider가 mock입니다. 실제 알리고 발송·verified 처리는 되지 않습니다.</p>
      ) : null}
      {settings.providerMisconfigured ? (
        <p>
          운영 provider 설정이 올바르지 않습니다. SMS_MODULE_PROVIDER=gateway, aligo_gateway 또는 aligo 설정을
          확인해 주세요.
        </p>
      ) : null}
      {settings.aligoTestMode ? (
        <p>알리고 testmode가 켜져 있습니다. 테스트 발송 성공만으로 verified 되지 않습니다.</p>
      ) : null}
    </div>
  )
}

function RealSendStatusBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null
  }
  return (
    <span
      className="sms-module__status-badge"
      title="실제 문자 발송이 비활성화되어 있어 미리보기와 예약 저장만 가능합니다."
    >
      실발송 비활성 · 미리보기/예약 저장만 가능
    </span>
  )
}
function GuideBox({ outboundIpHint }: { outboundIpHint?: string }) {
  return (
    <div className="sms-module__guide">
      <p>알리고 API 설정 페이지에서 API Key, 발송 서버 IP, 발신번호 등록을 확인해 주세요.</p>
      <p>알리고 API 발송 서버 IP에는 아래 IP를 등록해 주세요.</p>
      {outboundIpHint ? (
        <p className="sms-module__ip-hint">{outboundIpHint}</p>
      ) : (
        <p className="sms-module__ip-hint">100.54.92.161</p>
      )}
      <p>문자 충전과 발신번호 등록은 알리고 사이트에서 직접 진행해 주세요.</p>
      <p>CRM에는 알리고에 등록된 기본 발신번호 하나만 저장합니다.</p>
      <p>API Key는 저장 후 다시 표시되지 않으며, 변경 시에만 새로 입력합니다.</p>
    </div>
  )
}

function SavedValueRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="sms-module__saved-row">
      <span className="sms-module__saved-label">{label}</span>
      <span className="sms-module__saved-value">{value}</span>
    </p>
  )
}

function RealSendDisabledHint({ visible }: { visible: boolean }) {
  if (!visible) {
    return null
  }
  return (
    <p className="sms-composer__send-disabled-note">
      실제 문자 발송은 아직 활성화되어 있지 않습니다. 미리보기와 저장만 가능합니다.
    </p>
  )
}

export default function SmsModuleBody(props: Props) {
  const {
    variant,
    tab,
    setTab,
    loading,
    busy,
    error,
    authRequired,
    settingsLoaded,
    moduleDisabled,
    notice,
    settings,
    verifiedSenders,
    templates,
    history,
    optOuts,
    balanceText,
    preview,
    settingsForm,
    setSettingsForm,
    sendForm,
    setSendForm,
    bulkForm,
    setBulkForm,
    templateForm,
    setTemplateForm,
    optOutForm,
    setOptOutForm,
    handleSaveSettings,
    handleDeleteSettings,
    handleTestSend,
    handleFetchBalance,
    handleSendSingle,
    previewAcknowledged,
    handlePreviewBulk,
    handleCreateBulk,
    handleLoadTemplateToSend,
    prepareResendFromHistory,
    handleSaveTemplate,
    handleSaveTemplateFromComposer,
    handleDeleteTemplate,
    handleUpdateTemplate,
    handleAddOptOut,
    handleRemoveOptOut,
    sendMode,
    navigateToSend,
  } = props

  const { user } = useAuth()
  const bulkRecipientState = useSmsBulkRecipientState()
  const realSendEnabled = Boolean(settings?.realSendEnabled)
  const resolvedAdDisplayName = useMemo(
    () =>
      resolveSmsAdDisplayName({
        savedAdDisplayName: settings?.adDisplayName,
        userDisplayName: user?.displayName,
        organizationDisplayName: user?.gaName,
      }),
    [settings?.adDisplayName, user?.displayName, user?.gaName],
  )
  const defaultSenderDisplay = formatKrMobileDisplay(
    settings?.defaultSender || sendForm.senderNumber || bulkForm.senderNumber,
  )

  useEffect(() => {
    if (tab === 'groups') {
      void bulkRecipientState.reloadGroups()
    }
  }, [tab, bulkRecipientState])

  return (
    <>
      <h1 className="sr-only">문자</h1>
      <div className={`sms-module__topbar sms-module__topbar--${variant}`}>
        <nav className={`sms-module__tabs sms-module__tabs--${variant}`}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`sms-module__tab${tab === t.id ? ' sms-module__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <RealSendStatusBadge
          visible={!authRequired && settingsLoaded && !!settings && !realSendEnabled}
        />
      </div>

      <div className="sms-module__content">
      <NoticeBox error={error} notice={authRequired ? null : notice} />
      <ModuleDisabledNotice visible={moduleDisabled} />
      {!authRequired ? <ProviderNotice settings={settings} settingsLoaded={settingsLoaded} /> : null}

      {loading ? <p className="sms-module__muted sms-module__loading">불러오는 중…</p> : null}

      {!loading && !moduleDisabled && !authRequired && !authRequired && tab === 'settings' ? (
        <section className="sms-module__panel">
          <GuideBox outboundIpHint={settings?.outboundServerIpHint} />
          <EmptySettingsNotice visible={!settings?.configured} loading={loading} />
          <div className="sms-module__settings-fields">
            <div className="sms-module__field-block">
              <span className="sms-module__field-title">알리고 아이디</span>
              {settings?.aligoUserId ? (
                <SavedValueRow label="저장됨:" value={settings.aligoUserId} />
              ) : null}
              <FormInput
                placeholder={settings?.aligoUserId ? '변경 시에만 입력' : '알리고 아이디'}
                value={settingsForm.aligoUserIdChange}
                onChange={(e) => setSettingsForm((p) => ({ ...p, aligoUserIdChange: e.target.value }))}
              />
            </div>

            <div className="sms-module__field-block">
              <span className="sms-module__field-title">API Key</span>
              {settings?.apiKeyMasked ? (
                <SavedValueRow label="저장됨:" value={settings.apiKeyMasked} />
              ) : null}
              <FormInput
                type="password"
                autoComplete="new-password"
                placeholder={settings?.apiKeyMasked ? '변경 시에만 입력' : 'API Key'}
                value={settingsForm.apiKeyChange}
                onChange={(e) => setSettingsForm((p) => ({ ...p, apiKeyChange: e.target.value }))}
              />
            </div>

            <div className="sms-module__field-block">
              <span className="sms-module__field-title">기본 발신번호</span>
              {settings?.defaultSender ? (
                <SavedValueRow
                  label="저장됨:"
                  value={formatKrMobileDisplay(settings.defaultSender)}
                />
              ) : null}
              <FormInput
                placeholder={
                  settings?.defaultSender ? '변경 시에만 입력' : '알리고에 등록된 발신번호'
                }
                value={settingsForm.defaultSenderChange}
                onChange={(e) => setSettingsForm((p) => ({ ...p, defaultSenderChange: e.target.value }))}
              />
            </div>

            <div className="sms-module__field-block">
              <span className="sms-module__field-title">광고 표시명</span>
              <p className="sms-module__field-hint">
                광고 표시명은 광고성 문자 맨 앞에 `(광고)`와 함께 표시됩니다.
              </p>
              <p className="sms-module__field-hint">
                예: `(광고)박성용` / 본문 / `무료거부 0808811258`
              </p>
              <p className="sms-module__field-desc">
                광고성 문자에 표시될 이름입니다. 예: 박성용, ○○보험대리점, ○○팀
              </p>
              {settings?.adDisplayName ? (
                <SavedValueRow label="저장됨:" value={settings.adDisplayName} />
              ) : null}
              <FormInput
                placeholder={settings?.adDisplayName ? '변경 시에만 입력' : '광고 표시명'}
                value={settingsForm.adDisplayNameChange}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, adDisplayNameChange: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="sms-module__actions">
            <FormButton type="button" disabled={busy || moduleDisabled} onClick={() => void handleSaveSettings()}>
              알리고 연동 설정 저장
            </FormButton>
            {settings?.configured ? (
              <FormButton
                type="button"
                variant="secondary"
                disabled={busy || moduleDisabled}
                onClick={() => void handleDeleteSettings()}
              >
                연동 해제
              </FormButton>
            ) : null}
          </div>

          <div className="sms-module__grid sms-module__grid--2">
            <label>
              테스트 수신번호
              <FormInput
                value={settingsForm.testReceiver}
                onChange={(e) => setSettingsForm((p) => ({ ...p, testReceiver: e.target.value }))}
              />
            </label>
            <label>
              테스트 메시지
              <FormInput
                value={settingsForm.testMessage}
                onChange={(e) => setSettingsForm((p) => ({ ...p, testMessage: e.target.value }))}
              />
            </label>
          </div>
          <div className="sms-module__actions">
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleTestSend()}>
              테스트 발송
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleFetchBalance()}>
              잔액 조회
            </FormButton>
            <a
              className="sms-module__link-btn"
              href={settings?.aligoApiSettingsUrl ?? ALIGO_API_SETTINGS_URL}
              target="_blank"
              rel="noreferrer"
            >
              알리고 API 설정 페이지 열기
            </a>
          </div>
          {balanceText ? (
            <div className="sms-module__balance-panel">
              <p className="sms-module__balance-title">잔액 조회 결과</p>
              <p className="sms-module__balance">{balanceText}</p>
            </div>
          ) : null}

          <div className="sms-settings-section sms-settings-section--opt-outs">
            <h2 className="sms-settings-section__title">수신거부 관리</h2>
            <div className="sms-module__grid sms-module__grid--2">
              <label>
                수신거부 번호
                <FormInput
                  value={optOutForm.phone}
                  onChange={(e) => setOptOutForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </label>
              <label>
                사유
                <FormInput
                  value={optOutForm.reason}
                  onChange={(e) => setOptOutForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </label>
            </div>
            <FormButton type="button" disabled={busy} onClick={() => void handleAddOptOut()}>
              수신거부 등록
            </FormButton>
            <ul className="sms-module__list">
              {optOuts.map((o) => (
                <li key={o.id} className="sms-module__list-row">
                  <span>
                    {o.phoneMasked} {o.reason ? `· ${o.reason}` : ''}
                  </span>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleRemoveOptOut(o.id)}>
                    삭제
                  </FormButton>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'groups' ? (
        <section className="sms-module__panel sms-module__panel--bulk-select">
          <SmsBulkRecipientWorkspace variant={variant} busy={busy} bulkState={bulkRecipientState} groupsOnly />
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'send' ? (
        <section className="sms-module__panel sms-module__panel--send">
          <SmsSendWorkspace
            variant={variant}
            module={props}
            initialSendMode={sendMode}
            adDisplayName={resolvedAdDisplayName}
          />
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'history' ? (
        <section className="sms-module__panel sms-module__panel--history">
          <SmsHistoryWorkspace
            variant={variant}
            module={{
              history,
              busy,
              prepareResendFromHistory,
              navigateToSend,
              setTab,
            }}
          />
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'templates' ? (
        <section className="sms-module__panel sms-module__panel--templates">
          <SmsTemplatesWorkspace variant={variant} module={props} adDisplayName={resolvedAdDisplayName} />
        </section>
      ) : null}
      </div>
    </>
  )
}
