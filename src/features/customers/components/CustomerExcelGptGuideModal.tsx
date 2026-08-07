import { useEffect, useId, useRef, useState } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { FormButton } from '../../../components/form'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  CUSTOMER_EXCEL_GPT_COPY_FAILURE,
  CUSTOMER_EXCEL_GPT_COPY_SUCCESS,
  CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS,
  CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS_TITLE,
  CUSTOMER_EXCEL_GPT_GUIDE_DESCRIPTION,
  CUSTOMER_EXCEL_GPT_GUIDE_PROMPT,
  CUSTOMER_EXCEL_GPT_GUIDE_STEPS,
  CUSTOMER_EXCEL_GPT_GUIDE_TITLE,
} from '../config/customerExcelGptGuideContent'
import './customer-excel-gpt-guide.css'

export type CustomerExcelGptGuideModalProps = {
  open: boolean
  onClose: () => void
  /** 모달 닫힌 뒤 focus 복귀용 */
  triggerRef?: React.RefObject<HTMLElement | null>
  /** 테스트 SSR 등에서 portal 비활성화 */
  usePortal?: boolean
}

export function CustomerExcelGptGuideModal({
  open,
  onClose,
  triggerRef,
  usePortal = true,
}: CustomerExcelGptGuideModalProps) {
  const titleId = useId()
  const descId = useId()
  const closeBtnId = useId()
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [copyNotice, setCopyNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setCopyNotice(null)
      setCopyBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    // FormButton 은 forwardRef 미지원 → id 로 실제 button 노드를 잡아 focus
    const button = document.getElementById(closeBtnId)
    closeBtnRef.current = button instanceof HTMLButtonElement ? button : null
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(t)
  }, [closeBtnId, open])

  async function handleCopy() {
    setCopyBusy(true)
    const ok = await copyTextToClipboard(CUSTOMER_EXCEL_GPT_GUIDE_PROMPT)
    setCopyBusy(false)
    setCopyNotice({
      tone: ok ? 'ok' : 'err',
      text: ok ? CUSTOMER_EXCEL_GPT_COPY_SUCCESS : CUSTOMER_EXCEL_GPT_COPY_FAILURE,
    })
  }

  function handleClose() {
    onClose()
    window.setTimeout(() => {
      const trigger = triggerRef?.current
      if (!trigger) return
      const focusable =
        trigger instanceof HTMLButtonElement
          ? trigger
          : trigger.querySelector<HTMLButtonElement>('button')
      focusable?.focus({ preventScroll: true })
    }, 0)
  }

  return (
    <BaseDialog
      open={open}
      onClose={handleClose}
      ariaLabel={CUSTOMER_EXCEL_GPT_GUIDE_TITLE}
      panelPreset="largeForm"
      closeOnBackdrop={false}
      closeOnEsc={false}
      onEscapeRequest={handleClose}
      usePortal={usePortal}
      initialFocusRef={closeBtnRef}
      panelClassName="customer-excel-gpt-guide-dialog"
    >
      <div className="customer-excel-gpt-guide" role="document" aria-labelledby={titleId} aria-describedby={descId}>
        <header className="customer-excel-gpt-guide__header">
          <div className="customer-excel-gpt-guide__header-text">
            <h2 id={titleId} className="customer-excel-gpt-guide__title">
              {CUSTOMER_EXCEL_GPT_GUIDE_TITLE}
            </h2>
            <p id={descId} className="customer-excel-gpt-guide__desc">
              {CUSTOMER_EXCEL_GPT_GUIDE_DESCRIPTION}
            </p>
          </div>
          <FormButton
            id={closeBtnId}
            htmlType="button"
            variant="secondary"
            className="customer-excel-gpt-guide__icon-close"
            aria-label="닫기"
            onClick={handleClose}
          >
            닫기
          </FormButton>
        </header>

        <div className="customer-excel-gpt-guide__body">
          <ol className="customer-excel-gpt-guide__steps">
            {CUSTOMER_EXCEL_GPT_GUIDE_STEPS.map((step, index) => (
              <li key={step} className="customer-excel-gpt-guide__step">
                <span className="customer-excel-gpt-guide__step-index" aria-hidden>
                  {index + 1}
                </span>
                <span className="customer-excel-gpt-guide__step-label">{step}</span>
              </li>
            ))}
          </ol>

          <section className="customer-excel-gpt-guide__prompt-block" aria-label="GPT 지시문">
            <div className="customer-excel-gpt-guide__prompt-toolbar">
              <h3 className="customer-excel-gpt-guide__prompt-title">GPT 지시문</h3>
              <FormButton
                htmlType="button"
                variant="secondary"
                className="customer-excel-gpt-guide__copy-inline"
                disabled={copyBusy}
                onClick={() => {
                  void handleCopy()
                }}
              >
                전체 복사
              </FormButton>
            </div>
            <pre className="customer-excel-gpt-guide__prompt" tabIndex={0}>
              {CUSTOMER_EXCEL_GPT_GUIDE_PROMPT}
            </pre>
          </section>

          <aside className="customer-excel-gpt-guide__cautions" aria-label={CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS_TITLE}>
            <h3 className="customer-excel-gpt-guide__cautions-title">{CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS_TITLE}</h3>
            <ul className="customer-excel-gpt-guide__cautions-list">
              {CUSTOMER_EXCEL_GPT_GUIDE_CAUTIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>

          {copyNotice ? (
            <p
              className={
                copyNotice.tone === 'ok'
                  ? 'customer-excel-gpt-guide__notice customer-excel-gpt-guide__notice--ok'
                  : 'customer-excel-gpt-guide__notice customer-excel-gpt-guide__notice--err'
              }
              role="status"
            >
              {copyNotice.text}
            </p>
          ) : null}
        </div>

        <footer className="customer-excel-gpt-guide__footer">
          <FormButton htmlType="button" variant="secondary" onClick={handleClose}>
            닫기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            disabled={copyBusy}
            onClick={() => {
              void handleCopy()
            }}
          >
            지시문 복사
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
