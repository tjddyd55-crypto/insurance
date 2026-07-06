import TaCallDaySection from '../../components/TaCallDaySection'
import TaCallDailyTargetCard from '../../components/TaCallDailyTargetCard'
import TaCallMissionCard from '../../components/TaCallMissionCard'
import TaCallSettingsDialog from '../../components/TaCallSettingsDialog'
import TaCallWeekSummaryCard from '../../components/TaCallWeekSummaryCard'
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
    draftSettings,
    settingsDirty,
    settingsNotice,
    targetFilterSummary,
    openSettings,
    closeSettings,
    changeDraftTarget,
    changeDraftGender,
    changeDraftSangnyeongDays,
    changeDraftInsuranceAgeMin,
    changeDraftInsuranceAgeMax,
    changeDraftExcludeMinors,
    saveSettings,
    goPrevWeek,
    goNextWeek,
    changeAssignmentStatus,
    toggleDayExpanded,
    isDayExpanded,
    openCustomerFromAssignment,
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
            <TaCallWeekSummaryCard
              weekStartDate={week.weekStartDate}
              weekEndDate={week.weekEndDate}
              days={week.days}
            />
          ) : null}

          <TaCallDailyTargetCard
            dailyTargetCount={settings.dailyTargetCount}
            targetFilterSummary={targetFilterSummary}
            onOpenSettings={openSettings}
          />
          {settingsNotice ? <p className="ta-call-page__settings-notice">{settingsNotice}</p> : null}
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
                    expanded={isDayExpanded(day.date)}
                    layout="pc"
                    onToggleExpanded={() => toggleDayExpanded(day.date)}
                    onOpenCustomer={openCustomerFromAssignment}
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
        draftSettings={draftSettings}
        dirty={settingsDirty}
        variant="pc"
        onClose={closeSettings}
        onSave={saveSettings}
        onChangeTarget={changeDraftTarget}
        onChangeGender={changeDraftGender}
        onChangeSangnyeongDays={changeDraftSangnyeongDays}
        onChangeInsuranceAgeMin={changeDraftInsuranceAgeMin}
        onChangeInsuranceAgeMax={changeDraftInsuranceAgeMax}
        onChangeExcludeMinors={changeDraftExcludeMinors}
      />
    </main>
  )
}
