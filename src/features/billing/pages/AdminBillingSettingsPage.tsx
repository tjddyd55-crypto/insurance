import { useCallback, useEffect, useState } from 'react'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchAdminBillingInvoices,
  fetchAdminBillingSettings,
  fetchAdminBillingSubscriptions,
  formatBillingDate,
  formatWon,
  INVOICE_STATUS_LABEL,
  mockPayAdminBillingInvoice,
  updateAdminBillingSettings,
  type BillingInvoice,
  type PaymentSettingsAdmin,
} from '../api/billingApi'

export default function AdminBillingSettingsPage() {
  const { token, user } = useAuth()
  const [settings, setSettings] = useState<PaymentSettingsAdmin | null>(null)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [mode, setMode] = useState<'virtual' | 'live'>('virtual')
  const [provider, setProvider] = useState('toss')
  const [clientKey, setClientKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setLoadError('')
    try {
      const [s, inv, subs] = await Promise.all([
        fetchAdminBillingSettings(token),
        fetchAdminBillingInvoices(token),
        fetchAdminBillingSubscriptions(token),
      ])
      setSettings(s)
      setMode(s.mode === 'live' ? 'live' : 'virtual')
      setProvider(s.provider || 'toss')
      setIsEnabled(s.isEnabled)
      setInvoices(inv.invoices)
      setSubscriptionCount(subs.subscriptions.length)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.')
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setSaveError('')
    setSaveOk('')
    try {
      const updated = await updateAdminBillingSettings(token, {
        mode,
        provider,
        isEnabled,
        clientKey: clientKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      })
      setSettings(updated)
      setClientKey('')
      setSecretKey('')
      setWebhookSecret('')
      setSaveOk('저장되었습니다.')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onMockPay = async (invoiceId: number) => {
    if (!token?.trim() || busy) return
    setBusy(true)
    setActionError('')
    try {
      await mockPayAdminBillingInvoice(token, invoiceId)
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '가상 결제 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>결제 설정</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back billing-admin-page">
      <header className="page-header">
        <h1>결제 설정</h1>
        <p>PG 연동 준비 · 가상 결제 운영</p>
      </header>

      {loadError ? <StatusMessage tone="error" message={loadError} /> : null}

      <section className="card auth-card billing-page__card">
        <h2 className="billing-page__section-title">결제 모드</h2>
        <FieldWrapper label="모드">
          <FormSelect value={mode} onChange={(e) => setMode(e.target.value === 'live' ? 'live' : 'virtual')}>
            <option value="virtual">가상 결제</option>
            <option value="live">실결제 준비중</option>
          </FormSelect>
        </FieldWrapper>
        <FieldWrapper label="PG사">
          <FormSelect value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="toss">Toss Payments</option>
            <option value="none">미설정</option>
          </FormSelect>
        </FieldWrapper>
        <label className="field">
          <span className="field__label">실결제 사용</span>
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
        </label>
      </section>

      <section className="card auth-card billing-page__card">
        <h2 className="billing-page__section-title">PG 키 (선택)</h2>
        <p className="status text-sm">
          virtual 모드에서는 키 없이 운영할 수 있습니다. 시크릿 키 저장은 서버 `PAYMENT_SETTINGS_SECRET_KEY` 설정 후 가능합니다.
        </p>
        {settings?.clientKeyMasked ? (
          <p className="status text-sm">저장된 클라이언트 키: {settings.clientKeyMasked}</p>
        ) : null}
        {settings?.hasSecretKey ? <p className="status text-sm">시크릿 키: 저장됨 (마스킹)</p> : null}
        {settings?.hasWebhookSecret ? <p className="status text-sm">웹훅 시크릿: 저장됨 (마스킹)</p> : null}
        {!settings?.canStoreSecrets ? (
          <p className="status text-sm">시크릿 키 저장: 서버 암호화 키 미설정으로 현재 저장 불가</p>
        ) : null}
        <FieldWrapper label="클라이언트 키 (새로 저장)">
          <FormInput value={clientKey} onChange={(e) => setClientKey(e.target.value)} autoComplete="off" />
        </FieldWrapper>
        <FieldWrapper label="시크릿 키 (새로 저장, 원문 재표시 없음)">
          <FormInput
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            autoComplete="new-password"
          />
        </FieldWrapper>
        <FieldWrapper label="웹훅 시크릿 (선택)">
          <FormInput
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            autoComplete="new-password"
          />
        </FieldWrapper>
        <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void onSave()}>
          {busy ? '저장 중…' : '저장'}
        </FormButton>
        {saveOk ? <StatusMessage message={saveOk} /> : null}
        {saveError ? <StatusMessage tone="error" message={saveError} /> : null}
      </section>

      <section className="card auth-card billing-page__card">
        <h2 className="billing-page__section-title">구독 현황</h2>
        <p className="status text-sm">등록된 billing 구독 {subscriptionCount}건</p>
      </section>

      <section className="card auth-card billing-page__card">
        <h2 className="billing-page__section-title">최근 결제 내역</h2>
        {actionError ? <StatusMessage tone="error" message={actionError} /> : null}
        {invoices.length === 0 ? (
          <p className="status text-sm">결제 내역이 없습니다.</p>
        ) : (
          <ul className="billing-page__invoice-list">
            {invoices.slice(0, 20).map((row) => (
              <li key={row.id} className="billing-page__invoice-item">
                <div className="billing-page__invoice-head">
                  <strong>
                    {row.userName ?? row.userId} · {formatWon(row.finalAmount)}
                  </strong>
                  <span>{INVOICE_STATUS_LABEL[row.status] ?? row.status}</span>
                </div>
                <p className="billing-page__invoice-sub">{formatBillingDate(row.createdAt)}</p>
                {settings?.mode === 'virtual' && row.status === 'pending' ? (
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onMockPay(row.id)}
                  >
                    가상 결제 완료 처리
                  </FormButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
