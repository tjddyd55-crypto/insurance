import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { FormDialog } from '../../../../components/dialog'
import { useConfirmDialog } from '../../../../components/dialog'
import { useMemo, useState } from 'react'
import { detectSmsType, estimateSmsBytes } from '../../api/smsApi'
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
  onLoad: (template: SmsTemplate) => void
  onDelete: (id: number) => Promise<void>
  onUpdate: (id: number, input: { title: string; message: string; messageType: 'info' | 'ad' }) => Promise<void>
}

type EditFormState = {
  title: string
  message: string
  messageType: 'info' | 'ad'
}

function emptyEditForm(): EditFormState {
  return { title: '', message: '', messageType: 'info' }
}

export default function SmsTemplateListPanel({ templates, busy = false, onLoad, onDelete, onUpdate }: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [viewTemplate, setViewTemplate] = useState<SmsTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<SmsTemplate | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm)
  const [editDirty, setEditDirty] = useState(false)

  const editBytes = useMemo(() => estimateSmsBytes(editForm.message), [editForm.message])
  const editTransport = useMemo(() => detectSmsType(editForm.message), [editForm.message])

  const openEdit = (template: SmsTemplate) => {
    setEditTemplate(template)
    setEditForm({
      title: template.title,
      message: template.message,
      messageType: template.messageType,
    })
    setEditDirty(false)
  }

  const closeEdit = async () => {
    if (editDirty) {
      const ok = await confirm({
        title: '템플릿 수정',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
        cancelLabel: '취소',
      })
      if (!ok) {
        return
      }
    }
    setEditTemplate(null)
    setEditForm(emptyEditForm())
    setEditDirty(false)
  }

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

  const handleSaveEdit = async () => {
    if (!editTemplate || !editForm.title.trim() || !editForm.message.trim()) {
      return
    }
    await onUpdate(editTemplate.id, {
      title: editForm.title.trim(),
      message: editForm.message.trim(),
      messageType: editForm.messageType,
    })
    setEditTemplate(null)
    setEditForm(emptyEditForm())
    setEditDirty(false)
  }

  return (
    <>
      <section className="sms-template-list">
        <h3 className="sms-template-list__title">저장된 템플릿</h3>
        {templates.length === 0 ? (
          <p className="sms-module__muted">저장된 템플릿이 없습니다.</p>
        ) : (
          <ul className="sms-template-list__items">
            {templates.map((template) => (
              <li key={template.id} className="sms-template-card">
                <div className="sms-template-card__body">
                  <p className="sms-template-card__title">{template.title}</p>
                  <p className="sms-template-card__meta">{formatSmsTemplateMetaLine(template)}</p>
                  <p className="sms-template-card__preview">{template.message}</p>
                  <p className="sms-template-card__date">
                    수정 {formatSmsTemplateDateLabel(template.updatedAt ?? template.createdAt)}
                  </p>
                </div>
                <div className="sms-template-card__actions">
                  <FormButton type="button" disabled={busy} onClick={() => onLoad(template)}>
                    불러오기
                  </FormButton>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => setViewTemplate(template)}>
                    보기
                  </FormButton>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => openEdit(template)}>
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
                  openEdit(viewTemplate)
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

      <FormDialog
        open={editTemplate != null}
        onClose={() => void closeEdit()}
        onEscapeRequest={() => void closeEdit()}
        title="템플릿 수정"
        panelPreset="largeForm"
        footer={
          <div className="sms-template-dialog__actions">
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void closeEdit()}>
              취소
            </FormButton>
            <FormButton
              type="button"
              disabled={busy || !editForm.title.trim() || !editForm.message.trim()}
              onClick={() => void handleSaveEdit()}
            >
              수정 저장
            </FormButton>
          </div>
        }
      >
        <div className="sms-template-edit">
          <label>
            템플릿명
            <FormInput
              value={editForm.title}
              disabled={busy}
              onChange={(e) => {
                setEditDirty(true)
                setEditForm((prev) => ({ ...prev, title: e.target.value }))
              }}
            />
          </label>
          <label>
            문자내용
            <textarea
              className="sms-module__textarea sms-template-edit__textarea"
              rows={10}
              value={editForm.message}
              disabled={busy}
              onChange={(e) => {
                setEditDirty(true)
                setEditForm((prev) => ({ ...prev, message: e.target.value }))
              }}
            />
          </label>
          <p className="sms-template-edit__meta">
            현재 {editBytes}byte · {editTransport === 'SMS' ? '단문(SMS)' : '장문(LMS)'}
          </p>
          <label className="sms-composer__checkbox">
            <input
              type="checkbox"
              checked={editForm.messageType === 'ad'}
              disabled={busy}
              onChange={(e) => {
                setEditDirty(true)
                setEditForm((prev) => ({ ...prev, messageType: e.target.checked ? 'ad' : 'info' }))
              }}
            />
            <span>광고성 문자입니다.</span>
          </label>
        </div>
      </FormDialog>

      {confirmDialog}
    </>
  )
}
