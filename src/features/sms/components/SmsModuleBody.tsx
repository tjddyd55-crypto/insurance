import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import type { SmsModuleViewProps } from '../hooks/useSmsModuleState'
import { ALIGO_API_SETTINGS_URL, formatKrMobileDisplay } from '../smsDisplayUtils'
import type { SmsModuleTab } from '../types/sms.types'

const TABS: { id: SmsModuleTab; label: string }[] = [
  { id: 'settings', label: '문자 설정' },
  { id: 'send', label: '문자 보내기' },
  { id: 'bulk', label: '단체문자' },
  { id: 'scheduled', label: '예약문자' },
  { id: 'templates', label: '문자 템플릿' },
  { id: 'history', label: '발송 이력' },
  { id: 'opt-outs', label: '수신거부 관리' },
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
  return (
    <div className="sms-module__guide">
      {!settings.moduleEnabled ? (
        <p>문자 발송 기능(SMS_MODULE_ENABLED)이 비활성화되어 있습니다.</p>
      ) : null}
      {settings.providerIsMock || settings.providerMode === 'mock' ? (
        <p>현재 provider가 mock입니다. 실제 알리고 발송·verified 처리는 되지 않습니다.</p>
      ) : null}
      {settings.usesGateway ? (
        <p>CRM 문자는 EC2 SMS Gateway를 통해 알리고로 발송됩니다. 알리고에 등록할 IP는 아래 안내를 따르세요.</p>
      ) : null}
      {!settings.realSendEnabled ? (
        <p>
          실제 문자 발송(SMS_MODULE_REAL_SEND_ENABLED)은 비활성화되어 있습니다. 설정·미리보기·예약 저장만
          가능합니다.
        </p>
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
    scheduledCampaigns,
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
    sendByteInfo,
    bulkByteInfo,
    handleSaveSettings,
    handleDeleteSettings,
    handleTestSend,
    handleFetchBalance,
    handleSendSingle,
    previewAcknowledged,
    handlePreviewBulk,
    handleCreateBulk,
    handleCancelCampaign,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleAddOptOut,
    handleRemoveOptOut,
  } = props

  return (
    <>
      <header className="sms-module__header">
        <h1>문자 발송</h1>
        <p className="sms-module__subtitle">알리고 계정 연동 · API Key·발송 IP·발신번호는 알리고 API 설정 페이지에서 확인</p>
      </header>

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
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'send' ? (
        <section className="sms-module__panel">
          <div className="sms-module__grid">
            <label>
              발신번호 (검증 완료만)
              <select
                className="sms-module__select"
                value={sendForm.senderNumber}
                onChange={(e) => setSendForm((p) => ({ ...p, senderNumber: e.target.value }))}
              >
                <option value="">선택</option>
                {verifiedSenders.map((s) => (
                  <option key={s.id} value={s.senderNumber}>
                    {s.senderNumber} ({s.label})
                  </option>
                ))}
              </select>
            </label>
            <label>
              수신번호
              <FormInput
                value={sendForm.receiver}
                onChange={(e) => setSendForm((p) => ({ ...p, receiver: e.target.value }))}
              />
            </label>
            <label>
              메시지 유형
              <select
                className="sms-module__select"
                value={sendForm.messageType}
                onChange={(e) =>
                  setSendForm((p) => ({ ...p, messageType: e.target.value as 'info' | 'ad' }))
                }
              >
                <option value="info">정보성</option>
                <option value="ad">광고성</option>
              </select>
            </label>
          </div>
          <label>
            메시지
            <textarea
              className="sms-module__textarea"
              rows={5}
              value={sendForm.message}
              onChange={(e) => setSendForm((p) => ({ ...p, message: e.target.value }))}
            />
          </label>
          <p className="sms-module__muted">
            {sendByteInfo.bytes} byte · 예상 {sendByteInfo.type}
          </p>
          <FormButton type="button" disabled={busy} onClick={() => void handleSendSingle()}>
            즉시 발송
          </FormButton>
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && (tab === 'bulk' || tab === 'scheduled') ? (
        <section className="sms-module__panel">
          <p className="sms-module__muted">{`{고객명}`} 치환을 지원합니다. 고객 ID를 쉼표/줄바꿈으로 입력하세요.</p>
          <div className="sms-module__grid">
            <label>
              캠페인 제목
              <FormInput
                value={bulkForm.title}
                onChange={(e) => setBulkForm((p) => ({ ...p, title: e.target.value }))}
              />
            </label>
            <label>
              발신번호
              <select
                className="sms-module__select"
                value={bulkForm.senderNumber}
                onChange={(e) => setBulkForm((p) => ({ ...p, senderNumber: e.target.value }))}
              >
                <option value="">선택</option>
                {verifiedSenders.map((s) => (
                  <option key={s.id} value={s.senderNumber}>
                    {s.senderNumber}
                  </option>
                ))}
              </select>
            </label>
            {tab === 'scheduled' ? (
              <label>
                예약 일시
                <FormInput
                  type="datetime-local"
                  value={bulkForm.scheduledAt}
                  onChange={(e) => setBulkForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </label>
            ) : null}
          </div>
          <label>
            대상 고객 ID 목록
            <textarea
              className="sms-module__textarea"
              rows={3}
              placeholder="예: 101, 102, 103"
              value={bulkForm.customerIdsText}
              onChange={(e) => setBulkForm((p) => ({ ...p, customerIdsText: e.target.value }))}
            />
          </label>
          <label>
            메시지
            <textarea
              className="sms-module__textarea"
              rows={5}
              value={bulkForm.message}
              onChange={(e) => setBulkForm((p) => ({ ...p, message: e.target.value }))}
            />
          </label>
          <p className="sms-module__muted">
            {bulkByteInfo.bytes} byte · 예상 {bulkByteInfo.type}
          </p>
          <div className="sms-module__actions">
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handlePreviewBulk()}>
              발송 미리보기
            </FormButton>
            {tab === 'bulk' ? (
              <FormButton type="button" disabled={busy || !previewAcknowledged} onClick={() => void handleCreateBulk(false)}>
                미리보기 확인 후 즉시 발송
              </FormButton>
            ) : (
              <FormButton type="button" disabled={busy} onClick={() => void handleCreateBulk(true)}>
                예약 캠페인 저장
              </FormButton>
            )}
          </div>
          {preview ? (
            <div className="sms-module__preview">
              <p>
                발송 가능 {preview.sendableCount}건 / 제외 {preview.skippedCount}건
              </p>
              <ul>
                {Object.entries(preview.skipReasonCounts).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
              {preview.samples.map((s) => (
                <pre key={s.customerId} className="sms-module__sample">
                  {s.customerName}: {s.sampleMessage}
                </pre>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'scheduled' ? (
        <section className="sms-module__panel">
          <h3>예약/초안 캠페인</h3>
          <p className="sms-module__muted">
            예약 자동 발송 worker는 후속 작업 예정입니다. 지금은 예약 캠페인 저장과 발송 전 취소만 지원합니다.
          </p>
          <ul className="sms-module__list">
            {scheduledCampaigns.length === 0 ? <li className="sms-module__muted">예약 캠페인 없음</li> : null}
            {scheduledCampaigns.map((c) => (
              <li key={c.id} className="sms-module__list-row">
                <span>
                  #{c.id} {c.title} · {c.status} · 대상 {c.targetCount} ·{' '}
                  {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : '즉시'}
                </span>
                {c.status === 'scheduled' || c.status === 'draft' ? (
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleCancelCampaign(c.id)}>
                    취소
                  </FormButton>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'templates' ? (
        <section className="sms-module__panel">
          <div className="sms-module__grid">
            <label>
              제목
              <FormInput
                value={templateForm.title}
                onChange={(e) => setTemplateForm((p) => ({ ...p, title: e.target.value }))}
              />
            </label>
          </div>
          <label>
            메시지
            <textarea
              className="sms-module__textarea"
              rows={4}
              value={templateForm.message}
              onChange={(e) => setTemplateForm((p) => ({ ...p, message: e.target.value }))}
            />
          </label>
          <FormButton type="button" disabled={busy} onClick={() => void handleSaveTemplate()}>
            템플릿 저장
          </FormButton>
          <ul className="sms-module__list">
            {templates.map((t) => (
              <li key={t.id} className="sms-module__list-row">
                <span>
                  {t.title} ({t.messageType})
                </span>
                <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteTemplate(t.id)}>
                  삭제
                </FormButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'history' ? (
        <section className="sms-module__panel">
          <ul className="sms-module__list">
            {history.length === 0 ? <li className="sms-module__muted">발송 이력 없음</li> : null}
            {history.map((h) => (
              <li key={h.id}>
                #{h.id} {h.title} · {h.status} · 성공 {h.successCount} / 실패 {h.failCount} / 제외{' '}
                {h.skippedCount} · {new Date(h.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !moduleDisabled && !authRequired && tab === 'opt-outs' ? (
        <section className="sms-module__panel">
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
        </section>
      ) : null}
    </>
  )
}
