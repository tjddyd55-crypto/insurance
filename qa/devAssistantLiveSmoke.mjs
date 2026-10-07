/**
 * DEV AI assistant smoke — token via QA_BEARER_TOKEN or DEV_TEST_USERNAME + DEV_TEST_PASSWORD (never log password).
 */
const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'

async function resolveToken() {
  if (process.env.QA_BEARER_TOKEN) {
    return process.env.QA_BEARER_TOKEN
  }
  const username = process.env.DEV_TEST_USERNAME ?? 'tjddyd55'
  const password = process.env.DEV_TEST_PASSWORD ?? ''
  if (!password) {
    return null
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message ?? `login HTTP ${res.status}`)
  }
  return body.token
}

async function postMessage(token, conversationId, text) {
  const res = await fetch(`${BASE}/api/ai/assistant/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      text,
      pageContext: { currentRoute: '/ai-secretary', currentEntityType: null, currentEntityId: null },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message ?? `HTTP ${res.status}`)
  }
  return body
}

const steps = [
  '고객 리스트 나열해봐',
  '고객 몇 명 있어?',
  'AI테스트_홍길동 찾아줘',
  '그 사람 최근 상담 보여줘',
  '그 고객 파일 뭐 있어?',
  '그 고객 페이지 열어줘',
  '오늘 할 일 알려줘',
  '오늘 일정 보여줘',
  '미처리 청구 보여줘',
  'AI테스트_동명이인 찾아줘',
  'AI테스트_없는고객 찾아줘',
]

async function main() {
  const health = await fetch(`${BASE}/api/health`)
  console.log('health', health.status)
  const token = await resolveToken()
  if (!token) {
    console.log('LIVE: SKIP (set QA_BEARER_TOKEN or DEV_TEST_PASSWORD)')
    process.exit(0)
  }
  let conversationId
  for (const text of steps) {
    const res = await postMessage(token, conversationId, text)
    conversationId = res.conversationId
    const msg = res.messages?.[res.messages.length - 1]
    console.log('---', text)
    console.log('toolKey', msg?.toolKey ?? '—')
    console.log('kind', msg?.kind ?? '—')
    console.log('text', String(msg?.text ?? '').slice(0, 280))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
