#!/usr/bin/env node
'use strict'
const fs = require('fs')
const env = Object.fromEntries(
  fs
    .readFileSync('/home/ubuntu/sms-server/.env', 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('=')
      return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null
    })
    .filter(Boolean),
)
async function postForm(url, fields) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && v !== '') params.set(k, String(v))
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { text: text.slice(0, 300) }
  }
  return { httpStatus: res.status, data }
}
;(async () => {
  const apikey = env.ALIGO_KAKAO_API_KEY
  const userid = env.ALIGO_KAKAO_USER_ID
  const senderkey = env.ALIGO_KAKAO_SENDER_KEY
  const list = await postForm('https://kakaoapi.aligo.in/akv10/template/list/', {
    apikey,
    userid,
    senderkey,
  })
  const arr = Array.isArray(list.data.list) ? list.data.list : []
  const wanted = new Set(['UJ_6184', 'UJ_6670'])
  const matched = arr.filter((t) => wanted.has(String(t.templtCode || t.tpl_code || t.code || '')))
  const pick = (t) => ({
    templtCode: t.templtCode || t.tpl_code || t.code || null,
    name: t.name || t.templtName || null,
    status: t.status || t.inspStatus || t.templtStatus || null,
    keys: Object.keys(t),
    templtContent: t.templtContent || t.content || t.message || null,
    templtTitle: t.templtTitle || t.title || t.subject || null,
    buttons: t.buttons || t.button || t.templtButtons || null,
  })
  console.log(
    JSON.stringify(
      {
        code: list.data.code,
        message: list.data.message,
        total: arr.length,
        matched: matched.map(pick),
        sampleKeys: arr[0] ? Object.keys(arr[0]) : [],
        allCodes: arr.map((t) => t.templtCode || t.tpl_code || t.code || null),
      },
      null,
      2,
    ),
  )
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e.message || e) }))
  process.exit(1)
})
