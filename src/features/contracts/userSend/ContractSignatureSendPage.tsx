/**
 * 전자서명 발송 — USER / GA_STAFF. 관리자 템플릿은 /admin/contract-signatures 에서만 관리.
 */
import { useCallback, useEffect, useState } from 'react'
import { FormInput, FormSelect, FormTextarea } from '../../../components/form'
import '../../pdf-engine/pdf-engine.css'
import '../testConsole/contract-signature-console.css'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { EvidenceStatusPanel } from '../testConsole/components/EvidenceStatusPanel'
import { SendSessionPanel } from '../testConsole/components/SendSessionPanel'
import type {
  CreateSendSessionResult,
  SendSessionDetail,
} from '../testConsole/contractSignatureTestConsoleClient'
import {
  createUserContractSendSession,
  getUserContractSendSessionDetail,
  listUserContractTemplates,
  searchCustomersForContractSend,
  type UserContractCustomerSearchHit,
  type UserContractTemplateItem,
} from './contractSignatureSendClient'

export default function ContractSignatureSendPage() {
  const { token } = useAuth()
  const t = token?.trim() ?? ''

  const [bootError, setBootError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<UserContractTemplateItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerHits, setCustomerHits] = useState<UserContractCustomerSearchHit[]>([])
  const [customerSearchBusy, setCustomerSearchBusy] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<UserContractCustomerSearchHit | null>(null)

  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<CreateSendSessionResult | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SendSessionDetail | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  /** 설계사(sender) 필드 값 — 선택된 템플릿 내 fieldKey 로만 사용 */
  const [senderVals, setSenderVals] = useState<Record<string, string | boolean>>({})

  const reloadTemplates = useCallback(async () => {
    if (!t) {
      return
    }
    setBootError(null)
    try {
      const list = await listUserContractTemplates(t)
      setTemplates(list)
    } catch (e) {
      setBootError(e instanceof ApiError ? e.message : '템플릿 목록을 불러오지 못했습니다.')
    }
  }, [t])

  useEffect(() => {
    void reloadTemplates()
  }, [reloadTemplates])

  const runCustomerSearch = useCallback(async () => {
    if (!t) {
      return
    }
    setCustomerSearchBusy(true)
    try {
      const hits = await searchCustomersForContractSend(t, customerQuery)
      setCustomerHits(hits)
    } catch {
      setCustomerHits([])
    } finally {
      setCustomerSearchBusy(false)
    }
  }, [t, customerQuery])

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (t) {
        void runCustomerSearch()
      }
    }, 280)
    return () => window.clearTimeout(id)
  }, [t, customerQuery, runCustomerSearch])

  const refreshSessionDetail = useCallback(async () => {
    const sid = sessionDetail?.id ?? lastCreated?.id
    if (!t || !sid) {
      return
    }
    setEvidenceLoading(true)
    try {
      const next = await getUserContractSendSessionDetail(t, sid)
      setSessionDetail(next)
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : '세션 상태를 불러오지 못했습니다.')
    } finally {
      setEvidenceLoading(false)
    }
  }, [t, sessionDetail?.id, lastCreated?.id])

  useEffect(() => {
    setSenderVals({})
  }, [selectedTemplateId])

  const senderPrefillSatisfied = (tpl: UserContractTemplateItem | null | undefined): boolean => {
    const defs = tpl?.senderFieldsForSend
    if (!defs || defs.length === 0) {
      return true
    }
    for (const d of defs) {
      if (!d.required) {
        continue
      }
      const v = senderVals[d.fieldKey]
      if (d.fieldType === 'checkbox') {
        if (!v) {
          return false
        }
        continue
      }
      if (String(v ?? '').trim() === '') {
        return false
      }
    }
    return true
  }

  const selectedTpl = templates.find((x) => x.id === selectedTemplateId)
  const canSend =
    Boolean(selectedTemplateId) &&
    selectedTpl != null &&
    selectedCustomer != null &&
    selectedCustomer.hasPhone &&
    String(selectedTpl.status) === 'active' &&
    senderPrefillSatisfied(selectedTpl)

  const onCreateSendSession = async () => {
    if (!t || !selectedTemplateId || !selectedCustomer?.hasPhone) {
      return
    }
    setSendBusy(true)
    setSendError(null)
    try {
      const senderDefs = selectedTpl?.senderFieldsForSend ?? []
      const senderFieldValues =
        selectedTpl && senderDefs.length > 0
          ? {
              [selectedTpl.id]: Object.fromEntries(
                senderDefs.map((d) => {
                  const raw = senderVals[d.fieldKey]
                  if (d.fieldType === 'checkbox') {
                    return [d.fieldKey, Boolean(raw)]
                  }
                  return [d.fieldKey, raw == null ? '' : String(raw)]
                }),
              ),
            }
          : undefined
      const created = await createUserContractSendSession(t, {
        customerId: selectedCustomer.id,
        templateIds: [selectedTemplateId],
        senderFieldValues,
      })
      setLastCreated(created)
      const next = await getUserContractSendSessionDetail(t, created.id)
      setSessionDetail(next)
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : '발송 세션 생성에 실패했습니다.')
    } finally {
      setSendBusy(false)
    }
  }

  const inactiveTemplateHint =
    selectedTpl != null && String(selectedTpl.status) !== 'active'
      ? 'active 템플릿만 발송할 수 있습니다.'
      : null

  const sendSessionPanelHint =
    inactiveTemplateHint ||
    (!senderPrefillSatisfied(selectedTpl ?? undefined) ? '발송 전 입력(설계사) 필수 항목을 모두 채워 주세요.' : null) ||
    (selectedCustomer != null && !selectedCustomer.hasPhone
      ? '선택한 고객에 유효한 휴대폰번호가 없습니다.'
      : null)

  return (
    <main className="insurance-dark-forms contract-signature-console">
      <div className="contract-signature-console__container">
        <h1 className="contract-signature-console__title">전자서명 발송</h1>
        <p className="contract-signature-console__lead">
          본인에게 등록된 고객을 선택하고, 관리자가 활성화한 전자서명 템플릿으로 링크를 발송합니다. 휴대폰
          번호는 고객 정보에서만 읽으며 임의 입력·전송은 할 수 없습니다.
        </p>

        {bootError ? (
          <div className="contract-signature-console__alert--danger" role="alert">
            {bootError}
          </div>
        ) : null}

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">1. 내 고객 검색</h2>
          <p className="contract-signature-console__hint">
            이름·전화번호 일부·고객번호로 검색합니다. 전화번호는 마스킹만 표시됩니다.
          </p>
          <FormInput
            type="search"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="검색어"
            disabled={!t}
            style={{ maxWidth: 360, marginBottom: 8 }}
          />
          {customerSearchBusy ? <p className="contract-signature-console__hint">검색 중…</p> : null}
          <div className="contract-signature-console__scroll-x">
            <table className="pdf-engine-table contract-signature-console__table--compact contract-signature-console__table--striped">
              <thead>
                <tr>
                  <th>선택</th>
                  <th>이름</th>
                  <th>고객번호</th>
                  <th>휴대폰(마스킹)</th>
                </tr>
              </thead>
              <tbody>
                {customerHits.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <FormInput
                        type="radio"
                        name="cust-pick"
                        checked={selectedCustomer?.id === c.id}
                        value={String(c.id)}
                        disabled={!t}
                        onChange={() => setSelectedCustomer(c)}
                      />
                    </td>
                    <td>{c.name}</td>
                    <td>
                      {c.customerCode?.trim() ? (
                        c.customerCode
                      ) : (
                        <span className="contract-signature-console__hint">고객 ID: {c.id}</span>
                      )}
                    </td>
                    <td>
                      {c.hasPhone ? c.maskedPhone : '—'}
                      {!c.hasPhone ? (
                        <div className="contract-signature-console__hint--warning">번호 없음</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">2. 전자서명 템플릿 (active)</h2>
          <div className="contract-signature-console__scroll-x">
            <table className="pdf-engine-table contract-signature-console__table--compact contract-signature-console__table--striped">
              <thead>
                <tr>
                  <th>선택</th>
                  <th>템플릿명</th>
                  <th>PDF명</th>
                  <th>필드 수</th>
                  <th>서명 필드</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((row) => {
                  const noSig = row.signatureFieldCount < 1
                  return (
                    <tr key={row.id}>
                      <td>
                        <FormInput
                          type="radio"
                          name="tpl-pick"
                          checked={selectedTemplateId === row.id}
                          value={row.id}
                          disabled={!t}
                          onChange={() => setSelectedTemplateId(row.id)}
                        />
                      </td>
                      <td>
                        {row.title}
                        {noSig ? (
                          <div className="contract-signature-console__hint--warning">
                            signature 필드 없음 — 손사인 단계가 제한될 수 있습니다.
                          </div>
                        ) : null}
                      </td>
                      <td>{row.pdfEngineTitle ?? '—'}</td>
                      <td>{row.pdfFieldCount}</td>
                      <td>{row.signatureFieldCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">2-1. 발송 전 입력 (설계사)</h2>
          <p className="contract-signature-console__hint">
            템플릿에 따라 설계사가 보내기 전에 채워야 하는 항목이 있습니다. 해당 값은 고객에게는 읽기 전용으로
            노출됩니다.
          </p>
          {!selectedTemplateId ? (
            <p className="contract-signature-console__hint">먼저 2단계에서 템플릿을 선택해 주세요.</p>
          ) : (selectedTpl?.senderFieldsForSend ?? []).length === 0 ? (
            <p className="contract-signature-console__hint">이 템플릿에는 발송 전 입력 항목이 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {(selectedTpl?.senderFieldsForSend ?? []).map((d) => {
                const fk = d.fieldKey
                if (d.fieldType === 'checkbox') {
                  return (
                    <label key={fk} className="contract-public-sign-page__label-row flex items-start gap-2">
                      <FormInput
                        type="checkbox"
                        checked={Boolean(senderVals[fk])}
                        onChange={(ev) =>
                          setSenderVals((prev) => ({ ...prev, [fk]: ev.target.checked }))
                        }
                      />
                      <span>
                        {d.label || fk}
                        {d.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                      </span>
                    </label>
                  )
                }
                if (d.fieldType === 'radio') {
                  const rawOpts = Array.isArray(d.options) ? d.options : []
                  const opts = rawOpts.map((x) => String(x))
                  const cur = String(senderVals[fk] ?? '')
                  return (
                    <div key={fk} className="space-y-1">
                      <p className="contract-signature-console__hint" style={{ marginBottom: 4 }}>
                        {d.label || fk}
                        {d.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                      </p>
                      <FormSelect
                        value={cur}
                        options={[{ value: '', label: '선택' }, ...opts.map((o) => ({ value: o, label: o }))]}
                        onChange={(ev) =>
                          setSenderVals((prev) => ({ ...prev, [fk]: ev.target.value }))
                        }
                      />
                    </div>
                  )
                }
                const tv = String(senderVals[fk] ?? '')
                const multiline = d.fieldType === 'textarea'
                return (
                  <label key={fk} className="block space-y-1">
                    <span className="contract-signature-console__hint">
                      {d.label || fk}
                      {d.required ? <span className="contract-signature-console__hint--warning"> *</span> : null}
                    </span>
                    {multiline ? (
                      <FormTextarea
                        className="pdf-engine-form__textarea w-full max-w-xl text-sm"
                        rows={4}
                        value={tv}
                        onChange={(e) => setSenderVals((prev) => ({ ...prev, [fk]: e.target.value }))}
                      />
                    ) : (
                      <FormInput
                        type="text"
                        className="max-w-xl"
                        value={tv}
                        onChange={(e) => setSenderVals((prev) => ({ ...prev, [fk]: e.target.value }))}
                      />
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">3. 발송 세션</h2>
          <SendSessionPanel
            busy={sendBusy}
            lastCreated={lastCreated}
            onCreate={() => void onCreateSendSession()}
            canSend={canSend}
            inactiveTemplateHint={sendSessionPanelHint}
            detail={sessionDetail}
            onRefresh={() => void refreshSessionDetail()}
            error={sendError}
            staffAuthToken={t}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">4. 상태 · evidence</h2>
          <EvidenceStatusPanel
            detail={sessionDetail}
            loading={evidenceLoading}
            onRefresh={() => void refreshSessionDetail()}
          />
        </section>
      </div>
    </main>
  )
}
