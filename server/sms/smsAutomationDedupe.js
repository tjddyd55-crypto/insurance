import { formatDateOnly } from '../../shared/dateTimeKst.js'

const TRIGGER_TO_REFERENCE_TYPE = {
  BIRTHDAY: 'BIRTHDAY',
  CAR_INSURANCE_EXPIRY: 'CAR',
  INSURANCE_AGE: 'INSURANCE_AGE',
  CUSTOMER_SPECIAL_DATE: 'SPECIAL_DATE',
}

function extractMonthDayFromYmd(ymd) {
  const value = formatDateOnly(ymd)
  if (!value) {
    return null
  }
  const [, month, day] = value.split('-')
  return `${month}-${day}`
}

/**
 * @param {string} triggerType
 * @param {{
 *   customerId: number;
 *   referenceDate?: string | null;
 *   referenceId?: number | null;
 *   referenceTitle?: string | null;
 * }} context
 * @returns {string | null}
 */
export function buildTriggerInstanceKey(triggerType, context) {
  const type = String(triggerType ?? '').trim().toUpperCase()
  const customerId = Number(context.customerId)
  const referenceDate = formatDateOnly(context.referenceDate)

  switch (type) {
    case 'BIRTHDAY': {
      const md = extractMonthDayFromYmd(referenceDate)
      return md ? `BIRTHDAY:${md}` : null
    }
    case 'CAR_INSURANCE_EXPIRY': {
      if (!referenceDate) {
        return null
      }
      const referenceId = Number(context.referenceId)
      if (Number.isInteger(referenceId) && referenceId > 0) {
        return `CAR_EXPIRY:${referenceId}:${referenceDate}`
      }
      if (Number.isInteger(customerId) && customerId > 0) {
        return `CAR_EXPIRY:CUSTOMER:${customerId}:${referenceDate}`
      }
      return null
    }
    case 'INSURANCE_AGE': {
      if (!referenceDate || !(Number.isInteger(customerId) && customerId > 0)) {
        return null
      }
      return `INSURANCE_AGE:${customerId}:${referenceDate}`
    }
    case 'CUSTOMER_SPECIAL_DATE': {
      const md = extractMonthDayFromYmd(referenceDate)
      if (!md) {
        return null
      }
      const referenceId = Number(context.referenceId)
      if (Number.isInteger(referenceId) && referenceId > 0) {
        return `SPECIAL_DATE:${referenceId}:${md}`
      }
      const title = String(context.referenceTitle ?? '').trim().slice(0, 40)
      return title ? `SPECIAL_DATE:TITLE:${title}:${md}` : `SPECIAL_DATE:UNKNOWN:${md}`
    }
    default:
      return null
  }
}

/**
 * @param {string} triggerType
 * @returns {string}
 */
export function mapTriggerTypeToReferenceType(triggerType) {
  const type = String(triggerType ?? '').trim().toUpperCase()
  return TRIGGER_TO_REFERENCE_TYPE[type] ?? type
}

/**
 * preview item에 실행 메타데이터를 부착한다.
 * @param {Record<string, unknown>} item
 * @param {Record<string, unknown>} candidate
 * @param {string} triggerType
 */
export function enrichPreviewItemForExecution(item, candidate, triggerType) {
  const referenceType = mapTriggerTypeToReferenceType(triggerType)
  const referenceId =
    candidate.referenceId != null && Number.isInteger(Number(candidate.referenceId))
      ? Number(candidate.referenceId)
      : null
  const triggerInstanceKey = buildTriggerInstanceKey(triggerType, {
    customerId: Number(item.customerId),
    referenceDate: item.referenceDate,
    referenceId,
    referenceTitle: item.referenceTitle,
  })
  return {
    ...item,
    referenceType,
    referenceId,
    triggerInstanceKey,
  }
}
