import { resolveApprovedAligoCredentials } from './smsService.js'
import { aligoSmsProvider } from '../sms/providers/aligoSmsProvider.js'
import { resolveMessageType } from '../sms/smsMessageUtils.js'

/**
 * 슈퍼어드민 사용자 안내문자가 쓸 Aligo 계정.
 * 자격증명 조립은 인증 SMS와 같은 resolveApprovedAligoCredentials 에만 둔다.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveAdminNoticeAligoAccount(env = process.env) {
  const credentials = resolveApprovedAligoCredentials(env)
  return {
    ready: credentials.ready,
    sender: credentials.sender,
    userId: credentials.userId,
    apiKey: credentials.apiKey,
  }
}

/**
 * 승인 발신번호로 안내문자 1건을 보낸다.
 * 90바이트 이하는 SMS, 초과는 LMS이며 LMS일 때만 제목을 subject로 넘긴다.
 * 제목이 비어 있어도 발송은 막지 않는다.
 * @param {{ to: string, message: string, title?: string }} input
 */
export async function sendAdminNoticeSms(input) {
  const account = resolveAdminNoticeAligoAccount()
  if (!account.ready) {
    return {
      success: false,
      errorCode: 'aligo_unconfigured',
      errorMessage: '알리고 발송 설정이 없습니다.',
    }
  }

  const message = String(input.message ?? '')
  const messageType = resolveMessageType(message)
  const title = String(input.title ?? '').trim()

  return aligoSmsProvider.send({
    to: String(input.to ?? ''),
    from: account.sender,
    message,
    title,
    messageType,
    providerUserId: account.userId,
    apiKey: account.apiKey,
  })
}
