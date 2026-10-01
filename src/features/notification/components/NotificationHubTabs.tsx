import type { NotificationHubTab } from '../hooks/useNotificationHubState'

const TABS: Array<{ id: NotificationHubTab; label: string }> = [
  { id: 'today', label: '오늘 알림' },
  { id: 'calendar', label: '달력' },
  { id: 'all', label: '전체 알림' },
]

export default function NotificationHubTabs({
  tab,
  onSelectTab,
}: {
  tab: NotificationHubTab
  onSelectTab: (tab: NotificationHubTab) => void
}) {
  return (
    <div className="notification-hub__tabs" role="tablist" aria-label="알림 보기">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={tab === item.id ? 'notification-hub__tab notification-hub__tab--active' : 'notification-hub__tab'}
          onClick={() => onSelectTab(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
