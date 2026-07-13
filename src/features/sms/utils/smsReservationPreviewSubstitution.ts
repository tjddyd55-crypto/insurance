import { SMS_EXPLICIT_SAMPLE_VALUES } from '../config/smsCompose.config'
import type { SmsPreviewSubstitution } from './smsTemplateVariables'

export type ReservationPreviewContext = {
  customerName?: string | null
  agentName?: string | null
  agentPhone?: string | null
  referenceDate?: string | null
  dDayLabel?: string | null
}

export function buildReservationPreviewSubstitution(
  context: ReservationPreviewContext = {},
): SmsPreviewSubstitution {
  const customerName = context.customerName?.trim()
  if (customerName) {
    return {
      mode: 'selectedCustomer',
      selectedCustomerName: customerName,
      values: {
        customerName,
        agentName: context.agentName?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.agentName,
        agentPhone: context.agentPhone?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.agentPhone,
        referenceDate: context.referenceDate?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.referenceDate,
        dDayLabel: context.dDayLabel?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.dDayLabel,
      },
    }
  }

  return {
    mode: 'explicitSample',
    values: {
      customerName: SMS_EXPLICIT_SAMPLE_VALUES.customerName,
      agentName: context.agentName?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.agentName,
      agentPhone: context.agentPhone?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.agentPhone,
      referenceDate: context.referenceDate?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.referenceDate,
      dDayLabel: context.dDayLabel?.trim() || SMS_EXPLICIT_SAMPLE_VALUES.dDayLabel,
    },
  }
}
