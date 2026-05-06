/**
 * 업종별 고객 관리 템플릿(선언만) 및 tenant.config.crm merger 입력 타입.
 * — 렌더/권한/API는 포함하지 않는다.
 */

export type CustomerTemplateDomain = 'core' | 'insurance'

/** 필드 민감도(표시 마스킹·감사 UI 등 향후 훅) */
export type CustomerTemplatePrivacyLevel = 'normal' | 'sensitive' | 'identifying'

/** v0.1: 문자열로 두고 렌더기가 해석한다. 이후 버전에서 union 좁히기 가능 */
export type CustomerTemplateFormWidget = string

export interface CustomerTemplateMeta {
  templateId: string
  industryCode: string
  /** 템플릿 문서 버전(예 "0.1") */
  version: string
  /** 이 타입 정의 호환 레이어(예 "0.1") */
  schemaVersion: string
}

export interface CustomerTemplateFormField {
  fieldKey: string
  label: string
  widget: CustomerTemplateFormWidget
  required: boolean
  visibleDefault: boolean
  order: number
  privacyLevel: CustomerTemplatePrivacyLevel
  domain: CustomerTemplateDomain
}

export interface CustomerTemplateListColumn {
  columnKey: string
  label: string
  order: number
  visibleDefault: boolean
  domain: CustomerTemplateDomain
}

export interface CustomerTemplateDetailTab {
  tabId: string
  label: string
  /** shared 또는 업종 확장 기능 식별자 */
  featureBinding: string
  order: number
  domain: CustomerTemplateDomain
  visibleDefault: boolean
}

/** 단일 업종(customer) 템플릿 레코드 — 보험은 extensionFeatureBindings 채운다 */
export interface CustomerIndustryTemplate {
  meta: CustomerTemplateMeta
  formFields: readonly CustomerTemplateFormField[]
  listColumns: readonly CustomerTemplateListColumn[]
  detailTabs: readonly CustomerTemplateDetailTab[]
  /** 공통 CRM 기능 슬롯 */
  sharedFeatureBindings: readonly string[]
  /** 업종 전용 기능 슬롯(예: 보험) */
  extensionFeatureBindings: readonly string[]
}

/** tenant.config 에 넣게 될 CRM 오버레이 구조 예시(.crm) */
export interface TenantCrmConfig {
  /** `tabId` 또는 향후 `feature.xxx` 키 — `false`면 해당 탭/기본 노출 숨김 */
  featureFlags?: Readonly<Record<string, boolean>>
  /** `fieldKey` 기준 속성 패치 */
  fieldOverrides?: Readonly<
    Record<string, Partial<Pick<CustomerTemplateFormField, 'label' | 'required' | 'visibleDefault'>>>
  >
  /** 우선 필드 라벨, 동일 키가 detail tabId와 충돌하지 않도록 운영에서 관리 */
  labels?: Readonly<Record<string, string>>
}

export interface TenantConfigWithCrm {
  crm?: TenantCrmConfig
}
