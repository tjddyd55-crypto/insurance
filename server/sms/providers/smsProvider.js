/**
 * @typedef {Object} SmsSendInput
 * @property {string} to
 * @property {string} from
 * @property {string} message
 * @property {string} [title]
 * @property {Date | null} [scheduledAt]
 * @property {'SMS' | 'LMS' | 'MMS'} [messageType]
 * @property {string} providerUserId
 * @property {string} apiKey
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} SmsSendResult
 * @property {boolean} success
 * @property {string} [providerMessageId]
 * @property {string} [errorMessage]
 * @property {unknown} [raw]
 */

/**
 * @typedef {Object} SmsBalanceInput
 * @property {string} providerUserId
 * @property {string} apiKey
 */

/**
 * @typedef {Object} SmsBalanceResult
 * @property {boolean} success
 * @property {string} [balanceText]
 * @property {unknown} [raw]
 * @property {string} [errorMessage]
 */

/**
 * @typedef {Object} SmsProvider
 * @property {(input: SmsSendInput) => Promise<SmsSendResult>} send
 * @property {(input: SmsBalanceInput) => Promise<SmsBalanceResult>} getBalance
 */

export {}
