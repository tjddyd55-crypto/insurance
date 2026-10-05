/**
 * DEV live smoke for read-only AI assistant (requires QA_BEARER_TOKEN).
 * Usage: QA_BEARER_TOKEN=... node qa/readOnlyAssistantDevSmoke.mjs
 */
const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const token = process.env.QA_BEARER_TOKEN ?? ''

async function postMessage(conversationId, text) {
  const res = await fetch(`${BASE}/api/ai/assistant/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversationId, text, pageContext: { currentRoute: '/ai-secretary', currentEntityType: null, currentEntityId: null } }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message ?? `HTTP ${res.status}`)
  }
  return body
}

async function main() {
  const health = await fetch(`${BASE}/api/health`)
  console.log('health', health.status)
  if (!token) {
    console.log('LIVE_GPT: SKIP (no QA_BEARER_TOKEN)')
    process.exit(0)
  }
  let conversationId
  const steps = [
    '홍길동 찾아줘',
    '그 사람 최근 상담 보여줘',
    '그 고객 파일 뭐 있어?',
    '그 고객 페이지 열어줘',
  ]
  for (const text of steps) {
    const res = await postMessage(conversationId, text)
    conversationId = res.conversationId
    const msg = res.messages?.[res.messages.length - 1]
    console.log('---', text)
    console.log('toolKey', msg?.toolKey ?? '—')
    console.log('kind', msg?.kind ?? '—')
    console.log('uiActions', JSON.stringify(msg?.uiActions ?? []))
    console.log('text', String(msg?.text ?? '').slice(0, 200))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
