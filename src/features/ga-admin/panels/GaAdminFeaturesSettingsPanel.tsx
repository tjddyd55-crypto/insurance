import { useCallback, useEffect, useState } from 'react'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import type { GaCustomerExcelSettingsDto } from '../../admin/api/gaCustomerExcelAdminApi'
import { useGaSettings } from '../../ga-settings/useGaSettings'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import {
  fetchGaAdminCustomerExcelSettings,
  saveGaAdminCustomerExcelFeatureEnabled,
} from '../api/gaAdminCustomerExcelApi'

export default function GaAdminFeaturesSettingsPanel() {
  const { token, user } = useAuth()
  const { refresh: refreshGaCapability } = useGaSettings()
  const [settings, setSettings] = useState<GaCustomerExcelSettingsDto | null>(null)
  const [featureEnabled, setFeatureEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [saveOk, setSaveOk] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'GA_ADMIN') {
      return
    }
    setLoading(true)
    setLoadErr('')
    try {
      const row = await fetchGaAdminCustomerExcelSettings(token)
      setSettings(row)
      setFeatureEnabled(row.featureEnabled)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.')
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  async function onSave() {
    if (!token?.trim()) return
    setSaveErr('')
    setSaveOk('')
    setSaveBusy(true)
    try {
      const { settings: next } = await saveGaAdminCustomerExcelFeatureEnabled(token, featureEnabled)
      setSettings(next)
      setFeatureEnabled(next.featureEnabled)
      setSaveOk('저장되었습니다.')
      await refreshGaCapability()
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaveBusy(false)
    }
  }

  const summaryText =
    settings == null
      ? ''
      : settings.configReady
        ? '샘플·조회 기준 매핑이 완료되어 설계사 화면에 노출할 수 있습니다.'
        : settings.featureEnabled
          ? '기능은 켜져 있으나 샘플·매핑이 미완료입니다. SUPER_ADMIN GA 상세에서 매핑을 완료해 주세요.'
          : '기능이 꺼져 있습니다.'

  return (
    <div className="admin-data-card">
      <h2 className="admin-data-card__title">GA 기능 설정</h2>
      {loadErr ? <StatusMessage tone="error" message={loadErr} /> : null}
      {loading ? (
        <LoadingState message="기능 설정 불러오는 중…" />
      ) : !settings ? (
        <EmptyState message="설정을 불러오지 못했습니다." />
      ) : (
        <div className="ga-admin-features-settings flex flex-col gap-4">
          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">GA Excel 고객 DB</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <FormInput
                type="checkbox"
                checked={featureEnabled}
                onChange={(ev) => setFeatureEnabled(ev.target.checked)}
                className="shrink-0"
                disabled={saveBusy}
              />
              고객 엑셀 기능 사용 (ON / OFF)
            </label>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              샘플 엑셀·조회 기준 매핑은 SUPER_ADMIN GA 상세 화면에서 설정합니다. 여기서는 사용 여부만 변경합니다.
            </p>
          </section>
          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">설정 상태</h3>
            <p className="text-sm text-[var(--text-secondary)]">{summaryText}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              마지막 수정: {formatKstDateTimeDisplay(settings.updatedAt, '—')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              샘플 파일: {settings.sampleOriginalFilename || '—'} (
              {formatKstDateTimeDisplay(settings.sampleUploadedAt, '—')})
            </p>
          </section>
          {saveErr ? <StatusMessage tone="error" message={saveErr} /> : null}
          {saveOk ? <StatusMessage tone="default" message={saveOk} /> : null}
          <div className="ga-admin-form-dialog__actions">
            <FormButton htmlType="button" variant="primary" loading={saveBusy} onClick={() => void onSave()}>
              저장
            </FormButton>
          </div>
        </div>
      )}
    </div>
  )
}
