import TaCallDaySection from '../../components/TaCallDaySection'
import TaCallMissionCard from '../../components/TaCallMissionCard'
import TaCallSettingsDialog from '../../components/TaCallSettingsDialog'
import TaCallWeekNav from '../../components/TaCallWeekNav'
import type { TaCallViewProps } from '../../hooks/useTaCallState'

export default function TaCallMobileView(props: TaCallViewProps) {
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
    toggleDayExpanded,
    isDayExpanded,
  } = props

  return (
    <main className="page ta-call-page ta-call-page--mobile page--with-back">
      <header className="ta-call-page__header">
        <div>
          <h1 className="ta-call-page__title">오늘의 TA</h1>
          <p className="ta-call-page__subtitle">오늘 전화할 고객을 자동으로 배정했습니다.</p>
        </div>
        <button type="button" className="ta-call-page__settings-btn" onClick={openSettings}>
          <span aria-hidden>⚙</span>
          설정
        </button>
      </header>

      {error ? <p className="ta-call-page__error">{error}</p> : null}
      {loading && !week ? <p className="ta-call-page__loading">오늘의 TA 대상을 준비하고 있습니다.</p> : null}

      {week ? (
        <>
          <TaCallMissionCard day={todayDay} dailyTargetCount={settings.dailyTargetCount} />
          <TaCallWeekNav
            weekStartDate={week.weekStartDate}
            weekEndDate={week.weekEndDate}
            busy={busy}
            onPrev={goPrevWeek}
            onNext={goNextWeek}
          />
          <div className="ta-call-page__days">
            {week.days.map((day) => (
              <TaCallDaySection
                key={day.date}
                day={day}
                busy={busy}
                expanded={isDayExpanded(day.date)}
                layout="mobile"
                onToggleExpanded={() => toggleDayExpanded(day.date)}
                onStatusChange={changeAssignmentStatus}
              />
            ))}
          </div>
        </>
      ) : null}

      <TaCallSettingsDialog
        open={settingsOpen}
        busy={busy}
        draftTarget={draftTarget}
        dirty={settingsDirty}
        variant="mobile"
        onClose={closeSettings}
        onSave={saveSettings}
        onChangeTarget={changeDraftTarget}
      />
    </main>
  )
}
