import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import {
  fetchTaCallSettings,
  fetchTaCallWeek,
  saveTaCallSettings,
  updateTaCallAssignmentStatus,
} from '../api/taCallApi'
import {
  TA_CALL_DEFAULT_SETTINGS,
  TA_CALL_MAX_TARGET,
  TA_CALL_MIN_TARGET,
  TA_CALL_SETTINGS_SAVED_NOTICE,
} from '../config/taCall.config'
import type { TaCallAssignment, TaCallSettings, TaCallStatus, TaCallWeekPayload } from '../types/taCall.types'
import { buildTaCallCustomerNavigateHref } from '../utils/taCallCustomerNavigation'
import {
  findTodayDay,
  shiftWeekStartDate,
  buildDefaultExpandedDates,
  toggleExpandedDate,
  isDayExpanded,
} from '../utils/taCallDisplay'
import { buildTaTargetFilterSummary } from '../utils/taCallTargetFilterSummary'

export type TaCallViewProps = ReturnType<typeof useTaCallState>

function clampTarget(value: number) {
  return Math.min(TA_CALL_MAX_TARGET, Math.max(TA_CALL_MIN_TARGET, value))
}

function parseDraftInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function useTaCallState() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [week, setWeek] = useState<TaCallWeekPayload | null>(null)
  const [settings, setSettings] = useState<TaCallSettings>(TA_CALL_DEFAULT_SETTINGS)
  const [weekStartDate, setWeekStartDate] = useState<string>('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftSettings, setDraftSettings] = useState<TaCallSettings>(TA_CALL_DEFAULT_SETTINGS)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set())
  const settingsDirtyRef = useRef(false)

  const todayDay = useMemo(() => findTodayDay(week), [week])
  const targetFilterSummary = useMemo(
    () => week?.targetFilterSummary ?? buildTaTargetFilterSummary(settings),
    [settings, week?.targetFilterSummary],
  )

  const markDirty = useCallback((next: TaCallSettings) => {
    setDraftSettings(next)
    setSettingsDirty(true)
    settingsDirtyRef.current = true
  }, [])

  const loadWeek = useCallback(
    async (startDate?: string) => {
      if (!token?.trim()) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const [settingsRes, weekRes] = await Promise.all([
          fetchTaCallSettings(token),
          fetchTaCallWeek(token, startDate),
        ])
        setSettings(settingsRes)
        setWeek(weekRes)
        setWeekStartDate(weekRes.weekStartDate)
        setExpandedDates(buildDefaultExpandedDates(weekRes))
        if (!settingsDirtyRef.current) {
          setDraftSettings(settingsRes)
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '오늘의 TA 데이터를 불러오지 못했습니다.'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  const openSettings = useCallback(() => {
    setDraftSettings(settings)
    setSettingsDirty(false)
    settingsDirtyRef.current = false
    setSettingsOpen(true)
  }, [settings])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsDirty(false)
    settingsDirtyRef.current = false
  }, [])

  const changeDraftTarget = useCallback(
    (next: number) => {
      markDirty({ ...draftSettings, dailyTargetCount: clampTarget(next) })
    },
    [draftSettings, markDirty],
  )

  const changeDraftGender = useCallback(
    (targetGender: TaCallSettings['targetGender']) => {
      markDirty({ ...draftSettings, targetGender })
    },
    [draftSettings, markDirty],
  )

  const changeDraftSangnyeongDays = useCallback(
    (raw: string) => {
      markDirty({ ...draftSettings, targetSangnyeongDays: parseDraftInt(raw) })
    },
    [draftSettings, markDirty],
  )

  const changeDraftInsuranceAgeMin = useCallback(
    (raw: string) => {
      markDirty({ ...draftSettings, targetInsuranceAgeMin: parseDraftInt(raw) })
    },
    [draftSettings, markDirty],
  )

  const changeDraftInsuranceAgeMax = useCallback(
    (raw: string) => {
      markDirty({ ...draftSettings, targetInsuranceAgeMax: parseDraftInt(raw) })
    },
    [draftSettings, markDirty],
  )

  const changeDraftExcludeMinors = useCallback(
    (excludeMinors: boolean) => {
      markDirty({ ...draftSettings, excludeMinors })
    },
    [draftSettings, markDirty],
  )

  const saveSettings = useCallback(async () => {
    if (!token?.trim()) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveTaCallSettings(token, draftSettings)
      setSettings(saved)
      setSettingsOpen(false)
      setSettingsDirty(false)
      settingsDirtyRef.current = false
      setSettingsNotice(TA_CALL_SETTINGS_SAVED_NOTICE)
      await loadWeek(weekStartDate || undefined)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '설정을 저장하지 못했습니다.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }, [draftSettings, loadWeek, token, weekStartDate])

  const goPrevWeek = useCallback(() => {
    if (!weekStartDate) return
    void loadWeek(shiftWeekStartDate(weekStartDate, -1))
  }, [loadWeek, weekStartDate])

  const goNextWeek = useCallback(() => {
    if (!weekStartDate) return
    void loadWeek(shiftWeekStartDate(weekStartDate, 1))
  }, [loadWeek, weekStartDate])

  const toggleDayExpanded = useCallback((date: string) => {
    setExpandedDates((prev) => toggleExpandedDate(prev, date))
  }, [])

  const openCustomerFromAssignment = useCallback(
    (assignment: TaCallAssignment) => {
      const href = buildTaCallCustomerNavigateHref(assignment, isMobile)
      if (!href) {
        return
      }
      const customerName = assignment.customerName?.trim()
      navigate(href, {
        state: customerName ? { customerName } : undefined,
      })
    },
    [isMobile, navigate],
  )

  const changeAssignmentStatus = useCallback(
    async (assignmentId: string, status: TaCallStatus) => {
      if (!token?.trim() || !week) return
      setBusy(true)
      setError(null)
      try {
        await updateTaCallAssignmentStatus(token, assignmentId, status)
        await loadWeek(weekStartDate || undefined)
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : '상태를 변경하지 못했습니다.'
        setError(message)
      } finally {
        setBusy(false)
      }
    },
    [loadWeek, token, week, weekStartDate],
  )

  return {
    loading,
    busy,
    error,
    week,
    settings,
    todayDay,
    weekStartDate,
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
    toggleDayExpanded,
    isDayExpanded: (date: string) => isDayExpanded(expandedDates, date),
    openCustomerFromAssignment,
    changeAssignmentStatus,
    reload: () => loadWeek(weekStartDate || undefined),
  }
}
