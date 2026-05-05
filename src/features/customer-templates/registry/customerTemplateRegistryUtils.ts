import type { CustomerIndustryTemplate } from '../customerTemplate.types'
import { CUSTOMER_FIELD_REGISTRY_BY_KEY } from './customerFieldRegistry'
import { FEATURE_MODULE_REGISTRY_BY_ID } from './featureModuleRegistry'

/**
 * insuranceCustomerTemplateV01 등 레거시 숏키 → canonical fieldKey.
 * 템플릿을 canonical 로 일괄 치환하기 전까지 이 맵이 단일 해석 경로다.
 */
export const CUSTOMER_FIELD_KEY_ALIAS_TO_CANONICAL: Readonly<
  Record<string, string>
> = Object.freeze({
  name: 'customer.name',
  phone: 'customer.phone',
  email: 'customer.email',
  address: 'customer.address',
  birthDate: 'customer.birthDate',
  memo: 'customer.memo',
  status: 'customer.status',
  assigneeUserId: 'customer.assigneeUserId',
  tags: 'customer.tags',
  createdAt: 'customer.createdAt',
  ssn: 'insurance.ssn',
  insuranceAge: 'insurance.insuranceAge',
  nextAgeDate: 'insurance.nextAgeDate',
  gender: 'customer.gender',
  job: 'customer.job',
  height: 'customer.height',
  weight: 'customer.weight',
  medical: 'insurance.medical',
  /** 템플릿 위젯 키 `driving` → registry canonical `insurance.drivingText` */
  driving: 'insurance.drivingText',
  isDriver: 'insurance.isDriver',
  carType: 'vehicle.carType',
  carNumber: 'vehicle.carNumber',
  carModel: 'vehicle.carModel',
  carYear: 'vehicle.carYear',
  renewalDate: 'insurance.renewalDate',
  isFavorite: 'customer.isFavorite',
  customerCode: 'customer.customerCode',
})

export function resolveCanonicalFieldKey(fieldKey: string): string {
  if (CUSTOMER_FIELD_REGISTRY_BY_KEY[fieldKey]) return fieldKey
  const viaAlias = CUSTOMER_FIELD_KEY_ALIAS_TO_CANONICAL[fieldKey]
  return viaAlias ?? fieldKey
}

export function getCustomerFieldDefinition(fieldKey: string) {
  const canonical = resolveCanonicalFieldKey(fieldKey)
  return CUSTOMER_FIELD_REGISTRY_BY_KEY[canonical] ?? null
}

export function getFeatureModuleDefinition(featureId: string) {
  return FEATURE_MODULE_REGISTRY_BY_ID[featureId] ?? null
}

export interface CustomerTemplateRegistryValidationResult {
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * 템플릿에 선언된 fieldKey / featureBinding 이 정적 레지스트리와 정합한지 검사한다.
 * — throw 하지 않고 결과 객체만 반환한다.
 */
export function validateCustomerTemplateAgainstRegistries(
  template: CustomerIndustryTemplate,
): CustomerTemplateRegistryValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const ff of template.formFields) {
    const canonical = resolveCanonicalFieldKey(ff.fieldKey)
    const def = CUSTOMER_FIELD_REGISTRY_BY_KEY[canonical]
    if (!def) {
      errors.push(
        `Unknown form fieldKey "${ff.fieldKey}" (resolved "${canonical}") — not in field registry or alias map.`,
      )
      continue
    }
    if (def.status === 'deprecated') {
      warnings.push(
        `Form field "${ff.fieldKey}" maps to deprecated registry field "${canonical}".`,
      )
    }
    if (def.status === 'preview') {
      warnings.push(
        `Form field "${ff.fieldKey}" maps to preview registry field "${canonical}".`,
      )
    }
  }

  const checkFeature = (featureId: string, context: string) => {
    const mod = FEATURE_MODULE_REGISTRY_BY_ID[featureId]
    if (!mod) {
      errors.push(`Unknown ${context} featureId "${featureId}".`)
      return
    }
    if (mod.status === 'deprecated') {
      warnings.push(`${context}: feature "${featureId}" is deprecated in registry.`)
    }
    if (mod.status === 'preview') {
      warnings.push(`${context}: feature "${featureId}" is preview in registry.`)
    }
  }

  for (const tab of template.detailTabs) {
    checkFeature(tab.featureBinding, `detailTabs[${tab.tabId}]`)
  }

  for (const id of template.sharedFeatureBindings) {
    checkFeature(id, 'sharedFeatureBindings')
  }

  for (const id of template.extensionFeatureBindings) {
    checkFeature(id, 'extensionFeatureBindings')
  }

  return { errors, warnings }
}
