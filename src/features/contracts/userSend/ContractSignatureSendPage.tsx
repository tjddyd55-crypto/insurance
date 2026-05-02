/**
 * 전자서명 발송 — USER / GA_STAFF. 관리자 템플릿은 /admin/contract-signatures 에서만 관리.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
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
  getContractCustomerSearchValidationMessage,
  searchCustomersForContractSend,
  CONTRACT_SEND_CONFIRMATION_MAX_ITEMS,
  CONTRACT_SEND_CONFIRMATION_MAX_LABEL_LEN,
  type UserContractCustomerSearchHit,
  type UserContractTemplateItem,
} from './contractSignatureSendClient'

export default function ContractSignatureSendPage() {
  const { token } = useAuth()
  const t = token?.trim() ?? ''
  const customerSearchInputRef = useRef<HTMLInputElement>(null)

  const [bootError, setBootError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<UserContractTemplateItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerHits, setCustomerHits] = useState<UserContractCustomerSearchHit[]>([])
  const [customerSearchBusy, setCustomerSearchBusy] = useState(false)
  const [customerSearchExecuted, setCustomerSearchExecuted] = useState(false)
  const [customerSearchValidationError, setCustomerSearchValidationError] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<UserContractCustomerSearchHit | null>(null)

  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<CreateSendSessionResult | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SendSessionDetail | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  /** 설계사(sender) 필드 값 — 선택된 템플릿 내 fieldKey 로만 사용 */
  const [senderVals, setSenderVals] = useState<Record<string, string | boolean>>({})
  /** 고객 확인 체크 항목 초안 — PDF 필드와 무관 */
  const [confirmationDrafts, setConfirmationDrafts] = useState<{ key: string; label: string }[]>([])

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

  const executeCustomerSearch = useCallback(async () => {
    if (!t) {
      return
    }
    const validationMsg = getContractCustomerSearchValidationMessage(customerQuery)
    if (validationMsg) {
      setCustomerSearchValidationError(validationMsg)
      setCustomerHits([])
      setCustomerSearchExecuted(false)
      return
    }
    setCustomerSearchValidationError(null)
    setCustomerSearchBusy(true)
    try {
      const hits = await searchCustomersForContractSend(t, customerQuery)
      setCustomerHits(hits)
      setCustomerSearchExecuted(true)
    } catch {
      setCustomerHits([])
      setCustomerSearchExecuted(true)
    } finally {
      setCustomerSearchBusy(false)
    }
  }, [t, customerQuery])

  const clearCustomerSelection = useCallback(() => {
    setSelectedCustomer(null)
  }, [])

  const focusSearchAndClearCustomer = useCallback(() => {
    setSelectedCustomer(null)
    customerSearchInputRef.current?.focus()
  }, [])

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
    setConfirmationDrafts([])
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

  const confirmationDraftValidationMessage = (() => {
    if (confirmationDrafts.length === 0) {
      return null
    }
    if (confirmationDrafts.length > CONTRACT_SEND_CONFIRMATION_MAX_ITEMS) {
      return `확인 항목은 최대 ${CONTRACT_SEND_CONFIRMATION_MAX_ITEMS}개까지 추가할 수 있습니다.`
    }
    const nonEmpty = confirmationDrafts.filter((d) => d.label.trim() !== '')
    if (nonEmpty.length !== confirmationDrafts.length) {
      return '확인 항목 문구를 모두 입력하거나 빈 행을 삭제해 주세요.'
    }
    const lower = nonEmpty.map((d) => d.label.trim().toLowerCase())
    if (new Set(lower).size !== lower.length) {
      return '중복된 확인 문구가 있습니다.'
    }
    for (const d of nonEmpty) {
      if (d.label.trim().length > CONTRACT_SEND_CONFIRMATION_MAX_LABEL_LEN) {
        return `확인 항목 문구는 ${CONTRACT_SEND_CONFIRMATION_MAX_LABEL_LEN}자 이내입니다.`
      }
    }
    return null
  })()

  const selectedTpl = templates.find((x) => x.id === selectedTemplateId)
  const canSend =
    Boolean(selectedTemplateId) &&
    selectedTpl != null &&
    selectedCustomer != null &&
    selectedCustomer.hasPhone &&
    String(selectedTpl.status) === 'active' &&
    senderPrefillSatisfied(selectedTpl) &&
    confirmationDraftValidationMessage == null

  const onCreateSendSession = async () => {
    if (!t || !selectedTemplateId || !selectedCustomer?.hasPhone) {
      return
    }
    setSendBusy(true)
    setSendError(null)
    try {
      const senderDefs = selectedTpl?.senderFieldsForSend ?? []
      const senderInputValues =
        senderDefs.length > 0
          ? Object.fromEntries(
              senderDefs.map((d) => {
                const raw = senderVals[d.fieldKey]
                if (d.fieldType === 'checkbox') {
                  return [d.fieldKey, Boolean(raw)]
                }
                return [d.fieldKey, raw == null ? '' : String(raw)]
              }),
            )
          : undefined
      const created = await createUserContractSendSession(t, {
        customerId: selectedCustomer.id,
        templateIds: [selectedTemplateId],
        senderInputValues,
        confirmationItems:
          confirmationDrafts.length > 0
            ? confirmationDrafts.map((d) => ({ label: d.label.trim(), required: true as const }))
            : undefined,
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
    selectedCustomer == null
      ? '전자서명을 발송할 고객을 검색해 선택해 주세요.'
      : inactiveTemplateHint ||
        (!senderPrefillSatisfied(selectedTpl ?? undefined)
          ? '발송 전 입력값의 필수 항목을 모두 채워 주세요.'
          : null) ||
        confirmationDraftValidationMessage ||
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
          <p className="contract-signature-console__body-text" style={{ margin: '0 0 6px' }}>
            전자서명을 발송할 고객을 검색해 선택하세요.
          </p>
          <p className="contract-signature-console__hint" style={{ marginTop: 0 }}>
            고객 이름, 전화번호 일부 또는 고객번호를 입력해 검색하세요. (이름·기본 검색 2글자 이상, 숫자만 입력 시 4자리 이상)
            휴대폰은 마스킹만 표시됩니다.
          </p>
          <div className="contract-signature-console__search-row" style={{ marginBottom: 8, alignItems: 'stretch' }}>
            <FormInput
              ref={customerSearchInputRef}
              type="search"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value)
                setCustomerSearchValidationError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void executeCustomerSearch()
                }
              }}
              placeholder="이름 · 휴대폰 일부 · 고객번호"
              disabled={!t}
              className="max-w-md flex-1 min-w-[200px]"
            />
            <FormButton
              htmlType="button"
              variant="primary"
              size="sm"
              disabled={!t || customerSearchBusy}
              onClick={() => void executeCustomerSearch()}
            >
              {customerSearchBusy ? '검색 중…' : '검색'}
            </FormButton>
          </div>
          {customerSearchValidationError ? (
            <p className="contract-signature-console__inline-warning" role="status">
              {customerSearchValidationError}
            </p>
          ) : null}

          {selectedCustomer ? (
            <div className="contract-signature-console__selected-card" style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>선택 고객</div>
              <div className="contract-signature-console__body-text" style={{ fontSize: '0.9375rem' }}>
                {selectedCustomer.name}
              </div>
              <div className="contract-signature-console__hint" style={{ marginTop: 6 }}>
                고객 ID: {selectedCustomer.id}
                {selectedCustomer.customerCode?.trim() ? ` · 고객번호: ${selectedCustomer.customerCode}` : ''}
              </div>
              <div className="contract-signature-console__hint">휴대폰: {selectedCustomer.hasPhone ? selectedCustomer.maskedPhone : '—'}</div>
              {!selectedCustomer.hasPhone ? (
                <div className="contract-signature-console__hint--warning" style={{ marginTop: 4 }}>
                  유효한 휴대폰 번호가 없어 발송할 수 없습니다.
                </div>
              ) : null}
              <div className="contract-signature-console__btn-row">
                <FormButton htmlType="button" variant="secondary" size="sm" disabled={!t} onClick={clearCustomerSelection}>
                  선택 해제
                </FormButton>
                <FormButton htmlType="button" variant="secondary" size="sm" disabled={!t} onClick={focusSearchAndClearCustomer}>
                  다른 고객 검색
                </FormButton>
              </div>
            </div>
          ) : null}

          {customerSearchExecuted ? (
            <div className="contract-signature-console__scroll-x">
              <table className="pdf-engine-table contract-signature-console__table--compact contract-signature-console__table--striped">
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>이름</th>
                    <th>고객번호 · ID</th>
                    <th>휴대폰(마스킹)</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="contract-signature-console__empty-state-text" style={{ padding: '0.75rem' }}>
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    customerHits.map((c) => (
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
                            <>
                              {c.customerCode}
                              <span className="contract-signature-console__hint"> (ID {c.id})</span>
                            </>
                          ) : (
                            <span>고객 ID: {c.id}</span>
                          )}
                        </td>
                        <td>
                          {c.hasPhone ? c.maskedPhone : '—'}
                          {!c.hasPhone ? (
                            <div className="contract-signature-console__hint--warning">번호 없음</div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="contract-signature-console__hint" style={{ marginTop: 8 }}>
              검색어를 입력한 뒤 「검색」을 누르면 본인에게 등록된 고객만 결과로 표시됩니다.
            </p>
          )}
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">2. 전자서명 템플릿 (active)</h2>
          {selectedCustomer == null ? (
            <p className="contract-signature-console__hint">고객을 선택하면 템플릿을 고를 수 있습니다.</p>
          ) : null}
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
                          disabled={!t || selectedCustomer == null}
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

        {selectedCustomer && selectedTemplateId && (selectedTpl?.senderFieldsForSend ?? []).length > 0 ? (
          <section className="contract-signature-console__section">
            <h2 className="contract-signature-console__section-title">2-1. 발송 전 입력값</h2>
            <p className="contract-signature-console__hint">
              고객에게 보내기 전에 계약서에 들어갈 값을 입력해주세요. 이 값은 고객이 수정할 수 없습니다.
            </p>
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
          </section>
        ) : null}

        {selectedCustomer && selectedTemplateId ? (
          <section className="contract-signature-console__section">
            <h2 className="contract-signature-console__section-title">2-2. 고객 확인 체크 항목</h2>
            <p className="contract-signature-console__body-text" style={{ margin: '0 0 8px' }}>
              고객이 전자서명 전에 확인해야 할 내용을 체크 항목으로 추가할 수 있습니다.
            </p>
            <div className="space-y-3 mt-2">
              {confirmationDrafts.map((row) => (
                <div key={row.key} className="flex flex-wrap items-start gap-2">
                  <FormInput
                    type="text"
                    className="flex-1 min-w-[200px] max-w-xl"
                    value={row.label}
                    placeholder="예: 본인임을 확인했습니다."
                    disabled={!t}
                    onChange={(e) => {
                      const v = e.target.value
                      setConfirmationDrafts((prev) =>
                        prev.map((x) => (x.key === row.key ? { ...x, label: v } : x)),
                      )
                    }}
                  />
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    size="sm"
                    disabled={!t}
                    onClick={() =>
                      setConfirmationDrafts((prev) => prev.filter((x) => x.key !== row.key))
                    }
                  >
                    삭제
                  </FormButton>
                </div>
              ))}
            </div>
            <div className="contract-signature-console__btn-row" style={{ marginTop: 12 }}>
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                disabled={
                  !t ||
                  !selectedTemplateId ||
                  confirmationDrafts.length >= CONTRACT_SEND_CONFIRMATION_MAX_ITEMS
                }
                onClick={() =>
                  setConfirmationDrafts((prev) => [
                    ...prev,
                    { key: `ccdraft_${crypto.randomUUID()}`, label: '' },
                  ])
                }
              >
                + 체크 항목 추가
              </FormButton>
            </div>
            {confirmationDraftValidationMessage ? (
              <p className="contract-signature-console__inline-warning" role="status" style={{ marginTop: 8 }}>
                {confirmationDraftValidationMessage}
              </p>
            ) : (
              <p className="contract-signature-console__hint" style={{ marginTop: 8 }}>
                선택 사항입니다. 추가 시 고객이 모두 체크해야 다음 단계로 진행할 수 있습니다.
              </p>
            )}
          </section>
        ) : null}

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
