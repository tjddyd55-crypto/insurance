/**
 * 전자서명 관리 — SUPER_ADMIN / GA_ADMIN 전용. 공개 계약 링크 플로우와 분리.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../pdf-engine/pdf-engine.css'
import './contract-signature-console.css'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import type { CustomerRecord } from '../../customers/domain/types'
import { ContractTemplatePanel } from './components/ContractTemplatePanel'
import { CustomerSelector } from './components/CustomerSelector'
import { EvidenceStatusPanel } from './components/EvidenceStatusPanel'
import type { PdfPickRow } from './components/PdfTemplateSelector'
import { PdfTemplateSelector } from './components/PdfTemplateSelector'
import { SendSessionPanel } from './components/SendSessionPanel'
import {
  activateContractTemplate,
  countPdfFieldStats,
  createContractSendSession,
  createContractTemplateFromPdfTemplate,
  getContractSendSessionDetail,
  getPdfTemplateDetailForContractTest,
  listContractTemplates,
  listPdfTemplatesForContractTest,
  searchCustomersForContractTest,
  type ContractTemplateListItem,
  type CreateSendSessionResult,
  type SendSessionDetail,
} from './contractSignatureTestConsoleClient'

function resolveTenantGaId(role: string | undefined, gaId: number): number | null {
  if (role === 'SUPER_ADMIN') {
    return null
  }
  return gaId
}

function customerPhoneOk(c: CustomerRecord): boolean {
  const p = String(c.phone ?? c.phoneNumber ?? '').replace(/\D/g, '')
  return p.length >= 10
}

export default function ContractSignatureTestConsolePage() {
  const { token, user } = useAuth()
  const t = token?.trim() ?? ''
  const role = user?.role
  const tenantGaId = useMemo(() => resolveTenantGaId(role, user?.gaId ?? 0), [role, user?.gaId])

  const [bootError, setBootError] = useState<string | null>(null)
  const [pdfRows, setPdfRows] = useState<PdfPickRow[]>([])
  const [selectedPdfId, setSelectedPdfId] = useState<number | null>(null)
  const [contractTemplates, setContractTemplates] = useState<ContractTemplateListItem[]>([])
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [contractPanelError, setContractPanelError] = useState<string | null>(null)
  const [contractBusy, setContractBusy] = useState(false)

  const [customer, setCustomer] = useState<CustomerRecord | null>(null)

  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<CreateSendSessionResult | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SendSessionDetail | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const selectedPdf = useMemo(
    () => (selectedPdfId == null ? null : pdfRows.find((r) => r.id === selectedPdfId) ?? null),
    [pdfRows, selectedPdfId],
  )

  const reloadContracts = useCallback(async () => {
    if (!t) {
      return
    }
    setContractPanelError(null)
    try {
      const list = await listContractTemplates(t, role, tenantGaId)
      setContractTemplates(list)
    } catch (e) {
      setContractPanelError(e instanceof ApiError ? e.message : '계약 템플릿 목록을 불러오지 못했습니다.')
    }
  }, [t, role, tenantGaId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!t) {
        return
      }
      setBootError(null)
      try {
        const { templates } = await listPdfTemplatesForContractTest(t, role)
        if (cancelled) {
          return
        }
        const initial: PdfPickRow[] = templates.map((s) => ({
          ...s,
          fieldCount: 0,
          signatureCount: 0,
          loadingDetail: true,
        }))
        setPdfRows(initial)
        const enriched = await Promise.all(
          templates.map(async (s) => {
            try {
              const detail = await getPdfTemplateDetailForContractTest(t, role, s.id)
              const { fieldCount, signatureCount } = countPdfFieldStats(detail)
              return { ...s, fieldCount, signatureCount, loadingDetail: false } satisfies PdfPickRow
            } catch {
              return { ...s, fieldCount: 0, signatureCount: 0, loadingDetail: false } satisfies PdfPickRow
            }
          }),
        )
        if (!cancelled) {
          setPdfRows(enriched)
        }
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof ApiError ? e.message : 'PDF 템플릿 목록을 불러오지 못했습니다.')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [t, role])

  useEffect(() => {
    void reloadContracts()
  }, [reloadContracts])

  useEffect(() => {
    if (selectedPdfId == null) {
      setSelectedContractId(null)
    }
  }, [selectedPdfId])

  const onSelectPdf = (id: number) => {
    setSelectedPdfId(id)
    setSelectedContractId(null)
  }

  const onCreateTestTemplate = async () => {
    if (!t || selectedPdfId == null || !selectedPdf) {
      return
    }
    setContractBusy(true)
    setContractPanelError(null)
    try {
      const pdfTitle = selectedPdf.title ?? ''
      await createContractTemplateFromPdfTemplate(t, role, {
        pdfTemplateId: selectedPdfId,
        pdfTitle,
        tenantGaId,
      })
      await reloadContracts()
    } catch (e) {
      setContractPanelError(e instanceof ApiError ? e.message : '계약 템플릿 생성에 실패했습니다.')
    } finally {
      setContractBusy(false)
    }
  }

  const onActivateTemplate = async (id: string) => {
    if (!t) {
      return
    }
    setContractBusy(true)
    setContractPanelError(null)
    try {
      await activateContractTemplate(t, role, id, tenantGaId)
      await reloadContracts()
    } catch (e) {
      setContractPanelError(e instanceof ApiError ? e.message : '상태 변경에 실패했습니다.')
    } finally {
      setContractBusy(false)
    }
  }

  const onSearchCustomers = useCallback(
    async (q: string) => searchCustomersForContractTest(t, q),
    [t],
  )

  const refreshSessionDetail = useCallback(async () => {
    const sid = sessionDetail?.id ?? lastCreated?.id
    if (!t || !sid) {
      return
    }
    setEvidenceLoading(true)
    try {
      const next = await getContractSendSessionDetail(t, role, sid, tenantGaId)
      setSessionDetail(next)
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : '세션 상태를 불러오지 못했습니다.')
    } finally {
      setEvidenceLoading(false)
    }
  }, [t, role, tenantGaId, sessionDetail?.id, lastCreated?.id])

  const onCreateSendSession = async () => {
    if (!t || !selectedContractId || !customer || !customerPhoneOk(customer)) {
      return
    }
    const sel = contractTemplates.find((x) => x.id === selectedContractId)
    if (!sel || sel.status !== 'active') {
      setSendError('active 상태인 계약 템플릿을 선택하세요.')
      return
    }
    setSendBusy(true)
    setSendError(null)
    try {
      const created = await createContractSendSession(t, role, {
        customerId: customer.id,
        templateIds: [selectedContractId],
        tenantGaId,
      })
      setLastCreated(created)
      const next = await getContractSendSessionDetail(t, role, created.id, tenantGaId)
      setSessionDetail(next)
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : '발송 세션 생성에 실패했습니다.')
    } finally {
      setSendBusy(false)
    }
  }

  const selectedContract = contractTemplates.find((x) => x.id === selectedContractId)
  const canSend =
    Boolean(selectedContractId) &&
    selectedContract?.status === 'active' &&
    customer != null &&
    customerPhoneOk(customer)

  return (
    <main className="insurance-dark-forms contract-signature-console">
      <div className="contract-signature-console__container">
        <h1 className="contract-signature-console__title">전자서명 관리</h1>
        <p className="contract-signature-console__lead">
          PDF 좌표 템플릿을 기반으로 고객에게 전자서명 링크를 발송하고, 지정 휴대폰 인증·손사인·증빙 상태를
          확인합니다.
        </p>
        <div className="contract-signature-console__notice" role="status">
          <ul>
            <li>
              현재 기능은 지정 휴대폰 인증 기반 전자서명입니다. NICE/KCB 실명 본인확인은 아직 연결되어 있지
              않습니다.
            </li>
            <li>최종 PDF 합성은 추후 지원 예정입니다.</li>
          </ul>
        </div>

        {bootError ? (
          <div className="contract-signature-console__alert--danger" role="alert">
            {bootError}
          </div>
        ) : null}

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">1. PDF 템플릿 선택</h2>
          <PdfTemplateSelector
            rows={pdfRows}
            selectedId={selectedPdfId}
            onSelect={onSelectPdf}
            disabled={!t || contractBusy}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">2. 계약서 템플릿 연결</h2>
          <ContractTemplatePanel
            pdfTemplateId={selectedPdfId}
            pdfTitle={selectedPdf?.title ?? null}
            templates={contractTemplates}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
            busy={contractBusy}
            onCreateTest={onCreateTestTemplate}
            onActivate={onActivateTemplate}
            error={contractPanelError}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">3. 고객 선택</h2>
          <CustomerSelector
            token={t}
            disabled={!t}
            onSearch={onSearchCustomers}
            selected={customer}
            onSelect={setCustomer}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">4. 발송 세션</h2>
          <SendSessionPanel
            busy={sendBusy}
            lastCreated={lastCreated}
            onCreate={onCreateSendSession}
            canSend={canSend}
            detail={sessionDetail}
            onRefresh={() => void refreshSessionDetail()}
            error={sendError}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">5. 상태 · evidence</h2>
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
