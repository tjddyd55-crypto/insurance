import { FormButton } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import type { SecurityAuditLogRow } from '../../auth/authApi'
import { formatAuditLogDateTime } from '../auditLogs/auditLogPresentation'

type Props = {
  open: boolean
  row: SecurityAuditLogRow | null
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-log-detail__row">
      <dt className="audit-log-detail__label">{label}</dt>
      <dd className="audit-log-detail__value">{value || '—'}</dd>
    </div>
  )
}

export function AuditLogDetailModal({ open, row, onClose }: Props) {
  const metaObject =
    row?.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : null
  const metaJson = metaObject && Object.keys(metaObject).length > 0 ? JSON.stringify(metaObject, null, 2) : '—'

  return (
    <BaseDialog open={open} onClose={onClose} ariaLabel="감사 로그 상세" closeOnBackdrop panelPreset="largeForm">
      <div className="audit-log-detail">
        <header className="audit-log-detail__header">
          <h2 className="audit-log-detail__title">감사 로그 상세</h2>
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={onClose}>
            닫기
          </FormButton>
        </header>

        {row ? (
          <div className="audit-log-detail__body">
            <dl className="audit-log-detail__grid">
              <DetailRow label="작업 시간" value={formatAuditLogDateTime(row.occurredAt ?? row.created_at)} />
              <DetailRow label="작업명" value={row.actionLabel ?? row.action} />
              <DetailRow label="작업 코드" value={row.action} />
              <DetailRow label="사용자" value={row.actorDisplayName ?? row.actorUsername ?? row.actor_user_id ?? '—'} />
              <DetailRow label="사용자 ID" value={row.actorUserId ?? row.actor_user_id ?? '—'} />
              <DetailRow label="권한" value={row.roleLabel ?? row.role ?? row.actor_role ?? '—'} />
              <DetailRow label="대상" value={row.targetLabel ?? '—'} />
              <DetailRow
                label="대상 원본값"
                value={
                  row.target ??
                  (row.target_type ? `${row.target_type}:${row.target_id ?? ''}` : '—')
                }
              />
              <DetailRow label="GA ID" value={String(row.gaId ?? row.ga_id ?? '—')} />
              {row.ipAddress ? <DetailRow label="IP 주소" value={row.ipAddress} /> : null}
              {row.userAgent ? <DetailRow label="User-Agent" value={row.userAgent} /> : null}
            </dl>

            <section className="audit-log-detail__meta">
              <h3 className="audit-log-detail__meta-title">상세 데이터</h3>
              <pre className="audit-log-detail__meta-pre">{metaJson}</pre>
            </section>
          </div>
        ) : null}
      </div>
    </BaseDialog>
  )
}
