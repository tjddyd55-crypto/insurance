import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import {
  fetchGaCustomerExcelCapability,
  fetchUserExcelData,
  patchUserExcelColumns,
  uploadUserExcelData,
  type GaCustomerExcelCapability,
} from '../../customers/api/gaCustomerExcelApi'

const L = {
  label: '\uACE0\uAC1D \uC5D1\uC140 (GA)',
  loadFail: '\uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
  pickFile: '\uD30C\uC77C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
  uploadFail: '\uC5C5\uB85C\uB4DC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
  saveFail: '\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
  noFeature: '\uC774 GA\uC5D0\uC11C\uB294 \uC774 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
  intro:
    'GA\uC5D0 \uC124\uC815\uB41C \uC0D8\uD50C\uACFC \uB3D9\uC77C\uD55C \uC5F4 \uAD6C\uC870\uC758 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC5C5\uB85C\uB4DC \uC2DC \uAE30\uC874 \uB370\uC774\uD130\uB294 \uC0AD\uC81C \uD6C4 \uB300\uCE58\uB429\uB2C8\uB2E4.',
  fileTypes: '\uD30C\uC77C (.xlsx / .xls)',
  upload: '\uC5C5\uB85C\uB4DC',
  displayTitle: '\uACE0\uAC1D \uD654\uBA74\uC5D0 \uD45C\uC2DC',
  emptyCols: '\uC0D8\uD50C \uC5D1\uC140 \uC124\uC815 \uD6C4 \uC5EC\uAE30\uC5D0 \uCEEC\uB7FC \uBAA9\uB85D\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.',
}

type Props = {
  token: string
}

export function UserGaExcelManagePanel({ token }: Props) {
  const [cap, setCap] = useState<GaCustomerExcelCapability | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [sampleColumns, setSampleColumns] = useState<{ id: string; header: string }[]>([])
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoadErr('')
    try {
      const c = await fetchGaCustomerExcelCapability(token)
      setCap(c)
      if (!c.showDesignerUi) {
        setRowCount(null)
        setSampleColumns([])
        setVisibility({})
        return
      }
      const d = await fetchUserExcelData(token)
      setRowCount(d.sourceRowCount)
      setSampleColumns(d.sampleColumns.map((x) => ({ id: x.id, header: x.header })))
      const vis: Record<string, boolean> = {}
      for (const col of d.sampleColumns) {
        vis[col.id] = true
      }
      for (const s of d.columnSettings) {
        vis[s.column_name] = s.is_visible
      }
      setVisibility(vis)
    } catch (e) {
      setCap(null)
      setLoadErr(e instanceof Error ? e.message : L.loadFail)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    if (!cap?.showDesignerUi) {
      return ''
    }
    if (rowCount == null) {
      return ''
    }
    return `\uC5C5\uB85C\uB4DC\uB41C \uD589: ${rowCount}\uAC74`
  }, [cap?.showDesignerUi, rowCount])

  const onUpload = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    if (!token?.trim() || !cap?.showDesignerUi) {
      return
    }
    const fd = new FormData(ev.currentTarget)
    const file = fd.get('gaUserExcel') as File | null
    if (!file?.size) {
      setInfo('')
      setLoadErr(L.pickFile)
      return
    }
    setBusy(true)
    setLoadErr('')
    setInfo('')
    try {
      const r = await uploadUserExcelData(token, file)
      setInfo(`\uC5C5\uB85C\uB4DC \uC644\uB8CC (${r.rowCount}\uD589).`)
      await load()
      ev.currentTarget.reset()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : L.uploadFail)
    } finally {
      setBusy(false)
    }
  }

  const onToggleColumn = async (colId: string, next: boolean) => {
    if (!token?.trim() || !cap?.showDesignerUi) {
      return
    }
    setVisibility((prev) => ({ ...prev, [colId]: next }))
    setLoadErr('')
    try {
      await patchUserExcelColumns(token, [{ column_name: colId, is_visible: next }])
    } catch (e) {
      setVisibility((prev) => ({ ...prev, [colId]: !next }))
      setLoadErr(e instanceof Error ? e.message : L.saveFail)
    }
  }

  if (loadErr && !cap) {
    return (
      <div className="field">
        <span className="field__label">{L.label}</span>
        <StatusMessage message={loadErr} tone="error" />
      </div>
    )
  }

  if (!cap?.featureEnabled) {
    return null
  }

  if (!cap.showDesignerUi) {
    return (
      <div className="field">
        <span className="field__label">{L.label}</span>
        <p className="text-sm text-[var(--text-secondary)]">{cap.message || L.noFeature}</p>
      </div>
    )
  }

  return (
    <div className="field">
      <span className="field__label">{L.label}</span>
      <p className="text-sm text-[var(--text-secondary)] mb-2">{L.intro}</p>
      {summary ? <p className="text-sm text-[var(--text-primary)] mb-2">{summary}</p> : null}
      <StatusMessage message={loadErr} tone="error" />
      <StatusMessage message={info} tone="default" />

      <form onSubmit={(e) => void onUpload(e)} className="flex flex-wrap items-end gap-2 mb-4">
        <label className="text-sm text-[var(--text-secondary)]">
          {L.fileTypes}
          <FormInput type="file" name="gaUserExcel" accept=".xlsx,.xls" className="block mt-1 text-sm" />
        </label>
        <FormButton htmlType="submit" variant="secondary" disabled={busy}>
          {L.upload}
        </FormButton>
      </form>

      {sampleColumns.length > 0 ? (
        <div>
          <span className="field__label block mb-2">{L.displayTitle}</span>
          <ul className="text-sm space-y-1 max-h-48 overflow-y-auto border border-[var(--border-default)] rounded p-2">
            {sampleColumns.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <FormInput
                  type="checkbox"
                  id={`ga-col-${c.id}`}
                  checked={visibility[c.id] !== false}
                  onChange={(ev) => void onToggleColumn(c.id, ev.target.checked)}
                  className="shrink-0"
                />
                <label htmlFor={`ga-col-${c.id}`} className="cursor-pointer">
                  {c.header} <span className="text-[var(--text-secondary)]">({c.id})</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{L.emptyCols}</p>
      )}
    </div>
  )
}
