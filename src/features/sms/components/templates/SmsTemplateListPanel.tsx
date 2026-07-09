import FormButton from '../../../../components/form/FormButton'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsTemplate } from '../../types/sms.types'
import {
  formatSmsTemplateDateLabel,
  formatSmsTemplateMessageTypeLabel,
  formatSmsTemplateTransportLabel,
} from '../../utils/smsTemplateDisplay'

type Props = {
  templates: SmsTemplate[]
  busy?: boolean
  loadedId: number | null
  onLoad: (template: SmsTemplate) => void
  onDelete: (id: number) => Promise<void>
}

function previewBody(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '(본문 없음)'
  }
  return normalized
}

export default function SmsTemplateListPanel({
  templates,
  busy = false,
  loadedId,
  onLoad,
  onDelete,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()

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
      <section className="sms-template-list sms-template-list--workspace">
        <h3 className="sms-template-list__title">저장된 템플릿 목록</h3>
        {templates.length === 0 ? (
          <p className="sms-module__muted">저장된 템플릿이 없습니다.</p>
        ) : (
          <ul className="sms-template-list__items">
            {templates.map((template) => {
              const active = loadedId === template.id
              return (
                <li key={template.id}>
                  <article className={`sms-template-card${active ? ' sms-template-card--active' : ''}`}>
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
                      <FormButton
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onLoad(template)}
                      >
                        불러오기
                      </FormButton>
                      <FormButton
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleDelete(template)}
                      >
                        삭제
                      </FormButton>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {confirmDialog}
    </>
  )
}
