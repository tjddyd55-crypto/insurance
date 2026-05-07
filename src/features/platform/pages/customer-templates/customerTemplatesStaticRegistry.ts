import type { CustomerIndustryTemplate } from '../../../customer-templates/customerTemplate.types'
import { governmentCustomerTemplateV01 } from '../../../customer-templates/government/governmentCustomerTemplateV01'
import { gymCustomerTemplateV01 } from '../../../customer-templates/gym/gymCustomerTemplateV01'
import { insuranceCustomerTemplateV01 } from '../../../customer-templates/insurance/insuranceCustomerTemplate'

/**
 * Super Admin 조회용 정적 템플릿 목록(v0.1).
 * 추후 업종별 템플릿 파일이 늘면 여기만 추가한다.
 */
export const PLATFORM_ADMIN_STATIC_CUSTOMER_TEMPLATES: readonly CustomerIndustryTemplate[] = Object.freeze([
  insuranceCustomerTemplateV01,
  governmentCustomerTemplateV01,
  gymCustomerTemplateV01,
])
