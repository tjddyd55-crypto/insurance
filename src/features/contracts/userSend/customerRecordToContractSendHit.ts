import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'
import { maskPhoneForTestConsole } from '../testConsole/contractSignatureTestDisplay'
import type { CustomerRecord } from '../../customers/domain/types'
import type { UserContractCustomerSearchHit } from './contractSignatureSendClient'

/** 고객 CRM 레코드 → 전자서명 발송 화면 고객 선택 hit */
export function customerRecordToContractSendHit(c: CustomerRecord): UserContractCustomerSearchHit {
  const digits = normalizeKrMobile(c.phone ?? c.phoneNumber ?? '')
  const hasPhone = digits.length > 0 && validateKrMobileDigits(digits) == null
  return {
    id: c.id,
    name: String(c.name ?? '').trim() || '고객',
    customerCode: c.customerCode ?? null,
    maskedPhone: hasPhone ? maskPhoneForTestConsole(digits) : '—',
    hasPhone,
  }
}
