import {
  PDF_FIELD_DATA_GROUPS,
  buildPdfMappingKey,
  labelForPdfDataGroup,
  labelForPdfMappingItem,
  listPdfFieldItemsForGroup,
  parsePdfMappingKey,
  type PdfFieldDataGroupId,
} from '../config/pdfFieldDataGroups'
import { normalizePdfFieldDataMapping } from '../lib/resolvePdfFieldValue'
import type { PdfFieldDataMapping } from '../types'

type Props = {
  mapping: PdfFieldDataMapping
  compact?: boolean
  onChange: (next: PdfFieldDataMapping, options?: { clearIntent?: boolean }) => void
}

export function formatPdfFieldMappingSummary(mapping: PdfFieldDataMapping): string {
  const m = normalizePdfFieldDataMapping(mapping)
  if (m.dataSourceType === 'customer' && m.customerFieldKey) {
    const groupLabel = labelForPdfDataGroup(m.dataGroup ?? parsePdfMappingKey(m.customerFieldKey).dataGroup)
    const itemLabel =
      m.customerFieldLabel ||
      labelForPdfMappingItem(
        (m.dataGroup ?? parsePdfMappingKey(m.customerFieldKey).dataGroup) as PdfFieldDataGroupId,
        m.fieldKey ?? parsePdfMappingKey(m.customerFieldKey).fieldKey,
      ) ||
      m.customerFieldKey
    return groupLabel ? `${groupLabel} · ${itemLabel}` : itemLabel
  }
  return '직접 입력'
}

function resolvedGroupAndField(m: PdfFieldDataMapping): {
  dataGroup: PdfFieldDataGroupId
  fieldKey: string | null
} {
  if (m.dataGroup && m.dataGroup !== 'manual') {
    return { dataGroup: m.dataGroup, fieldKey: m.fieldKey }
  }
  if (m.customerFieldKey) {
    const parsed = parsePdfMappingKey(m.customerFieldKey)
    if (parsed.dataGroup !== 'manual') {
      return { dataGroup: parsed.dataGroup, fieldKey: parsed.fieldKey }
    }
  }
  return { dataGroup: 'manual', fieldKey: null }
}

export function PdfFieldDataMappingControls({ mapping, compact = false, onChange }: Props) {
  const m = normalizePdfFieldDataMapping(mapping)
  const { dataGroup, fieldKey } = resolvedGroupAndField(m)
  const items = listPdfFieldItemsForGroup(dataGroup)

  const commitCustomerMapping = (nextGroup: PdfFieldDataGroupId, nextFieldKey: string | null) => {
    if (nextGroup === 'manual') {
      onChange(
        {
          ...m,
          dataSourceType: 'manual',
          dataGroup: 'manual',
          fieldKey: null,
          customerFieldKey: null,
          customerFieldLabel: null,
        },
        { clearIntent: true },
      )
      return
    }
    const fk = nextFieldKey ?? items[0]?.fieldKey ?? null
    if (!fk) {
      return
    }
    const customerFieldKey = buildPdfMappingKey(nextGroup, fk)
    onChange(
      {
        ...m,
        dataSourceType: 'customer',
        dataGroup: nextGroup,
        fieldKey: fk,
        customerFieldKey,
        customerFieldLabel: labelForPdfMappingItem(nextGroup, fk) || null,
      },
      { clearIntent: false },
    )
  }

  const setDataGroup = (nextGroup: PdfFieldDataGroupId) => {
    if (nextGroup === 'manual') {
      commitCustomerMapping('manual', null)
      return
    }
    const first = listPdfFieldItemsForGroup(nextGroup)[0]
    commitCustomerMapping(nextGroup, first?.fieldKey ?? null)
  }

  const setFieldKey = (nextFieldKey: string) => {
    if (dataGroup === 'manual') {
      return
    }
    commitCustomerMapping(dataGroup, nextFieldKey)
  }

  return (
    <div className={compact ? 'pdf-engine-mapping-controls pdf-engine-mapping-controls--compact' : 'pdf-engine-mapping-controls'}>
      <label className="pdf-engine-editor__label pdf-engine-mapping-controls__source">
        {compact ? null : <span className="pdf-engine-mapping-controls__label-text">데이터 구분</span>}
        <select
          value={dataGroup}
          onChange={(e) => setDataGroup(e.target.value as PdfFieldDataGroupId)}
          onClick={(e) => e.stopPropagation()}
        >
          {PDF_FIELD_DATA_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      {dataGroup !== 'manual' ? (
        <label className="pdf-engine-editor__label pdf-engine-mapping-controls__customer-key">
          {compact ? null : <span className="pdf-engine-mapping-controls__label-text">항목</span>}
          <select
            value={fieldKey ?? ''}
            onChange={(e) => setFieldKey(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">— 선택 —</option>
            {items.map((o) => (
              <option key={o.fieldKey} value={o.fieldKey}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
