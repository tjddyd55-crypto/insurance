import FormButton from '../../../../components/form/FormButton'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsScheduledRule } from '../../types/smsScheduled.types'
import { buildScheduleSummary, formatNextRunAtLabel } from '../../utils/smsScheduledSummary'
import { SmsScheduledStatusBadge } from './SmsScheduledStatusBadge'

export type SmsReservedRulesListProps = {
  rules: SmsScheduledRule[]
  groups: { id: number; name: string }[]
  selectedRuleId: string | null
  disabled?: boolean
  onSelect: (ruleId: string) => void
  onEdit: (ruleId: string) => void
  onCopy: (rule: SmsScheduledRule) => void
  onDelete: (rule: SmsScheduledRule) => void
}

export function SmsReservedRulesList({
  rules,
  groups,
  selectedRuleId,
  disabled,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
}: SmsReservedRulesListProps) {
  const { confirm, confirmDialog } = useConfirmDialog()

  const activeCount = rules.filter((rule) => rule.enabled && rule.status === 'active').length
  const inactiveCount = rules.length - activeCount

  const handleDelete = async (rule: SmsScheduledRule) => {
    const ok = await confirm({
      title: '예약 삭제',
      message: '예약문자를 삭제하시겠습니까?\n삭제하면 해당 예약 규칙은 더 이상 실행되지 않습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (ok) {
      onDelete(rule)
    }
  }

  return (
    <>
      <section className="sms-send-reserved-list" aria-label="예약 현황">
        <div className="sms-send-reserved-list__head">
          <h3 className="sms-send-section__title">예약 현황</h3>
          <p className="sms-module__muted sms-send-reserved-list__summary">
            전체 {rules.length} · 활성 {activeCount} · 비활성 {inactiveCount}
          </p>
        </div>

        {rules.length === 0 ? (
          <p className="sms-module__muted">저장된 예약문자가 없습니다.</p>
        ) : (
          <ul className="sms-send-reserved-list__items">
            {rules.map((rule) => {
              const groupName = groups.find((g) => String(g.id) === rule.recipientGroupId)?.name ?? '미지정'
              const selected = selectedRuleId === rule.id
              return (
                <li key={rule.id}>
                  <article
                    className={`sms-send-reserved-card${selected ? ' sms-send-reserved-card--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="sms-send-reserved-card__select"
                      disabled={disabled}
                      onClick={() => onSelect(rule.id)}
                    >
                      <div className="sms-send-reserved-card__header">
                        <p className="sms-send-reserved-card__name">{rule.name}</p>
                        <SmsScheduledStatusBadge rule={rule} />
                      </div>
                      <p className="sms-send-reserved-card__meta">그룹: {groupName}</p>
                      <p className="sms-send-reserved-card__meta">{buildScheduleSummary(rule)}</p>
                      <p className="sms-send-reserved-card__meta">
                        다음 실행: {formatNextRunAtLabel(rule.nextRunAt)}
                      </p>
                    </button>
                    <div className="sms-send-reserved-card__actions">
                      <FormButton
                        type="button"
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => onEdit(rule.id)}
                      >
                        수정
                      </FormButton>
                      <FormButton
                        type="button"
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => onCopy(rule)}
                      >
                        복사
                      </FormButton>
                      <FormButton
                        type="button"
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => void handleDelete(rule)}
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
