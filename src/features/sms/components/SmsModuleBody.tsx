import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsModuleTab } from '../../types/sms.types'

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

function ProviderNotice({ settings }: { settings: SmsModuleViewProps['settings'] }) {
  if (!settings) {
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
      <p>문자 발송은 알리고 계정을 연동하여 사용합니다.</p>
      <p>알리고 API 발송 서버 IP에 아래 IP를 등록해 주세요.</p>
      {outboundIpHint ? (
        <p className="sms-module__ip-hint">{outboundIpHint}</p>
      ) : (
        <p className="sms-module__muted">발송 서버 IP는 SMS_MODULE_OUTBOUND_IP_HINT 환경변수로 안내됩니다.</p>
      )}
      <p>문자 충전과 발신번호 등록은 알리고 사이트에서 직접 진행해 주세요.</p>
      <p>
        CRM 문자 발송은 유저 본인의 알리고 계정으로 처리되며, 문자비는 해당 알리고 계정에서 차감됩니다.
      </p>
    </div>
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
    notice,
    settings,
    senders,
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
    handleRegisterSender,
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
        <p className="sms-module__subtitle">알리고 계정 연동 · 충전/발신번호 등록은 알리고 사이트에서 진행</p>
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

      <NoticeBox error={error} notice={notice} />
      <ProviderNotice settings={settings} />

      {loading ? <p className="sms-module__muted">불러오는 중…</p> : null}

      {tab === 'settings' ? (
        <section className="sms-module__panel">
          <GuideBox outboundIpHint={settings?.outboundServerIpHint} />
          <div className="sms-module__grid">
            <label>
              알리고 아이디
              <FormInput
                value={settingsForm.aligoUserId}
                onChange={(e) => setSettingsForm((p) => ({ ...p, aligoUserId: e.target.value }))}
              />
            </label>
            <label>
              API Key {settings?.apiKeyMasked ? `(저장됨: ${settings.apiKeyMasked})` : ''}
              <FormInput
                type="password"
                autoComplete="new-password"
                placeholder="변경 시에만 입력"
                value={settingsForm.apiKey}
                onChange={(e) => setSettingsForm((p) => ({ ...p, apiKey: e.target.value }))}
              />
            </label>
            <label>
              기본 발신번호 (알리고 등록 번호)
              <FormInput
                value={settingsForm.defaultSender}
                onChange={(e) => setSettingsForm((p) => ({ ...p, defaultSender: e.target.value }))}
              />
            </label>
          </div>
          <div className="sms-module__actions">
            <FormButton type="button" disabled={busy} onClick={() => void handleSaveSettings()}>
              저장
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleRegisterSender()}>
              발신번호 CRM 등록
            </FormButton>
            {settings?.configured ? (
              <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteSettings()}>
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
              href={settings?.aligoChargeUrl ?? 'https://smartsms.aligo.in/shop/charge.html'}
              target="_blank"
              rel="noreferrer"
            >
              알리고에서 충전하기
            </a>
            <a
              className="sms-module__link-btn"
              href={settings?.aligoSenderRegisterUrl ?? 'https://smartsms.aligo.in/admin/sender/list.html'}
              target="_blank"
              rel="noreferrer"
            >
              알리고 발신번호 등록
            </a>
          </div>
          {balanceText ? <p className="sms-module__balance">{balanceText}</p> : null}
          {settings?.outboundServerIpHint ? (
            <div className="sms-module__ip-panel">
              <p className="sms-module__muted">알리고 API 발송 서버 IP에 아래 IP를 등록해 주세요.</p>
              <p className="sms-module__ip-hint">{settings.outboundServerIpHint}</p>
              <p className="sms-module__muted">
                CRM 문자 발송은 유저 본인의 알리고 계정으로 처리되며, 문자비는 해당 알리고 계정에서 차감됩니다.
              </p>
            </div>
          ) : null}

          <h3>등록된 발신번호</h3>
          <ul className="sms-module__list">
            {senders.length === 0 ? <li className="sms-module__muted">등록된 발신번호가 없습니다.</li> : null}
            {senders.map((s) => (
              <li key={s.id}>
                {s.senderNumber} · {s.label} ·{' '}
                <span className={`sms-module__badge sms-module__badge--${s.status}`}>{s.status}</span>
                {s.isDefault ? ' · 기본' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'send' ? (
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

      {tab === 'bulk' || tab === 'scheduled' ? (
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

      {tab === 'scheduled' ? (
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

      {tab === 'templates' ? (
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

      {tab === 'history' ? (
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

      {tab === 'opt-outs' ? (
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
