import { getOpenAiConfig } from '../openaiConfig.js'
import { callOpenAiResponses } from '../openaiClient.js'

const GENERAL_CHAT_SYSTEM = `You are ONE FC AI assistant for insurance CRM users in Korea.
Respond naturally in Korean, conversationally and helpfully.
You may answer general knowledge, insurance concepts, writing/drafting, rewriting, summarizing, and small talk.
Do NOT invent real CRM records (customers, consultations, schedules, claims) — you do not have live app data unless a tool ran.
If the user asks for real customer/consultation/schedule data you cannot access, say the feature is not connected yet; do not fabricate names or records.
Do not force special commands or menu paths. Do not tell users to attach files unless they asked about customer import.
For real-time web/stock prices, say live web lookup is not connected; give general guidance only.
Keep answers concise unless the user wants detail.`

/**
 * @param {string} text
 */
function offlineGeneralChatFallback(text) {
  const t = String(text ?? '').trim()
  if (/질문.*(해도|할게|할께|하나)|물어볼|물어봐/.test(t)) {
    return '네, 편하게 질문해 주세요. 보험·상담·업무 관련이든 일반적인 내용이든 말씀해 주시면 됩니다.'
  }
  if (/^안녕/.test(t)) {
    return '안녕하세요! 무엇이든 편하게 말씀해 주세요.'
  }
  if (/고마워|감사/.test(t)) {
    return '도움이 되었다니 다행입니다. 또 필요하시면 말씀해 주세요.'
  }
  return '네, 말씀해 주세요. 일반적인 질문이나 문장 작성·요약도 도와드릴 수 있습니다.'
}

/**
 * @param {{ text: string, recentTurns: Array<{role: string, text?: string}>, currentRoute?: string|null, env?: object }} input
 */
export async function generateGeneralChatResponse(input) {
  const cfg = getOpenAiConfig(input.env ?? process.env)
  if (!cfg.enabled) {
    return {
      text: offlineGeneralChatFallback(input.text),
      usage: null,
      callType: 'general_chat_answer',
      source: 'offline_fallback',
    }
  }

  const turns = (input.recentTurns ?? []).slice(-8)
  const transcript = turns
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${String(t.text ?? '').slice(0, 400)}`)
    .join('\n')

  const userPayload = JSON.stringify({
    currentScreen: input.currentRoute ?? null,
    conversationTranscript: transcript,
    latestUserMessage: String(input.text ?? '').slice(0, 800),
  })

  const { outputText, usage } = await callOpenAiResponses(
    {
      developerInstructions: GENERAL_CHAT_SYSTEM,
      userInput: userPayload,
    },
    input.env ?? process.env,
  )

  const text = String(outputText ?? '').trim() || offlineGeneralChatFallback(input.text)
  return {
    text,
    usage: usage ? { ...usage, callType: 'general_chat_answer' } : null,
    callType: 'general_chat_answer',
    source: 'gpt',
  }
}
