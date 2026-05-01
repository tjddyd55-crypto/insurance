/**
 * 전자서명 템플릿 관리 — SUPER_ADMIN / GA_ADMIN. 실제 고객 발송은 전자서명 발송 메뉴에서 진행.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../pdf-engine/pdf-engine.css'
import './contract-signature-console.css'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { ContractTemplatePanel } from './components/ContractTemplatePanel'
import type { PdfPickRow } from './components/PdfTemplateSelector'
import { PdfTemplateSelector } from './components/PdfTemplateSelector'
import {
  activateContractTemplate,
  countPdfFieldStats,
  createContractTemplateFromPdfTemplate,
  getPdfTemplateDetailForContractTest,
  listContractTemplates,
  listPdfTemplatesForContractTest,
  type ContractTemplateListItem,
} from './contractSignatureTestConsoleClient'

function resolveTenantGaId(role: string | undefined, gaId: number): number | null {
  if (role === 'SUPER_ADMIN') {
    return null
  }
  return gaId
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

  const resolveCoordinateEditorHref =
    role === 'SUPER_ADMIN' ? (pdfTemplateId: number) => `/admin/pdf-templates/${pdfTemplateId}` : undefined

  return (
    <main className="insurance-dark-forms contract-signature-console">
      <div className="contract-signature-console__container">
        <h1 className="contract-signature-console__title">전자서명 템플릿 관리</h1>
        <p className="contract-signature-console__lead">
          관리자는 PDF 좌표 템플릿을 전자서명 발송용 계약서 템플릿으로 등록하고 관리합니다. 실제 고객 발송은
          유저/FC 화면의 「전자서명 발송」 메뉴에서 진행합니다.
        </p>
        <div className="contract-signature-console__notice" role="status">
          <ul>
            <li>
              현재 기능은 지정 휴대폰 인증 기반 전자서명입니다. NICE/KCB 실명 본인확인은 아직 연결되어 있지
              않습니다.
            </li>
            <li>최종 PDF 합성은 추후 지원 예정입니다.</li>
            <li>관리자용 임시 발송·세션 조회 API(`/api/admin/contracts/send-sessions`)는 호환용으로 유지될 수 있습니다.</li>
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
            resolveCoordinateEditorHref={resolveCoordinateEditorHref}
          />
        </section>

        <section className="contract-signature-console__section">
          <h2 className="contract-signature-console__section-title">2. 계약서 템플릿 연결 · 상태</h2>
          <ContractTemplatePanel
            pdfTemplateId={selectedPdfId}
            pdfTitle={selectedPdf?.title ?? null}
            pdfSignatureFieldCount={selectedPdf?.signatureCount ?? 0}
            templates={contractTemplates}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
            busy={contractBusy}
            onCreateTest={onCreateTestTemplate}
            onActivate={onActivateTemplate}
            error={contractPanelError}
          />
        </section>
      </div>
    </main>
  )
}
