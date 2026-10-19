import { useMemo } from 'react'
import { formatNotificationPrimaryText } from '@insurance-shared/userNotificationCatalog.js'
import { FormButton } from '../../../components/form'
import type { NotificationListView, NotificationRow } from '../api/notificationApi'
import { NOTIFICATION_PANEL_PREVIEW_COUNT, NOTIFICATION_SECTIONS } from '../config/notificationCenter.config'
import {
  formatNotificationDateOnly,
  formatNotificationRowDDay,
  sortNotificationRowsByReferenceDate,
} from '../utils/notificationDateLabel'
import { canNavigateFromNotification } from '../utils/notificationCustomerNavigation'

export type NotificationCenterSectionsProps = {
  items: NotificationRow[]
  view: NotificationListView
  expandedSections: ReadonlySet<string>
  pendingId: string | null
  isConfirming: boolean
  confirmTargetId: string | null
  onNameClick: (row: NotificationRow) => void
  onConfirm: (row: NotificationRow) => void
  onToggleExpanded: (type: string) => void
}

function groupNotificationItems(items: NotificationRow[]) {
  const map = new Map<string, NotificationRow[]>()
  for (const section of NOTIFICATION_SECTIONS) {
    map.set(section.type, [])
  }
  for (const row of items) {
    const bucket = map.get(row.type)
    if (bucket) {
      bucket.push(row)
    }
  }
  for (const section of NOTIFICATION_SECTIONS) {
    const rows = map.get(section.type) ?? []
    map.set(section.type, sortNotificationRowsByReferenceDate(rows))
  }
  return map
}

type SectionPanelProps = {
  section: (typeof NOTIFICATION_SECTIONS)[number]
  rows: NotificationRow[]
  view: NotificationListView
  expanded: boolean
  pendingId: string | null
  isConfirming: boolean
  confirmTargetId: string | null
  onNameClick: (row: NotificationRow) => void
  onConfirm: (row: NotificationRow) => void
  onToggleExpanded: (type: string) => void
}

function NotificationSectionPanel({
  section,
  rows,
  view,
  expanded,
  pendingId,
  isConfirming,
  confirmTargetId,
  onNameClick,
  onConfirm,
  onToggleExpanded,
}: SectionPanelProps) {
  const hiddenCount = Math.max(0, rows.length - NOTIFICATION_PANEL_PREVIEW_COUNT)
  const visibleRows = expanded ? rows : rows.slice(0, NOTIFICATION_PANEL_PREVIEW_COUNT)
  return (
    <section
      className={`notification-section notification-section--${section.sectionClass}${
        expanded ? ' is-expanded' : ''
      }`}
    >
      <header className="notification-section__banner">
        <h2 className="notification-section__title">
          {section.title}
          <span className="notification-section__count">{rows.length}</span>
        </h2>
      </header>
      <div className="notification-section__body">
        <SectionBody
          rows={visibleRows}
          dateColumnLabel={section.dateColumnLabel}
          view={view}
          pendingId={pendingId}
          isConfirming={isConfirming}
          confirmTargetId={confirmTargetId}
          onNameClick={onNameClick}
          onConfirm={onConfirm}
        />
      </div>
      {hiddenCount > 0 || expanded ? (
        <div className="notification-section__footer">
          {rows.length > NOTIFICATION_PANEL_PREVIEW_COUNT ? (
            <button
              type="button"
              className="notification-section__more"
              onClick={() => onToggleExpanded(section.type)}
            >
              {expanded ? '접기' : `더보기 ${hiddenCount}개`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function SectionBody({
  rows,
  dateColumnLabel,
  view,
  pendingId,
  isConfirming,
  confirmTargetId,
  onNameClick,
  onConfirm,
}: {
  rows: NotificationRow[]
  dateColumnLabel: string
  view: NotificationListView
  pendingId: string | null
  isConfirming: boolean
  confirmTargetId: string | null
  onNameClick: (row: NotificationRow) => void
  onConfirm: (row: NotificationRow) => void
}) {
  if (rows.length === 0) {
    return <p className="notification-section__empty">표시할 알림이 없습니다.</p>
  }
  return (
    <table className="notification-section__table">
      <thead>
        <tr>
          <th>이름</th>
          <th>{dateColumnLabel}</th>
          <th>D-day</th>
          {view === 'active' ? <th>확인</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <NotificationSectionRow
            key={row.id}
            row={row}
            view={view}
            pendingId={pendingId}
            isConfirming={isConfirming}
            confirmTargetId={confirmTargetId}
            onNameClick={onNameClick}
            onConfirm={onConfirm}
          />
        ))}
      </tbody>
    </table>
  )
}

function NotificationSectionRow({
  row,
  view,
  pendingId,
  isConfirming,
  confirmTargetId,
  onNameClick,
  onConfirm,
}: {
  row: NotificationRow
  view: NotificationListView
  pendingId: string | null
  isConfirming: boolean
  confirmTargetId: string | null
  onNameClick: (row: NotificationRow) => void
  onConfirm: (row: NotificationRow) => void
}) {
  const primaryText = formatNotificationPrimaryText(row)
  return (
    <tr>
      <td>
        {canNavigateFromNotification(row) ? (
          <button
            type="button"
            className="notification-section__name-link"
            disabled={pendingId === row.id || isConfirming}
            onClick={() => onNameClick(row)}
          >
            {primaryText}
          </button>
        ) : (
          primaryText
        )}
      </td>
      <td className="tabular-nums">{formatNotificationDateOnly(row)}</td>
      <td className="tabular-nums">{formatNotificationRowDDay(row)}</td>
      <td>
        {view === 'active' ? (
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={isConfirming && confirmTargetId === row.id}
            onClick={() => onConfirm(row)}
          >
            확인
          </FormButton>
        ) : null}
      </td>
    </tr>
  )
}

export function NotificationCenterSections({
  items,
  view,
  expandedSections,
  pendingId,
  isConfirming,
  confirmTargetId,
  onNameClick,
  onConfirm,
  onToggleExpanded,
}: NotificationCenterSectionsProps) {
  const groupedItems = useMemo(() => groupNotificationItems(items), [items])
  return (
    <div className="notification-center__grid">
      {NOTIFICATION_SECTIONS.map((section) => (
        <NotificationSectionPanel
          key={section.type}
          section={section}
          rows={groupedItems.get(section.type) ?? []}
          view={view}
          expanded={expandedSections.has(section.type)}
          pendingId={pendingId}
          isConfirming={isConfirming}
          confirmTargetId={confirmTargetId}
          onNameClick={onNameClick}
          onConfirm={onConfirm}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
    </div>
  )
}
