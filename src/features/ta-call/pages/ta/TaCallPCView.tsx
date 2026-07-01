import TaCallDaySection from '../../components/TaCallDaySection'
import TaCallMissionCard from '../../components/TaCallMissionCard'
import TaCallSettingsDialog from '../../components/TaCallSettingsDialog'
import type { TaCallViewProps } from '../../hooks/useTaCallState'
import { formatTaWeekRangeLabel } from '../../utils/taCallDisplay'

export default function TaCallPCView(props: TaCallViewProps) {
  const {
    loading,
    busy,
    error,
    week,
    settings,
    todayDay,
    settingsOpen,
    draftTarget,
    settingsDirty,
    openSettings,
    closeSettings,
    changeDraftTarget,
    saveSettings,
    goPrevWeek,
    goNextWeek,
    changeAssignmentStatus,
  } = props

  return (
    <main className="page ta-call-page ta-call-page--pc page--with-back">
      <div className="ta-call-page__layout">
        <aside className="ta-call-page__sidebar">
          <header className="ta-call-page__header ta-call-page__header--sidebar">
            <div>
              <h1 className="ta-call-page__title">오늘의 TA</h1>
              <p className="ta-call-page__subtitle">오늘 전화할 고객을 자동으로 배정했습니다.</p>
            </div>
          </header>

          <TaCallMissionCard day={todayDay} dailyTargetCount={settings.dailyTargetCount} compact />

          {week ? (
            <section className="ta-call-week-summary">
              <h2 className="ta-call-week-summary__title">이번 주 요약</h2>
              <p className="ta-call-week-summary__range">
                {formatTaWeekRangeLabel(week.weekStartDate, week.weekEndDate)}
              </p>
              <ul className="ta-call-week-summary__list">
                {week.days.map((day) => (
                  <li key={day.date} className="ta-call-week-summary__item">
                    <span>
                      {day.date.slice(5).replace('-', '/')} — {day.completedCount}/{day.dailyTargetCount}
                    </span>
                    {day.isMissionCompleted ? <span className="ta-call-week-summary__check">✓</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="ta-call-page__sidebar-settings">
            <span>하루 목표: {settings.dailyTargetCount}명</span>
            <button type="button" className="ta-call-page__settings-btn" onClick={openSettings}>
              <span aria-hidden>⚙</span>
              설정
            </button>
          </div>
        </aside>

        <section className="ta-call-page__main">
          {error ? <p className="ta-call-page__error">{error}</p> : null}
          {loading && !week ? (
            <p className="ta-call-page__loading">오늘의 TA 대상을 준비하고 있습니다.</p>
          ) : null}

          {week ? (
            <>
              <div className="ta-call-page__week-toolbar">
                <button type="button" className="ta-call-week-toolbar__btn" disabled={busy} onClick={goPrevWeek}>
                  ‹ 이전 주
                </button>
                <span>{formatTaWeekRangeLabel(week.weekStartDate, week.weekEndDate)}</span>
                <button type="button" className="ta-call-week-toolbar__btn" disabled={busy} onClick={goNextWeek}>
                  다음 주 ›
                </button>
              </div>
              <div className="ta-call-page__days">
                {week.days.map((day) => (
                  <TaCallDaySection
                    key={day.date}
                    day={day}
                    busy={busy}
                    layout="pc"
                    onStatusChange={changeAssignmentStatus}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <TaCallSettingsDialog
        open={settingsOpen}
        busy={busy}
        draftTarget={draftTarget}
        dirty={settingsDirty}
        variant="pc"
        onClose={closeSettings}
        onSave={saveSettings}
        onChangeTarget={changeDraftTarget}
      />
    </main>
  )
}
