import { estimateSmsByteLength, resolveMessageType, renderSmsTemplate } from '../sms/smsMessageUtils.js'
import { isSmsRealSendEnabled } from '../sms/smsModuleConfig.js'
/** Reuse CRM SMS rendering/byte policy. This offline adapter never imports any outbound sender. */
export function healthwaySmsPreview(link) {
  const message = renderSmsTemplate('[ONE FC DEV 테스트] 건강정보 고속도로 오프라인 샘플 연결입니다. 실제 인증·조회·문자 발송이 없습니다.\n{기준일}', { referenceDate: link })
  return { dryRun: true, sent: false, message, bytes: estimateSmsByteLength(message), messageType: resolveMessageType(message),
    existingRealSendGate: isSmsRealSendEnabled(), label: '문자 미리보기 · 실제 발송 안 함' }
}
