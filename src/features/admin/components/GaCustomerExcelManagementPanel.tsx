import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import FileUploader from '../../../components/common/FileUploader'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import type { GaCustomerExcelSettingsDto } from '../api/gaCustomerExcelAdminApi'
import type { GaCustomerExcelManagementApi } from './gaCustomerExcelManagementApi'

const DB_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '(매칭 없음)' },
  { value: 'name', label: '이름' },
  { value: 'birth_date', label: '생년월일' },
  { value: 'ssn', label: '주민번호' },
  { value: 'phone', label: '연락처' },
]

type Props = {
  api: GaCustomerExcelManagementApi
  onSaved?: () => void
}

/** SUPER_ADMIN GA 상세 · GA_ADMIN 기능 설정 공용 — 고객 엑셀 관리 SSOT UI */
export function GaCustomerExcelManagementPanel({ api, onSaved }: Props) {
  const [settings, setSettings] = useState<GaCustomerExcelSettingsDto | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sampleBusy, setSampleBusy] = useState(false)
  const [sampleFile, setSampleFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [featureEnabled, setFeatureEnabled] = useState(false)
  const [matchByCol, setMatchByCol] = useState<Record<string, string>>({})

  const loadSettings = useCallback(async () => {
    setLoadErr('')
    setLoading(true)
    try {
      const s = await api.loadSettings()
      setSettings(s)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.')
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (!settings) {
      return
    }
    setFeatureEnabled(settings.featureEnabled)
    const m: Record<string, string> = {}
    for (const c of settings.sampleColumns) {
      m[c.id] = ''
    }
    for (const r of settings.matchRules) {
      m[r.columnId] = r.dbField
    }
    setMatchByCol(m)
  }, [settings])

  const summaryText = useMemo(() => {
    if (!settings) {
      return ''
    }
    return [`설정 완료: ${settings.configReady ? '예' : '아니오'}`, `DB 매칭: ${settings.matchRuleCount}개`].join(' · ')
  }, [settings])

  const onSample = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const file = sampleFile
    if (!file || !file.size) {
      setStatus('파일을 선택해 주세요.')
      return
    }
    setSampleBusy(true)
    setStatus('')
    try {
      const r = await api.uploadSample(file)
      setSettings(r.settings)
      setStatus('샘플 분석이 반영되었습니다. 조회·표시 설정 후 저장해 주세요.')
      setSampleFile(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '샘플 업로드에 실패했습니다.')
    } finally {
      setSampleBusy(false)
    }
  }

  const onSave = async () => {
    if (!settings) {
      return
    }
    const matchRules = Object.entries(matchByCol)
      .filter(([, db]) => db && db.trim())
      .map(([columnId, dbField]) => ({ columnId, dbField: dbField.trim() }))
    setSaving(true)
    setStatus('')
    try {
      const r = await api.saveSettings({ featureEnabled, matchRules })
      setSettings(r.settings)
      setStatus('저장되었습니다.')
      onSaved?.()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loadErr) {
    return <StatusMessage message={loadErr} tone="error" className="mb-2" />
  }

  return (
    <>
      <StatusMessage message={status} tone="default" className="mb-2" />
      {loading ? (
        <LoadingState message="불러오는 중…" />
      ) : !settings ? (
        <EmptyState message="설정을 불러오지 못했습니다." />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">1. 기능 사용 여부</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <FormInput
                type="checkbox"
                checked={featureEnabled}
                onChange={(ev) => setFeatureEnabled(ev.target.checked)}
                className="shrink-0"
              />
              고객 엑셀 기능 사용
            </label>
          </section>

          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">2. 설정 상태 요약</h2>
            <p className="text-sm text-[var(--text-secondary)]">{summaryText}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              마지막 수정: {formatKstDateTimeDisplay(settings.updatedAt, '—')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              샘플 파일: {settings.sampleOriginalFilename || '—'} (
              {formatKstDateTimeDisplay(settings.sampleUploadedAt, '—')})
            </p>
          </section>

          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">3. 샘플 엑셀 업로드 (설정용)</h2>
            <form onSubmit={(ev) => void onSample(ev)} className="flex flex-wrap items-end gap-2">
              <FieldWrapper label="파일 (.xlsx / .xls)">
                <FileUploader
                  accept=".xlsx,.xls"
                  multiple={false}
                  onFiles={(files) => setSampleFile(files[0] ?? null)}
                  selectedNames={sampleFile ? [sampleFile.name] : []}
                  primaryHint="파일을 드래그하거나 클릭하여 업로드"
                  hintLines={['XLS · XLSX']}
                />
              </FieldWrapper>
              <FormButton htmlType="submit" variant="secondary" disabled={sampleBusy}>
                업로드 후 분석
              </FormButton>
            </form>
          </section>

          <section className="border border-[var(--border-default)] rounded-md p-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">4. 조회 매핑 설정</h2>
            {settings.sampleColumns.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">먼저 샘플 엑셀을 업로드하면 컬럼 목록이 표시됩니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-data-table" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th>엑셀 컬럼명</th>
                      <th>고객 DB 매칭</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.sampleColumns.map((c) => (
                      <tr key={c.id}>
                        <td>{c.header}</td>
                        <td>
                          <FormSelect
                            className="admin-form-input"
                            value={matchByCol[c.id] ?? ''}
                            onChange={(ev) =>
                              setMatchByCol((prev) => ({
                                ...prev,
                                [c.id]: ev.target.value,
                              }))
                            }
                            options={DB_FIELD_OPTIONS}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex gap-2">
            <FormButton htmlType="button" variant="primary" disabled={saving} onClick={() => void onSave()}>
              저장
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={() => void loadSettings()}>
              다시 불러오기
            </FormButton>
          </div>
        </div>
      )}
    </>
  )
}
