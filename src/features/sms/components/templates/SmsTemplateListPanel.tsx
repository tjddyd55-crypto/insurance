import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { FormDialog } from '../../../../components/dialog'
import { useConfirmDialog } from '../../../../components/dialog'
import { useState } from 'react'
import type { SmsTemplate } from '../../types/sms.types'
import {
  formatSmsTemplateDateLabel,
  formatSmsTemplateMessageTypeLabel,
  formatSmsTemplateMetaLine,
  formatSmsTemplateTransportLabel,
} from '../../utils/smsTemplateDisplay'

type Props = {
  templates: SmsTemplate[]
  busy?: boolean
  editingId: number | null
  onEdit: (template: SmsTemplate) => void
  onDelete: (id: number) => Promise<void>
}

function previewBody(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '(본문 없음)'
  }
  return normalized.length > 80 ? `${normalized.slice(0, 80)}…` : normalized
}

export default function SmsTemplateListPanel({
  templates,
  busy = false,
  editingId,
  onEdit,
  onDelete,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [viewTemplate, setViewTemplate] = useState<SmsTemplate | null>(null)

  const handleDelete = async (template: SmsTemplate) => {
    const ok = await confirm({
      title: '템플릿 삭제',
      message: '문자 템플릿을 삭제하시겠습니까?\n삭제한 템플릿은 다시 불러올 수 없습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!ok) {
      return
    }
    await onDelete(template.id)
  }

  return (
    <>
      <section className="sms-template-list">
        <h3 className="sms-template-list__title">템플릿 목록</h3>
        {templates.length === 0 ? (
          <p className="sms-module__muted">저장된 템플릿이 없습니다.</p>
        ) : (
          <ul className="sms-template-list__items">
            {templates.map((template) => (
              <li
                key={template.id}
                className={`sms-template-card${editingId === template.id ? ' sms-template-card--active' : ''}`}
              >
                <div className="sms-template-card__body">
                  <p className="sms-template-card__title">{template.title}</p>
                  <p className="sms-template-card__meta">
                    {formatSmsTemplateTransportLabel(template.message)} ·{' '}
                    {formatSmsTemplateMessageTypeLabel(template.messageType)}
                  </p>
                  <p className="sms-template-card__preview">{previewBody(template.message)}</p>
                  <p className="sms-template-card__date">
                    수정 {formatSmsTemplateDateLabel(template.updatedAt ?? template.createdAt)}
                  </p>
                </div>
                <div className="sms-template-card__actions">
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => setViewTemplate(template)}>
                    보기
                  </FormButton>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => onEdit(template)}>
                    수정
                  </FormButton>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleDelete(template)}>
                    삭제
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormDialog
        open={viewTemplate != null}
        onClose={() => setViewTemplate(null)}
        title="템플릿 보기"
        footer={
          <div className="sms-template-dialog__actions">
            <FormButton type="button" variant="secondary" onClick={() => setViewTemplate(null)}>
              닫기
            </FormButton>
            {viewTemplate ? (
              <FormButton
                type="button"
                disabled={busy}
                onClick={() => {
                  onEdit(viewTemplate)
                  setViewTemplate(null)
                }}
              >
                수정
              </FormButton>
            ) : null}
          </div>
        }
      >
        {viewTemplate ? (
          <div className="sms-template-view">
            <dl className="sms-template-view__meta">
              <div>
                <dt>템플릿명</dt>
                <dd>{viewTemplate.title}</dd>
              </div>
              <div>
                <dt>문자 유형</dt>
                <dd>
                  {formatSmsTemplateTransportLabel(viewTemplate.message)} ·{' '}
                  {formatSmsTemplateMessageTypeLabel(viewTemplate.messageType)}
                </dd>
              </div>
              <div>
                <dt>byte 수</dt>
                <dd>{formatSmsTemplateMetaLine(viewTemplate)}</dd>
              </div>
              <div>
                <dt>생성일</dt>
                <dd>{formatSmsTemplateDateLabel(viewTemplate.createdAt)}</dd>
              </div>
              <div>
                <dt>수정일</dt>
                <dd>{formatSmsTemplateDateLabel(viewTemplate.updatedAt)}</dd>
              </div>
            </dl>
            <p className="sms-template-view__hint">치환 변수는 실제 발송 시 고객별 값으로 변경됩니다.</p>
            <pre className="sms-template-view__body">{viewTemplate.message}</pre>
          </div>
        ) : null}
      </FormDialog>

      {confirmDialog}
    </>
  )
}
