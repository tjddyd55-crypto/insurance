import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { NotificationCenter } from '../../notification/components/NotificationCenter'
import NotificationHubTabs from '../../notification/components/NotificationHubTabs'
import ReminderCalendarPanel from '../../notification/components/ReminderCalendarPanel'
import ReminderListPanel from '../../notification/components/ReminderListPanel'
import {
  notificationHubTabFromPath,
  useNotificationHubState,
  type NotificationHubViewProps,
} from '../../notification/hooks/useNotificationHubState'
import type { ReminderEvent } from '../../notification/api/reminderApi'
import '../../notification/notification-hub.css'

function NotificationsContent(props: NotificationHubViewProps) {
  return (
    <>
      <header className="notifications-page__header">
        <h1>알림</h1>
      </header>
      <NotificationHubTabs tab={props.tab} onSelectTab={props.onSelectTab} />
      {props.tab === 'today' ? (
        <section className="notifications-page__panel">
          {props.token.trim() ? (
            <NotificationCenter token={props.token} />
          ) : (
            <p className="notifications-page__empty">로그인이 필요합니다.</p>
          )}
        </section>
      ) : null}
      {props.tab === 'calendar' ? (
        <ReminderCalendarPanel
          month={props.month}
          selectedDay={props.selectedDay}
          days={props.days}
          dayEvents={props.dayEvents}
          loading={props.loading}
          onShiftMonth={props.onShiftMonth}
          onSelectDay={props.onSelectDay}
          onOpenCustomer={props.onOpenCustomer}
        />
      ) : null}
      {props.tab === 'all' ? <ReminderListPanel {...props} /> : null}
    </>
  )
}

function NotificationsPCView(props: NotificationHubViewProps) {
  return (
    <main className="page notifications-page notifications-page--pc page--with-back content-wrapper page-shell">
      <NotificationsContent {...props} />
    </main>
  )
}

function NotificationsMobileView(props: NotificationHubViewProps) {
  return (
    <main className="page notifications-page notifications-page--mobile page--with-back content-wrapper page-shell">
      <NotificationsContent {...props} />
    </main>
  )
}

export default function NotificationsPlaceholderPage() {
  const { pathname } = useLocation()
  const tab = notificationHubTabFromPath(pathname)
  const state = useNotificationHubState(tab)
  const { confirm, confirmDialog } = useConfirmDialog()

  const onCloseEdit = useCallback(async () => {
    if (state.editDirty) {
      const accepted = await confirm({
        title: '닫기',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
        cancelLabel: '계속 수정',
      })
      if (!accepted) {
        return
      }
    }
    state.onCloseEdit()
  }, [confirm, state])

  const onDelete = useCallback(async (event: ReminderEvent) => {
    const accepted = await confirm({
      title: '알림 삭제',
      message: '이 알림일을 삭제하시겠습니까?',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!accepted) {
      return
    }
    state.onDelete(event)
  }, [confirm, state])

  const viewProps = useMemo<NotificationHubViewProps>(() => ({
    ...state,
    onCloseEdit: () => {
      void onCloseEdit()
    },
    onDelete: (event) => {
      void onDelete(event)
    },
  }), [onCloseEdit, onDelete, state])

  return (
    <>
      <ResponsiveLayout<NotificationHubViewProps>
        PC={NotificationsPCView}
        Mobile={NotificationsMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}
