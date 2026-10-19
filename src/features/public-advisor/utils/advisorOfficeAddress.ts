import type { AddressSearchValue } from '../../../components/form/addressSearchUtils'

export type AdvisorOfficeProfileColumns = {
  office_postal_code?: unknown
  office_road_address?: unknown
  office_address_detail?: unknown
  office_address_sido?: unknown
  office_address_sigungu?: unknown
}

export type AdvisorOfficeSavePayload = {
  office_postal_code: string
  office_road_address: string
  office_address_detail: string
  office_address_sido: string
  office_address_sigungu: string
}

function text(value: unknown): string {
  return String(value ?? '')
}

export function emptyAdvisorOfficeAddress(): AddressSearchValue {
  return {
    zonecode: '',
    baseAddress: '',
    detailAddress: '',
    sido: '',
    sigungu: '',
    regionCaptured: false,
  }
}

/** DB 컬럼 → 주소 검색 필드. 기본주소와 상세주소는 서로 다른 칸으로 되돌린다. */
export function advisorOfficeAddressFromProfile(profile: AdvisorOfficeProfileColumns): AddressSearchValue {
  const sido = text(profile.office_address_sido)
  const sigungu = text(profile.office_address_sigungu)
  return {
    zonecode: text(profile.office_postal_code),
    baseAddress: text(profile.office_road_address),
    detailAddress: text(profile.office_address_detail),
    sido,
    sigungu,
    regionCaptured: Boolean(sido.trim() || sigungu.trim()),
  }
}

/** 주소 검색 필드 → PATCH 컬럼. 검색 기본주소와 직접 입력 상세주소를 분리해 저장한다. */
export function advisorOfficeColumnsFromAddress(value: AddressSearchValue): AdvisorOfficeSavePayload {
  return {
    office_postal_code: value.zonecode.trim(),
    office_road_address: value.baseAddress.trim(),
    office_address_detail: value.detailAddress.trim(),
    office_address_sido: String(value.sido ?? '').trim(),
    office_address_sigungu: String(value.sigungu ?? '').trim(),
  }
}

export function buildAdvisorOfficeDisplayLine(
  value: Pick<AddressSearchValue, 'baseAddress' | 'detailAddress'>,
): string {
  return [value.baseAddress, value.detailAddress].map((part) => part.trim()).filter(Boolean).join(' ')
}
