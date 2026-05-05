import type {
  CustomerFieldRegistryEntry,
  FeatureModuleRegistryEntry,
  CustomerFieldRegistryDomain,
} from '../../../customer-templates/registry/customerTemplateRegistry.types'

/** field·feature 레지스트리 status 집합(동일) */
export type RegistryItemStatus = 'active' | 'preview' | 'deprecated'

export type StatusTotals = Readonly<Record<RegistryItemStatus, number>>

export interface DomainTotalRow {
  readonly domain: CustomerFieldRegistryDomain | string
  readonly count: number
}

/** Registry 항목 순회 순서(sort 기준 포함)용 */
export function sortFieldDefinitions(
  fields: Iterable<CustomerFieldRegistryEntry>,
): CustomerFieldRegistryEntry[] {
  return [...fields].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
}

export function sortFeatureDefinitions(
  features: Iterable<FeatureModuleRegistryEntry>,
): FeatureModuleRegistryEntry[] {
  return [...features].sort((a, b) => a.featureId.localeCompare(b.featureId))
}

/** 필드 레코드별로 domains 배열에 중복 카운트(한 필드가 여러 domain이면 각각 증가) */
export function countDomainsFromFields(fields: Iterable<CustomerFieldRegistryEntry>): DomainTotalRow[] {
  const acc = new Map<string, number>()
  for (const f of fields) {
    for (const d of f.domains) {
      acc.set(d, (acc.get(d) ?? 0) + 1)
    }
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, count]) => ({ domain, count }))
}

export function countDomainsFromFeatures(
  features: Iterable<FeatureModuleRegistryEntry>,
): DomainTotalRow[] {
  const acc = new Map<string, number>()
  for (const f of features) {
    for (const d of f.domains) {
      acc.set(d, (acc.get(d) ?? 0) + 1)
    }
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, count]) => ({ domain, count }))
}

export function countByStatus<const T extends { readonly status: RegistryItemStatus }>(
  items: Iterable<T>,
): StatusTotals {
  const out: Record<string, number> = { active: 0, preview: 0, deprecated: 0 }
  for (const item of items) {
    const k = item.status
    out[k] = (out[k] ?? 0) + 1
  }
  return out as StatusTotals
}

export interface PlatformRegistriesViewProps {
  readonly fieldsSorted: CustomerFieldRegistryEntry[]
  readonly featuresSorted: FeatureModuleRegistryEntry[]
  readonly fieldTotals: Readonly<{ total: number; byStatus: StatusTotals }>
  readonly featureTotals: Readonly<{ total: number; byStatus: StatusTotals }>
  readonly fieldDomains: DomainTotalRow[]
  readonly featureDomains: DomainTotalRow[]
}

export function storageMappingKind(mapping: CustomerFieldRegistryEntry['storageMapping']): string {
  return mapping.kind
}
