import type { ClaimCompany } from '../api/claimRequestsApi'

export type ClaimCompanyExtraFieldDef = {
  key: string
  label: string
  type: 'text' | 'date' | 'select' | 'textarea'
  required: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

/** 1차: 회사명 기준 추가 필드. 2차에서 관리자 UI로 이관 예정 */
const CLAIM_COMPANY_EXTRA_FIELDS_BY_NAME: Record<string, ClaimCompanyExtraFieldDef[]> = {
  삼성생명: [
    {
      key: 'idCardIssuedDate',
      label: '신분증 발급일자',
      type: 'date',
      required: true,
    },
  ],
  교보생명: [
    {
      key: 'beneficiaryRelation',
      label: '수익자 관계',
      type: 'text',
      required: false,
      placeholder: '예: 본인, 배우자',
    },
  ],
  현대해상: [
    {
      key: 'accidentLocation',
      label: '사고 장소',
      type: 'text',
      required: false,
      placeholder: '예: 자택, 도로, 사업장',
    },
  ],
  'DB손해보험': [
    {
      key: 'accidentLocation',
      label: '사고 장소',
      type: 'text',
      required: true,
      placeholder: '예: 자택, 도로, 사업장',
    },
  ],
  DB손보: [
    {
      key: 'accidentLocation',
      label: '사고 장소',
      type: 'text',
      required: true,
      placeholder: '예: 자택, 도로, 사업장',
    },
  ],
}

export function getExtraFieldsForCompany(company: Pick<ClaimCompany, 'companyName'>): ClaimCompanyExtraFieldDef[] {
  const name = String(company.companyName ?? '').trim()
  if (!name) {
    return []
  }
  return CLAIM_COMPANY_EXTRA_FIELDS_BY_NAME[name] ?? []
}
