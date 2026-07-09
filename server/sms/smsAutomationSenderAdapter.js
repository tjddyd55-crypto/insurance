import { isSmsRealSendEnabled } from './smsModuleConfig.js'
import { sendSingleSms } from './smsSendService.js'
import { getSmsSettings } from './smsSettingsService.js'

/**
 * 자동문자 전용 CRM 문자 발송 adapter.
 * 기존 sendSingleSms를 래핑하며 gateway/인증 문자 코드는 수정하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{
 *   customerId: number;
 *   phone: string;
 *   messageBody: string;
 *   senderNumber?: string | null;
 * }} input
 */
export async function sendAutomationSms(executor, scope, input) {
  if (!isSmsRealSendEnabled()) {
    const err = new Error('sms_real_send_disabled')
    err.status = 403
    err.publicMessage =
      '실제 문자 발송은 아직 활성화되지 않았습니다. SMS_MODULE_REAL_SEND_ENABLED 설정 후 알리고 E2E 검증이 필요합니다.'
    throw err
  }

  const settings = await getSmsSettings(executor, scope)
  const senderNumber = String(input.senderNumber ?? settings.defaultSender ?? '').trim()
  if (!senderNumber) {
    const err = new Error('sms_automation_sender_missing')
    err.status = 400
    err.publicMessage = '문자 설정에서 기본 발신번호를 등록해 주세요.'
    throw err
  }

  return sendSingleSms(executor, scope, {
    senderNumber,
    receiver: input.phone,
    message: input.messageBody,
    customerId: input.customerId,
    messageType: 'info',
    title: '자동문자',
  })
}
